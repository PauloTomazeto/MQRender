import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    '[Render IA] Variáveis de ambiente ausentes: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.'
  );
}

// O cliente não é tipado com Database aqui para evitar conflito com as versões
// do @supabase/supabase-js. Os tipos são aplicados diretamente nos serviços via
// .returns<T>() ou type assertions quando necessário.
export const supabase = createClient(url, key);
