/**
 * 模型配置常量
 * 所有 API 端点和模型 ID 集中管理
 *
 * 🔑 v2.2 升级：
 * - 支持多提供商（API易 / 阿里云百炼）
 * - 文本分析默认：Gemini 3.1 Pro（API易）
 * - 可选：Qwen3.5 Plus（百炼）、Gemini 3.1 Flash Lite（API易）
 * - 生图固定：Nano Banana 2（API易）
 * - 根据 provider 自动选择 API 端点和请求格式
 */

// ============================================================
// 提供商类型
// ============================================================

/** API 提供商类型 */
export type ApiProvider = 'apiyi' | 'bailian';

// ============================================================
// 提供商端点配置
// ============================================================

/** API易端点（Gemini 原生格式） */
const APIYI_BASE = 'https://api.apiyi.com/v1beta/models';

/**
 * 阿里云百炼端点（OpenAI 兼容格式）
 * dashscope 支持浏览器 CORS，可直连
 */
const BAILIAN_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// ============================================================
// 模型 ID
// ============================================================

/** 生图模型 - Nano Banana 2 (Gemini 3.1 Flash Image Preview) — API易 */
export const IMAGE_MODEL_ID = 'gemini-3.1-flash-image-preview';

/** 分析模型 - Pro 版 — API易 Gemini */
export const ANALYSIS_MODEL_PRO = 'gemini-3.1-pro-preview';

/** 分析模型 - Lite 版 — API易 Gemini */
export const ANALYSIS_MODEL_LITE = 'gemini-3.1-flash-lite-preview';

/** 分析模型 - 百炼 Qwen3.5 Plus（OpenAI 兼容格式） */
export const ANALYSIS_MODEL_QWEN = 'qwen3.5-plus';

/** 默认分析模型 ID — Gemini 3.1 Pro */
export const DEFAULT_ANALYSIS_MODEL = ANALYSIS_MODEL_PRO;

/** 可选分析模型列表（前端切换用） */
export const ANALYSIS_MODEL_OPTIONS = [
  { id: ANALYSIS_MODEL_PRO, label: 'Gemini 3.1 Pro', desc: '精度优先 · 默认', emoji: '🧠', provider: 'apiyi' as ApiProvider },
  { id: ANALYSIS_MODEL_QWEN, label: 'Qwen3.5 Plus', desc: '百炼多模态 · 强推理', emoji: '🔮', provider: 'bailian' as ApiProvider },
  { id: ANALYSIS_MODEL_LITE, label: 'Gemini 3.1 Lite', desc: '速度优先 · 节省Token', emoji: '⚡', provider: 'apiyi' as ApiProvider },
] as const;

// ============================================================
// 提供商/端点辅助方法
// ============================================================

/**
 * 根据模型 ID 判断提供商
 */
export function getProviderForModel(modelId: string): ApiProvider {
  if (modelId === ANALYSIS_MODEL_QWEN) return 'bailian';
  return 'apiyi';
}

/**
 * 生成 API易 Gemini 原生格式端点
 * @param modelId 模型 ID（如 gemini-3.1-pro-preview）
 */
export function getApiyiGeminiUrl(modelId: string): string {
  return `${APIYI_BASE}/${modelId}:generateContent`;
}

/**
 * 获取百炼 OpenAI 兼容格式 Chat Completions 端点
 */
export function getBailianChatUrl(): string {
  return `${BAILIAN_BASE}/chat/completions`;
}

// ============================================================
// 兼容旧代码：API 端点
// ============================================================

/** 生图 API 端点（API易 Gemini 原生格式） */
export const IMAGE_API_URL = getApiyiGeminiUrl(IMAGE_MODEL_ID);

/**
 * 动态生成文本/分析模型的 API 端点（API易 Gemini 格式）
 * @param modelId 模型 ID
 */
export function getTextApiUrl(modelId: string): string {
  return getApiyiGeminiUrl(modelId);
}

// 🔑 兼容旧代码：保留 TEXT_API_URL 和 TEXT_MODEL_ID，但标记为 @deprecated
/** @deprecated 使用 getTextApiUrl(modelId) 代替 */
export const TEXT_MODEL_ID = ANALYSIS_MODEL_PRO;
/** @deprecated 使用 getTextApiUrl(modelId) 代替 */
export const TEXT_API_URL = getTextApiUrl(ANALYSIS_MODEL_PRO);

// ============================================================
// 默认生成参数
// ============================================================

/** 各阶段默认温度值 */
export const DEFAULT_TEMPERATURES = {
  /** Phase 1 通铺花型提取 — 忠实提取 */
  patternFaithful: 0.4,
  /** Phase 1 通铺花型提取 — 灵感创作 */
  patternAllover: 1.2,
  /** Phase 1 绣花花型提取 */
  patternEmbroidery: 0.20,
  /** Phase 1 绣花微调阶段 */
  patternEmbroideryRefine: 0.50,
  /** Phase 2 铺床渲染 */
  render: 0.80,
  /** Phase 3 素材库 */
  material: 0.6,
  /** Phase 3 素材库单张重绘 */
  materialRegenerate: 0.7,
  /** Phase 4 详情页 */
  detailPage: 0.6,
  /** 文本分析/建议 */
  textAnalysis: 0.8,
  /** 参考图提示词分析 */
  promptAnalysis: 0.7,
  /** 风格推荐 */
  styleRecommend: 0.3,
  /** 多轮微调 */
  conversationalEdit: 0.50,
} as const;

/** 各阶段默认宽高比 */
export const DEFAULT_ASPECT_RATIOS = {
  pattern: '1:1',
  patternPillowcase: '3:2',
  render: '3:4',
  material: '1:1',
  detailPage: '3:4',
} as const;

/** 可选宽高比列表 */
export const ASPECT_RATIO_OPTIONS = [
  { value: '1:1',  label: '1:1',  desc: '正方形 · 电商主图', icon: '⬜' },
  { value: '3:4',  label: '3:4',  desc: '竖版 · 铺床/详情', icon: '📱' },
  { value: '4:3',  label: '4:3',  desc: '横版 · 横幅广告', icon: '🖥️' },
  { value: '16:9', label: '16:9', desc: '超宽 · Banner', icon: '🎬' },
  { value: '9:16', label: '9:16', desc: '超高 · 手机屏', icon: '📲' },
] as const;

/** API 超时时间 (毫秒) — 通用 */
export const API_TIMEOUT_MS = 120_000;

/** Phase 2 铺床渲染 API 超时时间 (毫秒) — 生图模型较慢 */
export const RENDER_API_TIMEOUT_MS = 180_000;

/** 素材库 API 超时时间 (毫秒) */
export const MATERIAL_API_TIMEOUT_MS = 240_000;

/** 最大上传参考图数量 */
export const MAX_UPLOAD_IMAGES = 5;

/** 最大重试次数 */
export const MAX_RETRIES = 1;
