import type { GenerateContentResponse } from '@google/genai';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { ScanResult, PromptOutput, PostProductionResult, DetailScanResult } from '../types';
import {
  ScanResultSchema,
  DetailScanResultSchema,
  PostProductionResultSchema,
  validateOrThrow,
} from '../schemas';
import { supabase } from '../lib/supabase';

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

TOOL-MAT — PIPELINE DE PRECISÃO DE MATERIAIS (Metodologia PBR/V-Ray):
Para cada material identificado, decomponha em 4 camadas físicas obrigatórias:
- CAMADA DIFFUSE: Descreva a cor base exata (tom, saturação, temperatura de cor), padrão de textura (veios, tramado, poros, manchas), e albedo percebido. Ex: "carvalho natural, veios longitudinais castanho-mel sobre fundo bege-dourado, albedo médio-quente".
- CAMADA REFLECTION (pbr_reflection 0.0-1.0): Calcule a intensidade de reflexão. Metais polidos → 0.9+. Vidro → 0.85. Madeira envernizada → 0.4. Concreto aparente → 0.05. Tecido → 0.02. Preencha pbr_glossiness: reflexão nítida (>0.8) ou difusa (<0.4).
- CAMADA BUMP: Identifique micro-relevos da superfície — poros, fissuras, ranhuras, tramado, espessura de pintura. Descreva o que sobe (branco no mapa) e o que desce (preto). Ex: "juntas de rejunte afundam 2mm, superfície da cerâmica levemente convexa".
- COMPORTAMENTO DE LUZ (pbr_light_behavior): Como esse material reage fisicamente à luz da cena — absorção, difusão lambertiana, reflexão especular, translucidez, subsurface scattering, anisotropia. Ex: "difunde luz de forma lambertiana uniforme, absorve 70% no espectro visível, sem componente especular".

TOOL-LUZ — PIPELINE DE PRECISÃO DE ILUMINAÇÃO (Metodologia V-Ray Lights):

ETAPA A — LUZ AMBIENTE GLOBAL (campo "light"):
- period: identifique o período temporal (manhã/tarde/entardecer/noite/nublado/chuva).
- temp_k: calcule a temperatura de cor dominante em Kelvin. Referência: luz do dia clara=5500-6500K, céu nublado=6500-8000K, golden hour=2500-3500K, luz artificial tungstênio=2700-3200K, LED neutro=4000K.
- azimuthal_direction: direção azimutal da fonte principal (N/S/L/O ou graus 0-360°).
- elevation_angle: ângulo de elevação da fonte acima do horizonte (-90° a 90°). Sol ao meio-dia=~75°, golden hour=5-15°.
- quality: classifique como "hard" (sombras nítidas, fonte pontual), "soft" (penumbra difusa, céu nublado), "diffuse" (sem sombras, luz uniforme), "directional" (feixe direcional visível).
- ratio: relação luz principal : preenchimento (ex: "4:1", "2:1", "1:1" para cena flat).
- shadows: descrição da penumbra (ex: "bordas nítidas 2px de penumbra", "sombras totalmente difusas sem borda definida").
- shadow_direction: para onde as sombras projetam (ex: "para nordeste a 45°", "em direção à câmera").
- artificial_sources: liste cada tipo artificial detectado (ex: ["LED embutido", "arandela halogêna", "pendente tungstênio"]).
- ambient_temp: temperatura de cor do ambiente como texto descritivo (ex: "ambiente quente com dominante âmbar", "iluminação fria azulada de norte").
- dominant_source: descreva a fonte principal com precisão geográfica e angular (ex: "luz solar direta proveniente de noroeste a 35° de elevação").
- light_mixing: como múltiplas fontes se mesclam (ex: "luz natural fria de janela leste mistura-se com luz artificial quente do teto criando gradiente 5500K→3200K").
- indirect_ratio: proporção luz direta vs indireta/bounce (ex: "3:1 direta vs bounce", "predominantemente indireta 1:4").
- bloom_glare: true se houver bloom/glare de lente visível em alguma fonte.

ETAPA B — PONTOS DE LUZ INDIVIDUAIS (array "lightPoints"):
Para cada fonte artificial ou natural pontual identificada na cena:
- id: identificador único sequencial ("lp_01", "lp_02", etc.)
- location: posição espacial precisa relativa à cena (ex: "teto central 2.8m de altura", "arandela lateral direita a 1.6m", "pendente sobre bancada").
- type: classifique conforme tipos V-Ray: "rectangle" (LED painel/plafon/sanca), "sphere" (lâmpada globo/lustre), "spot" (spot direcionável/trilho), "ies" (luminária com fotometria real/distribuição complexa), "omni" (ponto de luz onidirecional/jardim), "dome" (luz de céu/HDRI ambiental), "emissive" (superfície emissora/LED fita), "ambient" (luz ambiente indeterminada).
- shape: "rectangular" (painel LED), "elliptical" (spot oval), "spherical" (globo), "conical" (spot cônico), "mesh" (objeto emissor).
- intensity_initial: estimativa de intensidade relativa 0-100 baseada na luminância visual percebida.
- temp_k_initial: temperatura de cor da fonte em Kelvin (2000K tungstênio antigo → 6500K LED branco frio).
- decay: sempre "inverse_square" para fontes reais (lei do quadrado inverso). Use "linear" apenas para luzes artísticas/atmosféricas. Use "none" para luz ambiente flat.
- cone_angle: para spots, estime o ângulo do cone em graus pela dispersão visível da luz (10°=spot narrowbeam, 30°=spot médio, 60°=flood).
- penumbra_angle: ângulo de suavização da borda do cone (5-15° típico).
- directionality: para retângulos/painéis, quão direcional é o feixe (0.0=difuso em todas as direções, 1.0=feixe colimado perpendicular).
- shadow_softness: suavidade das sombras geradas (0.0=sombra de aresta, 1.0=penumbra totalmente difusa).
- affect_specular: true se a fonte cria highlights especulares visíveis nos materiais.
- affect_diffuse: true se a fonte ilumina a superfície difusamente (quase sempre true).
- affect_reflections: true se a fonte aparece refletida em superfícies especulares da cena.
- visible_in_render: true se a geometria da lâmpada/luminária é visível; false se apenas o efeito de luz é visto.
- spatial_x_pct: posição horizontal estimada da fonte na imagem (0=esquerda, 100=direita).
- spatial_y_pct: posição vertical estimada (0=topo, 100=base).
- confidence: sua confiança na detecção desta fonte (0-100). Reduza se a fonte for inferida, não diretamente visível.
- bloom_glare: true se esta fonte específica gera bloom/glare de lente visível.
- color_hex: cor hexadecimal da luz emitida (ex: "#FFF0D8" para tungstênio, "#E8F4FF" para LED frio, "#FFFFFF" para neutro).
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
            text: "Analise esta imagem arquitetônica de forma objetiva e rápida. Se houver pessoas, ignore detalhes delas e foque na arquitetura. \n\nATENÇÃO ESPECIAL: Diferencie rigorosamente entre espelhos e painéis de MDF/Laca. Espelhos devem ter reflexos nítidos e perfeitos. Painéis brancos ou acetinados (como fundos de penteadeira ou portas de armário sem reflexo claro) são MDF, não espelhos. Se a superfície não mostra o que está 'atrás' da câmera de forma nítida, é MDF. Garanta a consistência de materiais em todo o mobiliário.\n\nPIPELINE PBR OBRIGATÓRIO: Para cada material, preencha as camadas físicas:\n- pbr_diffuse: descrição detalhada da cor base, padrão de textura e albedo percebido\n- pbr_reflection (0.0-1.0): intensidade de reflexão (ex: aço inox polido=0.95, madeira fosca=0.08)\n- pbr_glossiness (0.0-1.0): nitidez da reflexão (>0.8=espéculo nítido, <0.3=reflexão difusa)\n- pbr_bump: descrição do micro-relevo da superfície (poros, juntas, ranhuras, relevos)\n- pbr_light_behavior: comportamento físico frente à luz da cena (difusão lambertiana, especular, translucidez, absorção %)\n\nPreencha o JSON seguindo o esquema.",
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
              // PBR Material Precision Pipeline
              pbr_diffuse: { type: Type.STRING },
              pbr_reflection: { type: Type.NUMBER },
              pbr_glossiness: { type: Type.NUMBER },
              pbr_bump: { type: Type.STRING },
              pbr_light_behavior: { type: Type.STRING },
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
            shadow_direction: { type: Type.STRING },
            artificial_sources: { type: Type.ARRAY, items: { type: Type.STRING } },
            ambient_temp: { type: Type.STRING },
            bloom_glare: { type: Type.BOOLEAN },
            dominant_source: { type: Type.STRING },
            light_mixing: { type: Type.STRING },
            indirect_ratio: { type: Type.STRING },
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
              type: {
                type: Type.STRING,
                enum: ['rectangle', 'sphere', 'spot', 'ies', 'omni', 'dome', 'emissive', 'ambient'],
              },
              intensity_initial: { type: Type.NUMBER },
              temp_k_initial: { type: Type.NUMBER },
              // V-Ray precision fields
              shape: {
                type: Type.STRING,
                enum: ['rectangular', 'elliptical', 'spherical', 'conical', 'mesh'],
              },
              decay: { type: Type.STRING, enum: ['inverse_square', 'linear', 'none'] },
              cone_angle: { type: Type.NUMBER },
              penumbra_angle: { type: Type.NUMBER },
              directionality: { type: Type.NUMBER },
              shadow_softness: { type: Type.NUMBER },
              affect_specular: { type: Type.BOOLEAN },
              affect_diffuse: { type: Type.BOOLEAN },
              affect_reflections: { type: Type.BOOLEAN },
              visible_in_render: { type: Type.BOOLEAN },
              spatial_x_pct: { type: Type.NUMBER },
              spatial_y_pct: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              bloom_glare: { type: Type.BOOLEAN },
              color_hex: { type: Type.STRING },
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
    // Cast needed: Zod v4 infers catch/preprocess fields as optional in the object type,
    // but the runtime output is always defined. The ScanResult interface is the source of truth.
    return validateOrThrow(ScanResultSchema, raw, 'analyzeImage') as unknown as ScanResult;
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
      [PIPELINE PBR DE MATERIAIS — OBRIGATÓRIO] Para cada material identificado no scan, o prompt DEVE descrever as 4 camadas físicas com riqueza fotográfica:
      1. DIFFUSE (Base): Descreva a cor base, padrão de textura e qualidade de albedo com vocabulário fotográfico preciso. Ex: "parede em cimento queimado cinza grafite com variação tonal sutil, albedo baixo-médio, textura homogênea com micro-poros visíveis".
      2. REFLECTION (Reflexão): Descreva o comportamento especular com intensidade calibrada. Ex: "bancada em granito preto absoluto com reflexo especular nítido de alta intensidade (pbr_reflection ≈ 0.75), captando o reflexo invertido das luminárias embutidas acima".
      3. GLOSSINESS (Nitidez da Reflexão): Diferencie reflexão nítida vs. difusa. Ex: "piso em porcelanato 120×60cm polido com reflexo sharp de alta glossiness (≈0.90), espelhando o volume arquitetônico oposto com leve distorção de perspectiva" OU "madeira de carvalho escovado com reflexão satin difusa (glossiness ≈0.35), sem imagem refletida definida".
      4. BUMP (Micro-relevo): Descreva a textura tridimensional da superfície perceptível ao toque e à luz rasante. Ex: "superfície em concreto aparente com micro-relevo de fôrma de madeira (juntas a cada 60cm), poros de bolhas de ar e variação de profundidade de 0.5-2mm criando sombra rasante".
      Os materiais identificados no scan com dados PBR são: ${JSON.stringify(scan.materials?.map((m: any) => ({ elemento: m.elemento, acabamento: m.acabamento, reflectancia: m.reflectancia, pbr_diffuse: m.pbr_diffuse, pbr_reflection: m.pbr_reflection, pbr_glossiness: m.pbr_glossiness, pbr_bump: m.pbr_bump, pbr_light_behavior: m.pbr_light_behavior })) ?? [])}
      [ORQUESTRAÇÃO DE ILUMINAÇÃO V-RAY — OBRIGATÓRIO] O prompt DEVE conter uma seção de iluminação detalhada construída a partir dos dados abaixo. Descreva a iluminação com linguagem fotográfica precisa e física, nunca use termos de CGI.
      DADOS DE LUZ AMBIENTE: ${JSON.stringify({
        period: scan.light?.period,
        temp_k: scan.light?.temp_k,
        quality: scan.light?.quality,
        azimuthal_direction: scan.light?.azimuthal_direction,
        elevation_angle: scan.light?.elevation_angle,
        ratio: scan.light?.ratio,
        shadows: scan.light?.shadows,
        shadow_direction: scan.light?.shadow_direction,
        artificial_sources: scan.light?.artificial_sources,
        ambient_temp: scan.light?.ambient_temp,
        dominant_source: scan.light?.dominant_source,
        light_mixing: scan.light?.light_mixing,
        indirect_ratio: scan.light?.indirect_ratio,
        bloom_glare: scan.light?.bloom_glare,
      })}
      PONTOS DE LUZ ARTIFICIAIS CONFIGURADOS: ${JSON.stringify(
        (config.lightPoints ?? [])
          .filter((lp: any) => lp.enabled)
          .map((lp: any) => ({
            id: lp.id,
            location: lp.location,
            type: lp.type,
            shape: lp.shape,
            intensity_pct: lp.intensity,
            temp_k: Math.round(2000 + (lp.temperature / 100) * 8000),
            decay: lp.decay,
            cone_angle: lp.cone_angle,
            directionality_pct: lp.directionality,
            shadow_softness_pct: lp.shadow_softness,
            affect_specular: lp.affect_specular,
            affect_reflections: lp.affect_reflections,
            bloom_glare: lp.bloom_glare,
            color_hex: lp.color_hex,
            confidence: lp.confidence,
          }))
      )}
      REGRAS DE ILUMINAÇÃO V-RAY PARA O PROMPT:
      - Descreva a fonte de luz PRINCIPAL com direção azimutal, ângulo de elevação e temperatura Kelvin. Ex: "luz solar direta proveniente de noroeste (315°) a 35° de elevação, temperatura 5200K, qualidade hard com sombras de bordas nítidas projetadas para sudeste".
      - Para cada ponto de luz artificial ATIVO: descreva tipo V-Ray (rectangle/sphere/spot/ies), localização precisa, temperatura K, intensidade relativa, e se gera highlights especulares ou aparece em reflexos. Ex: "luminária retangular LED embutida no teto central, temperatura 3200K, intensidade moderada 60%, criando reflexo especular linear na bancada de granito polido abaixo".
      - Descreva o DECAIMENTO de cada fonte artificial: "atenuação física por quadrado inverso, criando queda de intensidade natural com distância".
      - Se houver bloom/glare ativo: "leve vazamento de luz (bloom) ao redor da fonte direta, simulando dispersão de lente fotográfica".
      - Descreva a MISTURA de fontes: como a luz natural e artificial se mesclam, qual domina, onde há gradiente de temperatura de cor.
      - Mencione a proporção luz direta vs indireta (bounce): "iluminação indireta de bounce nas paredes amplifica a luz de preenchimento, ratio 2:1 direto/indireto".
      - Descreva o efeito da luz em cada MATERIAL da cena segundo seu pbr_light_behavior: como a luz rasante revela o bump do concreto, como o especular da luminária LED aparece no porcelanato polido, etc.
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

// ─── KIE.ai Nano Banana Pro ───────────────────────────────────────────────────
const KIE_API_BASE = 'https://api.kie.ai/api/v1/jobs';
const KIE_POLL_INTERVAL_MS = 5000;
const KIE_MAX_POLLS = 36; // 36 × 5s = 3 min
const KIE_TEMP_BUCKET = 'input-images';
const KIE_TEMP_FOLDER = 'kie-temp';

function getKieKey(): string {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error('KIE_API_KEY não configurada. Adicione no arquivo .env.');
  return key;
}

/** Faz upload do base64 para o Storage e retorna uma signed URL pública (10 min). */
async function uploadTempImage(base64: string): Promise<{ path: string; url: string }> {
  const [meta, rawData] = base64.split(',');
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] ?? 'image/jpeg';
  const ext = mime.split('/')[1] ?? 'jpg';

  const binary = atob(rawData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });

  // userId no path para respeitar as políticas RLS de Storage existentes
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? 'anon';
  const path = `${userId}/${KIE_TEMP_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(KIE_TEMP_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });

  if (uploadErr) throw new Error(`Upload temporário falhou: ${uploadErr.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(KIE_TEMP_BUCKET)
    .createSignedUrl(path, 600); // 10 minutos — suficiente para a geração

  if (signErr || !signed?.signedUrl)
    throw new Error(`Erro ao gerar URL assinada: ${signErr?.message}`);

  return { path, url: signed.signedUrl };
}

/** Remove o arquivo temporário do Storage após a geração. */
function deleteTempImage(path: string): void {
  supabase.storage
    .from(KIE_TEMP_BUCKET)
    .remove([path])
    .catch(err => console.warn('KIE.ai: falha ao remover imagem temporária:', err));
}

export async function generateNanoBananaPro(
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  resolution: '1K' | '2K',
  imageRef?: string
): Promise<string> {
  const apiKey = getKieKey();

  const fullPrompt =
    `MODO PRO — MÁXIMA FIDELIDADE FOTORREALISTA\n\n${prompt}\n\n` +
    `REQUISITOS DE QUALIDADE PRO:\n` +
    `- Fotografia arquitetural editorial de altíssima resolução\n` +
    `- Microdetalhes de textura: poros de concreto, veios de madeira, reflexos especulares calibrados\n` +
    `- Iluminação cinematográfica com gradiente de sombras suaves e penumbra precisa\n` +
    `- Aberração cromática sutil nas bordas, grain de filme Kodak Portra 400\n` +
    `- Profundidade de campo calculada: foco nítido no plano principal com bokeh progressivo\n` +
    `- Resolução alvo: ${resolution === '2K' ? 'Ultra HD 2K' : 'Alta definição 1K'}, Aspect Ratio ${aspectRatio}\n\n` +
    `NEGATIVO ABSOLUTO (PROIBIDO): ${negativePrompt}`;

  // ── Upload imagem de referência → signed URL pública para o KIE.ai ────────
  let tempPath: string | undefined;
  const imageInput: string[] = [];

  if (imageRef) {
    try {
      const { path, url } = await uploadTempImage(imageRef);
      tempPath = path;
      imageInput.push(url);
    } catch (uploadErr) {
      // Falha no upload não bloqueia — gera só pelo prompt
      console.warn(
        'KIE.ai: falha no upload da imagem de referência, gerando sem image_input.',
        uploadErr
      );
    }
  }

  // ── Step 1: criar task ────────────────────────────────────────────────────
  const createRes = await fetch(`${KIE_API_BASE}/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nano-banana-pro',
      input: {
        prompt: fullPrompt,
        ...(imageInput.length > 0 && { image_input: imageInput }),
        aspect_ratio: aspectRatio,
        resolution,
        output_format: 'png',
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`KIE.ai erro HTTP ${createRes.status}: ${errText.slice(0, 200)}`);
  }

  const createData = await createRes.json();
  if (createData.code !== 200) {
    throw new Error(`KIE.ai erro ao criar task: ${createData.msg}`);
  }

  const { taskId } = createData.data;

  // ── Step 2: polling até concluir ─────────────────────────────────────────
  for (let poll = 0; poll < KIE_MAX_POLLS; poll++) {
    await new Promise(resolve => setTimeout(resolve, KIE_POLL_INTERVAL_MS));

    const pollRes = await fetch(`${KIE_API_BASE}/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue; // rede instável — tenta novamente

    const pollData = await pollRes.json();
    const task = pollData.data;

    if (!task) continue;

    if (task.state === 'success') {
      const result = JSON.parse(task.resultJson as string) as { resultUrls: string[] };
      const url = result.resultUrls?.[0];
      if (tempPath) deleteTempImage(tempPath);
      if (!url) throw new Error('KIE.ai: geração concluída mas sem URL de imagem.');
      return url;
    }

    if (task.state === 'fail') {
      if (tempPath) deleteTempImage(tempPath);
      throw new Error(
        `KIE.ai geração falhou: ${task.failMsg || task.failCode || 'motivo desconhecido'}`
      );
    }

    // states: waiting | queuing | generating — continua polling
    console.info(
      `KIE.ai [${poll + 1}/${KIE_MAX_POLLS}] state=${task.state} progress=${task.progress ?? '—'}%`
    );
  }

  throw new Error('KIE.ai timeout: geração ultrapassou 3 minutos. Tente novamente.');
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
