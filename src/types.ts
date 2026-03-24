export type AppMode = 'promp' | 'move';

export type AppStep =
  | 'select'
  | 'upload'
  | 'diagnosis'
  | 'config'
  | 'result'
  | 'detail-scan'
  | 'post-production'
  | 'generate-image'
  | 'subscription';

export interface MoveScanResult {
  technicalAnalysis: {
    resolution?: string;
    hasText?: string;
    visualStyle?: string;
    aspectRatio?: string;
  };
  cinematicAnalysis: {
    subject?: string;
    cameraShot?: string;
    lighting?: string;
    colorPalette?: string;
    depthOfField?: string;
  };
  mobilityDiagnosis: {
    staticElements?: string[];
    dynamicElements?: string[];
    parallaxPotential?: string;
    restrictions?: string[];
  };
  suggestedMovements: {
    id: string;
    name: string;
    description: string;
    intensity: string;
  }[];
}

export interface MoveConfig {
  duration: string;
  isTimeLapse: boolean;
  isSpeedRamp: boolean;
  movementType: string;
  sceneAnimation: string;
  isTransition: boolean;
  endImage?: string | null;
}

export interface MoveOutput {
  options: {
    id: number;
    name: string;
    prompt: string;
    simulatedEquipment: string;
    intensity: string;
  }[];
}

export interface DetailClose {
  id: number;
  title: string;
  description: string;
  location: string;
  prompt: string;
}

export interface DetailScanResult {
  closes: DetailClose[];
  overallComposition: string;
}

export interface Material {
  elemento: string;
  acabamento: string;
  cor_ral?: string;
  reflectancia: 'matte' | 'semi-matte' | 'semi-gloss' | 'gloss' | 'espelhado';
  textura_fisica?: string;
  estado_conservacao?: string;
  indice_rugosidade_estimado?: number;
  notas_textura?: string;
  // PBR Material Precision Pipeline (V-Ray Methodology)
  pbr_diffuse?: string; // Camada base: cor dominante, textura e padrão de albedo
  pbr_reflection?: number; // Intensidade de reflexão: 0.0 (nenhuma) a 1.0 (espelho perfeito)
  pbr_glossiness?: number; // Nitidez da reflexão: 0.0 (difusa/fosca) a 1.0 (espéculo nítido)
  pbr_bump?: string; // Descrição do relevo micro-superficial (poros, tramas, fissuras)
  pbr_light_behavior?: string; // Comportamento físico da luz: como difunde, reflete e absorve luz
}

export interface LightPoint {
  id: string;
  location: string;
  type: string;
  intensity_initial: number;
  temp_k_initial: number;
}

export interface Opening {
  tipo: string;
  proporcao?: string;
  posicao_fachada?: string;
  ritmo?: string;
  perfil_visivel?: string;
  vidro_tipo?: string;
  sistema_brise?: string;
  recuo_em_relacao_fachada?: string;
}

export interface ScanResult {
  isFloorPlan: boolean;
  typology: string;
  floors?: number;
  volumes?: string;
  materials: Material[];
  openings?: Opening[];
  camera: {
    height_m: number;
    distance_m: number;
    focal_apparent: string;
    distortion?: string;
    horizontal_angle?: string;
    vertical_tilt?: string;
    aspect?: string;
    movement?: string;
    isLowAngle?: boolean;
  };
  light: {
    period: string;
    temp_k: number;
    azimuthal_direction?: string;
    elevation_angle?: number;
    quality: string;
    ratio?: string;
    shadows?: string;
    shadow_direction?: string;
    artificial_sources?: string[];
    ambient_temp?: string;
  };
  lightPoints?: LightPoint[];
  context?: {
    topography?: string;
    vegetation_pct?: number;
    species?: string[];
    piso_externo?: string;
    vehicles?: string;
    infrastructure?: string[];
    neighbors?: string;
    horizon?: boolean;
    sky_pct?: number;
    image_quality?: string;
  };
  confidence: {
    materials: number;
    camera: number;
    light: number;
    context: number;
    general: number;
  };
  postProductionStrategy?: string;
  // Floor plan specific fields
  floorPlanType?: 'A' | 'B' | 'C' | 'D';
  environments?: {
    id: number;
    nome: string;
    area_m2?: number;
    tipo?: string;
    posicao?: string;
  }[];
}

export interface LightPointConfig {
  id: string;
  enabled: boolean;
  type: string;
  intensity: number;
  temperature: number;
  location: string;
}

export interface MirrorConfig {
  enabled: boolean;
  location: string;
  reflectionImage?: string;
  reflectionDescription?: string;
}

export interface PromptConfig {
  mode: 'single' | 'blocks';
  cinematicMode?: string;
  completion?: string;
  angle?: string;
  lightTemp?: string;
  style?: string;
  externalContext?: 'urban' | 'condo' | 'rural';
  isBuilding?: boolean;
  floorLevel?: number;
  overallTemperature: number;
  dayNight: 'day' | 'night';
  time: string;
  environment: 'bright' | 'raining' | 'sunny' | 'hot' | 'dark';
  overallIntensity: number;
  lightPoints: LightPointConfig[];
  accessoryControl: 'increase' | 'maintain';
  materialFidelity: boolean;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  mirror?: MirrorConfig;
}

export interface PromptOutput {
  positive: string;
  negative: string;
  blocks?: {
    b1: string;
    b2: string;
    b3: string;
    b4: string;
    b5: string;
    b6: string;
  };
  score: number;
}

export interface PostProductionResult {
  cgiIssues: string[];
  pipeline: {
    map: string;
    value: string;
    description: string;
  }[];
  postProductionPrompt: string;
}
