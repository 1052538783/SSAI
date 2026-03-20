/**
 * Phase 2 — 铺床渲染（业务逻辑 + UI）
 * 支持：多轮编辑、PromptControlCenter联动、历史效果图加载
 * 🔑 必须先选择风格才能渲染
 * 🔑 AI 渲染中显示实时计时器
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useLogStore } from '../../stores/useLogStore';
import { callGeminiApi } from '../../services/gemini';
import { contextManager } from '../../services/contextManager';
import { buildRenderPrompt } from '../../services/promptEngine';
import { DEFAULT_TEMPERATURES, RENDER_API_TIMEOUT_MS } from '../../config/models';
import { saveRender, getRenderHistory, deleteRender, type RenderRecord } from '../../db/dexieDB';
import ImageOverlayToolbar from '../common/ImageOverlayToolbar';
import AspectRatioSelector from '../common/AspectRatioSelector';
import { v4 as uuidv4 } from 'uuid';
import type { GeminiRequestBody } from '../../types/api';

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  openImageModal: (base64: string) => void;
}

export default function Phase2BedRender({ showToast, openImageModal }: Props) {
  const {
    apiKey, isGenerating, additionalPrompt, fabric, style,
    patternType, beddingLayout, duvetReverseSide,
    confirmedPatternBase64s, confirmedPatternRegionTags, extractedDominantColor,
    mainRenderBase64, outputResolution, renderAspectRatio, cameraAngle,
    setIsGenerating, addChatMessage, setMainRenderBase64,
    setPhase, setAdditionalPrompt, setRenderAspectRatio,
    mainImageResults, detailImageResults,
    setConfirmedPatterns,
  } = useAppStore();

  const { addLog } = useLogStore();
  const abortRef = useRef<AbortController | null>(null);

  // 🔑 生成计时器
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isGenerating) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isGenerating]);

  // 格式化计时
  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}分${sec.toString().padStart(2, '0')}秒` : `${sec}秒`;
  };

  // 历史效果图
  const [historyRenders, setHistoryRenders] = useState<RenderRecord[]>([]);
  useEffect(() => {
    getRenderHistory().then(setHistoryRenders).catch(console.error);
  }, [mainRenderBase64]);

  // ============================================================
  // 铺床渲染
  // ============================================================
  const handleRender = useCallback(async () => {
    if (!apiKey || confirmedPatternBase64s.length === 0 || isGenerating) return;
    // 🔑 必须先选择风格
    if (!style) {
      showToast('⚠️ 请先在左侧面板选择场景风格（可参考AI推荐）', 'error');
      return;
    }
    setIsGenerating(true);
    const extraRequest = additionalPrompt.trim();

    addChatMessage({
      id: uuidv4(), role: 'user', timestamp: Date.now(),
      text: `渲染铺床效果${extraRequest ? `（${extraRequest}）` : ''}`,
      images: [],
    });

    try {
      // 🔑 PromptControlCenter 联动
      const storeState = useAppStore.getState();
      let promptText: string;
      if (storeState.userModifiedPrompt && storeState.editedPromptStructure) {
        promptText = [
          storeState.editedPromptStructure,
          storeState.editedPromptStyle,
          storeState.editedPromptNegative ? `NEGATIVE: ${storeState.editedPromptNegative}` : '',
        ].filter(Boolean).join('\n\n');
      } else {
        promptText = buildRenderPrompt({
          fabric, style, patternType, beddingLayout, duvetReverseSide,
          dominantColor: extractedDominantColor,
          extraRequest: extraRequest || undefined,
          colorTemperature: extractedDominantColor?.colorTemperature,
          cameraAngle,
        });
      }

      const userParts: any[] = [{ text: promptText }];
      confirmedPatternBase64s.forEach(b64 => {
        userParts.push({ inlineData: { mimeType: 'image/png', data: b64 } });
      });

      // 🔑 每次渲染都清除多轮上下文，避免历史 base64 图片累积导致超时
      // Phase2 渲染不适合多轮模式，因为每次请求都包含花型图片（已经很大了）
      contextManager.clear();
      const contents = [{ role: 'user' as const, parts: userParts }];

      const requestBody: GeminiRequestBody = {
        contents,
        generationConfig: {
          temperature: DEFAULT_TEMPERATURES.render,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: renderAspectRatio,
            imageSize: outputResolution,
          },
        },
      };

      abortRef.current = new AbortController();

      addChatMessage({
        id: uuidv4(), role: 'system', timestamp: Date.now(),
        text: `⏳ 正在渲染铺床效果... (面料=${fabric}, 风格=${style || '默认'})`,
        images: [],
      });

      const result = await callGeminiApi({
        apiKey, requestBody, modelType: 'image', phase: 2,
        timeoutMs: RENDER_API_TIMEOUT_MS,
        signal: abortRef.current.signal, onLog: addLog,
      });

      if (result.success && result.images.length > 0) {
        contextManager.updateFromResponse(requestBody.contents, result.modelParts);
        addChatMessage({
          id: uuidv4(), role: 'ai', timestamp: Date.now(),
          text: result.text || '', images: result.images,
        });
        setMainRenderBase64(result.images[0]);
        await saveRender(result.images[0]);
        showToast('✅ 铺床渲染完成！', 'success');
      } else {
        addChatMessage({
          id: uuidv4(), role: 'system', timestamp: Date.now(),
          text: `❌ 渲染失败: ${result.error || '模型未返回图片'}`, images: [],
        });
        showToast(`渲染失败: ${result.error}`, 'error');
      }
    } catch (e) {
      showToast(`意外错误: ${(e as Error).message}`, 'error');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [apiKey, confirmedPatternBase64s, isGenerating, additionalPrompt, fabric, style, patternType, beddingLayout, duvetReverseSide, extractedDominantColor, outputResolution, addChatMessage, setMainRenderBase64, setIsGenerating, addLog, showToast]);

  const handleToPhase3 = useCallback(() => {
    if (!mainRenderBase64) { showToast('请先完成铺床渲染', 'error'); return; }
    contextManager.clear();
    setPhase(3);
    showToast('进入一键营销出图阶段', 'success');
  }, [mainRenderBase64, setPhase, showToast]);

  // 从历史加载渲染图 → 快速跳步
  const handleSelectHistoryRender = useCallback((record: RenderRecord) => {
    setMainRenderBase64(record.base64);
    addChatMessage({
      id: uuidv4(), role: 'system-success', timestamp: Date.now(),
      text: '✅ 从历史加载效果图', images: [],
    });
    showToast('已加载历史效果图', 'success');
  }, [setMainRenderBase64, addChatMessage, showToast]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    showToast('已取消', 'info');
  }, [setIsGenerating, showToast]);

  // 🔑 工作流解耦：直接上传花型图（跳过Phase1）
  const handleDirectPatternUpload = useCallback((files: FileList) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 3);
    if (imageFiles.length === 0) return;

    const targetSize = 1024; // 花型图需要更高分辨率
    Promise.all(imageFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let { width, height } = img;
            // 压缩到目标尺寸
            if (width > height) {
              if (width > targetSize) { height = Math.round(height * (targetSize / width)); width = targetSize; }
            } else {
              if (height > targetSize) { width = Math.round(width * (targetSize / height)); height = targetSize; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const base64Data = canvas.toDataURL('image/png', 0.9).split(',')[1];
              resolve(base64Data);
            }
          };
          if (typeof e.target?.result === 'string') img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    })).then(base64s => {
      // 写入confirmedPatternBase64s，绕过Phase1
      const regionTags = base64s.map(() => 'allover');
      setConfirmedPatterns(base64s, regionTags);
      addChatMessage({
        id: uuidv4(), role: 'system-success', timestamp: Date.now(),
        text: `✅ 已直接上传 ${base64s.length} 张花型图，可直接渲染铺床效果`, images: [],
      });
      showToast(`已上传 ${base64s.length} 张花型图`, 'success');
    });
  }, [setConfirmedPatterns, addChatMessage, showToast]);

  return (
    <>
      {/* 🔑 工作流解耦：直接上传花型图入口（跳过Phase1） */}
      {confirmedPatternBase64s.length === 0 && !mainRenderBase64 && (
        <div className="glass-card-static p-4 fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-amber-300 font-bold">📤 直接上传花型图 / 面料图</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">跳过提取</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-3">
            如果你已有现成的花型图或面料图，可以直接上传，无需从Phase1提取。
          </p>
          <label
            className="block border-2 border-dashed border-gray-600 rounded-xl p-6 text-center hover:border-indigo-400/50 cursor-pointer transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                handleDirectPatternUpload(files);
              }
            }}
          >
            <div className="text-3xl mb-2">🎨</div>
            <div className="text-sm text-gray-400">拖拽或点击上传花型图（最多3张）</div>
            <div className="text-[10px] text-gray-500 mt-1">支持 JPG/PNG，将自动压缩</div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) handleDirectPatternUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {/* 🔑 已确认花型预览（方便参考取色） */}
      {confirmedPatternBase64s.length > 0 && !mainRenderBase64 && (
        <div className="glass-card-static p-4 fade-in-up">
          <div className="text-xs text-gray-400 font-medium mb-2">🎨 已选花型（点击放大查看）</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {confirmedPatternBase64s.map((b64, i) => {
              const tag = confirmedPatternRegionTags[i] || 'allover';
              const isPillowcase = tag === 'pillowcase';
              const isDuvet = tag === 'duvet';
              return (
                <div
                  key={i}
                  className={`relative rounded-xl overflow-hidden cursor-pointer border-2 border-gray-700 hover:border-indigo-400 transition-all shadow-lg`}
                  onClick={() => openImageModal(b64)}
                >
                  <img
                    src={`data:image/png;base64,${b64}`}
                    alt={`花型 #${i + 1}`}
                    className={`w-full ${
                      isPillowcase ? 'aspect-[3/2] object-cover' : 'aspect-square object-cover'
                    }`}
                  />
                  {(isPillowcase || isDuvet) && (
                    <div
                      className={`absolute top-1.5 right-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.5)] pointer-events-none ${
                        isPillowcase
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                      style={{ zIndex: 10 }}
                    >
                      {isPillowcase ? '枕套' : '被套'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-gray-800/30">
            <span className="text-[10px]">🎯</span>
            <span className="text-[10px] text-gray-500">主色调：{extractedDominantColor ? `${extractedDominantColor.name} (${extractedDominantColor.hex})` : '未提取'}</span>
            {extractedDominantColor && (
              <span className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0" style={{ backgroundColor: extractedDominantColor.hex }} />
            )}
          </div>
        </div>
      )}

      {/* 效果图展示 + 操作 */}
      {mainRenderBase64 && (
        <div className="glass-card-static p-4 fade-in-up">
          <div className="text-xs text-gray-400 font-medium mb-2">🛏️ 铺床效果图</div>
          <img
            src={`data:image/png;base64,${mainRenderBase64}`}
            alt="铺床效果图"
            className="w-full max-h-80 object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openImageModal(mainRenderBase64)}
          />
          <div className="flex gap-2 mt-3">
            <button
              className="btn-primary flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 border-none shadow-[0_0_15px_rgba(99,102,241,0.5)] transform hover:scale-[1.01] transition-transform"
              onClick={handleToPhase3}
            >
              ✨ 进入一键营销出图 (主图+详情)
            </button>
          </div>
          {(mainImageResults.length > 0 || detailImageResults.length > 0) && (
            <div className="flex gap-2 mt-2">
              <button className="btn-secondary flex-1" onClick={() => setPhase(3)}>返回营销图生成 (Phase 3)</button>
            </div>
          )}
        </div>
      )}

      {/* 历史效果图 */}
      {historyRenders.length > 0 && !mainRenderBase64 && (
        <div className="glass-card-static p-4 fade-in-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">📂 历史效果图（点击快速跳步）</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">{historyRenders.length}张</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {historyRenders.slice(0, 8).map(r => (
              <div
                key={r.id}
                className="relative group rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-gray-600 transition-all"
                onClick={() => handleSelectHistoryRender(r)}
              >
                <img
                  src={`data:image/png;base64,${r.base64}`}
                  alt=""
                  className="w-full aspect-[3/4] object-cover"
                />
                {/* 🔑 Hover 浮层工具栏：加载 / 预览 / 删除 */}
                <ImageOverlayToolbar
                  compact
                  actions={[
                    {
                      icon: '✅',
                      label: '使用',
                      onClick: () => handleSelectHistoryRender(r),
                      variant: 'accent',
                    },
                    {
                      icon: '🔍',
                      label: '预览',
                      onClick: () => openImageModal(r.base64),
                    },
                    {
                      icon: '🗑️',
                      label: '删除',
                      onClick: async () => {
                        if (r.id !== undefined) {
                          await deleteRender(r.id);
                          // 刷新历史列表
                          const updated = await getRenderHistory();
                          setHistoryRenders(updated);
                          showToast('已删除历史效果图', 'info');
                        }
                      },
                      variant: 'danger',
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🔑 生成中 + 实时计时器 */}
      {isGenerating && (
        <div className="flex justify-start fade-in-up">
          <div className="chat-bubble-ai flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-400">AI 渲染中...</span>
            <span className="text-xs text-indigo-400 font-mono tabular-nums min-w-[50px]">⏱ {formatTimer(elapsedSeconds)}</span>
            <button className="text-xs text-red-400 hover:text-red-300 ml-1" onClick={handleCancel}>⏹ 取消</button>
          </div>
        </div>
      )}

      {/* 🔑 未选风格引导提示 */}
      {!style && !mainRenderBase64 && (
        <div className="glass-card-static p-4 fade-in-up">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <span className="text-2xl">👈</span>
            <div>
              <p className="text-sm text-amber-300 font-semibold">请先在左侧面板选择场景风格</p>
              <p className="text-[11px] text-gray-500 mt-0.5">AI 正在分析花型并推荐最适合的风格，也可以手动选择</p>
            </div>
          </div>
        </div>
      )}

      {/* 🔑 宽高比选择器 */}
      {!mainRenderBase64 && confirmedPatternBase64s.length > 0 && (
        <div className="glass-card-static p-3 fade-in-up">
          <div className="text-[11px] text-gray-400 font-medium mb-1.5">📐 输出宽高比</div>
          <AspectRatioSelector
            value={renderAspectRatio}
            onChange={setRenderAspectRatio}
          />
        </div>
      )}

      {/* 底部操作栏 */}
      <div data-action-bar="phase2" className="flex gap-2">
        <input
          type="text"
          className="input-glass flex-1"
          placeholder="输入附加要求（可选）..."
          value={additionalPrompt}
          onChange={(e) => setAdditionalPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleRender()}
        />
        <button
          className={`whitespace-nowrap ${style ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed'}`}
          disabled={isGenerating || confirmedPatternBase64s.length === 0 || !style}
          onClick={handleRender}
          title={!style ? '请先选择场景风格' : ''}
        >
          {!style ? '⚠️ 请先选择风格' : '🛏️ 渲染铺床效果'}
        </button>
      </div>
    </>
  );
}
