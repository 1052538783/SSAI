/**
 * 全局应用状态类型定义
 */

import type { ApiPart } from './api';

/** 应用阶段 */
export type AppPhase = 1 | 2 | 3 | 4;

/** 日志功能标签 */
export type FunctionTag = 'prompt_analysis' | 'image_generation' | 'system';

/** 花型类型 */
export type PatternType = 'allover' | 'embroidery';

/** 花型提取模式 */
export type ExtractionMode = 'faithful' | 'creative';

/** 拍摄角度 */
export type CameraAngle = 'three_quarter_above' | 'top_down' | 'front_eye' | 'side_closeup';

/** 区域标签（被子/枕套/全局） */
export type RegionTag = 'allover' | 'duvet' | 'pillowcase';

/** 版型布局 */
export type BeddingLayout = 'standard' | 'bedskirt' | 'minimalist';

/** 被套反面类型 */
export type DuvetReverseSide = 'solidcolor' | 'sameprint';

/** 上传的图片 */
export interface UploadedImage {
  id: string;
  base64: string;
  mimeType: string;
  filename: string;
  thumbnail?: string; // 缩略图 base64
}

/** 生成的花型 */
export interface GeneratedPattern {
  id: string;
  index: number;
  base64: string;
  regionTag: RegionTag;
  dbId?: number;
  selected: boolean;
  deleted: boolean;
}

/** 花型改进建议 */
export interface PatternSuggestion {
  id: string;
  title: string;       // 简短标题（如"降低碎花密度"）
  description: string;  // 详细描述
  prompt: string;       // 用于直接应用到下一轮的prompt片段
}

/** 提取的主色 */
export interface DominantColor {
  hex: string;
  name: string;
  rgb: { r: number; g: number; b: number };
  colorTemperature?: 'cool' | 'warm' | 'neutral';
  /** 是否跳过了莫兰迪降色（深色/喜庆红豁免） */
  bypassed?: boolean;
  /** 豁免原因描述（如 '深色系' 或 '喜庆红'） */
  bypassReason?: string;
}

/** 素材模块生成结果 */
export interface MaterialResult {
  key: string;
  base64: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
  customPrompt?: string;
}

/** 详情页/营销大图生成结果 */
export interface MarketingImageResult {
  key: string;
  base64: string | null;
  status: 'idle' | 'pending' | 'generating' | 'done' | 'error';
  error?: string;
  sortOrder: number;
  customPrompt?: string; // 用户针对单张图片手动修改的专属提示词
}

/** 对话历史记录条目 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system' | 'system-success';
  text: string;
  images: string[];
  regionTag?: RegionTag;
  timestamp: number;
}

/** 结构化 Prompt */
export interface StructuredPrompt {
  structure: string;
  style: string;
  negative: string;
}

/** 带有 ThoughtSignature 的上下文 Turn */
export interface ConversationTurn {
  role: 'user' | 'model';
  parts: ApiPart[];
}

/** 日志条目 */
export interface LogEntry {
  id: string;
  timestamp: number;
  /** 功能标签（替代旧 phase 字段） */
  functionTag: FunctionTag;
  /** 兼容旧代码：保留 phase 字段 */
  phase?: AppPhase;
  modelId: string;
  requestType: 'image' | 'text';
  inputSummary: string;
  inputImageCount: number;
  outputText: string;
  outputImageCount: number;
  durationMs: number;
  tokensUsed?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  error?: string;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  /** 原始请求体JSON（图片base64已标注替换） */
  rawRequest?: string;
  /** 原始返回体JSON（图片base64已标注替换） */
  rawResponse?: string;
}

/** 产品自定义配置 */
export interface ProductCustomization {
  /** 品牌Logo图片(base64, null=不使用) */
  brandLogoBase64: string | null;
  /** 卧室风格 */
  bedroomStyle: string;
  /** 镜头角度偏好 */
  cameraAnglePreference: string;
  /** 打光偏好 */
  lightingPreference: string;
  /** 字体偏好 */
  fontPreference: string;
  /** 卖点文案列表(AI提取+用户编辑) */
  sellingPoints: string[];
  /** 模特照片(base64, null=不使用) */
  modelPhotoBase64: string | null;
  /** 模特文字描述 */
  modelDescription: string;
  /** 目标平台(小红书/淘宝/天猫/京东) */
  platform: string;
  /** 是否需要英文版本 */
  needEnglishVersion: boolean;
}

/** 输出分辨率选项 */
export type OutputResolution = '512px' | '1K' | '2K' | '4K';
