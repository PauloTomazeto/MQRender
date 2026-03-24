import { z } from 'zod';

// ─── Material ────────────────────────────────────────────────────────────────
export const MaterialSchema = z.object({
  elemento: z.string(),
  acabamento: z.string(),
  cor_ral: z.string().optional(),
  reflectancia: z.enum(['matte', 'semi-matte', 'semi-gloss', 'gloss', 'espelhado']),
  textura_fisica: z.string().optional(),
  estado_conservacao: z.string().optional(),
  indice_rugosidade_estimado: z.number().optional(),
  notas_textura: z.string().optional(),
  // PBR Material Precision Pipeline (V-Ray Methodology)
  pbr_diffuse: z.string().optional(),
  pbr_reflection: z.number().min(0).max(1).optional(),
  pbr_glossiness: z.number().min(0).max(1).optional(),
  pbr_bump: z.string().optional(),
  pbr_light_behavior: z.string().optional(),
});

// ─── ScanResult ──────────────────────────────────────────────────────────────
export const ScanResultSchema = z.object({
  isFloorPlan: z.boolean(),
  typology: z.string(),
  floors: z.number().optional(),
  volumes: z.string().optional(),
  materials: z.array(MaterialSchema),
  openings: z
    .array(
      z.object({
        tipo: z.string(),
        proporcao: z.string().optional(),
        posicao_fachada: z.string().optional(),
      })
    )
    .optional(),
  camera: z.object({
    height_m: z.number(),
    distance_m: z.number(),
    focal_apparent: z.string(),
    distortion: z.string().optional(),
    horizontal_angle: z.string().optional(),
    vertical_tilt: z.string().optional(),
    isLowAngle: z.boolean().optional(),
  }),
  light: z.object({
    period: z.string(),
    temp_k: z.number(),
    azimuthal_direction: z.string().optional(),
    elevation_angle: z.number().optional(),
    quality: z.string(),
    ratio: z.string().optional(),
    shadows: z.string().optional(),
    shadow_direction: z.string().optional(),
    artificial_sources: z.array(z.string()).optional(),
    ambient_temp: z.string().optional(),
    // Extended precision fields
    bloom_glare: z.boolean().optional(),
    dominant_source: z.string().optional(),
    light_mixing: z.string().optional(),
    indirect_ratio: z.string().optional(),
  }),
  lightPoints: z
    .array(
      z.object({
        id: z.string(),
        location: z.string(),
        // z.preprocess keeps the output type required (non-optional) while accepting any AI input
        type: z.preprocess(v => (typeof v === 'string' ? v : 'ambient'), z.string()),
        intensity_initial: z.preprocess(v => (typeof v === 'number' ? v : 50), z.number()),
        temp_k_initial: z.preprocess(v => (typeof v === 'number' ? v : 4000), z.number()),
        // V-Ray precision fields — all optional with .catch() fallbacks on enums
        shape: z
          .enum(['rectangular', 'elliptical', 'spherical', 'conical', 'mesh'])
          .optional()
          .catch(undefined),
        decay: z.enum(['inverse_square', 'linear', 'none']).optional().catch(undefined),
        cone_angle: z.number().optional().catch(undefined),
        penumbra_angle: z.number().optional().catch(undefined),
        directionality: z.number().optional().catch(undefined),
        shadow_softness: z.number().optional().catch(undefined),
        affect_specular: z.boolean().optional().catch(undefined),
        affect_diffuse: z.boolean().optional().catch(undefined),
        affect_reflections: z.boolean().optional().catch(undefined),
        visible_in_render: z.boolean().optional().catch(undefined),
        spatial_x_pct: z.number().optional().catch(undefined),
        spatial_y_pct: z.number().optional().catch(undefined),
        confidence: z.number().optional().catch(undefined),
        bloom_glare: z.boolean().optional().catch(undefined),
        color_hex: z.string().optional().catch(undefined),
      })
    )
    .optional(),
  context: z
    .object({
      topography: z.string().optional(),
      vegetation_pct: z.number().optional(),
      species: z.array(z.string()).optional(),
      piso_externo: z.string().optional(),
      vehicles: z.string().optional(),
      infrastructure: z.array(z.string()).optional(),
      neighbors: z.string().optional(),
      horizon: z.boolean().optional(),
      sky_pct: z.number().optional(),
      image_quality: z.string().optional(),
    })
    .optional(),
  confidence: z.object({
    materials: z.number(),
    camera: z.number(),
    light: z.number(),
    context: z.number(),
    general: z.number(),
  }),
  postProductionStrategy: z.string().optional(),
  floorPlanType: z.enum(['A', 'B', 'C', 'D']).optional(),
  environments: z
    .array(
      z.object({
        id: z.number(),
        nome: z.string(),
        area_m2: z.number().optional(),
        tipo: z.string().optional(),
        posicao: z.string().optional(),
      })
    )
    .optional(),
});

// ─── PromptOutput ─────────────────────────────────────────────────────────────
export const PromptOutputSchema = z.object({
  positive: z.string(),
  negative: z.string(),
  blocks: z
    .object({
      b1: z.string(),
      b2: z.string(),
      b3: z.string(),
      b4: z.string(),
      b5: z.string(),
      b6: z.string(),
    })
    .optional(),
  score: z.number(),
});

// ─── MoveScanResult ───────────────────────────────────────────────────────────
export const MoveScanResultSchema = z.object({
  technicalAnalysis: z.object({
    resolution: z.string().optional(),
    hasText: z.string().optional(),
    visualStyle: z.string().optional(),
    aspectRatio: z.string().optional(),
  }),
  cinematicAnalysis: z.object({
    subject: z.string().optional(),
    cameraShot: z.string().optional(),
    lighting: z.string().optional(),
    colorPalette: z.string().optional(),
    depthOfField: z.string().optional(),
  }),
  mobilityDiagnosis: z.object({
    staticElements: z.array(z.string()).optional(),
    dynamicElements: z.array(z.string()).optional(),
    parallaxPotential: z.string().optional(),
    restrictions: z.array(z.string()).optional(),
  }),
  suggestedMovements: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      intensity: z.string(),
    })
  ),
});

// ─── MoveOutput ───────────────────────────────────────────────────────────────
export const MoveOutputSchema = z.object({
  options: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      prompt: z.string(),
      simulatedEquipment: z.string(),
      intensity: z.string(),
    })
  ),
});

// ─── DetailScanResult ─────────────────────────────────────────────────────────
export const DetailScanResultSchema = z.object({
  overallComposition: z.string(),
  closes: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      description: z.string(),
      location: z.string(),
      prompt: z.string(),
    })
  ),
});

// ─── PostProductionResult ─────────────────────────────────────────────────────
export const PostProductionResultSchema = z.object({
  cgiIssues: z.array(z.string()),
  pipeline: z.array(
    z.object({
      map: z.string(),
      value: z.string(),
      description: z.string(),
    })
  ),
  postProductionPrompt: z.string(),
});

// ─── Inferred Types (for use in place of manual interfaces if desired) ────────
export type ScanResultFromSchema = z.infer<typeof ScanResultSchema>;
export type PromptOutputFromSchema = z.infer<typeof PromptOutputSchema>;
export type MoveScanResultFromSchema = z.infer<typeof MoveScanResultSchema>;
export type MoveOutputFromSchema = z.infer<typeof MoveOutputSchema>;
export type DetailScanResultFromSchema = z.infer<typeof DetailScanResultSchema>;
export type PostProductionResultFromSchema = z.infer<typeof PostProductionResultSchema>;

// ─── Safe parse helper ────────────────────────────────────────────────────────
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[${label}] Validation failed:`, result.error.flatten());
    throw new Error(`Resposta da IA com formato inválido em "${label}". Tente novamente.`);
  }
  return result.data;
}
