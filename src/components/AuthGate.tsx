import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, AlertCircle, ShieldCheck, Mail, Eye, EyeOff } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import { Button, Card } from './UI';
import { signInWithEmail, signInWithGoogle } from '../lib/useAuth';

interface AuthGateProps {
  onSuccess: () => void;
}

export function AuthGate({ onSuccess }: AuthGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

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

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login com Google');
      setGoogleLoading(false);
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

          {/* Botão Google — CTA principal */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-full border border-black/10 bg-white hover:bg-offwhite active:scale-[0.98] transition-all shadow-sm text-sm font-semibold text-bluegray disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {googleLoading ? (
              <svg
                className="w-5 h-5 animate-spin text-bluegray/40"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {googleLoading ? 'Redirecionando...' : 'Entrar com Google'}
          </button>

          {/* Divisor */}
          <div className="relative flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-black/5" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-bluegray/25">
              ou
            </span>
            <div className="flex-1 h-px bg-black/5" />
          </div>

          {/* Toggle formulário email */}
          <AnimatePresence>
            {!showEmailForm ? (
              <motion.button
                key="toggle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEmailForm(true)}
                className="w-full text-center text-xs text-bluegray/35 hover:text-bluegray/55 transition-colors py-1"
              >
                Acessar com e-mail e senha
              </motion.button>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
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

                <Button
                  type="submit"
                  variant="gold"
                  className="w-full py-4 text-base font-semibold !mt-2"
                  disabled={!isValid || loading}
                >
                  {loading ? 'Entrando...' : 'Acessar Studio'}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Erro */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-red-500 text-xs justify-center bg-red-50 p-3 rounded-xl mt-4"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-black/5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
            <ShieldCheck className="w-3 h-3" />
            <span>TOOL-SEC v1.0 Validated</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
