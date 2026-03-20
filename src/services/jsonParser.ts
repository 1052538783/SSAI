/**
 * jsonParser — 多层容错 JSON 解析器
 *
 * 设计理念：
 * LLM 返回的 JSON 经常包含各种"污染"（markdown标记、注释、尾逗号等），
 * 简单的 JSON.parse 很容易崩溃。此解析器通过五层递进尝试，
 * 最大化解析成功率，同时记录修复日志。
 *
 * 五层解析策略：
 * 1. 直接 JSON.parse
 * 2. 剥离 markdown 代码块标记
 * 3. 清理尾逗号、注释、非法转义
 * 4. 正则提取最外层 {...} 或 [...]
 * 5. 彻底失败 → 返回友好错误提示
 */

import type { ToonData } from '../types/toonSchema';

// ============================================================
// 通用 JSON 解析
// ============================================================

export interface ParseResult<T = unknown> {
  /** 是否解析成功 */
  success: boolean;
  /** 解析后的数据 */
  data: T | null;
  /** 错误描述（用户友好型） */
  error?: string;
  /** 修复日志（开发调试用） */
  repairLog: string[];
  /** 原始文本（调试用） */
  rawText: string;
}

/**
 * 多层容错 JSON 解析器
 * @param raw LLM 返回的原始文本
 * @returns ParseResult
 */
export function parseRobustJson<T = unknown>(raw: string): ParseResult<T> {
  const repairLog: string[] = [];
  const trimmed = (raw || '').trim();

  if (!trimmed) {
    return {
      success: false, data: null, rawText: raw,
      error: 'AI 返回内容为空，请点击重试',
      repairLog: ['输入为空字符串'],
    };
  }

  // ── 第1层：直接解析 ──
  try {
    const data = JSON.parse(trimmed) as T;
    repairLog.push('✅ 第1层：直接 JSON.parse 成功');
    return { success: true, data, repairLog, rawText: raw };
  } catch {
    repairLog.push('❌ 第1层失败：直接 JSON.parse 报错');
  }

  // ── 第2层：去除 markdown 代码块标记 ──
  let cleaned = trimmed;
  // 移除 ```json ... ``` 或 ```JSON\n ... ``` 等各种变体
  cleaned = cleaned.replace(/^```(?:json|JSON|js|javascript)?\s*\n?/m, '');
  cleaned = cleaned.replace(/\n?```\s*$/m, '');
  cleaned = cleaned.trim();

  try {
    const data = JSON.parse(cleaned) as T;
    repairLog.push('✅ 第2层：去除 markdown 代码块后解析成功');
    return { success: true, data, repairLog, rawText: raw };
  } catch {
    repairLog.push('❌ 第2层失败：去除 markdown 后仍然报错');
  }

  // ── 第3层：清理尾逗号、注释、非法转义 ──
  let repaired = cleaned;
  // 移除单行注释 // ...
  repaired = repaired.replace(/\/\/[^\n]*/g, '');
  // 移除多行注释 /* ... */
  repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');
  // 移除 JSON 中对象/数组最后一个元素后的逗号（trailing comma）
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  // 修复不合法的换行符在字符串内部的情况
  repaired = repaired.replace(/(?<=":)\s*"([^"]*)\n([^"]*)"/, '"$1\\n$2"');
  repaired = repaired.trim();

  try {
    const data = JSON.parse(repaired) as T;
    repairLog.push('✅ 第3层：清理尾逗号/注释后解析成功');
    return { success: true, data, repairLog, rawText: raw };
  } catch {
    repairLog.push('❌ 第3层失败：清理后仍然报错');
  }

  // ── 第4层：正则提取最外层 {...} 或 [...] ──
  // 贪心匹配第一个 { ... 最后一个 }
  const objMatch = repaired.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const data = JSON.parse(objMatch[0]) as T;
      repairLog.push('✅ 第4层：正则提取 {...} 后解析成功');
      return { success: true, data, repairLog, rawText: raw };
    } catch {
      repairLog.push('❌ 第4层(obj)失败');
    }
  }

  const arrMatch = repaired.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const data = JSON.parse(arrMatch[0]) as T;
      repairLog.push('✅ 第4层：正则提取 [...] 后解析成功');
      return { success: true, data, repairLog, rawText: raw };
    } catch {
      repairLog.push('❌ 第4层(arr)失败');
    }
  }

  // ── 第5层：彻底失败 ──
  repairLog.push('❌ 第5层：所有解析策略均失败');

  // 判断是否是模型过载/限流导致的非JSON响应
  const lowerText = trimmed.toLowerCase();
  let userError: string;
  if (lowerText.includes('rate limit') || lowerText.includes('quota') || lowerText.includes('429')) {
    userError = '⏳ AI 服务繁忙（请求限流），建议等待30秒后重试';
  } else if (lowerText.includes('safety') || lowerText.includes('blocked')) {
    userError = '🚫 AI 安全过滤触发，请检查参考图内容后重试';
  } else if (trimmed.length < 50) {
    userError = '⚠️ AI 回复过短，可能服务异常，请点击重试';
  } else {
    userError = '⚠️ AI 回复了非标准格式，请点击重试。如果多次失败，建议切换到 Pro 模型';
  }

  return {
    success: false, data: null, rawText: raw,
    error: userError,
    repairLog,
  };
}

// ============================================================
// ToonData 校验与填充
// ============================================================

/** ToonData 校验结果 */
export interface ToonDataValidation {
  /** 是否通过基本校验 */
  valid: boolean;
  /** 校验后的 ToonData（缺失字段已用默认值填充） */
  toonData: ToonData;
  /** 告警信息（用于日志） */
  warnings: string[];
}

/** 行业默认 ToonData（用于填充缺失字段） */
const DEFAULT_TOON_DATA: ToonData = {
  Platform_Vibe: 'Professional e-commerce product photography',
  Photography_And_Camera: {
    Shot_Type: 'Medium shot',
    Focal_Length: '85mm',
    Camera_Angle: '3/4 elevated view',
    Focus: 'Sharp focus on product, soft background',
  },
  Lighting_And_Atmosphere: {
    Main_Light: 'Soft natural window light from right side',
    Color_Temperature: 'Neutral 5000K',
    Contrast: 'Low contrast, balanced highlights',
  },
  Scene_And_Styling: {
    Bedroom_Style: 'Modern minimalist',
    Props: 'Minimal, clean composition',
  },
  Bedding_Material_And_Structure: {
    Fabric_Type: 'Premium cotton',
    Side_A_Outer: '{INJECT_USER_PATTERN}',
    Side_B_Inner: 'Solid color matching pattern background',
    Texture_Detail: 'Visible fine weave texture, soft natural folds',
  },
  Model_Presence: {
    Status: 'None',
    Model_Description: '',
  },
  Typography_And_Layout: {
    Layout_Zones: [],
  },
  Brand_Logo: {
    Status: 'None',
    Instruction: '',
  },
  Quality_Modifiers: 'Masterpiece, ultra-detailed, photorealistic, 8k resolution, commercial catalog standard',
};

/**
 * 校验并填充 ToonData
 * 对缺失的必要字段使用行业默认值填充，返回校验结果和告警列表
 */
export function validateToonData(data: unknown): ToonDataValidation {
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    warnings.push('输入数据不是有效对象，使用完整默认值');
    return { valid: false, toonData: { ...DEFAULT_TOON_DATA }, warnings };
  }

  const raw = data as Record<string, unknown>;
  const result = { ...DEFAULT_TOON_DATA };

  // 逐字段校验与填充
  if (typeof raw.Platform_Vibe === 'string') {
    result.Platform_Vibe = raw.Platform_Vibe;
  } else {
    warnings.push('Platform_Vibe 缺失，使用默认值');
  }

  // 摄影配置
  if (raw.Photography_And_Camera && typeof raw.Photography_And_Camera === 'object') {
    const cam = raw.Photography_And_Camera as Record<string, unknown>;
    result.Photography_And_Camera = {
      Shot_Type: typeof cam.Shot_Type === 'string' ? cam.Shot_Type : DEFAULT_TOON_DATA.Photography_And_Camera.Shot_Type,
      Focal_Length: typeof cam.Focal_Length === 'string' ? cam.Focal_Length : DEFAULT_TOON_DATA.Photography_And_Camera.Focal_Length,
      Camera_Angle: typeof cam.Camera_Angle === 'string' ? cam.Camera_Angle : DEFAULT_TOON_DATA.Photography_And_Camera.Camera_Angle,
      Focus: typeof cam.Focus === 'string' ? cam.Focus : DEFAULT_TOON_DATA.Photography_And_Camera.Focus,
    };
  } else {
    warnings.push('Photography_And_Camera 缺失，使用默认值');
  }

  // 光影配置
  if (raw.Lighting_And_Atmosphere && typeof raw.Lighting_And_Atmosphere === 'object') {
    const light = raw.Lighting_And_Atmosphere as Record<string, unknown>;
    result.Lighting_And_Atmosphere = {
      Main_Light: typeof light.Main_Light === 'string' ? light.Main_Light : DEFAULT_TOON_DATA.Lighting_And_Atmosphere.Main_Light,
      Color_Temperature: typeof light.Color_Temperature === 'string' ? light.Color_Temperature : DEFAULT_TOON_DATA.Lighting_And_Atmosphere.Color_Temperature,
      Contrast: typeof light.Contrast === 'string' ? light.Contrast : DEFAULT_TOON_DATA.Lighting_And_Atmosphere.Contrast,
    };
  } else {
    warnings.push('Lighting_And_Atmosphere 缺失，使用默认值');
  }

  // 场景配置
  if (raw.Scene_And_Styling && typeof raw.Scene_And_Styling === 'object') {
    const scene = raw.Scene_And_Styling as Record<string, unknown>;
    result.Scene_And_Styling = {
      Bedroom_Style: typeof scene.Bedroom_Style === 'string' ? scene.Bedroom_Style : DEFAULT_TOON_DATA.Scene_And_Styling.Bedroom_Style,
      Props: typeof scene.Props === 'string' ? scene.Props : DEFAULT_TOON_DATA.Scene_And_Styling.Props,
    };
  } else {
    warnings.push('Scene_And_Styling 缺失，使用默认值');
  }

  // 床品材质配置
  if (raw.Bedding_Material_And_Structure && typeof raw.Bedding_Material_And_Structure === 'object') {
    const bed = raw.Bedding_Material_And_Structure as Record<string, unknown>;
    result.Bedding_Material_And_Structure = {
      Fabric_Type: typeof bed.Fabric_Type === 'string' ? bed.Fabric_Type : DEFAULT_TOON_DATA.Bedding_Material_And_Structure.Fabric_Type,
      Side_A_Outer: typeof bed.Side_A_Outer === 'string' ? bed.Side_A_Outer : DEFAULT_TOON_DATA.Bedding_Material_And_Structure.Side_A_Outer,
      Side_B_Inner: typeof bed.Side_B_Inner === 'string' ? bed.Side_B_Inner : DEFAULT_TOON_DATA.Bedding_Material_And_Structure.Side_B_Inner,
      Texture_Detail: typeof bed.Texture_Detail === 'string' ? bed.Texture_Detail : DEFAULT_TOON_DATA.Bedding_Material_And_Structure.Texture_Detail,
    };
  } else {
    warnings.push('Bedding_Material_And_Structure 缺失，使用默认值');
  }

  // 模特控制
  if (raw.Model_Presence && typeof raw.Model_Presence === 'object') {
    const model = raw.Model_Presence as Record<string, unknown>;
    result.Model_Presence = {
      Status: (model.Status === 'Active' || model.Status === 'None') ? model.Status : 'None',
      Model_Description: typeof model.Model_Description === 'string' ? model.Model_Description : '',
    };
  } else {
    warnings.push('Model_Presence 缺失，默认为 None');
  }

  // 排版文字
  if (raw.Typography_And_Layout && typeof raw.Typography_And_Layout === 'object') {
    const typo = raw.Typography_And_Layout as Record<string, unknown>;
    if (Array.isArray(typo.Layout_Zones)) {
      result.Typography_And_Layout = {
        Layout_Zones: typo.Layout_Zones.map((zone: any) => ({
          Zone_Name: zone?.Zone_Name || 'Unknown_Zone',
          Zone_Position: zone?.Zone_Position || 'Center of image',
          Elements: Array.isArray(zone?.Elements) ? zone.Elements.map((el: any) => ({
            Type: el?.Type || 'text',
            Content: el?.Content || '',
            Size: el?.Size || '[Medium]',
            Font_Weight: el?.Font_Weight || 'Regular',
            Color: el?.Color || 'black',
            Extra: el?.Extra || '',
          })) : [],
        })),
      };
    } else {
      result.Typography_And_Layout = { Layout_Zones: [] };
      warnings.push('Typography_And_Layout.Layout_Zones 不是数组');
    }
  } else {
    warnings.push('Typography_And_Layout 缺失，默认为空排版');
  }

  // 品牌 Logo
  if (raw.Brand_Logo && typeof raw.Brand_Logo === 'object') {
    const logo = raw.Brand_Logo as Record<string, unknown>;
    result.Brand_Logo = {
      Status: (logo.Status === 'Keep' || logo.Status === 'None') ? logo.Status : 'None',
      Instruction: typeof logo.Instruction === 'string' ? logo.Instruction : '',
    };
  } else {
    result.Brand_Logo = { Status: 'None', Instruction: '' };
  }

  // 质量修饰符
  if (typeof raw.Quality_Modifiers === 'string') {
    result.Quality_Modifiers = raw.Quality_Modifiers;
  }

  return {
    valid: warnings.length === 0,
    toonData: result,
    warnings,
  };
}

/**
 * 安全截断 base64 数据用于日志展示
 * 图片 base64 替换为简短标注
 */
export function sanitizeForLog(requestBody: unknown): string {
  try {
    const text = JSON.stringify(requestBody, (_key, value) => {
      // 如果是 base64 字符串（通常超过200字符且不含空格）
      if (typeof value === 'string' && value.length > 200 && !value.includes(' ')) {
        return `[Base64 图片数据, ${Math.round(value.length / 1024)}KB]`;
      }
      return value;
    }, 2);
    return text;
  } catch {
    return '[无法序列化请求体]';
  }
}
