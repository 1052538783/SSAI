/**
 * Toon 编译器 — 将 ToonData JSON 确定性地编译为 Toon 纯文本提示词
 *
 * 设计原则：
 * 1. 确定性输出 — 相同 JSON 输入永远产生相同文本输出，杜绝格式幻觉
 * 2. 严格 Toon 语法 — 层级对齐、缩进一致、无 Markdown 符号
 * 3. 空值跳过 — JSON 字段为空/undefined 时自动省略该行
 * 4. 中文双引号包裹 — 所有用户可见文案内容自动用 "" 包裹
 * 5. 绝对禁止 — ** ## ``` 等 Markdown 标记
 */

import type { ToonData } from '../types/toonSchema';

// ============================================================
// 内部工具函数
// ============================================================

/**
 * 判断文案内容是否需要中文双引号包裹
 * 规则：包含中文字符的文案需要包裹，纯英文技术描述不需要
 */
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/**
 * 智能包裹文案：如果包含中文且尚未被双引号包裹，则自动添加
 */
function wrapQuotes(text: string): string {
  if (!text) return text;
  // 如果已经被中文引号包裹，原样返回
  if (text.startsWith('\u201c') && text.endsWith('\u201d')) return text;
  // 如果已经被英文引号包裹，原样返回
  if (text.startsWith('"') && text.endsWith('"')) return text;
  // 如果包含中文，用中文双引号包裹
  if (containsChinese(text)) return `\u201c${text}\u201d`;
  return text;
}

/**
 * 输出一行 Toon 键值对（带缩进）
 * @param key 键名
 * @param value 值（空值时返回 null 表示跳过）
 * @param indent 缩进级别（0=无缩进，1=2空格，2=4空格）
 * @param isTextContent 是否为文案内容（需要引号包裹）
 */
function toonLine(
  key: string,
  value: string | undefined | null,
  indent: number = 0,
  isTextContent: boolean = false,
): string | null {
  if (!value || value.trim() === '') return null;
  const prefix = '  '.repeat(indent);
  const displayValue = isTextContent ? wrapQuotes(value) : value;
  return `${prefix}${key}: ${displayValue}`;
}

// ============================================================
// 主编译函数
// ============================================================

/**
 * 将 ToonData JSON 编译为 Toon 纯文本提示词
 *
 * 输出示例：
 * ```
 * Subject: Premium E-commerce Home Textile Marketing Photography
 * Platform_Vibe: Xiaohongshu aesthetic, high emotional value
 * Photography_And_Camera:
 *   Shot_Type: Medium close-up
 *   Focal_Length: 85mm f/1.4
 *   ...
 * ```
 *
 * @param data ToonData JSON 中间态数据
 * @returns 编译后的纯文本提示词（完全无 Markdown）
 */
export function compileToonToText(data: ToonData): string {
  const lines: string[] = [];

  // 固定头部
  lines.push('Subject: Premium E-commerce Home Textile Marketing Photography');

  // 平台语境
  const platformLine = toonLine('Platform_Vibe', data.Platform_Vibe);
  if (platformLine) lines.push(platformLine);

  // 摄影与镜头
  if (data.Photography_And_Camera) {
    lines.push('Photography_And_Camera:');
    const cam = data.Photography_And_Camera;
    [
      toonLine('Shot_Type', cam.Shot_Type, 1),
      toonLine('Focal_Length', cam.Focal_Length, 1),
      toonLine('Camera_Angle', cam.Camera_Angle, 1),
      toonLine('Focus', cam.Focus, 1),
    ].forEach(l => { if (l) lines.push(l); });
  }

  // 光影与氛围
  if (data.Lighting_And_Atmosphere) {
    lines.push('Lighting_And_Atmosphere:');
    const light = data.Lighting_And_Atmosphere;
    [
      toonLine('Main_Light', light.Main_Light, 1),
      toonLine('Color_Temperature', light.Color_Temperature, 1),
      toonLine('Contrast', light.Contrast, 1),
    ].forEach(l => { if (l) lines.push(l); });
  }

  // 场景与道具
  if (data.Scene_And_Styling) {
    lines.push('Scene_And_Styling:');
    const scene = data.Scene_And_Styling;
    [
      toonLine('Bedroom_Style', scene.Bedroom_Style, 1),
      toonLine('Props', scene.Props, 1),
    ].forEach(l => { if (l) lines.push(l); });
  }

  // 床品材质与结构
  if (data.Bedding_Material_And_Structure) {
    lines.push('Bedding_Material_And_Structure:');
    const bed = data.Bedding_Material_And_Structure;
    [
      toonLine('Fabric_Type', bed.Fabric_Type, 1),
      toonLine('Side_A_Outer', bed.Side_A_Outer, 1),
      toonLine('Side_B_Inner', bed.Side_B_Inner, 1),
      toonLine('Texture_Detail', bed.Texture_Detail, 1),
    ].forEach(l => { if (l) lines.push(l); });
  }

  // 模特控制
  if (data.Model_Presence) {
    lines.push('Model_Presence:');
    lines.push(`  Status: ${data.Model_Presence.Status}`);
    if (data.Model_Presence.Status === 'Active' && data.Model_Presence.Model_Description) {
      const modelLine = toonLine('Model_Description', data.Model_Presence.Model_Description, 1);
      if (modelLine) lines.push(modelLine);
    }
  }

  // 排版与文字（电商核心 — 多区域动态结构）
  if (data.Typography_And_Layout && data.Typography_And_Layout.Layout_Zones) {
    lines.push('Typography_And_Layout:');
    data.Typography_And_Layout.Layout_Zones.forEach((zone, zoneIdx) => {
      if (!zone.Zone_Name) return;
      lines.push(`  Zone_${zoneIdx + 1} (${zone.Zone_Name}):`);
      if (zone.Zone_Position) {
        lines.push(`    Position: ${zone.Zone_Position}`);
      }
      if (zone.Elements && zone.Elements.length > 0) {
        zone.Elements.forEach((el, elIdx) => {
          const content = el.Content ? wrapQuotes(el.Content) : '';
          const sizeTag = el.Size || '[Medium]';
          const weight = el.Font_Weight || 'Regular';
          const color = el.Color || '';
          let line = `    Element_${elIdx + 1}: [${el.Type}] ${content} (Size: ${sizeTag}, Weight: ${weight}, Color: ${color})`;
          if (el.Extra) {
            line += ` | ${el.Extra}`;
          }
          lines.push(line);
        });
      }
    });
  }

  // 品牌 Logo
  if (data.Brand_Logo) {
    lines.push('Brand_Logo:');
    lines.push(`  Status: ${data.Brand_Logo.Status}`);
    if (data.Brand_Logo.Status === 'Keep' && data.Brand_Logo.Instruction) {
      const logoLine = toonLine('Instruction', data.Brand_Logo.Instruction, 1);
      if (logoLine) lines.push(logoLine);
    }
  }

  // 质量修饰符
  const qualityLine = toonLine('Quality_Modifiers', data.Quality_Modifiers);
  if (qualityLine) lines.push(qualityLine);

  return lines.join('\n');
}

// ============================================================
// 辅助函数：批量编译
// ============================================================

/**
 * 批量编译多个 ToonData 为文本数组
 */
export function compileToonBatch(dataList: ToonData[]): string[] {
  return dataList.map(compileToonToText);
}

// ============================================================
// 辅助函数：融合层 — 替换系统变量占位符
// ============================================================

/**
 * 将 ToonData 中的系统变量占位符替换为用户的实际产品数据
 *
 * @param data ToonData（可能含有 {INJECT_USER_PATTERN} 等占位符）
 * @param userAssets 用户的全局产品资产
 * @returns 融合后的 ToonData（所有占位符已替换为实际值）
 */
export function fuseToonWithUserAssets(
  data: ToonData,
  userAssets: {
    patternDescription?: string;
    pantoneColor?: string;
    logoInstruction?: string;
  },
): ToonData {
  // 深拷贝，避免修改原始数据
  const fused: ToonData = JSON.parse(JSON.stringify(data));

  // 融合 A 面花型
  if (userAssets.patternDescription && fused.Bedding_Material_And_Structure) {
    fused.Bedding_Material_And_Structure.Side_A_Outer =
      fused.Bedding_Material_And_Structure.Side_A_Outer
        .replace('{INJECT_USER_PATTERN}', userAssets.patternDescription);
    // 如果 AI 分析遗留了竞品花型描述，直接强制覆盖
    if (!fused.Bedding_Material_And_Structure.Side_A_Outer.includes(userAssets.patternDescription)) {
      fused.Bedding_Material_And_Structure.Side_A_Outer =
        `Render strict adherence to user uploaded pattern: ${userAssets.patternDescription}`;
    }
  }

  // 融合 B 面潘通色号
  if (userAssets.pantoneColor && fused.Bedding_Material_And_Structure) {
    fused.Bedding_Material_And_Structure.Side_B_Inner =
      fused.Bedding_Material_And_Structure.Side_B_Inner
        .replace('{INJECT_USER_PANTONE}', userAssets.pantoneColor);
    if (!fused.Bedding_Material_And_Structure.Side_B_Inner.includes(userAssets.pantoneColor)) {
      fused.Bedding_Material_And_Structure.Side_B_Inner = `Solid Color, strictly ${userAssets.pantoneColor}`;
    }
  }

  // 融合 Logo
  if (userAssets.logoInstruction && fused.Brand_Logo) {
    fused.Brand_Logo.Status = 'Keep';
    fused.Brand_Logo.Instruction = userAssets.logoInstruction;
  }

  return fused;
}
