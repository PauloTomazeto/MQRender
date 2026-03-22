import type { GenerateContentResponse } from '@google/genai';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { MoveScanResult, MoveConfig, MoveOutput } from '../types';
import { MoveScanResultSchema, MoveOutputSchema, validateOrThrow } from '../schemas';

function getAI() {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      'Chave de API não configurada. Adicione GEMINI_API_KEY no arquivo .env (copie .env.example como base).'
    );
  }

  return new GoogleGenAI({ apiKey: key });
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
  const model = 'gemini-3-flash-preview';
  const ai = getAI();

  const config: any = {
    systemInstruction: MOVE_SYSTEM_INSTRUCTION,
  };

  if (schema) {
    config.responseMimeType = 'application/json';
    config.responseSchema = schema;
  }

  // Timeout pattern to prevent infinite hangs
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('A requisição à IA demorou demais (timeout). Verifique sua conexão.')),
      45000
    )
  );

  try {
    const response = (await Promise.race([
      ai.models.generateContent({
        model,
        contents,
        config: {
          ...config,
          maxOutputTokens: 10000,
        },
      }),
      timeoutPromise,
    ])) as GenerateContentResponse;

    const text = response.text;

    if (!text) {
      throw new Error('A IA retornou uma resposta vazia.');
    }

    if (schema) {
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

    return text;
  } catch (error) {
    console.error('Gemini Move Call Error:', error);
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
      type: Type.OBJECT,
      properties: {
        technicalAnalysis: {
          type: Type.OBJECT,
          properties: {
            resolution: { type: Type.STRING },
            hasText: { type: Type.STRING },
            visualStyle: { type: Type.STRING },
            aspectRatio: { type: Type.STRING },
          },
        },
        cinematicAnalysis: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            cameraShot: { type: Type.STRING },
            lighting: { type: Type.STRING },
            colorPalette: { type: Type.STRING },
            depthOfField: { type: Type.STRING },
          },
        },
        mobilityDiagnosis: {
          type: Type.OBJECT,
          properties: {
            staticElements: { type: Type.ARRAY, items: { type: Type.STRING } },
            dynamicElements: { type: Type.ARRAY, items: { type: Type.STRING } },
            parallaxPotential: { type: Type.STRING },
            restrictions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        suggestedMovements: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              intensity: { type: Type.STRING, enum: ['Sutil', 'Suave', 'Dinâmico', 'Épico'] },
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
      type: Type.OBJECT,
      properties: {
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              name: { type: Type.STRING },
              prompt: { type: Type.STRING },
              simulatedEquipment: { type: Type.STRING },
              intensity: { type: Type.STRING },
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
