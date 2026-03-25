// =============================================================================
// Render IA na Prática — Serviço de Banco de Dados (Supabase)
// Camada de persistência para todos os dados gerados na aplicação.
// =============================================================================

import { supabase } from '../lib/supabase';
import type {
  AppMode,
  AppStep,
  PostProdStyle,
  AiService,
  AiCallStatus,
} from '../lib/database.types';
import type {
  ScanResult,
  PromptConfig,
  PromptOutput,
  PostProductionResult,
  DetailScanResult,
  MoveScanResult,
  MoveConfig,
  MoveOutput,
} from '../types';

// =============================================================================
// HELPERS
// =============================================================================

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function throwOnError<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  if (!data) throw new Error('Nenhum dado retornado');
  return data;
}

// =============================================================================
// PERFIL DO USUÁRIO
// =============================================================================

export async function getProfile() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

  if (error) {
    console.error('[dbService] getProfile:', error.message);
    return null;
  }
  return data;
}

export async function updateLastLogin() {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', userId);
}

// =============================================================================
// PLANOS DE ASSINATURA (leitura pública)
// =============================================================================

export async function getSubscriptionPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly');

  if (error) {
    console.error('[dbService] getSubscriptionPlans:', error.message);
    return [];
  }
  return data;
}

export async function getUserSubscription() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('[dbService] getUserSubscription:', error.message);
    return null;
  }
  return data;
}

export async function canGenerateImage(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase.rpc('can_generate_image', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[dbService] canGenerateImage:', error.message);
    return false;
  }
  return data as boolean;
}

// =============================================================================
// PROJETOS
// =============================================================================

export async function createProject(name: string, mode: AppMode) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, name, mode })
    .select()
    .single();

  return throwOnError(data, error);
}

export async function getUserProjects() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[dbService] getUserProjects:', error.message);
    return [];
  }
  return data;
}

// =============================================================================
// SESSÕES DE GERAÇÃO
// =============================================================================

export async function createSession(mode: AppMode, projectId?: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('generation_sessions')
    .insert({
      user_id: userId,
      mode,
      project_id: projectId ?? null,
      current_step: 'select',
    })
    .select()
    .single();

  return throwOnError(data, error);
}

export async function updateSessionStep(sessionId: string, step: AppStep) {
  const { error } = await supabase
    .from('generation_sessions')
    .update({ current_step: step })
    .eq('id', sessionId);

  if (error) console.error('[dbService] updateSessionStep:', error.message);
}

export async function getSessionHistory(limit = 20) {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('generation_sessions')
    .select('*, projects(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[dbService] getSessionHistory:', error.message);
    return [];
  }
  return data;
}

// =============================================================================
// UPLOAD DE IMAGEM (Supabase Storage)
// =============================================================================

/**
 * Faz upload de uma imagem base64 para o Storage e registra na tabela images.
 * Retorna o image_id para referenciar nas outras tabelas.
 */
export async function uploadImage(
  base64: string,
  sessionId: string,
  folder: 'input-images' | 'generated-images' = 'input-images'
): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    // Converte base64 para Blob
    const [meta, data] = base64.split(',');
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] ?? 'image/jpeg';
    const ext = mime.split('/')[1] ?? 'jpg';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });

    const fileName = `${userId}/${sessionId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(folder)
      .upload(fileName, blob, { contentType: mime, upsert: false });

    if (uploadError) {
      console.error('[dbService] uploadImage storage:', uploadError.message);
      return null;
    }

    // Registra na tabela images
    const { data: imgRow, error: insertError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        session_id: sessionId,
        storage_path: `${folder}/${fileName}`,
        mime_type: mime,
        size_bytes: blob.size,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[dbService] uploadImage insert:', insertError.message);
      return null;
    }

    return imgRow.id;
  } catch (err) {
    console.error('[dbService] uploadImage error:', err);
    return null;
  }
}

/**
 * Gera uma URL assinada (temporária) para acessar uma imagem privada.
 */
export async function getSignedImageUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const [bucket, ...pathParts] = storagePath.split('/');
  const path = pathParts.join('/');

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error('[dbService] getSignedImageUrl:', error.message);
    return null;
  }
  return data.signedUrl;
}

// =============================================================================
// SCAN (Análise de Imagem — Modo Promp)
// =============================================================================

export async function saveScan(
  sessionId: string,
  scanResult: ScanResult,
  imageId?: string | null
): Promise<string | null> {
  try {
    // 1. Linha principal do scan
    const { data: scanRow, error: scanError } = await supabase
      .from('scans')
      .insert({
        session_id: sessionId,
        image_id: imageId ?? null,
        is_floor_plan: scanResult.isFloorPlan,
        typology: scanResult.typology,
        floors: scanResult.floors ?? null,
        volumes: scanResult.volumes ?? null,
        post_production_strategy: scanResult.postProductionStrategy ?? null,
        floor_plan_type: scanResult.floorPlanType ?? null,
        confidence_materials: scanResult.confidence.materials,
        confidence_camera: scanResult.confidence.camera,
        confidence_light: scanResult.confidence.light,
        confidence_context: scanResult.confidence.context,
        confidence_general: scanResult.confidence.general,
      })
      .select('id')
      .single();

    if (scanError || !scanRow) {
      console.error('[dbService] saveScan insert:', scanError?.message);
      return null;
    }

    const scanId = scanRow.id;

    // 2. Materiais
    if (scanResult.materials?.length) {
      await supabase.from('scan_materials').insert(
        scanResult.materials.map(m => ({
          scan_id: scanId,
          elemento: m.elemento,
          acabamento: m.acabamento,
          cor_ral: m.cor_ral ?? null,
          reflectancia: m.reflectancia,
          textura_fisica: m.textura_fisica ?? null,
          estado_conservacao: m.estado_conservacao ?? null,
          indice_rugosidade_estimado: m.indice_rugosidade_estimado ?? null,
          notas_textura: m.notas_textura ?? null,
        }))
      );
    }

    // 3. Aberturas
    if (scanResult.openings?.length) {
      await supabase.from('scan_openings').insert(
        scanResult.openings.map(o => ({
          scan_id: scanId,
          tipo: o.tipo,
          proporcao: o.proporcao ?? null,
          posicao_fachada: o.posicao_fachada ?? null,
          ritmo: o.ritmo ?? null,
          perfil_visivel: o.perfil_visivel ?? null,
          vidro_tipo: o.vidro_tipo ?? null,
          sistema_brise: o.sistema_brise ?? null,
          recuo_em_relacao_fachada: o.recuo_em_relacao_fachada ?? null,
        }))
      );
    }

    // 4. Câmera
    await supabase.from('scan_camera').insert({
      scan_id: scanId,
      height_m: scanResult.camera.height_m,
      distance_m: scanResult.camera.distance_m,
      focal_apparent: scanResult.camera.focal_apparent,
      distortion: scanResult.camera.distortion ?? null,
      horizontal_angle: scanResult.camera.horizontal_angle ?? null,
      vertical_tilt: scanResult.camera.vertical_tilt ?? null,
      aspect: scanResult.camera.aspect ?? null,
      movement: scanResult.camera.movement ?? null,
      is_low_angle: scanResult.camera.isLowAngle ?? null,
    });

    // 5. Iluminação
    await supabase.from('scan_light').insert({
      scan_id: scanId,
      period: scanResult.light.period,
      temp_k: scanResult.light.temp_k,
      azimuthal_direction: scanResult.light.azimuthal_direction ?? null,
      elevation_angle: scanResult.light.elevation_angle ?? null,
      quality: scanResult.light.quality,
      ratio: scanResult.light.ratio ?? null,
      shadows: scanResult.light.shadows ?? null,
      shadow_direction: scanResult.light.shadow_direction ?? null,
      artificial_sources: scanResult.light.artificial_sources ?? null,
      ambient_temp: scanResult.light.ambient_temp ?? null,
    });

    // 6. Light points
    if (scanResult.lightPoints?.length) {
      await supabase.from('scan_light_points').insert(
        scanResult.lightPoints.map(lp => ({
          id: lp.id,
          scan_id: scanId,
          location: lp.location,
          type: lp.type,
          intensity_initial: lp.intensity_initial,
          temp_k_initial: lp.temp_k_initial,
        }))
      );
    }

    // 7. Contexto
    if (scanResult.context) {
      await supabase.from('scan_context').insert({
        scan_id: scanId,
        topography: scanResult.context.topography ?? null,
        vegetation_pct: scanResult.context.vegetation_pct ?? null,
        species: scanResult.context.species ?? null,
        piso_externo: scanResult.context.piso_externo ?? null,
        vehicles: scanResult.context.vehicles ?? null,
        infrastructure: scanResult.context.infrastructure ?? null,
        neighbors: scanResult.context.neighbors ?? null,
        horizon: scanResult.context.horizon ?? null,
        sky_pct: scanResult.context.sky_pct ?? null,
        image_quality: scanResult.context.image_quality ?? null,
      });
    }

    // 8. Ambientes (planta baixa)
    if (scanResult.environments?.length) {
      await supabase.from('floor_plan_environments').insert(
        scanResult.environments.map(e => ({
          id: e.id,
          scan_id: scanId,
          nome: e.nome,
          area_m2: e.area_m2 ?? null,
          tipo: e.tipo ?? null,
          posicao: e.posicao ?? null,
        }))
      );
    }

    return scanId;
  } catch (err) {
    console.error('[dbService] saveScan error:', err);
    return null;
  }
}

// =============================================================================
// PROMPT CONFIG
// =============================================================================

export async function savePromptConfig(
  sessionId: string,
  config: PromptConfig
): Promise<string | null> {
  try {
    const { data: row, error } = await supabase
      .from('prompt_configs')
      .insert({
        session_id: sessionId,
        mode: config.mode,
        cinematic_mode: config.cinematicMode ?? null,
        completion: config.completion ?? null,
        angle: config.angle ?? null,
        light_temp: config.lightTemp ?? null,
        style: config.style ?? null,
        external_context: config.externalContext ?? null,
        is_building: config.isBuilding ?? false,
        floor_level: config.floorLevel ?? 0,
        overall_temperature: config.overallTemperature,
        day_night: config.dayNight,
        time: config.time,
        environment: config.environment,
        overall_intensity: config.overallIntensity,
        accessory_control: config.accessoryControl,
        material_fidelity: config.materialFidelity,
        season: config.season,
      })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[dbService] savePromptConfig:', error?.message);
      return null;
    }

    const configId = row.id;

    // Light point configs
    if (config.lightPoints?.length) {
      await supabase.from('light_point_configs').insert(
        config.lightPoints.map(lp => ({
          id: lp.id,
          prompt_config_id: configId,
          enabled: lp.enabled,
          type: lp.type,
          intensity: lp.intensity,
          temperature: lp.temperature,
          location: lp.location,
        }))
      );
    }

    // Mirror config
    if (config.mirror) {
      await supabase.from('mirror_configs').insert({
        prompt_config_id: configId,
        enabled: config.mirror.enabled,
        location: config.mirror.location,
        reflection_description: config.mirror.reflectionDescription ?? null,
      });
    }

    return configId;
  } catch (err) {
    console.error('[dbService] savePromptConfig error:', err);
    return null;
  }
}

// =============================================================================
// PROMPT OUTPUT
// =============================================================================

export async function savePromptOutput(
  sessionId: string,
  output: PromptOutput
): Promise<string | null> {
  try {
    const { data: row, error } = await supabase
      .from('prompt_outputs')
      .insert({
        session_id: sessionId,
        positive: output.positive,
        negative: output.negative,
        score: output.score,
      })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[dbService] savePromptOutput:', error?.message);
      return null;
    }

    const outputId = row.id;

    // Blocos (se modo blocks)
    if (output.blocks) {
      const blocks = Object.entries(output.blocks).map(([key, content], i) => ({
        prompt_output_id: outputId,
        block_number: i + 1,
        content: content as string,
      }));
      await supabase.from('prompt_blocks').insert(blocks);
    }

    return outputId;
  } catch (err) {
    console.error('[dbService] savePromptOutput error:', err);
    return null;
  }
}

// =============================================================================
// GERAÇÃO DE IMAGEM
// =============================================================================

export async function createImageGeneration(
  sessionId: string,
  promptOutputId: string | null,
  aspectRatio: string,
  resolution: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('image_generations')
    .insert({
      session_id: sessionId,
      prompt_output_id: promptOutputId,
      aspect_ratio: aspectRatio,
      resolution,
      status: 'generating',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[dbService] createImageGeneration:', error.message);
    return null;
  }
  return data.id;
}

export async function completeImageGeneration(generationId: string, resultImageId: string) {
  await supabase
    .from('image_generations')
    .update({
      status: 'completed',
      result_image_id: resultImageId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', generationId);
}

export async function failImageGeneration(generationId: string, errorMessage: string) {
  await supabase
    .from('image_generations')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', generationId);
}

// =============================================================================
// PÓS-PRODUÇÃO
// =============================================================================

export async function savePostProduction(
  imageGenerationId: string,
  result: PostProductionResult,
  style: PostProdStyle,
  originalImageId?: string | null,
  generatedImageId?: string | null
): Promise<string | null> {
  try {
    const { data: row, error } = await supabase
      .from('post_production_analyses')
      .insert({
        image_generation_id: imageGenerationId,
        original_image_id: originalImageId ?? null,
        generated_image_id: generatedImageId ?? null,
        style,
        cgi_issues: result.cgiIssues,
        post_production_prompt: result.postProductionPrompt,
      })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[dbService] savePostProduction:', error?.message);
      return null;
    }

    if (result.pipeline?.length) {
      await supabase.from('post_production_pipeline').insert(
        result.pipeline.map((p, i) => ({
          post_production_analysis_id: row.id,
          map_name: p.map,
          value: p.value,
          description: p.description,
          sort_order: i,
        }))
      );
    }

    return row.id;
  } catch (err) {
    console.error('[dbService] savePostProduction error:', err);
    return null;
  }
}

// =============================================================================
// DETAIL SCAN
// =============================================================================

export async function saveDetailScan(
  sessionId: string,
  result: DetailScanResult,
  imageId?: string | null
): Promise<string | null> {
  try {
    const { data: row, error } = await supabase
      .from('detail_scans')
      .insert({
        session_id: sessionId,
        image_id: imageId ?? null,
        overall_composition: result.overallComposition,
      })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[dbService] saveDetailScan:', error?.message);
      return null;
    }

    if (result.closes?.length) {
      await supabase.from('detail_closes').insert(
        result.closes.map(c => ({
          id: c.id,
          detail_scan_id: row.id,
          title: c.title,
          description: c.description,
          location: c.location,
          prompt: c.prompt,
        }))
      );
    }

    return row.id;
  } catch (err) {
    console.error('[dbService] saveDetailScan error:', err);
    return null;
  }
}

// =============================================================================
// MOVE SCAN
// =============================================================================

export async function saveMoveScan(
  sessionId: string,
  result: MoveScanResult,
  imageId?: string | null
): Promise<string | null> {
  try {
    const { data: row, error } = await supabase
      .from('move_scans')
      .insert({
        session_id: sessionId,
        image_id: imageId ?? null,
        resolution: result.technicalAnalysis.resolution ?? null,
        has_text: result.technicalAnalysis.hasText ?? null,
        visual_style: result.technicalAnalysis.visualStyle ?? null,
        aspect_ratio: result.technicalAnalysis.aspectRatio ?? null,
        subject: result.cinematicAnalysis.subject ?? null,
        camera_shot: result.cinematicAnalysis.cameraShot ?? null,
        lighting: result.cinematicAnalysis.lighting ?? null,
        color_palette: result.cinematicAnalysis.colorPalette ?? null,
        depth_of_field: result.cinematicAnalysis.depthOfField ?? null,
        static_elements: result.mobilityDiagnosis.staticElements ?? null,
        dynamic_elements: result.mobilityDiagnosis.dynamicElements ?? null,
        parallax_potential: result.mobilityDiagnosis.parallaxPotential ?? null,
        restrictions: result.mobilityDiagnosis.restrictions ?? null,
      })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[dbService] saveMoveScan:', error?.message);
      return null;
    }

    if (result.suggestedMovements?.length) {
      await supabase.from('suggested_movements').insert(
        result.suggestedMovements.map(m => ({
          id: m.id,
          move_scan_id: row.id,
          name: m.name,
          description: m.description,
          intensity: m.intensity as 'Sutil' | 'Suave' | 'Dinâmico' | 'Épico',
        }))
      );
    }

    return row.id;
  } catch (err) {
    console.error('[dbService] saveMoveScan error:', err);
    return null;
  }
}

// =============================================================================
// MOVE OUTPUT
// =============================================================================

export async function saveMoveOutput(
  sessionId: string,
  config: MoveConfig,
  output: MoveOutput,
  endImageId?: string | null
): Promise<string | null> {
  try {
    // Salva configuração
    await supabase.from('move_configs').insert({
      session_id: sessionId,
      duration: config.duration,
      is_time_lapse: config.isTimeLapse,
      is_speed_ramp: config.isSpeedRamp,
      movement_type: config.movementType,
      scene_animation: config.sceneAnimation,
      is_transition: config.isTransition,
      end_image_id: endImageId ?? null,
    });

    // Salva output
    const { data: row, error } = await supabase
      .from('move_outputs')
      .insert({ session_id: sessionId })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[dbService] saveMoveOutput:', error?.message);
      return null;
    }

    if (output.options?.length) {
      await supabase.from('move_output_options').insert(
        output.options.map(o => ({
          id: o.id,
          move_output_id: row.id,
          name: o.name,
          prompt: o.prompt,
          simulated_equipment: o.simulatedEquipment,
          intensity: o.intensity,
        }))
      );
    }

    return row.id;
  } catch (err) {
    console.error('[dbService] saveMoveOutput error:', err);
    return null;
  }
}

// =============================================================================
// LOGGING DE CHAMADAS À API (Gemini)
// =============================================================================

export async function logAiCall(params: {
  sessionId?: string;
  service: AiService;
  status: AiCallStatus;
  responseTimeMs?: number;
  errorMessage?: string;
}) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await supabase.from('ai_call_logs').insert({
    user_id: userId,
    session_id: params.sessionId ?? null,
    service: params.service,
    status: params.status,
    response_time_ms: params.responseTimeMs ?? null,
    error_message: params.errorMessage ?? null,
  });
}

// =============================================================================
// HISTÓRICO COMPLETO DA SESSÃO
// =============================================================================

export async function getSessionSummary(sessionId: string) {
  const { data, error } = await supabase.rpc('get_session_summary', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[dbService] getSessionSummary:', error.message);
    return null;
  }
  return data;
}

// =============================================================================
// SISTEMA DE CRÉDITOS
// =============================================================================

export async function getUserCreditStatus() {
  // re-export wrapper — already in creditService, but useful from dbService too
  const { getUserCreditStatus: getStatus } = await import('./creditService');
  return getStatus();
}

export async function addAddonCredits(): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'Usuário não autenticado' };
    const { error } = await supabase.rpc('add_addon_credits', { p_user_id: userId });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =============================================================================
// USER INVITES
// =============================================================================

export interface PendingInvite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
}

export async function getPendingInviteByEmail(email: string): Promise<PendingInvite | null> {
  const { data, error } = await supabase
    .from('user_invites')
    .select('id, email, token, expires_at')
    .eq('email', email.toLowerCase())
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data as PendingInvite;
}

export async function getPendingInviteByToken(token: string): Promise<PendingInvite | null> {
  const { data, error } = await supabase
    .from('user_invites')
    .select('id, email, token, expires_at')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data as PendingInvite;
}
