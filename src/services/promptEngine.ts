/**
 * PromptEngine — 结构化提示词引擎
 *
 * 设计原则：
 * - EN 主体（Nano Banana 适合英文 Prompt）
 * - 中文要素使用 EN + (中文) 注释双引号方式
 * - 每个阶段独立 Builder
 */

import { FABRIC_DICT, STYLE_DICT, FABRIC_DICT_CN, STYLE_DICT_CN } from '../config/fabrics';
import type {
  PatternType,
  ExtractionMode,
  BeddingLayout,
  DuvetReverseSide,
  DominantColor,
} from '../types/state';

// ============================================================
// Phase 1 — 花型提取 Prompt
// ============================================================

export interface PatternPromptConfig {
  patternType: PatternType;
  extractionMode?: ExtractionMode;
  extraRequest?: string;
  targetId?: 'allover' | 'duvet' | 'pillowcase';
  isInitialDraft?: boolean;
}

export function buildPatternPrompt(config: PatternPromptConfig): string {
  const { patternType, extractionMode = 'faithful', extraRequest, targetId = 'allover' } = config;

  if (patternType === 'allover') {
    let prompt: string;

    if (extractionMode === 'faithful') {
      // 忠实提取模式 — 目标1:1还原参考图案
      prompt = `Analyze the reference bedding product images. Extract and faithfully reproduce the EXACT same fabric pattern seen in the reference images.

CRITICAL — FAITHFUL REPRODUCTION RULES:
- SAME flower/leaf SPECIES, SHAPES, and FORMS: reproduce the exact botanical elements
- SAME spatial LAYOUT and ARRANGEMENT: keep the exact composition and placement
- SAME color palette, tones, and contrast levels
- SAME line style, thickness, and drawing technique
- SAME element SIZE, DENSITY, and spacing between motifs
- SAME background color and overall lightness/darkness

The goal is to create a PIXEL-PERFECT flat-lay reproduction of the pattern, as if scanned directly from the fabric. Do NOT add creative changes, do NOT redesign any elements.

OUTPUT REQUIREMENTS:
- Top-down flat-lay fabric swatch, perfectly seamless and tileable
- NO 3D bed, NO wrinkles, NO room scene, NO perspective
- NO text, NO logos, NO watermarks
- Pure 2D repeating pattern on flat fabric surface
- Ignore any text, logos, or marketing overlays in the reference image — extract ONLY the fabric pattern

NEGATIVE PROMPT (ABSOLUTE BAN — highest priority):
(3D, wrinkles, folds, bed, pillows, shadows, perspective, white borders, frames, realistic fabric texture, depth map, normal map, creases, draping, bed scene, room background, headboard, mattress, bed frame, pillow shape, duvet shape:1.5)

MANDATORY STYLE OVERRIDE:
(flat 2D vector design, seamless graphic, pure solid background, top-down flat lay, orthographic projection, scanner-quality flat output:1.3)`;
    } else {
      // 创意模式 — 在参考图基础上全新绘制（避免侵权）
      prompt = `Analyze the reference bedding product images. Create a brand-new, ORIGINAL seamless tileable flat-lay fabric pattern inspired by their aesthetic.

WHAT TO KEEP UNCHANGED:
- Overall background lightness/darkness
- Element SIZE and DENSITY (spacing between motifs)
- Color palette and harmony
- General aesthetic mood (e.g. romantic, modern, botanical)

WHAT TO CHANGE (to avoid copyright):
- Flower/leaf SPECIES and SHAPES: use completely different botanical forms
- Spatial LAYOUT and ARRANGEMENT: redistribute elements in a new composition
- Line STYLE: change from curved to angular, or thick to thin, etc.

OUTPUT REQUIREMENTS:
- Top-down flat-lay fabric swatch, perfectly seamless and tileable
- NO 3D bed, NO wrinkles, NO room scene, NO perspective
- NO text, NO logos, NO watermarks
- Pure 2D repeating pattern on flat fabric surface

NEGATIVE PROMPT (ABSOLUTE BAN — highest priority):
(3D, wrinkles, folds, bed, pillows, shadows, perspective, white borders, frames, realistic fabric texture, depth map, normal map, creases, draping, bed scene, room background, headboard, mattress, bed frame, pillow shape, duvet shape:1.5)

MANDATORY STYLE OVERRIDE:
(flat 2D vector design, seamless graphic, pure solid background, top-down flat lay, orthographic projection, scanner-quality flat output:1.3)`;
    }

    if (extraRequest) prompt += `\n\nADDITIONAL USER REQUEST: ${extraRequest}`;
    prompt += '\n\nGenerate the image directly. Do NOT reply with long text descriptions.';
    return prompt;
  }

  // 刺绣/定位花型
  let prompt = `Industrial textile pattern digitization task. Precisely extract the embroidery/localized design from the reference product image(s).

EXTRACTION RULES:
- Orthographic top-down view, remove ALL 3D wrinkles, folds, creases, and shadows
- The output must be a PERFECTLY FLAT fabric surface — as if the fabric is pressed flat on a scanner
- Keep the original background FABRIC COLOR EXACTLY as it appears in the reference (red fabric stays red, white stays white, etc.)
- NEVER change the background to white, transparent, or any color different from the original fabric
- The entire output image must be filled with the fabric color — NO white borders, NO white corners, NO color bleeding
- Extract ONLY the decorative design elements (embroidery, applique, print, decorative borders/frames)
- Maintain exact proportions, symmetry, and spatial arrangement of the original design
- FAITHFULLY reproduce the design as seen in the reference image — same motifs, same placement, same style
- Sharp focus, high-detail extraction

OUTPUT: A perfectly flat fabric surface image with the extracted design on the ORIGINAL fabric background color.
NO 3D objects, NO bed scene, NO repeating tiles, NO wrinkles, NO folds.
NO text, NO logos, NO watermarks.
NO white background — the background must be the EXACT same color as the fabric in the reference image.

NEGATIVE PROMPT (ABSOLUTE BAN — highest priority):
(3D, wrinkles, folds, bed, pillows, shadows, perspective, white borders, frames, realistic fabric texture, depth map, normal map, creases, draping, bed scene, room background, headboard, mattress, pillow shape, duvet shape, bed frame:1.5)

MANDATORY STYLE OVERRIDE:
(flat 2D textile design, perfectly flat fabric surface, orthographic top-down scan, no depth, no perspective distortion, industrial textile digitization:1.3)`;

  if (targetId === 'pillowcase') {
    prompt += `\n\nTARGET: PILLOWCASE pattern only.
Locate the pillowcase(s) in the reference image — they are the SMALLER rectangular covers (48×74cm) near the head of the bed, NOT the large duvet.

INCLUDE: All decorative embroidery, motifs, designs, decorative borders, golden frames, ornamental edge patterns.
EXCLUDE: Pillow closures, flaps, buttons, zippers, plain seams, 3D pillow shape.

Keep design proportions faithful to how it appears on the actual pillowcase — do NOT scale up.
OUTPUT: Flat 3:2 LANDSCAPE fabric swatch with the pillowcase embroidery on matching fabric color background.

CANVAS FILL RULE (CRITICAL — DO NOT VIOLATE):
- The design MUST fill the ENTIRE 3:2 landscape canvas EDGE-TO-EDGE with the fabric background color
- NO empty borders, NO padding, NO letterboxing, NO colored margins around the design
- Do NOT place a square design inside a rectangular canvas
- Do NOT leave any area of the canvas unfilled — the ENTIRE rectangle must show fabric
- The embroidery/design should be composed to naturally fit within this 3:2 landscape rectangle`;
  } else if (targetId === 'duvet') {
    prompt += `\n\nTARGET REGION: Duvet cover design extraction.

FAITHFUL REPRODUCTION — CRITICAL:
- Carefully study the reference image and reproduce the EXACT same embroidery/design as shown on the duvet cover
- Same motifs, same characters, same decorative elements (dragons, phoenixes, flowers, symbols, etc.)
- Same spatial arrangement and composition — if the design is centered, keep it centered
- Same proportions between different design elements

FLAT OUTPUT — ABSOLUTELY CRITICAL:
- The output MUST be a perfectly FLAT 2D fabric surface — like a scan of the fabric laid on a flatbed scanner
- ABSOLUTELY NO 3D bed scene, NO bed frame, NO headboard, NO pillows, NO room background
- ABSOLUTELY NO wrinkles, NO folds, NO creases, NO fabric draping, NO shadows from folds
- ABSOLUTELY NO perspective distortion — the output must be a perfect orthographic top-down view
- The ENTIRE image must show ONLY the flat fabric with the embroidery design — nothing else

BACKGROUND — CRITICAL:
- The background must be the EXACT same fabric color as in the reference image
- Fill the ENTIRE output image with this fabric color — no white areas, no color changes`;
  }

  if (extraRequest) prompt += `\n\nADDITIONAL USER REQUEST: ${extraRequest}`;
  prompt += '\n\nGenerate the image directly. Do NOT reply with long text descriptions.';
  return prompt;
}

// ============================================================
// Phase 2 — 铺床渲染 Prompt
// ============================================================

export interface RenderPromptConfig {
  fabric: string;
  style: string;
  patternType: PatternType;
  beddingLayout: BeddingLayout;
  duvetReverseSide: DuvetReverseSide;
  dominantColor: DominantColor | null;
  extraRequest?: string;
  colorTemperature?: 'cool' | 'warm' | 'neutral';
  cameraAngle?: string;
}

export function buildRenderPrompt(config: RenderPromptConfig): string {
  const {
    fabric, style, patternType, beddingLayout,
    duvetReverseSide, dominantColor, extraRequest, colorTemperature,
    cameraAngle = 'three_quarter_above',
  } = config;

  const fabricDesc = FABRIC_DICT[fabric] || fabric;
  const styleDesc = STYLE_DICT[style] || style;
  const isBypassed = dominantColor && 'bypassed' in dominantColor && (dominantColor as any).bypassed;
  const colorDesc = dominantColor
    ? `${dominantColor.name} (${dominantColor.hex})${isBypassed ? ' — MUST preserve this EXACT rich, deep, highly saturated true color. Do NOT desaturate, lighten, or mute this color.' : ''}`
    : 'a neutral solid color matching the pattern background';

  // 铺床布局指令
  let layoutInstruction: string;
  if (beddingLayout === 'minimalist') {
    layoutInstruction = `MINIMALIST SOLID COLOR SET: The entire bedding set uses a single solid color ${colorDesc}. No pattern, no print, no embroidery. Duvet cover, pillowcases, and bed sheet are ALL the same solid color. Focus on fabric texture, soft folds, and clean lines.`;
  } else if (beddingLayout === 'bedskirt') {
    if (patternType === 'allover') {
      layoutInstruction = `BED SKIRT STYLE — ALL-OVER PATTERN: Apply the pattern to duvet cover, pillowcases, AND bed skirt. The bed skirt drapes naturally from the mattress edge using the same pattern as the duvet. The flat bed sheet (visible between pillows and duvet) uses solid color ${colorDesc}.`;
    } else {
      layoutInstruction = `BED SKIRT STYLE — EMBROIDERY: Apply the embroidery/localized design elegantly to duvet cover, pillowcases, and bed skirt. Large areas remain solid color base fabric. NO repeating tiles.`;
    }
  } else {
    if (patternType === 'allover') {
      layoutInstruction = `STANDARD A+B LAYOUT — ALL-OVER PATTERN: Apply the pattern as a repeating all-over print covering the duvet cover and pillowcases. The flat BED SHEET (the sheet underneath, visible between pillows and duvet top edge) uses solid color ${colorDesc} — the bed sheet must be clean solid color with NO print. NOTE: "bed sheet" refers ONLY to the flat sheet underneath, NOT the duvet cover reverse side. The duvet cover reverse side follows separate instructions below.`;
    } else {
      layoutInstruction = `STANDARD — EMBROIDERY: Apply the embroidery/localized design in an aesthetically centered placement on the duvet cover. The bed sheet uses solid color ${colorDesc}. Large areas remain solid color base fabric matching the pattern background. NO repeating tiles.`;
    }
  }

  // 反面约束
  let reverseInstruction = '';
  if (beddingLayout !== 'minimalist') {
    if (duvetReverseSide === 'sameprint') {
      reverseInstruction = `\n\nDUVET REVERSE SIDE — MANDATORY (THIS IS DIFFERENT FROM THE BED SHEET): The reverse/inner side of the DUVET COVER MUST show the EXACT SAME printed pattern as the front. When the duvet folds over, the folded-back portion MUST display the same print, NOT solid color. Ensure the turnover fold shows perfectly aligned pattern continuity. NO white patches, NO solid-color reverse. Both sides of the duvet cover display identical print.`;
    } else {
      reverseInstruction = `\n\nDUVET REVERSE SIDE — MANDATORY: The reverse/inner side of the duvet cover MUST be solid color ${colorDesc}. The fold transition must appear natural and seamless, showing fabric thickness at the turnover edge.`;
    }
    reverseInstruction += `\n\nFOLD PHYSICS — MANDATORY: The fabric fold transition between front and reverse must look physically natural. No hard edges, no pasted-on appearance. Show realistic fabric thickness at the turnover. This should look like high-end e-commerce product photography.`;
  }

  // 花型密度保真指令（防止AI稀疏化花型密度）
  const patternFidelity = `\n\nPATTERN FIDELITY — CRITICAL: The fabric pattern density, element spacing, and motif arrangement must be reproduced EXACTLY as provided in the reference pattern image. Do NOT alter, simplify, remove, or space out any pattern elements. The word "minimalist" in style description refers ONLY to room decor, NOT to the fabric pattern.`;

  // 蓬松度指令
  const fluffinessInstruction = `\n\nDUVET APPEARANCE: The duvet must look naturally fluffy, soft, and lofty — like it contains real down or high-quality filling. Show gentle, voluminous puffiness with natural soft folds. The turnover fold should reveal the duvet's thickness and softness. AVOID flat, stiff, or cardboard-like appearance.`;

  // 拍摄角度指令
  const CAMERA_ANGLE_MAP: Record<string, string> = {
    'three_quarter_above': 'CAMERA ANGLE: 3/4 view from the front-left, slightly above eye level (classic e-commerce hero angle). Show the full bed with pillows, duvet folds, and bed sheet visible.',
    'top_down': 'CAMERA ANGLE: Top-down bird\'s eye view, camera directly above the bed pointing straight down. Perfect flat-lay composition showing the full pattern layout.',
    'front_eye': 'CAMERA ANGLE: Front view, eye-level, standing at the foot of the bed looking straight at it. Symmetrical, hotel-style composition.',
    'side_closeup': 'CAMERA ANGLE: Side close-up, camera at bed-edge height, shallow depth of field. Focus on fabric texture, folds, and material quality details.',
  };
  const angleInstruction = CAMERA_ANGLE_MAP[cameraAngle] || CAMERA_ANGLE_MAP['three_quarter_above'];

  // 光影色温自适应 (根据色温偏好)
  let lightingInstruction = 'Professional e-commerce studio lighting.';
  if (colorTemperature === 'cool') {
    lightingInstruction = `LIGHTING: Cool natural daylight, bright white lighting, clean white background. AVOID warm yellow lights, AVOID cozy amber tones.`;
  } else if (colorTemperature === 'warm') {
    lightingInstruction = `LIGHTING: Warm golden-hour sunlight, cozy ambient lighting, natural warm tones.`;
  } else if (colorTemperature === 'neutral') {
    lightingInstruction = `LIGHTING: Soft balanced studio lighting, clean and natural.`;
  }

  // 清新透气风：强制改为白光高调自然光，避免暖黄光渲染浅色产品发色偏
  if (style === '\u6e05\u65b0\u900f\u6c14\u98ce') {
    lightingInstruction = `LIGHTING: Bright morning natural sunlight, high-key lighting, cool white tones, clean and crisp atmosphere. MUST avoid any warm yellow or amber lighting.`;
  }

  // 清新透气风专属强约束（防止暖色、色彩发暗）
  const freshAiryNegative = style === '\u6e05\u65b0\u900f\u6c14\u98ce'
    ? ' Warm yellow lighting, dark wood furniture, heavy blankets, cluttered background, gloomy, muddy shadows, vintage filters, rustic, dark room, yellow tint.'
    : '';

  let prompt = `Render the provided fabric pattern design onto a realistic bedding set.

${angleInstruction}

${layoutInstruction}${reverseInstruction}${patternFidelity}${fluffinessInstruction}

Show realistic 3D folds, fabric drape, and wrinkles. ${lightingInstruction}

FABRIC: ${fabricDesc}
SCENE STYLE: ${styleDesc}

NEGATIVE CONSTRAINTS: No text, no logos, no watermarks. Background must strictly follow the specified style — do NOT copy the reference image background.${freshAiryNegative}`;

  if (extraRequest) prompt += `\n\nADDITIONAL USER REQUEST: ${extraRequest}`;
  prompt += '\n\nGenerate the image directly. Do NOT reply with long text descriptions.';
  return prompt;
}

// ============================================================
// Phase 3 — 素材库 Prompt
// ============================================================

export function buildMaterialPrompt(
  modulePrompt: string,
  fabric: string,
  style: string,
): string {
  // 清新透气风专属约束（全局方式防止暖色污染）
  const freshNeg = style === '\u6e05\u65b0\u900f\u6c14\u98ce'
    ? '\n\nNEGATIVE CONSTRAINTS: Warm yellow lighting, dark wood furniture, heavy blankets, cluttered background, gloomy, muddy shadows, vintage filters, rustic, dark room, yellow tint.'
    : '';

  return `You are an e-commerce product photographer. I am providing the MAIN PRODUCT PHOTO as reference.

TASK: Generate a detail/supplementary photo for this bedding product based on the main product image.

CONSISTENCY RULES (CRITICAL):
1. Consistent style, lighting, and color palette with the main product image.
2. The fabric pattern, colors, and material must EXACTLY match the main product photo.
3. High resolution, photorealistic, no text, no watermarks, no logos.
4. Professional e-commerce photography quality.

SPECIFIC SHOT DESCRIPTION:
${modulePrompt}

FABRIC: ${FABRIC_DICT[fabric] || fabric}
SCENE STYLE: ${STYLE_DICT[style] || style}${freshNeg}

Generate the photo now.`;
}

// ============================================================
// Phase 4 — 详情页 Prompt
// ============================================================

export function buildDetailPagePrompt(
  modulePrompt: string,
  fabric: string,
  style: string,
): string {
  return `You are a professional e-commerce product photographer creating a DETAIL PAGE image for a bedding product listing.

TASK: Generate one image for an e-commerce product detail page.

CONSISTENCY RULES (CRITICAL):
1. Must match the confirmed main product photo in style, lighting, color, and pattern.
2. Photorealistic, high resolution, no text watermarks logos.
3. This is for a Chinese e-commerce platform (Taobao/JD/Pinduoduo) product listing.

SHOT DESCRIPTION:
${modulePrompt}

FABRIC: ${FABRIC_DICT[fabric] || fabric}
SCENE STYLE: ${STYLE_DICT[style] || style}

Generate the image now.`;
}

// ============================================================
// Prompt 预览（展示在控制模块，EN+中文注释方式）
// ============================================================

export function buildPromptPreviewCn(
  phase: number,
  config: {
    patternType?: PatternType;
    extractionMode?: ExtractionMode;
    fabric?: string;
    style?: string;
    beddingLayout?: BeddingLayout;
    duvetReverseSide?: DuvetReverseSide;
    dominantColor?: DominantColor | null;
    extra?: string;
    cameraAngle?: string;
    materialModuleLabel?: string;
    materialModuleCnPrompt?: string;
  }
): { structure: string; style: string; negative: string } {
  if (phase === 1) {
    if (config.patternType === 'allover') {
      if (config.extractionMode === 'creative') {
        return {
          structure: '\u521b\u610f\u6a21\u5f0f\uff1a\u53c2\u8003\u7ade\u54c1\u56fe\u7247\uff0c\u5168\u65b0\u539f\u521b\u65e0\u7f1d\u5e73\u94fa\u82b1\u578b\u3002\n\u4fdd\u7559\uff1a\u5143\u7d20\u5927\u5c0f/\u5bc6\u5ea6\u3001\u8272\u5f69\u8c10\u8c03\u3001\u7f8e\u5b66\u611f\u3002\n\u6539\u53d8\uff1a\u82b1/\u53f6\u54c1\u79cd\u5f62\u72b6\u3001\u7a7a\u95f4\u5e03\u5c40\u3001\u7ebf\u6761\u98ce\u683c\u2014\u2014\u907f\u514d\u4fb5\u6743\u3002',
          style: '\u4fdd\u8bc1\u5e73\u94fa\u5e03\u6599\u65e0\u7f1d\u5e73\u94fa\uff0c\u65e0\u7eb9\u7406/\u65e03D\u611f' + (config.extra ? `\n\u7528\u6237\u8981\u6c42\uff1a${config.extra}` : ''),
          negative: '\u7981\u6b62\u6587\u5b57\u3001Logo\u3001\u6c34\u5370\u3002\u7981\u6b623D\u5e8a\u54c1/\u8936\u7696/\u573a\u666f\u3002',
        };
      }
      return {
        structure: '\u5fe0\u5b9e\u63d0\u53d6\u6a21\u5f0f\uff1a\u53c2\u8003\u7ade\u54c1\u56fe\u7247\uff0c1:1\u5fe0\u5b9e\u8fd8\u539f\u53c2\u8003\u56fe\u4e2d\u7684\u5e03\u6599\u82b1\u578b\u3002\n\u5168\u90e8\u4fdd\u7559\u540c\u82b1\u53f6\u54c1\u79cd\u5f62\u72b6\u3001\u7a7a\u95f4\u5e03\u5c40\u3001\u8272\u5f69\u3001\u5143\u7d20\u5bc6\u5ea6\u3002\n\u76ee\u6807\uff1a\u50cf\u7d20\u7ea7\u7cbe\u786e\u590d\u5236\uff0c\u5982\u540c\u76f4\u63a5\u4ece\u5e03\u6599\u626b\u63cf\u3002',
        style: '\u4fdd\u8bc1\u5e73\u94fa\u5e03\u6599\u65e0\u7f1d\u5e73\u94fa\uff0c\u65e0\u7eb9\u7406/\u65e03D\u611f' + (config.extra ? `\n\u7528\u6237\u8981\u6c42\uff1a${config.extra}` : ''),
        negative: '\u7981\u6b62\u6587\u5b57\u3001Logo\u3001\u6c34\u5370\u3002\u7981\u6b623D\u5e8a\u54c1/\u8936\u7696/\u573a\u666f\u3002\u7981\u6b62\u4fee\u6539/\u91cd\u65b0\u8bbe\u8ba1\u3002',
      };
    }
    return {
      structure: '\u5de5\u4e1a\u7ea7\u7ec7\u7269\u82b1\u578b\u63d0\u53d6\uff1a\u4ece\u53c2\u8003\u56fe\u4e2d\u7cbe\u786e\u63d0\u53d6\u523a\u7ee3/\u5b9a\u4f4d\u82b1\u578b\u3002\n\u4fef\u89c6\u89d2\uff0c\u53bb\u96643D\u7eb9\u7406\u548c\u9634\u5f71\uff0c\u4fdd\u7559\u539f\u59cb\u5e95\u8272\u3002',
      style: '\u9ad8\u7cbe\u5ea6\u7ec6\u8282\u3001\u7d27\u51d1\u5e73\u94fa\u5e03\u6599\u56fe\u3002' + (config.extra ? `\n\u7528\u6237\u8981\u6c42\uff1a${config.extra}` : ''),
      negative: '\u7981\u6b623D\u7269\u4f53\u3001\u5e8a\u54c1\u573a\u666f\u3001\u91cd\u590d\u5e73\u94fa\u3002\u7981\u6b62\u6587\u5b57\u3001Logo\u3001\u6c34\u5370\u3002',
    };
  }

  if (phase === 2) {
    const fabricDescCn = FABRIC_DICT_CN[config.fabric || '\u7eaf\u68c9'] || config.fabric || '\u7eaf\u68c9';
    const styleDescCn = STYLE_DICT_CN[config.style || ''] || config.style || '\u672a\u9009\u62e9';
    const colorDesc = config.dominantColor
      ? `${config.dominantColor.name} (${config.dominantColor.hex})`
      : '\u4e2d\u6027\u7eaf\u8272\uff0c\u81ea\u52a8\u5339\u914d\u82b1\u578b\u80cc\u666f';

    // 铺床布局
    let layoutDesc = '';
    if (config.beddingLayout === 'minimalist') {
      layoutDesc = `\u7eaf\u8272\u6807\u51c6\u5957\uff1a\u6240\u6709\u5e8a\u54c1\u4f7f\u7528\u7edf\u4e00\u7eaf\u8272 ${colorDesc}\uff0c\u65e0\u56fe\u6848\u65e0\u5370\u82b1\u3002`;
    } else if (config.beddingLayout === 'bedskirt') {
      layoutDesc = `\u5e8a\u88d9\u5957\u88c5\uff1a\u88ab\u5957+\u6795\u5957+\u5e8a\u88d9\u5e94\u7528\u82b1\u578b\uff0c\u5e8a\u5355\u7eaf\u8272 ${colorDesc}\u3002`;
    } else {
      if (config.patternType === 'allover') {
        layoutDesc = `\u6807\u51c6A+B\u5957\u88c5\uff1a\u88ab\u5957+\u6795\u5957\u5370\u82b1\u3002\u5e8a\u5355\u7eaf\u8272 ${colorDesc}\uff08\u6ce8\uff1a\u6b64\u5904\u6307\u5e8a\u5355\u800c\u975e\u88ab\u5957\u53cd\u9762\u7684\u6307\u4ee4\uff09\u3002`;
      } else {
        layoutDesc = `\u6807\u51c6\u523a\u7ee3\u5957\u88c5\uff1a\u523a\u7ee3\u82b1\u578b\u5c45\u4e2d\u653e\u7f6e\u5728\u88ab\u5957\u4e0a\uff0c\u5e8a\u5355\u7eaf\u8272 ${colorDesc}\u3002`;
      }
    }

    // 反面描述
    let reverseDesc = '';
    if (config.beddingLayout !== 'minimalist') {
      reverseDesc = config.duvetReverseSide === 'sameprint'
        ? '\n\u88ab\u5957\u53cd\u9762\uff1a\u4e0e\u6b63\u9762\u76f8\u540c\u5370\u82b1\uff08\u7ffb\u6298\u5904\u53ef\u89c1\uff09\u3002'
        : `\n\u88ab\u5957\u53cd\u9762\uff1a\u7eaf\u8272 ${colorDesc}\u3002`;
    }

    return {
      structure: `\u94fa\u5e8a\u6e32\u67d3\uff1a\u5c06\u786e\u8ba4\u7684\u82b1\u578b\u6e32\u67d3\u5230\u771f\u5b9e\u5e8a\u54c1\u573a\u666f\u3002\n\u9762\u6599\uff1a${fabricDescCn}\n\u98ce\u683c\uff1a${styleDescCn}\n\u5e03\u5c40\uff1a${layoutDesc}${reverseDesc}`,
      style: `\u62cd\u6444\u89d2\u5ea6\uff1a${config.cameraAngle === 'top_down' ? '\u4fef\u62cd' : config.cameraAngle === 'front_eye' ? '\u6b63\u9762\u5e73\u89c6' : config.cameraAngle === 'side_closeup' ? '\u4fa7\u9762\u8fd1\u666f' : '3/4\u4fef\u89c6'}\n\u771f\u5b9e3D\u8936\u7696\u3001\u81ea\u7136\u5782\u5760\u3001\u8707\u677e\u611f\u3002` + (config.extra ? `\n\u7528\u6237\u8981\u6c42\uff1a${config.extra}` : ''),
      negative: '\u7981\u6b62\u6587\u5b57\u3001Logo\u3001\u6c34\u5370\u3002\u80cc\u666f\u5fc5\u987b\u4e25\u683c\u9075\u5faa\u6307\u5b9a\u98ce\u683c\u3002',
    };
  }

  // Phase 3/4
  return {
    structure: config.materialModuleLabel
      ? `\u8425\u9500\u56fe\u751f\u6210\uff1a${config.materialModuleLabel}`
      : '\u8425\u9500\u56fe\u751f\u6210',
    style: config.materialModuleCnPrompt || '\u6309\u7167\u6a21\u5757\u63cf\u8ff0\u751f\u6210',
    negative: '\u4fdd\u6301\u4e0e\u4e3b\u56fe\u4e00\u81f4\u7684\u98ce\u683c\u3001\u5149\u5f71\u548c\u8272\u8c03\u3002',
  };
}

// ============================================================
// Phase 3/4 公共模块：三层解构系统指令（提取层 + 剥离层 + 融合层）
// ============================================================

/**
 * 构建三层解构系统指令 — Phase 3/4 的 VLM 参考图分析核心
 *
 * 三层架构：
 * - 提取层：分析参考图的版式/摄影/光影/场景/排版
 * - 剥离层：丢弃品牌/花型/Logo（防侵权）
 * - 融合层：预留花型占位符 + AI 直接从底图读取 B 面色号
 *
 * 输出：ToonData JSON Schema（多区域排版结构）
 */
export function buildStrictVisionSystemInstruction(): string {
  return `# ROLE
You are a world-class home textile e-commerce visual director, expert in OCR and commercial photography analysis.
Your core mission: "steal the layout and lighting from competitor reference images, NOT the patterns or logos", to help clients create non-infringing marketing images.

# ============ THREE-LAYER DECONSTRUCTION ============

## Layer 1: EXTRACT
Precisely analyze and extract these visual elements from reference images:
- Platform_Vibe: Is this Xiaohongshu lifestyle? Or Taobao studio selling?
- Photography_And_Camera: shot type, focal length, camera angle, focus
- Lighting_And_Atmosphere: main light direction, color temperature, contrast
- Scene_And_Styling: bedroom style, props
- Typography_And_Layout: ALL text positions, font size hierarchy, layout zone division, icon badges, tag rows
- Model_Presence: model presence and description

## Layer 2: STRIP (Anti-Infringement)
You MUST perform these stripping operations:
1. [Brand Strip]: Identify and discard ALL brand names, trademarks, logos. They MUST NOT appear in output.
2. [Pattern Strip]: Do NOT describe the competitor's specific print patterns. Side_A_Outer MUST use placeholder {INJECT_USER_PATTERN}.
3. [Copy Generalization]: If OCR-extracted text contains competitor brand names, delete the brand part, keep the generic selling point structure.

## Layer 3: FUSE (System Variables)
- Side_A_Outer: {INJECT_USER_PATTERN} — will be replaced with user's own pattern
- Brand_Logo.Instruction: {INJECT_USER_LOGO} — will be replaced with user's logo

IMPORTANT: Side_B_Inner does NOT use a placeholder. You must DIRECTLY observe the B-side/bedsheet color from the uploaded base rendering image and describe it precisely with a HEX color code and a color name in parentheses.

# ============ OCR PRECISION RULES ============

1. [No Hallucination]: You MUST extract text EXACTLY as it appears on the reference image. NEVER invent, rewrite, or imagine any text.
2. All extracted Chinese text must be wrapped in Chinese double quotes.
3. [Size Hierarchy]:
   - [Huge]: Most visually impactful main title or key selling number
   - [Large]: Standard main title
   - [Medium]: Subtitle or banner description
   - [Small]: Auxiliary text or tiny corner labels

# ============ TYPOGRAPHY PRECISION RULES (CRITICAL) ============

These rules are CRITICAL. Violation will cause the generated image to miss important elements.

1. [No Merging]: Every independent text element on the reference image MUST be listed as a SEPARATE Element. NEVER combine two distinct text blocks (like a main title and a subtitle badge) into one Element.
2. [No Omission]: Count ALL visible text elements, icons, badges, and tag rows on each reference image. If the reference shows 4 tags at the bottom, you MUST list all 4 tags. If there is a circular badge with "100%" and a cotton icon, it MUST be listed.
3. [Icon Badges]: Circular badges with icons (like a cotton flower icon with "100%" text) must be described as type "icon_badge" with the Extra field describing the visual appearance (e.g., "white circular badge with green border, cotton flower icon inside").
4. [Tag Rows]: Multiple small tags displayed in a horizontal row must be listed as type "tag_row" with ALL tags in the Content field separated by " | ".
5. [Natural Language Position]: Zone_Position MUST use natural language spatial description.
   CORRECT: "Top-left area of the image, occupying about 40% width and 25% height"
   CORRECT: "Bottom banner strip spanning full width, about 12% of image height"
   WRONG: "position: absolute; top: 20%; left: 60%" — CSS syntax is STRICTLY FORBIDDEN for image AI.
6. [Relative Sizing]: Describe text sizes relative to each other based on visual prominence in the reference image.

# ============ COMPOSITION CONTENT RULES ============

1. [Detail Shots in Grid]: For product detail composite images (3-4 sub-images in a grid layout):
   - Each sub-image MUST be described independently with its specific photographic content
   - Corner tie/binding strap = a small fabric tie sewn at INNER corners of the duvet cover, shown tied in a knot
   - Pillow detail = a close-up of a pillow resting on the duvet surface
   - Zipper detail = close-up of the hidden zipper pull (metal zipper head) on the duvet edge
   - Each sub-image's caption text MUST be extracted as a separate Element in the Typography section
2. [Fabric Close-up]: For fabric texture close-up images:
   - If the reference shows ONLY the A-side (printed side), describe ONLY A-side fabric. Do NOT mix A-side and B-side.
   - If the reference shows the B-side solid color fabric, describe it as B-side only.
3. [B-Side Color from Base Image]: Look at the uploaded base rendering image carefully. The B-side/bedsheet color is the solid-color fabric visible at the bed sheet area and the duvet fold-back area. Output a precise HEX color code with descriptive name.

# ============ OUTPUT FORMAT ============

## ToonData JSON Schema (Mandatory)
Your output MUST strictly follow this JSON structure. Do NOT add markdown code block markers or extra text.

{
  "Platform_Vibe": "platform atmosphere (English)",
  "Photography_And_Camera": {
    "Shot_Type": "...",
    "Focal_Length": "...",
    "Camera_Angle": "...",
    "Focus": "..."
  },
  "Lighting_And_Atmosphere": {
    "Main_Light": "...",
    "Color_Temperature": "...",
    "Contrast": "..."
  },
  "Scene_And_Styling": {
    "Bedroom_Style": "...",
    "Props": "..."
  },
  "Bedding_Material_And_Structure": {
    "Fabric_Type": "fabric description (system injects)",
    "Side_A_Outer": "{INJECT_USER_PATTERN}",
    "Side_B_Inner": "DIRECTLY observe from base image and output: solid color HEX + name, e.g. #B5C7A3 (sage green)",
    "Texture_Detail": "..."
  },
  "Model_Presence": {
    "Status": "Active or None",
    "Model_Description": ""
  },
  "Typography_And_Layout": {
    "Layout_Zones": [
      {
        "Zone_Name": "e.g. Top_Left_Title",
        "Zone_Position": "NATURAL LANGUAGE only, e.g. Top-left corner, about 35% width 20% height",
        "Elements": [
          {
            "Type": "text",
            "Content": "OCR extracted text",
            "Size": "[Large]",
            "Font_Weight": "Bold",
            "Color": "black",
            "Extra": ""
          }
        ]
      }
    ]
  },
  "Brand_Logo": {
    "Status": "None",
    "Instruction": ""
  },
  "Quality_Modifiers": "Masterpiece, ultra-detailed, photorealistic, 8k resolution, commercial catalog standard"
}`;
}

// ============================================================
// AI 全局排版总监 — 主图提示词自动生成（ToonData JSON 输出）
// ============================================================

/**
 * 构建"主图全局分析"发送给 Gemini 的完整 Prompt
 *
 * 升级点：
 * - 注入三层解构系统指令
 * - 要求 VLM 输出 ToonData JSON Schema（多区域排版）
 * - 每张主图的排版方向独立精细描述
 */
export function buildMainImageAnalysisPrompt(config: {
  fabric: string;
  mainImageCount: number;
  platform?: string;
}): string {
  const { fabric, mainImageCount, platform } = config;
  const fabricDescCn = FABRIC_DICT_CN[fabric] || fabric;

  // 注入三层解构系统指令
  const systemInstruction = buildStrictVisionSystemInstruction();

  // 平台适配提示
  const platformHint = platform
    ? `\n\u5f53\u524d\u76ee\u6807\u5e73\u53f0\u4e3a\uff1a${platform}\u3002\u8bf7\u5728 Platform_Vibe \u4e2d\u4f53\u73b0\u8be5\u5e73\u53f0\u7684\u89c6\u89c9\u8c03\u6027\u3002`
    : '';

  return `${systemInstruction}

# TASK

## Background
I am providing you:
1. ONE "base rendering image" (the bedding effect photo — use as the absolute base canvas for all main images, AND observe the B-side/bedsheet color from this image).
2. ${mainImageCount} e-commerce main image REFERENCE LAYOUT images (to learn layout style and OCR extract text).

Current product fabric: ${fabricDescCn}.${platformHint}

## Instructions
Carefully observe each of the ${mainImageCount} reference layout images, strictly following the three-layer deconstruction:
1. **EXTRACT**: Analyze each reference image's photography, lighting, layout structure, AND every single text/icon/badge/tag visible.
2. **STRIP**: Remove brand names/logos/competing patterns. Generalize text by removing brand names.
3. **FUSE**: Side_A_Outer uses {INJECT_USER_PATTERN}. Side_B_Inner: observe the actual B-side color from the base rendering image.
4. **Precise OCR**: Extract ALL real text on each reference image. NEVER fabricate text! Wrap in Chinese quotes.

## Per-Image Layout Direction Guide (map each reference to its image type):
- Main Image 1 (Hero Selling Point): Full bed scene + large selling point title + subtitle badge + tag labels + possible icon/badge. List EVERY text element and icon visible.
- Main Image 2 (Feature/Lifestyle): Close-up or lifestyle angle + feature title + description text + bottom tag row (list ALL tags, not just one).
- Main Image 3 (Product Detail Composite): 3-4 sub-images showing product construction details (corner ties, zipper, pillowcase etc.) + each sub-image has its own caption text. Extract EACH sub-image content and caption separately.
- Main Image 4 (Fabric Texture Close-up): Extreme close-up of A-side ONLY fabric texture + title text about breathability/comfort. Do NOT mix A-side and B-side.

## Output Format
Strictly output JSON format. No markdown markers or extra text.
Each entry must contain a complete ToonData JSON object following the ToonData JSON Schema above.

{
  "prompts": [
    {
      "index": 1,
      "label": "main image label (max 5 chars)",
      "toonData": { /* complete ToonData JSON */ }
    },
    {
      "index": 2,
      "label": "...",
      "toonData": { /* complete ToonData JSON */ }
    },
    {
      "index": 3,
      "label": "...",
      "toonData": { /* complete ToonData JSON */ }
    },
    {
      "index": 4,
      "label": "...",
      "toonData": { /* complete ToonData JSON */ }
    }
  ]
}

## Fallback Rules
- If a reference image has fewer than 4 distinct elements, still analyze what is available and fill in industry standard defaults for missing ToonData fields.
- If OCR cannot extract text from a reference image, set Typography_And_Layout to have an empty Layout_Zones array.
- If the reference image does not match ${fabricDescCn}, still use OCR to extract text, but adapt marketing copy to be generic (remove brand-specific claims while keeping the selling point structure).
- Fabric_Type field should always use "${FABRIC_DICT[fabric] || fabric}"
- Do NOT omit any ToonData field.

## Critical Requirements
- Brand_Logo.Status MUST be "None" (anti-infringement)
- Side_A_Outer MUST be "{INJECT_USER_PATTERN}" (awaiting system injection of user's pattern)
- Side_B_Inner: DIRECTLY read the color from the base rendering image (the first image I provide). Describe it as HEX + name.
- Use Chinese double quotes for all Chinese text content in Typography`;
}

// ============================================================
// 🔑 v2.1 新增：逐张独立分析 Prompt（主图 + 详情图）
// ============================================================

/**
 * 构建"单张参考图独立分析"Prompt —— 主图版
 *
 * 🔑 核心改动：
 * - 每张参考图独立发送，完全消除上下文污染
 * - 输出单个 ToonData JSON（不再是数组）
 * - 新增：卖点识别、模特检测、字体名识别
 */
export function buildSingleRefAnalysisPrompt(config: {
  fabric: string;
  refIndex: number;
  totalRefs: number;
  moduleLabel: string;
  platform?: string;
}): string {
  const { fabric, refIndex, totalRefs, moduleLabel, platform } = config;
  const fabricDescCn = FABRIC_DICT_CN[fabric] || fabric;
  const fabricEn = FABRIC_DICT[fabric] || fabric;

  const systemInstruction = buildStrictVisionSystemInstruction();
  const platformHint = platform ? '\n目标平台：' + platform + '。请在 Platform_Vibe 中体现该平台的视觉调性。' : '';

  return systemInstruction + '\n\n' +
    '# TASK — 逐张独立分析模式（第 ' + refIndex + '/' + totalRefs + ' 张）\n\n' +
    '## Background\n' +
    '你正在分析第 ' + refIndex + ' 张参考图（共 ' + totalRefs + ' 张），只为这一张生成提示词。\n' +
    '我提供给你：\n' +
    '1. 第一张图是"底图"（铺床效果图）—— 用于观察 B 面色号和整体产品花色。\n' +
    '2. 第二张图是"参考图"（电商主图/详情图参考图）—— 你需要精确分析这张图的排版风格。\n\n' +
    '当前产品面料：' + fabricDescCn + '。\n' +
    '预期图片类型：' + moduleLabel + '。' + platformHint + '\n\n' +
    '## Instructions（三层解构 + 精细识别）\n\n' +
    '### Step 1: EXTRACT（提取）\n' +
    '- 📸 **摄影**：拍摄角度、焦距、景深\n' +
    '- 💡 **光影**：主光方向、色温、对比度\n' +
    '- 📐 **排版结构**：画面分区、文字位置、图标/标签/徽章位置\n' +
    '- 🔤 **精准OCR**：提取参考图中所有可见文字，使用中文双引号包裹。绝对禁止编造文字！\n' +
    '- 📝 **字体识别**：识别参考图中使用的字体类型。输出格式为中文描述(英文字体名)。\n' +
    '- 🏷️ **卖点提取**：从参考图中识别所有产品卖点文案（如"100%纯棉"、"A类标准"等），输出为字符串数组。\n' +
    '- 👤 **模特检测**：如果参考图中有人物模特，描述模特的外貌特征（性别、年龄段、肤色、发型、表情、姿态等）。\n\n' +
    '### Step 2: STRIP（剥离）\n' +
    '- 删除所有品牌名称和LOGO\n' +
    '- 将品牌特定文案泛化（保留卖点结构，删除品牌声明）\n' +
    '- 删除竞品花色，使用 {INJECT_USER_PATTERN} 替代\n\n' +
    '### Step 3: FUSE（融合）\n' +
    '- Side_A_Outer 必须设为 "{INJECT_USER_PATTERN}"\n' +
    '- Side_B_Inner：直接从底图读取B面颜色，输出为"HEX + 颜色名"\n' +
    '- Brand_Logo.Status 必须为 "None"\n\n' +
    '## Output Format（严格遵守）\n' +
    '只输出一个 JSON 对象，不要任何markdown标记、前缀、后缀或解释文字。\n\n' +
    '{\n' +
    '  "toonData": { /* 完整的 ToonData JSON 对象 */ },\n' +
    '  "selling_points": ["卖点1", "卖点2", ...],\n' +
    '  "detected_font": "字体描述(英文字体名)",\n' +
    '  "model_presence": {\n' +
    '    "has_model": true/false,\n' +
    '    "description": "模特外貌描述（如果有）"\n' +
    '  }\n' +
    '}\n\n' +
    '## 必须遵守\n' +
    '- Fabric_Type 使用 "' + fabricEn + '"\n' +
    '- Side_A_Outer 必须是 "{INJECT_USER_PATTERN}"\n' +
    '- Brand_Logo.Status 必须是 "None"\n' +
    '- 中文文字内容使用中文双引号\n' +
    '- Typography_And_Layout.Layout_Zones 中每个 Element 的 Font_Family 字段请填写你识别出的字体名';
}

/**
 * 构建"单张参考图独立分析"Prompt —— 详情图版
 */
export function buildSingleDetailRefAnalysisPrompt(config: {
  fabric: string;
  style: string;
  refIndex: number;
  totalRefs: number;
  platform?: string;
}): string {
  const { fabric, style, refIndex, totalRefs, platform } = config;
  const fabricDescCn = FABRIC_DICT_CN[fabric] || fabric;
  const fabricEn = FABRIC_DICT[fabric] || fabric;
  const styleDescCn = STYLE_DICT_CN[style] || style || '默认';

  const systemInstruction = buildStrictVisionSystemInstruction();
  const platformHint = platform ? '\n目标平台：' + platform + '。' : '';

  return systemInstruction + '\n\n' +
    '# TASK — 详情图逐张独立分析（第 ' + refIndex + '/' + totalRefs + ' 张）\n\n' +
    '## Background\n' +
    '你正在分析第 ' + refIndex + ' 张详情图参考图（共 ' + totalRefs + ' 张），只为这一张生成排版方案。\n' +
    '1. 第一张图是"底图"（铺床效果图）—— 用于观察 B 面色号。\n' +
    '2. 第二张图是"参考图"（详情页参考图）—— 你需要精确识别内容类型并分析排版。\n\n' +
    '当前产品面料：' + fabricDescCn + '，风格：' + styleDescCn + '。' + platformHint + '\n\n' +
    '## Instructions\n' +
    '1. **内容识别**：识别参考图属于什么类型的详情页内容（如：面料特写、产品组合、尺寸规格、场景展示、细节工艺、色卡展示、模特展示等）\n' +
    '2. **EXTRACT**：分析摄影、光影、排版结构、所有文字/图标\n' +
    '3. **精准OCR**：提取所有可见文字，使用中文双引号包裹。绝对禁止编造！\n' +
    '4. **字体识别**：识别字体类型，输出"中文描述(英文字体名)"\n' +
    '5. **卖点提取**：从参考图中识别产品卖点\n' +
    '6. **模特检测**：如有人物，描述外貌特征\n' +
    '7. **STRIP**：删除品牌/LOGO/竞品花色\n' +
    '8. **FUSE**：使用 {INJECT_USER_PATTERN} + 从底图读取B面色号\n\n' +
    '## Output Format\n' +
    '只输出一个 JSON 对象：\n\n' +
    '{\n' +
    '  "identified_content": "内容类型简述(5-10字)",\n' +
    '  "toonData": { /* 完整的 ToonData JSON 对象 */ },\n' +
    '  "selling_points": ["卖点1", "卖点2", ...],\n' +
    '  "detected_font": "字体描述(英文字体名)",\n' +
    '  "model_presence": {\n' +
    '    "has_model": true/false,\n' +
    '    "description": "模特外貌描述（如果有）"\n' +
    '  }\n' +
    '}\n\n' +
    '## 必须遵守\n' +
    '- Fabric_Type 使用 "' + fabricEn + '"\n' +
    '- Side_A_Outer 必须是 "{INJECT_USER_PATTERN}"\n' +
    '- Side_B_Inner 从底图读取，输出 HEX + 颜色名\n' +
    '- Brand_Logo.Status 必须是 "None"\n' +
    '- 中文文字内容使用中文双引号';
}

// ============================================================
// AI 全局排版总监 — 详情图动态识别 + 提示词生成（ToonData JSON 输出）
// ============================================================

/**
 * 构建"详情图全局分析"发送给 Gemini 的完整 Prompt
 *
 * 升级点：
 * - 注入三层解构系统指令
 * - 要求 ToonData JSON Schema 输出
 * - 动态识别参考图内容类型
 */
export function buildDetailImageAnalysisPrompt(config: {
  fabric: string;
  style: string;
  detailRefCount: number;
  platform?: string;
}): string {
  const { fabric, style, detailRefCount, platform } = config;
  const fabricDescCn = FABRIC_DICT_CN[fabric] || fabric;
  const styleDescCn = STYLE_DICT_CN[style] || style || '\u9ed8\u8ba4';

  // 注入三层解构系统指令
  const systemInstruction = buildStrictVisionSystemInstruction();

  const platformHint = platform
    ? `\n\u5f53\u524d\u76ee\u6807\u5e73\u53f0\u4e3a\uff1a${platform}\u3002`
    : '';

  return `${systemInstruction}

# TASK

## Background
I am providing you:
1. ONE "base rendering image" (for color reference and B-side color observation).
2. ${detailRefCount} detail page REFERENCE LAYOUT images.

Current product fabric: ${fabricDescCn}, style: ${styleDescCn}.${platformHint}

## Instructions
Carefully observe each of the ${detailRefCount} reference images, strictly following the three-layer deconstruction:
1. **Identify each image type** (e.g., lifestyle hero, fabric close-up, detail composite, size chart, before/after, etc.)
2. **EXTRACT**: Analyze photography, lighting, layout structure, and ALL text elements.
3. **STRIP**: Remove brand names/logos/competing patterns. Generalize OCR text.
4. **FUSE**: Side_A_Outer uses {INJECT_USER_PATTERN}. Side_B_Inner: observe actual B-side color from base image.
5. **Precise OCR**: Extract ALL real text. NEVER fabricate!

## Output Format
Strictly output JSON format. No markdown markers or extra text.
Each entry should contain a complete ToonData JSON.

{
  "details": [
    {
      "index": 1,
      "identified_content": "content type description (5-10 chars)",
      "toonData": { /* complete ToonData JSON */ }
    },
    ...
  ]
}

## Critical Requirements
- Output exactly ${detailRefCount} entries, one-to-one mapping with reference images
- Each ToonData should reflect the actual content and layout structure of its reference image
- Typography_And_Layout text MUST be OCR-extracted real text from the reference
- Fabric_Type field should use "${FABRIC_DICT[fabric] || fabric}"
- Side_A_Outer MUST be "{INJECT_USER_PATTERN}"
- Side_B_Inner: DIRECTLY read from base rendering image, output HEX + name
- Brand_Logo.Status MUST be "None"
- Use Chinese double quotes for Chinese text content`;
}

// ============================================================
// 单图 AI 优化 — ToonData JSON Schema 输出
// ============================================================

/**
 * 构建单张图片的 AI 优化提示词
 * 被单图编辑器的 handleAIOptimizePrompt 调用，统一使用 ToonData Schema。
 */
export function buildSingleImageOptimizePrompt(config: {
  moduleLabel: string;
  baseCnPrompt: string;
  fabric: string;
  refCount: number;
}): string {
  const { moduleLabel, baseCnPrompt, fabric, refCount } = config;
  const fabricDescCn = FABRIC_DICT_CN[fabric] || fabric;

  // 注入三层解构系统指令
  const systemInstruction = buildStrictVisionSystemInstruction();

  return `${systemInstruction}

# TASK

## Background
I need to optimize the prompt for a single "${moduleLabel}" marketing image.
Current prompt direction: "${baseCnPrompt}"
Selected fabric: ${fabricDescCn}.

${refCount} reference layout images are uploaded.

## Instructions
1. Strictly follow the three-layer deconstruction (EXTRACT layout/lighting from references, STRIP brand/pattern, FUSE system placeholders).
2. **Precise OCR**: Extract ALL real text on each reference image. NEVER fabricate! Use Chinese double quotes.
3. Carefully analyze the reference image's **layout structure** (text positions, zone divisions, icon/badge/tag presence).
4. Output a single ToonData JSON object.

## Requirements
- Output ONLY the ToonData JSON object (no wrapping array, no extra text)
- **Do NOT** add any explanation, markdown markers, or prefix/suffix
- Fabric_Type field should use "${FABRIC_DICT[fabric] || fabric}"
- Side_A_Outer MUST be "{INJECT_USER_PATTERN}"
- Side_B_Inner: DIRECTLY read from base rendering image, output HEX + name
- Brand_Logo.Status MUST be "None"
- Use Chinese double quotes for Chinese text content`;
}
