# MQPROMP — Banco de Dados Supabase

## Estrutura das Migrations

```
supabase/migrations/
├── 001_initial_schema.sql      → Todas as tabelas, tipos e índices
├── 002_rls_policies.sql        → Row Level Security (cada usuário vê só seus dados)
├── 003_functions_triggers.sql  → Funções, triggers e automações
├── 004_seed.sql                → Dados iniciais (planos, storage buckets)
└── 005_scheduled_jobs.sql      → Jobs agendados via pg_cron
```

## Como Aplicar

### Opção A — Supabase CLI (recomendado)

```bash
# Instalar CLI
npm install -g supabase

# Autenticar
supabase login

# Vincular ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Aplicar migrations
supabase db push
```

### Opção B — SQL Editor Manual

Execute os arquivos **na ordem** no SQL Editor do Supabase Dashboard:
1. `001_initial_schema.sql`
2. `002_rls_policies.sql`
3. `003_functions_triggers.sql`
4. `004_seed.sql`
5. `005_scheduled_jobs.sql` *(requer pg_cron habilitado)*

---

## Diagrama de Entidades

```
profiles (usuário)
  ├── subscriptions → subscription_plans
  ├── image_credits (pacotes avulsos)
  ├── projects
  │     └── generation_sessions
  │           ├── images (uploads e geradas)
  │           │
  │           ├── [modo promp]
  │           │   ├── scans
  │           │   │   ├── scan_materials
  │           │   │   ├── scan_openings
  │           │   │   ├── scan_camera
  │           │   │   ├── scan_light
  │           │   │   ├── scan_light_points
  │           │   │   ├── scan_context
  │           │   │   └── floor_plan_environments
  │           │   ├── prompt_configs
  │           │   │   ├── light_point_configs
  │           │   │   └── mirror_configs
  │           │   ├── prompt_outputs
  │           │   │   └── prompt_blocks
  │           │   ├── image_generations
  │           │   │   └── post_production_analyses
  │           │   │         └── post_production_pipeline
  │           │   └── detail_scans
  │           │         └── detail_closes
  │           │
  │           └── [modo move]
  │               ├── move_scans
  │               │   └── suggested_movements
  │               ├── move_configs
  │               └── move_outputs
  │                     └── move_output_options
  │
  ├── ai_call_logs (uso da API Gemini)
  └── auth_sessions (controle de lockout)

admin_logs (auditoria — somente admins)
```

---

## Planos de Assinatura

| Plano      | Preço/mês | Imagens/mês | Observação              |
|------------|-----------|-------------|-------------------------|
| Basic      | $157.99   | 0           | Apenas prompts          |
| Premium    | $199.00   | 100         | Popular                 |
| Enterprise | Consulta  | Ilimitado   | Conta dedicada          |

**Pacote avulso:** 100 imagens por $59.99 (gerenciado via Stripe)

---

## Segurança (RLS)

- Cada usuário acessa **apenas seus próprios dados** via `auth.uid()`
- Admins (`role = 'admin'`) têm acesso irrestrito via `is_admin()`
- Planos de assinatura são **leitura pública** (necessário para UI de pricing)
- Logs de auditoria (`admin_logs`) são **somente admin**
- Storage buckets são **privados** — acesso via signed URLs

---

## Variáveis de Ambiente Necessárias

Adicione ao `.env`:

```env
VITE_SUPABASE_URL="https://SEU_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="sua-anon-key-aqui"
```

---

## Jobs Agendados (pg_cron)

| Job                     | Frequência        | Ação                              |
|-------------------------|-------------------|-----------------------------------|
| reset-monthly-quotas    | Dia 1 às 00:00    | Zera `current_month_usage`        |
| cleanup-expired-sessions| Diário às 03:00   | Remove sessões expiradas          |
| unblock-users           | A cada 5 minutos  | Desbloqueia após lockout de 30min |
| expire-subscriptions    | Diário às 01:00   | Expira assinaturas vencidas       |
| cleanup-old-ai-logs     | Diário às 04:00   | Retém apenas 90 dias de logs      |

Habilite pg_cron em: **Dashboard → Database → Extensions → pg_cron**
