/**
 * 电商平台适配预设 — 不同平台的视觉风格差异化策略
 *
 * 核心理念：
 * 同一款床品在不同平台的营销图应有不同的视觉调性：
 * - 小红书 → 高情绪价值、氛围感、生活方式
 * - 淘宝/天猫 → 高转化、卖点直击、痛点放大
 * - 京东 → 品质感、专业度、技术参数
 * - 亚马逊 → Premium lifestyle、A+ content
 */

// ============================================================
// 平台预设接口
// ============================================================
export interface PlatformPreset {
  /** 平台标识 */
  key: string;
  /** 显示标签（中文） */
  label: string;
  /** 图标 */
  icon: string;
  /** Platform_Vibe 值（注入 Toon 的 Platform_Vibe 字段） */
  vibe: string;
  /** 排版风格偏好描述 */
  typographyHint: string;
  /** 光影偏好 */
  lightingHint: string;
  /** 推荐宽高比 */
  recommendedRatio: string;
  /** 语言（zh-CN / en-US） */
  language: 'zh-CN' | 'en-US';
}

// ============================================================
// 平台预设字典
// ============================================================
export const PLATFORM_PRESETS: Record<string, PlatformPreset> = {
  xiaohongshu: {
    key: 'xiaohongshu',
    label: '小红书',
    icon: '📕',
    vibe: 'Xiaohongshu aesthetic, high emotional value, lifestyle-driven, immersive atmosphere, cozy and relatable, soft tones',
    typographyHint: '非侵入式排版，文字融入场景，柔和透明度渐变，不宜使用大红大字',
    lightingHint: '柔光、自然光、窗户漫射光，色温偏暖但不刺眼，生活感氛围',
    recommendedRatio: '3:4',
    language: 'zh-CN',
  },
  taobao: {
    key: 'taobao',
    label: '淘宝/天猫',
    icon: '🛒',
    vibe: 'Taobao/Tmall e-commerce aesthetic, high conversion, sharp selling points, pain-point driven, clear and impactful, professional product photography',
    typographyHint: '高对比度大字号醒目排版，白色/金色粗体主标题，底部功能图标罗列，卖点标签突出',
    lightingHint: '影棚级清晰打光，高对比度，白底或主题色背景',
    recommendedRatio: '1:1',
    language: 'zh-CN',
  },
  jd: {
    key: 'jd',
    label: '京东',
    icon: '🏬',
    vibe: 'JD.com premium quality showcase, professional, trustworthy, technology-driven aesthetics, clean and authoritative',
    typographyHint: '技术参数突出，认证标志可见，功能图标整齐排列，字号适中偏稳重',
    lightingHint: '白底棚拍，均匀柔光，质感清晰',
    recommendedRatio: '1:1',
    language: 'zh-CN',
  },
  amazon: {
    key: 'amazon',
    label: '亚马逊',
    icon: '🌐',
    vibe: 'Amazon premium lifestyle, A+ content style, clean and aspirational, Western bedroom aesthetic, editorial quality',
    typographyHint: 'Clean English text, sans-serif font, minimal and elegant positioning, infographic style for bullet points',
    lightingHint: 'Bright natural daylight, clean white or light gray background, professional studio',
    recommendedRatio: '1:1',
    language: 'en-US',
  },
  pinduoduo: {
    key: 'pinduoduo',
    label: '拼多多',
    icon: '🟠',
    vibe: 'Pinduoduo value-driven, bold and eye-catching, price-performance focus, vivid and saturated colors, crowds-friendly',
    typographyHint: '超大字号、高饱和度配色、促销标签醒目、价格标红',
    lightingHint: '高饱和度、高对比度，色彩鲜艳',
    recommendedRatio: '1:1',
    language: 'zh-CN',
  },
};

/** 所有平台的 key 列表 */
export const PLATFORM_KEYS = Object.keys(PLATFORM_PRESETS);

/** 默认平台 */
export const DEFAULT_PLATFORM = 'taobao';

/**
 * 获取平台预设，带兜底（默认淘宝）
 */
export function getPlatformPreset(key: string): PlatformPreset {
  return PLATFORM_PRESETS[key] || PLATFORM_PRESETS[DEFAULT_PLATFORM];
}
