/**
 * 提示词控制中心 — 实时展示/编辑即将发送的 Prompt
 * 🔑 编辑内容存入 store 的 editedPromptStructure/Style/Negative，由 Phase 子组件读取
 */

import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { buildPromptPreviewCn } from '../../services/promptEngine';

export default function PromptControlCenter() {
  const {
    currentPhase, promptPanelOpen, setPromptPanelOpen,
    patternType, extractionMode, fabric, style, beddingLayout,
    duvetReverseSide, extractedDominantColor, cameraAngle,
    uploadedImages, confirmedPatternBase64s,
    mainRenderBase64, additionalPrompt,
    userModifiedPrompt, setUserModifiedPrompt,
    editedPromptStructure, editedPromptStyle, editedPromptNegative,
    setEditedPromptStructure, setEditedPromptStyle, setEditedPromptNegative,
  } = useAppStore();

  // 生成自动预览 Prompt
  const preview = useMemo(() => {
    return buildPromptPreviewCn(currentPhase, {
      patternType, extractionMode, fabric, style, beddingLayout, duvetReverseSide,
      dominantColor: extractedDominantColor,
      extra: additionalPrompt || undefined,
      cameraAngle,
    });
  }, [currentPhase, patternType, extractionMode, fabric, style, beddingLayout, duvetReverseSide, extractedDominantColor, additionalPrompt, cameraAngle]);

  // 当自动生成的 prompt 变化时同步（如果用户没有手动修改）
  useEffect(() => {
    if (!userModifiedPrompt) {
      setEditedPromptStructure(preview.structure);
      setEditedPromptStyle(preview.style);
      setEditedPromptNegative(preview.negative);
    }
  }, [preview, userModifiedPrompt, setEditedPromptStructure, setEditedPromptStyle, setEditedPromptNegative]);

  // 参考图上下文
  const imageContext = useMemo(() => {
    const items: { label: string; thumbBase64: string }[] = [];
    if (currentPhase === 1) {
      uploadedImages.forEach((img, i) => items.push({ label: `参考图#${i + 1}`, thumbBase64: img.base64 }));
    } else if (currentPhase === 2) {
      confirmedPatternBase64s.forEach((b64, i) => items.push({ label: `花型#${i + 1}`, thumbBase64: b64 }));
    } else if (currentPhase === 3) {
      if (mainRenderBase64) items.push({ label: '主效果图', thumbBase64: mainRenderBase64 });
    }
    return items;
  }, [currentPhase, uploadedImages, confirmedPatternBase64s, mainRenderBase64]);

  if (!promptPanelOpen) {
    return (
      <button
        className="fixed bottom-20 right-6 z-50 btn-secondary text-xs px-3 py-2 rounded-full shadow-lg"
        onClick={() => setPromptPanelOpen(true)}
        title="打开提示词控制中心"
      >
        🎛️ Prompt
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[7000] glass-card-static border-t border-gray-700/50 max-h-[40vh] overflow-y-auto fade-in-up">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/30 sticky top-0 bg-[rgba(10,14,26,0.95)] z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">🎛️ 提示词控制中心</span>
          <span className="text-[10px] text-gray-500">
            Phase {currentPhase} · 
            {currentPhase === 1 ? '花型提取' : currentPhase === 2 ? '铺床渲染' : '一键营销出图'}
          </span>
          {userModifiedPrompt && (
            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">已修改</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {userModifiedPrompt && (
            <button
              className="text-[10px] text-yellow-400 hover:text-yellow-300"
              onClick={() => {
                setUserModifiedPrompt(false);
                setEditedPromptStructure(preview.structure);
                setEditedPromptStyle(preview.style);
                setEditedPromptNegative(preview.negative);
              }}
            >
              🔄 重置
            </button>
          )}
          <button className="btn-icon w-6 h-6 text-xs" onClick={() => setPromptPanelOpen(false)}>✕</button>
        </div>
      </div>

      {/* 参考图上下文 */}
      {imageContext.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-800/20">
          <div className="text-[10px] text-gray-500 mb-1">📎 携带 {imageContext.length} 张图片：</div>
          <div className="flex gap-2 overflow-x-auto">
            {imageContext.map((ctx, i) => (
              <div key={i} className="flex-shrink-0 text-center">
                <img src={`data:image/png;base64,${ctx.thumbBase64}`} alt={ctx.label}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-700/30" />
                <div className="text-[9px] text-gray-500 mt-0.5">{ctx.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 三段式 Prompt 编辑 — 🔑 编辑内容直接存入 store */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
        <div>
          <label className="text-[10px] text-indigo-400 font-medium mb-1 block">📐 [主体结构描述]</label>
          <textarea className="input-glass text-[11px] w-full h-24 resize-none"
            value={editedPromptStructure}
            onChange={(e) => { setEditedPromptStructure(e.target.value); setUserModifiedPrompt(true); }}
          />
        </div>
        <div>
          <label className="text-[10px] text-cyan-400 font-medium mb-1 block">🎨 [材质风格描述]</label>
          <textarea className="input-glass text-[11px] w-full h-24 resize-none"
            value={editedPromptStyle}
            onChange={(e) => { setEditedPromptStyle(e.target.value); setUserModifiedPrompt(true); }}
          />
        </div>
        <div>
          <label className="text-[10px] text-red-400 font-medium mb-1 block">🚫 [约束 & 负面提示]</label>
          <textarea className="input-glass text-[11px] w-full h-24 resize-none"
            value={editedPromptNegative}
            onChange={(e) => { setEditedPromptNegative(e.target.value); setUserModifiedPrompt(true); }}
          />
        </div>
      </div>
    </div>
  );
}
