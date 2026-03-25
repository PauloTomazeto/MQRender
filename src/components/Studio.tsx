import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Search,
  Settings,
  CheckCircle2,
  Copy,
  RefreshCw,
  AlertTriangle,
  Camera,
  Sun,
  Palette,
  Layout,
  FileText,
  ChevronRight,
  ArrowRight,
  Download,
  Eye,
  Zap,
  Film,
  Play,
  Move,
  History,
  Layers,
  ImagePlus,
  Loader2,
  CreditCard,
  Star,
  Building2,
  Check,
  Mail,
} from 'lucide-react';
import { Button, Card, Badge, Slider, Switch, cn } from './UI';
import type {
  AppStep,
  AppMode,
  ScanResult,
  PromptConfig,
  PromptOutput,
  PostProductionResult,
  DetailScanResult,
  MoveScanResult,
  MoveConfig,
  MoveOutput,
} from '../types';
import { LightPointConfig, MirrorConfig } from '../types';
import {
  analyzeImage,
  generatePrompt,
  analyzePostProduction,
  analyzeDetailCloses,
  generateNanoBananaImage,
  generateNanoBanana2,
  generateNanoBananaPro,
} from '../services/geminiService';
import { analyzeMoveImage, generateMovePrompts } from '../services/moveService';
import { getUserCreditStatus, type CreditStatus } from '../services/creditService';

export function Studio({ forcedStep }: { forcedStep?: AppStep }) {
  const [mode, setMode] = useState<AppMode>('promp');
  const [step, setStep] = useState<AppStep>(forcedStep || 'select');

  React.useEffect(() => {
    if (forcedStep) {
      setStep(forcedStep);
    } else {
      setStep('select');
    }
  }, [forcedStep]);
  const [image, setImage] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [moveScan, setMoveScan] = useState<MoveScanResult | null>(null);
  const [config, setConfig] = useState<PromptConfig>({
    mode: 'single',
    overallTemperature: 50,
    dayNight: 'day',
    time: '12:00',
    environment: 'sunny',
    overallIntensity: 50,
    lightPoints: [],
    accessoryControl: 'maintain',
    materialFidelity: true,
    season: 'summer',
    externalContext: 'urban',
    isBuilding: false,
    floorLevel: 1,
    angle: '90',
    lightTemp: 'manha',
    style: 'minimalista',
    mirror: {
      enabled: false,
      location: '',
      reflectionImage: undefined,
      reflectionDescription: '',
    },
  });
  const [moveConfig, setMoveConfig] = useState<MoveConfig>({
    duration: '5s',
    isTimeLapse: false,
    isSpeedRamp: false,
    movementType: '',
    sceneAnimation: '',
    isTransition: false,
    endImage: null,
  });
  const [result, setResult] = useState<PromptOutput | null>(null);
  const [moveResult, setMoveResult] = useState<MoveOutput | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [postProdResult, setPostProdResult] = useState<PostProductionResult | null>(null);

  // Créditos do usuário
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  useEffect(() => {
    getUserCreditStatus()
      .then(setCreditStatus)
      .catch(err => console.error('[MQv3 Credits Studio]', err));
  }, []);

  // Geração de Imagem Premium
  const [genModel, setGenModel] = useState<'flash' | 'pro'>('flash');
  const [genAspect, setGenAspect] = useState<string>('16:9');
  const [genRes, setGenRes] = useState<'1K' | '2K' | '4K'>('1K');
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [postProdStyle, setPostProdStyle] = useState<'default' | 'casa-vogue'>('default');
  const [detailScanResult, setDetailScanResult] = useState<DetailScanResult | null>(null);
  const [detailImage, setDetailImage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!generatedImg) return;
    const filename = `render-ia-${Date.now()}.png`;
    // If it's already a data URL, download directly
    if (generatedImg.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = generatedImg;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    // Remote URL: fetch as blob to bypass cross-origin download restriction
    try {
      const response = await fetch(generatedImg);
      if (!response.ok) throw new Error('fetch failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in new tab so user can save manually
      window.open(generatedImg, '_blank');
    }
  }, [generatedImg]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Analisando Volumetria...');
  const [showRetry, setShowRetry] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let timer: any;
    let skipTimer: any;
    if (loading) {
      timer = setTimeout(() => setShowRetry(true), 15000);
      skipTimer = setTimeout(() => setShowSkip(true), 25000);
      const messages = [
        'Analisando Volumetria...',
        'Identificando Materiais...',
        'Calculando Iluminação...',
        'Mapeando Contexto...',
        'Finalizando Diagnóstico...',
      ];
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 3000);
      return () => {
        clearInterval(interval);
        clearTimeout(timer);
        clearTimeout(skipTimer);
      };
    } else {
      setShowRetry(false);
      setShowSkip(false);
    }
  }, [loading]);

  React.useEffect(() => {
    if (scan) {
      const updates: any = {};

      if (scan.lightPoints) {
        updates.lightPoints = scan.lightPoints.map(lp => ({
          id: lp.id,
          enabled: true,
          type: lp.type,
          intensity: lp.intensity_initial,
          temperature: ((lp.temp_k_initial - 2000) / 8000) * 100,
          location: lp.location,
          // V-Ray precision fields carried from scan
          shape: lp.shape,
          decay: lp.decay ?? 'inverse_square',
          cone_angle: lp.cone_angle,
          directionality: lp.directionality !== undefined ? lp.directionality * 100 : undefined,
          shadow_softness: lp.shadow_softness !== undefined ? lp.shadow_softness * 100 : 50,
          affect_specular: lp.affect_specular ?? true,
          affect_reflections: lp.affect_reflections ?? false,
          bloom_glare: lp.bloom_glare ?? false,
          color_hex: lp.color_hex ?? '#FFFFFF',
          spatial_x_pct: lp.spatial_x_pct,
          spatial_y_pct: lp.spatial_y_pct,
          confidence: lp.confidence,
        }));
      }

      const mirrorMaterial = scan.materials?.find(m => m.reflectancia === 'espelhado');
      if (mirrorMaterial) {
        updates.mirror = {
          enabled: true,
          location: mirrorMaterial.elemento,
          reflectionImage: config.mirror?.reflectionImage,
          reflectionDescription: config.mirror?.reflectionDescription,
        };
      }

      if (Object.keys(updates).length > 0) {
        setConfig(prev => ({
          ...prev,
          ...updates,
        }));
      }
    }
  }, [scan]);

  const handleMoveFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const base64 = event.target?.result as string;
      setImage(base64);
      setMoveScan(null);
      setMoveResult(null);
      setLoading(true);
      setError(null);
      setLoadingMessage('Analisando Potencial de Movimento...');
      try {
        const scanResult = await analyzeMoveImage(base64);
        if (!scanResult) {
          throw new Error('Não foi possível analisar a imagem para movimento.');
        }
        setMoveScan(scanResult);
        setStep('diagnosis');
      } catch (err) {
        console.error('Move Analysis Error:', err);
        setError(err instanceof Error ? err.message : 'Falha ao analisar imagem para movimento.');
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo de imagem.');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEndImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const base64 = event.target?.result as string;
      setEndImage(base64);
      setMoveConfig(prev => ({ ...prev, endImage: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleMoveGenerate = async () => {
    if (!moveScan || !image) return;
    setLoading(true);
    setError(null);
    setLoadingMessage('Orquestrando Movimentos...');
    try {
      const res = await generateMovePrompts(moveScan, moveConfig, image, endImage || undefined);
      setMoveResult(res);
      setStep('result');
    } catch (err) {
      setError('Falha ao gerar prompts de movimento.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const base64 = event.target?.result as string;
      setImage(base64);
      setScan(null);
      setResult(null);
      setGeneratedImage(null);
      setPostProdResult(null);
      setLoading(true);
      setError(null);
      try {
        const scanResult = await analyzeImage(base64);
        console.log('Scan Result:', scanResult);
        if (!scanResult) {
          throw new Error('Não foi possível analisar a imagem. Tente novamente.');
        }
        if (!scanResult.materials || scanResult.materials.length === 0) {
          throw new Error(
            'A IA não conseguiu identificar materiais na imagem. Tente uma foto mais clara.'
          );
        }
        setScan(scanResult);
        setStep('diagnosis');
      } catch (err) {
        console.error('Analysis Error:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Falha ao analisar imagem. Verifique sua conexão e tente novamente.'
        );
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo de imagem.');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleExportMetadata = (opt: any) => {
    const metadata = {
      ...opt,
      baseImage: image ? 'Base64 Image Data' : null,
      config: moveConfig,
      timestamp: new Date().toISOString(),
      app: 'M&Q Studio Move',
    };
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mq-move-metadata-${opt.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [promptNote, setPromptNote] = useState('');
  const [refining, setRefining] = useState(false);

  const handleGenerate = async () => {
    if (!scan || !image) return;
    setLoading(true);
    setError(null);
    try {
      const promptResult = await generatePrompt(scan, config, image);
      setResult(promptResult);
      setStep('result');
    } catch (err) {
      console.error('Generate Prompt Error Details:', {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(err instanceof Error ? err.message : 'Falha ao gerar prompt. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefinePrompt = async () => {
    if (!scan || !image || !promptNote.trim()) return;
    setRefining(true);
    setError(null);
    try {
      const configWithNote = { ...config, refinementNote: promptNote.trim() };
      const promptResult = await generatePrompt(scan, configWithNote, image);
      setResult(promptResult);
      setPromptNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao refinar prompt. Tente novamente.');
    } finally {
      setRefining(false);
    }
  };

  const handleMirrorImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const base64 = event.target?.result as string;
      setConfig(prev => ({
        ...prev,
        mirror: {
          ...prev.mirror!,
          reflectionImage: base64,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratedFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const base64 = event.target?.result as string;
      setGeneratedImage(base64);
      setPostProdResult(null);
      setLoading(true);
      setError(null);
      try {
        if (!image) throw new Error('Imagem original não encontrada.');
        const res = await analyzePostProduction(image, base64, postProdStyle);
        setPostProdResult(res);
      } catch (err) {
        setError('Falha na análise de pós-produção.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDetailFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const base64 = event.target?.result as string;
      setDetailImage(base64);
      setLoading(true);
      setError(null);
      try {
        const res = await analyzeDetailCloses(base64);
        setDetailScanResult(res);
      } catch (err) {
        setError('Falha na análise de detalhes.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  return (
    <main className="pt-24 pb-12 px-6 min-h-screen max-w-7xl mx-auto">
      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4 rotate-45" />
          </button>
        </div>
      )}
      <AnimatePresence mode="wait">
        {step === 'subscription' && (
          <motion.div
            key="subscription"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto py-12"
          >
            <div className="text-center mb-16">
              <Badge className="mb-4">Planos & Assinaturas</Badge>
              <h1 className="text-5xl font-display font-bold text-bluegray mb-6 tracking-tight">
                Escolha o seu <span className="text-gold">Plano</span>
              </h1>
              <p className="text-bluegray/60 text-lg max-w-xl mx-auto leading-relaxed">
                Potencialize seu workflow com ferramentas avançadas de IA para fotografia
                arquitetural.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Basic Plan */}
              <Card className="p-8 flex flex-col relative overflow-hidden">
                <div className="space-y-6 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-bluegray/5 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-bluegray/40" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-bluegray">Basic</h3>
                    <p className="text-sm text-bluegray/60">Ideal para iniciantes no Studio.</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-bluegray">$157.99</span>
                    <span className="text-xs font-bold text-bluegray/40 uppercase tracking-widest">
                      /mês
                    </span>
                  </div>
                  <ul className="space-y-4">
                    {[
                      'Geração de Prompts Ilimitada',
                      'Escaneamento de Imagens (Scan)',
                      'Acesso ao M&Q Move (Base)',
                      'Suporte via Comunidade',
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-bluegray/70">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="outline" className="mt-8 w-full py-6">
                  Assinar Agora
                </Button>
              </Card>

              {/* Premium Plan */}
              <Card className="p-8 flex flex-col relative overflow-hidden border-gold/40 shadow-2xl scale-105 z-10 bg-white">
                <div className="absolute top-0 right-0 gold-gradient px-4 py-1 text-[10px] font-black text-white uppercase tracking-widest rounded-bl-xl">
                  Popular
                </div>
                <div className="space-y-6 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                    <Star className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-bluegray">Premium</h3>
                    <p className="text-sm text-bluegray/60">Para profissionais de alto nível.</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-bluegray">$199</span>
                    <span className="text-xs font-bold text-bluegray/40 uppercase tracking-widest">
                      /mês
                    </span>
                  </div>
                  <ul className="space-y-4">
                    {[
                      'Tudo do plano Basic',
                      '100 Imagens Geradas por Mês',
                      'Prioridade no Processamento',
                      'Suporte Prioritário',
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-bluegray/70">
                        <Check className="w-4 h-4 text-gold" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="gold" className="mt-8 w-full py-6">
                  Assinar Agora
                </Button>
              </Card>

              {/* Enterprise Plan */}
              <Card className="p-8 flex flex-col relative overflow-hidden">
                <div className="space-y-6 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-bluegray/5 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-bluegray/40" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-bluegray">Enterprise</h3>
                    <p className="text-sm text-bluegray/60">Para empresas com alta demanda.</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-bluegray">Sob Consulta</span>
                  </div>
                  <ul className="space-y-4">
                    {[
                      'Tudo do plano Premium',
                      'Cota de Imagens Customizada',
                      'Gerente de Conta Dedicado',
                      'Treinamento para Equipes',
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-bluegray/70">
                        <Check className="w-4 h-4 text-bluegray/40" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  variant="outline"
                  className="mt-8 w-full py-6 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Fale Conosco
                </Button>
              </Card>
            </div>

            {/* Quota Packages */}
            <div className="mt-20 max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-2xl font-display font-bold text-bluegray">
                  Precisa de mais imagens?
                </h2>
                <p className="text-sm text-bluegray/60">Disponível para todos os planos.</p>
              </div>
              <Card className="p-8 bg-offwhite border-none flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <ImagePlus className="w-8 h-8 text-gold" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-bluegray">Pacote de 100 Imagens</h4>
                    <p className="text-sm text-bluegray/60">
                      Adicione créditos extras à sua conta instantaneamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-black text-bluegray">$59.99</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                      Pagamento Único
                    </p>
                  </div>
                  <Button variant="gold" className="px-8">
                    Comprar Créditos
                  </Button>
                </div>
              </Card>
            </div>
          </motion.div>
        )}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto py-12"
          >
            <div className="text-center mb-16">
              <h1 className="text-5xl font-display font-bold text-bluegray mb-6 tracking-tight">
                M&Q <span className="text-gold">STUDIO</span>
              </h1>
              <p className="text-bluegray/60 text-lg max-w-xl mx-auto leading-relaxed">
                Escolha o motor de processamento para iniciar sua jornada criativa.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card
                onClick={() => {
                  setMode('promp');
                  setStep('upload');
                }}
                className="group p-8 cursor-pointer hover:border-gold/40 transition-all hover:shadow-2xl hover:-translate-y-1 bg-white/50 backdrop-blur-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Zap className="w-32 h-32 text-gold" />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="w-8 h-8 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-bluegray mb-2">
                      M&Q PROMP
                    </h3>
                    <p className="text-sm text-bluegray/60 leading-relaxed">
                      Escaneamento de imagem, estudo arquitetônico e geração de prompts fotográficos
                      de alta fidelidade.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-gold font-bold text-xs uppercase tracking-widest">
                    Iniciar Scan <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              <Card
                onClick={() => {
                  setMode('move');
                  setStep('upload');
                }}
                className="group p-8 cursor-pointer hover:border-gold/40 transition-all hover:shadow-2xl hover:-translate-y-1 bg-white/50 backdrop-blur-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Film className="w-32 h-32 text-gold" />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Film className="w-8 h-8 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-bluegray mb-2">M&Q MOVE</h3>
                    <p className="text-sm text-bluegray/60 leading-relaxed">
                      Animação de imagens, movimentos de câmera cinematográficos e transições
                      fluidas para arquitetura.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-gold font-bold text-xs uppercase tracking-widest">
                    Iniciar Animação <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-4 opacity-40 max-w-md mx-auto">
              {[
                { icon: Settings, label: 'Ajustes' },
                { icon: Download, label: 'Exports' },
                { icon: Eye, label: 'Preview' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-3xl mx-auto text-center py-12"
          >
            <div className="flex justify-start mb-8">
              <Button
                variant="ghost"
                onClick={() => setStep('select')}
                className="text-bluegray/40"
              >
                <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                Voltar para seleção
              </Button>
            </div>
            <div className="mb-12">
              <h2 className="text-4xl font-display font-semibold text-bluegray mb-4">
                {mode === 'move' ? 'Inicie a Animação' : 'Inicie o Scan Arquitetônico'}
              </h2>
              <p className="text-bluegray/60 max-w-lg mx-auto">
                {mode === 'move'
                  ? 'Arraste o render que deseja animar para iniciarmos a análise de movimento.'
                  : 'Arraste seu render, planta baixa ou foto de obra para transformar em fotografia real.'}
              </p>
            </div>

            <label className="block">
              <div
                className={cn(
                  'group relative border-2 border-dashed border-bluegray/10 rounded-[32px] p-16 transition-all cursor-pointer hover:border-gold/40 hover:bg-gold/5',
                  loading && 'opacity-50'
                )}
              >
                <input
                  type="file"
                  className="hidden"
                  onChange={mode === 'move' ? handleMoveFileUpload : handleFileUpload}
                  accept="image/*"
                  disabled={loading}
                />
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    {loading ? (
                      <RefreshCw className="w-8 h-8 text-gold animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8 text-gold" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-bluegray">
                      {loading ? loadingMessage : 'Clique ou arraste para enviar'}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest text-bluegray/30">
                      PNG, JPG ou TIFF até 20MB
                    </p>
                    {loading && (
                      <div className="mt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLoading(false);
                            setError(
                              'Análise cancelada. Você pode tentar novamente ou pular o diagnóstico.'
                            );
                          }}
                          className="text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50"
                        >
                          Cancelar Análise
                        </Button>
                      </div>
                    )}
                    {showRetry && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 flex flex-col gap-2"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.reload()}
                          className="text-[10px] uppercase tracking-widest"
                        >
                          A análise está demorando? Clique para recarregar
                        </Button>
                        {showSkip && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setScan({
                                isFloorPlan: false,
                                typology: 'Arquitetura',
                                materials: [],
                                camera: { height_m: 1.6, distance_m: 10, focal_apparent: '35mm' },
                                light: { period: 'Daylight', temp_k: 5600, quality: 'Diffuse' },
                                confidence: {
                                  materials: 0.5,
                                  camera: 0.5,
                                  light: 0.5,
                                  context: 0.5,
                                  general: 0.5,
                                },
                                postProductionStrategy: 'Análise manual necessária.',
                              });
                              setStep('config');
                              setLoading(false);
                            }}
                            className="text-[10px] uppercase tracking-widest text-gold"
                          >
                            Pular Diagnóstico e Configurar Manualmente
                          </Button>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </label>

            <div className="mt-12 grid grid-cols-3 gap-6">
              {[
                { icon: Layout, label: 'Plantas Baixas' },
                { icon: Camera, label: 'Perspectivas' },
                { icon: Palette, label: 'Fotos de Obra' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/50 border border-black/5"
                >
                  <item.icon className="w-5 h-5 text-bluegray/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'diagnosis' && (mode === 'move' ? moveScan : scan) && (
          <motion.div
            key="diagnosis"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid md:grid-cols-2 gap-12"
          >
            {mode === 'move' ? (
              <div className="space-y-8">
                <div>
                  <Badge className="mb-4">MOVE-01 / Análise de Movimento</Badge>
                  <h2 className="text-3xl font-display font-semibold text-bluegray mb-2">
                    Diagnóstico de Mobilidade
                  </h2>
                  <p className="text-bluegray/60">
                    Identificamos o potencial cinematográfico da sua imagem.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-5 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                      Estilo Visual
                    </p>
                    <p className="text-sm font-semibold text-bluegray">
                      {moveScan?.technicalAnalysis.visualStyle}
                    </p>
                  </Card>
                  <Card className="p-5 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                      Ângulo de Câmera
                    </p>
                    <p className="text-sm font-semibold text-bluegray">
                      {moveScan?.cinematicAnalysis.cameraShot}
                    </p>
                  </Card>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                    Elementos Dinâmicos
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {moveScan?.mobilityDiagnosis.dynamicElements.map((el, i) => (
                      <Badge key={i} className="bg-gold/10 text-gold border-none">
                        {el}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                    Sugestões de Movimento
                  </h3>
                  <div className="grid gap-3">
                    {moveScan?.suggestedMovements.map(mov => (
                      <button
                        key={mov.id}
                        onClick={() => {
                          setMoveConfig(prev => ({ ...prev, movementType: mov.name }));
                          setStep('config');
                        }}
                        className={cn(
                          'w-full p-4 rounded-xl text-left transition-all border group hover:border-gold/40 hover:bg-gold/5',
                          moveConfig.movementType === mov.name
                            ? 'border-gold bg-gold/5'
                            : 'bg-white border-black/5'
                        )}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-bold text-bluegray group-hover:text-gold transition-colors">
                            {mov.name}
                          </p>
                          <Badge className="text-[8px] uppercase tracking-tighter">
                            {mov.intensity}
                          </Badge>
                        </div>
                        <p className="text-xs text-bluegray/60 leading-relaxed">
                          {mov.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Refazer Análise
                  </Button>
                  <Button
                    variant="gold"
                    className="flex-1"
                    onClick={() => setStep('config')}
                    disabled={!moveConfig.movementType}
                  >
                    Configurar Animação
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge>TOOL-01 / Scan Arquitetônico</Badge>
                    {scan?.materials?.some(m => m.reflectancia === 'espelhado') && (
                      <Badge className="bg-gold/10 text-gold border-none">Espelho Detectado</Badge>
                    )}
                  </div>
                  <h2 className="text-3xl font-display font-semibold text-bluegray mb-2">
                    Diagnóstico de Cena
                  </h2>
                  <p className="text-bluegray/60">
                    Identificamos os parâmetros técnicos da sua imagem original.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Tipologia', value: scan?.typology || 'N/A', icon: Layout },
                    { label: 'Luz', value: scan?.light?.period || 'N/A', icon: Sun },
                    {
                      label: 'Câmera',
                      value: scan?.camera
                        ? `${scan.camera.height_m}m | ${scan.camera.focal_apparent}`
                        : 'N/A',
                      icon: Camera,
                    },
                    {
                      label: 'Materiais',
                      value: `${scan?.materials?.length || 0} detectados`,
                      icon: Palette,
                    },
                  ].map((item, i) => (
                    <Card key={i} className="flex flex-col gap-3 p-5">
                      <div className="flex items-center justify-between">
                        <item.icon className="w-4 h-4 text-gold" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 mb-1">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-bluegray truncate">{item.value}</p>
                      </div>
                    </Card>
                  ))}
                </div>

                {scan?.isFloorPlan && (
                  <Card className="p-6 bg-gold/5 border-gold/20">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gold mb-4">
                      Ambientes Detectados (Planta)
                    </h3>
                    <div className="space-y-2">
                      {scan.environments?.map(env => (
                        <div key={env.id} className="flex justify-between text-xs">
                          <span className="text-bluegray/60">{env.nome}</span>
                          <span className="font-bold">{env.area_m2}m²</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                    Scores de Confiança
                  </h3>
                  <div className="space-y-4">
                    {scan &&
                      Object.entries(scan.confidence).map(([key, value]) => {
                        const val = value as number;
                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                              <span>{key}</span>
                              <span className={cn(val < 0.6 ? 'text-red-500' : 'text-bluegray')}>
                                {Math.round(val * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-bluegray/5 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${val * 100}%` }}
                                className={cn('h-full', val < 0.6 ? 'bg-red-500' : 'gold-gradient')}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {scan && Object.values(scan.confidence).some(v => (v as number) < 0.6) && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 leading-relaxed">
                      Alguns parâmetros possuem baixa confiança. Recomendamos revisar a imagem ou
                      prosseguir com cautela.
                    </p>
                  </div>
                )}

                {scan?.postProductionStrategy && (
                  <Card className="p-6 bg-bluegray/5 border-bluegray/10">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 mb-4">
                      Estratégia de Pós-Produção
                    </h3>
                    <p className="text-sm text-bluegray leading-relaxed">
                      {scan.postProductionStrategy}
                    </p>
                  </Card>
                )}

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Refazer Scan
                  </Button>
                  <Button variant="gold" className="flex-1" onClick={() => setStep('config')}>
                    Prosseguir para Configuração
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            <div className="relative">
              <div className="sticky top-32">
                <Card className="p-2 overflow-hidden aspect-[4/3] relative group">
                  <img
                    src={image!}
                    alt="Original"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Badge className="bg-white text-bluegray">
                      {mode === 'move' ? 'Base Image' : 'Original Render'}
                    </Badge>
                  </div>
                </Card>
                {mode === 'move' ? (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 rounded-xl bg-bluegray/5 border border-bluegray/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 mb-2">
                        Potencial de Parallax
                      </p>
                      <p className="text-xs text-bluegray font-medium">
                        {moveScan?.mobilityDiagnosis.parallaxPotential}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-50/50 border border-red-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">
                        Restrições de Movimento
                      </p>
                      <ul className="text-xs text-red-600/70 space-y-1">
                        {moveScan?.mobilityDiagnosis.restrictions.map((res, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-red-400" />
                            {res}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {scan?.materials?.map((m, i) => (
                      <Badge key={i} className="bg-white border border-black/5 lowercase">
                        {typeof m === 'string' ? m : m.elemento}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'config' && (
          <motion.div
            key="config"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto"
          >
            {mode === 'move' ? (
              <>
                <div className="text-center mb-12">
                  <Badge className="mb-4">M&Q MOVE / Orquestrador</Badge>
                  <h2 className="text-3xl font-display font-semibold text-bluegray mb-2">
                    Configuração de Movimento
                  </h2>
                  <p className="text-bluegray/60">
                    Ajuste os parâmetros da animação e efeitos cinematográficos.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mb-12">
                  <Card className="p-8 space-y-8">
                    <div className="space-y-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                        <Camera className="w-3 h-3 text-gold" />
                        Tipo de Movimento
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {moveScan?.suggestedMovements.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setMoveConfig({ ...moveConfig, movementType: m.name })}
                            className={cn(
                              'w-full px-4 py-3 rounded-xl text-left transition-all border',
                              moveConfig.movementType === m.name
                                ? 'bg-bluegray text-white border-bluegray shadow-lg'
                                : 'bg-offwhite text-bluegray border-black/5 hover:border-gold/40'
                            )}
                          >
                            <p className="text-xs font-bold">{m.name}</p>
                            <p className="text-[10px] opacity-60 uppercase font-bold">
                              {m.intensity}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-black/5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                        <History className="w-3 h-3 text-gold" />
                        Duração do Vídeo
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {['3s', '5s', '8s', '10s'].map(d => (
                          <button
                            key={d}
                            onClick={() => setMoveConfig({ ...moveConfig, duration: d })}
                            className={cn(
                              'w-full px-6 py-4 rounded-2xl text-center text-sm font-bold transition-all border',
                              moveConfig.duration === d
                                ? 'bg-bluegray text-white border-bluegray shadow-lg'
                                : 'bg-offwhite text-bluegray border-black/5 hover:border-gold/40'
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-black/5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                        <Zap className="w-3 h-3 text-gold" />
                        Efeitos Especiais
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-offwhite border border-black/5">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-bluegray">Time-lapse</p>
                            <p className="text-[10px] text-bluegray/40 uppercase tracking-widest font-bold">
                              Aceleração temporal
                            </p>
                          </div>
                          <Switch
                            checked={moveConfig.isTimeLapse}
                            onChange={val => setMoveConfig({ ...moveConfig, isTimeLapse: val })}
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-offwhite border border-black/5">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-bluegray">Speed Ramp</p>
                            <p className="text-[10px] text-bluegray/40 uppercase tracking-widest font-bold">
                              Variação de velocidade
                            </p>
                          </div>
                          <Switch
                            checked={moveConfig.isSpeedRamp}
                            onChange={val => setMoveConfig({ ...moveConfig, isSpeedRamp: val })}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <div className="space-y-6">
                    <Card className="p-8 space-y-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 text-gold" />
                        Animação na Cena
                      </h3>
                      <textarea
                        placeholder="Descreva o que acontece na cena (ex: pessoas caminhando, carros passando, luzes piscando...)"
                        value={moveConfig.sceneAnimation}
                        onChange={e =>
                          setMoveConfig({ ...moveConfig, sceneAnimation: e.target.value })
                        }
                        className="w-full h-32 p-4 rounded-2xl bg-offwhite border border-black/5 text-sm focus:outline-none focus:border-gold/50 transition-all resize-none"
                      />
                      <p className="text-[10px] text-bluegray/40 italic">
                        Deixe em branco para manter a cena estática com foco apenas no movimento de
                        câmera.
                      </p>
                    </Card>

                    <Card className="p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                          <Move className="w-3 h-3 text-gold" />
                          Modo Transição (I2I)
                        </h3>
                        <Switch
                          checked={moveConfig.isTransition}
                          onChange={val => setMoveConfig({ ...moveConfig, isTransition: val })}
                        />
                      </div>

                      {moveConfig.isTransition && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="space-y-4 pt-4 border-t border-black/5"
                        >
                          <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                            Imagem Final (End Image)
                          </label>
                          <div className="relative group">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleEndImageUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                              className={cn(
                                'aspect-video rounded-2xl bg-offwhite border border-dashed border-bluegray/10 flex flex-col items-center justify-center p-4 text-center transition-all group-hover:border-gold/30',
                                endImage && 'border-solid border-gold/50 bg-gold/5'
                              )}
                            >
                              {endImage ? (
                                <img
                                  src={endImage}
                                  alt="End Frame"
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : (
                                <>
                                  <Upload className="w-5 h-5 text-gold mb-2" />
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                    Upload da imagem de destino
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </Card>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full max-w-md py-5 text-lg"
                    onClick={handleMoveGenerate}
                    disabled={loading}
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-5 h-5 mr-2" />
                    )}
                    Gerar Orquestração de Movimento
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-12">
                  <Badge className="mb-4">TOOL-WORKFLOW / Orquestrador</Badge>
                  <h2 className="text-3xl font-display font-semibold text-bluegray mb-2">
                    {scan?.isFloorPlan ? 'Humanização de Planta' : 'Configuração Cinematográfica'}
                  </h2>
                  <p className="text-bluegray/60">
                    {scan?.isFloorPlan
                      ? 'Defina o ângulo aéreo e o estilo de humanização.'
                      : 'Ajuste o tom e o formato de saída do seu prompt.'}
                  </p>
                </div>

                {scan?.isFloorPlan ? (
                  <div className="space-y-6 mb-12">
                    <div className="grid md:grid-cols-3 gap-6">
                      <Card className="p-6 space-y-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                          Ângulo Aéreo
                        </h3>
                        <div className="space-y-2">
                          {[
                            { id: '90', label: 'Vertical 90°', desc: 'Planta Zenital' },
                            { id: '45', label: 'Perspectiva 45°', desc: 'Volume + Terreno' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setConfig({ ...config, angle: opt.id })}
                              className={cn(
                                'w-full p-4 rounded-xl text-left transition-all border',
                                config.angle === opt.id
                                  ? 'bg-bluegray text-white'
                                  : 'bg-offwhite hover:border-gold/40'
                              )}
                            >
                              <p className="text-sm font-bold">{opt.label}</p>
                              <p className="text-[10px] opacity-60 uppercase font-bold">
                                {opt.desc}
                              </p>
                            </button>
                          ))}
                        </div>
                      </Card>

                      <Card className="p-6 space-y-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                          Regime de Luz
                        </h3>
                        <div className="space-y-2">
                          {[
                            { id: 'manha', label: 'Manhã', desc: 'Sombras longas 5500K' },
                            { id: 'meio-dia', label: 'Meio Dia', desc: 'Sol vertical 6000K' },
                            { id: 'outono', label: 'Outono', desc: 'Luz suave e tons quentes' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setConfig({ ...config, lightTemp: opt.id })}
                              className={cn(
                                'w-full p-4 rounded-xl text-left transition-all border',
                                config.lightTemp === opt.id
                                  ? 'bg-bluegray text-white'
                                  : 'bg-offwhite hover:border-gold/40'
                              )}
                            >
                              <p className="text-sm font-bold">{opt.label}</p>
                              <p className="text-[10px] opacity-60 uppercase font-bold">
                                {opt.desc}
                              </p>
                            </button>
                          ))}
                        </div>
                      </Card>

                      <Card className="p-6 space-y-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                          Estilo
                        </h3>
                        <div className="space-y-2">
                          {[
                            { id: 'minimalista', label: 'Minimalista', desc: 'Paleta neutra' },
                            { id: 'contemporaneo', label: 'Contemporâneo', desc: 'Design moderno' },
                            { id: 'premium', label: 'Premium', desc: 'Materiais de luxo' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setConfig({ ...config, style: opt.id })}
                              className={cn(
                                'w-full p-4 rounded-xl text-left transition-all border',
                                config.style === opt.id
                                  ? 'bg-bluegray text-white'
                                  : 'bg-offwhite hover:border-gold/40'
                              )}
                            >
                              <p className="text-sm font-bold">{opt.label}</p>
                              <p className="text-[10px] opacity-60 uppercase font-bold">
                                {opt.desc}
                              </p>
                            </button>
                          ))}
                        </div>
                      </Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <Card className="p-6 space-y-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                          Contexto Externo
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'urban', label: 'Urbano' },
                            { id: 'condo', label: 'Condomínio' },
                            { id: 'rural', label: 'Rural' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() =>
                                setConfig({ ...config, externalContext: opt.id as any })
                              }
                              className={cn(
                                'p-3 rounded-xl text-center transition-all border text-[10px] font-bold uppercase tracking-widest',
                                config.externalContext === opt.id
                                  ? 'bg-bluegray text-white'
                                  : 'bg-offwhite hover:border-gold/40'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-bluegray/40 italic">
                          Define a ambientação do que está fora do desenho da planta.
                        </p>
                      </Card>

                      <Card className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                            Configuração de Prédio
                          </h3>
                          <Switch
                            checked={config.isBuilding}
                            onChange={val => setConfig({ ...config, isBuilding: val })}
                          />
                        </div>

                        {config.isBuilding && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="space-y-4 pt-4 border-t border-black/5"
                          >
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                Andar / Pavimento
                              </label>
                              <div className="flex items-center gap-4">
                                <input
                                  type="number"
                                  min="1"
                                  value={config.floorLevel}
                                  onChange={e =>
                                    setConfig({
                                      ...config,
                                      floorLevel: parseInt(e.target.value) || 1,
                                    })
                                  }
                                  className="w-24 p-2 rounded-xl bg-offwhite border border-black/5 text-sm font-bold text-bluegray focus:outline-none focus:border-gold/50"
                                />
                                <span className="text-xs text-bluegray/40 uppercase font-bold tracking-widest">
                                  º Pavimento
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </Card>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                      <Card className="p-8 space-y-8">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2 mb-6">
                            <Sun className="w-3 h-3 text-gold" />
                            Iluminação e Clima da Cena
                          </h3>

                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                  Período
                                </label>
                                <div className="flex bg-offwhite p-1 rounded-xl border border-black/5">
                                  {['day', 'night'].map(period => (
                                    <button
                                      key={period}
                                      onClick={() =>
                                        setConfig({
                                          ...config,
                                          dayNight: period as any,
                                          environment: period === 'day' ? 'sunny' : 'dark',
                                        })
                                      }
                                      className={cn(
                                        'flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize',
                                        config.dayNight === period
                                          ? 'bg-white text-bluegray shadow-sm'
                                          : 'text-bluegray/40 hover:text-bluegray'
                                      )}
                                    >
                                      {period === 'day' ? 'Dia' : 'Noite'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                  Horário
                                </label>
                                <input
                                  type="time"
                                  value={config.time}
                                  onChange={e => setConfig({ ...config, time: e.target.value })}
                                  className="w-full px-4 py-2 bg-offwhite border border-black/5 rounded-xl text-sm font-bold text-bluegray focus:outline-none focus:border-gold/50"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                Clima / Ambiente
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {(config.dayNight === 'day'
                                  ? ['bright', 'sunny', 'raining', 'hot']
                                  : ['dark', 'raining']
                                ).map(env => (
                                  <button
                                    key={env}
                                    onClick={() =>
                                      setConfig({ ...config, environment: env as any })
                                    }
                                    className={cn(
                                      'p-2 rounded-lg text-center transition-all border text-[10px] font-bold uppercase',
                                      config.environment === env
                                        ? 'bg-bluegray text-white border-bluegray'
                                        : 'bg-offwhite hover:border-gold/40'
                                    )}
                                  >
                                    {env === 'bright'
                                      ? 'Claro'
                                      : env === 'sunny'
                                        ? 'Ensolarado'
                                        : env === 'raining'
                                          ? 'Chuvoso'
                                          : env === 'hot'
                                            ? 'Quente'
                                            : 'Escuro'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-black/5">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                  Intensidade da Luz Global
                                </label>
                                <span className="text-[10px] font-bold text-gold">
                                  {config.overallIntensity}%
                                </span>
                              </div>
                              <Slider
                                value={config.overallIntensity}
                                onChange={val => setConfig({ ...config, overallIntensity: val })}
                                max={100}
                                step={1}
                              />
                              <div className="flex justify-between text-[8px] uppercase tracking-widest text-bluegray/30 font-bold">
                                <span>Muito Escura</span>
                                <span>Equilibrada</span>
                                <span>Muito Clara</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-8 space-y-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2 mb-2">
                          <Zap className="w-3 h-3 text-gold" />
                          Sistema de Luzes Artificiais ({config.lightPoints.length})
                        </h3>

                        {config.lightPoints.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-black/10 rounded-2xl bg-offwhite">
                            <p className="text-xs text-bluegray/50 italic">
                              Nenhum ponto explícito de luz detectado na base.
                            </p>
                          </div>
                        ) : (
                          <div
                            className="space-y-4 overflow-y-auto pr-2"
                            style={{ maxHeight: '420px' }}
                          >
                            {config.lightPoints.map((lp, idx) => (
                              <div
                                key={lp.id}
                                className={cn(
                                  'p-4 rounded-xl border transition-all',
                                  lp.enabled
                                    ? 'bg-white border-gold/30 shadow-sm'
                                    : 'bg-offwhite border-black/5 opacity-60'
                                )}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 flex-1 mr-4">
                                    <Badge className="bg-gold/10 text-gold text-[9px] px-1.5 py-0 shrink-0">
                                      L{idx + 1}
                                    </Badge>
                                    <div className="flex flex-col flex-1">
                                      <span
                                        className="text-xs font-bold text-bluegray uppercase mb-1 truncate"
                                        title={lp.location}
                                      >
                                        {lp.location}
                                      </span>
                                      <input
                                        type="text"
                                        value={lp.type}
                                        onChange={e => {
                                          const newLps = [...config.lightPoints];
                                          newLps[idx].type = e.target.value;
                                          setConfig({ ...config, lightPoints: newLps });
                                        }}
                                        className="text-[10px] text-bluegray/80 bg-transparent border-b border-black/10 focus:outline-none focus:border-gold w-full transition-colors"
                                        placeholder="Tipo de luz (ex: Spot)"
                                        disabled={!lp.enabled}
                                      />
                                    </div>
                                  </div>
                                  <Switch
                                    checked={lp.enabled}
                                    onChange={val => {
                                      const newLps = [...config.lightPoints];
                                      newLps[idx].enabled = val;
                                      setConfig({ ...config, lightPoints: newLps });
                                    }}
                                  />
                                </div>

                                {lp.enabled && (
                                  <div className="space-y-4 pt-3 border-t border-black/5 animate-in slide-in-from-top-2">
                                    {/* ── Intensidade ── */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-bluegray/40">
                                          Intensidade Local
                                        </label>
                                        <span className="text-[9px] font-bold text-bluegray">
                                          {Math.round(lp.intensity)}%
                                        </span>
                                      </div>
                                      <Slider
                                        value={lp.intensity}
                                        onChange={val => {
                                          const newLps = [...config.lightPoints];
                                          newLps[idx].intensity = val;
                                          setConfig({ ...config, lightPoints: newLps });
                                        }}
                                        max={100}
                                        step={1}
                                        className="py-1 line-clamp-none h-auto"
                                      />
                                    </div>

                                    {/* ── Temperatura de Cor ── */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-bluegray/40">
                                          Temperatura de Cor
                                        </label>
                                        <span className="text-[9px] font-bold text-bluegray">
                                          {Math.round(2000 + (lp.temperature / 100) * 8000)}K
                                        </span>
                                      </div>
                                      <Slider
                                        value={lp.temperature}
                                        onChange={val => {
                                          const newLps = [...config.lightPoints];
                                          newLps[idx].temperature = val;
                                          setConfig({ ...config, lightPoints: newLps });
                                        }}
                                        max={100}
                                        step={1}
                                        className="py-1 line-clamp-none h-auto bg-gradient-to-r from-orange-200 via-white to-blue-200 rounded-full"
                                      />
                                      <div className="flex justify-between text-[8px] uppercase tracking-widest text-bluegray/40 font-bold">
                                        <span className="text-orange-500">Quente 2000K</span>
                                        <span className="text-blue-500">Fria 10000K</span>
                                      </div>
                                    </div>

                                    {/* ── Parâmetros V-Ray ── */}
                                    <div className="pt-3 border-t border-gold/15 space-y-4">
                                      <p className="text-[8px] uppercase tracking-widest font-bold text-gold/60 flex items-center gap-1.5">
                                        <Zap className="w-2.5 h-2.5" />
                                        Parâmetros V-Ray
                                      </p>

                                      {/* Decaimento */}
                                      <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-bluegray/40">
                                          Decaimento
                                        </label>
                                        <select
                                          value={lp.decay ?? 'inverse_square'}
                                          onChange={e => {
                                            const newLps = [...config.lightPoints];
                                            newLps[idx] = {
                                              ...newLps[idx],
                                              decay: e.target.value as
                                                | 'inverse_square'
                                                | 'linear'
                                                | 'none',
                                            };
                                            setConfig({ ...config, lightPoints: newLps });
                                          }}
                                          className="text-[9px] font-bold text-bluegray bg-offwhite border border-black/10 rounded-lg px-2 py-1 focus:outline-none focus:border-gold"
                                        >
                                          <option value="inverse_square">
                                            Quadrado Inverso (físico)
                                          </option>
                                          <option value="linear">Linear</option>
                                          <option value="none">Sem Decaimento</option>
                                        </select>
                                      </div>

                                      {/* Suavidade da Sombra */}
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <label className="text-[9px] font-bold uppercase tracking-widest text-bluegray/40">
                                            Penumbra da Sombra
                                          </label>
                                          <span className="text-[9px] font-bold text-bluegray">
                                            {Math.round(lp.shadow_softness ?? 50)}%
                                          </span>
                                        </div>
                                        <Slider
                                          value={lp.shadow_softness ?? 50}
                                          onChange={val => {
                                            const newLps = [...config.lightPoints];
                                            newLps[idx] = { ...newLps[idx], shadow_softness: val };
                                            setConfig({ ...config, lightPoints: newLps });
                                          }}
                                          max={100}
                                          step={1}
                                          className="py-1 line-clamp-none h-auto"
                                        />
                                        <div className="flex justify-between text-[8px] uppercase tracking-widest text-bluegray/30 font-bold">
                                          <span>Aresta Sharp</span>
                                          <span>Penumbra Total</span>
                                        </div>
                                      </div>

                                      {/* Direcionalidade — apenas rectangle/emissive */}
                                      {(lp.type === 'rectangle' || lp.type === 'emissive') && (
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-bluegray/40">
                                              Direcionalidade
                                            </label>
                                            <span className="text-[9px] font-bold text-bluegray">
                                              {Math.round(lp.directionality ?? 50)}%
                                            </span>
                                          </div>
                                          <Slider
                                            value={lp.directionality ?? 50}
                                            onChange={val => {
                                              const newLps = [...config.lightPoints];
                                              newLps[idx] = { ...newLps[idx], directionality: val };
                                              setConfig({ ...config, lightPoints: newLps });
                                            }}
                                            max={100}
                                            step={1}
                                            className="py-1 line-clamp-none h-auto"
                                          />
                                          <div className="flex justify-between text-[8px] uppercase tracking-widest text-bluegray/30 font-bold">
                                            <span>Difuso 360°</span>
                                            <span>Feixe Colimado</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Cone — apenas spot/ies */}
                                      {(lp.type === 'spot' || lp.type === 'ies') && (
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-bluegray/40">
                                              Ângulo do Cone
                                            </label>
                                            <span className="text-[9px] font-bold text-bluegray">
                                              {Math.round(lp.cone_angle ?? 30)}°
                                            </span>
                                          </div>
                                          <Slider
                                            value={lp.cone_angle ?? 30}
                                            onChange={val => {
                                              const newLps = [...config.lightPoints];
                                              newLps[idx] = { ...newLps[idx], cone_angle: val };
                                              setConfig({ ...config, lightPoints: newLps });
                                            }}
                                            max={120}
                                            step={1}
                                            className="py-1 line-clamp-none h-auto"
                                          />
                                          <div className="flex justify-between text-[8px] uppercase tracking-widest text-bluegray/30 font-bold">
                                            <span>Narrow 5°</span>
                                            <span>Flood 120°</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Toggles: Especular / Reflexos / Bloom */}
                                      <div className="grid grid-cols-3 gap-2 pt-1">
                                        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-offwhite">
                                          <label className="text-[8px] font-bold uppercase tracking-widest text-bluegray/40 text-center leading-tight">
                                            Especular
                                          </label>
                                          <Switch
                                            checked={lp.affect_specular ?? true}
                                            onChange={val => {
                                              const newLps = [...config.lightPoints];
                                              newLps[idx] = {
                                                ...newLps[idx],
                                                affect_specular: val,
                                              };
                                              setConfig({ ...config, lightPoints: newLps });
                                            }}
                                          />
                                        </div>
                                        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-offwhite">
                                          <label className="text-[8px] font-bold uppercase tracking-widest text-bluegray/40 text-center leading-tight">
                                            Reflexos
                                          </label>
                                          <Switch
                                            checked={lp.affect_reflections ?? false}
                                            onChange={val => {
                                              const newLps = [...config.lightPoints];
                                              newLps[idx] = {
                                                ...newLps[idx],
                                                affect_reflections: val,
                                              };
                                              setConfig({ ...config, lightPoints: newLps });
                                            }}
                                          />
                                        </div>
                                        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-offwhite">
                                          <label className="text-[8px] font-bold uppercase tracking-widest text-bluegray/40 text-center leading-tight">
                                            Bloom
                                          </label>
                                          <Switch
                                            checked={lp.bloom_glare ?? false}
                                            onChange={val => {
                                              const newLps = [...config.lightPoints];
                                              newLps[idx] = { ...newLps[idx], bloom_glare: val };
                                              setConfig({ ...config, lightPoints: newLps });
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {/* Cor hex + Confiança */}
                                      <div className="flex items-center gap-3">
                                        <label className="text-[8px] font-bold uppercase tracking-widest text-bluegray/40 shrink-0">
                                          Cor da Luz
                                        </label>
                                        <div className="flex items-center gap-2 flex-1">
                                          <div
                                            className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-sm"
                                            style={{ backgroundColor: lp.color_hex ?? '#FFFFFF' }}
                                          />
                                          <input
                                            type="text"
                                            value={lp.color_hex ?? '#FFFFFF'}
                                            onChange={e => {
                                              const newLps = [...config.lightPoints];
                                              newLps[idx] = {
                                                ...newLps[idx],
                                                color_hex: e.target.value,
                                              };
                                              setConfig({ ...config, lightPoints: newLps });
                                            }}
                                            className="text-[9px] font-mono text-bluegray/80 bg-transparent border-b border-black/10 focus:outline-none focus:border-gold w-full"
                                            placeholder="#FFFFFF"
                                          />
                                        </div>
                                        {lp.confidence !== undefined && (
                                          <Badge
                                            className={cn(
                                              'text-[8px] px-2 py-0.5 shrink-0 font-bold',
                                              lp.confidence >= 80
                                                ? 'bg-green-100 text-green-700'
                                                : lp.confidence >= 50
                                                  ? 'bg-amber-100 text-amber-700'
                                                  : 'bg-red-100 text-red-600'
                                            )}
                                          >
                                            {lp.confidence}% conf.
                                          </Badge>
                                        )}
                                      </div>

                                      {/* Posição espacial (leitura) */}
                                      {lp.spatial_x_pct !== undefined &&
                                        lp.spatial_y_pct !== undefined && (
                                          <div className="flex items-center gap-2 text-[8px] font-mono text-bluegray/30">
                                            <Eye className="w-2.5 h-2.5 shrink-0" />
                                            <span>
                                              X:{Math.round(lp.spatial_x_pct)}% Y:
                                              {Math.round(lp.spatial_y_pct)}%
                                            </span>
                                            {lp.shape && (
                                              <span className="text-bluegray/25">· {lp.shape}</span>
                                            )}
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                      <Card className="p-8 space-y-8">
                        <div className="space-y-6">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                            <Zap className="w-3 h-3 text-gold" />
                            Modo Cinematográfico
                          </h3>
                          <div className="grid grid-cols-1 gap-3">
                            {[
                              'Natural Light',
                              'Golden Hour',
                              'Blue Hour',
                              'Moody / Foggy',
                              'Interior Soft',
                            ].map(mode => (
                              <button
                                key={mode}
                                onClick={() => setConfig({ ...config, cinematicMode: mode })}
                                className={cn(
                                  'w-full px-6 py-4 rounded-2xl text-left text-sm font-medium transition-all border',
                                  config.cinematicMode === mode
                                    ? 'bg-bluegray text-white border-bluegray shadow-lg'
                                    : 'bg-offwhite text-bluegray border-black/5 hover:border-gold/40'
                                )}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                            <FileText className="w-3 h-3 text-gold" />
                            Formato de Saída
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { id: 'single', label: 'Prompt Único', desc: '10 segmentos' },
                              { id: 'blocks', label: 'Em Blocos', desc: 'B1 → B6' },
                            ].map(item => (
                              <button
                                key={item.id}
                                onClick={() => setConfig({ ...config, mode: item.id as any })}
                                className={cn(
                                  'p-6 rounded-2xl text-center transition-all border',
                                  config.mode === item.id
                                    ? 'bg-bluegray text-white border-bluegray shadow-lg'
                                    : 'bg-offwhite text-bluegray border-black/5 hover:border-gold/40'
                                )}
                              >
                                <p className="text-sm font-bold mb-1">{item.label}</p>
                                <p className="text-[10px] opacity-60 uppercase tracking-widest font-bold">
                                  {item.desc}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </Card>

                      <div className="space-y-6">
                        <Card className="p-8 space-y-6">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                            Completação de Cena
                          </h3>
                          <div className="grid grid-cols-1 gap-3">
                            {[
                              'Fidelidade Máxima',
                              'Mais Vegetação',
                              'Uso Humano Ativo',
                              'Minimalismo Puro',
                              'Contexto Urbano',
                            ].map(opt => (
                              <button
                                key={opt}
                                onClick={() => setConfig({ ...config, completion: opt })}
                                className={cn(
                                  'w-full px-6 py-4 rounded-2xl text-left text-sm font-medium transition-all border',
                                  config.completion === opt
                                    ? 'bg-bluegray text-white border-bluegray shadow-lg'
                                    : 'bg-offwhite text-bluegray border-black/5 hover:border-gold/40'
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </Card>

                        <Card className="p-8 space-y-6">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                            Fidelidade & Ambiente
                          </h3>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-offwhite border border-black/5">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-bluegray">
                                  Manter Acessórios Genuínos
                                </p>
                                <p className="text-[10px] text-bluegray/40 uppercase tracking-widest font-bold">
                                  Bloqueia novos itens da IA
                                </p>
                              </div>
                              <Switch
                                checked={config.accessoryControl === 'maintain'}
                                onChange={val =>
                                  setConfig({
                                    ...config,
                                    accessoryControl: val ? 'maintain' : 'increase',
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-offwhite border border-black/5">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-bluegray">
                                  Fidelidade Total de Material
                                </p>
                                <p className="text-[10px] text-bluegray/40 uppercase tracking-widest font-bold">
                                  Mantém texturas rigorosamente
                                </p>
                              </div>
                              <Switch
                                checked={config.materialFidelity}
                                onChange={val => setConfig({ ...config, materialFidelity: val })}
                              />
                            </div>

                            <div className="space-y-2 pt-4 border-t border-black/5">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                Estação do Ano
                              </label>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { id: 'spring', label: 'Primavera' },
                                  { id: 'summer', label: 'Verão' },
                                  { id: 'autumn', label: 'Outono' },
                                  { id: 'winter', label: 'Inverno' },
                                ].map(season => (
                                  <button
                                    key={season.id}
                                    onClick={() =>
                                      setConfig({ ...config, season: season.id as any })
                                    }
                                    className={cn(
                                      'p-2 rounded-lg text-center transition-all border text-[9px] font-bold uppercase',
                                      config.season === season.id
                                        ? 'bg-bluegray text-white border-bluegray'
                                        : 'bg-offwhite hover:border-gold/40'
                                    )}
                                  >
                                    {season.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </Card>

                        <Card className="p-8 space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                              <Layers className="w-3 h-3 text-gold" />
                              Espelho / Reflexo
                            </h3>
                            <Switch
                              checked={config.mirror?.enabled || false}
                              onChange={val =>
                                setConfig({
                                  ...config,
                                  mirror: { ...config.mirror!, enabled: val },
                                })
                              }
                            />
                          </div>

                          {config.mirror?.enabled && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              className="space-y-4 pt-4 border-t border-black/5"
                            >
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                  Localização do Espelho
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: Parede lateral, teto, móvel específico..."
                                  value={config.mirror?.location || ''}
                                  onChange={e =>
                                    setConfig({
                                      ...config,
                                      mirror: { ...config.mirror!, location: e.target.value },
                                    })
                                  }
                                  className="w-full p-3 rounded-xl bg-offwhite border border-black/5 text-sm focus:outline-none focus:border-gold/50 transition-all"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                  Imagem para Refletir
                                </label>
                                <div className="relative group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleMirrorImageUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  />
                                  <div
                                    className={cn(
                                      'aspect-video rounded-2xl bg-offwhite border border-dashed border-bluegray/10 flex flex-col items-center justify-center p-4 text-center transition-all group-hover:border-gold/30',
                                      config.mirror?.reflectionImage &&
                                        'border-solid border-gold/50 bg-gold/5'
                                    )}
                                  >
                                    {config.mirror?.reflectionImage ? (
                                      <img
                                        src={config.mirror.reflectionImage}
                                        alt="Reflection"
                                        className="w-full h-full object-cover rounded-xl"
                                      />
                                    ) : (
                                      <>
                                        <ImagePlus className="w-5 h-5 text-gold mb-2" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                          Upload da imagem que será refletida
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
                                  Descrição do Reflexo
                                </label>
                                <textarea
                                  placeholder="Descreva o que deve ser visto no reflexo..."
                                  value={config.mirror?.reflectionDescription || ''}
                                  onChange={e =>
                                    setConfig({
                                      ...config,
                                      mirror: {
                                        ...config.mirror!,
                                        reflectionDescription: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full h-20 p-3 rounded-xl bg-offwhite border border-black/5 text-sm focus:outline-none focus:border-gold/50 transition-all resize-none"
                                />
                              </div>
                            </motion.div>
                          )}
                        </Card>

                        <div className="p-6 rounded-2xl bg-gold/5 border border-gold/20">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gold mb-2">
                            Regra Zero Ativa
                          </p>
                          <p className="text-xs text-bluegray/60 leading-relaxed italic">
                            "O sistema irá remover automaticamente qualquer termo de renderização
                            (vray, octane, render) para garantir realismo fotográfico."
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-center">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full max-w-md py-5 text-lg"
                    onClick={handleGenerate}
                    disabled={loading}
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-5 h-5 mr-2" />
                    )}
                    <span>Gerar Prompt Fotográfico</span>
                  </Button>
                </div>

                {scan?.postProductionStrategy && (
                  <div className="max-w-md mx-auto mt-8 p-6 rounded-2xl bg-bluegray/10 border border-bluegray/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/60 mb-2">
                      Estratégia de Pós-Produção Sugerida
                    </p>
                    <p className="text-xs text-bluegray font-medium leading-relaxed italic">
                      "{scan.postProductionStrategy}"
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {step === 'result' && (mode === 'move' ? moveResult : result) && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto space-y-12"
          >
            <div className="flex items-center justify-between">
              <div>
                <Badge className="mb-4">
                  {mode === 'move' ? 'MOVE-03 / Orquestração Final' : 'TOOL-02 / Prompt Final'}
                </Badge>
                <h2 className="text-3xl font-display font-semibold text-bluegray">
                  {mode === 'move' ? 'Prompts de Movimento' : 'Resultado Gerado 🇧🇷'}
                </h2>
              </div>
              {mode === 'promp' && result && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40 mb-1">
                      M&Q Score
                    </p>
                    <p className="text-2xl font-display font-bold text-gold">{result.score}/100</p>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 border-gold/20 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {mode === 'move' ? (
              <div className="grid gap-6">
                {moveResult?.options.map(opt => (
                  <Card key={opt.id} className="p-8 group hover:border-gold/40 transition-all">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-1 space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                              <Move className="w-5 h-5 text-gold" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-bluegray">{opt.name}</h3>
                              <p className="text-[10px] text-bluegray/40 uppercase tracking-widest font-bold">
                                {opt.simulatedEquipment}
                              </p>
                            </div>
                          </div>
                          <Badge>{opt.intensity}</Badge>
                        </div>

                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-offwhite border border-black/5 relative">
                            <button
                              onClick={() => copyToClipboard(opt.prompt)}
                              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gold/10 text-bluegray hover:text-gold transition-all"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/30 mb-2">
                              Prompt (PT-BR)
                            </p>
                            <p className="text-sm text-bluegray font-mono leading-relaxed pr-10">
                              {opt.prompt}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="w-full md:w-64 space-y-4">
                        <div className="aspect-video rounded-xl bg-black/5 overflow-hidden relative">
                          <img
                            src={image!}
                            alt="Preview"
                            className="w-full h-full object-cover opacity-50"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="w-8 h-8 text-bluegray/20" />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full text-[10px] uppercase tracking-widest font-bold"
                          onClick={() => handleExportMetadata(opt)}
                        >
                          <Download className="w-4 h-4 mr-2 text-gold" />
                          Exportar Metadata
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : config.mode === 'single' ? (
              <div className="space-y-8">
                <Card className="p-8 relative group">
                  <div className="absolute top-6 right-6 flex gap-2">
                    <Badge className="bg-green-500 text-white border-none">PT-BR VALIDADO</Badge>
                    <button
                      onClick={() => copyToClipboard(result!.positive)}
                      className="p-2 rounded-lg bg-bluegray/5 hover:bg-gold/10 text-bluegray hover:text-gold transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 mb-6">
                    Prompt Positivo
                  </h3>
                  <p className="text-lg text-bluegray leading-relaxed font-light italic">
                    {result!.positive}
                  </p>
                </Card>

                <Card className="p-8 bg-red-50/30 border-red-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-red-500/60">
                      Negative Prompt
                    </h3>
                    <button
                      onClick={() => copyToClipboard(result!.negative)}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-red-900/60 leading-relaxed">{result!.negative}</p>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(result?.blocks || {}).map(([key, value]) => {
                  const val = value as string;
                  return (
                    <Card key={key} className="p-6 flex flex-col justify-between group">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <Badge className="bg-bluegray/5 text-bluegray">{key.toUpperCase()}</Badge>
                          <button
                            onClick={() => copyToClipboard(val)}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 bg-gold/10 text-gold transition-all"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-sm text-bluegray/80 leading-relaxed line-clamp-4">
                          {val}
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-black/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
                          {key === 'b1' && 'Arquitetura Base'}
                          {key === 'b2' && 'Config. Câmera'}
                          {key === 'b3' && 'Orquestração de Luz'}
                          {key === 'b4' && 'Interior / Atmosfera'}
                          {key === 'b5' && 'Exterior / Contexto'}
                          {key === 'b6' && 'Materialidade'}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ── Refinamento de Prompt ── */}
            {mode === 'promp' && (
              <Card className="p-8 space-y-5 border-gold/20 bg-gold/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 flex items-center gap-2">
                      <RefreshCw className="w-3 h-3 text-gold" />
                      Refinar Prompt
                    </h3>
                    <p className="text-[11px] text-bluegray/50 mt-1">
                      Descreva as alterações que deseja. O prompt será regenerado mantendo toda a
                      análise.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('config')}
                    className="shrink-0 text-[10px] uppercase tracking-widest font-bold"
                  >
                    <Settings className="w-3 h-3 mr-1.5" />
                    Voltar às Configurações
                  </Button>
                </div>
                <textarea
                  value={promptNote}
                  onChange={e => setPromptNote(e.target.value)}
                  placeholder="Ex: adicione mais detalhes sobre a iluminação lateral, mude o ângulo da câmera para 24mm, enfatize a textura do concreto..."
                  rows={4}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-bluegray placeholder:text-bluegray/30 focus:outline-none focus:border-gold resize-none leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button
                    variant="gold"
                    onClick={handleRefinePrompt}
                    disabled={!promptNote.trim() || refining}
                    className="min-w-[160px]"
                  >
                    {refining ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Refinando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Aplicar Refinamento
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}

            <div className="flex flex-col items-center gap-8 pt-12 border-t border-black/5">
              <div className="text-center">
                <h3 className="text-xl font-display font-semibold text-bluegray mb-2">
                  {mode === 'move' ? 'Próximo Passo: Renderização' : 'Próximo Passo: Pós-Produção'}
                </h3>
                <p className="text-bluegray/60 text-sm">
                  {mode === 'move'
                    ? 'Use os prompts acima em ferramentas como Luma Dream Machine, Kling ou Runway.'
                    : 'Gere sua imagem no Midjourney/SD/Flux e envie de volta para calibração técnica.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Nova Sessão
                </Button>
                {mode === 'promp' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setStep('generate-image')}
                      className="border-purple-500/30 text-purple-600 hover:bg-purple-50"
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      Gerar Imagem (Premium)
                    </Button>
                    <Button
                      variant="outline"
                      className="border-gold text-gold hover:bg-gold/5"
                      onClick={() => setStep('detail-scan')}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Scan de Detalhes (Closes)
                    </Button>
                    <Button variant="gold" onClick={() => setStep('post-production')}>
                      Ir para Pós-Produção
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </>
                )}
                {mode === 'move' && (
                  <Button variant="gold" onClick={() => setStep('select')}>
                    Voltar ao Início
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'generate-image' && (
          <motion.div
            key="generate-image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto space-y-12"
          >
            <div className="text-center mb-12">
              <Badge className="bg-purple-500/20 text-purple-600 mb-4 border-none">
                PREMIUM FEATURE
              </Badge>
              <h2 className="text-3xl font-display font-semibold text-bluegray mb-2">
                Geração de Imagem
              </h2>
              <p className="text-bluegray/60 max-w-lg mx-auto">
                Crie um render conceitual instantâneo com{' '}
                {genModel === 'flash' ? 'Nano Banana Flash' : 'Nano Banana Pro'}.
              </p>
              {creditStatus != null && (
                <div className="inline-flex items-center gap-3 mt-4 px-5 py-2.5 rounded-full bg-amber-50 border border-amber-200">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700">
                    {creditStatus.credits_available.toLocaleString('pt-BR')} créditos disponíveis
                  </span>
                  <span className="text-[10px] text-amber-500/70 font-medium">
                    · custo desta geração:{' '}
                    {genModel === 'flash'
                      ? genRes === '2K'
                        ? 12
                        : 8
                      : genModel === 'pro'
                        ? genRes === '4K'
                          ? 48
                          : 36
                        : genRes === '2K'
                          ? 24
                          : 16}{' '}
                    créditos
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                {/* Model selector */}
                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray mb-4">
                    Modelo de Geração
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setGenModel('flash')}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        genModel === 'flash'
                          ? 'border-[#CFA697] bg-[#CFA697]/10'
                          : 'border-black/10 hover:bg-black/5'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Zap
                          className={cn(
                            'w-4 h-4',
                            genModel === 'flash' ? 'text-[#CFA697]' : 'text-bluegray/50'
                          )}
                        />
                        <span
                          className={cn(
                            'text-sm font-bold',
                            genModel === 'flash' ? 'text-[#CFA697]' : 'text-bluegray'
                          )}
                        >
                          Flash
                        </span>
                      </div>
                      <p className="text-[10px] text-bluegray/50 leading-relaxed">
                        Nano Banana Flash
                        <br />
                        Rápido · ~30s
                      </p>
                    </button>
                    <button
                      onClick={() => setGenModel('pro')}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        genModel === 'pro'
                          ? 'border-[#CFA697] bg-[#CFA697]/10'
                          : 'border-black/10 hover:bg-black/5'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Star
                          className={cn(
                            'w-4 h-4',
                            genModel === 'pro' ? 'text-[#CFA697]' : 'text-bluegray/50'
                          )}
                        />
                        <span
                          className={cn(
                            'text-sm font-bold',
                            genModel === 'pro' ? 'text-[#CFA697]' : 'text-bluegray'
                          )}
                        >
                          Pro
                        </span>
                      </div>
                      <p className="text-[10px] text-bluegray/50 leading-relaxed">
                        Nano Banana Pro
                        <br />
                        Alta qualidade · ~60s
                      </p>
                    </button>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray">
                      Imagem Base do Projeto
                    </h3>
                    <Badge className="bg-green-500/10 text-green-600 border-none text-[8px] uppercase">
                      Anexada na API
                    </Badge>
                  </div>
                  {image ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-black/10">
                      <img src={image} alt="Referência" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="text-[10px] text-bluegray/60 italic">
                      Nenhuma imagem na sessão. Gerará abstratamente.
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray mb-4">
                    Prompt Referência
                  </h3>
                  <div className="text-[10px] text-bluegray/60 leading-relaxed mb-4 line-clamp-4">
                    {result?.positive}
                  </div>
                  <div className="text-[10px] text-red-500/60 leading-relaxed line-clamp-2">
                    {result?.negative}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray mb-4">
                    Proporção (Aspect Ratio)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {['16:9', '1:1', '9:16', '5:4', '4:5'].map(ratio => (
                      <button
                        key={ratio}
                        onClick={() => setGenAspect(ratio)}
                        className={cn(
                          'flex-1 min-w-[60px] py-3 px-2 rounded-xl border text-sm font-bold transition-all',
                          genAspect === ratio
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-black/10 text-bluegray/60 hover:bg-black/5'
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray mb-4">
                    Resolução (API)
                  </h3>
                  <div className="flex gap-4">
                    {(genModel === 'pro' ? ['1K', '2K', '4K'] : ['1K', '2K']).map(res => (
                      <button
                        key={res}
                        onClick={() => setGenRes(res as '1K' | '2K' | '4K')}
                        className={cn(
                          'flex-1 py-3 px-4 rounded-xl border text-sm font-bold transition-all',
                          genRes === res
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-black/10 text-bluegray/60 hover:bg-black/5'
                        )}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </Card>

                <Button
                  variant="gold"
                  className="w-full py-4 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={isGeneratingImg}
                  onClick={async () => {
                    if (!result) return;

                    // Check if a key is selected for Nano Banana 2 (Gemini 3.1)
                    if ((window as any).aistudio?.hasSelectedApiKey) {
                      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                      if (!hasKey) {
                        const confirmKey = window.confirm(
                          'Para usar o Nano Banana 2, você precisa selecionar uma chave de API de um projeto pago. Deseja selecionar agora?'
                        );
                        if (confirmKey && (window as any).aistudio.openSelectKey) {
                          await (window as any).aistudio.openSelectKey();
                          // Proceed after selection
                        } else {
                          return; // User canceled
                        }
                      }
                    }

                    setIsGeneratingImg(true);
                    setGeneratedImg(null);
                    setGenError(null);
                    try {
                      const img =
                        genModel === 'pro'
                          ? await generateNanoBananaPro(
                              result.positive,
                              result.negative,
                              genAspect,
                              genRes,
                              image || undefined
                            )
                          : await generateNanoBananaImage(
                              result.positive,
                              result.negative,
                              genAspect,
                              genRes === '4K' ? '2K' : genRes,
                              image || undefined
                            );
                      setGeneratedImg(img);
                      getUserCreditStatus()
                        .then(setCreditStatus)
                        .catch(err => console.error('[MQv3 Credits refresh]', err));
                    } catch (e: any) {
                      console.error('Erro no catch Studio:', e);
                      const errorMessage = e.message || 'Erro desconhecido da API de Geração';
                      setGenError(errorMessage);

                      // If the error is related to the key, prompt to select a new one
                      if (
                        errorMessage.includes('Requested entity was not found') ||
                        errorMessage.includes('API key') ||
                        errorMessage.includes('403') ||
                        errorMessage.includes('401')
                      ) {
                        const confirmKey = window.confirm(
                          'Parece haver um problema com sua chave de API. Deseja selecionar uma nova chave agora?'
                        );
                        if (confirmKey && (window as any).aistudio?.openSelectKey) {
                          (window as any).aistudio.openSelectKey();
                        }
                      }
                    } finally {
                      setIsGeneratingImg(false);
                    }
                  }}
                >
                  {isGeneratingImg ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processando no Servidor...
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-5 h-5 mr-2" />
                      Gerar Imagem agora
                    </>
                  )}
                </Button>

                <Button variant="outline" className="w-full" onClick={() => setStep('result')}>
                  Voltar para os Prompts
                </Button>
              </div>

              <div className="space-y-6">
                {genError && (
                  <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-xs font-mono break-all relative">
                    <AlertTriangle className="w-5 h-5 mb-2" />
                    <p className="font-bold mb-1">
                      FALHA NA GERAÇÃO{' '}
                      {genModel === 'pro' ? 'NANO BANANA PRO' : 'NANO BANANA FLASH'}:
                    </p>
                    <p>{genError}</p>
                    <button
                      onClick={() => setGenError(null)}
                      className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded"
                    >
                      &times;
                    </button>
                  </div>
                )}
                <Card className="p-6 min-h-[400px] flex flex-col items-center justify-center bg-black/5 border-none relative overflow-hidden">
                  {isGeneratingImg ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                      <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin mb-4" />
                      <p className="text-sm font-bold text-purple-600 animate-pulse uppercase tracking-widest">
                        Processando Modelo...
                      </p>
                    </div>
                  ) : generatedImg ? (
                    <div
                      className="relative w-full h-full group cursor-zoom-in"
                      onClick={() => setIsPreviewOpen(true)}
                    >
                      <img
                        src={generatedImg}
                        alt="Generated"
                        className="w-full h-full object-contain rounded-lg shadow-2xl"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                        <Button
                          variant="gold"
                          className="text-xs"
                          onClick={e => {
                            e.stopPropagation();
                            handleDownload();
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Salvar Imagem
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-bluegray/40">
                      <ImagePlus className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">A imagem gerada aparecerá aqui.</p>
                      <p className="text-xs mt-2">Isto pode consumir créditos do seu plano.</p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'detail-scan' && (
          <motion.div
            key="detail-scan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto space-y-12"
          >
            <div className="text-center mb-12">
              <Badge className="mb-4">TOOL-04 / Scan de Detalhes</Badge>
              <h2 className="text-3xl font-display font-semibold text-bluegray mb-2">
                Análise de Closes & Detalhes
              </h2>
              <p className="text-bluegray/60">
                Envie a imagem gerada para identificar os melhores pontos de close-up.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <Card className="p-8 space-y-8">
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDetailFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={loading}
                  />
                  <div
                    className={cn(
                      'aspect-video rounded-2xl bg-offwhite border border-dashed border-bluegray/10 flex flex-col items-center justify-center p-8 text-center transition-all group-hover:border-gold/30',
                      detailImage && 'border-solid border-gold/50 bg-gold/5',
                      loading && 'opacity-50'
                    )}
                  >
                    {loading ? (
                      <div className="flex flex-col items-center">
                        <RefreshCw className="w-8 h-8 text-gold animate-spin mb-4" />
                        <p className="text-sm font-medium text-bluegray">Identificando Closes...</p>
                      </div>
                    ) : detailImage ? (
                      <img
                        src={detailImage}
                        alt="Detalhe"
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
                          <Upload className="w-5 h-5 text-gold" />
                        </div>
                        <p className="text-sm font-medium text-bluegray mb-1">
                          Upload da Imagem Gerada
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
                          Para análise de detalhes
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {detailScanResult && (
                  <div className="space-y-6">
                    <div className="p-4 bg-gold/5 rounded-xl border border-gold/10">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-gold mb-2">
                        Composição Geral
                      </h4>
                      <p className="text-xs text-bluegray/70 italic leading-relaxed">
                        "{detailScanResult.overallComposition}"
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStep('result')}
                      >
                        Voltar
                      </Button>
                      <Button
                        variant="gold"
                        className="flex-1"
                        onClick={() => setStep('post-production')}
                      >
                        Ir para Pós-Produção
                      </Button>
                    </div>
                  </div>
                )}
              </Card>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 mb-4">
                  6 Closes Sugeridos
                </h3>
                <div className="grid gap-4">
                  {(
                    detailScanResult?.closes ||
                    Array.from({ length: 6 }).map((_, i) => ({
                      id: i,
                      title: `Close ${i + 1}`,
                      description: 'Aguardando análise...',
                      location: '-',
                      prompt: '',
                    }))
                  ).map(close => (
                    <Card key={close.id} className="p-4 group hover:border-gold/30 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-bluegray/5 text-bluegray text-[9px] px-1.5 py-0">
                              C{close.id + 1}
                            </Badge>
                            <h4 className="text-sm font-semibold text-bluegray">{close.title}</h4>
                          </div>
                          <p className="text-[10px] text-bluegray/40 uppercase tracking-widest mb-2">
                            {close.location}
                          </p>
                          <p className="text-xs text-bluegray/60 line-clamp-2 mb-3">
                            {close.description}
                          </p>
                          {close.prompt && (
                            <div className="relative">
                              <p className="text-[10px] text-bluegray/80 bg-offwhite p-2 rounded border border-black/5 italic line-clamp-2 pr-8">
                                {close.prompt}
                              </p>
                              <button
                                onClick={() => copyToClipboard(close.prompt)}
                                className="absolute right-1 top-1 p-1 rounded hover:bg-gold/10 text-bluegray hover:text-gold transition-all"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="w-16 h-16 rounded-lg bg-offwhite flex items-center justify-center border border-black/5 shrink-0 overflow-hidden">
                          {detailImage ? (
                            <div className="w-full h-full bg-gold/10 flex items-center justify-center">
                              <Camera className="w-4 h-4 text-gold/40" />
                            </div>
                          ) : (
                            <Camera className="w-4 h-4 text-bluegray/10" />
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'post-production' && (
          <motion.div
            key="post-production"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto space-y-12"
          >
            <div className="text-center mb-12">
              <Badge className="mb-4">TOOL-03 / Pós-Produção</Badge>
              <h2 className="text-3xl font-display font-semibold text-bluegray mb-2">
                Calibração Técnica
              </h2>
              <p className="text-bluegray/60">
                Envie a imagem gerada para eliminar o aspecto sintético.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <Card className="p-8 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                    Estilo de Pós-Produção
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPostProdStyle('default')}
                      className={cn(
                        'flex-1 p-4 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all',
                        postProdStyle === 'default'
                          ? 'bg-bluegray text-white border-bluegray'
                          : 'bg-offwhite text-bluegray/40 border-black/5 hover:border-gold/30'
                      )}
                    >
                      Realismo Fotográfico
                    </button>
                    <button
                      onClick={() => setPostProdStyle('casa-vogue')}
                      className={cn(
                        'flex-1 p-4 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all',
                        postProdStyle === 'casa-vogue'
                          ? 'bg-gold text-white border-gold'
                          : 'bg-offwhite text-bluegray/40 border-black/5 hover:border-gold/30'
                      )}
                    >
                      Casa Vogue
                    </button>
                  </div>
                </div>

                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGeneratedFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={loading}
                  />
                  <div
                    className={cn(
                      'aspect-video rounded-2xl bg-offwhite border border-dashed border-bluegray/10 flex flex-col items-center justify-center p-8 text-center transition-all group-hover:border-gold/30',
                      generatedImage && 'border-solid border-gold/50 bg-gold/5',
                      loading && 'opacity-50'
                    )}
                  >
                    {loading ? (
                      <div className="flex flex-col items-center">
                        <RefreshCw className="w-8 h-8 text-gold animate-spin mb-4" />
                        <p className="text-sm font-medium text-bluegray">
                          Analisando Calibração...
                        </p>
                      </div>
                    ) : generatedImage ? (
                      <img
                        src={generatedImage}
                        alt="Gerada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
                          <Upload className="w-5 h-5 text-gold" />
                        </div>
                        <p className="text-sm font-medium text-bluegray mb-1">
                          Upload da Imagem Gerada
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/30">
                          Midjourney / SD / Flux
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40">
                    Pipeline de Mapas
                  </h3>
                  <div className="space-y-3">
                    {(
                      postProdResult?.pipeline || [
                        {
                          map: 'Albedo Calibration',
                          value: 'Pendente',
                          description: 'Aguardando upload',
                        },
                        {
                          map: 'Specular Correction',
                          value: 'Pendente',
                          description: 'Aguardando upload',
                        },
                        {
                          map: 'Roughness Variation',
                          value: 'Pendente',
                          description: 'Aguardando upload',
                        },
                        {
                          map: 'Chromatic Aberration',
                          value: 'Pendente',
                          description: 'Aguardando upload',
                        },
                        {
                          map: 'Film Grain (Portra 400)',
                          value: 'Pendente',
                          description: 'Aguardando upload',
                        },
                        {
                          map: 'Vignetting & Bokeh',
                          value: 'Pendente',
                          description: 'Aguardando upload',
                        },
                      ]
                    ).map((item, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-offwhite border border-black/5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-bluegray">{item.map}</span>
                          <Badge
                            className={cn(
                              item.value === 'Pendente'
                                ? 'bg-gold/10 text-gold'
                                : 'bg-bluegray text-white'
                            )}
                          >
                            {item.value}
                          </Badge>
                        </div>
                        {item.description !== 'Aguardando upload' && (
                          <p className="text-[10px] text-bluegray/60 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="space-y-8">
                {postProdResult && (
                  <div className="p-8 bg-[#1A1F23] text-white rounded-2xl shadow-xl border border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gold">
                          Prompt de Pós-Produção
                        </h3>
                        <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
                          Baseado nos ajustes detectados
                        </p>
                      </div>
                      <Button
                        variant="gold"
                        size="sm"
                        className="h-8 px-3 text-[10px]"
                        onClick={() => copyToClipboard(postProdResult.postProductionPrompt)}
                      >
                        <Copy className="w-3 h-3 mr-2" />
                        Copiar
                      </Button>
                    </div>
                    <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                      <p className="text-sm leading-relaxed text-white font-mono italic">
                        {postProdResult.postProductionPrompt}
                      </p>
                    </div>
                  </div>
                )}

                <Card className="p-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 mb-6">
                    Problemas de CGI Detectados
                  </h3>
                  <div className="space-y-3">
                    {postProdResult?.cgiIssues.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-4 rounded-xl bg-offwhite border border-black/5"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5" />
                        <p className="text-xs text-bluegray/70 leading-relaxed">{issue}</p>
                      </div>
                    )) || (
                      <p className="text-xs text-bluegray/30 italic">
                        Nenhum problema detectado ainda.
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="p-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-bluegray/40 mb-6">
                    Comparador Visual
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/30 text-center">
                        Original
                      </p>
                      <div className="aspect-square rounded-xl bg-black/5 overflow-hidden">
                        {image && (
                          <img src={image} alt="Original" className="w-full h-full object-cover" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-bluegray/30 text-center">
                        Gerada
                      </p>
                      <div className="aspect-square rounded-xl bg-black/5 overflow-hidden">
                        {generatedImage && (
                          <img
                            src={generatedImage}
                            alt="Gerada"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-4">
                    <Button variant="outline" className="flex-1">
                      Exportar sRGB
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Exportar CMYK
                    </Button>
                  </div>
                </Card>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1" onClick={() => setStep('result')}>
                    Voltar ao Prompt
                  </Button>
                  <Button variant="gold" className="flex-1" onClick={() => setStep('upload')}>
                    Nova Sessão
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isPreviewOpen && generatedImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/95 backdrop-blur-md"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-[90vw] max-h-[90vh] aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <img src={generatedImg} alt="Preview" className="w-full h-full object-contain" />

              <div className="absolute top-6 right-6 flex gap-3">
                <Button variant="gold" size="sm" onClick={handleDownload} className="shadow-xl">
                  <Download className="w-4 h-4 mr-2" />
                  Download HD
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 !px-3 !py-2"
                  onClick={() => setIsPreviewOpen(false)}
                >
                  <Zap className="w-4 h-4 rotate-45" />
                </Button>
              </div>

              <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 max-w-2xl">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gold mb-1">
                    Visualização em Alta Definição
                  </h4>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Esta imagem foi gerada com o motor Nano Banana 2. Verifique os detalhes antes de
                    realizar o download final para seu projeto.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
