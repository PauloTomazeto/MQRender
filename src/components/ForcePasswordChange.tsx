import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Mail, Eye, EyeOff, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import { Button, Card } from './UI';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/useAuth';

interface ForcePasswordChangeProps {
  userEmail: string;
  userName: string;
  onSuccess: () => void;
}

export function ForcePasswordChange({ userEmail, userName, onSuccess }: ForcePasswordChangeProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const firstName = userName.trim().split(/\s+/)[0];
  const tempPassword = `${firstName}2026`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.toLowerCase() === tempPassword.toLowerCase()) {
      setError('A nova senha não pode ser igual à senha provisória. Escolha uma senha diferente.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);

      onSuccess();
    } catch (err: unknown) {
      let errorMessage = 'Erro ao atualizar senha. Tente novamente.';
      if (err instanceof Error) {
        if (err.message.includes('New password should be different')) {
          errorMessage = 'A nova senha deve ser diferente da senha atual. Escolha outra senha.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  const isValid = password.length >= 6 && password === confirmPassword && !loading;

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
            <h2 className="text-xl font-bold text-bluegray mb-2">Defina sua senha</h2>
            <p className="text-bluegray/60 text-sm">
              Por segurança, crie uma senha pessoal antes de continuar.
            </p>
          </div>

          <div className="bg-offwhite rounded-2xl p-4 mb-6 text-left">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-4 h-4 text-bluegray/40" />
              <span className="text-sm text-bluegray/60">E-mail</span>
            </div>
            <p className="text-sm font-semibold text-bluegray ml-7">{userEmail}</p>
            {userName && (
              <>
                <div className="flex items-center gap-3 mt-3 mb-2">
                  <span className="w-4 h-4 text-bluegray/40 flex items-center justify-center text-xs">
                    👤
                  </span>
                  <span className="text-sm text-bluegray/60">Nome</span>
                </div>
                <p className="text-sm font-semibold text-bluegray ml-7">{userName}</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
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
                  placeholder="Repita a nova senha"
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
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </Button>
          </form>

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
