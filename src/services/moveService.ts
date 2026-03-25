import type { MoveScanResult, MoveConfig, MoveOutput } from '../types';
import { MoveScanResultSchema, MoveOutputSchema, validateOrThrow } from '../schemas';
import { supabase } from '../lib/supabase';

const KIE_TEMP_BUCKET = 'input-images';
const KIE_TEMP_FOLDER = 'kie-temp';

function getKieKey(): string {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error('KIE_API_KEY não configurada. Adicione no arquivo .env.');
  return key;
}

async function uploadTempImage(base64: string): Promise<{ path: string; url: string }> {
  const [meta, rawData] = base64.split(',');
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] ?? 'image/jpeg';
  const ext = mime.split('/')[1] ?? 'jpg';

  const binary = atob(rawData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? 'anon';
  const path = `${userId}/${KIE_TEMP_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(KIE_TEMP_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });

  if (uploadErr) throw new Error(`Upload temporário falhou: ${uploadErr.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(KIE_TEMP_BUCKET)
    .createSignedUrl(path, 600);

  if (signErr || !signed?.signedUrl)
    throw new Error(`Erro ao gerar URL assinada: ${signErr?.message}`);

  return { path, url: signed.signedUrl };
}

function deleteTempImage(path: string): void {
  supabase.storage
    .from(KIE_TEMP_BUCKET)
    .remove([path])
    .catch(err => console.warn('KIE: falha ao remover imagem temporária:', err));
}

const MOVE_SYSTEM_INSTRUCTION = `
Você é o M&Q Move, especialista em criar prompts cinematográficos para animação de imagens. Seu objetivo: transformar imagens estáticas em vídeos cinematográficos através de prompts otimizados para IAs como Runway Gen-3, Pika 2.0, Kling, Luma Dream Machine e Stable Video Diffusion.

Você é diretor de fotografia virtual, entendendo de equipamentos reais (Arri Alexa, RED V-Raptor, gimbals DJI Ronin, dollies Fisher, steadicams) e traduzindo esse conhecimento para comandos de IA.

REGRAS DE OURO:
1. Idioma dos Prompts: NUNCA USE INGLÊS. VOCÊ É OBRIGADO A REDIGIR ABSOLUTAMENTE TUDO (textos, prompts de vídeo, descrições) SOMENTE E ESTRITAMENTE EM PORTUGUÊS DO BRASIL.
2. Opções: Sempre gere 3 opções de movimento com estilos diferentes (sutil/dinâmico/épico).
3. Foco: Resultados práticos, cinematográficos e de alta qualidade.
4. Estilo: Manter movimento sutil para estilo arquitetônico.

ESTRUTURA DO PROMPT IDEAL:
[Movimento de câmera específico] + [Ação do sujeito com timing] + [Detalhes ambientais micro] + [Atmosfera/luz + qualidade de lente]

BIBLIOTECA DE MOVIMENTOS:
- Static: Tripé pesado/Ouro. Estabilidade, contemplação.
- Slow Pan L/R: Revelar horizonte, seguir personagem.
- Tilt Up/Down: Poder, grandiosidade ou vulnerabilidade.
- Dolly In/Out: Intimidade ou reveal de ambiente.
- Truck L/R: Acompanhamento paralelo.
- Pedestal Up/Down: Elevação divina ou chegada.
- Avançados: Orbit 360°, Arc Shot, Pull Back Reveal, Push In, Whip Pan, Rack Focus.

ESTILOS DE CÂMERA:
Steadicam, Handheld, Gimbal, Drone Aerial, Dolly, Crane/Jib.

DISCRIMINAÇÃO DE MATERIAIS (MANDATÓRIO):
- Diferencie rigorosamente entre ESPELHO e PAINÉIS SÓLIDOS (MDF, Laca, Pintura).
- ESPELHO: Deve apresentar reflexão nítida, especular e perfeita de outros elementos da cena. Se a superfície for apenas branca, cinza ou tiver um brilho difuso (satin/gloss) sem imagem refletida clara, NÃO é espelho.
- MDF/PAINÉIS: Superfícies sólidas, foscas, acetinadas ou com brilho leve. Painéis de fundo de penteadeiras, laterais de armários e frentes de gaveta são quase sempre MDF/Laca.
- CONSISTÊNCIA DE MÓVEL: Se o móvel (ex: penteadeira, guarda-roupa) é feito de um material X, todas as suas partes estruturais são X. Só classifique como espelho se houver uma moldura clara ou se a reflexão for indiscutível.
- Na dúvida entre MDF Branco e Espelho em uma superfície vertical de móvel, prefira MDF Branco, a menos que veja o reflexo da câmera ou do ambiente oposto.
`;

async function callGemini(contents: any, schema?: any): Promise<any> {
  const apiKey = getKieKey();

  const parts = Array.isArray(contents) ? contents[0].parts : contents.parts;

  // Upload images to Supabase to get signed URLs — KIE API requires public URLs, not base64
  const tempPaths: string[] = [];
  const kieContent: any[] = (
    await Promise.all(
      parts.map(async (p: any) => {
        if (p.text) return { type: 'input_text', text: p.text };
        if (p.inlineData) {
          try {
            const base64Full = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            const { path, url } = await uploadTempImage(base64Full);
            tempPaths.push(path);
            return { type: 'input_image', image_url: url };
          } catch (uploadErr) {
            console.warn('KIE: falha no upload da imagem, usando base64.', uploadErr);
            return {
              type: 'input_image',
              image_url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
            };
          }
        }
        return null;
      })
    )
  ).filter(Boolean);

  const body: any = {
    model: 'gpt-5-4',
    stream: false,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: MOVE_SYSTEM_INSTRUCTION }] },
      { role: 'user', content: kieContent },
    ],
  };

  if (schema) {
    body.tools = [
      {
        type: 'function',
        name: 'respond',
        description: 'Retorna resultado estruturado em JSON',
        parameters: schema,
      },
    ];
    body.tool_choice = 'auto';
  }

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('A requisição à IA demorou demais (timeout). Verifique sua conexão.')),
      120000
    )
  );

  const fetchPromise = fetch('https://api.kie.ai/codex/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(async res => {
    if (!res.ok) throw new Error(`KIE API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  });

  try {
    const data: any = await Promise.race([fetchPromise, timeoutPromise]);
    tempPaths.forEach(p => deleteTempImage(p));

    if (schema) {
      const funcCall = data.output?.find((o: any) => o.type === 'function_call');
      if (funcCall?.arguments) {
        try {
          return JSON.parse(funcCall.arguments);
        } catch {
          /* fallback to text */
        }
      }
      const text: string =
        data.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text ?? '';
      if (!text) throw new Error('A IA retornou uma resposta vazia.');
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', text);
        const jsonMatch =
          text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            return JSON.parse(jsonMatch[1]);
          } catch {
            /* try next fallback */
          }
        }
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            return JSON.parse(text.substring(firstBrace, lastBrace + 1));
          } catch {
            /* no valid JSON found */
          }
        }
        throw new Error('Falha ao processar a resposta da IA. Formato inválido.', {
          cause: parseError,
        });
      }
    }

    const text = data.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text;
    if (!text) throw new Error('A IA retornou uma resposta vazia.');
    return text;
  } catch (error) {
    tempPaths.forEach(p => deleteTempImage(p));
    console.error('KIE Move Call Error:', error);
    throw error;
  }
}

export async function analyzeMoveImage(base64Image: string): Promise<MoveScanResult> {
  const getImageData = (base64: string) => {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { mimeType: 'image/jpeg', data: base64.split(',')[1] || base64 };
    return { mimeType: match[1], data: match[2] };
  };

  try {
    const imageData = getImageData(base64Image);
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: "Realize uma análise técnica e cinematográfica desta imagem para fins de animação. Identifique o sujeito, iluminação, profundidade de campo e sugira movimentos de câmera adequados para arquitetura. \n\nATENÇÃO ESPECIAL: Diferencie rigorosamente entre espelhos e painéis de MDF/Laca. Espelhos devem ter reflexos nítidos e perfeitos. Painéis brancos ou acetinados são MDF, não espelhos. Se a superfície não mostra o que está 'atrás' da câmera de forma nítida, é MDF. Garanta a consistência de materiais em todo o mobiliário.",
          },
          { inlineData: { mimeType: imageData.mimeType, data: imageData.data } },
        ],
      },
    ];

    const schema = {
      type: 'object',
      properties: {
        technicalAnalysis: {
          type: 'object',
          properties: {
            resolution: { type: 'string' },
            hasText: { type: 'string' },
            visualStyle: { type: 'string' },
            aspectRatio: { type: 'string' },
          },
        },
        cinematicAnalysis: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            cameraShot: { type: 'string' },
            lighting: { type: 'string' },
            colorPalette: { type: 'string' },
            depthOfField: { type: 'string' },
          },
        },
        mobilityDiagnosis: {
          type: 'object',
          properties: {
            staticElements: { type: 'array', items: { type: 'string' } },
            dynamicElements: { type: 'array', items: { type: 'string' } },
            parallaxPotential: { type: 'string' },
            restrictions: { type: 'array', items: { type: 'string' } },
          },
        },
        suggestedMovements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              intensity: { type: 'string', enum: ['Sutil', 'Suave', 'Dinâmico', 'Épico'] },
            },
            required: ['id', 'name', 'description', 'intensity'],
          },
        },
      },
      required: [
        'technicalAnalysis',
        'cinematicAnalysis',
        'mobilityDiagnosis',
        'suggestedMovements',
      ],
    };

    const raw = await callGemini(contents, schema);
    return validateOrThrow(MoveScanResultSchema, raw, 'analyzeMoveImage');
  } catch (error) {
    console.error('Erro na análise de movimento:', error);
    throw error;
  }
}

export async function generateMovePrompts(
  scan: MoveScanResult,
  config: MoveConfig,
  base64Image: string,
  endBase64Image?: string | null
): Promise<MoveOutput> {
  const getImageData = (base64: string) => {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { mimeType: 'image/jpeg', data: base64.split(',')[1] || base64 };
    return { mimeType: match[1], data: match[2] };
  };

  const imageData = getImageData(base64Image);
  const parts: any[] = [
    {
      text: `Gere 3 opções de prompts de animação baseados no scan: ${JSON.stringify(scan)} e configurações: ${JSON.stringify(config)}.
    ${config.isTransition ? 'Esta é uma animação de TRANSIÇÃO entre duas cenas. O prompt deve descrever a evolução fluida da primeira imagem para a segunda.' : ''}
    Duração: ${config.duration}s.
    Time-lapse: ${config.isTimeLapse ? 'Sim' : 'Não'}.
    Speed Ramp: ${config.isSpeedRamp ? 'Sim' : 'Não'}.
    Movimento escolhido: ${config.movementType}.
    Animação de cena: ${config.sceneAnimation}.
    
    Lembre-se: TODO O CONTEÚDO, RESPOSTAS E PROMPTS GERADOS NESTE JSON DEVEM ESTAR EXCLUSIVAMENTE E 100% EM PORTUGUÊS DO BRASIL (PT-BR). Estilo arquitetônico sutil.`,
    },
    { inlineData: { mimeType: imageData.mimeType, data: imageData.data } },
  ];

  if (config.isTransition && endBase64Image) {
    const endImageData = getImageData(endBase64Image);
    parts.push({ inlineData: { mimeType: endImageData.mimeType, data: endImageData.data } });
  }

  const contents = [{ role: 'user', parts }];

  try {
    const schema = {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              prompt: { type: 'string' },
              simulatedEquipment: { type: 'string' },
              intensity: { type: 'string' },
            },
            required: ['id', 'name', 'prompt', 'simulatedEquipment', 'intensity'],
          },
        },
      },
      required: ['options'],
    };

    const raw = await callGemini(contents, schema);
    return validateOrThrow(MoveOutputSchema, raw, 'generateMovePrompts');
  } catch (error) {
    console.error('Erro na geração de prompts de movimento:', error);
    throw error;
  }
}
