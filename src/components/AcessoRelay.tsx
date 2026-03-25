import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import logoUrl from '../assets/logo.png';

/**
 * AcessoRelay — receives a branded access link shared by admin and redirects
 * the user to the Supabase recovery URL.
 *
 * URL format: /acesso?t=<base64url(supabaseRecoveryUrl)>
 */
export function AcessoRelay() {
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('t');

    if (!encoded) {
      setErrorMsg('Link de acesso inválido ou expirado.');
      setStatus('error');
      return;
    }

    try {
      const targetUrl = atob(encoded);

      // Validate URL using URL constructor for stricter validation
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        throw new Error('invalid url');
      }

      // Must be HTTPS protocol
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('invalid url');
      }

      setStatus('redirecting');
      // Small delay so user sees the branded screen before redirect
      setTimeout(() => {
        window.location.href = parsedUrl.href;
      }, 1200);
    } catch {
      setErrorMsg('Link de acesso inválido ou corrompido.');
      setStatus('error');
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-offwhite/95 backdrop-blur-xl p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="relative overflow-hidden border-none shadow-2xl bg-white p-10 rounded-3xl">
          <div className="absolute top-0 left-0 w-full h-1 gold-gradient" />

          <img
            src={logoUrl}
            alt="Render IA na Prática"
            className="h-16 w-auto object-contain mx-auto mb-8"
          />

          {status === 'loading' || status === 'redirecting' ? (
            <>
              <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-base font-bold text-bluegray mb-2">
                {status === 'loading' ? 'Validando acesso...' : 'Redirecionando...'}
              </h2>
              <p className="text-bluegray/50 text-sm">
                Você será direcionado para configurar sua senha.
              </p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-base font-bold text-bluegray mb-2">Link inválido</h2>
              <p className="text-bluegray/50 text-sm">{errorMsg}</p>
              <p className="text-bluegray/40 text-xs mt-3">
                Solicite um novo link ao administrador.
              </p>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-black/5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
            <ShieldCheck className="w-3 h-3" />
            <span>Render IA na Prática</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
