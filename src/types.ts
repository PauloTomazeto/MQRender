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
  // V-Ray light type classification (Rectangle, Sphere, Spot, IES, Omni, Dome, Emissive)
  type: string;
  intensity_initial: number; // 0-100 scale
  temp_k_initial: number; // color temperature in Kelvin (2000K–10000K)
  // ─── V-Ray Precision Fields ───────────────────────────────────────────────
  shape?: 'rectangular' | 'elliptical' | 'spherical' | 'conical' | 'mesh';
  decay?: 'inverse_square' | 'linear' | 'none'; // Recommended: inverse_square (physically accurate)
  cone_angle?: number; // Spot light cone angle in degrees (0–180)
  penumbra_angle?: number; // Spot light penumbra softening in degrees
  directionality?: number; // 0.0 (omnidirectional) – 1.0 (fully directional beam), for rectangle lights
  shadow_softness?: number; // 0.0 (hard shadow) – 1.0 (fully soft penumbra)
  affect_specular?: boolean; // contributes to specular highlights on surfaces
  affect_diffuse?: boolean; // contributes to diffuse illumination
  affect_reflections?: boolean; // appears in reflective surfaces
  visible_in_render?: boolean; // lamp geometry visible or invisible (light only)
  // ─── Spatial Detection ────────────────────────────────────────────────────
  spatial_x_pct?: number; // horizontal position in image (0–100%)
  spatial_y_pct?: number; // vertical position in image (0–100%)
  // ─── Quality Indicators ───────────────────────────────────────────────────
  confidence?: number; // AI detection confidence 0–100
  bloom_glare?: boolean; // visible lens bloom or glare artifact from this source
  color_hex?: string; // tinted light color (e.g. '#FFF0D8' for warm tungsten)
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
    period: string; // temporal period: morning/afternoon/evening/night/overcast/raining
    temp_k: number; // dominant color temperature in Kelvin
    azimuthal_direction?: string; // sun/main light direction (compass or 0–360°)
    elevation_angle?: number; // light elevation above horizon (-90° to 90°)
    quality: string; // hard / soft / diffuse / directional
    ratio?: string; // main:fill ratio (e.g. "3:1", "1:1")
    shadows?: string; // shadow softness/penumbra description
    shadow_direction?: string; // where shadows project (e.g. "north-east", "toward camera")
    artificial_sources?: string[]; // list of detected artificial light types (LED, tungsten, etc.)
    ambient_temp?: string; // overall ambient color temperature descriptor
    // ─── Extended Precision Fields ────────────────────────────────────────────
    bloom_glare?: boolean; // global lens bloom or glare visible in scene
    dominant_source?: string; // primary light source description (e.g. "direct sunlight NW at 45°")
    light_mixing?: string; // how multiple sources blend (e.g. "warm tungsten + cool daylight fill")
    indirect_ratio?: string; // direct:indirect light ratio (e.g. "2:1 direct vs bounce")
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
  intensity: number; // 0-100%
  temperature: number; // 0-100% mapped to 2000K–10000K
  location: string;
  // ─── V-Ray Precision Controls ─────────────────────────────────────────────
  shape?: string; // rectangular | elliptical | spherical | conical | mesh
  decay?: 'inverse_square' | 'linear' | 'none'; // light falloff law
  cone_angle?: number; // spot cone angle in degrees (0–120)
  directionality?: number; // 0–100% (maps to 0.0–1.0 beam focus)
  shadow_softness?: number; // 0–100% (maps to 0.0–1.0 penumbra)
  affect_specular?: boolean; // contributes to specular highlights
  affect_reflections?: boolean; // visible in reflective surfaces
  bloom_glare?: boolean; // generates lens bloom/glare
  color_hex?: string; // tinted light color hex
  spatial_x_pct?: number; // horizontal position in image 0–100
  spatial_y_pct?: number; // vertical position in image 0–100
  confidence?: number; // AI detection confidence 0–100
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
