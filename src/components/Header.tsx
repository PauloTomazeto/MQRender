import { ShieldCheck, Lock, LogOut } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import { cn } from './UI';

export function Header({
  isAdmin,
  onAdminClick,
  onLogout,
  onSubscriptionClick,
  onStudioClick,
  currentView,
}: {
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onLogout?: () => void;
  onSubscriptionClick?: () => void;
  onStudioClick?: () => void;
  currentView?: string;
}) {
  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <img src={logoUrl} alt="MQPROMP" className="h-10 w-auto object-contain" />
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={onStudioClick}
            className={cn(
              'text-xs font-bold uppercase tracking-widest transition-colors',
              currentView === 'studio' ? 'text-bluegray' : 'text-bluegray/40 hover:text-gold'
            )}
          >
            Studio
          </button>
          <button
            onClick={onSubscriptionClick}
            className={cn(
              'text-xs font-bold uppercase tracking-widest transition-colors',
              currentView === 'subscription' ? 'text-bluegray' : 'text-bluegray/40 hover:text-gold'
            )}
          >
            Assinatura
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {isAdmin && onAdminClick && (
            <button
              onClick={onAdminClick}
              className="p-2 rounded-lg hover:bg-gold/10 text-gold/60 hover:text-gold transition-colors"
              title="Painel Administrativo"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-bluegray/5 border border-black/5">
            <ShieldCheck className="w-3.5 h-3.5 text-bluegray/40" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
              Sessão Ativa
            </span>
          </div>

          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm',
              isAdmin ? 'gold-gradient' : 'bg-bluegray/20 text-bluegray'
            )}
          >
            {isAdmin ? 'AD' : 'US'}
          </div>

          <button
            onClick={onLogout}
            className="p-2 ml-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
