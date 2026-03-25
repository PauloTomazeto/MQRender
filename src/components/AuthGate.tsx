import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, AlertCircle, ShieldCheck, Mail, Eye, EyeOff } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import { Button, Card } from './UI';
import { signInWithEmail } from '../lib/useAuth';

interface AuthGateProps {
  onSuccess: () => void;
}

export function AuthGate({ onSuccess }: AuthGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      onSuccess();
    } catch {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const isValid = email.includes('@') && password.length >= 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-offwhite/95 backdrop-blur-xl p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="relative overflow-hidden border-none shadow-2xl bg-white p-8">
          <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />

          <div className="flex flex-col items-center text-center mb-8">
            <img
              src={logoUrl}
              alt="Render IA na Prática"
              className="h-16 w-auto object-contain mb-6"
            />
            <p className="text-bluegray/60 text-sm">Entre com sua conta para acessar o Studio.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 ml-4">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bluegray/30 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  className="w-full pl-10 pr-6 py-4 rounded-full bg-offwhite border border-black/5 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all text-sm text-bluegray"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 ml-4">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bluegray/30 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-4 rounded-full bg-offwhite border border-black/5 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all text-sm text-bluegray"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-bluegray/30 hover:text-bluegray/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-red-500 text-xs justify-center bg-red-50 p-3 rounded-xl"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              variant="gold"
              className="w-full py-4 text-base font-semibold !mt-6"
              disabled={!isValid || loading}
            >
              {loading ? 'Entrando...' : 'Acessar Studio'}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-black/5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
            <ShieldCheck className="w-3 h-3" />
            <span>TOOL-SEC v1.0 Validated</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
