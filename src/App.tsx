import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard } from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { Header } from './components/Header';
import { Studio } from './components/Studio';
import { AdminDashboard } from './components/AdminDashboard';
import { ResetPassword } from './components/ResetPassword';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { useAuth, signOut } from './lib/useAuth';
import { getUserCreditStatus, type CreditStatus } from './services/creditService';

type View = 'studio' | 'admin' | 'subscription';

export default function App() {
  const { user, loading, mustChangePassword, profileName, clearMustChangePassword } = useAuth();
  const [view, setView] = useState<View>('studio');
  const [credits, setCredits] = useState<CreditStatus | null>(null);

  const refreshCredits = useCallback(() => {
    if (!user) return;
    getUserCreditStatus(user.id)
      .then(setCredits)
      .catch(err => console.error('[MQv3 Credits]', err));
  }, [user]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  // Lê role diretamente do app_metadata do JWT — sem query ao banco
  const isAdmin = user?.app_metadata?.role === 'admin';

  const handleLogout = async () => {
    await signOut();
    setView('studio');
  };

  // Detect /auth/callback from OAuth providers (Google)
  // Supabase sends session tokens via URL hash after OAuth redirect
  if (window.location.pathname === '/auth/callback') {
    // Show loading while Supabase processes the session from URL hash
    // The useAuth hook will automatically handle the session
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-offwhite">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-bluegray/60 text-sm">Finalizando login...</p>
        </div>
      </div>
    );
  }

  // Detect password reset flow from URL (hash or query param from Supabase)
  const hash = window.location.hash;
  const search = window.location.search;
  const isResetPassword =
    window.location.pathname === '/reset-password' ||
    hash.includes('type=recovery') ||
    hash.includes('type=invite') ||
    search.includes('type=recovery') ||
    search.includes('type=invite');

  if (isResetPassword) {
    return <ResetPassword />;
  }

  // Carregando sessão Supabase
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-offwhite">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Não autenticado
  if (!user) {
    return <AuthGate onSuccess={() => {}} />;
  }

  // Primeiro acesso: forçar troca de senha antes de entrar no app
  if (mustChangePassword) {
    return (
      <ForcePasswordChange
        userEmail={user.email ?? ''}
        userName={profileName ?? user.email?.split('@')[0] ?? ''}
        onSuccess={clearMustChangePassword}
      />
    );
  }

  // Painel admin
  if (view === 'admin' && isAdmin) {
    return <AdminDashboard onExit={() => setView('studio')} />;
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <Header
        isAdmin={isAdmin}
        onAdminClick={() => setView('admin')}
        onLogout={handleLogout}
        onSubscriptionClick={() => setView('subscription')}
        onStudioClick={() => setView('studio')}
        currentView={view}
        credits={credits}
      />

      {view === 'studio' ? <Studio /> : <Studio forcedStep="subscription" />}

      {/* Botão flutuante Admin — visível só para administradores */}
      {isAdmin && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setView('admin')}
          className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl gold-gradient text-white shadow-xl shadow-gold/30 hover:shadow-gold/50 transition-shadow"
          title="Painel Administrativo"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">Admin</span>
        </motion.button>
      )}

      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="mq-pattern"
              x="0"
              y="0"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 50 Q 25 25, 50 50 T 100 50"
                fill="none"
                stroke="#6A747A"
                strokeWidth="1"
              />
              <path
                d="M0 100 Q 25 75, 50 100 T 100 100"
                fill="none"
                stroke="#6A747A"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mq-pattern)" />
        </svg>
      </div>
    </div>
  );
}
