import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://renderianapratica.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller is authenticated using a normal client with the auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('No auth header present');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase admin client (service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Use service role client to validate the user JWT - this is the correct way in Edge Functions
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) {
      console.error('[delete-user] JWT validation failed:', {
        error: authError?.message,
        hint: 'Token must be a valid user JWT with sub claim',
        tokenLength: token.length,
      })
      return new Response(
        JSON.stringify({
          error: authError?.message || 'Unauthorized',
          details: 'Invalid JWT token. Ensure you are logged in as admin.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller is admin
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    const isAdmin = callerProfile?.role === 'admin' || caller.app_metadata?.role === 'admin'
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Prevent admin from deleting themselves
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'Não é possível excluir sua própria conta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get target user info for logging (while profile still exists)
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, name')
      .eq('id', user_id)
      .single()

    // Log BEFORE deleting — admin_logs.target_user_id is a FK to profiles(id)
    // which gets cascade-deleted when auth.users is deleted. Inserting before
    // deletion ensures the FK constraint is satisfied.
    const { error: logError } = await supabaseAdmin
      .from('admin_logs')
      .insert({
        admin_id: caller.id,
        action: 'delete_user',
        target_user_id: user_id,
        details: {
          email: targetProfile?.email,
          name: targetProfile?.name,
        },
      })

    if (logError) {
      console.error('admin_logs insert error:', logError.message)
    }

    // Delete from auth.users — cascades to profiles and all related data
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(
      JSON.stringify({ success: true, message: `Usuário excluído com sucesso` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('delete-user error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
