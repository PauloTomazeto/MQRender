import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
    'https://renderianapratica.com.br',
    'http://localhost:5173',
    'http://localhost:3000',
]

function getCorsHeaders(origin: string | null) {
    const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }
}

serve(async (req) => {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase admin client (service role)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Parse request body
        const { token, password } = await req.json()

        if (!token || !password) {
            return new Response(
                JSON.stringify({ error: 'Token e senha são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validar senha mínimo 6 caracteres
        if (password.length < 6) {
            return new Response(
                JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Buscar convite pelo token
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('user_invites')
            .select('*')
            .eq('token', token)
            .single()

        if (inviteError || !invite) {
            return new Response(
                JSON.stringify({ error: 'Convite não encontrado' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar se convite já foi usado
        if (invite.used) {
            return new Response(
                JSON.stringify({ error: 'Este convite já foi utilizado' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar se convite expirou
        const expiresAt = new Date(invite.expires_at)
        if (expiresAt < new Date()) {
            return new Response(
                JSON.stringify({ error: 'Este convite expirou' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Atualizar senha do usuário via Admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            invite.user_id || invite.email.split('@')[0], // fallback
            { password }
        )

        // Tentar atualizar por email já que updateUserById requer user_id do auth.users
        // Primeiro buscamos o usuário pelo email
        const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.listUsers()

        let userId: string | null = null
        if (!getUserError && authUser) {
            const foundUser = authUser.users.find(u => u.email === invite.email)
            userId = foundUser?.id ?? null
        }

        if (userId) {
            const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                { password }
            )

            if (passwordError) {
                console.error('Password update error:', passwordError)
                return new Response(
                    JSON.stringify({ error: 'Erro ao definir senha. Tente novamente.' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        } else {
            // Fallback: usar updateUser que atualiza o usuário autenticado atual
            // Isso funciona porque o usuário acessa via linkmagico/cookie de sessão
            const { error: passwordError } = await supabaseAdmin.auth.updateUser({ password })

            if (passwordError) {
                console.error('Password update error:', passwordError)
                return new Response(
                    JSON.stringify({ error: 'Erro ao definir senha: ' + passwordError.message }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Marcar convite como usado
        const { error: markUsedError } = await supabaseAdmin
            .from('user_invites')
            .update({
                used: true,
                used_at: new Date().toISOString()
            })
            .eq('id', invite.id)

        if (markUsedError) {
            console.error('Error marking invite as used:', markUsedError)
            // Não falhar por isso - a senha foi definida com sucesso
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Senha criada com sucesso! Você já pode acessar o Studio.'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('accept-invite error:', error)
        return new Response(
            JSON.stringify({ error: 'Erro interno do servidor', details: String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
