/**
 * ToonData JSON Schema — 家纺电商营销图的结构化中间态数据定义
 *
 * 设计理念：
 * - 这是整个 Toon 语法驱动架构的核心数据结构
 * - VLM（视觉大模型）分析参考图后输出此 JSON 格式
 * - 前端 UI 可将其渲染为可编辑表单（人机协同 Human-in-the-loop）
 * - toonCompiler 将其确定性地编译为 Toon 纯文本提示词
 * - 最终纯文本发送给 Nano Banana 2 生成图像
 *
 * 数据流：
 * 参考图 → VLM 解构 → ToonData JSON → UI 编辑 → Toon 编译 → Nano Banana 2
 */

// ============================================================
// 摄影与镜头配置
// ============================================================
export interface PhotographyConfig {
  /** 景别：微距细节 / 中景特写 / 全景空间 */
  Shot_Type: string;
  /** 焦段：如 85mm f/1.4 */
  Focal_Length: string;
  /** 视角：俯拍 / 平视 / 仰拍 / 45度斜侧 */
  Camera_Angle: string;
  /** 焦点描述：如"清晰聚焦床品面料质感，背景柔和虚化" */
  Focus: string;
}

// ============================================================
// 光影与氛围配置
// ============================================================
export interface LightingConfig {
  /** 主光源：如"右侧45度窗户自然光" */
  Main_Light: string;
  /** 色温：如"暖调，黄金时刻感，3500K" */
  Color_Temperature: string;
  /** 明暗对比：如"柔和低对比，通透高调" */
  Contrast: string;
}

// ============================================================
// 场景与道具配置
// ============================================================
export interface SceneConfig {
  /** 卧室风格：法式复古 / 极简现代 / 新中式 / 奶油风 等 */
  Bedroom_Style: string;
  /** 周边道具描述 */
  Props: string;
}

// ============================================================
// 床品材质与结构配置（含 A/B 面家纺铁律）
// ============================================================
export interface BeddingMaterialConfig {
  /** 面料类型：如"100%长绒棉，丝滑光泽" */
  Fabric_Type: string;
  /** A面（被套外侧）：印花图案描述或用户上传花型引用 */
  Side_A_Outer: string;
  /** B面（被套内侧/床单）：纯色 + 潘通色号，如"Pantone 14-1209 TCX (Soft Peach)" */
  Side_B_Inner: string;
  /** 材质细节：如"可见高密度织法纹理，自然柔软褶皱" */
  Texture_Detail: string;
}

// ============================================================
// 模特配置
// ============================================================
export interface ModelPresenceConfig {
  /** 模特状态：Active（需要模特）/ None（无模特） */
  Status: 'Active' | 'None';
  /** 模特描述：长相、动作、服装（仅 Status=Active 时有效） */
  Model_Description?: string;
}

// ============================================================
// 排版文字元素（单个文字/图标/标签）
// ============================================================
export interface TypographyElement {
  /** 元素类型：text=文字 / icon_badge=圆形徽章或图标 / tag_row=标签行（多个并排标签） */
  Type: 'text' | 'icon_badge' | 'tag_row';
  /** 文字内容（中文双引号包裹） */
  Content: string;
  /** 字号层级 */
  Size: '[Huge]' | '[Large]' | '[Medium]' | '[Small]';
  /** 字重 */
  Font_Weight: 'Bold' | 'Regular';
  /** 颜色描述（自然语言）：如"深绿色"/"白色"/"灰色" */
  Color: string;
  /** 附加描述（可选）：如"圆形白底深绿色描边徽章，内有棉花图标" */
  Extra?: string;
}

// ============================================================
// 排版区域（画面中的一个独立文字区）
// ============================================================
export interface TypographyZone {
  /** 区域名称标识：如 "Top_Left_Title" / "Bottom_Tag_Row" / "Right_Badge" */
  Zone_Name: string;
  /** 区域位置（自然语言空间描述！禁止CSS！）
   *  正确示例："画面左上角，约占画面宽度40%高度30%的区域"
   *  正确示例："画面底部横幅条，全宽，高度约占画面10%"
   *  错误示例："position: absolute; top: 20%; left: 60%"  ← 禁止！ */
  Zone_Position: string;
  /** 该区域内的所有文字元素（按从上到下、从左到右排列） */
  Elements: TypographyElement[];
}

// ============================================================
// 排版与文字配置（电商核心 — 多区域动态结构）
// ============================================================
export interface TypographyConfig {
  /** 排版区域列表 — 每个区域对应参考图中一个独立的文字区块
   *  电商主图通常包含 3-6 个独立的排版区域 */
  Layout_Zones: TypographyZone[];
}

// ============================================================
// 品牌 Logo 配置
// ============================================================
export interface BrandLogoConfig {
  /** Logo 状态：Keep（保留用户上传的 Logo）/ None（不含 Logo） */
  Status: 'Keep' | 'None';
  /** Logo 渲染指令（仅 Status=Keep 时有效） */
  Instruction?: string;
}

// ============================================================
// 完整的 ToonData 中间态结构 — 单张营销图
// ============================================================
export interface ToonData {
  /** 平台语境风格：如 "Xiaohongshu aesthetic, high emotional value, lifestyle-driven" */
  Platform_Vibe: string;
  /** 摄影与镜头 */
  Photography_And_Camera: PhotographyConfig;
  /** 光影与氛围 */
  Lighting_And_Atmosphere: LightingConfig;
  /** 场景与道具 */
  Scene_And_Styling: SceneConfig;
  /** 床品材质与结构 */
  Bedding_Material_And_Structure: BeddingMaterialConfig;
  /** 模特控制 */
  Model_Presence: ModelPresenceConfig;
  /** 排版与文字 */
  Typography_And_Layout: TypographyConfig;
  /** 品牌 Logo */
  Brand_Logo: BrandLogoConfig;
  /** 质量修饰符 */
  Quality_Modifiers: string;
}

// ============================================================
// AI 分析接口 — VLM 输出的完整响应结构
// ============================================================

/** AI 全局分析主图的响应结构 */
export interface MainImageAnalysisResponse {
  prompts: Array<{
    index: number;
    label: string;
    toonData: ToonData;
  }>;
}

/** AI 全局分析详情图的响应结构 */
export interface DetailImageAnalysisResponse {
  details: Array<{
    index: number;
    identified_content: string;
    toonData: ToonData;
  }>;
}

// ============================================================
// 系统变量占位符常量（融合层使用）
// ============================================================
export const TOON_PLACEHOLDER = {
  /** 用户上传的 A 面花型，由 Agent 动态注入 */
  USER_PATTERN: '{INJECT_USER_PATTERN}',
  /** 前端取色器提取的 B 面潘通色号，由 Agent 动态注入 */
  USER_PANTONE: '{INJECT_USER_PANTONE}',
  /** 用户上传的 Logo */
  USER_LOGO: '{INJECT_USER_LOGO}',
} as const;
