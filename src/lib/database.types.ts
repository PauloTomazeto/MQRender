// =============================================================================
// Render IA na Prática — Tipos TypeScript gerados do schema Supabase
// Atualizar sempre que migrations forem aplicadas
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
export type SubTier = 'basic' | 'premium' | 'enterprise';
export type SubStatus = 'active' | 'canceled' | 'expired' | 'trialing';
export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type GenStatus = 'draft' | 'in_progress' | 'completed' | 'archived';
export type ImgStatus = 'generating' | 'completed' | 'failed';
export type DayNight = 'day' | 'night';
export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';
export type EnvType = 'bright' | 'raining' | 'sunny' | 'hot' | 'dark';
export type AccessoryCtrl = 'increase' | 'maintain';
export type PromptMode = 'single' | 'blocks';
export type ReflectanceType = 'matte' | 'semi-matte' | 'semi-gloss' | 'gloss' | 'espelhado';
export type FloorPlanType = 'A' | 'B' | 'C' | 'D';
export type MoveIntensity = 'Sutil' | 'Suave' | 'Dinâmico' | 'Épico';
export type ExtContextType = 'urban' | 'condo' | 'rural';
export type CreditType = 'monthly_quota' | 'addon_pack';
export type AiService =
  | 'gemini_scan'
  | 'gemini_prompt'
  | 'gemini_postprod'
  | 'gemini_detail'
  | 'gemini_move'
  | 'image_generation';
export type AiCallStatus = 'success' | 'timeout' | 'error';
export type PostProdStyle = 'default' | 'casa-vogue';

// =============================================================================
// ROW TYPES (o que vem do banco)
// =============================================================================

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  subscription_tier: SubTier;
  image_quota_monthly: number;
  current_month_usage: number;
  quota_reset_at: string | null;
  credits_plan: number;
  credits_addon: number;
  credits_used: number;
  credits_reset_at: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface SubscriptionPlan {
  id: number;
  name: SubTier;
  display_name: string;
  price_monthly: number;
  description: string | null;
  features: string[];
  image_monthly_quota: number | null;
  credits_monthly: number;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: number;
  status: SubStatus;
  billing_cycle_start: string;
  billing_cycle_end: string;
  auto_renew: boolean;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImageCredit {
  id: string;
  user_id: string;
  amount: number;
  used: number;
  type: CreditType;
  purchased_at: string;
  expires_at: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  mode: AppMode;
  status: GenStatus;
  created_at: string;
  updated_at: string;
}

export interface GenerationSession {
  id: string;
  user_id: string;
  project_id: string | null;
  mode: AppMode;
  current_step: AppStep;
  created_at: string;
  updated_at: string;
}

export interface Image {
  id: string;
  user_id: string;
  session_id: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  created_at: string;
}

export interface Scan {
  id: string;
  session_id: string;
  image_id: string | null;
  is_floor_plan: boolean;
  typology: string;
  floors: number | null;
  volumes: string | null;
  post_production_strategy: string | null;
  floor_plan_type: FloorPlanType | null;
  confidence_materials: number;
  confidence_camera: number;
  confidence_light: number;
  confidence_context: number;
  confidence_general: number;
  created_at: string;
}

export interface ScanMaterial {
  id: string;
  scan_id: string;
  elemento: string;
  acabamento: string;
  cor_ral: string | null;
  reflectancia: ReflectanceType;
  textura_fisica: string | null;
  estado_conservacao: string | null;
  indice_rugosidade_estimado: number | null;
  notas_textura: string | null;
}

export interface ScanCamera {
  id: string;
  scan_id: string;
  height_m: number;
  distance_m: number;
  focal_apparent: string;
  distortion: string | null;
  horizontal_angle: string | null;
  vertical_tilt: string | null;
  aspect: string | null;
  movement: string | null;
  is_low_angle: boolean | null;
}

export interface ScanLight {
  id: string;
  scan_id: string;
  period: string;
  temp_k: number;
  azimuthal_direction: string | null;
  elevation_angle: number | null;
  quality: string;
  ratio: string | null;
  shadows: string | null;
  shadow_direction: string | null;
  artificial_sources: string[] | null;
  ambient_temp: string | null;
}

export interface ScanLightPoint {
  id: string;
  scan_id: string;
  location: string;
  type: string;
  intensity_initial: number;
  temp_k_initial: number;
}

export interface ScanContext {
  id: string;
  scan_id: string;
  topography: string | null;
  vegetation_pct: number | null;
  species: string[] | null;
  piso_externo: string | null;
  vehicles: string | null;
  infrastructure: string[] | null;
  neighbors: string | null;
  horizon: boolean | null;
  sky_pct: number | null;
  image_quality: string | null;
}

export interface ScanOpening {
  id: string;
  scan_id: string;
  tipo: string;
  proporcao: string | null;
  posicao_fachada: string | null;
  ritmo: string | null;
  perfil_visivel: string | null;
  vidro_tipo: string | null;
  sistema_brise: string | null;
  recuo_em_relacao_fachada: string | null;
}

export interface FloorPlanEnvironment {
  id: number;
  scan_id: string;
  nome: string;
  area_m2: number | null;
  tipo: string | null;
  posicao: string | null;
}

export interface PromptConfig {
  id: string;
  session_id: string;
  mode: PromptMode;
  cinematic_mode: string | null;
  completion: string | null;
  angle: string | null;
  light_temp: string | null;
  style: string | null;
  external_context: ExtContextType | null;
  is_building: boolean;
  floor_level: number;
  overall_temperature: number;
  day_night: DayNight;
  time: string;
  environment: EnvType;
  overall_intensity: number;
  accessory_control: AccessoryCtrl;
  material_fidelity: boolean;
  season: SeasonType;
  created_at: string;
}

export interface LightPointConfig {
  id: string;
  prompt_config_id: string;
  enabled: boolean;
  type: string;
  intensity: number;
  temperature: number;
  location: string;
}

export interface MirrorConfig {
  id: string;
  prompt_config_id: string;
  enabled: boolean;
  location: string;
  reflection_image_path: string | null;
  reflection_description: string | null;
}

export interface PromptOutput {
  id: string;
  session_id: string;
  positive: string;
  negative: string;
  score: number;
  created_at: string;
}

export interface PromptBlock {
  id: string;
  prompt_output_id: string;
  block_number: number;
  content: string;
}

export interface ImageGeneration {
  id: string;
  session_id: string;
  prompt_output_id: string | null;
  aspect_ratio: string;
  resolution: string;
  result_image_id: string | null;
  status: ImgStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PostProductionAnalysis {
  id: string;
  image_generation_id: string;
  original_image_id: string | null;
  generated_image_id: string | null;
  style: PostProdStyle;
  cgi_issues: string[] | null;
  post_production_prompt: string;
  created_at: string;
}

export interface DetailScan {
  id: string;
  session_id: string;
  image_id: string | null;
  overall_composition: string;
  created_at: string;
}

export interface DetailClose {
  id: number;
  detail_scan_id: string;
  title: string;
  description: string;
  location: string;
  prompt: string;
}

export interface MoveScan {
  id: string;
  session_id: string;
  image_id: string | null;
  resolution: string | null;
  has_text: string | null;
  visual_style: string | null;
  aspect_ratio: string | null;
  subject: string | null;
  camera_shot: string | null;
  lighting: string | null;
  color_palette: string | null;
  depth_of_field: string | null;
  static_elements: string[] | null;
  dynamic_elements: string[] | null;
  parallax_potential: string | null;
  restrictions: string[] | null;
  created_at: string;
}

export interface SuggestedMovement {
  id: string;
  move_scan_id: string;
  name: string;
  description: string;
  intensity: MoveIntensity;
}

export interface MoveConfig {
  id: string;
  session_id: string;
  duration: string;
  is_time_lapse: boolean;
  is_speed_ramp: boolean;
  movement_type: string;
  scene_animation: string;
  is_transition: boolean;
  end_image_id: string | null;
  created_at: string;
}

export interface MoveOutput {
  id: string;
  session_id: string;
  created_at: string;
}

export interface MoveOutputOption {
  id: number;
  move_output_id: string;
  name: string;
  prompt: string;
  simulated_equipment: string;
  intensity: string;
}

// Credit system
export interface CreditConfig {
  id: number;
  model: string;
  resolution: string | null;
  kie_base_cost: number;
  markup_pct: number;
  our_cost: number;
  is_active: boolean;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'plan_allocation' | 'addon_purchase' | 'consumption' | 'admin_adjustment' | 'cycle_reset';
  model: string | null;
  resolution: string | null;
  description: string | null;
  created_at: string;
}

export interface AiCallLog {
  id: string;
  user_id: string;
  session_id: string | null;
  service: AiService;
  input_tokens: number | null;
  output_tokens: number | null;
  status: AiCallStatus;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface UserInvite {
  id: string;
  email: string;
  token: string;
  invited_by: string | null;
  target_plan: string;
  target_role: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

// =============================================================================
// DATABASE TYPE MAP (para o cliente Supabase tipado)
// =============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Profile>;
      };
      subscription_plans: {
        Row: SubscriptionPlan;
        Insert: Omit<SubscriptionPlan, 'id' | 'created_at'>;
        Update: Partial<SubscriptionPlan>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Subscription>;
      };
      image_credits: {
        Row: ImageCredit;
        Insert: Omit<ImageCredit, 'id' | 'purchased_at'>;
        Update: Partial<ImageCredit>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Project>;
      };
      generation_sessions: {
        Row: GenerationSession;
        Insert: Omit<GenerationSession, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<GenerationSession>;
      };
      images: { Row: Image; Insert: Omit<Image, 'id' | 'created_at'>; Update: Partial<Image> };
      scans: { Row: Scan; Insert: Omit<Scan, 'id' | 'created_at'>; Update: Partial<Scan> };
      scan_materials: {
        Row: ScanMaterial;
        Insert: Omit<ScanMaterial, 'id'>;
        Update: Partial<ScanMaterial>;
      };
      scan_camera: { Row: ScanCamera; Insert: Omit<ScanCamera, 'id'>; Update: Partial<ScanCamera> };
      scan_light: { Row: ScanLight; Insert: Omit<ScanLight, 'id'>; Update: Partial<ScanLight> };
      scan_light_points: {
        Row: ScanLightPoint;
        Insert: ScanLightPoint;
        Update: Partial<ScanLightPoint>;
      };
      scan_context: {
        Row: ScanContext;
        Insert: Omit<ScanContext, 'id'>;
        Update: Partial<ScanContext>;
      };
      scan_openings: {
        Row: ScanOpening;
        Insert: Omit<ScanOpening, 'id'>;
        Update: Partial<ScanOpening>;
      };
      floor_plan_environments: {
        Row: FloorPlanEnvironment;
        Insert: FloorPlanEnvironment;
        Update: Partial<FloorPlanEnvironment>;
      };
      prompt_configs: {
        Row: PromptConfig;
        Insert: Omit<PromptConfig, 'id' | 'created_at'>;
        Update: Partial<PromptConfig>;
      };
      light_point_configs: {
        Row: LightPointConfig;
        Insert: LightPointConfig;
        Update: Partial<LightPointConfig>;
      };
      mirror_configs: {
        Row: MirrorConfig;
        Insert: Omit<MirrorConfig, 'id'>;
        Update: Partial<MirrorConfig>;
      };
      prompt_outputs: {
        Row: PromptOutput;
        Insert: Omit<PromptOutput, 'id' | 'created_at'>;
        Update: Partial<PromptOutput>;
      };
      prompt_blocks: {
        Row: PromptBlock;
        Insert: Omit<PromptBlock, 'id'>;
        Update: Partial<PromptBlock>;
      };
      image_generations: {
        Row: ImageGeneration;
        Insert: Omit<ImageGeneration, 'id' | 'created_at'>;
        Update: Partial<ImageGeneration>;
      };
      post_production_analyses: {
        Row: PostProductionAnalysis;
        Insert: Omit<PostProductionAnalysis, 'id' | 'created_at'>;
        Update: Partial<PostProductionAnalysis>;
      };
      detail_scans: {
        Row: DetailScan;
        Insert: Omit<DetailScan, 'id' | 'created_at'>;
        Update: Partial<DetailScan>;
      };
      detail_closes: { Row: DetailClose; Insert: DetailClose; Update: Partial<DetailClose> };
      move_scans: {
        Row: MoveScan;
        Insert: Omit<MoveScan, 'id' | 'created_at'>;
        Update: Partial<MoveScan>;
      };
      suggested_movements: {
        Row: SuggestedMovement;
        Insert: SuggestedMovement;
        Update: Partial<SuggestedMovement>;
      };
      move_configs: {
        Row: MoveConfig;
        Insert: Omit<MoveConfig, 'id' | 'created_at'>;
        Update: Partial<MoveConfig>;
      };
      move_outputs: {
        Row: MoveOutput;
        Insert: Omit<MoveOutput, 'id' | 'created_at'>;
        Update: Partial<MoveOutput>;
      };
      move_output_options: {
        Row: MoveOutputOption;
        Insert: MoveOutputOption;
        Update: Partial<MoveOutputOption>;
      };
      ai_call_logs: {
        Row: AiCallLog;
        Insert: Omit<AiCallLog, 'id' | 'created_at'>;
        Update: Partial<AiCallLog>;
      };
      user_invites: {
        Row: UserInvite;
        Insert: Omit<UserInvite, 'id' | 'created_at'>;
        Update: Partial<UserInvite>;
      };
      credit_config: {
        Row: CreditConfig;
        Insert: Omit<CreditConfig, 'id'>;
        Update: Partial<CreditConfig>;
      };
      credit_transactions: {
        Row: CreditTransaction;
        Insert: Omit<CreditTransaction, 'id' | 'created_at'>;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_generate_image: { Args: { p_user_id: string }; Returns: boolean };
      consume_image_credit: { Args: { p_user_id: string }; Returns: void };
      is_admin: { Args: Record<never, never>; Returns: boolean };
      get_session_summary: { Args: { p_session_id: string }; Returns: Json };
      check_credits: { Args: { p_user_id: string; p_cost: number }; Returns: boolean };
      consume_credits: {
        Args: { p_user_id: string; p_model: string; p_resolution: string };
        Returns: number;
      };
      add_addon_credits: { Args: { p_user_id: string }; Returns: void };
      reset_user_credits: { Args: { p_user_id: string }; Returns: void };
      admin_adjust_credits: {
        Args: { p_user_id: string; p_amount: number; p_description: string };
        Returns: void;
      };
      get_user_credit_status: { Args: { p_user_id: string }; Returns: Json };
    };
    Enums: Record<string, never>;
  };
}
