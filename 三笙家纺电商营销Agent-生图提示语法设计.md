> 1、我有一个语法和提示范例的工作，我需要你帮我把它优化改进成一个对以下场景非常契合且示范更规范的一种语法示范。
>
> 2、场景：我需要构建一套基于Agent（智能体）驱动的专业家纺电商营销全链路平
> **用户旅程**：用户只需提供“一个想法”、“一张草图/家纺印花图案/家纺床品摄影图”或只是“一个竞品电商链接”，Agent即可全自动完成竞品调研、卖点提炼、高级提示词生成（Toon语法）。
>
> - 那么这套系统要基于参考图和URL中的电商图、详情图推理出如何使用Nano Banana 2来快速复现一套更专业且不侵权的新的一整套甲方电商营销图（头图+详情图）
>- 所以我们现在设计的这个示范与语法，要非常非常的贴合这个场景，当用户上传了图像之后，不管它是什么图，或者URL上来抓取了整套的电商图之后，用户的目标是用生图模型复现它，那么我们应该要求这个语法设计时完全的从电商营销角度考虑包括但不限于以下内容：
> 
>色彩分析-家纺行业材质与潘通色彩库（中、英双语）、文字的排版、字号、字体、大小（如：主标题、副标题、小标题等）、位置、拍摄手法与镜头角度：景别（微距细节/全景空间/中景特写）、焦段（如85mm大光圈）、视角（俯拍/平视/仰拍）。
> 光影与氛围：主光源方向（如右侧45度窗户自然光/影棚柔光箱）、色温（暖调/清冷）、明暗对比（高调/低调）。
>场景与卧室风格：原木风/极简现代/法式复古/奶油风；周边的道具（如：床头柜的干花、木质婴儿床、地毯材质）。
> 排版与文本解析（关键）、
> 字号与层级：明确拆解出“主标题”（如：给宝宝A级呵护）、“副标题”、“卖点标签”。
> 位置：例如“主标题位于左上角，占据画面约20%宽度，使用无衬线粗体”。
> 家纺特殊属性解析（A/B面）：（但这里要考虑如果用户上传了自己的，生图的时候就要严格参考用户的，如果用户实在没有上传才考虑结构目标竞品的图像）
> >   *A面（被套外侧）：详细描述印花（如：大面积水彩玫瑰花卉图案，粉绿色系）。
> >   * B面（被套内侧/床单）：识别其纯色色值（为了避免大模型识别幻觉，最好让前端用个JS啥的算法稳定的识别，还节省Tokens），并必须映射到“潘通色库”。
> 
> - 还要考虑在构建提示词工程的时候，应该是分析完目标URL中商品的全部信息之后（还要考虑未获取到时的兜底情况）允许用户改成自己家的产品的信息，所以这里应该有大量需要用户补充或可以修改的交互，这包括是否要上传自家品牌logo、修改某张详情图的文案、头图和详情图的摄影级照片所在的卧室风格（欧式、日式、中式、中国婚庆、极简风）镜头角度推荐与选项、打光/光影推荐与选项、字体推荐与选项、卖点推荐与选项、是否有1~2张真人模特与床品的照片（模特的长像描述或问用户是否要上传一张自己家的模特照片上来，Agent还要提供推荐与选项）、是否有再生成一套全英文版的诉求，如果针对小红书/淘宝会不会对生成的电商套图会有什么不同？
> 
>————以下为早前设计的语法，需要你综合以上修改建议后，改进输出到代码块中给我————
> ```
>> ### Nano Banana 2 防污染提示词生成引擎（极简 Toon 语法）
> > **血泪教训规避**：绝对禁止使用 Markdown（`**`，`##`），绝对禁止写死 `no text`，文本必须用中文引号 `“”` 包裹。
>>
> > **Agent 生成的最终发给 Nano Banana 2 的提示词模板示例：**
>> ```text
> > Subject: Premium Home Textile Bedding Set
> > Style: Studio Commercial Photography
> > Scene: Minimalist creamy style bedroom, warm sunlight from right window
>> Lighting: Softbox, cinematic lighting, 85mm f/1.8
> > Bedding_Structure:
> >   Side_A: Watercolor rose floral pattern, elegant
> >   Side_B: Solid Color, Pantone 12-0910 TCX
> >   Texture: High density cotton, visible fabric weaving details
>> Typography_And_Layout:
> >   Text_Main: “高密度锁绒不掉絮”
>>   Text_Main_Style: Clean Sans-serif, top center alignment, elegant
> >   Text_Sub: “A类级抗菌”
>>   Text_Sub_Style: Medium size, left bottom, near the pillow
> > Brand_Logo:
>>   Status: Keep
> >   Instruction: Render user provided logo unobtrusively at the bottom right corner of the quilt cover
> > Quality: Masterpiece, ultra-detailed, photorealistic
> > ```
> > *（此格式完全摒弃了废话和干扰符号，层级清晰，Nano Banana 2 能够极好地理解层级并精确渲染带中文引号的文字，同时明确了A/B面的家纺铁律。）*
> 
> 完整的TOON语法项目：
> https://github.com/toon-format/toon
> ```



------

为了完美契合你所描述的“家纺电商全链路智能营销”场景，我们需要将原本单一的提示词框架，升级为**“Agent工作流（SOP）+ 动态交互策略 + 高级Toon语法引擎”**的综合架构。

考虑到你提到的：前端JS取色、竞品URL解析、兜底策略、多平台（小红书/淘宝）差异化、真人模特、以及A/B面家纺特性的严格区分，我将这套方案拆解为**“Agent交互逻辑设计”**与**“最终生成的Toon语法范例”**两部分。

---

### 一、 Agent 交互与逻辑预处理架构（系统核心）

在生成最终的 Toon 语法之前，Agent 需要完成以下结构化的预处理和用户交互：

1.  **解析与前端协同（防幻觉策略）**：
    *   **B面取色**：Agent 指示前端调用 JS 取色器提取目标图/上传图的 B 面纯色 Hex 值，并通过本地/云端映射表直接转为 `Pantone TCX` 色号（家纺专用），将准确的英文色号直接喂给大模型，彻底杜绝大模型的色彩幻觉。
    *   **信息提取兜底**：如果 URL 解析失败，Agent 立即启用兜底表单：“*未能完全抓取商品信息，已为您自动填充行业爆款标准参数，您可以随时修改以下内容：主标题、材质、卖点...*”
2.  **动态推荐与交互（多项选择式）**：
    *   **平台适配分流**：
        *   *小红书* ➡️ 触发“高情绪价值/氛围感/生活方式”预设（偏重柔光、日常道具、非侵入式排版）。
        *   *淘宝/天猫* ➡️ 触发“高转化/卖点直击/痛点放大”预设（偏重清晰度、高对比度、大字号醒目排版）。
    *   **风格与参数推荐**：Agent 提供如【法式复古 (85mm特写/暖自然光)】或【极简现代 (35mm全景/冷调影棚光)】的打包选项，而非让用户懂摄影参数。
    *   **模特与 Logo**：询问“是否需要加入亚裔居家模特？”“是否上传品牌 Logo？（上传则启用 Keep 逻辑）”。
    *   **语言双发**：询问“是否需要同步生成一套全英文出海版（Amazon/独立站）营销图？”

---

### 二、 优化后的 Nano Banana 2 提示词引擎（高级 Toon 语法）

结合你的所有需求，以下是 Agent 收集完所有参数后，最终组装发给生图模型的**极限规范 Toon 语法**。

**⚠️ 严格遵循 Toon 规则：**绝对无 Markdown (`**`, `##`)，绝对无冗余废话，层级严格对齐，所有生成文本必须用 `“”` 包裹！

```text
Subject: Premium E-commerce Home Textile Marketing Photography
Platform_Vibe: Xiaohongshu aesthetic, high emotional value, lifestyle-driven, immersive atmosphere
Photography_And_Camera:
  Shot_Type: Medium close-up
  Focal_Length: 85mm f/1.4 large aperture
  Camera_Angle: High angle shot, looking down at the bed 45 degrees
  Focus: Crisp focus on the bedding fabric texture, softly blurred background
Lighting_And_Atmosphere:
  Main_Light: Right side 45 degree window natural warm sunlight
  Color_Temperature: Warm tone, golden hour feeling, 3500K
  Contrast: Soft low contrast, airy and high-key mood
Scene_And_Styling:
  Bedroom_Style: French Vintage romantic bedroom
  Props: Wooden vintage bedside table, dried eucalyptus in a glass vase, fluffy wool rug on the floor
Bedding_Material_And_Structure:
  Fabric_Type: 100% Long-staple cotton, premium silk-like gloss
  Side_A_Outer: Render strict adherence to user uploaded floral pattern, watercolor pink and green tone, elegant layout
  Side_B_Inner: Solid Color, strictly Pantone 14-1209 TCX (Soft Peach)
  Texture_Detail: Visible dense weaving details, soft natural wrinkles showing extreme comfort
Model_Presence:
  Status: Active
  Model_Description: Young Asian female, gentle smile, closed eyes resting on the pillow, wearing white silk pajamas
Typography_And_Layout:
  Text_Main: “给宝宝A类级呵护”
  Text_Main_Style: Clean elegant Sans-serif bold, occupies 20% width, top left alignment
  Text_Sub: “100%新疆长绒棉 · 裸睡首选”
  Text_Sub_Style: Medium size Serif font, directly below main text, slight transparency
  Selling_Point_Tag: “抗菌防螨”
  Selling_Point_Style: Minimalist badge style, bottom right corner, unobtrusive
Brand_Logo:
  Status: Keep user uploaded logo
  Instruction: Render flawlessly at the bottom left corner of the scene, watermarked style
Quality_Modifiers: Masterpiece, ultra-detailed, photorealistic, 8k resolution, commercial catalog standard
```

---

### 三、 这套优化的语法如何解决你的痛点？

1.  **新增 `Platform_Vibe` (平台语境) 层级**：
    这是电商营销的灵魂。通过直接告诉模型这是“小红书审美”还是“亚马逊风格”，模型会自动调整底层的画面质感和受众偏好（比如小红书偏向生活感，淘宝偏向棚拍商品感）。
2.  **精细化 `Photography_And_Camera` 与 `Lighting`**：
    将原本杂糅的 Scene 拆解为极其专业的摄影指令。明确了**焦段 (85mm)**、**视角 (俯拍45度)**、**景别 (中特写)** 和 **色温 (3500K)**。这让懂摄影的用户可以微调，不懂的用户直接使用 Agent 的推荐包。
3.  **强化 `Bedding_Material_And_Structure` (家纺行业铁律)**：
    *   明确区分 `Side_A_Outer` (被套外侧/主视图) 和 `Side_B_Inner` (被套内侧/床单)。
    *   **潘通色号的直接应用**：`Pantone 14-1209 TCX (Soft Peach)`。加上具体的色系英文描述（Soft Peach），能进一步锚定模型的色彩空间，配合前端 JS 取色，达到 100% 还原。
    *   加入了 `Texture_Detail` (材质细节)，强制模型渲染“高密度织法”和“自然褶皱”，这是家纺图看起来“高级”的关键。
4.  **高度结构化的 `Typography_And_Layout` (排版解析)**：
    不仅有主副标题，还加入了电商特有的 `Selling_Point_Tag`（卖点标签）。并且对每一个文本的**占地比 (20% width)**、**字体类型 (Sans-serif/Serif)**、**位置**做了极度精确的 Toon 键值对约束。
5.  **新增 `Model_Presence` (模特控制)**：
    通过 `Status: Active/None` 来开启或关闭模特。当开启时，提供精准的长相、动作和服装描述，避免生成抢夺床品焦点的突兀人物。

**💡 Agent 开发小建议：**
在系统后台，你可以把这个 Toon 模板写成一个 JSON 或 Python 字典，Agent 通过大模型分析出变量后，直接通过字符串替换（String Interpolation）来生成最终的 Text 文本发送给 Nano Banana 2。这样可以 100% 保证输出格式不走样，绝不会出现大模型自作主张加 Markdown 的情况。

------

User：

这里有一个问题，当使用AI Coding工具要求设计这个工程的时候，
我们需要传达一个需求，它是一套自动化的流程去根据输入的图像根据我们提供的语法模板，去逐一分析结构出每一张待复现为（不侵权、不包含原始品牌名和Logo）的一批提示词。
再下一步是API调用Nano Banana 2 去批量把这些图生成出来。

那么这就要求这套工程要有智能化一些，因为每张参考图在分析解构的时候应该注意分析得到的提示词应该与参考图密切相关，参考图中有的文案和参考图中的主体内容、颜色、花型等都应该得到充分的分析，而不是完全没有体现出来，或者分析得出之后又完全忽略了用户在上一步上传的自己的花型图/参考图/照片中的花型、配色等信息。

而且这里还要考虑到用户对提取分析之后的卖点、文案等修改应该如何在Agent系统中得到支持。

------



为了让 AI Coding 工具（如 Cursor、Cline、Windsurf 等）能够准确理解并构建这套复杂的、带有“人机协同（Human-in-the-loop）”且逻辑严密的自动化工作流，我们需要**改变直接生成最终提示词的思路**，转而采用**“JSON中间态驱动”**的架构设计。

你需要向 AI Coding 工具传达的核心思想是：**“解耦（Decoupling）与融合（Fusion）”**，以及**“UI 状态拦截”**。

以下我为你整理的**【喂给 AI Coding 工具的工程需求设计文档】**。你可以直接将以下内容复制给你的 AI 开发助手：

***

### 📋 复制以下内容发送给你的 AI Coding 工具：

```markdown
# 项目目标：基于 Agent 和 Nano Banana 2 的家纺电商自动化生图工作流系统

我们需要开发一套智能化的电商图流转系统。用户输入一套竞品参考图（或 URL 解析出的图组），并上传自己家的产品（如 A面花型图、B面潘通色值、自家 Logo）。系统需自动解构参考图的“排版/打光/场景”，并将用户“自己的产品特征”无缝融合，最终生成符合 `Toon` 语法的提示词，批量调用 Nano Banana 2 API 生成不侵权的新营销图。

## 核心痛点与系统设计要求

### 1. 核心逻辑：视觉解构与特征剥离融合（解决“参考图与自家花型冲突”问题）
绝对不能让大模型直接看着参考图写提示词，否则会照抄竞品的花型和 Logo！系统必须遵循以下提取与融合逻辑：
*   **提取层（视觉大模型 VLM 工作）：** 只分析参考图的 `Platform_Vibe`（平台氛围）、`Photography_And_Camera`（摄影机位）、`Lighting_And_Atmosphere`（光影）、`Scene_And_Styling`（场景与道具）、以及 `Typography_And_Layout`（文本排版的位置和字号）。
*   **剥离层（防侵权指令）：** 强制 VLM 识别并**丢弃**原图中的品牌名、Logo、原商品特有的花型图案。将原图中的卖点文案进行“降维泛化”（如把“罗莱家纺”替换为空，把竞品独家卖点改写为通用结构）。
*   **融合层（Agent 动态注入）：** Agent 必须将用户在第一步上传的全局资产（自家 A 面花型图像引用/描述、B 面提取的准确潘通色号、自家 Logo 规则）**强制覆盖**到提取出的数据结构中。

### 2. 核心架构：JSON 中间态与人机交互拦截（解决“如何支持用户修改”问题）
严禁 Agent 直接把分析结果转成 `Toon` 文本字符串去调生图 API！必须设计一个“拦截与编辑”环节：
*   **Step A (分析转 JSON)：** VLM 的输出结果必须严格是一个结构化的 JSON 对象，其 Key 完全对应 `Toon` 语法的层级结构。
*   **Step B (前端 UI 渲染与拦截 - 关键！)：** 后端将这批包含“融合后数据”的 JSON 列表发送给前端。前端将其渲染为一组**“可视化卡片式表单”**。
    *   用户可以在前端直接修改每张图的 JSON 字段：比如修改提取出的主标题文案、更换场景风格选项（下拉菜单：极简风/法式）、切换模特状态、调整卖点标签。
*   **Step C (Toon 语法编译)：** 用户点击“确认并批量生成”后，前端将修改后的 JSON 数组发回后端。后端的一个 **Compiler（编译器）** 函数，将 JSON 严格按照 `Toon` 极简语法的键值对格式转化为纯文本。
*   **Step D (API 调度)：** 将编译好的纯文本推入并发队列，调用 Nano Banana 2 API。

---

## 🛠 给 AI 助手的具体开发任务（Task List）：

**Task 1: 定义 JSON Schema (数据结构)**
请基于以下结构定义 TypeScript Interface 或 Pydantic Model，这是前后端交互的中间态数据：
```json
{
  "image_id": "001",
  "original_ref_image": "url_to_competitor_image",
  "Toon_Data": {
    "Platform_Vibe": "Xiaohongshu aesthetic...",
    "Photography_And_Camera": { ... },
    "Lighting_And_Atmosphere": { ... },
    "Scene_And_Styling": { ... },
    "Bedding_Material_And_Structure": {
       "Side_A_Outer": "{INJECT_USER_PATTERN_PROMPT}", 
       "Side_B_Inner": "{INJECT_USER_PANTONE}",
       "Texture_Detail": "..."
    },
    "Typography_And_Layout": {
       "Text_Main": "提取并改写后的主标题",
       "Text_Main_Style": "位置与字号描述",
       "Selling_Point_Tag": "提取并改写后的卖点"
    }
  }
}
```

**Task 2: 编写 Vision Prompt (视觉提取提示词)**
Antigravity需要先设计并编写用于 Gemini 3.1 的 System Prompt。要求它：

1. 扮演资深家纺电商视觉总监。
2. 严格输出上述 JSON 格式。
3. 必须包含防侵权指令：“忽略所有商标、品牌名；提取文案时仅保留行业通用结构，并去除原品牌特征；不要描述原图的床品印花，留空或使用系统变量占位符。”

**Task 3: 编写 JSON to Toon Compiler (编译器)**
编写一个工具函数（Python/TS），将上述 JSON 结构无缝转换为严格的 `Toon` 文本语法。
**要求**：如果 JSON 中的值为空，则忽略该行；保持缩进；文本内容（如文案）必须自动包裹中文双引号 `“”`；绝对不包含 Markdown 符号。

**Task 4: 设计前端交互组件逻辑 (React/Vue)**
描述或实现一个前端组件：它接收上面的 JSON 数组，渲染出左侧是“原参考图”，右侧是“表单编辑器（允许修改 Typography_And_Layout 和 Scene_And_Styling 下的值）”的界面，并包含一个“应用我的全局产品参数（A面图/B面色）”的按钮。

请一步步完成以上设计与代码实现。
```

***

### 💡 为什么这种提示词设计能解决你的问题？

1. **引入了 `JSON` 作为“缓冲带”**：
   过去的生图工作流通常是 `VLM 看图 -> 直接输出 Prompt -> 丢给生图API`。在这个黑盒里，用户无法插手，参考图的花型也会污染结果。
   改成 `VLM 看图 -> 生成 JSON -> UI 表单供用户修改 -> 编译为 Toon 语法 -> 丢给生图API`，就完美实现了“允许用户大量修改交互（如修改文案、风格、模特）”的需求。

2. **明确了“特征剥离”指令**：
   系统提示词中专门要求 AI **“只偷版式和光影，不偷花色和 Logo”**，并在融合层（Fusion）强制把用户传入的花型和取色器取到的 B面潘通色号（`Pantone TCX`）硬编码替换进去，确保生出来的必定是自家的货。

3. **Compiler（编译器）思想**：
   大模型直接输出 `Toon` 语法容易带上 `**` 或不稳定的符号。通过自己手写一个轻量级的 JSON 转 Toon 文本的函数，你可以获得 **100% 的格式稳定性**，不给大模型任何发挥格式幻觉的机会。