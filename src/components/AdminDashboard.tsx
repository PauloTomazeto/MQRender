import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  ShieldAlert,
  Terminal,
  Activity,
  Lock,
  AlertTriangle,
  Menu,
  X,
  CheckCircle2,
  Settings,
  TrendingUp,
  CreditCard,
  Image as ImageIcon,
  Search,
  Filter,
  MoreHorizontal,
  Ban,
  Unlock,
  Download,
  Bell,
  FileText,
  Star,
  Zap,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Globe,
  Clock,
  DollarSign,
  BarChart2,
  Shield,
  LogOut,
  Check,
  Trash2,
  UserPlus,
  Package,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { Button, Card, Badge, cn } from './UI';
import logoUrl from '../assets/logo.png';
import {
  getOverviewStats,
  getWeeklyActivity,
  getPlanDistribution,
  getRecentActivity,
  getAllUsers,
  updateUserStatus,
  updateUserPlan,
  getPlansWithStats,
  getSubscriptionSummary,
  getAiLogs,
  getLogStats,
  getActiveSessions,
  getReportKPIs,
  getAllUserCredits,
  getCreditConfig,
  updateCreditConfig,
  adminAdjustUserCredits,
  adminAddAddonToUser,
  getCreditTransactions,
  type AdminUser,
  type AdminLog,
  type PlanStat,
  type OverviewStats,
  type WeeklyActivity,
  type RecentActivityItem,
  type UserCreditInfo,
  type CreditConfigRow,
} from '../services/adminService';
import { getUserCreditStatus, type CreditStatus } from '../services/creditService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab =
  | 'overview'
  | 'users'
  | 'subscriptions'
  | 'credits'
  | 'security'
  | 'logs'
  | 'reports'
  | 'settings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const planColor = (plan: string) =>
  plan === 'enterprise' || plan === 'Enterprise'
    ? 'bg-purple-50 text-purple-600 border-purple-100'
    : plan === 'premium' || plan === 'Premium'
      ? 'bg-gold/20 text-[#a06f5d] border-gold/30'
      : 'bg-bluegray/5 text-bluegray/60 border-black/5';

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Agora';
  if (m < 60) return `Há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Há ${h}h`;
  return `Há ${Math.floor(h / 24)}d`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtCurrency(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fn()
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, reload: load };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-black/5 rounded-2xl', className)} />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function AdminDashboard({ onExit }: { onExit: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [myCredits, setMyCredits] = useState<CreditStatus | null>(null);
  useEffect(() => {
    getUserCreditStatus()
      .then(setMyCredits)
      .catch(() => {});
  }, []);

  const nav = [
    { id: 'overview', label: 'Visão Geral', icon: TrendingUp },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'subscriptions', label: 'Assinaturas', icon: Package },
    { id: 'credits', label: 'Créditos', icon: Zap },
    { id: 'security', label: 'TOOL-SEC', icon: ShieldAlert },
    { id: 'logs', label: 'Logs de IA', icon: Terminal },
    { id: 'reports', label: 'Relatórios', icon: BarChart2 },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-offwhite font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-white border-r border-black/5 flex flex-col transition-all duration-300 shrink-0 shadow-sm',
          sidebarOpen ? 'w-64' : 'w-[72px]'
        )}
      >
        <div className="h-16 px-4 border-b border-black/5 flex items-center justify-between">
          <button
            onClick={onExit}
            className={cn('transition-all', !sidebarOpen && 'opacity-0 pointer-events-none')}
          >
            <img src={logoUrl} alt="MQPROMP" className="h-7 w-auto object-contain" />
          </button>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-2 rounded-xl hover:bg-black/5 text-bluegray/40 transition-colors shrink-0"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="px-4 pt-4 pb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-bluegray/30">
              Painel Admin
            </span>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                title={!sidebarOpen ? item.label : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left relative group',
                  active
                    ? 'bg-bluegray text-white shadow-md shadow-bluegray/20'
                    : 'text-bluegray/60 hover:bg-black/5 hover:text-bluegray'
                )}
              >
                <item.icon
                  className={cn(
                    'w-4 h-4 shrink-0',
                    active ? 'text-gold' : 'text-bluegray/40 group-hover:text-bluegray/60'
                  )}
                />
                {sidebarOpen && (
                  <span className="text-sm font-semibold whitespace-nowrap">{item.label}</span>
                )}
                {active && sidebarOpen && (
                  <motion.div
                    layoutId="sidebar-pill"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gold rounded-r-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-black/5">
          <button
            onClick={onExit}
            title={!sidebarOpen ? 'Abrir Studio' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-gold/10 hover:bg-gold/20 text-[#a06f5d] transition-all group"
          >
            <ImageIcon className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
            {sidebarOpen && (
              <span className="text-sm font-bold uppercase tracking-widest">Studio</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-black/5 px-8 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-bluegray capitalize">
              {nav.find(n => n.id === activeTab)?.label}
            </h2>
            <p className="text-[10px] text-bluegray/40 font-medium">
              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · Admin
            </p>
          </div>
          <div className="flex items-center gap-3">
            {myCredits != null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                  {myCredits.credits_available.toLocaleString('pt-BR')} créditos
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistema Ativo
            </div>
            <button className="relative p-2.5 rounded-xl hover:bg-black/5 text-bluegray/40 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-[10px] font-black text-white uppercase shadow-md">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && <OverviewTab key="overview" />}
              {activeTab === 'users' && <UsersTab key="users" />}
              {activeTab === 'subscriptions' && <SubscriptionsTab key="subscriptions" />}
              {activeTab === 'credits' && <CreditsTab key="credits" />}
              {activeTab === 'security' && <SecurityTab key="security" />}
              {activeTab === 'logs' && <LogsTab key="logs" />}
              {activeTab === 'reports' && <ReportsTab key="reports" />}
              {activeTab === 'settings' && <SettingsTab key="settings" />}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function TabHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-bluegray mb-1">{title}</h1>
        <p className="text-sm text-bluegray/50">{subtitle}</p>
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  color,
  bg,
  loading,
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  loading?: boolean;
  key?: React.Key;
}) {
  const up = change?.startsWith('+');
  return (
    <Card className="p-6 border border-black/5 shadow-sm hover:shadow-md transition-shadow bg-white">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-2.5 rounded-2xl', bg)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        {change && (
          <div
            className={cn(
              'flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full',
              up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
            )}
          >
            {up ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            {change}
          </div>
        )}
      </div>
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-bluegray/40 mb-1">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-2xl font-display font-bold text-bluegray">{value}</p>
      )}
    </Card>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: stats, loading: loadStats } = useAsync(getOverviewStats);
  const { data: weekly, loading: loadWeekly } = useAsync(getWeeklyActivity);
  const { data: plans, loading: loadPlans } = useAsync(getPlanDistribution);
  const { data: activity, loading: loadAct } = useAsync(getRecentActivity);

  const planColors = ['bg-purple-500', 'bg-gold', 'bg-bluegray/30'];

  const activityIcon: Record<string, React.ElementType> = {
    new_user: UserPlus,
    ai_call: Zap,
    ai_error: AlertCircle,
    session: Clock,
  };
  const activityBg: Record<string, string> = {
    new_user: 'bg-blue-50 text-blue-500',
    ai_call: 'bg-gold/10 text-[#a06f5d]',
    ai_error: 'bg-red-50 text-red-500',
    session: 'bg-bluegray/5 text-bluegray/40',
  };

  const maxWeekly = Math.max(...(weekly ?? []).map(w => Math.max(w.current, w.previous)), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-8"
    >
      <TabHeader title="Visão Geral" subtitle="Métricas operacionais em tempo real.">
        <Badge className="bg-gold/10 text-[#a06f5d] border-gold/20 font-bold px-4 py-1.5">
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Badge>
      </TabHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Usuários Ativos"
          value={String(stats?.activeUsers ?? 0)}
          icon={Users}
          color="text-blue-500"
          bg="bg-blue-50"
          loading={loadStats}
        />
        <StatCard
          label="Receita Mensal"
          value={fmtCurrency(stats?.monthlyRevenue ?? 0)}
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
          loading={loadStats}
        />
        <StatCard
          label="Chamadas IA (24h)"
          value={String(stats?.aiCalls24h ?? 0)}
          icon={Zap}
          color="text-[#a06f5d]"
          bg="bg-gold/10"
          loading={loadStats}
        />
        <StatCard
          label="Erros IA (24h)"
          value={String(stats?.aiErrors24h ?? 0)}
          icon={AlertCircle}
          color="text-red-500"
          bg="bg-red-50"
          loading={loadStats}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 p-6 border border-black/5 shadow-sm bg-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-bold text-bluegray">Atividade de IA</h3>
              <p className="text-[10px] text-bluegray/40 font-medium uppercase tracking-widest mt-0.5">
                Chamadas por dia
              </p>
            </div>
          </div>
          {loadWeekly ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="h-52 flex items-end gap-2">
              {(weekly ?? []).map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[9px] font-black text-bluegray/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {w.current}
                  </span>
                  <div
                    className="w-full relative rounded-t-xl overflow-hidden bg-black/5"
                    style={{ height: 160 }}
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(w.previous / maxWeekly) * 100}%` }}
                      transition={{ delay: i * 0.05 }}
                      className="absolute bottom-0 w-full bg-bluegray/10 rounded-t-xl"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(w.current / maxWeekly) * 100}%` }}
                      transition={{ delay: i * 0.05 + 0.1 }}
                      className="absolute bottom-0 w-full gold-gradient rounded-t-xl opacity-80"
                    />
                  </div>
                  <span className="text-[9px] font-black text-bluegray/40 uppercase">{w.day}</span>
                </div>
              ))}
              {(!weekly || weekly.length === 0) && (
                <p className="text-sm text-bluegray/30 m-auto">Sem dados ainda</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-black/5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 rounded-sm gold-gradient opacity-80" />
              <span className="text-[10px] font-bold text-bluegray/50">Esta semana</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 rounded-sm bg-bluegray/10" />
              <span className="text-[10px] font-bold text-bluegray/50">Semana anterior</span>
            </div>
          </div>
        </Card>

        {/* Right col */}
        <div className="space-y-6">
          {/* System status */}
          <Card className="p-6 border border-black/5 shadow-sm bg-white">
            <h3 className="font-display font-bold text-bluegray mb-4">Status do Sistema</h3>
            <div className="space-y-2">
              {[
                { label: 'Gemini 2.5 Flash', ok: true, status: 'Operacional' },
                { label: 'Vertex AI', ok: true, status: 'Operacional' },
                { label: 'Supabase Auth', ok: true, status: 'Operacional' },
                { label: 'TOOL-SEC', ok: true, status: 'Armado' },
                { label: 'Storage', ok: true, status: 'Operacional' },
              ].map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-offwhite/60 border border-black/5"
                >
                  <span className="text-xs font-semibold text-bluegray">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-bluegray/50">
                      {s.status}
                    </span>
                    <span
                      className={cn('w-2 h-2 rounded-full', s.ok ? 'bg-emerald-500' : 'bg-red-500')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Plan distribution */}
          <Card className="p-6 border border-black/5 shadow-sm bg-white">
            <h3 className="font-display font-bold text-bluegray mb-4">Distribuição de Planos</h3>
            {loadPlans ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-3">
                {(plans ?? []).length === 0 && (
                  <p className="text-xs text-bluegray/30">Sem dados</p>
                )}
                {(plans ?? []).map((p, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-bluegray">{p.name}</span>
                      <span className="text-xs font-bold text-bluegray/50">{p.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${p.pct}%` }}
                        transition={{ delay: i * 0.1 }}
                        className={cn('h-full rounded-full', planColors[i % planColors.length])}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="p-6 border border-black/5 shadow-sm bg-white">
        <h3 className="font-display font-bold text-bluegray mb-4">Atividade Recente</h3>
        {loadAct ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-1">
            {(activity ?? []).length === 0 && (
              <p className="text-sm text-bluegray/30 py-4 text-center">Sem atividade recente</p>
            )}
            {(activity ?? []).map((a, i) => {
              const Icon = activityIcon[a.type] ?? Zap;
              return (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-offwhite/60 transition-colors"
                >
                  <div
                    className={cn(
                      'p-2 rounded-xl shrink-0',
                      activityBg[a.type] ?? 'bg-black/5 text-bluegray/40'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-bluegray flex-1">{a.message}</p>
                  <span className="text-[10px] font-bold text-bluegray/30 whitespace-nowrap">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users, loading, reload } = useAsync(getAllUsers);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilter] = useState('all');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [inviteOpen, setInvite] = useState(false);

  const filtered = (users ?? []).filter(u => {
    const q = search.toLowerCase();
    return (
      (u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (filterPlan === 'all' || u.subscription_tier === filterPlan)
    );
  });

  const toggleStatus = async (user: AdminUser) => {
    const next = user.status === 'active' ? 'suspended' : 'active';
    await updateUserStatus(user.id, next);
    reload();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      <TabHeader title="Usuários" subtitle="Gestão de acessos, planos e cotas.">
        <button
          onClick={reload}
          className="p-2 rounded-xl hover:bg-black/5 text-bluegray/40 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setInvite(true)}
        >
          <UserPlus className="w-3.5 h-3.5" /> Convidar
        </Button>
      </TabHeader>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bluegray/30" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-black/5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/20 text-bluegray shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterPlan}
          onChange={e => setFilter(e.target.value)}
          className="bg-white border border-black/5 text-xs font-bold uppercase tracking-widest px-4 py-3 rounded-2xl text-bluegray outline-none shadow-sm"
        >
          <option value="all">Todos os planos</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3">
        {[
          { label: `${filtered.length} usuários`, bg: 'bg-white border-black/5 text-bluegray/60' },
          {
            label: `${filtered.filter(u => u.status === 'active').length} ativos`,
            bg: 'bg-emerald-50 border-emerald-100 text-emerald-700',
          },
          {
            label: `${filtered.filter(u => u.status === 'suspended').length} suspensos`,
            bg: 'bg-red-50 border-red-100 text-red-600',
          },
        ].map((b, i) => (
          <span
            key={i}
            className={cn(
              'text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border',
              b.bg
            )}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="bg-white rounded-[28px] border border-black/5 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-offwhite border-b border-black/5">
                {['Usuário', 'Plano', 'Status', 'Cota / Uso', 'Cadastro', 'Ações'].map(h => (
                  <th
                    key={h}
                    className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-bluegray/40"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-bluegray/30">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-offwhite/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0">
                        {(user.name ?? user.email)
                          .split(' ')
                          .slice(0, 2)
                          .map(n => n[0].toUpperCase())
                          .join('')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-bluegray leading-none mb-0.5">
                          {user.name ?? '—'}
                        </p>
                        <p className="text-[11px] text-bluegray/40">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      className={cn(
                        'text-[9px] font-black uppercase tracking-widest',
                        planColor(user.subscription_tier)
                      )}
                    >
                      {user.plan_display}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          user.status === 'active' ? 'bg-emerald-500' : 'bg-red-400'
                        )}
                      />
                      <span className="text-xs font-semibold text-bluegray/60">
                        {user.status === 'active' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.image_quota_monthly > 0 ? (
                      <div className="w-28">
                        <span className="text-[10px] font-mono text-bluegray/50 block mb-1">
                          {user.current_month_usage}/{user.image_quota_monthly}
                        </span>
                        <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                          <div
                            className="h-full gold-gradient rounded-full"
                            style={{
                              width: `${Math.min((user.current_month_usage / user.image_quota_monthly) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-bluegray/40">Ilimitado</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-bluegray/40">
                      <Clock className="w-3 h-3" />
                      {fmtDate(user.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelected(user)}
                        className="p-2 rounded-xl bg-offwhite hover:bg-gold/10 hover:text-[#a06f5d] text-bluegray/40 border border-black/5 transition-all"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleStatus(user)}
                        className={cn(
                          'p-2 rounded-xl border transition-all',
                          user.status === 'active'
                            ? 'bg-offwhite hover:bg-red-50 hover:text-red-500 text-bluegray/40 border-black/5'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        )}
                      >
                        {user.status === 'active' ? (
                          <Ban className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <UserModal
            user={selected}
            onClose={() => {
              setSelected(null);
              reload();
            }}
          />
        )}
        {inviteOpen && <InviteModal onClose={() => setInvite(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function UserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [plan, setPlan] = useState(user.subscription_tier);
  const [saving, setSave] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSave(true);
    await updateUserPlan(user.id, plan);
    setSave(false);
    setSaved(true);
    setTimeout(onClose, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 border border-black/5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-xl text-bluegray">Editar Usuário</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 text-bluegray/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-offwhite mb-6">
          <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-sm font-black text-white shadow">
            {(user.name ?? user.email)
              .split(' ')
              .slice(0, 2)
              .map(n => n[0].toUpperCase())
              .join('')}
          </div>
          <div>
            <p className="font-bold text-bluegray">{user.name ?? '—'}</p>
            <p className="text-xs text-bluegray/40">{user.email}</p>
            <p className="text-[10px] text-bluegray/30 mt-0.5">
              Último acesso: {timeAgo(user.last_login)}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-bluegray/40 ml-1 mb-1.5 block">
              Plano
            </label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-offwhite border border-black/5 text-sm font-semibold text-bluegray outline-none focus:ring-2 focus:ring-gold/20"
            >
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <Button variant="gold" className="w-full py-3 gap-2" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-4 h-4" /> Salvo!
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-8 border border-black/5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-xl text-bluegray">Convidar Usuário</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 text-bluegray/40">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-bluegray/40 ml-1 mb-2 block">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bluegray/30" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="novo@usuario.com"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-offwhite border border-black/5 text-sm text-bluegray outline-none focus:ring-2 focus:ring-gold/20"
              />
            </div>
          </div>
          <Button
            variant="gold"
            className="w-full py-3 gap-2"
            onClick={() => {
              if (email.includes('@')) {
                setSent(true);
                setTimeout(onClose, 900);
              }
            }}
          >
            {sent ? (
              <>
                <Check className="w-4 h-4" /> Enviado!
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" /> Enviar Convite
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const { data: plans, loading: loadPlans } = useAsync(getPlansWithStats);
  const { data: summary, loading: loadSum } = useAsync(getSubscriptionSummary);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-8"
    >
      <TabHeader title="Assinaturas" subtitle="Visão financeira e gestão dos planos." />

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Receita Mensal"
          value={fmtCurrency(summary?.revenue ?? 0)}
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
          loading={loadSum}
        />
        <StatCard
          label="Assinantes"
          value={String(summary?.total ?? 0)}
          icon={Users}
          color="text-blue-500"
          bg="bg-blue-50"
          loading={loadSum}
        />
        <StatCard
          label="Churn Rate"
          value={`${summary?.churnRate ?? 0}%`}
          icon={TrendingUp}
          color="text-[#a06f5d]"
          bg="bg-gold/10"
          loading={loadSum}
        />
      </div>

      {loadPlans ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(plans ?? []).map((p, i) => (
            <Card
              key={i}
              className={cn(
                'p-6 border bg-white relative overflow-hidden',
                p.name === 'premium'
                  ? 'border-gold/30 shadow-gold/10 shadow-lg'
                  : p.name === 'enterprise'
                    ? 'border-purple-100'
                    : 'border-black/10'
              )}
            >
              {p.name === 'premium' && (
                <div className="absolute top-0 right-0 gold-gradient text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-2xl">
                  Popular
                </div>
              )}
              <Badge
                className={cn(
                  'text-[9px] font-black uppercase tracking-widest mb-3',
                  planColor(p.name)
                )}
              >
                {p.display_name}
              </Badge>
              <p className="text-2xl font-display font-bold text-bluegray mb-1">
                {p.price_monthly > 0 ? fmtCurrency(p.price_monthly) : 'Custom'}
                <span className="text-sm font-normal text-bluegray/40">/mês</span>
              </p>
              <div className="space-y-1.5 my-4">
                {(p.features ?? []).slice(0, 4).map((f: string, j: number) => (
                  <div key={j} className="flex items-center gap-2 text-xs text-bluegray/70">
                    <Check className="w-3.5 h-3.5 text-[#a06f5d] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-black/5 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-bluegray/40">Assinantes</span>
                  <span className="font-bold text-bluegray">{p.user_count}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-bluegray/40">Receita</span>
                  <span className="font-bold text-bluegray">{fmtCurrency(p.revenue)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Security ─────────────────────────────────────────────────────────────────

function SecurityTab() {
  const { data: sessions, loading } = useAsync(getActiveSessions);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-8"
    >
      <TabHeader title="TOOL-SEC" subtitle="Monitoramento de segurança e sessões ativas.">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
          <Activity className="w-3 h-3 animate-pulse" /> Sistema Armado
        </div>
      </TabHeader>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Usuários Ativos"
          value={String((sessions ?? []).filter((s: any) => s.status === 'active').length)}
          icon={Shield}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Usuários Suspensos"
          value={String((sessions ?? []).filter((s: any) => s.status === 'suspended').length)}
          icon={Ban}
          color="text-red-500"
          bg="bg-red-50"
        />
        <StatCard
          label="Total Registrados"
          value={String((sessions ?? []).length)}
          icon={Users}
          color="text-[#a06f5d]"
          bg="bg-gold/10"
        />
      </div>

      <Card className="border border-black/5 shadow-sm bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h3 className="font-display font-bold text-bluegray">Usuários e Último Acesso</h3>
          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black">
            {(sessions ?? []).filter((s: any) => s.status === 'active').length} ativos
          </Badge>
        </div>
        {loading ? (
          <Skeleton className="h-48 m-6" />
        ) : (
          <div className="divide-y divide-black/5">
            {(sessions ?? []).length === 0 && (
              <p className="text-center text-sm text-bluegray/30 py-12">
                Nenhum usuário registrado
              </p>
            )}
            {(sessions ?? []).map((s: any, i: number) => (
              <div
                key={i}
                className="px-6 py-4 flex items-center gap-4 hover:bg-offwhite/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-[10px] font-black text-white shrink-0">
                  {(s.name ?? s.email)
                    .split(' ')
                    .slice(0, 2)
                    .map((n: string) => n[0].toUpperCase())
                    .join('')}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-bluegray">{s.name ?? '—'}</p>
                  <p className="text-[11px] text-bluegray/40">{s.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-bluegray/40">
                    <Clock className="w-3 h-3" />
                    {timeAgo(s.last_login)}
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                      s.status === 'active'
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-red-50 text-red-500 border border-red-100'
                    )}
                  >
                    {s.status === 'active' ? (
                      <Wifi className="w-2.5 h-2.5" />
                    ) : (
                      <WifiOff className="w-2.5 h-2.5" />
                    )}
                    {s.status === 'active' ? 'Ativo' : 'Suspenso'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

function LogsTab() {
  const [filterSvc, setFilterSvc] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<AdminLog | null>(null);

  const {
    data: logs,
    loading: loadLogs,
    reload,
  } = useAsync(
    () => getAiLogs({ service: filterSvc, status: filterStatus }),
    [filterSvc, filterStatus]
  );
  const { data: stats, loading: loadStats } = useAsync(getLogStats);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      <TabHeader title="Logs de IA" subtitle="Rastreamento de chamadas, tokens e erros.">
        <button
          onClick={reload}
          className="p-2 rounded-xl hover:bg-black/5 text-bluegray/40 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loadLogs && 'animate-spin')} />
        </button>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </Button>
      </TabHeader>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Chamadas no Mês"
          value={String(stats?.monthTotal ?? 0)}
          icon={Zap}
          color="text-[#a06f5d]"
          bg="bg-gold/10"
          loading={loadStats}
        />
        <StatCard
          label="Chamadas (24h)"
          value={String(stats?.calls24h ?? 0)}
          icon={Activity}
          color="text-blue-500"
          bg="bg-blue-50"
          loading={loadStats}
        />
        <StatCard
          label="Taxa de Erro"
          value={`${stats?.errorRate ?? 0}%`}
          icon={AlertCircle}
          color="text-red-500"
          bg="bg-red-50"
          loading={loadStats}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterSvc}
          onChange={e => setFilterSvc(e.target.value)}
          className="bg-white border border-black/5 text-xs font-bold uppercase tracking-widest px-4 py-3 rounded-2xl text-bluegray outline-none shadow-sm"
        >
          <option value="all">Todos os serviços</option>
          <option value="gemini">Gemini</option>
          <option value="vertex">Vertex AI</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-black/5 text-xs font-bold uppercase tracking-widest px-4 py-3 rounded-2xl text-bluegray outline-none shadow-sm"
        >
          <option value="all">Todos os status</option>
          <option value="success">Sucesso</option>
          <option value="error">Erro</option>
          <option value="timeout">Timeout</option>
        </select>
      </div>

      {loadLogs ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="bg-white rounded-[28px] border border-black/5 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-offwhite border-b border-black/5">
                {['Hora', 'Serviço', 'Usuário', 'Status', 'Tokens', 'Tempo', ''].map(h => (
                  <th
                    key={h}
                    className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-bluegray/40"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-bluegray/30">
                    Nenhum log encontrado
                  </td>
                </tr>
              )}
              {(logs ?? []).map(log => (
                <tr key={log.id} className="hover:bg-offwhite/40 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-bluegray/50">
                    {new Date(log.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-[#a06f5d]">{log.service}</td>
                  <td className="px-5 py-4 text-xs text-bluegray/50">{log.user_email ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full',
                        log.status === 'success'
                          ? 'bg-emerald-50 text-emerald-600'
                          : log.status === 'error'
                            ? 'bg-red-50 text-red-500'
                            : 'bg-amber-50 text-amber-600'
                      )}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-bluegray/50">
                    {log.tokens_in || log.tokens_out
                      ? `${(log.tokens_in ?? 0) + (log.tokens_out ?? 0)}`
                      : '—'}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-bluegray/50">
                    {log.response_ms ? `${log.response_ms}ms` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setSelected(log)}
                      className="text-[9px] font-black uppercase tracking-widest text-[#a06f5d] hover:underline"
                    >
                      JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-black/5 flex items-center gap-2 text-[10px] font-bold text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Aguardando novos eventos...
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-bluegray rounded-[28px] w-full max-w-lg p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-white/50">LOG</span>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="font-mono text-xs text-white/80 whitespace-pre-wrap leading-relaxed overflow-auto max-h-80">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function ReportsTab() {
  const { data: kpis, loading } = useAsync(getReportKPIs);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-8"
    >
      <TabHeader title="Relatórios" subtitle="KPIs operacionais do mês atual.">
        <Button variant="gold" size="sm" className="gap-2 text-xs">
          <Download className="w-3.5 h-3.5" /> Exportar
        </Button>
      </TabHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Prompts Gerados"
          value={String(kpis?.promptsMonth ?? 0)}
          icon={Star}
          color="text-[#a06f5d]"
          bg="bg-gold/10"
          loading={loading}
        />
        <StatCard
          label="Imagens Geradas"
          value={String(kpis?.imagesMonth ?? 0)}
          icon={ImageIcon}
          color="text-blue-500"
          bg="bg-blue-50"
          loading={loading}
        />
        <StatCard
          label="Sessões"
          value={String(kpis?.sessionsMonth ?? 0)}
          icon={Activity}
          color="text-emerald-600"
          bg="bg-emerald-50"
          loading={loading}
        />
        <StatCard
          label="Tempo Médio IA"
          value={kpis?.avgResponseSec ?? '—'}
          icon={Clock}
          color="text-purple-600"
          bg="bg-purple-50"
          loading={loading}
        />
      </div>

      <Card className="p-8 border border-black/5 bg-white shadow-sm">
        <div className="flex items-center justify-center flex-col gap-3 py-8 text-center">
          <FileText className="w-10 h-10 text-bluegray/20" />
          <p className="text-sm font-bold text-bluegray/40">Relatórios detalhados em breve</p>
          <p className="text-xs text-bluegray/30">Os dados acima são atualizados em tempo real.</p>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Credits ──────────────────────────────────────────────────────────────────

function creditAvailableColor(available: number, total: number): string {
  if (total <= 0) return 'text-bluegray/40';
  const pct = (available / total) * 100;
  if (pct > 50) return 'text-emerald-600 font-bold';
  if (pct >= 10) return 'text-amber-600 font-bold';
  return 'text-red-500 font-bold';
}

function creditAvailableBg(available: number, total: number): string {
  if (total <= 0) return 'bg-black/5';
  const pct = (available / total) * 100;
  if (pct > 50) return 'bg-emerald-50 border-emerald-100';
  if (pct >= 10) return 'bg-amber-50 border-amber-100';
  return 'bg-red-50 border-red-100';
}

function txTypeBadge(type: string) {
  const map: Record<string, string> = {
    plan_allocation: 'bg-blue-50 text-blue-600 border-blue-100',
    addon_purchase: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    consumption: 'bg-orange-50 text-orange-600 border-orange-100',
    admin_adjustment: 'bg-purple-50 text-purple-600 border-purple-100',
    cycle_reset: 'bg-bluegray/5 text-bluegray/50 border-black/5',
  };
  return map[type] ?? 'bg-black/5 text-bluegray/50 border-black/5';
}

function AdjustModal({
  user,
  onClose,
  onDone,
}: {
  user: UserCreditInfo;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    const n = parseInt(amount, 10);
    if (isNaN(n) || !description.trim()) return;
    setSaving(true);
    await adminAdjustUserCredits(user.user_id, n, description.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      onClose();
      onDone();
    }, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-8 border border-black/5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-xl text-bluegray">Ajustar Créditos</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 text-bluegray/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 rounded-2xl bg-offwhite mb-6">
          <p className="font-bold text-sm text-bluegray">{user.name ?? '—'}</p>
          <p className="text-xs text-bluegray/40">{user.email}</p>
          <p className="text-xs text-bluegray/50 mt-1">
            Disponível atual:{' '}
            <span className="font-bold">{user.credits_available.toLocaleString('pt-BR')}</span>
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-bluegray/40 ml-1 mb-1.5 block">
              Quantidade (use negativo para remover)
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="ex: 500 ou -200"
              className="w-full px-4 py-3 rounded-2xl bg-offwhite border border-black/5 text-sm font-semibold text-bluegray outline-none focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-bluegray/40 ml-1 mb-1.5 block">
              Descrição
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ex: Compensação por erro"
              className="w-full px-4 py-3 rounded-2xl bg-offwhite border border-black/5 text-sm text-bluegray outline-none focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <Button
            variant="gold"
            className="w-full py-3 gap-2"
            onClick={submit}
            disabled={saving || !amount || !description.trim()}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-4 h-4" /> Ajustado!
              </>
            ) : (
              'Confirmar Ajuste'
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreditsTab() {
  const { data: users, loading: loadUsers, reload: reloadUsers } = useAsync(getAllUserCredits);
  const { data: config, loading: loadConfig, reload: reloadConfig } = useAsync(getCreditConfig);
  const {
    data: transactions,
    loading: loadTx,
    reload: reloadTx,
  } = useAsync(() => getCreditTransactions(undefined, 50));

  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    kie_base_cost: string;
    markup_pct: string;
    is_active: boolean;
  }>({ kie_base_cost: '', markup_pct: '', is_active: true });
  const [savingConfig, setSavingConfig] = useState(false);
  const [adjustUser, setAdjustUser] = useState<UserCreditInfo | null>(null);
  const [addingAddon, setAddingAddon] = useState<string | null>(null);

  const filteredUsers = (users ?? []).filter(u => {
    const q = search.toLowerCase();
    return (u.name?.toLowerCase().includes(q) ?? false) || u.email.toLowerCase().includes(q);
  });

  const totalDistributed = (users ?? []).reduce(
    (acc, u) => acc + u.credits_plan + u.credits_addon,
    0
  );
  const totalUsed = (users ?? []).reduce((acc, u) => acc + u.credits_used, 0);
  const totalAvailable = (users ?? []).reduce((acc, u) => acc + u.credits_available, 0);

  const startEdit = (row: CreditConfigRow) => {
    setEditRow(row.id);
    setEditValues({
      kie_base_cost: String(row.kie_base_cost),
      markup_pct: String(row.markup_pct),
      is_active: row.is_active,
    });
  };

  const cancelEdit = () => {
    setEditRow(null);
  };

  const saveConfig = async (id: number) => {
    setSavingConfig(true);
    const kbc = parseFloat(editValues.kie_base_cost) || 0;
    const mkp = parseFloat(editValues.markup_pct) || 0;
    const ourCost = Math.ceil((kbc * mkp) / 100);
    await updateCreditConfig(id, {
      kie_base_cost: kbc,
      markup_pct: mkp,
      our_cost: ourCost,
      is_active: editValues.is_active,
    });
    setSavingConfig(false);
    setEditRow(null);
    reloadConfig();
  };

  const handleAddAddon = async (userId: string) => {
    setAddingAddon(userId);
    await adminAddAddonToUser(userId);
    setAddingAddon(null);
    reloadUsers();
    reloadTx();
  };

  const reload = () => {
    reloadUsers();
    reloadConfig();
    reloadTx();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-8"
    >
      <TabHeader title="Créditos" subtitle="Gestão de créditos, custos e transações.">
        <button
          onClick={reload}
          className="p-2 rounded-xl hover:bg-black/5 text-bluegray/40 transition-colors"
          title="Atualizar"
        >
          <RefreshCw
            className={cn('w-4 h-4', (loadUsers || loadConfig || loadTx) && 'animate-spin')}
          />
        </button>
      </TabHeader>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Distribuído"
          value={totalDistributed.toLocaleString('pt-BR')}
          icon={Zap}
          color="text-blue-500"
          bg="bg-blue-50"
          loading={loadUsers}
        />
        <StatCard
          label="Total Consumido"
          value={totalUsed.toLocaleString('pt-BR')}
          icon={Activity}
          color="text-[#a06f5d]"
          bg="bg-gold/10"
          loading={loadUsers}
        />
        <StatCard
          label="Total Disponível"
          value={totalAvailable.toLocaleString('pt-BR')}
          icon={CheckCircle2}
          color="text-emerald-600"
          bg="bg-emerald-50"
          loading={loadUsers}
        />
      </div>

      {/* Credit Config */}
      <Card className="border border-black/5 shadow-sm bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-bluegray">Configuração de Custos</h3>
            <p className="text-[10px] text-bluegray/40 font-medium uppercase tracking-widest mt-0.5">
              Custo por modelo / resolução
            </p>
          </div>
        </div>
        {loadConfig ? (
          <Skeleton className="h-32 m-6" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-offwhite border-b border-black/5">
                  {[
                    'Modelo',
                    'Resolução',
                    'KIE Base Cost',
                    'Markup %',
                    'Nosso Custo',
                    'Ativo',
                    '',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-bluegray/40"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {(config ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-sm text-bluegray/30">
                      Nenhuma configuração encontrada
                    </td>
                  </tr>
                )}
                {(config ?? []).map(row => {
                  const isEditing = editRow === row.id;
                  const previewOurCost = isEditing
                    ? Math.ceil(
                        ((parseFloat(editValues.kie_base_cost) || 0) *
                          (parseFloat(editValues.markup_pct) || 0)) /
                          100
                      )
                    : row.our_cost;
                  return (
                    <tr key={row.id} className="hover:bg-offwhite/40 transition-colors">
                      <td className="px-5 py-4 text-xs font-bold text-bluegray">{row.model}</td>
                      <td className="px-5 py-4 text-xs text-bluegray/60">
                        {row.resolution ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.001"
                            value={editValues.kie_base_cost}
                            onChange={e =>
                              setEditValues(v => ({ ...v, kie_base_cost: e.target.value }))
                            }
                            className="w-24 px-3 py-1.5 rounded-xl bg-offwhite border border-black/5 text-xs font-mono text-bluegray outline-none focus:ring-2 focus:ring-gold/20"
                          />
                        ) : (
                          <span className="font-mono text-xs text-bluegray/60">
                            {row.kie_base_cost}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <input
                            type="number"
                            step="1"
                            value={editValues.markup_pct}
                            onChange={e =>
                              setEditValues(v => ({ ...v, markup_pct: e.target.value }))
                            }
                            className="w-20 px-3 py-1.5 rounded-xl bg-offwhite border border-black/5 text-xs font-mono text-bluegray outline-none focus:ring-2 focus:ring-gold/20"
                          />
                        ) : (
                          <span className="font-mono text-xs text-bluegray/60">
                            {row.markup_pct}%
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'font-mono text-xs font-bold',
                            isEditing ? 'text-[#a06f5d]' : 'text-bluegray'
                          )}
                        >
                          {previewOurCost}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <button
                            onClick={() => setEditValues(v => ({ ...v, is_active: !v.is_active }))}
                            className={cn(
                              'relative w-8 h-5 rounded-full transition-all',
                              editValues.is_active ? 'gold-gradient' : 'bg-bluegray/15'
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                                editValues.is_active ? 'left-3.5' : 'left-0.5'
                              )}
                            />
                          </button>
                        ) : (
                          <span
                            className={cn(
                              'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full',
                              row.is_active
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-red-50 text-red-400'
                            )}
                          >
                            {row.is_active ? 'Sim' : 'Não'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveConfig(row.id)}
                              disabled={savingConfig}
                              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-gold/10 hover:bg-gold/20 text-[#a06f5d] px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                            >
                              {savingConfig ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              Salvar
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-[9px] font-black uppercase tracking-widest text-bluegray/40 hover:text-bluegray/70 px-3 py-1.5 rounded-xl hover:bg-black/5 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(row)}
                            className="text-[9px] font-black uppercase tracking-widest text-[#a06f5d] hover:underline"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Users Credits */}
      <Card className="border border-black/5 shadow-sm bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-bluegray">Créditos por Usuário</h3>
            <p className="text-[10px] text-bluegray/40 font-medium uppercase tracking-widest mt-0.5">
              {filteredUsers.length} usuários
            </p>
          </div>
          <div className="relative shrink-0 w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bluegray/30" />
            <input
              type="text"
              placeholder="Filtrar por e-mail ou nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-offwhite border border-black/5 text-xs focus:outline-none focus:ring-2 focus:ring-gold/20 text-bluegray"
            />
          </div>
        </div>
        {loadUsers ? (
          <Skeleton className="h-48 m-6" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-offwhite border-b border-black/5">
                  {[
                    'Usuário',
                    'Plano',
                    'Créditos Plano',
                    'Addon',
                    'Usado',
                    'Disponível',
                    'Reset em',
                    'Ações',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-bluegray/40 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-sm text-bluegray/30">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                )}
                {filteredUsers.map(u => {
                  const total = u.credits_plan + u.credits_addon;
                  return (
                    <tr key={u.user_id} className="hover:bg-offwhite/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0">
                            {(u.name ?? u.email)
                              .split(' ')
                              .slice(0, 2)
                              .map(n => n[0].toUpperCase())
                              .join('')}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-bluegray leading-none mb-0.5">
                              {u.name ?? '—'}
                            </p>
                            <p className="text-[11px] text-bluegray/40">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          className={cn(
                            'text-[9px] font-black uppercase tracking-widest',
                            planColor(u.subscription_tier)
                          )}
                        >
                          {u.subscription_tier}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-bluegray/70">
                        {u.credits_plan.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-bluegray/70">
                        {u.credits_addon.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-bluegray/70">
                        {u.credits_used.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'font-mono text-xs px-2 py-1 rounded-xl border',
                            creditAvailableBg(u.credits_available, total),
                            creditAvailableColor(u.credits_available, total)
                          )}
                        >
                          {u.credits_available.toLocaleString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-bluegray/40 whitespace-nowrap">
                        {u.credits_reset_at ? fmtDate(u.credits_reset_at) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAddAddon(u.user_id)}
                            disabled={addingAddon === u.user_id}
                            title="+1000 créditos addon"
                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-2.5 py-1.5 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {addingAddon === u.user_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                            +1000
                          </button>
                          <button
                            onClick={() => setAdjustUser(u)}
                            className="text-[9px] font-black uppercase tracking-widest bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 px-2.5 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                          >
                            Ajustar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Transactions */}
      <Card className="border border-black/5 shadow-sm bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h3 className="font-display font-bold text-bluegray">Transações Recentes</h3>
          <p className="text-[10px] text-bluegray/40 font-medium uppercase tracking-widest mt-0.5">
            Últimas 50 transações
          </p>
        </div>
        {loadTx ? (
          <Skeleton className="h-48 m-6" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-offwhite border-b border-black/5">
                  {['Data', 'Usuário', 'Tipo', 'Quantidade', 'Modelo', 'Descrição'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-bluegray/40 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {(transactions ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-sm text-bluegray/30">
                      Nenhuma transação encontrada
                    </td>
                  </tr>
                )}
                {(transactions ?? []).map((tx: any, i: number) => (
                  <tr key={tx.id ?? i} className="hover:bg-offwhite/40 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-bluegray/50 whitespace-nowrap">
                      {tx.created_at
                        ? new Date(tx.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-xs text-bluegray/60 max-w-[160px] truncate">
                      {tx.user_email ?? tx.user_id ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border',
                          txTypeBadge(tx.type ?? tx.transaction_type ?? '')
                        )}
                      >
                        {(tx.type ?? tx.transaction_type ?? '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          'font-mono text-xs font-bold',
                          (tx.amount ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                        )}
                      >
                        {(tx.amount ?? 0) >= 0 ? '+' : ''}
                        {(tx.amount ?? 0).toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-bluegray/50">{tx.model ?? '—'}</td>
                    <td className="px-5 py-4 text-xs text-bluegray/60 max-w-[200px] truncate">
                      {tx.description ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-black/5 flex items-center gap-2 text-[10px] font-bold text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Dados em tempo real
            </div>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {adjustUser && (
          <AdjustModal
            user={adjustUser}
            onClose={() => setAdjustUser(null)}
            onDone={() => {
              reloadUsers();
              reloadTx();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function SettingsTab() {
  const [showKey, setShowKey] = useState(false);
  const [maintenanceMode, setMaint] = useState(false);
  const [emailAlerts, setEmail] = useState(true);
  const [saved, setSaved] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-8"
    >
      <TabHeader title="Configurações" subtitle="Chaves de API e comportamentos do sistema." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border border-black/5 shadow-sm bg-white">
          <h3 className="font-display font-bold text-bluegray mb-1">Chaves de API</h3>
          <p className="text-xs text-bluegray/40 mb-5">Configuradas via variáveis de ambiente.</p>
          <div className="space-y-4">
            {[
              {
                label: 'Gemini API Key',
                value: showKey
                  ? (import.meta.env.VITE_GEMINI_API_KEY ?? '(não configurado)')
                  : '••••••••••••••••••••••••',
              },
              {
                label: 'Supabase URL',
                value: import.meta.env.VITE_SUPABASE_URL ?? '(não configurado)',
              },
              { label: 'Supabase Key', value: '••••••••••••••••••••••••' },
            ].map((k, i) => (
              <div key={i}>
                <label className="text-[9px] font-black uppercase tracking-widest text-bluegray/40 ml-1 mb-1.5 block">
                  {k.label}
                </label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-offwhite border border-black/5">
                  <span className="flex-1 font-mono text-xs text-bluegray/60 truncate">
                    {k.value}
                  </span>
                  {i === 0 && (
                    <button
                      onClick={() => setShowKey(v => !v)}
                      className="text-bluegray/30 hover:text-bluegray/60 transition-colors"
                    >
                      {showKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border border-black/5 shadow-sm bg-white">
          <h3 className="font-display font-bold text-bluegray mb-1">Sistema</h3>
          <p className="text-xs text-bluegray/40 mb-5">Comportamentos operacionais.</p>
          <div className="space-y-4">
            {[
              {
                label: 'Modo de Manutenção',
                desc: 'Bloqueia acesso ao Studio.',
                state: maintenanceMode,
                toggle: () => setMaint(v => !v),
              },
              {
                label: 'Alertas por E-mail',
                desc: 'Notifica sobre intrusões.',
                state: emailAlerts,
                toggle: () => setEmail(v => !v),
              },
            ].map((s, i) => (
              <div
                key={i}
                className="flex items-start justify-between p-4 rounded-2xl bg-offwhite border border-black/5"
              >
                <div>
                  <p className="font-bold text-sm text-bluegray">{s.label}</p>
                  <p className="text-xs text-bluegray/40 mt-0.5">{s.desc}</p>
                </div>
                <button
                  onClick={s.toggle}
                  className={cn(
                    'relative w-10 h-6 rounded-full transition-all shrink-0 mt-0.5',
                    s.state ? 'gold-gradient' : 'bg-bluegray/15'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all',
                      s.state ? 'left-5' : 'left-1'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border border-red-100 bg-red-50/30 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <h3 className="font-display font-bold text-red-600">Zona de Risco</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Limpar Cache', icon: RefreshCw, desc: 'Remove respostas em cache.' },
              { label: 'Exportar Dados', icon: Download, desc: 'Backup completo do banco.' },
              { label: 'Resetar Logs (30d)', icon: Trash2, desc: 'Apaga logs de AI com 30+ dias.' },
            ].map((a, i) => (
              <button
                key={i}
                className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-red-100 hover:border-red-200 text-left transition-all group"
              >
                <a.icon className="w-4 h-4 text-red-400 mt-0.5 group-hover:text-red-600 transition-colors shrink-0" />
                <div>
                  <p className="font-bold text-sm text-red-600">{a.label}</p>
                  <p className="text-[10px] text-red-400 mt-0.5">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          variant="gold"
          className="px-8 gap-2"
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" /> Salvo!
            </>
          ) : (
            'Salvar Configurações'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
