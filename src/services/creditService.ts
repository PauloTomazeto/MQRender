// Credit Service — manages user credits for KIE.ai image generation
// Credit system: Basic=1000/mo, Premium=2000/mo. Credits reset monthly, don't accumulate.
// Consumption: 120% of KIE.ai base cost per model/resolution.

import { supabase } from '../lib/supabase';

export interface CreditStatus {
  credits_plan: number;
  credits_addon: number;
  credits_used: number;
  credits_available: number;
  credits_reset_at: string | null;
}

/** Internal type for the profile credit columns returned from the database */
interface ProfileCreditRow {
  credits_plan: number;
  credits_addon: number;
  credits_used: number;
  credits_reset_at: string | null;
}

/** Returns the credit status for the given user (or the current authenticated user). */
export async function getUserCreditStatus(userId?: string): Promise<CreditStatus> {
  let uid = userId;
  if (!uid) {
    const { data: authData } = await supabase.auth.getUser();
    uid = authData?.user?.id;
  }
  if (!uid) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('profiles')
    .select('credits_plan, credits_addon, credits_used, credits_reset_at')
    .eq('id', uid)
    .single();

  if (error || !data) throw new Error(`getUserCreditStatus: ${error?.message}`);

  const p = data as ProfileCreditRow;
  return {
    credits_plan: p.credits_plan ?? 0,
    credits_addon: p.credits_addon ?? 0,
    credits_used: p.credits_used ?? 0,
    credits_available: (p.credits_plan ?? 0) + (p.credits_addon ?? 0) - (p.credits_used ?? 0),
    credits_reset_at: p.credits_reset_at ?? null,
  };
}

/** Returns true if the current user has enough credits to cover `cost`. */
export async function checkCredits(cost: number): Promise<boolean> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  const { data, error } = await supabase.rpc('check_credits', {
    p_user_id: userId,
    p_cost: cost,
  });
  if (error) throw new Error(`check_credits: ${error.message}`);

  return data as boolean;
}

/**
 * Consumes credits for the given model/resolution combination.
 * Throws a user-friendly error if the RPC reports insufficient credits.
 * Returns the number of credits consumed.
 */
export async function consumeCredits(model: string, resolution: string): Promise<number> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  const { data, error } = await supabase.rpc('consume_credits', {
    p_user_id: userId,
    p_model: model,
    p_resolution: resolution,
  });

  if (error) {
    // Surface any credit-related RPC error as a user-facing message.
    throw new Error('Créditos insuficientes. Considere adquirir um pacote adicional.');
  }

  return data as number;
}

/** Adds an addon credit pack to the current user's account. */
export async function addAddonCredits(): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  const { error } = await supabase.rpc('add_addon_credits', { p_user_id: userId });
  if (error) throw new Error(`add_addon_credits: ${error.message}`);
}

/**
 * Returns the credit cost (our_cost) for the given model/resolution pair.
 * Falls back to the model-level row (resolution IS NULL) when no resolution-specific
 * row exists.
 */
export async function getCreditCost(model: string, resolution: string): Promise<number> {
  const { data, error } = await supabase
    .from('credit_config')
    .select('our_cost')
    .eq('model', model)
    .or(`resolution.eq.${resolution},resolution.is.null`)
    .eq('is_active', true)
    .order('resolution', { nullsFirst: false })
    .limit(1)
    .single();

  if (error) throw new Error(`getCreditCost: ${error.message}`);

  return (data as { our_cost: number }).our_cost;
}

/** Admin-only: manually adjust the credit balance of any user. */
export async function adminAdjustCredits(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_adjust_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
  });
  if (error) throw new Error(`admin_adjust_credits: ${error.message}`);
}
