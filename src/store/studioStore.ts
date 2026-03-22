import { create } from 'zustand';
import type {
  AppMode,
  AppStep,
  ScanResult,
  PromptConfig,
  PromptOutput,
  PostProductionResult,
  DetailScanResult,
  MoveScanResult,
  MoveConfig,
  MoveOutput,
} from '../types';

const DEFAULT_CONFIG: PromptConfig = {
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
};

const DEFAULT_MOVE_CONFIG: MoveConfig = {
  duration: '5s',
  isTimeLapse: false,
  isSpeedRamp: false,
  movementType: '',
  sceneAnimation: '',
  isTransition: false,
  endImage: null,
};

interface StudioState {
  // Navigation
  mode: AppMode;
  step: AppStep;

  // Images
  image: string | null;
  endImage: string | null;
  detailImage: string | null;
  generatedImage: string | null;
  generatedImg: string | null;

  // AI Results
  scan: ScanResult | null;
  moveScan: MoveScanResult | null;
  result: PromptOutput | null;
  moveResult: MoveOutput | null;
  postProdResult: PostProductionResult | null;
  detailScanResult: DetailScanResult | null;

  // Configuration
  config: PromptConfig;
  moveConfig: MoveConfig;

  // Image generation settings
  genAspect: string;
  genRes: '1K' | '2K';
  postProdStyle: 'default' | 'casa-vogue';

  // UI state
  loading: boolean;
  loadingMessage: string;
  error: string | null;
  isGeneratingImg: boolean;
  genError: string | null;
  isPreviewOpen: boolean;
  showRetry: boolean;
  showSkip: boolean;

  // Actions
  setMode: (mode: AppMode) => void;
  setStep: (step: AppStep) => void;
  setImage: (image: string | null) => void;
  setEndImage: (image: string | null) => void;
  setDetailImage: (image: string | null) => void;
  setGeneratedImage: (image: string | null) => void;
  setGeneratedImg: (image: string | null) => void;
  setScan: (scan: ScanResult | null) => void;
  setMoveScan: (scan: MoveScanResult | null) => void;
  setResult: (result: PromptOutput | null) => void;
  setMoveResult: (result: MoveOutput | null) => void;
  setPostProdResult: (result: PostProductionResult | null) => void;
  setDetailScanResult: (result: DetailScanResult | null) => void;
  setConfig: (updater: PromptConfig | ((prev: PromptConfig) => PromptConfig)) => void;
  setMoveConfig: (updater: MoveConfig | ((prev: MoveConfig) => MoveConfig)) => void;
  setGenAspect: (aspect: string) => void;
  setGenRes: (res: '1K' | '2K') => void;
  setPostProdStyle: (style: 'default' | 'casa-vogue') => void;
  setLoading: (loading: boolean) => void;
  setLoadingMessage: (message: string) => void;
  setError: (error: string | null) => void;
  setIsGeneratingImg: (generating: boolean) => void;
  setGenError: (error: string | null) => void;
  setIsPreviewOpen: (open: boolean) => void;
  setShowRetry: (show: boolean) => void;
  setShowSkip: (show: boolean) => void;

  // Composite actions
  resetSession: () => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  // Initial state
  mode: 'promp',
  step: 'select',
  image: null,
  endImage: null,
  detailImage: null,
  generatedImage: null,
  generatedImg: null,
  scan: null,
  moveScan: null,
  result: null,
  moveResult: null,
  postProdResult: null,
  detailScanResult: null,
  config: DEFAULT_CONFIG,
  moveConfig: DEFAULT_MOVE_CONFIG,
  genAspect: '16:9',
  genRes: '1K',
  postProdStyle: 'default',
  loading: false,
  loadingMessage: 'Analisando Volumetria...',
  error: null,
  isGeneratingImg: false,
  genError: null,
  isPreviewOpen: false,
  showRetry: false,
  showSkip: false,

  // Actions
  setMode: mode => set({ mode }),
  setStep: step => set({ step }),
  setImage: image => set({ image }),
  setEndImage: endImage => set({ endImage }),
  setDetailImage: detailImage => set({ detailImage }),
  setGeneratedImage: generatedImage => set({ generatedImage }),
  setGeneratedImg: generatedImg => set({ generatedImg }),
  setScan: scan => set({ scan }),
  setMoveScan: moveScan => set({ moveScan }),
  setResult: result => set({ result }),
  setMoveResult: moveResult => set({ moveResult }),
  setPostProdResult: postProdResult => set({ postProdResult }),
  setDetailScanResult: detailScanResult => set({ detailScanResult }),
  setConfig: updater =>
    set(state => ({
      config: typeof updater === 'function' ? updater(state.config) : updater,
    })),
  setMoveConfig: updater =>
    set(state => ({
      moveConfig: typeof updater === 'function' ? updater(state.moveConfig) : updater,
    })),
  setGenAspect: genAspect => set({ genAspect }),
  setGenRes: genRes => set({ genRes }),
  setPostProdStyle: postProdStyle => set({ postProdStyle }),
  setLoading: loading => set({ loading }),
  setLoadingMessage: loadingMessage => set({ loadingMessage }),
  setError: error => set({ error }),
  setIsGeneratingImg: isGeneratingImg => set({ isGeneratingImg }),
  setGenError: genError => set({ genError }),
  setIsPreviewOpen: isPreviewOpen => set({ isPreviewOpen }),
  setShowRetry: showRetry => set({ showRetry }),
  setShowSkip: showSkip => set({ showSkip }),

  resetSession: () =>
    set({
      image: null,
      endImage: null,
      detailImage: null,
      generatedImage: null,
      generatedImg: null,
      scan: null,
      moveScan: null,
      result: null,
      moveResult: null,
      postProdResult: null,
      detailScanResult: null,
      config: DEFAULT_CONFIG,
      moveConfig: DEFAULT_MOVE_CONFIG,
      error: null,
      genError: null,
      step: 'select',
    }),
}));
