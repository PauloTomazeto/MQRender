import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import { Card, Button } from './UI';
import { supabase } from '../lib/supabase';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash — detect the session
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });
    // Also check current session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      // Redirect to home after 3 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao definir senha.');
    } finally {
      setLoading(false);
    }
  };

  const isValid = password.length >= 6 && password === confirm;

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
            {done ? (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold text-bluegray mb-2">Senha definida!</h2>
                <p className="text-bluegray/50 text-sm">Redirecionando para o Studio...</p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-bluegray mb-2">Defina sua senha</h2>
                <p className="text-bluegray/50 text-sm">Crie uma senha para acessar o Studio.</p>
              </>
            )}
          </div>

          {!done && (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full pl-10 pr-12 py-4 rounded-full bg-offwhite border border-black/5 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all text-sm text-bluegray"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
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

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 ml-4">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bluegray/30 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-6 py-4 rounded-full bg-offwhite border border-black/5 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all text-sm text-bluegray"
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>

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
                disabled={!isValid || loading || !sessionReady}
              >
                {loading ? 'Salvando...' : 'Definir Senha e Acessar'}
              </Button>

              {!sessionReady && (
                <p className="text-center text-xs text-bluegray/40">Validando link de acesso...</p>
              )}
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-black/5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
            <ShieldCheck className="w-3 h-3" />
            <span>TOOL-SEC v1.0 Validated</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
