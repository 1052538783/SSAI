/**
 * 左侧控制面板 — 根据当前 Phase 切换内容
 * Phase 1: 上传区 + 花型类型 + 绣花提取目标
 * Phase 2: 面料 + 风格 + AI推荐风格 + 版型 + 被套反面 + 手动取色器
 * Phase 3/4: 模块开关 + AI 设计建议
 */

import { useAppStore } from '../../stores/useAppStore';
import { FABRIC_KEYS, STYLE_KEYS } from '../../config/fabrics';
import { MAX_UPLOAD_IMAGES, ANALYSIS_MODEL_OPTIONS } from '../../config/models';
import { MAIN_IMAGE_MODULES, DETAIL_PAGE_MODULES } from '../../config/materials';
import { fileToBase64, adaptiveColorEngine } from '../../services/imageUtils';
import { callGeminiApi } from '../../services/gemini';
import ImageOverlayToolbar from '../common/ImageOverlayToolbar';
import { v4 as uuidv4 } from 'uuid';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useLogStore } from '../../stores/useLogStore';

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}


export default function LeftPanel({ showToast }: Props) {
  const store = useAppStore();
  const { addLog } = useLogStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // 模块引用（直接引用以支持 checkbox toggle）
  const mainImageModules = MAIN_IMAGE_MODULES;
  const detailImageModules = DETAIL_PAGE_MODULES;

  // AI 推荐风格加载状态
  const [styleRecLoading, setStyleRecLoading] = useState(false);
  // 是否已自动触发过风格推荐（避免重复触发）
  const [autoRecTriggered, setAutoRecTriggered] = useState(false);

  // 🔑 AI 推荐颜色状态
  const [colorRecLoading, setColorRecLoading] = useState(false);
  const [recommendedColors, setRecommendedColors] = useState<Array<{ hex: string; name: string; reason: string }>>([]);
  const [autoColorTriggered, setAutoColorTriggered] = useState(false);

  // 🔑 AI 推荐风格 handler
  // 使用 getState() 确保读取最新的 store 状态
  const handleStyleRecommend = useCallback(async () => {
    const latestStore = useAppStore.getState();
    const currentApiKey = latestStore.apiKey;
    const patterns = latestStore.confirmedPatternBase64s;
    const currentFabric = latestStore.fabric;
    const dominantColor = latestStore.extractedDominantColor;
    const currentPatternType = latestStore.patternType;

    console.log('[织梦AI] 风格推荐触发', {
      hasApiKey: !!currentApiKey,
      patternCount: patterns.length,
      fabric: currentFabric,
      color: dominantColor?.name,
      patternType: currentPatternType,
    });

    if (!currentApiKey || patterns.length === 0) {
      console.warn('[织梦AI] 风格推荐跳过：缺少apiKey或花型');
      return;
    }

    setStyleRecLoading(true);
    latestStore.setRecommendedStyle(null);

    try {
      // 🔑 纯文本分析 — 不发送图片，避免超时
      // 使用已经提取好的主色调、花型类型、面料信息
      const colorDesc = dominantColor
        ? `主色调: ${dominantColor.name} (${dominantColor.hex})`
        : '主色调: 未提取';

      const patternDesc = currentPatternType === 'allover' ? '通铺满版花型' : '绣花/定位花';

      const result = await callGeminiApi({
        apiKey: currentApiKey,
        bailianApiKey: latestStore.bailianApiKey,
        requestBody: {
          contents: [{
            role: 'user',
            parts: [
              { text: `你是一位资深家纺视觉设计顾问。根据以下花型特征信息，推荐最适合的场景风格：

花型信息：
- 花型类型: ${patternDesc}
- ${colorDesc}
- 面料类型: ${currentFabric}

可选场景风格列表：${STYLE_KEYS.join('、')}

请严格以JSON格式回复（不要添加任何其他文字）：
{"styleName": "选中的风格名称", "reason": "推荐理由（15字以内）"}` },
            ],
          }],
          generationConfig: { temperature: 0.3 },
        },
        modelType: 'text',
        textModelId: latestStore.analysisModelId,
        phase: 2,
        timeoutMs: 60000,
        onLog: addLog,
      });

      console.log('[织梦AI] 风格推荐结果', { success: result.success, text: result.text?.slice(0, 100) });

      if (result.success && result.text) {
        try {
          const jsonMatch = result.text.match(/\{[\s\S]*"styleName"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.styleName && STYLE_KEYS.includes(parsed.styleName)) {
              const freshStore = useAppStore.getState();
              freshStore.setRecommendedStyle({
                styleName: parsed.styleName,
                reason: parsed.reason || '最适合此花型',
              });
              // 🔑 自动选中推荐的风格（用户仍可手动切换）
              if (!freshStore.style) {
                freshStore.setStyle(parsed.styleName);
              }
              showToast(`✅ AI 推荐风格：${parsed.styleName}，已自动选中`, 'success');
            } else {
              console.warn('[织梦AI] 推荐的风格名不在列表中:', parsed.styleName);
            }
          }
        } catch (e) {
          console.warn('[织梦AI] 风格推荐JSON解析失败:', e);
        }
      } else {
        console.warn('[织梦AI] 风格推荐API失败:', result.error);
      }
    } catch (e) {
      console.error('[织梦AI] 风格推荐异常:', e);
    } finally {
      setStyleRecLoading(false);
    }
  }, [addLog, showToast]);

  // 🔑 进入 Phase2 时自动触发 AI 风格推荐
  useEffect(() => {
    const s = useAppStore.getState();
    if (
      s.currentPhase === 2 &&
      !autoRecTriggered &&
      !styleRecLoading &&
      !s.recommendedStyle &&
      !s.style &&
      s.apiKey &&
      s.confirmedPatternBase64s.length > 0
    ) {
      console.log('[织梦AI] 自动触发风格推荐');
      setAutoRecTriggered(true);
      handleStyleRecommend();
    }
  }, [store.currentPhase, store.confirmedPatternBase64s.length, autoRecTriggered, styleRecLoading, handleStyleRecommend]);

  // 🔑 手动取色器 handler（使用自适应色彩引擎）
  const handleManualColorPick = useCallback((hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // 🔑 自适应色彩引擎：深色/喜庆红豁免莫兰迪降色
    const result = adaptiveColorEngine(r, g, b);
    
    store.setDominantColor({ 
      hex: result.hex, 
      name: result.name, 
      rgb: result.rgb,
      colorTemperature: result.colorTemperature,
      bypassed: result.bypassed,
      bypassReason: result.bypassReason,
    });
    store.setManualColorHex(result.hex);
    
    // 🔑 根据豁免状态给出不同的提示
    if (result.bypassed) {
      showToast(`🎨 已识别为${result.bypassReason}，保持高饱和度质感`, 'success');
    } else if (result.hex.toLowerCase() !== hex.toLowerCase()) {
      showToast(`🎨 已自动将颜色转换为更具高级感的莫兰迪色：${result.name}`, 'info');
    } else {
      showToast(`🎨 已更新主色调：${result.name}`, 'success');
    }
  }, [store, showToast]);

  // 🔑 AI 推荐床单主色调
  const handleColorRecommend = useCallback(async () => {
    const latestStore = useAppStore.getState();
    const currentApiKey = latestStore.apiKey;
    const dominantColor = latestStore.extractedDominantColor;
    const currentFabric = latestStore.fabric;
    const currentStyle = latestStore.style;
    const currentPatternType = latestStore.patternType;

    if (!currentApiKey) return;

    setColorRecLoading(true);
    setRecommendedColors([]);

    try {
      const colorDesc = dominantColor
        ? `花型主色调: ${dominantColor.name} (${dominantColor.hex})`
        : '花型主色调: 未提取';

      const result = await callGeminiApi({
        apiKey: currentApiKey,
        bailianApiKey: latestStore.bailianApiKey,
        requestBody: {
          contents: [{
            role: 'user',
            parts: [{ text: `你是一位专业家纺配色顾问。根据以下花型信息，推荐 3 个最适合的床单主色调。

花型信息：
- ${colorDesc}
- 花型类型: ${currentPatternType === 'allover' ? '通铺满版' : '绣花/定位花'}
- 面料: ${currentFabric}
${currentStyle ? `- 场景风格: ${currentStyle}` : ''}

推荐原则：
1. 床单色应与花型和谐搭配，可以是花型中的某个色系的浅色版本
2. 避免与花型颜色完全相同，要有层次感
3. 符合场景风格的整体调性
4. 必须是低饱和度、莫兰迪色系（HSL饱和度20%-35%，亮度65%-85%），**绝对不能推荐高饱和的荧光色**

请严格以JSON格式回复（不要添加其他文字）：
{"colors": [{"hex": "#XXXXXX", "name": "颜色名", "reason": "推荐理由(10字内)"}, ...]}

hex必须是标准的6位十六进制颜色码。` }],
          }],
          generationConfig: { temperature: 0.5 },
        },
        modelType: 'text',
        textModelId: latestStore.analysisModelId,
        phase: 2,
        timeoutMs: 60000,
        onLog: addLog,
      });

      if (result.success && result.text) {
        try {
          const jsonMatch = result.text.match(/\{[\s\S]*"colors"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.colors && Array.isArray(parsed.colors)) {
              const validColors = parsed.colors.slice(0, 3).filter(
                (c: any) => c.hex && /^#[0-9a-fA-F]{6}$/.test(c.hex)
              );
              setRecommendedColors(validColors);
              // 自动应用第一个推荐色（用户可切换）
              if (validColors.length > 0 && !latestStore.manualColorHex) {
                const c = validColors[0];
                const r = parseInt(c.hex.slice(1, 3), 16);
                const g = parseInt(c.hex.slice(3, 5), 16);
                const b = parseInt(c.hex.slice(5, 7), 16);
                
                // 🔑 将AI推荐色也经过自适应色彩引擎处理
                const colorResult = adaptiveColorEngine(r, g, b);
                
                useAppStore.getState().setDominantColor({
                  hex: colorResult.hex, 
                  name: colorResult.name, 
                  rgb: colorResult.rgb,
                  colorTemperature: colorResult.colorTemperature,
                  bypassed: colorResult.bypassed,
                  bypassReason: colorResult.bypassReason,
                });
                showToast(`✅ AI 推荐床单色：${colorResult.name}，已自动应用`, 'success');
              }
            }
          }
        } catch (e) {
          console.warn('[织梦AI] 颜色推荐JSON解析失败:', e);
        }
      }
    } catch (e) {
      console.error('[织梦AI] 颜色推荐异常:', e);
    } finally {
      setColorRecLoading(false);
    }
  }, [addLog, showToast]);

  // 🔑 进入 Phase2 时自动触发 AI 颜色推荐
  useEffect(() => {
    const s = useAppStore.getState();
    if (
      s.currentPhase === 2 &&
      !autoColorTriggered &&
      !colorRecLoading &&
      s.apiKey &&
      s.confirmedPatternBase64s.length > 0
    ) {
      setAutoColorTriggered(true);
      // 延迟触发，不和风格推荐抢并发
      setTimeout(() => handleColorRecommend(), 1000);
    }
  }, [store.currentPhase, store.confirmedPatternBase64s.length, autoColorTriggered, colorRecLoading, handleColorRecommend]);

  // 文件上传处理
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_UPLOAD_IMAGES - store.uploadedImages.length;
    if (remaining <= 0) {
      showToast(`最多上传${MAX_UPLOAD_IMAGES}张参考图`, 'error');
      return;
    }
    const toProcess = Array.from(files).slice(0, remaining);
    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const base64 = await fileToBase64(file);
        store.addUploadedImage({
          id: uuidv4(),
          base64,
          mimeType: file.type,
          filename: file.name,
        });
      } catch (e) {
        showToast('图片读取失败', 'error');
      }
    }
    showToast(`已添加 ${toProcess.length} 张参考图`, 'success');
  }, [store, showToast]);

  // 拖拽
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  return (
    <aside className="w-[320px] flex-shrink-0 overflow-y-auto border-r border-gray-800/50 bg-[rgba(10,14,26,0.4)] p-4 space-y-4 max-md:hidden">

      {/* 🔑 API Key 输入区 + 分析模型选择 */}
      <div className="glass-card-static p-4 space-y-3">
        <div className="text-xs text-gray-400 font-medium">🔑 API易 Key <span className="text-gray-600">(生图 + Gemini分析)</span></div>
        <input
          type="password"
          className="input-glass text-xs"
          placeholder="输入你的 API易 Key..."
          value={store.apiKey}
          onChange={(e) => store.setApiKey(e.target.value)}
        />
        <div className="text-xs text-gray-400 font-medium">🔑 百炼 Key <span className="text-gray-600">(Qwen分析可选)</span></div>
        <input
          type="password"
          className="input-glass text-xs"
          placeholder="输入你的百炼 API Key..."
          value={store.bailianApiKey}
          onChange={(e) => store.setBailianApiKey(e.target.value)}
        />

        {/* 分析模型选择 */}
        <div className="pt-1 border-t border-gray-800/50">
          <div className="text-[10px] text-gray-500 mb-1.5">🧠 分析模型 <span className="text-gray-600">(VLM/文本)</span></div>
          <div className="space-y-1">
            {ANALYSIS_MODEL_OPTIONS.map(opt => {
              const isSelected = store.analysisModelId === opt.id;
              const needsBailian = opt.provider === 'bailian';
              const hasBailianKey = !!store.bailianApiKey;
              return (
                <button
                  key={opt.id}
                  className={`w-full p-2 rounded-lg text-left transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-500/20 border border-indigo-400/40 text-indigo-300'
                      : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                  }`}
                  onClick={() => store.setAnalysisModelId(opt.id)}
                >
                  <span className="text-sm">{opt.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{opt.label}</div>
                    <div className="text-[9px] text-gray-500 truncate">{opt.desc}</div>
                  </div>
                  {needsBailian && !hasBailianKey && isSelected && (
                    <span className="text-[9px] text-amber-400 whitespace-nowrap">需百炼Key</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🖼 输出分辨率 — 全阶段可见 */}
      <div className="glass-card-static p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">🖼 分辨率</span>
          <select
            className="input-glass text-xs py-1 flex-1"
            value={store.outputResolution}
            onChange={(e) => store.setOutputResolution(e.target.value as any)}
          >
            <option value="1K">1K (1024px) — 快速</option>
            <option value="2K">2K (2048px) — 高清</option>
            <option value="4K">4K (4096px) — 超清</option>
          </select>
        </div>
      </div>

      {/* Phase 1: 上传 & 花型类型 */}
      {store.currentPhase === 1 && (
        <>
          {/* 上传区 */}
          <div
            className="glass-card p-4 space-y-3 cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-xs text-gray-400 font-medium">📂 参考图上传</div>
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center hover:border-indigo-400/50 transition-colors">
              <div className="text-3xl mb-2">📤</div>
              <div className="text-sm text-gray-400">
                拖拽或点击上传 (最多{MAX_UPLOAD_IMAGES}张)
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                已上传 {store.uploadedImages.length}/{MAX_UPLOAD_IMAGES}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>

          {/* 已上传预览 — 使用 Hover 浮层工具栏 */}
          {store.uploadedImages.length > 0 && (
            <div className="glass-card-static p-3">
              <div className="grid grid-cols-3 gap-2">
                {store.uploadedImages.map((img) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square">
                    <img
                      src={`data:${img.mimeType};base64,${img.base64}`}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                    />
                    <ImageOverlayToolbar
                      compact
                      actions={[{
                        icon: '✕',
                        label: '删除',
                        onClick: () => store.removeUploadedImage(img.id),
                        variant: 'danger',
                      }]}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 花型类型 */}
          <div className="glass-card-static p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">🎨 花型类型</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'allover' as const, label: '通铺花型', emoji: '🌸' },
                { value: 'embroidery' as const, label: '绣花/定位花', emoji: '✨' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`p-3 rounded-xl text-sm text-center transition-all ${
                    store.patternType === opt.value
                      ? 'bg-indigo-500/20 border border-indigo-400/40 text-indigo-300'
                      : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                  }`}
                  onClick={() => store.setPatternType(opt.value)}
                >
                  <div className="text-lg">{opt.emoji}</div>
                  <div className="mt-1">{opt.label}</div>
                </button>
              ))}
            </div>

            {/* 🔑 通铺花型：提取模式切换 */}
            {store.patternType === 'allover' && (
              <div className="mt-2 p-3 rounded-xl border border-gray-700/50 bg-gray-900/30 space-y-2">
                <div className="text-[11px] text-gray-400 font-semibold">📋 提取模式</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`p-2 rounded-lg text-left transition-all ${
                      store.extractionMode === 'faithful'
                        ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                        : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                    }`}
                    onClick={() => store.setExtractionMode('faithful')}
                  >
                    <div className="text-xs font-medium">🎯 忠实提取</div>
                    <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">1:1还原参考图花型</div>
                  </button>
                  <button
                    className={`p-2 rounded-lg text-left transition-all ${
                      store.extractionMode === 'creative'
                        ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300'
                        : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                    }`}
                    onClick={() => store.setExtractionMode('creative')}
                  >
                    <div className="text-xs font-medium">🎨 灵感创作</div>
                    <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">创造全新花型避免版权</div>
                  </button>
                </div>
              </div>
            )}

            {/* 🔑 局部绣花：提取目标选择 */}
            {store.patternType === 'embroidery' && (
              <div className="mt-2 p-3 rounded-xl border border-gray-700/50 bg-gray-900/30 space-y-2">
                <div className="text-[11px] text-gray-400 font-semibold">📌 提取目标 (可多选)</div>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={store.extractionTargets.duvet}
                    onChange={() => store.setExtractionTargets({
                      ...store.extractionTargets,
                      duvet: !store.extractionTargets.duvet,
                    })}
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-400 group-hover/label:text-gray-300 transition-colors">
                    🛏️ 被套 (Bedding) 主花型
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={store.extractionTargets.pillowcase}
                    onChange={() => store.setExtractionTargets({
                      ...store.extractionTargets,
                      pillowcase: !store.extractionTargets.pillowcase,
                    })}
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-400 group-hover/label:text-gray-300 transition-colors">
                    💤 枕套 (Pillowcase) 单侧花型
                  </span>
                </label>
              </div>
            )}


          </div>
        </>
      )}

      {/* Phase 2: 面料 & 风格 & 色彩 */}
      {store.currentPhase === 2 && (
        <>
          <div className="glass-card-static p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">🧵 面料类型</div>
            <select
              className="input-glass"
              value={store.fabric}
              onChange={(e) => store.setFabric(e.target.value)}
            >
              {FABRIC_KEYS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="glass-card-static p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">🎭 场景风格</div>
              {/* 🔑 AI 推荐按钮 */}
              <button
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                disabled={styleRecLoading || store.confirmedPatternBase64s.length === 0}
                onClick={handleStyleRecommend}
              >
                {styleRecLoading ? '⏳ 分析中...' : '✨ AI推荐'}
              </button>
            </div>

            {/* 🔑 AI 推荐风格标签 */}
            {store.recommendedStyle && (
              <div
                className="flex items-center gap-2 p-2 rounded-lg border border-amber-500/25 bg-amber-500/10 cursor-pointer hover:bg-amber-500/15 transition-all"
                onClick={() => store.setStyle(store.recommendedStyle!.styleName)}
              >
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold animate-pulse" style={{ animationDuration: '2s' }}>
                  ✨ AI推荐
                </span>
                <span className="text-xs text-amber-300 font-medium">{store.recommendedStyle.styleName}</span>
                <span className="text-[10px] text-gray-500 truncate flex-1">{store.recommendedStyle.reason}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {STYLE_KEYS.map(s => (
                <button
                  key={s}
                  className={`p-2 rounded-lg text-xs text-center transition-all ${
                    store.style === s
                      ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                      : s === store.recommendedStyle?.styleName
                        ? 'bg-amber-500/10 border border-amber-400/30 text-amber-300'
                        : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                  }`}
                  onClick={() => store.setStyle(s)}
                >
                  {s}
                  {s === store.recommendedStyle?.styleName && store.style !== s && (
                    <span className="block text-[9px] text-amber-500 mt-0.5">⭐ 推荐</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card-static p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">📐 版型布局</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'standard' as const, label: '标准A+B' },
                { value: 'bedskirt' as const, label: '床裙款' },
                { value: 'minimalist' as const, label: '纯色极简' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`p-2 rounded-lg text-xs text-center transition-all ${
                    store.beddingLayout === opt.value
                      ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                      : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                  }`}
                  onClick={() => store.setBeddingLayout(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card-static p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">🔄 被套反面</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-2 rounded-lg text-xs text-center transition-all ${
                  store.duvetReverseSide === 'solidcolor'
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                    : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                }`}
                onClick={() => store.setDuvetReverseSide('solidcolor')}
              >纯色反面</button>
              <button
                className={`p-2 rounded-lg text-xs text-center transition-all ${
                  store.duvetReverseSide === 'sameprint'
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                    : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                }`}
                onClick={() => store.setDuvetReverseSide('sameprint')}
              >同款印花</button>
            </div>
          </div>

          {/* 📷 拍摄角度选择器 */}
          <div className="glass-card-static p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">📷 拍摄角度</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'three_quarter_above' as const, label: '斜侧俯拍', emoji: '🎯', desc: '经典主图角度' },
                { value: 'top_down' as const, label: '正上方俯视', emoji: '🔍', desc: '展示整体花型' },
                { value: 'front_eye' as const, label: '正面平视', emoji: '🏨', desc: '酒店风对称' },
                { value: 'side_closeup' as const, label: '侧面特写', emoji: '📐', desc: '面料质感细节' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  className={`p-2 rounded-lg text-left transition-all ${
                    store.cameraAngle === opt.value
                      ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                      : 'bg-gray-800/30 border border-transparent text-gray-400 hover:border-gray-600'
                  }`}
                  onClick={() => store.setCameraAngle(opt.value)}
                >
                  <div className="text-xs font-medium">{opt.emoji} {opt.label}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 🔑 床单主色调 — AI推荐 + 手动取色 */}
          <div className="glass-card-static p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400 font-medium">🎨 床单主色调</div>
              <button
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                onClick={handleColorRecommend}
                disabled={colorRecLoading}
              >
                {colorRecLoading ? '✨ 分析中...' : '✨ AI推荐'}
              </button>
            </div>

            {/* 当前选中的颜色 */}
            <div className="flex items-center gap-3">
              {/* 隐藏的原生取色器 */}
              <input
                ref={colorInputRef}
                type="color"
                value={store.extractedDominantColor?.hex || store.manualColorHex || '#e0e0e0'}
                onChange={(e) => handleManualColorPick(e.target.value)}
                className="absolute w-0 h-0 opacity-0 pointer-events-none"
              />
              <div
                className="w-10 h-10 rounded-xl cursor-pointer border-2 border-gray-600 hover:border-indigo-400 transition-all shadow-lg flex-shrink-0"
                style={{ backgroundColor: store.extractedDominantColor?.hex || '#e0e0e0' }}
                onClick={() => colorInputRef.current?.click()}
                title="点击手动选色"
              />
              <div className="flex-1">
                <div className="text-sm text-gray-300 font-medium">
                  {store.extractedDominantColor?.name || '未提取'}
                </div>
                <div className="text-[10px] text-gray-500">
                  {store.extractedDominantColor?.hex || '--'}
                  {store.manualColorHex && <span className="text-indigo-400 ml-1">(手动)</span>}
                </div>
              </div>
              <button
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap"
                onClick={() => colorInputRef.current?.click()}
              >
                ✏️ 改色
              </button>
            </div>
            
            {/* 🔑 取色器 UI 低饱和度提示 */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 mt-2">
              <span className="text-[10px] text-amber-500 font-medium">
                {store.extractedDominantColor?.bypassed
                  ? `🎯 已识别为${store.extractedDominantColor.bypassReason || '深色/喜庆色'}，保持高饱和度原色质感`
                  : '✨ 自动应用莫兰迪高级灰滤镜。推荐使用低饱和发灰的颜色以获得更逼真的面料质感。'
                }
              </span>
            </div>

            {/* 🔑 AI 推荐色卡片 */}
            {colorRecLoading && (
              <div className="flex gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex-1 h-12 rounded-lg bg-gray-800/40 animate-pulse" />
                ))}
              </div>
            )}
            {recommendedColors.length > 0 && !colorRecLoading && (
              <div>
                <div className="text-[10px] text-gray-500 mb-1.5">✨ AI 推荐配色（点击应用）</div>
                <div className="flex gap-2">
                  {recommendedColors.map((c, i) => (
                    <button
                      key={i}
                      className={`flex-1 p-2 rounded-lg border transition-all hover:scale-105 ${
                        store.extractedDominantColor?.hex === c.hex
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-gray-700 bg-gray-800/30 hover:border-gray-500'
                      }`}
                      onClick={() => handleManualColorPick(c.hex)}
                      title={c.reason}
                    >
                      <div
                        className="w-full h-6 rounded-md mb-1"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div className="text-[9px] text-gray-400 truncate">{c.name}</div>
                      <div className="text-[8px] text-gray-600 truncate">{c.reason}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Phase 3: 营销套图模块开关 & AI 设计建议 */}
      {store.currentPhase === 3 && (
        <>
          {/* 主效果图缩略 */}
          {store.mainRenderBase64 && (
            <div className="glass-card-static p-3">
              <div className="text-xs text-gray-400 font-medium mb-2">🛏️ 当前效果图</div>
              <img
                src={`data:image/png;base64,${store.mainRenderBase64}`}
                alt="效果图" className="w-full aspect-[3/4] object-cover rounded-xl"
              />
            </div>
          )}

          <div className="glass-card-static p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">🖼️ 主图出图清单</div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {mainImageModules.map((mod: any) => (
                <label key={mod.key} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={mod.enabled}
                    onChange={() => { mod.enabled = !mod.enabled; store.setPhase(3); }}
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  <span>{mod.emoji} {mod.label}</span>
                </label>
              ))}
            </div>
            <div className="text-[10px] text-gray-500">
              已启用 {mainImageModules.filter((m: any) => m.enabled).length}/{mainImageModules.length} 个
            </div>
          </div>

          <div className="glass-card-static p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">📋 详情图出图清单</div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {detailImageModules.map((mod: any) => (
                <label key={mod.key} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={mod.enabled}
                    onChange={() => { mod.enabled = !mod.enabled; store.setPhase(3); }}
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  <span>{mod.emoji} {mod.label}</span>
                </label>
              ))}
            </div>
            <div className="text-[10px] text-gray-500">
              已启用 {detailImageModules.filter((m: any) => m.enabled).length}/{detailImageModules.length} 个
            </div>
          </div>



          <button className="btn-secondary w-full text-xs" onClick={() => store.resetToPhase2()}>
            ← 返回铺床渲染
          </button>
        </>
      )}
    </aside>
  );
}
