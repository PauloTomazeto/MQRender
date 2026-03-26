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
    // Initialize Supabase admin client (service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify caller is authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if caller is admin — via JWT app_metadata (primary) or profiles table (fallback)
    const jwtRole = caller.app_metadata?.role ?? caller.user_metadata?.role
    let isAdmin = jwtRole === 'admin'

    if (!isAdmin) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', caller.id)
        .single()
      isAdmin = callerProfile?.role === 'admin'
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const { email, name, plan, role, addon_credits } = await req.json()

    if (!email || !name || !plan) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, name, plan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Generate temporary password: FirstName + "2026"
    const firstName = name.trim().split(/\s+/)[0]
    const tempPassword = `${firstName}2026`

    // Step 1: Create user with temporary password
    // created_by_admin=true signals the DB trigger to set must_change_password=true
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name,
        role: role || 'user',
        subscription_tier: plan,
        created_by_admin: true,
      },
    })

    if (createError) {
      console.error('createUser error:', createError)
      return new Response(JSON.stringify({ error: `Erro ao criar usuário: ${createError.message}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const newUserId = userData.user.id

    // Step 2: Wait for trigger to fire then upsert profile as safety net
    await new Promise(resolve => setTimeout(resolve, 500))

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        email,
        name,
        role: role || 'user',
        subscription_tier: plan,
        status: 'active',
        must_change_password: true,
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
    }

    // Step 3: Get the plan_id for the selected plan
    const PLAN_CREDITS: Record<string, number> = { basic: 1000, premium: 2000, enterprise: 5000 }

    const { data: planData, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, credits_monthly')
      .ilike('name', plan)
      .single()

    if (planError || !planData) {
      console.error('Plan query error:', planError, '| plan name tried:', plan)
      return new Response(JSON.stringify({ error: `Plano "${plan}" não encontrado no banco. Verifique se o plano está cadastrado em subscription_plans. DB: ${planError?.message ?? 'no rows'}` }), {
        status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    const planCredits = planData.credits_monthly ?? PLAN_CREDITS[plan] ?? 1000

    // Step 4: Create subscription
    const now = new Date()
    const cycleEnd = new Date(now)
    cycleEnd.setMonth(cycleEnd.getMonth() + 1)

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: newUserId,
        plan_id: planData.id,
        status: 'active',
        billing_cycle_start: now.toISOString(),
        billing_cycle_end: cycleEnd.toISOString(),
        auto_renew: true,
      })

    if (subError) {
      console.error('Subscription insert error:', subError)
    }

    // Step 5: Add addon credits if requested
    if (addon_credits && addon_credits > 0) {
      const packCount = Math.floor(addon_credits / 1000)
      for (let i = 0; i < packCount; i++) {
        const { error: addonError } = await supabaseAdmin.rpc('add_addon_credits', {
          p_user_id: newUserId,
        })
        if (addonError) {
          console.error('Addon credits error:', addonError)
        }
      }
    }

    // Step 6: Log admin action
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        admin_id: caller.id,
        action: 'create_user_with_temp_password',
        target_user_id: newUserId,
        details: {
          email,
          name,
          plan,
          role: role || 'user',
          addon_credits: addon_credits || 0,
          plan_credits: planCredits,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        temp_password: tempPassword,
        message: `Usuário ${email} criado com sucesso. Senha provisória: ${tempPassword}`,
        credits_allocated: {
          plan: planCredits,
          addon: addon_credits || 0,
          total: planCredits + (addon_credits || 0),
        },
      }),
      { status: 200, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('invite-user error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    )
  }
})
