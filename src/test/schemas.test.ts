import { describe, it, expect } from 'vitest';
import {
  ScanResultSchema,
  MoveScanResultSchema,
  DetailScanResultSchema,
  PostProductionResultSchema,
  MoveOutputSchema,
  validateOrThrow,
} from '../schemas';

describe('ScanResultSchema', () => {
  const validScan = {
    isFloorPlan: false,
    typology: 'Residencial',
    materials: [{ elemento: 'Parede', acabamento: 'Laca', reflectancia: 'matte' }],
    camera: { height_m: 1.5, distance_m: 5, focal_apparent: '35mm' },
    light: { period: 'Dia', temp_k: 5500, quality: 'Difusa' },
    confidence: { materials: 90, camera: 85, light: 88, context: 70, general: 85 },
  };

  it('validates a correct ScanResult', () => {
    const result = ScanResultSchema.safeParse(validScan);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = ScanResultSchema.safeParse({ isFloorPlan: false });
    expect(result.success).toBe(false);
  });

  it('rejects invalid reflectancia enum', () => {
    const invalid = {
      ...validScan,
      materials: [{ elemento: 'X', acabamento: 'Y', reflectancia: 'chrome' }],
    };
    const result = ScanResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts optional fields as undefined', () => {
    const result = ScanResultSchema.safeParse({ ...validScan, floors: undefined });
    expect(result.success).toBe(true);
  });
});

describe('MoveScanResultSchema', () => {
  const validMoveScan = {
    technicalAnalysis: {
      resolution: '1080p',
      hasText: 'Não',
      visualStyle: 'Moderno',
      aspectRatio: '16:9',
    },
    cinematicAnalysis: {
      subject: 'Fachada',
      cameraShot: 'Wide',
      lighting: 'Natural',
      colorPalette: 'Neutro',
      depthOfField: 'Profundo',
    },
    mobilityDiagnosis: {
      staticElements: ['Parede'],
      dynamicElements: [],
      parallaxPotential: 'Alto',
      restrictions: [],
    },
    suggestedMovements: [
      { id: '1', name: 'Slow Pan', description: 'Pan suave', intensity: 'Sutil' },
    ],
  };

  it('validates a correct MoveScanResult', () => {
    expect(MoveScanResultSchema.safeParse(validMoveScan).success).toBe(true);
  });

  it('rejects missing suggestedMovements', () => {
    const { suggestedMovements: _, ...invalid } = validMoveScan;
    expect(MoveScanResultSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('DetailScanResultSchema', () => {
  const valid = {
    overallComposition: 'Boa composição',
    closes: [
      {
        id: 1,
        title: 'Detalhe 1',
        description: 'Desc',
        location: 'Canto',
        prompt: 'Foto macro...',
      },
    ],
  };

  it('validates a correct DetailScanResult', () => {
    expect(DetailScanResultSchema.safeParse(valid).success).toBe(true);
  });
});

describe('PostProductionResultSchema', () => {
  const valid = {
    cgiIssues: ['Luz artificial detectada'],
    pipeline: [{ map: 'Exposure', value: '+0.5', description: 'Aumentar exposição' }],
    postProductionPrompt: 'Ajuste de exposição e cores...',
  };

  it('validates a correct PostProductionResult', () => {
    expect(PostProductionResultSchema.safeParse(valid).success).toBe(true);
  });
});

describe('MoveOutputSchema', () => {
  const valid = {
    options: [
      {
        id: 1,
        name: 'Sutil',
        prompt: 'Pan suave...',
        simulatedEquipment: 'Gimbal DJI',
        intensity: 'Sutil',
      },
    ],
  };

  it('validates a correct MoveOutput', () => {
    expect(MoveOutputSchema.safeParse(valid).success).toBe(true);
  });
});

describe('validateOrThrow', () => {
  it('returns data on valid input', () => {
    const data = {
      isFloorPlan: false,
      typology: 'Res',
      materials: [{ elemento: 'P', acabamento: 'L', reflectancia: 'matte' as const }],
      camera: { height_m: 1, distance_m: 3, focal_apparent: '35mm' },
      light: { period: 'Dia', temp_k: 5500, quality: 'Boa' },
      confidence: { materials: 80, camera: 80, light: 80, context: 80, general: 80 },
    };
    const result = validateOrThrow(ScanResultSchema, data, 'test');
    expect(result.typology).toBe('Res');
  });

  it('throws on invalid input', () => {
    expect(() => validateOrThrow(ScanResultSchema, { bad: 'data' }, 'test')).toThrow();
  });
});
