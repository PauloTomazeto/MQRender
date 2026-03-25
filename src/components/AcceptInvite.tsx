import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Mail, Eye, EyeOff, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import { Button, Card } from './UI';
import { supabase } from '../lib/supabase';

interface AcceptInviteProps {
  onSuccess: () => void;
}

interface InviteInfo {
  email: string;
  name: string | null;
  expires_at: string;
  used: boolean;
}

export function AcceptInvite({ onSuccess }: AcceptInviteProps) {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);

  // Extract token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    setToken(tokenParam);

    if (tokenParam) {
      validateInvite(tokenParam);
    } else {
      setCheckingInvite(false);
      setError('Link de convite inválido ou expirado.');
    }
  }, []);

  // Validate invite token
  async function validateInvite(tokenParam: string) {
    try {
      const { data, error: inviteError } = await supabase
        .from('user_invites')
        .select('email, name, expires_at, used')
        .eq('token', tokenParam)
        .single();

      if (inviteError || !data) {
        setError('Convite não encontrado.');
        setCheckingInvite(false);
        return;
      }

      if (data.used) {
        setError('Este convite já foi utilizado.');
        setCheckingInvite(false);
        return;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError('Este convite expirou. Solicite um novo convite ao administrador.');
        setCheckingInvite(false);
        return;
      }

      setInviteInfo(data);
      setCheckingInvite(false);
    } catch (err) {
      console.error('Error validating invite:', err);
      setError('Erro ao validar convite.');
      setCheckingInvite(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!token) {
      setError('Token de convite não encontrado.');
      return;
    }

    setLoading(true);

    try {
      // Call accept-invite edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/accept-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar senha');
      }

      setSuccess(true);

      // Redirect to studio after short delay
      setTimeout(() => {
        // Sign in with the new credentials
        signInAndContinue();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  async function signInAndContinue() {
    if (!inviteInfo?.email || !password) return;

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteInfo.email,
        password: password,
      });

      if (signInError) {
        console.error('Sign in error after password set:', signInError);
        // Still allow success - user can manually sign in
        onSuccess();
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error('Sign in error:', err);
      onSuccess();
    }
  }

  const isValid = password.length >= 6 && password === confirmPassword && !loading;

  if (checkingInvite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-offwhite/95 backdrop-blur-xl p-4">
        <Card className="relative overflow-hidden border-none shadow-2xl bg-white p-8 text-center">
          <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />
          <div className="flex flex-col items-center gap-4">
            <svg className="w-8 h-8 animate-spin text-gold" viewBox="0 0 24 24" fill="none">
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
            <p className="text-bluegray/60 text-sm">Validando convite...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-offwhite/95 backdrop-blur-xl p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="relative overflow-hidden border-none shadow-2xl bg-white p-8 text-center">
            <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />

            <div className="flex flex-col items-center gap-4 mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10 }}
              >
                <CheckCircle className="w-16 h-16 text-green-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-bluegray">Conta criada com sucesso!</h2>
              <p className="text-bluegray/60 text-sm">
                Sua senha foi definida. Redirecionando para o Studio...
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
              <ShieldCheck className="w-3 h-3" />
              <span>Acesso seguro</span>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

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
            <h2 className="text-xl font-bold text-bluegray mb-2">Bem-vindo ao Studio!</h2>
            <p className="text-bluegray/60 text-sm">
              Complete seu cadastro criando uma senha segura.
            </p>
          </div>

          {inviteInfo && (
            <div className="bg-offwhite rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-4 h-4 text-bluegray/40" />
                <span className="text-sm text-bluegray/60">E-mail</span>
              </div>
              <p className="text-sm font-semibold text-bluegray ml-7">{inviteInfo.email}</p>
              {inviteInfo.name && (
                <>
                  <div className="flex items-center gap-3 mt-3 mb-2">
                    <span className="w-4 h-4 text-bluegray/40 flex items-center justify-center text-xs">
                      👤
                    </span>
                    <span className="text-sm text-bluegray/60">Nome</span>
                  </div>
                  <p className="text-sm font-semibold text-bluegray ml-7">{inviteInfo.name}</p>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 ml-4">
                Nova Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bluegray/30 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-12 py-4 rounded-full bg-offwhite border border-black/5 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all text-sm text-bluegray"
                  placeholder="Mínimo 6 caracteres"
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

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 ml-4">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bluegray/30 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-12 py-4 rounded-full bg-offwhite border border-black/5 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all text-sm text-bluegray"
                  placeholder="Repita a senha"
                />
                {confirmPassword && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {password === confirmPassword ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="gold"
              className="w-full py-4 text-base font-semibold !mt-6"
              disabled={!isValid}
            >
              {loading ? 'Criando conta...' : 'Criar Minha Conta'}
            </Button>
          </form>

          {/* Error */}
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
