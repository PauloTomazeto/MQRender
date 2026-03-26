// =============================================================================
// Render IA na Prática — Admin Service
// Todas as queries administrativas ao Supabase (acesso via is_admin() RLS).
// =============================================================================

import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  subscription_tier: string;
  image_quota_monthly: number;
  current_month_usage: number;
  created_at: string;
  last_login: string | null;
  plan_display: string;
  plan_price: number | null;
  sub_status: string | null;
}

export interface AdminLog {
  id: string;
  created_at: string;
  user_id: string;
  service: string;
  type: string;
  status: string;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  response_ms: number | null;
  user_email: string | null;
}

export interface PlanStat {
  id: number;
  name: string;
  display_name: string;
  price_monthly: number;
  features: string[];
  image_monthly_quota: number | null;
  user_count: number;
  revenue: number;
}

export interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  monthlyRevenue: number;
  totalSessions24h: number;
  aiCalls24h: number;
  aiErrors24h: number;
  imagesGenerated24h: number;
}

export interface WeeklyActivity {
  day: string;
  current: number;
  previous: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'new_user' | 'ai_call' | 'ai_error' | 'session';
  message: string;
  created_at: string;
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: suspendedUsers },
    { data: subData },
    { count: aiCalls24h },
    { count: aiErrors24h },
    { count: imagesGenerated24h },
    { count: totalSessions24h },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabase
      .from('subscriptions')
      .select('plan_id, subscription_plans(price_monthly)')
      .eq('status', 'active'),
    supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday),
    supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('created_at', yesterday),
    supabase
      .from('image_generations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday),
    supabase
      .from('generation_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday),
  ]);

  const monthlyRevenue = (subData ?? []).reduce((acc: number, s: any) => {
    return acc + (s.subscription_plans?.price_monthly ?? 0);
  }, 0);

  return {
    totalUsers: totalUsers ?? 0,
    activeUsers: activeUsers ?? 0,
    suspendedUsers: suspendedUsers ?? 0,
    monthlyRevenue,
    totalSessions24h: totalSessions24h ?? 0,
    aiCalls24h: aiCalls24h ?? 0,
    aiErrors24h: aiErrors24h ?? 0,
    imagesGenerated24h: imagesGenerated24h ?? 0,
  };
}

export async function getWeeklyActivity(): Promise<WeeklyActivity[]> {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const result: WeeklyActivity[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const prevStart = new Date(dayStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(dayEnd);
    prevEnd.setDate(prevEnd.getDate() - 7);

    const [{ count: current }, { count: previous }] = await Promise.all([
      supabase
        .from('ai_call_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString()),
      supabase
        .from('ai_call_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString()),
    ]);

    result.push({ day: days[dayStart.getDay()], current: current ?? 0, previous: previous ?? 0 });
  }

  return result;
}

export async function getPlanDistribution(): Promise<
  { name: string; count: number; pct: number }[]
> {
  const { data } = await supabase.from('profiles').select('subscription_tier');

  if (!data || data.length === 0) return [];

  const counts: Record<string, number> = {};
  data.forEach((p: any) => {
    counts[p.subscription_tier] = (counts[p.subscription_tier] ?? 0) + 1;
  });

  const total = data.length;
  return Object.entries(counts).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count,
    pct: Math.round((count / total) * 100),
  }));
}

export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const [{ data: newUsers }, { data: recentLogs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('ai_call_logs')
      .select('id, service, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const items: RecentActivityItem[] = [];

  (newUsers ?? []).forEach((u: any) => {
    items.push({
      id: u.id,
      type: 'new_user',
      message: `${u.name ?? u.email} criou uma nova conta.`,
      created_at: u.created_at,
    });
  });

  (recentLogs ?? []).forEach((l: any) => {
    items.push({
      id: l.id,
      type: l.status === 'error' || l.status === 'timeout' ? 'ai_error' : 'ai_call',
      message:
        l.status === 'error' ? `Erro em ${l.service}.` : `Chamada ${l.service} · ${l.status}.`,
      created_at: l.created_at,
    });
  });

  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<AdminUser[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(
      'id, name, email, role, status, subscription_tier, image_quota_monthly, current_month_usage, created_at, last_login'
    )
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('[adminService] getAllUsers profiles error:', profilesError);
    return [];
  }
  if (!profiles || profiles.length === 0) return [];

  const userIds = profiles.map((p: any) => p.id);

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, status, plan_id, subscription_plans ( display_name, price_monthly )')
    .in('user_id', userIds)
    .eq('status', 'active');

  const subMap = new Map((subs ?? []).map((s: any) => [s.user_id, s]));

  return profiles.map((p: any) => {
    const sub = subMap.get(p.id);
    const plan = sub?.subscription_plans;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      status: p.status,
      subscription_tier: p.subscription_tier,
      image_quota_monthly: p.image_quota_monthly,
      current_month_usage: p.current_month_usage,
      created_at: p.created_at,
      last_login: p.last_login,
      plan_display: plan?.display_name ?? p.subscription_tier,
      plan_price: plan?.price_monthly ?? null,
      sub_status: sub?.status ?? null,
    };
  });
}

export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended'
): Promise<void> {
  await supabase.from('profiles').update({ status }).eq('id', userId);
}

export async function updateUserPlan(userId: string, planName: string): Promise<void> {
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', planName.toLowerCase())
    .single();

  if (!plan) return;

  await Promise.all([
    supabase
      .from('profiles')
      .update({ subscription_tier: planName.toLowerCase() })
      .eq('id', userId),
    supabase.from('subscriptions').update({ plan_id: plan.id }).eq('user_id', userId),
  ]);
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  await supabase.auth.refreshSession();

  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { user_id: userId },
  });

  if (error) {
    const body = (error as any)?.context ?? {};
    const errMsg = body?.error || body?.message || error.message || 'Falha ao excluir usuário';
    console.error('[deleteUser] error:', error, body);
    return { success: false, error: errMsg };
  }

  return data ?? { success: true };
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getPlansWithStats(): Promise<PlanStat[]> {
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, name, display_name, price_monthly, features, image_monthly_quota')
    .order('price_monthly');

  if (!plans) return [];

  const { data: profiles } = await supabase.from('profiles').select('subscription_tier');

  const counts: Record<string, number> = {};
  (profiles ?? []).forEach((p: any) => {
    counts[p.subscription_tier] = (counts[p.subscription_tier] ?? 0) + 1;
  });

  return plans.map((p: any) => ({
    ...p,
    user_count: counts[p.name] ?? 0,
    revenue: (counts[p.name] ?? 0) * (p.price_monthly ?? 0),
  }));
}

export async function getSubscriptionSummary() {
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('status', 'active');

  const planIds = (subs ?? []).map((s: any) => s.plan_id).filter(Boolean);
  const { data: plans } = planIds.length
    ? await supabase.from('subscription_plans').select('id, price_monthly').in('id', planIds)
    : { data: [] };

  const planMap = new Map((plans ?? []).map((p: any) => [p.id, p]));
  const revenue = (subs ?? []).reduce(
    (acc: number, s: any) => acc + (planMap.get(s.plan_id)?.price_monthly ?? 0),
    0
  );

  const { count: total } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  const { count: canceled } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'canceled');

  return {
    revenue,
    total: total ?? 0,
    churnRate: total ? Math.round(((canceled ?? 0) / total) * 100 * 10) / 10 : 0,
  };
}

// ─── AI Logs ──────────────────────────────────────────────────────────────────

export async function getAiLogs(filters?: {
  service?: string;
  status?: string;
}): Promise<AdminLog[]> {
  let query = supabase
    .from('ai_call_logs')
    .select(
      'id, created_at, user_id, service, status, input_tokens, output_tokens, response_time_ms'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.service && filters.service !== 'all') {
    query = query.ilike('service', `%${filters.service}%`);
  }
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data: logs, error } = await query;
  if (error) {
    console.error('[adminService] getAiLogs error:', error);
    return [];
  }
  if (!logs || logs.length === 0) return [];

  const userIds = [...new Set(logs.map((l: any) => l.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds);

  const emailMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));

  return logs.map((l: any) => ({
    id: l.id,
    created_at: l.created_at,
    user_id: l.user_id,
    service: l.service,
    type: l.service,
    status: l.status,
    tokens_in: l.input_tokens,
    tokens_out: l.output_tokens,
    cost_usd: null,
    response_ms: l.response_time_ms,
    user_email: emailMap.get(l.user_id) ?? null,
  }));
}

export async function getLogStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yesterday = new Date(now.getTime() - 86400000).toISOString();

  const [{ count: monthTotal }, { count: calls24h }, { count: errors24h }] = await Promise.all([
    supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday),
    supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('created_at', yesterday),
  ]);

  const errorRate =
    (calls24h ?? 0) > 0 ? Math.round(((errors24h ?? 0) / (calls24h ?? 1)) * 100) : 0;

  return { monthTotal: monthTotal ?? 0, calls24h: calls24h ?? 0, errorRate };
}

// ─── Security ─────────────────────────────────────────────────────────────────

export async function getActiveSessions() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, last_login, status')
    .order('last_login', { ascending: false })
    .limit(20);

  return data ?? [];
}

// ─── Reports ──────────────────────────────────────────────────────────────────

// =============================================================================
// CRÉDITOS — ADMIN
// =============================================================================

export interface UserCreditInfo {
  user_id: string;
  email: string;
  name: string | null;
  subscription_tier: string;
  credits_plan: number;
  credits_addon: number;
  credits_used: number;
  credits_available: number;
  credits_reset_at: string | null;
}

export interface CreditConfigRow {
  id: number;
  model: string;
  resolution: string | null;
  kie_base_cost: number;
  markup_pct: number;
  our_cost: number;
  is_active: boolean;
}

export async function getAllUserCredits(): Promise<UserCreditInfo[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, name, subscription_tier, credits_plan, credits_addon, credits_used, credits_reset_at'
    )
    .order('credits_used', { ascending: false });

  if (error || !data) return [];

  return data.map((p: any) => ({
    user_id: p.id,
    email: p.email,
    name: p.name,
    subscription_tier: p.subscription_tier,
    credits_plan: p.credits_plan ?? 0,
    credits_addon: p.credits_addon ?? 0,
    credits_used: p.credits_used ?? 0,
    credits_available: (p.credits_plan ?? 0) + (p.credits_addon ?? 0) - (p.credits_used ?? 0),
    credits_reset_at: p.credits_reset_at,
  }));
}

export async function getCreditConfig(): Promise<CreditConfigRow[]> {
  const { data, error } = await supabase
    .from('credit_config')
    .select('*')
    .order('model')
    .order('resolution');

  if (error || !data) return [];
  return data as CreditConfigRow[];
}

export async function updateCreditConfig(
  id: number,
  updates: { kie_base_cost?: number; markup_pct?: number; our_cost?: number; is_active?: boolean }
): Promise<void> {
  await supabase
    .from('credit_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function adminAdjustUserCredits(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  await supabase.rpc('admin_adjust_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
  });
}

export async function adminAddAddonToUser(userId: string): Promise<void> {
  await supabase.rpc('add_addon_credits', { p_user_id: userId });
}

export async function getCreditTransactions(userId?: string, limit = 50): Promise<any[]> {
  let query = supabase
    .from('credit_transactions')
    .select('id, user_id, amount, type, model, resolution, description, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: transactions, error } = await query;
  if (error) {
    console.error('[adminService] getCreditTransactions error:', error);
    return [];
  }
  if (!transactions || transactions.length === 0) return [];

  const userIds = [...new Set(transactions.map((t: any) => t.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, name')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return transactions.map((t: any) => ({
    ...t,
    user_email: profileMap.get(t.user_id)?.email ?? null,
    user_name: profileMap.get(t.user_id)?.name ?? null,
  }));
}

// ─── Reports ──────────────────────────────────────────────────────────────────

// ─── Create User ──────────────────────────────────────────────────────────────

export interface CreateUserParams {
  email: string;
  name: string;
  plan: 'basic' | 'premium' | 'enterprise';
  role: 'user' | 'admin';
  addon_credits: number;
}

export interface CreateUserResult {
  success: boolean;
  user_id?: string;
  message?: string;
  temp_password?: string;
  credits_allocated?: {
    plan: number;
    addon: number;
    total: number;
  };
  error?: string;
}

export async function createUser(params: CreateUserParams): Promise<CreateUserResult> {
  // Refresh session to ensure JWT is valid before calling edge function
  await supabase.auth.refreshSession();

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: params,
  });

  if (error) {
    const body = (error as any)?.context ?? {};
    const errMsg =
      body?.error || body?.message || body?.details || error.message || 'Falha ao criar usuário';
    console.error('[createUser] Edge Function error:', error, body);
    return { success: false, error: errMsg };
  }

  return data;
}

export async function getReportKPIs() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { count: promptsMonth },
    { count: imagesMonth },
    { count: sessionsMonth },
    { data: avgResp },
  ] = await Promise.all([
    supabase
      .from('prompt_outputs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    supabase
      .from('image_generations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    supabase
      .from('generation_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    supabase
      .from('ai_call_logs')
      .select('response_time_ms')
      .not('response_time_ms', 'is', null)
      .gte('created_at', monthStart),
  ]);

  const avgMs =
    avgResp && avgResp.length > 0
      ? Math.round(
          avgResp.reduce((a: number, r: any) => a + (r.response_time_ms ?? 0), 0) / avgResp.length
        )
      : 0;

  return {
    promptsMonth: promptsMonth ?? 0,
    imagesMonth: imagesMonth ?? 0,
    sessionsMonth: sessionsMonth ?? 0,
    avgResponseSec: avgMs > 0 ? (avgMs / 1000).toFixed(1) + 's' : '—',
  };
}
