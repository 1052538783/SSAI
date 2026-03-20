/**
 * 素材模块定义 — Phase 3 细节素材库 + Phase 4 详情页模块
 * 每个模块含 key / emoji / label / EN prompt / CN prompt(展示用)
 */

// ============================================================
// 素材模块类型
// ============================================================
export interface MaterialModule {
  key: string;
  emoji: string;
  label: string;
  /** 英文 Prompt（实际发给 API 的） */
  prompt: string;
  /** 中文 Prompt（展示在卡片上的可编辑版本） */
  cnPrompt: string;
  /** 是否显示的条件函数（可选） */
  condition?: () => boolean;
  /** 用户是否启用此模块 */
  enabled: boolean;
}

// ============================================================
// 第三阶段 - 一键营销大图生成 (主图 + 详情图)
// ============================================================
import { FABRIC_SOURCE_IMAGE_PROMPTS } from './fabrics';

// 主图模块 (4张)
export const MAIN_IMAGE_MODULES: MaterialModule[] = [
  {
    key: 'hero_poster_wide',
    emoji: '🖼️',
    label: '主图1：卖点氛围图',
    prompt: 'Generate a bedding product hero image based on the provided bed rendering. Close-up from 45-degree front-side angle, warm bright lighting highlighting cotton softness. Top center bold title "7A级纯棉抗菌套件". Top right vertical white pill badges "100%优质长绒棉" and "亲肤舒适". Bottom right white circle "纯棉 100%". No brand logos.',
    cnPrompt: `# 角色
你是一位专业的家居电商视觉设计师。

# 任务
根据用户提供的"原始铺床效果图"，生成一张新的电商主图。主图需包含一张特写照片，并根据以下描述的布局添加文字信息。

# 步骤1: 图像生成指令
- 源图像: [程序传入用户的铺床效果图]
- 构图: 生成一张床品特写图。视角从床侧前方45度拍摄，焦点清晰地落在最前面的枕头和部分被子上。
- 风格: 整体色调明亮、温暖，光线柔和，突出纯棉的柔软质感和亲肤感。

# 步骤2: 布局与文字指令
- 布局描述: 这是一个典型的卖点突出型布局。
- 主标题:
    - 位置: 画面顶部中央。
    - 内容: "7A级纯棉抗菌套件"。
- 卖点标签组:
    - 位置: 画面右上角，垂直排列。
    - 样式: 白色圆角矩形背景。
    - 内容: 上方为"100%优质长绒棉"，下方为"亲肤舒适"。
- 圆形标签:
    - 位置: 画面右下角。
    - 样式: 白色圆形背景。
    - 内容: "纯棉\\n100%"（两行显示）。

# 禁止事项
- 禁止包含任何品牌名称或LOGO。
- 生成的图像必须与源图像中的产品花色和颜色保持高度一致。`,
    enabled: true,
  },
  {
    key: 'hero_poster_closeup',
    emoji: '🛏️',
    label: '主图2：场景功能图',
    prompt: 'Wide level bedroom recomposition from the provided bed rendering. Camera moved back and lowered for full view showing pillows, blanket, nightstand. Top center "柔软纯棉面料" with subtitle "柔软舒适 透气性好且手感细腻". Bottom 4 icon+text pairs: "全棉面料" "不易起球" "亲肤触感" "柔软透气". No brand logos.',
    cnPrompt: `# 角色
你是一位生活方式场景构建师和电商设计师。

# 任务
严格基于用户提供的"原始铺床效果图"所展示的唯一场景，通过调整拍摄角度生成一张新构图的主图，并根据以下描述的布局添加文字信息。

# 步骤1: 图像生成指令 (重新构图)
- 源图像: [程序传入用户的铺床效果图]
- 核心指令: 重新构图，而非重新创作。保持场景内所有物体和其相对位置不变。
- 视角变更: 模拟将摄像机向床尾方向移动并稍微降低高度，以获得一个比主图1更广、更全面的平视视角。
- 构图要求: 新构图中必须完整地展示两个枕头、大部分被子以及床头柜。

# 步骤2: 布局与文字指令
- 布局描述: 这是一个顶部标题、底部功能罗列的经典布局。
- 标题区:
    - 位置: 画面顶部中央。
    - 内容: 主标题"柔软纯棉面料"，下方是副标题"柔软舒适 透气性好且手感细腻"。
- 功能图标区:
    - 位置: 画面底部，水平等距排列。
    - 结构: 四个"图标+文字"的组合。
    - 内容:
        1. (棉花图标) "全棉面料"
        2. (禁止毛球图标) "不易起球"
        3. (手掌触摸图标) "亲肤触感"
        4. (气流图标) "柔软透气"

# 禁止事项
- 禁止添加任何源图像中不存在的物品。
- 禁止包含任何品牌名称或LOGO。`,
    enabled: true,
  },
  {
    key: 'hero_poster_grid',
    emoji: '🪟',
    label: '主图3：产品细节组合图',
    prompt: 'Composite collage of 3 bedding detail close-ups from the provided rendering. Top title "产品细节" / "PRODUCT DETAILS" / "实物的美感远大于照片". 3-column layout: left=tie straps "四角绑带设计", middle=metal zipper "金属拉链", right=pillowcase envelope "同款枕套设计". No brand logos.',
    cnPrompt: `# 角色
你是一位精通产品细节呈现的视觉总监。

# 任务
根据用户提供的"原始铺床效果图"，先生成三张独立的细节特写图，然后根据以下描述的布局将它们组合成一张复合型主图。

# 步骤1: 复合图像生成指令 (生成3个独立的细节图)
- 源图像: [程序传入用户的铺床效果图]
- 细节图1 (四角绑带): 超级特写被套内角，展示固定被芯的白色绑带。
- 细节图2 (金属拉链): 微距拍摄被套的金属拉链，拉链位于纯色面料上。
- 细节图3 (同款枕套): 特写展示带有碎花图案的枕套及其信封式的开口设计。

# 步骤2: 整体排版与文字指令
- 布局描述: 这是一个顶部标题区+下方三栏式图文详情的经典布局。
- 顶部标题区:
    - 位置: 画面顶部中央。
    - 内容: 从上到下依次为大标题"产品细节"，英文副标题"PRODUCT DETAILS"，描述语"实物的美感远大于照片"。
- 底部细节区 (三栏布局):
    - 结构: 水平并列三个带有圆角的图片框，每个图片框下方配有文字说明。
    - 左栏: 放置"四角绑带"图，下方配文："四角绑带设计\\n固定被芯不易移位 安心睡眠"。
    - 中栏: 放置"金属拉链"图，下方配文："金属拉链\\n顺滑易拉 不易划伤手指"。
    - 右栏: 放置"同款枕套"图，下方配文："同款枕套设计\\n信封式设计 严密包裹"。

# 禁止事项
- 禁止包含任何品牌名称或LOGO。`,
    enabled: true,
  },
  {
    key: 'hero_poster_fabric',
    emoji: '🔬',
    label: '主图4：面料质感特写图',
    prompt: 'Macro fabric texture close-up from the provided rendering solid color area. Soft side lighting, minimalist. Center large white text "透气不闷 四季适宜", below smaller "面料平衡透气性与厚度" and "春夏透气，秋冬绵软，四季舒睡". No brand logos, no floral patterns.',
    cnPrompt: `# 角色
你是一位专注于面料质感表现的商业摄影师。

# 任务
根据用户提供的"原始铺床效果图"，抓取其中的纯色面料部分，生成一张质感特写主图，并根据以下描述的布局添加文字信息。

# 步骤1: 图像生成指令
- 源图像: [程序传入用户的铺床效果图]
- 目标面料: 从源图像中识别并抓取被套反面或床单的纯色纯棉面料。
- 构图: 生成一张目标面料的微距特写图，面料呈现自然、柔软的褶皱和悬垂感。
- 光线与风格: 使用柔和的侧光来突出面料的经纬纹理。风格极简、高级，画面中除了面料本身不应有任何其他杂物。

# 步骤2: 布局与文字指令
- 布局描述: 这是一个极简的图文一体化布局，文字直接叠加在充满质感的背景图中央。
- 主文案:
    - 位置: 画面视觉中心。
    - 内容: "透气不闷 四季适宜"。
    - 样式: 使用醒目的白色字体，字号较大。
- 副文案:
    - 位置: 紧随主文案下方。
    - 内容: 两行文字，"面料平衡透气性与厚度"和"春夏透气，秋冬绵软，四季舒睡"。
    - 样式: 使用较小的白色字体。

# 禁止事项
- 禁止包含任何品牌名称或LOGO。
- 生成的图像中只能出现纯色面料，不能出现碎花图案。`,
    enabled: true,
  },
];

// 详情页细节模块 (8张) — 🔑 v2.0重构：去固定化，改为中性命名，AI动态识别填充
export const DETAIL_PAGE_MODULES: MaterialModule[] = [
  {
    key: 'detail_1',
    emoji: '①',
    label: '详情图 1',
    prompt: 'Extreme macro close-up of the fabric texture showing thread count, weave pattern, and surface finish. Fill entire frame with fabric surface. Directional lighting reveals depth. Pattern and color match main product exactly.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
  {
    key: 'detail_2',
    emoji: '②',
    label: '详情图 2',
    prompt: 'Close-up detail shot of the duvet cover zipper area. Show a clean, minimalist style. The zipper is partially open revealing the inner fabric. Focus on the quality of the zipper hardware and the neat stitching.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
  {
    key: 'detail_3',
    emoji: '③',
    label: '详情图 3',
    prompt: 'Close-up of the duvet corner showing the interior tie straps. The duvet cover corner is flipped over and resting on the bed sheet to reveal the ties.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
  {
    key: 'detail_4',
    emoji: '④',
    label: '详情图 4',
    prompt: 'Close-up shot of the bed sheet corner showing a crisp right-angle hospital corner tuck on the mattress.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
  {
    key: 'detail_5',
    emoji: '⑤',
    label: '详情图 5',
    prompt: 'A clean frontal close-up of a single pillowcase laid flat, showing the fabric pattern design clearly.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
  {
    key: 'detail_6',
    emoji: '⑥',
    label: '详情图 6',
    prompt: 'Close-up of the pattern/design printed on the fabric. Show the intricate details of the motif, the color gradients, and the print quality.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
  {
    key: 'detail_7',
    emoji: '⑦',
    label: '详情图 7',
    prompt: 'Medium close-up shot of the bedding set in the EXACT SAME bedroom as the wide-angle scene photo. 45-degree angle, emphasizing the fabric texture and color.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
  {
    key: 'detail_8',
    emoji: '⑧',
    label: '详情图 8',
    prompt: 'Clean flat-lay of all bedding set components arranged separately with clear spacing. Show each piece (duvet cover, bed sheet, pillowcases) laid out neatly.',
    cnPrompt: '（等待AI分析参考图后自动填充，或可手动编辑）',
    enabled: true,
  },
];

// Helper to get fabric-specific prompt for source image based on current store state
export const getFabricSourcePrompt = (fabric: string): string => {
  return FABRIC_SOURCE_IMAGE_PROMPTS[fabric] || FABRIC_SOURCE_IMAGE_PROMPTS['default'];
};

