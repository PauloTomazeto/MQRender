-- =============================================================================
-- MQPROMP — Schema Inicial Supabase
-- Versão: 001
-- Gerado: 2026-03-21
-- =============================================================================

-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE app_mode          AS ENUM ('promp', 'move');
CREATE TYPE app_step          AS ENUM ('select','upload','diagnosis','config','result','detail-scan','post-production','generate-image','subscription');
CREATE TYPE subscription_tier AS ENUM ('basic', 'premium', 'enterprise');
CREATE TYPE sub_status        AS ENUM ('active', 'canceled', 'expired', 'trialing');
CREATE TYPE user_role         AS ENUM ('user', 'admin');
CREATE TYPE user_status       AS ENUM ('active', 'suspended');
CREATE TYPE session_step      AS ENUM ('select','upload','diagnosis','config','result','detail-scan','post-production','generate-image','subscription');
CREATE TYPE gen_status        AS ENUM ('draft', 'in_progress', 'completed', 'archived');
CREATE TYPE img_status        AS ENUM ('generating', 'completed', 'failed');
CREATE TYPE day_night         AS ENUM ('day', 'night');
CREATE TYPE season_type       AS ENUM ('spring', 'summer', 'autumn', 'winter');
CREATE TYPE environment_type  AS ENUM ('bright', 'raining', 'sunny', 'hot', 'dark');
CREATE TYPE accessory_ctrl    AS ENUM ('increase', 'maintain');
CREATE TYPE prompt_mode       AS ENUM ('single', 'blocks');
CREATE TYPE reflectance_type  AS ENUM ('matte', 'semi-matte', 'semi-gloss', 'gloss', 'espelhado');
CREATE TYPE floor_plan_type   AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE move_intensity    AS ENUM ('Sutil', 'Suave', 'Dinâmico', 'Épico');
CREATE TYPE ext_context_type  AS ENUM ('urban', 'condo', 'rural');
CREATE TYPE credit_type       AS ENUM ('monthly_quota', 'addon_pack');
CREATE TYPE ai_service        AS ENUM ('gemini_scan','gemini_prompt','gemini_postprod','gemini_detail','gemini_move','image_generation');
CREATE TYPE ai_call_status    AS ENUM ('success', 'timeout', 'error');
CREATE TYPE post_prod_style   AS ENUM ('default', 'casa-vogue');

-- =============================================================================
-- 1. USUÁRIOS & AUTENTICAÇÃO
-- =============================================================================

-- Tabela principal de usuários (estende auth.users do Supabase)
CREATE TABLE public.profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT UNIQUE NOT NULL,
  name                  TEXT,
  role                  user_role    NOT NULL DEFAULT 'user',
  status                user_status  NOT NULL DEFAULT 'active',
  subscription_tier     subscription_tier NOT NULL DEFAULT 'basic',
  image_quota_monthly   INT NOT NULL DEFAULT 0,   -- 0 = sem geração de imagens
  current_month_usage   INT NOT NULL DEFAULT 0,
  quota_reset_at        TIMESTAMPTZ,              -- Próximo reset mensal
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login            TIMESTAMPTZ
);

-- Sessões de autenticação/lockout (complementa Supabase Auth)
CREATE TABLE public.auth_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_info     TEXT,
  ip_address      INET,
  failed_attempts INT NOT NULL DEFAULT 0,
  blocked_until   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. PLANOS DE ASSINATURA
-- =============================================================================

CREATE TABLE public.subscription_plans (
  id                  SERIAL PRIMARY KEY,
  name                subscription_tier UNIQUE NOT NULL,
  display_name        TEXT NOT NULL,
  price_monthly       NUMERIC(10,2) NOT NULL,
  description         TEXT,
  features            JSONB NOT NULL DEFAULT '[]',  -- Array de strings
  image_monthly_quota INT,                           -- NULL = ilimitado, 0 = nenhum
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id                 INT  NOT NULL REFERENCES public.subscription_plans(id),
  status                  sub_status NOT NULL DEFAULT 'active',
  billing_cycle_start     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  billing_cycle_end       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
  auto_renew              BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_subscription_id  TEXT,
  stripe_customer_id      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pacotes de imagem avulsos
CREATE TABLE public.image_credits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount        INT NOT NULL,          -- Total de imagens no pacote
  used          INT NOT NULL DEFAULT 0,
  type          credit_type NOT NULL,
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ           -- NULL = não expira
);

-- =============================================================================
-- 3. PROJETOS
-- =============================================================================

CREATE TABLE public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  mode        app_mode   NOT NULL DEFAULT 'promp',
  status      gen_status NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. SESSÕES DE GERAÇÃO (Workflow State)
-- =============================================================================

CREATE TABLE public.generation_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  mode         app_mode    NOT NULL DEFAULT 'promp',
  current_step session_step NOT NULL DEFAULT 'select',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. IMAGENS (Referências no Supabase Storage)
-- =============================================================================

CREATE TABLE public.images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id   UUID REFERENCES public.generation_sessions(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,          -- bucket/path no Supabase Storage
  mime_type    TEXT NOT NULL DEFAULT 'image/jpeg',
  size_bytes   BIGINT,
  width_px     INT,
  height_px    INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. ANÁLISE DE IMAGEM — PROMP MODE (ScanResult)
-- =============================================================================

CREATE TABLE public.scans (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  image_id                  UUID REFERENCES public.images(id) ON DELETE SET NULL,
  is_floor_plan             BOOLEAN NOT NULL DEFAULT FALSE,
  typology                  TEXT NOT NULL,
  floors                    INT,
  volumes                   TEXT,
  post_production_strategy  TEXT,
  floor_plan_type           floor_plan_type,
  -- Scores de confiança agrupados
  confidence_materials      NUMERIC(4,2) NOT NULL DEFAULT 0,
  confidence_camera         NUMERIC(4,2) NOT NULL DEFAULT 0,
  confidence_light          NUMERIC(4,2) NOT NULL DEFAULT 0,
  confidence_context        NUMERIC(4,2) NOT NULL DEFAULT 0,
  confidence_general        NUMERIC(4,2) NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.scan_materials (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id                     UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  elemento                    TEXT NOT NULL,
  acabamento                  TEXT NOT NULL,
  cor_ral                     TEXT,
  reflectancia                reflectance_type NOT NULL,
  textura_fisica              TEXT,
  estado_conservacao          TEXT,
  indice_rugosidade_estimado  NUMERIC(5,2),
  notas_textura               TEXT
);

CREATE TABLE public.scan_openings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id                   UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  tipo                      TEXT NOT NULL,
  proporcao                 TEXT,
  posicao_fachada           TEXT,
  ritmo                     TEXT,
  perfil_visivel            TEXT,
  vidro_tipo                TEXT,
  sistema_brise             TEXT,
  recuo_em_relacao_fachada  TEXT
);

CREATE TABLE public.scan_camera (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id          UUID NOT NULL UNIQUE REFERENCES public.scans(id) ON DELETE CASCADE,
  height_m         NUMERIC(6,2) NOT NULL,
  distance_m       NUMERIC(6,2) NOT NULL,
  focal_apparent   TEXT NOT NULL,
  distortion       TEXT,
  horizontal_angle TEXT,
  vertical_tilt    TEXT,
  aspect           TEXT,
  movement         TEXT,
  is_low_angle     BOOLEAN
);

CREATE TABLE public.scan_light (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id             UUID NOT NULL UNIQUE REFERENCES public.scans(id) ON DELETE CASCADE,
  period              TEXT NOT NULL,
  temp_k              INT NOT NULL,
  azimuthal_direction TEXT,
  elevation_angle     NUMERIC(5,2),
  quality             TEXT NOT NULL,
  ratio               TEXT,
  shadows             TEXT,
  shadow_direction    TEXT,
  artificial_sources  TEXT[],
  ambient_temp        TEXT
);

CREATE TABLE public.scan_light_points (
  id                TEXT PRIMARY KEY,  -- ID vindo da Gemini
  scan_id           UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  location          TEXT NOT NULL,
  type              TEXT NOT NULL,
  intensity_initial NUMERIC(5,2) NOT NULL,
  temp_k_initial    INT NOT NULL
);

CREATE TABLE public.scan_context (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id        UUID NOT NULL UNIQUE REFERENCES public.scans(id) ON DELETE CASCADE,
  topography     TEXT,
  vegetation_pct NUMERIC(5,2),
  species        TEXT[],
  piso_externo   TEXT,
  vehicles       TEXT,
  infrastructure TEXT[],
  neighbors      TEXT,
  horizon        BOOLEAN,
  sky_pct        NUMERIC(5,2),
  image_quality  TEXT
);

CREATE TABLE public.floor_plan_environments (
  id       INT NOT NULL,             -- ID da Gemini
  scan_id  UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  nome     TEXT NOT NULL,
  area_m2  NUMERIC(8,2),
  tipo     TEXT,
  posicao  TEXT,
  PRIMARY KEY (id, scan_id)
);

-- =============================================================================
-- 7. CONFIGURAÇÃO DE PROMPT
-- =============================================================================

CREATE TABLE public.prompt_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  mode                prompt_mode NOT NULL DEFAULT 'single',
  cinematic_mode      TEXT,
  completion          TEXT,
  angle               TEXT,
  light_temp          TEXT,
  style               TEXT,
  external_context    ext_context_type,
  is_building         BOOLEAN NOT NULL DEFAULT FALSE,
  floor_level         INT NOT NULL DEFAULT 0,
  overall_temperature INT NOT NULL DEFAULT 50 CHECK (overall_temperature BETWEEN 0 AND 100),
  day_night           day_night NOT NULL DEFAULT 'day',
  time                TEXT NOT NULL DEFAULT '12:00',
  environment         environment_type NOT NULL DEFAULT 'bright',
  overall_intensity   INT NOT NULL DEFAULT 50 CHECK (overall_intensity BETWEEN 0 AND 100),
  accessory_control   accessory_ctrl NOT NULL DEFAULT 'maintain',
  material_fidelity   BOOLEAN NOT NULL DEFAULT TRUE,
  season              season_type NOT NULL DEFAULT 'summer',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.light_point_configs (
  id               TEXT NOT NULL,
  prompt_config_id UUID NOT NULL REFERENCES public.prompt_configs(id) ON DELETE CASCADE,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  type             TEXT NOT NULL,
  intensity        NUMERIC(5,2) NOT NULL CHECK (intensity BETWEEN 0 AND 100),
  temperature      NUMERIC(5,2) NOT NULL CHECK (temperature BETWEEN 0 AND 100),
  location         TEXT NOT NULL,
  PRIMARY KEY (id, prompt_config_id)
);

CREATE TABLE public.mirror_configs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_config_id        UUID NOT NULL UNIQUE REFERENCES public.prompt_configs(id) ON DELETE CASCADE,
  enabled                 BOOLEAN NOT NULL DEFAULT FALSE,
  location                TEXT NOT NULL DEFAULT '',
  reflection_image_path   TEXT,   -- Referência no Storage
  reflection_description  TEXT
);

-- =============================================================================
-- 8. SAÍDA DE PROMPT
-- =============================================================================

CREATE TABLE public.prompt_outputs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  positive    TEXT NOT NULL,
  negative    TEXT NOT NULL,
  score       INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.prompt_blocks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_output_id UUID NOT NULL REFERENCES public.prompt_outputs(id) ON DELETE CASCADE,
  block_number     INT NOT NULL CHECK (block_number BETWEEN 1 AND 6),
  content          TEXT NOT NULL,
  UNIQUE (prompt_output_id, block_number)
);

-- =============================================================================
-- 9. GERAÇÃO DE IMAGEM
-- =============================================================================

CREATE TABLE public.image_generations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  prompt_output_id    UUID REFERENCES public.prompt_outputs(id) ON DELETE SET NULL,
  aspect_ratio        TEXT NOT NULL DEFAULT '16:9',
  resolution          TEXT NOT NULL DEFAULT '1K',
  result_image_id     UUID REFERENCES public.images(id) ON DELETE SET NULL,  -- Imagem gerada
  status              img_status NOT NULL DEFAULT 'generating',
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- =============================================================================
-- 10. PÓS-PRODUÇÃO
-- =============================================================================

CREATE TABLE public.post_production_analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_generation_id   UUID NOT NULL REFERENCES public.image_generations(id) ON DELETE CASCADE,
  original_image_id     UUID REFERENCES public.images(id) ON DELETE SET NULL,
  generated_image_id    UUID REFERENCES public.images(id) ON DELETE SET NULL,
  style                 post_prod_style NOT NULL DEFAULT 'default',
  cgi_issues            TEXT[],
  post_production_prompt TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.post_production_pipeline (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_production_analysis_id UUID NOT NULL REFERENCES public.post_production_analyses(id) ON DELETE CASCADE,
  map_name                    TEXT NOT NULL,
  value                       TEXT NOT NULL,
  description                 TEXT NOT NULL,
  sort_order                  INT NOT NULL DEFAULT 0
);

-- =============================================================================
-- 11. DETAIL SCAN (CLOSE-UPS)
-- =============================================================================

CREATE TABLE public.detail_scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  image_id            UUID REFERENCES public.images(id) ON DELETE SET NULL,
  overall_composition TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.detail_closes (
  id             INT NOT NULL,   -- ID da Gemini
  detail_scan_id UUID NOT NULL REFERENCES public.detail_scans(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  location       TEXT NOT NULL,
  prompt         TEXT NOT NULL,
  PRIMARY KEY (id, detail_scan_id)
);

-- =============================================================================
-- 12. M&Q MOVE MODE
-- =============================================================================

CREATE TABLE public.move_scans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  image_id   UUID REFERENCES public.images(id) ON DELETE SET NULL,
  -- Technical Analysis
  resolution   TEXT,
  has_text     TEXT,
  visual_style TEXT,
  aspect_ratio TEXT,
  -- Cinematic Analysis
  subject       TEXT,
  camera_shot   TEXT,
  lighting      TEXT,
  color_palette TEXT,
  depth_of_field TEXT,
  -- Mobility Diagnosis
  static_elements   TEXT[],
  dynamic_elements  TEXT[],
  parallax_potential TEXT,
  restrictions      TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.suggested_movements (
  id            TEXT NOT NULL,    -- ID da Gemini
  move_scan_id  UUID NOT NULL REFERENCES public.move_scans(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  intensity     move_intensity NOT NULL,
  PRIMARY KEY (id, move_scan_id)
);

CREATE TABLE public.move_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  duration        TEXT NOT NULL DEFAULT '5s',
  is_time_lapse   BOOLEAN NOT NULL DEFAULT FALSE,
  is_speed_ramp   BOOLEAN NOT NULL DEFAULT FALSE,
  movement_type   TEXT NOT NULL DEFAULT '',
  scene_animation TEXT NOT NULL DEFAULT '',
  is_transition   BOOLEAN NOT NULL DEFAULT FALSE,
  end_image_id    UUID REFERENCES public.images(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.move_outputs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.move_output_options (
  id                  INT NOT NULL,   -- ID da Gemini
  move_output_id      UUID NOT NULL REFERENCES public.move_outputs(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  prompt              TEXT NOT NULL,
  simulated_equipment TEXT NOT NULL,
  intensity           TEXT NOT NULL,
  PRIMARY KEY (id, move_output_id)
);

-- =============================================================================
-- 13. LOGS & AUDITORIA
-- =============================================================================

CREATE TABLE public.admin_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       UUID NOT NULL REFERENCES public.profiles(id),
  action         TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id),
  details        JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ai_call_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES public.generation_sessions(id) ON DELETE SET NULL,
  service         ai_service NOT NULL,
  input_tokens    INT,
  output_tokens   INT,
  status          ai_call_status NOT NULL,
  error_message   TEXT,
  response_time_ms INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Profiles
CREATE INDEX idx_profiles_role            ON public.profiles(role);
CREATE INDEX idx_profiles_subscription    ON public.profiles(subscription_tier);
CREATE INDEX idx_profiles_status          ON public.profiles(status);

-- Auth
CREATE INDEX idx_auth_sessions_user_id    ON public.auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires    ON public.auth_sessions(expires_at);
CREATE INDEX idx_auth_sessions_blocked    ON public.auth_sessions(blocked_until) WHERE blocked_until IS NOT NULL;

-- Projects
CREATE INDEX idx_projects_user_id         ON public.projects(user_id);
CREATE INDEX idx_projects_status          ON public.projects(status);

-- Generation Sessions
CREATE INDEX idx_gen_sessions_user_id     ON public.generation_sessions(user_id);
CREATE INDEX idx_gen_sessions_project     ON public.generation_sessions(project_id);
CREATE INDEX idx_gen_sessions_mode        ON public.generation_sessions(mode);

-- Scans
CREATE INDEX idx_scans_session_id         ON public.scans(session_id);
CREATE INDEX idx_scan_materials_scan_id   ON public.scan_materials(scan_id);
CREATE INDEX idx_scan_openings_scan_id    ON public.scan_openings(scan_id);

-- Prompts
CREATE INDEX idx_prompt_configs_session   ON public.prompt_configs(session_id);
CREATE INDEX idx_prompt_outputs_session   ON public.prompt_outputs(session_id);
CREATE INDEX idx_prompt_outputs_score     ON public.prompt_outputs(score DESC);

-- Image Generations
CREATE INDEX idx_img_gen_session_id       ON public.image_generations(session_id);
CREATE INDEX idx_img_gen_status           ON public.image_generations(status);
CREATE INDEX idx_img_gen_created          ON public.image_generations(created_at DESC);

-- Subscriptions
CREATE INDEX idx_subscriptions_user       ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status     ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_end        ON public.subscriptions(billing_cycle_end);
CREATE INDEX idx_image_credits_user       ON public.image_credits(user_id);

-- Move
CREATE INDEX idx_move_scans_session       ON public.move_scans(session_id);
CREATE INDEX idx_move_outputs_session     ON public.move_outputs(session_id);

-- Logs
CREATE INDEX idx_ai_call_logs_user        ON public.ai_call_logs(user_id);
CREATE INDEX idx_ai_call_logs_service     ON public.ai_call_logs(service);
CREATE INDEX idx_ai_call_logs_created     ON public.ai_call_logs(created_at DESC);
CREATE INDEX idx_admin_logs_admin         ON public.admin_logs(admin_id);
CREATE INDEX idx_admin_logs_target        ON public.admin_logs(target_user_id);

-- Images
CREATE INDEX idx_images_user              ON public.images(user_id);
CREATE INDEX idx_images_session           ON public.images(session_id);
