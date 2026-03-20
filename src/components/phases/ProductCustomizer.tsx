/**
 * ProductCustomizer — 产品信息自定义面板
 *
 * 从AI分析结果中自动提取卖点/字体/模特信息，
 * 用户可编辑这些信息并反映到最终的Prompt中。
 *
 * 🔑 核心字段：
 * - 卖点文案（AI提取 + 用户编辑）
 * - 字体推荐（AI识别 + 用户选择）
 * - 模特照片/描述（AI检测 + 用户上传）
 * - 品牌Logo上传
 * - 目标平台选择
 * - 卧室风格
 * - 打光/镜头角度
 */

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import type { ProductCustomization } from '../../types/state';

// 预设选项
const PLATFORM_OPTIONS = ['小红书', '淘宝', '天猫', '京东', '拼多多', '抖音'];
const BEDROOM_STYLE_OPTIONS = [
  { label: '现代极简', value: '现代极简' },
  { label: '日式和风', value: '日式和风' },
  { label: '北欧风', value: '北欧风' },
  { label: '新中式', value: '新中式' },
  { label: '中国婚庆', value: '中国婚庆' },
  { label: '法式浪漫', value: '法式浪漫' },
  { label: '美式乡村', value: '美式乡村' },
  { label: '轻奢', value: '轻奢' },
];
const FONT_OPTIONS = [
  { label: '无衬线黑体', value: '无衬线黑体(Source Han Sans)' },
  { label: '宋体衬线', value: '宋体衬线(Noto Serif SC)' },
  { label: '圆体', value: '圆体(HYRuiYuanW)' },
  { label: '手写体', value: '手写体(ZCOOL XiaoWei)' },
  { label: '书法体', value: '书法体(ZCOOL QingKe HuangYou)' },
];
const LIGHTING_OPTIONS = ['自然柔光', '暖色调明亮', '冷色调高级', '戏剧性明暗对比', '日落暖调'];
const CAMERA_ANGLE_OPTIONS = ['俯拍45°', '正俯拍90°', '平拍', '低角度仰拍', '特写微距'];

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ProductCustomizer({ showToast }: Props) {
  const { productCustomization, setProductCustomization } = useAppStore();
  const [newSellingPoint, setNewSellingPoint] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const modelPhotoInputRef = useRef<HTMLInputElement>(null);

  // 更新单个字段
  const updateField = useCallback(<K extends keyof ProductCustomization>(
    key: K, value: ProductCustomization[K]
  ) => {
    setProductCustomization({ [key]: value } as Partial<ProductCustomization>);
  }, [setProductCustomization]);

  // 添加卖点
  const addSellingPoint = () => {
    if (!newSellingPoint.trim()) return;
    const points = [...(productCustomization.sellingPoints || []), newSellingPoint.trim()];
    updateField('sellingPoints', points);
    setNewSellingPoint('');
  };

  // 删除卖点
  const removeSellingPoint = (idx: number) => {
    const points = [...(productCustomization.sellingPoints || [])];
    points.splice(idx, 1);
    updateField('sellingPoints', points);
  };

  // Logo上传
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      updateField('brandLogoBase64', base64);
      showToast('品牌Logo已上传', 'success');
    };
    reader.readAsDataURL(file);
  };

  // 模特照片上传
  const handleModelPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      updateField('modelPhotoBase64', base64);
      showToast('模特照片已上传', 'success');
    };
    reader.readAsDataURL(file);
  };

  const hasAIData = (productCustomization.sellingPoints?.length || 0) > 0
    || productCustomization.fontPreference
    || productCustomization.modelDescription;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <span className="text-xl">🎨</span>
        <div>
          <h3 className="text-white font-semibold text-sm">产品自定义面板</h3>
          <p className="text-gray-400 text-xs mt-0.5">
            {hasAIData ? '✨ AI已自动识别并填充，你可以修改' : '配置产品信息以优化生图效果'}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* ===== 卖点文案 ===== */}
        <section>
          <label className="text-gray-300 text-xs font-medium flex items-center gap-1.5 mb-2">
            🏷️ 卖点文案
            {(productCustomization.sellingPoints?.length || 0) > 0 && (
              <span className="text-emerald-400 text-[10px] bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
                AI已识别 {productCustomization.sellingPoints.length} 个
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(productCustomization.sellingPoints || []).map((point, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-1 rounded-full border border-indigo-500/30 hover:border-indigo-400/50 transition-colors">
                {point}
                <button
                  onClick={() => removeSellingPoint(idx)}
                  className="ml-0.5 hover:text-red-400 transition-colors"
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSellingPoint}
              onChange={e => setNewSellingPoint(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSellingPoint()}
              placeholder="添加自定义卖点..."
              className="flex-1 bg-white/5 border border-white/10 text-white text-xs px-3 py-2 rounded-lg focus:border-indigo-500 focus:outline-none placeholder-gray-500"
            />
            <button
              onClick={addSellingPoint}
              disabled={!newSellingPoint.trim()}
              className="px-3 py-2 text-xs bg-indigo-500/20 text-indigo-300 rounded-lg hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
            >+ 添加</button>
          </div>
        </section>

        {/* ===== 目标平台 ===== */}
        <section>
          <label className="text-gray-300 text-xs font-medium mb-2 block">📱 目标平台</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => updateField('platform', productCustomization.platform === p ? '' : p)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  productCustomization.platform === p
                    ? 'bg-violet-500/30 border-violet-400/50 text-violet-200'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >{p}</button>
            ))}
          </div>
        </section>

        {/* ===== 字体推荐 ===== */}
        <section>
          <label className="text-gray-300 text-xs font-medium flex items-center gap-1.5 mb-2">
            📝 字体风格
            {productCustomization.fontPreference && (
              <span className="text-amber-400 text-[10px] bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                AI识别: {productCustomization.fontPreference.split('(')[0]}
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => updateField('fontPreference', productCustomization.fontPreference === f.value ? '' : f.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  productCustomization.fontPreference === f.value
                    ? 'bg-amber-500/30 border-amber-400/50 text-amber-200'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >{f.label}</button>
            ))}
          </div>
        </section>

        {/* ===== 卧室风格 ===== */}
        <section>
          <label className="text-gray-300 text-xs font-medium mb-2 block">🛏️ 卧室风格</label>
          <div className="flex flex-wrap gap-2">
            {BEDROOM_STYLE_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => updateField('bedroomStyle', productCustomization.bedroomStyle === s.value ? '' : s.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  productCustomization.bedroomStyle === s.value
                    ? 'bg-cyan-500/30 border-cyan-400/50 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >{s.label}</button>
            ))}
          </div>
        </section>

        {/* ===== 打光/镜头 两列布局 ===== */}
        <div className="grid grid-cols-2 gap-4">
          <section>
            <label className="text-gray-300 text-xs font-medium mb-2 block">💡 打光偏好</label>
            <select
              value={productCustomization.lightingPreference}
              onChange={e => updateField('lightingPreference', e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white text-xs px-3 py-2 rounded-lg focus:border-indigo-500 focus:outline-none"
            >
              <option value="">AI自动</option>
              {LIGHTING_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </section>
          <section>
            <label className="text-gray-300 text-xs font-medium mb-2 block">📷 镜头角度</label>
            <select
              value={productCustomization.cameraAnglePreference}
              onChange={e => updateField('cameraAnglePreference', e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white text-xs px-3 py-2 rounded-lg focus:border-indigo-500 focus:outline-none"
            >
              <option value="">AI自动</option>
              {CAMERA_ANGLE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </section>
        </div>

        {/* ===== 模特信息 ===== */}
        <section>
          <label className="text-gray-300 text-xs font-medium flex items-center gap-1.5 mb-2">
            👤 模特信息
            {productCustomization.modelDescription && (
              <span className="text-pink-400 text-[10px] bg-pink-400/10 px-1.5 py-0.5 rounded-full">AI已检测</span>
            )}
          </label>
          <div className="flex gap-3 items-start">
            {/* 模特照片上传 */}
            <div
              onClick={() => modelPhotoInputRef.current?.click()}
              className="w-16 h-16 flex-shrink-0 rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-pink-400/40 transition-colors bg-white/5 overflow-hidden"
            >
              {productCustomization.modelPhotoBase64 ? (
                <img
                  src={`data:image/jpeg;base64,${productCustomization.modelPhotoBase64}`}
                  alt="模特"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-500 text-lg">📸</span>
              )}
            </div>
            <input
              ref={modelPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={handleModelPhotoUpload}
              className="hidden"
            />
            <textarea
              value={productCustomization.modelDescription}
              onChange={e => updateField('modelDescription', e.target.value)}
              placeholder={productCustomization.modelDescription || '描述模特外貌特征（可选）... 例如: 亚洲女性，25-30岁，长发'}
              className="flex-1 bg-white/5 border border-white/10 text-white text-xs px-3 py-2 rounded-lg focus:border-pink-500 focus:outline-none resize-none h-16 placeholder-gray-500"
            />
          </div>
        </section>

        {/* ===== 品牌Logo ===== */}
        <section>
          <label className="text-gray-300 text-xs font-medium mb-2 block">🏢 品牌Logo（可选）</label>
          <div className="flex items-center gap-3">
            <div
              onClick={() => logoInputRef.current?.click()}
              className="w-12 h-12 rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-indigo-400/40 transition-colors bg-white/5 overflow-hidden"
            >
              {productCustomization.brandLogoBase64 ? (
                <img
                  src={`data:image/png;base64,${productCustomization.brandLogoBase64}`}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <span className="text-gray-500 text-sm">+</span>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            {productCustomization.brandLogoBase64 && (
              <button
                onClick={() => updateField('brandLogoBase64', null)}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >移除Logo</button>
            )}
            <span className="text-gray-500 text-[10px]">上传后会替换生成图片中的品牌Logo位置</span>
          </div>
        </section>

        {/* ===== 英文版本 ===== */}
        <section className="flex items-center justify-between py-2 border-t border-white/5">
          <div>
            <label className="text-gray-300 text-xs font-medium">🌐 英文版本</label>
            <p className="text-gray-500 text-[10px] mt-0.5">同时生成英文版营销文案</p>
          </div>
          <button
            onClick={() => updateField('needEnglishVersion', !productCustomization.needEnglishVersion)}
            className={`w-10 h-5 rounded-full transition-all relative ${
              productCustomization.needEnglishVersion ? 'bg-emerald-500' : 'bg-white/15'
            }`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              productCustomization.needEnglishVersion ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </section>
      </div>
    </div>
  );
}
