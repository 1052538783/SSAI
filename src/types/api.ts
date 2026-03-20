/**
 * Gemini API 请求/响应类型定义
 * 覆盖 Nano Banana 2 (gemini-3.1-flash-image-preview)
 * 和文本模型 (gemini-2.5-flash-lite)
 */

// ============================================================
// 请求体类型
// ============================================================

/** API 请求中单个 part 的类型 */
export interface ApiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
  inline_data?: {
    mimeType: string;
    data: string;
  };
  /** 🔑 Gemini 3 思维签名 — 必须原样回传 */
  thoughtSignature?: string;
}

/** API 请求中的单轮内容 */
export interface ApiContent {
  role: 'user' | 'model';
  parts: ApiPart[];
}

/** 图片输出配置 */
export interface ImageConfig {
  aspectRatio?: string; // "1:1","3:4","16:9" 等
  imageSize?: string;   // "512px","1K","2K","4K"
}

/** 思考配置 */
export interface ThinkingConfig {
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
}

/** 生成配置 */
export interface GenerationConfig {
  temperature?: number;
  responseModalities?: string[];
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  imageConfig?: ImageConfig;
  thinkingConfig?: ThinkingConfig;
}

/** 完整的 API 请求体 */
export interface GeminiRequestBody {
  contents: ApiContent[];
  generationConfig?: GenerationConfig;
  tools?: Array<Record<string, unknown>>;
}

// ============================================================
// 响应体类型
// ============================================================

/** API 响应中的 part */
export interface ApiResponsePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  inline_data?: {
    mimeType: string;
    data: string;
  };
  thoughtSignature?: string;
}

/** Token 使用统计 */
export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

/** API 响应候选项 */
export interface ApiCandidate {
  content: {
    parts: ApiResponsePart[];
    role: string;
  };
  finishReason?: string;
}

/** 完整 API 响应 */
export interface GeminiResponse {
  candidates?: ApiCandidate[];
  usageMetadata?: UsageMetadata;
}

// ============================================================
// 内部解析后的统一类型
// ============================================================

/** 解析后的 API 调用结果 */
export interface ParsedApiResult {
  success: boolean;
  text: string;
  images: string[]; // base64 数组
  /** 带 thoughtSignature 的原始 model parts（用于回传） */
  modelParts: ApiPart[];
  tokensUsed?: UsageMetadata;
  error?: string;
  finishReason?: string;
}

/** 并发任务定义 */
export interface ConcurrentTask<T> {
  id: string;
  label: string;
  execute: () => Promise<T>;
}
