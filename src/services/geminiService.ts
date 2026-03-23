import type { GenerateContentResponse } from '@google/genai';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { ScanResult, PromptOutput, PostProductionResult, DetailScanResult } from '../types';
import {
  ScanResultSchema,
  DetailScanResultSchema,
  PostProductionResultSchema,
  validateOrThrow,
} from '../schemas';

function getAI() {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      'Chave de API não configurada. Adicione GEMINI_API_KEY no arquivo .env (copie .env.example como base).'
    );
  }

  return new GoogleGenAI({ apiKey: key });
}

const SYSTEM_INSTRUCTION = `
Você é o motor de análise do MQPROMP, um gerador de prompts de fotografia arquitetural.
Sua missão é transformar imagens técnicas (renders, perspectivas, plantas) em descritores fotográficos reais.

REGRA ZERO (ABSOLUTA):
NUNCA use termos de CGI ou renderizadores: render, CGI, 3D, raytracing, octane, vray, blender, unreal, visualization, digital art, perfect lighting, studio lighting, symmetrical composition.

REGRAS DE OURO:
1. Sempre inclua câmera física real (Canon, Nikon, Sony, Leica), lente específica (24mm, 35mm, 50mm, 85mm) e EXIF (f-stop, ISO, shutter speed).
2. Adicione imperfeições: grain de filme (Kodak Portra 400), aberração cromática, micro-narrativas de uso humano, sombras com penumbra suave.
3. Preserve a volumetria e materiais originais sem alterá-los.
4. Saída sempre em Português (PT-BR), mas mantenha termos técnicos fotográficos em inglês (grain, bokeh, vignetting, f-stop).
5. Se houver pessoas na foto (como o "Tony"), trate-as como elementos de escala humana e narrativa, sem se distrair da arquitetura.

TOOL-01 — ANALISE DE IMAGEM (Scanner Visual Arquitetonico):
- ETAPA 1: Identificar tipologia, pavimentos, volumes (forma, posição, hierarquia, proporção).
- ETAPA 2: Materiais e texturas detalhados (máximo 5 materiais principais).
- ETAPA 3: Esquadrias e aberturas (tipo, proporção, posição).
- ETAPA 4: Configuração de câmera (altura_m, distância_m, focal_aparente). Identificar explicitamente se a imagem original é um "contrapicado" (low-angle shot). Se for planta baixa (TOOL-PLANTA) ou se for detectado um low-angle shot, o ângulo deve ser sempre 90 graus (top-down).
- ETAPA 5: Sistema de iluminação (período, temp_k, qualidade) e identificação de pontos de luz específicos (localização, tipo, intensidade).
- ETAPA 6: Contexto imediato (topografia, vegetação %, piso).
- ETAPA 7: Cálculo de confiança (0-100 para cada dimensão e geral).

TOOL-PLANTA — MOTOR DE HUMANIZACAO DE PLANTAS BAIXAS:
- Ativar se a imagem for uma planta técnica (paredes em corte, cotas, símbolos de esquadrias).
- Classificar tipo de planta (A, B, C, D).
- Inventário de ambientes (máximo 8 ambientes principais).
- Definir materiais de piso fotorrealistas por ambiente.
- Mobiliário aéreo (vista de cima) e vegetação aérea (copas).

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
    systemInstruction: SYSTEM_INSTRUCTION,
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
        // Fallback strategies
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
    console.error('Gemini Call Error:', error);
    throw error;
  }
}

export async function analyzeDetailCloses(base64Image: string): Promise<DetailScanResult> {
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
            text: `Analise esta imagem arquitetônica e identifique os 6 melhores pontos de close-up (detalhes) para fotografia. 
          Para cada ponto, descreva a localização e gere um prompt fotográfico de close-up (macro ou detalhe) que mantenha fidelidade absoluta aos materiais e objetos presentes na imagem.
          Não adicione novos elementos. Foque em texturas, encaixes, iluminação local e composição de detalhe.`,
          },
          { inlineData: { mimeType: imageData.mimeType, data: imageData.data } },
        ],
      },
    ];

    const schema = {
      type: Type.OBJECT,
      properties: {
        overallComposition: { type: Type.STRING },
        closes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              location: { type: Type.STRING },
              prompt: { type: Type.STRING },
            },
            required: ['id', 'title', 'description', 'location', 'prompt'],
          },
        },
      },
      required: ['overallComposition', 'closes'],
    };

    const raw = await callGemini(contents, schema);
    return validateOrThrow(DetailScanResultSchema, raw, 'analyzeDetailCloses');
  } catch (error) {
    console.error('Erro na análise de detalhes:', error);
    throw error;
  }
}

export async function analyzeImage(base64Image: string): Promise<ScanResult> {
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
            text: "Analise esta imagem arquitetônica de forma objetiva e rápida. Se houver pessoas, ignore detalhes delas e foque na arquitetura. \n\nATENÇÃO ESPECIAL: Diferencie rigorosamente entre espelhos e painéis de MDF/Laca. Espelhos devem ter reflexos nítidos e perfeitos. Painéis brancos ou acetinados (como fundos de penteadeira ou portas de armário sem reflexo claro) são MDF, não espelhos. Se a superfície não mostra o que está 'atrás' da câmera de forma nítida, é MDF. Garanta a consistência de materiais em todo o mobiliário. Preencha o JSON seguindo o esquema.",
          },
          { inlineData: { mimeType: imageData.mimeType, data: imageData.data } },
        ],
      },
    ];

    const schema = {
      type: Type.OBJECT,
      properties: {
        isFloorPlan: { type: Type.BOOLEAN },
        typology: { type: Type.STRING },
        floors: { type: Type.INTEGER },
        volumes: { type: Type.STRING },
        materials: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              elemento: { type: Type.STRING },
              acabamento: { type: Type.STRING },
              cor_ral: { type: Type.STRING },
              reflectancia: {
                type: Type.STRING,
                enum: ['matte', 'semi-matte', 'semi-gloss', 'gloss', 'espelhado'],
              },
              textura_fisica: { type: Type.STRING },
              estado_conservacao: { type: Type.STRING },
              indice_rugosidade_estimado: { type: Type.NUMBER },
              notas_textura: { type: Type.STRING },
            },
            required: ['elemento', 'acabamento', 'reflectancia'],
          },
        },
        openings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              tipo: { type: Type.STRING },
              proporcao: { type: Type.STRING },
              posicao_fachada: { type: Type.STRING },
            },
          },
        },
        camera: {
          type: Type.OBJECT,
          properties: {
            height_m: { type: Type.NUMBER },
            distance_m: { type: Type.NUMBER },
            focal_apparent: { type: Type.STRING },
            distortion: { type: Type.STRING },
            horizontal_angle: { type: Type.STRING },
            vertical_tilt: { type: Type.STRING },
            isLowAngle: { type: Type.BOOLEAN },
          },
          required: ['height_m', 'distance_m', 'focal_apparent'],
        },
        light: {
          type: Type.OBJECT,
          properties: {
            period: { type: Type.STRING },
            temp_k: { type: Type.NUMBER },
            azimuthal_direction: { type: Type.STRING },
            elevation_angle: { type: Type.NUMBER },
            quality: { type: Type.STRING },
            ratio: { type: Type.STRING },
            shadows: { type: Type.STRING },
          },
          required: ['period', 'temp_k', 'quality'],
        },
        lightPoints: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              location: { type: Type.STRING },
              type: { type: Type.STRING },
              intensity_initial: { type: Type.NUMBER },
              temp_k_initial: { type: Type.NUMBER },
            },
            required: ['id', 'location', 'type', 'intensity_initial', 'temp_k_initial'],
          },
        },
        context: {
          type: Type.OBJECT,
          properties: {
            topography: { type: Type.STRING },
            vegetation_pct: { type: Type.NUMBER },
            species: { type: Type.ARRAY, items: { type: Type.STRING } },
            piso_externo: { type: Type.STRING },
            vehicles: { type: Type.STRING },
            infrastructure: { type: Type.ARRAY, items: { type: Type.STRING } },
            neighbors: { type: Type.STRING },
            horizon: { type: Type.BOOLEAN },
            sky_pct: { type: Type.NUMBER },
            image_quality: { type: Type.STRING },
          },
        },
        confidence: {
          type: Type.OBJECT,
          properties: {
            materials: { type: Type.NUMBER },
            camera: { type: Type.NUMBER },
            light: { type: Type.NUMBER },
            context: { type: Type.NUMBER },
            general: { type: Type.NUMBER },
          },
          required: ['materials', 'camera', 'light', 'context', 'general'],
        },
        postProductionStrategy: { type: Type.STRING },
        floorPlanType: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
        environments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              nome: { type: Type.STRING },
              area_m2: { type: Type.NUMBER },
              tipo: { type: Type.STRING },
              posicao: { type: Type.STRING },
            },
          },
        },
      },
      required: ['isFloorPlan', 'typology', 'materials', 'camera', 'light', 'confidence'],
    };

    const raw = await callGemini(contents, schema);
    return validateOrThrow(ScanResultSchema, raw, 'analyzeImage');
  } catch (error) {
    console.error('Erro na análise da imagem:', error);
    throw error;
  }
}

export async function generatePrompt(
  scan: ScanResult,
  config: any,
  base64Image: string
): Promise<PromptOutput> {
  try {
    const promptText =
      config.mode === 'single'
        ? 'Gere um prompt fotográfico único contínuo e um negative prompt. Formato de saída OBRIGATÓRIO em texto puro:\nPOSITIVO:\n(seu prompt positivo aqui em Português)\nNEGATIVO:\n(seu negative prompt aqui)'
        : 'Gere 6 blocos de prompt separados (B1 a B6) e um negative prompt. Formato de saída OBRIGATÓRIO em texto puro:\nPOSITIVO:\nB1: ...\nB2: ...\nB3: ...\nB4: ...\nB5: ...\nB6: ...\nNEGATIVO:\n(seu negative prompt aqui)';

    const configForPrompt = { ...config };
    if (configForPrompt.mirror?.reflectionImage) {
      configForPrompt.mirror = {
        ...configForPrompt.mirror,
        reflectionImage: '[IMAGEM_FORNECIDA_COMO_PARTE_MULTIMODAL]',
      };
    }

    const getImageData = (base64: string) => {
      const match = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return { mimeType: 'image/jpeg', data: base64.split(',')[1] || base64 };
      return { mimeType: match[1], data: match[2] };
    };

    const mainImage = getImageData(base64Image);

    const parts: any[] = [
      {
        text: `Com base no scan: ${JSON.stringify(scan)} e nas configurações detalhadas: ${JSON.stringify(configForPrompt)}, ${promptText}. 

      REGRAS OBRIGATÓRIAS DO PROMPT GERADO:
      
      [LÍNGUA] O prompt DEVE ser gerado em PORTUGUÊS (PT-BR). Somente termos técnicos fotográficos (ex: bokeh, f-stop) podem ficar em inglês.
      [GEOMETRIA] O prompt DEVE conter: "Mantenha 100% da fidelidade estrutural e geométrica da imagem de referência. Reproduza exatamente as mesmas paredes, vãos e layout espacial. Proibido adicionar ou remover elementos arquitetônicos como janelas, portas, arcos ou vãos."
      [ANTI-ALUCINAÇÃO DE TEXTURA] O prompt DEVE conter: "Se uma superfície for plana, branca ou cinza sem textura na referência (ex: paredes de Sketchup), mantenha-a como PAREDE LISA E LIMPA. É terminantemente proibido transformar paredes lisas em cortinas, persianas, painéis ripados ou qualquer outra textura não existente."
      [CONSISTÊNCIA DE MATERIAIS] O prompt DEVE conter: "Diferencie rigorosamente entre espelhos e painéis de MDF. Se a referência mostra um painel branco ou cinza sem reflexo nítido (como o fundo de uma penteadeira), descreva-o como MDF ou Laca, NUNCA como espelho. Garanta que todas as partes de um mesmo móvel mantenham o mesmo material, a menos que haja um espelho com moldura clara."
      ${config.materialFidelity ? '[MATERIAIS] Descreva cada material visível detalhadamente (ex: armários em MDF oliva, bancada em granilite cinza). O prompt DEVE conter: "Mantenha fidelidade material absoluta. Não troque cores ou acabamentos da referência."' : '[MATERIAIS] Variações sutis de materiais são permitidas.'}
      ${config.accessoryControl === 'maintain' ? '[ACESSÓRIOS] O prompt DEVE conter: "Retrate apenas objetos presentes na referência. Proibido adicionar ou inventar objetos decorativos, vasos, plantas, quadros ou qualquer item não existente na cena original."' : '[ACESSÓRIOS] Pode adornar a cena livremente.'}
      [FOTORREALISMO] O prompt positivo DEVE incluir: "fotorealista, fotografia RAW, Canon EOS R5, 35mm, fotografia de interiores arquitetônica, iluminação natural, 8K, DSLR, foto real da vida real"
      [NEGATIVE OBRIGATÓRIO] O Negative Prompt DEVE incluir no mínimo: "CGI, render, 3D render, unreal engine, octane render, vray, blender, digital art, artificial lighting, studio lighting, harsh shadows, oversaturated, low quality, blurry, distorted, watermark, text, people, illustration, painting, sketch, cartoon, plastic texture, fake, synthetic, computer generated, sketchup, maquete, maquette, architectural model, clay render, wireframe, added windows, added doors, added openings, extra furniture, invented objects, hallucinated elements, curtains where there are walls, blinds on solid walls"
      ${config.mirror?.enabled ? `[ESPELHO] Espelho em: ${config.mirror.location}. Segunda imagem = reflexo.` : ''}
      A primeira imagem é a CENA BASE.`,
      },
      { inlineData: { mimeType: mainImage.mimeType, data: mainImage.data } },
    ];

    if (config.mirror?.enabled && config.mirror.reflectionImage) {
      const mirrorImage = getImageData(config.mirror.reflectionImage);
      parts.push({ inlineData: { mimeType: mirrorImage.mimeType, data: mirrorImage.data } });
    }

    const contents = [{ role: 'user', parts }];

    const rawText = await callGemini(contents);

    // Parse plain text into PromptOutput (Bilingual Hardened Parser)
    let positive = '';
    let negative = '';

    // Regex support for POSITIVO/NEGATIVO and POSITIVE/NEGATIVE
    const posMatch = rawText.match(
      /(?:POSITIVO|POSITIVE|PROMPT POSITIVO|PROMPT|Positive Prompt)[:\s]*\n?([\s\S]*?)(?=\n*(?:NEGATIVO|NEGATIVE|PROMPT NEGATIVO|Negative Prompt)[:\s])/i
    );
    const negMatch = rawText.match(
      /(?:NEGATIVO|NEGATIVE|PROMPT NEGATIVO|Negative Prompt)[:\s]*\n?([\s\S]*?)$/i
    );

    if (posMatch && negMatch) {
      positive = posMatch[1].trim();
      negative = negMatch[1].trim();
    } else {
      // Fallback strategies if markers are missing or model hallucinated structure
      const lines = rawText.split('\n');
      const negIndex = lines.findIndex(
        (l: string) => l.toUpperCase().includes('NEGATIVO') || l.toUpperCase().includes('NEGATIVE')
      );

      if (negIndex !== -1) {
        positive = lines
          .slice(0, negIndex)
          .join('\n')
          .replace(/POSITIVO:|POSITIVE:/i, '')
          .trim();
        negative = lines
          .slice(negIndex)
          .join('\n')
          .replace(/NEGATIVO:|NEGATIVE:/i, '')
          .trim();
      } else {
        positive = rawText.trim();
        negative =
          'CGI, render, 3D render, unreal engine, octane render, vray, blender, digital art, artificial lighting, studio lighting, harsh shadows, oversaturated, low quality, blurry, distorted, watermark, text, people, illustration, painting, sketch, cartoon, plastic texture, fake, synthetic, computer generated, sketchup, maquete, maquette, architectural model, clay render, wireframe, added windows, added doors, added openings, extra furniture, invented objects, hallucinated elements, curtains where there are walls, blinds on solid walls';
      }
    }

    // Extract blocks if mode is 'blocks'
    let blocks: any = undefined;
    if (config.mode !== 'single') {
      const blockRegex = /B(\d)[:\s]*\n?([\s\S]*?)(?=\nB\d|$)/gi;
      let match;
      const blockMap: any = {};
      while ((match = blockRegex.exec(positive)) !== null) {
        blockMap[`b${match[1]}`] = match[2].trim();
      }
      if (Object.keys(blockMap).length > 0) {
        blocks = blockMap;
      }
    }

    const result: PromptOutput = {
      positive,
      negative,
      blocks,
      score: 85,
    };

    return result;
  } catch (error) {
    console.error('Error in generatePrompt:', error);
    throw error;
  }
}

export async function analyzePostProduction(
  originalBase64: string,
  generatedBase64: string,
  style: 'default' | 'casa-vogue' = 'default'
): Promise<PostProductionResult> {
  const getImageData = (base64: string) => {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { mimeType: 'image/jpeg', data: base64.split(',')[1] || base64 };
    return { mimeType: match[1], data: match[2] };
  };

  const styleInstruction =
    style === 'casa-vogue'
      ? "Aplique o estilo 'Casa Vogue': sofisticação editorial, luz suave e natural, cores levemente dessaturadas mas ricas, foco em texturas orgânicas e composição equilibrada."
      : 'Foco em realismo fotográfico absoluto e correção de artefatos de CGI.';

  const originalImage = getImageData(originalBase64);
  const generatedImage = getImageData(generatedBase64);

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `Compare a imagem original com a gerada pela IA. 
        1. Identifique discrepâncias técnicas (geometria, texturas, iluminação).
        2. ${styleInstruction}
        3. Gere um pipeline de 6 mapas técnicos com valores calibrados.
        4. Gere um 'postProductionPrompt' detalhado que descreva exatamente os ajustes necessários para corrigir a imagem gerada, focando em realismo e no estilo solicitado. O prompt deve ser um comando direto para refinamento final.`,
        },
        { inlineData: { mimeType: originalImage.mimeType, data: originalImage.data } },
        { inlineData: { mimeType: generatedImage.mimeType, data: generatedImage.data } },
      ],
    },
  ];

  const schema = {
    type: Type.OBJECT,
    properties: {
      cgiIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
      pipeline: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            map: { type: Type.STRING },
            value: { type: Type.STRING },
            description: { type: Type.STRING },
          },
        },
      },
      postProductionPrompt: { type: Type.STRING },
    },
    required: ['cgiIssues', 'pipeline', 'postProductionPrompt'],
  };

  const raw = await callGemini(contents, schema);
  return validateOrThrow(PostProductionResultSchema, raw, 'analyzePostProduction');
}

export async function generateNanoBananaPro(
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  resolution: '1K' | '2K'
): Promise<string> {
  const aspectMap: Record<string, string> = {
    '16:9': '16:9',
    '1:1': '1:1',
    '9:16': '9:16',
    '5:4': '4:3',
    '4:5': '3:4',
  };
  const imagenAspect = aspectMap[aspectRatio] || '16:9';

  const fullPrompt = `${prompt}. Resolução ${resolution}. Evite: ${negativePrompt}`;

  const ai = getAI();

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('A geração da imagem demorou demais (timeout).')), 120000)
  );

  try {
    const generatePromise = (ai.models as any).generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: imagenAspect,
      },
    });

    const response = (await Promise.race([generatePromise, timeoutPromise])) as any;

    const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      throw new Error(
        'Nano Banana Pro não retornou imagem. Verifique se o modelo Imagen 3 está disponível na sua chave de API.'
      );
    }

    return `data:image/png;base64,${imageBytes}`;
  } catch (err) {
    console.error('Erro Nano Banana Pro:', err);
    throw err;
  }
}

export async function generateNanoBananaImage(
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  resolution: '1K' | '2K',
  imageRef?: string
): Promise<string> {
  try {
    const fullPrompt = `${prompt}\n\nNegative Prompt: ${negativePrompt}\nFormat Requirements: Aspect Ratio ${aspectRatio}, Resolution ${resolution}.`;

    const parts: any[] = [{ text: fullPrompt }];

    if (imageRef) {
      const match = imageRef.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    const ai = getAI();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('A geração da imagem demorou demais (timeout).')), 90000)
    );

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        role: 'user',
        parts: parts,
      },
      config: {
        maxOutputTokens: 10000,
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: resolution,
        },
      },
    });

    const response = (await Promise.race([
      generatePromise,
      timeoutPromise,
    ])) as GenerateContentResponse;

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error(
      'A API retornou sucesso, porem sem InlineData (Base64) da imagem na resposta do modelo.'
    );
  } catch (err) {
    console.error('Erro de requisição Nano Banana 2:', err);
    throw err;
  }
}
