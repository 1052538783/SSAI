/**
 * 面料词典 (英文描述，用于 Prompt 构建)
 * 和风格词典 (英文描述，用于 Prompt 构建)
 * + 中文描述版本（用于 Prompt 面板预览展示）
 */

// ============================================================
// 面料类型映射 — 中文名 → 英文 Prompt 关键词
// ============================================================
export const FABRIC_DICT: Record<string, string> = {
  '纯棉': 'high-quality pure cotton sateen, smooth, breathable, soft to the touch, with a subtle sheen',
  '水洗棉': 'pre-washed cotton, relaxed texture, lived-in softness, slightly wrinkled natural drape',
  '天丝': 'Tencel/Lyocell fiber, silky smooth, cool touch, subtle lustre, exceptional drape',
  '牛奶绒': 'milk velvet fleece, ultra-plush, cozy and warm, dense pile with a velvety finish',
  '法兰绒': 'brushed flannel, soft napped surface, warm and cozy, slightly fluffy texture',
  '真丝': 'natural mulberry silk, luxurious sheen, lightweight, smooth and cool',
  '磨毛': 'brushed/sanded cotton, peach-skin texture, warm and soft, matte finish',
  '亚麻': 'natural linen, textured weave, breathable, casual elegance with natural slubs',
  '竹纤维': 'bamboo fiber blend, silky soft, naturally antibacterial, moisture-wicking',
  '涤纶': 'premium polyester microfiber, wrinkle-resistant, smooth, easy-care',
};

// ============================================================
// 面料营销与副标题词典 (用于组装营销主图文字提示)
// ============================================================
export const FABRIC_MARKETING_DICT: Record<string, string> = {
  '纯棉': '甄选优质精梳棉 | 触感细腻柔软，舒适保暖，吸湿透气',
  '水洗棉': '会呼吸的水洗棉 | 亲肤透气，自然微皱肌理，裸睡新体验',
  '天丝': '奥地利兰精天丝 | 冰丝触感，丝滑垂坠，夏日清凉好眠',
  '牛奶绒': '高克重保暖牛奶绒 | 聚热升温，细腻绒毛包裹，冬日暖被窝',
  '法兰绒': '丰盈保暖法兰绒 | 软糯贴身，加厚抗寒，锁住一夜暖意',
  '真丝': '6A级桑蚕丝 | 奢华缎面，富含氨基酸，睡出美容觉',
  '磨毛': '锁温保暖磨毛面料 | 蜜桃绒感，亲肤不冰冷，秋冬必入',
  '亚麻': '法国雨露麻 | 吸湿排汗，天然抗菌，打造原生侘寂感',
  '竹纤维': '生态环保竹纤维 | 丝滑除螨，轻盈贴身，呵护敏感肌',
  '涤纶': '科技抗皱面料 | 顺滑免熨烫，耐洗耐磨，高性价比之选',
};

// ============================================================
// 面料专属溯源图 Prompt 字典 (用于详情页 - 面料源头展示)
// ============================================================
export const FABRIC_SOURCE_IMAGE_PROMPTS: Record<string, string> = {
  '纯棉': 'Macro photography of pure white, fluffy natural cotton bolls on a branch against a clean background, soft lighting, organic, pure, premium quality. Marketing layout style.',
  '水洗棉': 'Macro shot of raw cotton fibers and a gentle folded textile showing natural wrinkles, soft aesthetic, gentle morning light, emphasizing natural wash and breathability.',
  '天丝': 'Elegant macro shot of smooth eucalyptus leaves and flowing natural fibers, cool color palette, symbolizing Tencel source, smooth and silky imagery, fresh and breathable.',
  '牛奶绒': 'Abstract macro photography showing a warm, dense, and fluffy velvety texture, soft focus, creamy warm lighting, conveying ultimate coziness and heat retention.',
  '真丝': 'Luxurious macro shot of a silk cocoon and shimmering silk threads, elegant lighting, premium feel, conveying smoothness and high-end natural protein fibers.',
  '亚麻': 'Artistic macro shot of natural flax plants and raw linen fibers, earthy tones, organic texture, emphasizing breathability and natural origins.',
  '竹纤维': 'Fresh macro photography of green bamboo leaves and silky white fibers, bright, clean, emphasizing antibacterial and natural cooling properties.',
  // 对于其他材质(涤纶等科技面料)，可以用科技感的丝滑肌理图
  'default': 'Abstract macro shot of smooth, flowing fabric threads, clean and sleek, conveying modern textile technology and easy-care properties.',
};

// ============================================================
// 风格词典 — 风格名 → 英文场景 Prompt 描述
// ============================================================
export const STYLE_DICT: Record<string, string> = {
  '极简高级风': 'Minimalist luxury setting: clean lines, neutral tones, monochrome palette, matte surfaces, high-end marble or concrete accent, gallery-like atmosphere, editorial lighting',
  '治愈奶油风': 'Cozy cream-toned bedroom: warm soft lighting, fresh flowers on nightstand, knitted throw blanket, wooden furniture, warm beige/ivory palette, inviting and healing atmosphere',
  '新中式轻奢': 'New Chinese luxury: rosewood furniture accents, gold metallic trim, silk decorative elements, subtle oriental motifs, warm amber lighting, elegant and refined',
  '法式浪漫风': 'French romantic bedroom: ornate headboard, soft pastel colors, sheer curtains with golden light, vintage-style mirror, fresh roses, dreamy and feminine',
  '清新透气风': 'Minimalist Korean style bedroom, bright morning natural sunlight streaming through sheer white curtains. High-key lighting, airy, crisp, and fresh atmosphere. Pure white walls, light blonde wood floor. A simple white modern bedside table. The bedding looks clean, breathable, and refreshing. Photorealistic, 8k resolution, soft and clean shadows.',
  '婚庆喜庆风': 'Wedding/celebratory setting: rich red and gold palette, festive atmosphere, silk accents, lantern-style lighting, luxurious and auspicious ambiance',
  '痛点直击风': 'Product-focused lifestyle shot: split comparison, before/after feel, emphasizing fabric softness and comfort against bare skin, warm golden-hour lighting',
  '社交种草风': 'Instagram-worthy bedroom: trendy decor, playful accents, aesthetic morning scene with coffee, lifestyle-oriented, youthful and aspirational',
  '权威背书风': 'Premium brand showcase: close-up texture details, certifications visible, lab-coat white backdrop element, scientific and trustworthy feel, macro photography quality',
  '节日礼盒风': 'Gift box presentation: elegant packaging, ribbon and bow, festive decorations, warm bokeh lights, unboxing experience, luxury gift-giving moment',
};

/** 所有风格的 key 列表 */
export const STYLE_KEYS = Object.keys(STYLE_DICT);

/** 所有面料的 key 列表 */
export const FABRIC_KEYS = Object.keys(FABRIC_DICT);

// ============================================================
// 中文描述版本（用于 Prompt 面板预览展示）
// ============================================================
export const FABRIC_DICT_CN: Record<string, string> = {
  '纯棉': '高品质纯棉贡缎，触感柔滑透气，微光泽感',
  '水洗棉': '水洗棉，自然褒皱肌理，柔软亲肤',
  '天丝': '天丝纤维，丝滑凉爽，娘媈光泽，垂感极佳',
  '牛奶绒': '牛奶绒，绒面细腻亲肤，保暖舒适',
  '法兰绒': '法兰绒，磨毛柔软，暖和舒适',
  '真丝': '天然桑蚕丝，奢华光泽，轻盈亲肤',
  '磨毛': '磨毛面料，桃皮绒质感，保暖柔软',
  '亚麻': '天然亚麻，纹理感强，透气自然',
  '竹纤维': '竹纤维混纺，丝滑亲肤，吸湿透气',
  '涤纶': '高端涤纶微纤维，抗皱顺滑，易打理',
};

export const STYLE_DICT_CN: Record<string, string> = {
  '极简高级风': '极简奢华卧室：简洁线条，中性色调，大理石或混凝土点缀，编辑级打光',
  '治愈奶油风': '温馨奶油色卧室：柔和光线，鲜花装饰，针织披毯，木质家具，温暖治愈',
  '新中式轻奢': '新中式轻奢：红木家具点缀，金属装饰，丝绸元素，暖琥珀光线',
  '法式浪漫风': '法式浪漫卧室：精美床头，柔和粉彩，薄纱窗帘，复古镜框，玄美梦幻',
  '清新透气风': '清新透气风：明亮自然光，极简白墙，清爽透气感（适合碎花/浅色系）',
  '婚庆喜庆风': '婚庆喜庆场景：中国红配金，节日氛围，丝绸点缀，灯笼光线',
  '痛点直击风': '产品力生活场景：前后对比，强调面料柔软亲肤，温暖光线',
  '社交种草风': '社交媒体风卧室：时尚装饰，早晨品咖场景，生活方式感，年轻潮流',
  '权威背书风': '品牌展示：微距质感特写，认证标志，科学可信感，微距摄影',
  '节日礼盒风': '礼盒展示：精美包装，丝带的结，节日装饰，温暖散景，开箱体验',
};

// ============================================================
// 潘通色库快速映射 — 家纺常用 B 面/床单纯色色号
// 由前端 JS 取色器提取 HEX 后，映射为潘通 TCX 色号（防止大模型色彩幻觉）
// ============================================================
export const PANTONE_QUICK_MAP: Record<string, string> = {
  // 白色系
  '#FFFFFF': 'Pantone 11-0601 TCX (Bright White)',
  '#F5F5F0': 'Pantone 11-0602 TCX (Snow White)',
  '#FAF0E6': 'Pantone 11-0107 TCX (Papyrus)',
  '#FFFDD0': 'Pantone 11-0617 TCX (Transparent Yellow)',
  // 米色/奶油系
  '#F5E6D3': 'Pantone 12-0910 TCX (Vanilla Custard)',
  '#F0E4D7': 'Pantone 12-0812 TCX (Tender Peach)',
  '#E8D5C4': 'Pantone 14-1209 TCX (Soft Peach)',
  '#D4C4B0': 'Pantone 15-1305 TCX (Doeskin)',
  '#C4B5A2': 'Pantone 16-1212 TCX (Nomad)',
  // 灰色系
  '#D3D3D3': 'Pantone 14-4102 TCX (Glacier Gray)',
  '#B0B0B0': 'Pantone 15-4101 TCX (High-rise)',
  '#808080': 'Pantone 17-0000 TCX (Frost Gray)',
  '#696969': 'Pantone 18-0601 TCX (Charcoal Gray)',
  // 粉色系
  '#FFD1DC': 'Pantone 13-2010 TCX (Crystal Rose)',
  '#F4C2C2': 'Pantone 14-1714 TCX (Powder Pink)',
  '#E8B4B8': 'Pantone 15-1614 TCX (Bridal Rose)',
  '#D4A0A7': 'Pantone 16-1610 TCX (Foxglove)',
  // 蓝色系
  '#D6E4F0': 'Pantone 13-4103 TCX (Illusion Blue)',
  '#B0C4DE': 'Pantone 14-4110 TCX (Cashmere Blue)',
  '#A7C7E7': 'Pantone 14-4214 TCX (Powder Blue)',
  '#87CEEB': 'Pantone 14-4318 TCX (Sky Blue)',
  // 绿色系
  '#90EE90': 'Pantone 13-0117 TCX (Green Ash)',
  '#8FBC8F': 'Pantone 15-6114 TCX (Hemlock)',
  '#C1E1C1': 'Pantone 13-0116 TCX (Pastel Green)',
  // 黄色系
  '#FFEFD5': 'Pantone 12-0715 TCX (Double Cream)',
  '#FFE4B5': 'Pantone 13-0916 TCX (Chamomile)',
  // 紫色/薰衣草系
  '#E6E6FA': 'Pantone 13-3903 TCX (Lavender Fog)',
  '#D8BFD8': 'Pantone 14-3805 TCX (Orchid Bloom)',
  // 棕色/咖色系
  '#D2B48C': 'Pantone 16-1334 TCX (Tan)',
  '#C19A6B': 'Pantone 17-1128 TCX (Café au Lait)',
  // 红色/酒红系（婚庆）
  '#DC143C': 'Pantone 19-1762 TCX (Jester Red)',
  '#8B0000': 'Pantone 19-1536 TCX (Sun-Dried Tomato)',
  '#B22222': 'Pantone 19-1555 TCX (Crimson)',
};

/**
 * 将 HEX 色值映射到最接近的潘通色号
 * 先精确匹配，匹配不到则找色差最小的
 */
export function hexToPantone(hex: string): string {
  const normalizedHex = hex.toUpperCase().replace(/\s/g, '');

  // 精确匹配
  if (PANTONE_QUICK_MAP[normalizedHex]) {
    return PANTONE_QUICK_MAP[normalizedHex];
  }

  // 色差最近匹配（简易 RGB 欧氏距离）
  const hexToRgb = (h: string) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return { r, g, b };
  };

  const targetRgb = hexToRgb(normalizedHex);
  let closestKey = Object.keys(PANTONE_QUICK_MAP)[0];
  let minDist = Infinity;

  for (const key of Object.keys(PANTONE_QUICK_MAP)) {
    const rgb = hexToRgb(key);
    const dist = Math.sqrt(
      Math.pow(targetRgb.r - rgb.r, 2) +
      Math.pow(targetRgb.g - rgb.g, 2) +
      Math.pow(targetRgb.b - rgb.b, 2),
    );
    if (dist < minDist) {
      minDist = dist;
      closestKey = key;
    }
  }

  return PANTONE_QUICK_MAP[closestKey];
}
