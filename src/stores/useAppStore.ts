/**
 * Zustand 主状态管理
 * 管理全局应用状态（Phase/花型/渲染/设置等）
 */

import { create } from 'zustand';
import { DEFAULT_ANALYSIS_MODEL } from '../config/models';
import { saveAppStateValue, loadAppStateValue } from '../db/dexieDB';
import type {
  AppPhase,
  PatternType,
  ExtractionMode,
  CameraAngle,
  BeddingLayout,
  DuvetReverseSide,
  UploadedImage,
  GeneratedPattern,
  DominantColor,
  MarketingImageResult,
  ChatMessage,
  OutputResolution,
  PatternSuggestion,
  ProductCustomization,
} from '../types/state';

// ============================================================
// Store 接口
// ============================================================

interface AppState {
  // --- 全局 ---
  apiKey: string;           // API易 Key（生图 + Gemini分析）
  bailianApiKey: string;    // 百炼 Key（Qwen分析）
  currentPhase: AppPhase;
  isGenerating: boolean;

  // --- Phase 1 ---
  patternType: PatternType;
  extractionMode: ExtractionMode;
  uploadedImages: UploadedImage[];
  generatedPatterns: GeneratedPattern[];
  selectedPatternIndices: number[];
  editTargetPatternIndex: number | null;

  // --- Phase 2 ---
  fabric: string;
  style: string;
  beddingLayout: BeddingLayout;
  duvetReverseSide: DuvetReverseSide;
  additionalPrompt: string;
  confirmedPatternBase64s: string[];
  confirmedPatternRegionTags: string[];
  extractedDominantColor: DominantColor | null;
  mainRenderBase64: string | null;
  outputResolution: OutputResolution;
  renderAspectRatio: string;
  cameraAngle: CameraAngle;

  // --- Phase 3 (一键营销大图) ---
  mainImageRefs: UploadedImage[];
  detailImageRefs: UploadedImage[];
  mainImageResults: MarketingImageResult[];
  detailImageResults: MarketingImageResult[];
  isMarketingGenerating: boolean;
  mainImageAspectRatio: string;
  detailImageAspectRatio: string;

  // --- 多轮结果缓存 ---
  mainImageRounds: MarketingImageResult[][];
  detailImageRounds: MarketingImageResult[][];
  activeMainRound: number;
  activeDetailRound: number;

  // --- 分析模型选择 ---
  analysisModelId: string;

  // --- 产品自定义 ---
  productCustomization: ProductCustomization;

  // --- 增量分析跟踪 ---
  /** 已分析过的主图参考图ID集合 */
  analyzedMainRefIds: Set<string>;
  /** 已分析过的详情图参考图ID集合 */
  analyzedDetailRefIds: Set<string>;

  // --- AI 改进建议 ---
  patternSuggestions: PatternSuggestion[];
  isSuggestionsLoading: boolean;

  // --- 绣花提取目标 ---
  extractionTargets: { duvet: boolean; pillowcase: boolean };

  // --- AI 推荐风格 ---
  recommendedStyle: { styleName: string; reason: string } | null;

  // --- 手动取色器 ---
  manualColorHex: string | null;

  // --- 对话 ---
  chatMessages: ChatMessage[];

  // --- Prompt 控制中心 ---
  userModifiedPrompt: boolean;
  promptPanelOpen: boolean;
  editedPromptStructure: string;
  editedPromptStyle: string;
  editedPromptNegative: string;

  // --- Actions ---
  setApiKey: (key: string) => void;
  setBailianApiKey: (key: string) => void;
  setPhase: (phase: AppPhase) => void;
  setIsGenerating: (val: boolean) => void;
  setPatternType: (type: PatternType) => void;
  setExtractionMode: (mode: ExtractionMode) => void;
  addUploadedImage: (image: UploadedImage) => void;
  removeUploadedImage: (id: string) => void;
  clearUploadedImages: () => void;
  addGeneratedPattern: (pattern: GeneratedPattern) => void;
  updatePattern: (index: number, updates: Partial<GeneratedPattern>) => void;
  deletePattern: (index: number) => void;
  togglePatternSelection: (index: number) => void;
  setEditTarget: (index: number | null) => void;
  setFabric: (fabric: string) => void;
  setStyle: (style: string) => void;
  setBeddingLayout: (layout: BeddingLayout) => void;
  setDuvetReverseSide: (side: DuvetReverseSide) => void;
  setCameraAngle: (angle: CameraAngle) => void;
  setAdditionalPrompt: (prompt: string) => void;
  setConfirmedPatterns: (base64s: string[], regionTags: string[]) => void;
  setDominantColor: (color: DominantColor | null) => void;
  setMainRenderBase64: (base64: string | null) => void;
  setOutputResolution: (res: OutputResolution) => void;
  setMainImageRefs: (refs: UploadedImage[]) => void;
  setDetailImageRefs: (refs: UploadedImage[]) => void;
  setMainImageResults: (results: MarketingImageResult[]) => void;
  updateMainImageResult: (index: number, updates: Partial<MarketingImageResult>) => void;
  setDetailImageResults: (results: MarketingImageResult[]) => void;
  updateDetailImageResult: (index: number, updates: Partial<MarketingImageResult>) => void;
  setIsMarketingGenerating: (val: boolean) => void;
  addChatMessage: (msg: ChatMessage) => void;
  upsertChatMessage: (msg: ChatMessage) => void;
  removeChatMessage: (id: string) => void;
  clearChat: () => void;
  setUserModifiedPrompt: (val: boolean) => void;
  setPromptPanelOpen: (val: boolean) => void;
  setEditedPromptStructure: (val: string) => void;
  setEditedPromptStyle: (val: string) => void;
  setEditedPromptNegative: (val: string) => void;
  setPatternSuggestions: (suggestions: PatternSuggestion[]) => void;
  setIsSuggestionsLoading: (val: boolean) => void;
  setExtractionTargets: (targets: { duvet: boolean; pillowcase: boolean }) => void;
  setRecommendedStyle: (rec: { styleName: string; reason: string } | null) => void;
  setManualColorHex: (hex: string | null) => void;
  setRenderAspectRatio: (ratio: string) => void;
  setMainImageAspectRatio: (ratio: string) => void;
  setDetailImageAspectRatio: (ratio: string) => void;
  addMainRound: (results: MarketingImageResult[]) => void;
  addDetailRound: (results: MarketingImageResult[]) => void;
  setActiveMainRound: (idx: number) => void;
  setActiveDetailRound: (idx: number) => void;
  setAnalysisModelId: (id: string) => void;
  setProductCustomization: (updates: Partial<ProductCustomization>) => void;
  /** 从Dexie加载持久化的productCustomization */
  loadProductCustomization: () => Promise<void>;
  /** 标记参考图为已分析 */
  markRefsAnalyzed: (refIds: string[], isMain: boolean) => void;
  /** 清除单张结果（用于删除） */
  clearMainImageResult: (index: number) => void;
  clearDetailImageResult: (index: number) => void;
  resetToPhase1: () => void;
  resetToPhase2: () => void;
}

// ============================================================
// Store 实现
// ============================================================

export const useAppStore = create<AppState>((set) => ({
  // --- 初始状态 ---
  apiKey: '',
  bailianApiKey: '',
  currentPhase: 1,
  isGenerating: false,
  patternType: 'allover',
  extractionMode: 'faithful',
  uploadedImages: [],
  generatedPatterns: [],
  selectedPatternIndices: [],
  editTargetPatternIndex: null,
  fabric: '纯棉',
  style: '',
  beddingLayout: 'standard',
  duvetReverseSide: 'solidcolor',
  additionalPrompt: '',
  confirmedPatternBase64s: [],
  confirmedPatternRegionTags: [],
  extractedDominantColor: null,
  mainRenderBase64: null,
  outputResolution: '1K',
  renderAspectRatio: '3:4',
  cameraAngle: 'three_quarter_above',
  mainImageRefs: [],
  detailImageRefs: [],
  mainImageResults: [],
  detailImageResults: [],
  isMarketingGenerating: false,
  mainImageAspectRatio: '1:1',
  detailImageAspectRatio: '3:4',
  mainImageRounds: [],
  detailImageRounds: [],
  activeMainRound: -1,
  activeDetailRound: -1,
  analysisModelId: DEFAULT_ANALYSIS_MODEL,
  productCustomization: {
    brandLogoBase64: null,
    bedroomStyle: '',
    cameraAnglePreference: '',
    lightingPreference: '',
    fontPreference: '',
    sellingPoints: [],
    modelPhotoBase64: null,
    modelDescription: '',
    platform: '',
    needEnglishVersion: false,
  },
  analyzedMainRefIds: new Set<string>(),
  analyzedDetailRefIds: new Set<string>(),
  patternSuggestions: [],
  isSuggestionsLoading: false,
  extractionTargets: { duvet: true, pillowcase: true },
  recommendedStyle: null,
  manualColorHex: null,
  chatMessages: [],
  userModifiedPrompt: false,
  promptPanelOpen: false,
  editedPromptStructure: '',
  editedPromptStyle: '',
  editedPromptNegative: '',

  // --- Actions ---
  setApiKey: (key) => set({ apiKey: key }),
  setBailianApiKey: (key) => set({ bailianApiKey: key }),
  setPhase: (phase) => set({ currentPhase: phase }),
  setIsGenerating: (val) => set({ isGenerating: val }),
  setPatternType: (type) => set({ patternType: type }),
  setExtractionMode: (mode) => set({ extractionMode: mode }),

  addUploadedImage: (image) => set((s) => ({
    uploadedImages: [...s.uploadedImages, image],
  })),
  removeUploadedImage: (id) => set((s) => ({
    uploadedImages: s.uploadedImages.filter((img) => img.id !== id),
  })),
  clearUploadedImages: () => set({ uploadedImages: [] }),

  addGeneratedPattern: (pattern) => set((s) => ({
    generatedPatterns: [...s.generatedPatterns, pattern],
  })),
  updatePattern: (index, updates) => set((s) => ({
    generatedPatterns: s.generatedPatterns.map((p) =>
      p.index === index ? { ...p, ...updates } : p
    ),
  })),
  deletePattern: (index) => set((s) => ({
    generatedPatterns: s.generatedPatterns.map((p) =>
      p.index === index ? { ...p, deleted: true } : p
    ),
    selectedPatternIndices: s.selectedPatternIndices.filter((i) => i !== index),
  })),
  togglePatternSelection: (index) => set((s) => {
    const exists = s.selectedPatternIndices.includes(index);
    return {
      selectedPatternIndices: exists
        ? s.selectedPatternIndices.filter((i) => i !== index)
        : [...s.selectedPatternIndices, index],
    };
  }),
  setEditTarget: (index) => set({ editTargetPatternIndex: index }),

  setFabric: (fabric) => set({ fabric }),
  setStyle: (style) => set({ style }),
  setBeddingLayout: (layout) => set({ beddingLayout: layout }),
  setDuvetReverseSide: (side) => set({ duvetReverseSide: side }),
  setCameraAngle: (angle) => set({ cameraAngle: angle }),
  setAdditionalPrompt: (prompt) => set({ additionalPrompt: prompt }),
  setConfirmedPatterns: (base64s, regionTags) => set({
    confirmedPatternBase64s: base64s,
    confirmedPatternRegionTags: regionTags,
  }),
  setDominantColor: (color) => set({ extractedDominantColor: color }),
  setMainRenderBase64: (base64) => set({ mainRenderBase64: base64 }),
  setOutputResolution: (res) => set({ outputResolution: res }),
  setRenderAspectRatio: (ratio) => set({ renderAspectRatio: ratio }),
  setMainImageAspectRatio: (ratio) => set({ mainImageAspectRatio: ratio }),
  setDetailImageAspectRatio: (ratio) => set({ detailImageAspectRatio: ratio }),

  addMainRound: (results) => set((s) => ({
    mainImageRounds: [...s.mainImageRounds, results],
    activeMainRound: s.mainImageRounds.length,
  })),
  addDetailRound: (results) => set((s) => ({
    detailImageRounds: [...s.detailImageRounds, results],
    activeDetailRound: s.detailImageRounds.length,
  })),
  setActiveMainRound: (idx) => set({ activeMainRound: idx }),
  setActiveDetailRound: (idx) => set({ activeDetailRound: idx }),
  setAnalysisModelId: (id) => set({ analysisModelId: id }),
  setProductCustomization: (updates) => set((s) => {
    const merged = { ...s.productCustomization, ...updates };
    // 🔑 自动持久化到Dexie（异步，不阻塞UI）
    try {
      saveAppStateValue('productCustomization', JSON.stringify(merged)).catch(console.error);
    } catch { /* 忽略序列化错误 */ }
    return { productCustomization: merged };
  }),
  loadProductCustomization: async () => {
    try {
      const saved = await loadAppStateValue('productCustomization');
      if (saved) {
        const parsed = JSON.parse(saved);
        set((s) => ({ productCustomization: { ...s.productCustomization, ...parsed } }));
      }
    } catch (e) { console.error('[织梦AI] 加载持久化配置失败:', e); }
  },
  markRefsAnalyzed: (refIds, isMain) => set((s) => {
    const newSet = new Set(isMain ? s.analyzedMainRefIds : s.analyzedDetailRefIds);
    refIds.forEach(id => newSet.add(id));
    return isMain ? { analyzedMainRefIds: newSet } : { analyzedDetailRefIds: newSet };
  }),
  clearMainImageResult: (index) => set((s) => ({
    mainImageResults: s.mainImageResults.map((r, i) =>
      i === index ? { ...r, status: 'idle' as const, base64: null, error: undefined, customPrompt: undefined } : r
    ),
  })),
  clearDetailImageResult: (index) => set((s) => ({
    detailImageResults: s.detailImageResults.map((r, i) =>
      i === index ? { ...r, status: 'idle' as const, base64: null, error: undefined, customPrompt: undefined } : r
    ),
  })),

  setMainImageRefs: (refs) => set({ mainImageRefs: refs }),
  setDetailImageRefs: (refs) => set({ detailImageRefs: refs }),
  
  setMainImageResults: (results) => set({ mainImageResults: results }),
  updateMainImageResult: (index, updates) => set((s) => ({
    mainImageResults: s.mainImageResults.map((r, i) =>
      i === index ? { ...r, ...updates } : r
    ),
  })),
  
  setDetailImageResults: (results) => set({ detailImageResults: results }),
  updateDetailImageResult: (index, updates) => set((s) => ({
    detailImageResults: s.detailImageResults.map((r, i) =>
      i === index ? { ...r, ...updates } : r
    ),
  })),
  setIsMarketingGenerating: (val) => set({ isMarketingGenerating: val }),

  addChatMessage: (msg) => set((s) => {
    // 🔑 上限200条，超限自动移除最早的
    const newMsgs = [...s.chatMessages, msg];
    return { chatMessages: newMsgs.length > 200 ? newMsgs.slice(-200) : newMsgs };
  }),
  // 🔑 upsert：如果存在相同ID的消息则更新，否则追加（解决进度消息堆积问题）
  upsertChatMessage: (msg) => set((s) => {
    const existIdx = s.chatMessages.findIndex(m => m.id === msg.id);
    if (existIdx >= 0) {
      const newMsgs = [...s.chatMessages];
      newMsgs[existIdx] = msg;
      return { chatMessages: newMsgs };
    }
    const newMsgs = [...s.chatMessages, msg];
    return { chatMessages: newMsgs.length > 200 ? newMsgs.slice(-200) : newMsgs };
  }),
  removeChatMessage: (id) => set((s) => ({
    chatMessages: s.chatMessages.filter((m) => m.id !== id),
  })),
  clearChat: () => set({ chatMessages: [] }),

  setUserModifiedPrompt: (val) => set({ userModifiedPrompt: val }),
  setPromptPanelOpen: (val) => set({ promptPanelOpen: val }),
  setEditedPromptStructure: (val) => set({ editedPromptStructure: val }),
  setEditedPromptStyle: (val) => set({ editedPromptStyle: val }),
  setEditedPromptNegative: (val) => set({ editedPromptNegative: val }),
  setPatternSuggestions: (suggestions) => set({ patternSuggestions: suggestions }),
  setIsSuggestionsLoading: (val) => set({ isSuggestionsLoading: val }),
  setExtractionTargets: (targets) => set({ extractionTargets: targets }),
  setRecommendedStyle: (rec) => set({ recommendedStyle: rec }),
  setManualColorHex: (hex) => set({ manualColorHex: hex }),

  resetToPhase1: () => set({
    currentPhase: 1,
    generatedPatterns: [],
    selectedPatternIndices: [],
    editTargetPatternIndex: null,
    confirmedPatternBase64s: [],
    confirmedPatternRegionTags: [],
    extractedDominantColor: null,
    mainRenderBase64: null,
    mainImageRefs: [],
    detailImageRefs: [],
    mainImageResults: [],
    detailImageResults: [],
    chatMessages: [],
    userModifiedPrompt: false,
    patternSuggestions: [],
    isSuggestionsLoading: false,
    recommendedStyle: null,
    manualColorHex: null,
  }),

  resetToPhase2: () => set({
    currentPhase: 2,
    mainRenderBase64: null,
    mainImageResults: [],
    detailImageResults: [],
    isMarketingGenerating: false,
    userModifiedPrompt: false,
  }),
}));
