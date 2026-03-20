/**
 * 摄影参数预设包 — 将焦段/光影/视角/景别打包为一键选择
 *
 * 设计目的：
 * 降低用户理解专业摄影参数的门槛。用户只需选择"法式复古"或"极简现代"，
 * 系统自动填充完整的 Photography_And_Camera 和 Lighting_And_Atmosphere 配置。
 */

import type { PhotographyConfig, LightingConfig } from '../types/toonSchema';

// ============================================================
// 摄影预设接口
// ============================================================
export interface PhotographyPreset {
  /** 预设标识 */
  key: string;
  /** 显示标签（中文） */
  label: string;
  /** 图标 */
  icon: string;
  /** 一句话描述（展示在 UI 上） */
  description: string;
  /** 摄影配置 */
  photography: PhotographyConfig;
  /** 光影配置 */
  lighting: LightingConfig;
}

// ============================================================
// 预设字典
// ============================================================
export const PHOTOGRAPHY_PRESETS: Record<string, PhotographyPreset> = {
  french_romantic: {
    key: 'french_romantic',
    label: '法式复古',
    icon: '🌹',
    description: '85mm 大光圈暖光特写，柔和奶油色调，浪漫氛围',
    photography: {
      Shot_Type: 'Medium close-up',
      Focal_Length: '85mm f/1.4 large aperture',
      Camera_Angle: 'High angle shot, looking down at the bed 45 degrees',
      Focus: 'Crisp focus on the bedding fabric texture, softly blurred background',
    },
    lighting: {
      Main_Light: 'Right side 45 degree window natural warm sunlight',
      Color_Temperature: 'Warm tone, golden hour feeling, 3500K',
      Contrast: 'Soft low contrast, airy and high-key mood',
    },
  },
  minimalist_modern: {
    key: 'minimalist_modern',
    label: '极简现代',
    icon: '🏢',
    description: '35mm 广角冷调影棚光，纯净线条，高级感',
    photography: {
      Shot_Type: 'Wide shot, full bed visible',
      Focal_Length: '35mm f/2.8',
      Camera_Angle: 'Front view, eye-level, standing at the foot of the bed',
      Focus: 'Deep focus, entire scene sharp, architectural precision',
    },
    lighting: {
      Main_Light: 'Professional studio softbox lighting from above',
      Color_Temperature: 'Cool neutral tone, 5500K daylight balanced',
      Contrast: 'Clean medium contrast, sharp shadows, gallery-like',
    },
  },
  cozy_lifestyle: {
    key: 'cozy_lifestyle',
    label: '温馨生活',
    icon: '☕',
    description: '50mm 自然光日常氛围，温暖治愈，适合小红书',
    photography: {
      Shot_Type: 'Medium shot, lifestyle composition',
      Focal_Length: '50mm f/1.8',
      Camera_Angle: 'Slightly above eye level, casual 30 degree angle',
      Focus: 'Natural focus on bedding, atmospheric background blur',
    },
    lighting: {
      Main_Light: 'Morning natural window light, slightly diffused through sheer curtains',
      Color_Temperature: 'Warm neutral, soft morning light, 4000K',
      Contrast: 'Low contrast, dreamy and inviting, gentle shadows',
    },
  },
  macro_texture: {
    key: 'macro_texture',
    label: '微距质感',
    icon: '🔬',
    description: '100mm 微距侧光，面料纹理极致放大，高端感',
    photography: {
      Shot_Type: 'Extreme close-up macro',
      Focal_Length: '100mm f/2.8 macro lens',
      Camera_Angle: 'Low angle, camera at fabric surface level',
      Focus: 'Ultra-sharp focus on fabric weave pattern, extreme shallow depth of field',
    },
    lighting: {
      Main_Light: 'Directional side lighting from the left, 30 degree angle',
      Color_Temperature: 'Neutral balanced, 5000K',
      Contrast: 'High contrast to reveal textile fibers and weave details',
    },
  },
  topdown_flatlay: {
    key: 'topdown_flatlay',
    label: '俯拍平铺',
    icon: '📐',
    description: '正上方俯视构图，展示完整花型排版，电商标准',
    photography: {
      Shot_Type: 'Top-down bird eye view flat-lay',
      Focal_Length: '24mm f/4, no distortion',
      Camera_Angle: 'Camera directly above the bed pointing straight down',
      Focus: 'Even focus across entire frame, flat-lay composition',
    },
    lighting: {
      Main_Light: 'Even overhead studio lighting, dual softbox setup',
      Color_Temperature: 'Neutral daylight, 5500K',
      Contrast: 'Low even contrast, minimal shadows, product catalog standard',
    },
  },
  wedding_festive: {
    key: 'wedding_festive',
    label: '婚庆喜庆',
    icon: '💒',
    description: '红金暖色调，节日灯光，85mm 浅景深',
    photography: {
      Shot_Type: 'Medium close-up',
      Focal_Length: '85mm f/1.4',
      Camera_Angle: '3/4 view from the front-right, slightly above',
      Focus: 'Focus on the bedding center, warm bokeh lights in background',
    },
    lighting: {
      Main_Light: 'Warm ambient lighting with accent lantern-style side lights',
      Color_Temperature: 'Warm golden tone, festive, 3000K',
      Contrast: 'Rich warm contrast, deep shadows, luxurious mood',
    },
  },
  korean_fresh: {
    key: 'korean_fresh',
    label: '清新韩式',
    icon: '🍃',
    description: '自然晨光高调明亮，清爽透气，白净干净',
    photography: {
      Shot_Type: 'Medium shot',
      Focal_Length: '50mm f/2.0',
      Camera_Angle: '3/4 view from the front-left, slightly above eye level',
      Focus: 'Crisp focus on bedding, light airy background',
    },
    lighting: {
      Main_Light: 'Bright morning natural sunlight streaming through sheer white curtains',
      Color_Temperature: 'Cool white tone, crisp and fresh, 6000K',
      Contrast: 'Very low contrast, high-key, bright and airy, minimal shadows',
    },
  },
};

/** 所有预设的 key 列表 */
export const PHOTOGRAPHY_PRESET_KEYS = Object.keys(PHOTOGRAPHY_PRESETS);

/** 默认预设 */
export const DEFAULT_PHOTOGRAPHY_PRESET = 'french_romantic';

/**
 * 获取摄影预设，带兜底
 */
export function getPhotographyPreset(key: string): PhotographyPreset {
  return PHOTOGRAPHY_PRESETS[key] || PHOTOGRAPHY_PRESETS[DEFAULT_PHOTOGRAPHY_PRESET];
}
