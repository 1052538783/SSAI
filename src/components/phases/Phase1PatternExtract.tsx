/**
 * Phase 1 — 花型提取（业务逻辑 + UI）
 * 支持：多轮对话编辑、ThoughtSignature回传、历史加载、单张花型微调
 * 🔑 历史花型在中心区域醒目展示，可勾选后点击"进入下一步"
 * 🔑 历史花型也支持选中后输入提示词进行编辑/微调
 * 🔑 AI 改进建议（3张卡片式建议 + 中英双语 + 点击应用）
 * 🔑 AI 生成中显示实时计时器
 * 🔑 Hover 浮层工具栏替代微小按钮
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useLogStore } from '../../stores/useLogStore';
import { callGeminiApi } from '../../services/gemini';
import { contextManager } from '../../services/contextManager';
import { buildPatternPrompt } from '../../services/promptEngine';
import { extractDominantColor, rotateImage90, trimWhiteBorder } from '../../services/imageUtils';
import { DEFAULT_TEMPERATURES, DEFAULT_ASPECT_RATIOS } from '../../config/models';
import { savePattern, getPatternHistory, deletePattern as deletePatternFromDB, type PatternRecord } from '../../db/dexieDB';
import ImageOverlayToolbar from '../common/ImageOverlayToolbar';
import { v4 as uuidv4 } from 'uuid';
import type { GeminiRequestBody } from '../../types/api';
import type { PatternSuggestion } from '../../types/state';

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  openImageModal: (base64: string) => void;
}

export default function Phase1PatternExtract({ showToast, openImageModal }: Props) {
  const {
    apiKey, bailianApiKey, isGenerating, uploadedImages, additionalPrompt,
    patternType, extractionMode, generatedPatterns, selectedPatternIndices,
    outputResolution, extractionTargets, analysisModelId,
    patternSuggestions, isSuggestionsLoading,
    setIsGenerating, addChatMessage,
    addGeneratedPattern, setConfirmedPatterns, setDominantColor,
    setPhase, setAdditionalPrompt, togglePatternSelection,
    deletePattern, editTargetPatternIndex, setEditTarget, updatePattern,
    setPatternSuggestions, setIsSuggestionsLoading,
  } = useAppStore();

  const { addLog } = useLogStore();
  const abortRef = useRef<AbortController | null>(null);

  // 历史花型
  const [historyPatterns, setHistoryPatterns] = useState<PatternRecord[]>([]);
  // 历史花型选中状态
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(new Set());
  // 🔑 历史花型编辑模式：选中的历史花型ID（用于微调）
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);

  // 🔑 生成计时器
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 计时器：生成开始时启动，结束时停止
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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGenerating]);

  // 加载历史
  useEffect(() => {
    getPatternHistory().then(setHistoryPatterns).catch(console.error);
  }, [generatedPatterns.length]);

  // 切换历史花型选择
  const toggleHistorySelection = useCallback((id: number) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 从历史选择花型 → 快速跳步 Phase 2
  const handleHistoryConfirm = useCallback(async () => {
    const selected = historyPatterns.filter(r => r.id !== undefined && selectedHistoryIds.has(r.id));
    if (selected.length === 0) {
      showToast('请先勾选至少一个历史花型', 'error');
      return;
    }

    const base64s = selected.map(r => r.base64);
    const regionTags = selected.map(r => r.regionTag);
    setConfirmedPatterns(base64s, regionTags);

    try {
      const color = await extractDominantColor(base64s[0]);
      setDominantColor(color);
    } catch {
      setDominantColor(null);
    }

    addChatMessage({
      id: uuidv4(), role: 'system-success', timestamp: Date.now(),
      text: `✅ 从历史加载 ${selected.length} 个花型 → 进入铺床渲染`, images: [],
    });
    contextManager.clear();
    setPhase(2);
    showToast('已从历史加载花型，进入渲染', 'success');
  }, [historyPatterns, selectedHistoryIds, setConfirmedPatterns, setDominantColor, setPhase, addChatMessage, showToast]);

  // 🔑 历史花型微调编辑：选中一张历史花型 + 输入提示词 → 生成修改版
  const handleEditHistoryPattern = useCallback(async () => {
    if (!apiKey || isGenerating || editingHistoryId === null) return;
    const record = historyPatterns.find(r => r.id === editingHistoryId);
    if (!record) return;
    const editPrompt = additionalPrompt.trim();
    if (!editPrompt) {
      showToast('请输入修改指令（如"颜色更深一些"、"花朵更大"）', 'info');
      return;
    }

    setIsGenerating(true);
    addChatMessage({
      id: uuidv4(), role: 'user', timestamp: Date.now(),
      text: `基于历史花型微调：${editPrompt}`,
      images: [record.base64],
    });

    try {
      const prompt = `Edit this pattern image based on the instruction: "${editPrompt}". Keep the overall design style, color palette, and pattern structure intact. Only apply the requested modification.\n\nGenerate the image directly.`;

      const requestBody: GeminiRequestBody = {
        contents: [{
          role: 'user' as const,
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: record.base64 } },
          ],
        }],
        generationConfig: {
          temperature: DEFAULT_TEMPERATURES.conversationalEdit,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: DEFAULT_ASPECT_RATIOS.pattern,
            imageSize: outputResolution,
          },
        },
      };

      abortRef.current = new AbortController();
      const result = await callGeminiApi({
        apiKey, requestBody, modelType: 'image', phase: 1,
        signal: abortRef.current.signal, onLog: addLog,
      });

      if (result.success && result.images.length > 0) {
        addChatMessage({
          id: uuidv4(), role: 'ai', timestamp: Date.now(),
          text: result.text || '✅ 花型微调完成',
          images: result.images,
        });

        const newIndex = generatedPatterns.length;
        const dbId = await savePattern(result.images[0], newIndex, 'allover');
        addGeneratedPattern({
          id: uuidv4(), index: newIndex, base64: result.images[0],
          regionTag: 'allover', dbId, selected: false, deleted: false,
        });
        showToast('✅ 花型微调完成', 'success');
        setEditingHistoryId(null);
        fetchSuggestions(result.images[0]);
      } else {
        showToast(`微调失败: ${result.error}`, 'error');
      }
    } catch (e) {
      showToast(`微调错误: ${(e as Error).message}`, 'error');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [apiKey, isGenerating, editingHistoryId, historyPatterns, additionalPrompt, outputResolution, generatedPatterns, addChatMessage, addGeneratedPattern, setIsGenerating, addLog, showToast]);

  // ============================================================
  // AI 改进建议获取 — 🔑 中英双语
  // ============================================================
  const fetchSuggestions = useCallback(async (patternBase64: string) => {
    if (!apiKey) return;
    setIsSuggestionsLoading(true);
    setPatternSuggestions([]);

    try {
      const result = await callGeminiApi({
        apiKey,
        bailianApiKey,
        requestBody: {
          contents: [{
            role: 'user',
            parts: [
              {
                text: `你是一位家纺花型设计专家。分析这张花型图案，给出3个具体的改进建议和创新方向。

请严格以JSON格式回复，不要添加其他文字：
{
  "suggestions": [
    {
      "title": "建议标题（4-6个中文字）",
      "description": "简短描述这个改进方向的具体效果（15-25个中文字）",
      "prompt": "中英双语修改指令，格式为：中文描述 | English instruction for AI image generation"
    }
  ]
}

示例 prompt 格式："降低碎花密度，增加留白 | Reduce floral density by 30%, add more negative space"

建议方向参考（请根据实际图案给出针对性建议）：
- 密度/留白调整
- 色调/配色优化
- 元素风格变化
- 构图/布局改进
- 材质/纹理增强`
              },
              { inlineData: { mimeType: 'image/png', data: patternBase64 } },
            ],
          }],
          generationConfig: { temperature: DEFAULT_TEMPERATURES.textAnalysis },
        },
        modelType: 'text',
        textModelId: analysisModelId,
        phase: 1,
        timeoutMs: 60000,
        onLog: addLog,
      });

      if (result.success && result.text) {
        try {
          const jsonMatch = result.text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
              const suggestions: PatternSuggestion[] = parsed.suggestions.slice(0, 3).map(
                (s: { title: string; description: string; prompt: string }, i: number) => ({
                  id: `sug-${Date.now()}-${i}`,
                  title: s.title || `建议 ${i + 1}`,
                  description: s.description || '',
                  prompt: s.prompt || '',
                })
              );
              setPatternSuggestions(suggestions);
            }
          }
        } catch {
          console.warn('[织梦AI] AI建议JSON解析失败，跳过');
        }
      }
    } catch (e) {
      console.error('[织梦AI] 获取建议失败:', e);
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [apiKey, bailianApiKey, analysisModelId, addLog, setPatternSuggestions, setIsSuggestionsLoading]);

  // ============================================================
  // 花型提取（支持多轮 + 🔑 双目标分轮提取）
  // ============================================================

  /**
   * 🔑 内部辅助：执行单次花型提取 API 调用
   * @param targetId  区域标识（allover / duvet / pillowcase）
   * @param extraRequest  用户附加提示词
   * @param temperature  生成温度
   * @returns 提取到的图片数量
   */
  const extractSingleTarget = useCallback(async (
    targetId: 'allover' | 'duvet' | 'pillowcase',
    extraRequest: string,
    temperature: number,
  ): Promise<number> => {
    const storeState = useAppStore.getState();

    // 构建 prompt
    let promptText: string;
    if (storeState.userModifiedPrompt && storeState.editedPromptStructure) {
      promptText = [
        storeState.editedPromptStructure,
        storeState.editedPromptStyle,
        storeState.editedPromptNegative ? `NEGATIVE: ${storeState.editedPromptNegative}` : '',
      ].filter(Boolean).join('\n\n');
    } else {
      promptText = buildPatternPrompt({
        patternType,
        extractionMode,
        extraRequest: extraRequest || undefined,
        targetId,
        isInitialDraft: contextManager.length === 0,
      });
    }

    const userParts: any[] = [{ text: promptText }];
    uploadedImages.forEach(img => {
      userParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    });

    let contents;
    if (contextManager.length > 0) {
      contents = contextManager.buildRequestContents(
        promptText,
        uploadedImages.map(img => ({ mimeType: img.mimeType, data: img.base64 }))
      );
    } else {
      contents = [{ role: 'user' as const, parts: userParts }];
    }

    // 🔑 枕套使用 3:2 宽高比，其余使用 1:1
    const aspectRatio = targetId === 'pillowcase'
      ? DEFAULT_ASPECT_RATIOS.patternPillowcase
      : DEFAULT_ASPECT_RATIOS.pattern;

    const regionLabel = targetId === 'pillowcase' ? '枕套' : targetId === 'duvet' ? '被套' : '花型';

    const requestBody: GeminiRequestBody = {
      contents,
      generationConfig: {
        temperature,
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize: outputResolution,
        },
      },
    };

    abortRef.current = new AbortController();

    addChatMessage({
      id: uuidv4(), role: 'system', timestamp: Date.now(),
      text: `⏳ 正在提取${regionLabel}花型... (温度=${temperature}, 宽高比=${aspectRatio}${contextManager.length > 0 ? ', 多轮第' + Math.ceil(contextManager.length / 2 + 1) + '轮' : ''})`,
      images: [],
    });

    const result = await callGeminiApi({
      apiKey, requestBody, modelType: 'image', phase: 1,
      timeoutMs: 180_000, // 3 分钟，花型提取（特别是枕套）需要更多时间
      signal: abortRef.current.signal, onLog: addLog,
    });

    if (result.success) {
      contextManager.updateFromResponse(requestBody.contents, result.modelParts);

      addChatMessage({
        id: uuidv4(), role: 'ai', timestamp: Date.now(),
        text: result.text || '',
        images: result.images,
      });

      // 🔑 使用实际 targetId 作为 regionTag（而非写死 'allover'）
      // 🔑 后处理：自动裁剪纯色边框（BUG 1 修复）
      const currentPatterns = useAppStore.getState().generatedPatterns;
      for (let i = 0; i < result.images.length; i++) {
        const trimmed = await trimWhiteBorder(result.images[i]);
        const patternIndex = currentPatterns.length + i;
        const dbId = await savePattern(trimmed, patternIndex, targetId);
        addGeneratedPattern({
          id: uuidv4(), index: patternIndex,
          base64: trimmed, regionTag: targetId,
          dbId, selected: false, deleted: false,
        });
      }

      if (result.images.length > 0) {
        fetchSuggestions(result.images[0]);
      }

      return result.images.length;
    } else {
      addChatMessage({
        id: uuidv4(), role: 'system', timestamp: Date.now(),
        text: `❌ ${regionLabel}花型提取失败: ${result.error}`, images: [],
      });
      showToast(`${regionLabel}花型提取失败: ${result.error}`, 'error');
      return 0;
    }
  }, [apiKey, uploadedImages, patternType, extractionMode, outputResolution, addChatMessage, addGeneratedPattern, addLog, showToast, fetchSuggestions]);

  const handleExtract = useCallback(async () => {
    if (!apiKey || uploadedImages.length === 0 || isGenerating) return;
    setIsGenerating(true);
    const extraRequest = additionalPrompt.trim();

    addChatMessage({
      id: uuidv4(), role: 'user', timestamp: Date.now(),
      text: `提取花型${extraRequest ? `（${extraRequest}）` : ''}`,
      images: uploadedImages.slice(0, 2).map(img => img.base64),
    });

    try {
      // 🔑 根据提取模式选择温度
      const temperature = patternType === 'allover'
        ? (extractionMode === 'faithful' ? DEFAULT_TEMPERATURES.patternFaithful : DEFAULT_TEMPERATURES.patternAllover)
        : DEFAULT_TEMPERATURES.patternEmbroidery;

      // 🔑 构建提取目标列表 — 支持双目标分轮提取
      let targets: Array<'allover' | 'duvet' | 'pillowcase'>;
      if (patternType === 'embroidery') {
        targets = [];
        if (extractionTargets.duvet) targets.push('duvet');
        if (extractionTargets.pillowcase) targets.push('pillowcase');
        // 安全回退：如果没有勾选任何目标，至少提取一个 allover
        if (targets.length === 0) targets = ['allover'];
      } else {
        targets = ['allover'];
      }

      let totalExtracted = 0;
      for (const targetId of targets) {
        const count = await extractSingleTarget(targetId, extraRequest, temperature);
        totalExtracted += count;
      }

      if (totalExtracted > 0) {
        showToast(`✅ 成功提取 ${totalExtracted} 个花型 (${elapsedSeconds}秒)`, 'success');
      } else {
        showToast('⚠️ 模型未返回图片，请调整提示词重试', 'info');
      }
    } catch (e) {
      showToast(`意外错误: ${(e as Error).message}`, 'error');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [apiKey, uploadedImages, isGenerating, additionalPrompt, patternType, extractionMode, extractionTargets, outputResolution, elapsedSeconds, addChatMessage, setIsGenerating, showToast, extractSingleTarget]);

  // ============================================================
  // 单张花型微调编辑
  // ============================================================
  const handleEditSinglePattern = useCallback(async (patternIndex: number) => {
    if (!apiKey || isGenerating) return;
    const p = generatedPatterns.find(p => p.index === patternIndex);
    if (!p) return;
    const editPrompt = additionalPrompt.trim();
    if (!editPrompt) {
      showToast('请输入微调指令（如"颜色更深一些"）', 'info');
      return;
    }

    setIsGenerating(true);
    addChatMessage({
      id: uuidv4(), role: 'user', timestamp: Date.now(),
      text: `微调花型 #${patternIndex + 1}：${editPrompt}`,
      images: [p.base64],
    });

    try {
      const prompt = `Edit this pattern image based on the instruction: "${editPrompt}". Keep the overall design style, color palette, and pattern structure intact. Only apply the requested modification.\n\nGenerate the image directly.`;

      const requestBody: GeminiRequestBody = {
        contents: contextManager.buildRequestContents(
          prompt,
          [{ mimeType: 'image/png', data: p.base64 }]
        ),
        generationConfig: {
          temperature: DEFAULT_TEMPERATURES.conversationalEdit,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: DEFAULT_ASPECT_RATIOS.pattern,
            imageSize: outputResolution,
          },
        },
      };

      abortRef.current = new AbortController();
      const result = await callGeminiApi({
        apiKey, requestBody, modelType: 'image', phase: 1,
        signal: abortRef.current.signal, onLog: addLog,
      });

      if (result.success && result.images.length > 0) {
        contextManager.updateFromResponse(requestBody.contents, result.modelParts);
        addChatMessage({
          id: uuidv4(), role: 'ai', timestamp: Date.now(),
          text: result.text || `✅ 花型 #${patternIndex + 1} 微调完成`,
          images: result.images,
        });

        const newIndex = generatedPatterns.length;
        const dbId = await savePattern(result.images[0], newIndex, 'allover');
        addGeneratedPattern({
          id: uuidv4(), index: newIndex, base64: result.images[0],
          regionTag: 'allover', dbId, selected: false, deleted: false,
        });
        showToast('✅ 花型微调完成', 'success');
        fetchSuggestions(result.images[0]);
      } else {
        showToast(`微调失败: ${result.error}`, 'error');
      }
    } catch (e) {
      showToast(`微调错误: ${(e as Error).message}`, 'error');
    } finally {
      setIsGenerating(false);
      setEditTarget(null);
      abortRef.current = null;
    }
  }, [apiKey, isGenerating, generatedPatterns, additionalPrompt, outputResolution, addChatMessage, addGeneratedPattern, setIsGenerating, setEditTarget, addLog, showToast, fetchSuggestions]);

  // 应用 AI 建议
  // 🔑 清除多轮上下文后再生成，避免携带庞大的历史base64导致请求极慢
  const handleApplySuggestion = useCallback((suggestion: PatternSuggestion) => {
    // 清除多轮上下文 → 让 handleExtract 走全新请求路径（不携带历史图片）
    contextManager.clear();
    setAdditionalPrompt(suggestion.prompt);
    showToast(`💡 已应用建议：${suggestion.title}，正在生成...`, 'info');
    setTimeout(() => {
      const state = useAppStore.getState();
      if (state.apiKey && state.uploadedImages.length > 0 && !state.isGenerating) {
        handleExtract();
      }
    }, 100);
  }, [setAdditionalPrompt, showToast, handleExtract]);

  // 确认当前生成的花型 → Phase 2
  const handleConfirm = useCallback(async () => {
    const selected = generatedPatterns.filter(p =>
      selectedPatternIndices.includes(p.index) && !p.deleted
    );
    if (selected.length === 0) {
      showToast('请先选择至少一个花型', 'error');
      return;
    }
    const base64s = selected.map(p => p.base64);
    const regionTags = selected.map(p => p.regionTag);
    setConfirmedPatterns(base64s, regionTags);

    try {
      const color = await extractDominantColor(base64s[0]);
      setDominantColor(color);
      addChatMessage({
        id: uuidv4(), role: 'system-success', timestamp: Date.now(),
        text: `✅ 已确认 ${selected.length} 个花型，主色调：${color.name} (${color.hex})`,
        images: [],
      });
    } catch {
      setDominantColor(null);
    }

    contextManager.clear();
    setPhase(2);
    showToast('进入铺床渲染阶段', 'success');
  }, [generatedPatterns, selectedPatternIndices, setConfirmedPatterns, setDominantColor, setPhase, addChatMessage, showToast]);

  // 取消
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    showToast('已取消', 'info');
  }, [setIsGenerating, showToast]);

  // 格式化计时器显示
  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}分${sec.toString().padStart(2, '0')}秒` : `${sec}秒`;
  };

  const activePatterns = generatedPatterns.filter(p => !p.deleted);

  return (
    <>
      {/* ============================================================
          🔑 历史花型区域 — 醒目展示 + 勾选 + 编辑微调 + 进入下一步
          ============================================================ */}
      {historyPatterns.length > 0 && activePatterns.length === 0 && !isGenerating && (
        <div className="glass-card-static p-5 fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📂</span>
              <span className="text-sm font-bold text-gray-200">历史花型</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">{historyPatterns.length}张</span>
            </div>
            {selectedHistoryIds.size > 0 && (
              <span className="text-xs text-indigo-400">
                已选 {selectedHistoryIds.size} 个
              </span>
            )}
          </div>

          {/* 🔑 操作引导提示 */}
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
            <span className="text-base">👆</span>
            <div className="flex-1">
              <p className="text-xs text-indigo-300 font-medium">
                {editingHistoryId !== null
                  ? '✏️ 微调模式：在下方输入框写修改指令，点击「微调花型」即可生成修改版'
                  : '点击选择花型 → 进入下一步铺床渲染，或点击 ✏️ 按钮微调花型'
                }
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {editingHistoryId !== null
                  ? '例如：颜色更鲜艳、花朵更大、增加叶子元素、换成蓝色调...'
                  : '无需重新生成，直接从历史花型中选取使用'
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {historyPatterns.map(r => {
              const isSelected = r.id !== undefined && selectedHistoryIds.has(r.id);
              const isEditing = r.id === editingHistoryId;
              const isHistPillowcase = r.regionTag === 'pillowcase';
              const isHistDuvet = r.regionTag === 'duvet';
              return (
                <div
                  key={r.id}
                  className={`relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    isEditing
                      ? 'border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                      : isSelected
                        ? 'border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                        : 'border-transparent hover:border-gray-600'
                  }`}
                  onClick={() => {
                    if (editingHistoryId !== null) {
                      setEditingHistoryId(r.id ?? null);
                    } else {
                      r.id !== undefined && toggleHistorySelection(r.id);
                    }
                  }}
                >
                  <img
                    src={`data:image/png;base64,${r.base64}`}
                    alt=""
                    className={`w-full ${
                      isHistPillowcase ? 'aspect-[3/2] object-cover' : 'aspect-square object-cover'
                    }`}
                  />
                  {/* 区域标签 */}
                  {(isHistPillowcase || isHistDuvet) && (
                    <div
                      className={`absolute top-1.5 right-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.5)] pointer-events-none ${
                        isHistPillowcase
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                      style={{ zIndex: 10 }}
                    >
                      {isHistPillowcase ? '枕套' : '被套'}
                    </div>
                  )}
                  {/* 选中/编辑标记 */}
                  {isEditing && (
                    <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-yellow-500 text-white text-xs flex items-center justify-center font-bold shadow-lg z-10">✏</div>
                  )}
                  {isSelected && !isEditing && (
                    <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold shadow-lg z-10">✓</div>
                  )}
                  {/* Hover 浮层工具栏 */}
                  <ImageOverlayToolbar
                    compact
                    actions={[
                      {
                        icon: isSelected ? '✓' : '☐',
                        label: isSelected ? '取消' : '选择',
                        onClick: () => r.id !== undefined && toggleHistorySelection(r.id),
                        variant: isSelected ? 'accent' : 'default',
                      },
                      {
                        icon: '✏️',
                        label: '微调',
                        onClick: () => {
                          setEditingHistoryId(r.id ?? null);
                          showToast('请在下方输入修改指令', 'info');
                        },
                      },
                      {
                        icon: '🔄',
                        label: '旋转',
                        onClick: async () => {
                          if (r.id === undefined) return;
                          try {
                            const rotated = await rotateImage90(r.base64);
                            // 更新历史花型列表中的图片
                            setHistoryPatterns(prev =>
                              prev.map(hp => hp.id === r.id ? { ...hp, base64: rotated } : hp)
                            );
                            showToast('已顺时针旋转 90°', 'info');
                          } catch {
                            showToast('旋转失败', 'error');
                          }
                        },
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
                            await deletePatternFromDB(r.id);
                            setSelectedHistoryIds(prev => {
                              const next = new Set(prev);
                              next.delete(r.id!);
                              return next;
                            });
                            if (editingHistoryId === r.id) setEditingHistoryId(null);
                            const updated = await getPatternHistory();
                            setHistoryPatterns(updated);
                            showToast('已删除历史花型', 'info');
                          }
                        },
                        variant: 'danger',
                      },
                    ]}
                  />
                </div>
              );
            })}
          </div>

          {/* 🔑 历史花型微调输入区 */}
          {editingHistoryId !== null && (
            <div className="mt-4 flex gap-2 fade-in-up">
              <input
                type="text"
                className="input-glass flex-1"
                placeholder="输入修改指令（如：颜色更鲜艳、花朵更大、换成蓝色调...）"
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleEditHistoryPattern()}
              />
              <button
                className="btn-primary whitespace-nowrap"
                disabled={isGenerating || !additionalPrompt.trim()}
                onClick={handleEditHistoryPattern}
              >
                ✏️ 微调花型
              </button>
              <button
                className="btn-secondary whitespace-nowrap text-xs"
                onClick={() => setEditingHistoryId(null)}
              >
                取消
              </button>
            </div>
          )}

          {/* 🔑 进入下一步按钮 — 仅在非编辑模式且有选中时显示 */}
          {selectedHistoryIds.size > 0 && editingHistoryId === null && (
            <button
              className="btn-primary w-full mt-4 text-base py-3"
              onClick={handleHistoryConfirm}
            >
              ✅ 使用选中的 {selectedHistoryIds.size} 个花型 → 进入铺床渲染
            </button>
          )}
        </div>
      )}

      {/* ============================================================
          当前生成的花型选择网格
          ============================================================ */}
      {activePatterns.length > 0 && (
        <div className="glass-card-static p-4 fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-medium">🎨 生成的花型</span>
            {editTargetPatternIndex !== null && (
              <span className="text-[10px] text-yellow-400 animate-pulse">✏️ 微调模式 — 输入修改指令后点击花型应用</span>
            )}
          </div>

          {/* 🔑 选择引导提示 — 未选择花型时醒目显示 */}
          {selectedPatternIndices.length === 0 && (
            <div className="flex items-center gap-2 mb-3 p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
              <span className="text-lg animate-bounce" style={{ animationDuration: '2s' }}>👇</span>
              <div>
                <p className="text-xs text-cyan-300 font-semibold">请点击选择花型，进入下一步铺床渲染</p>
                <p className="text-[10px] text-gray-500 mt-0.5">可多选，选中后下方会出现「→ 进入铺床渲染」按钮</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {activePatterns.map(p => {
              const isPillowcase = p.regionTag === 'pillowcase';
              const isDuvet = p.regionTag === 'duvet';
              return (
              <div
                key={p.index}
                className={`relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                  selectedPatternIndices.includes(p.index)
                    ? 'border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                    : editTargetPatternIndex === p.index
                      ? 'border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                      : 'border-transparent hover:border-gray-600'
                }`}
                onClick={() => {
                  if (editTargetPatternIndex !== null) {
                    handleEditSinglePattern(p.index);
                  } else {
                    togglePatternSelection(p.index);
                  }
                }}
              >
                <img
                  src={`data:image/png;base64,${p.base64}`}
                  alt={`花型 #${p.index + 1}`}
                  className={`w-full ${
                    isPillowcase ? 'aspect-[3/2] object-cover' : 'aspect-square object-cover'
                  }`}
                />
                {selectedPatternIndices.includes(p.index) && (
                  <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold shadow-lg">✓</div>
                )}
                {/* 🔑 区域标签徽章 — 被套/枕套 */}
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
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-[10px] text-gray-300 text-center py-0.5 pointer-events-none" style={{ zIndex: 5 }}>
                  #{p.index + 1}
                </div>
                <ImageOverlayToolbar
                  compact
                  actions={[
                    {
                      icon: selectedPatternIndices.includes(p.index) ? '✓' : '☐',
                      label: selectedPatternIndices.includes(p.index) ? '取消选择' : '选择',
                      onClick: () => togglePatternSelection(p.index),
                      variant: selectedPatternIndices.includes(p.index) ? 'accent' : 'default',
                    },
                    {
                      icon: '✏️',
                      label: '微调',
                      onClick: () => { setEditTarget(p.index); showToast('输入微调指令后点击花型应用', 'info'); },
                    },
                    {
                      icon: '🔄',
                      label: '旋转',
                      onClick: async () => {
                        try {
                          const rotated = await rotateImage90(p.base64);
                          updatePattern(p.index, { base64: rotated });
                          showToast('已顺时针旋转 90°', 'info');
                        } catch {
                          showToast('旋转失败', 'error');
                        }
                      },
                    },
                    {
                      icon: '🔍',
                      label: '放大',
                      onClick: () => openImageModal(p.base64),
                    },
                    {
                      icon: '🗑️',
                      label: '删除',
                      onClick: () => deletePattern(p.index),
                      variant: 'danger',
                    },
                  ]}
                />
              </div>
            );})}
          </div>

          {/* 确认按钮 — 选中后显示 */}
          {selectedPatternIndices.length > 0 && (
            <button className="btn-primary w-full mt-3 text-base py-3" onClick={handleConfirm}>
              ✅ 确认选中 ({selectedPatternIndices.length}) → 进入铺床渲染
            </button>
          )}
        </div>
      )}

      {/* AI 改进建议卡片 — 🔑 中英双语 */}
      {(patternSuggestions.length > 0 || isSuggestionsLoading) && (
        <div className="glass-card-static p-4 fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400 font-medium">💡 AI 改进建议</span>
            {isSuggestionsLoading && (
              <span className="text-[10px] text-indigo-400 animate-pulse">分析中...</span>
            )}
            <span className="text-[10px] text-gray-500">点击卡片可直接应用</span>
          </div>

          {isSuggestionsLoading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 h-24 rounded-xl bg-gray-800/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {patternSuggestions.map((sug, i) => (
                <div
                  key={sug.id}
                  className="suggestion-card"
                  onClick={() => handleApplySuggestion(sug)}
                >
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{['🎯', '🎨', '✨'][i] || '💡'}</span>
                      <span className="text-sm font-semibold text-gray-200">{sug.title}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed mb-1">{sug.description}</p>
                    {/* 🔑 中英双语提示词预览 */}
                    <p className="text-[10px] text-gray-500 italic truncate">{sug.prompt}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-400 font-medium">
                      <span>点击应用 →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🔑 生成中动画 + 实时计时器 */}
      {isGenerating && (
        <div className="flex justify-start fade-in-up">
          <div className="chat-bubble-ai flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-400">AI 生成中...</span>
            {/* 🔑 计时器 */}
            <span className="text-xs text-indigo-400 font-mono tabular-nums min-w-[50px]">
              ⏱ {formatTimer(elapsedSeconds)}
            </span>
            <button className="text-xs text-red-400 hover:text-red-300 ml-1" onClick={handleCancel}>⏹ 取消</button>
          </div>
        </div>
      )}

      {/* 底部操作栏 */}
      <div data-action-bar="phase1" className="flex gap-2">
        <input
          type="text"
          className="input-glass flex-1"
          placeholder={
            editTargetPatternIndex !== null ? '输入微调指令（如：颜色更深、花更大）...'
              : editingHistoryId !== null ? '输入修改指令（如：换成蓝色调、增加留白）...'
                : '输入附加要求（可选）...'
          }
          value={additionalPrompt}
          onChange={(e) => setAdditionalPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              if (editingHistoryId !== null) handleEditHistoryPattern();
              else handleExtract();
            }
          }}
        />
        {editingHistoryId !== null ? (
          <button
            className="btn-primary whitespace-nowrap"
            disabled={isGenerating || !additionalPrompt.trim()}
            onClick={handleEditHistoryPattern}
          >
            ✏️ 微调花型
          </button>
        ) : (
          <button
            className="btn-primary whitespace-nowrap"
            disabled={isGenerating || uploadedImages.length === 0}
            onClick={handleExtract}
          >
            {contextManager.length > 0 ? '🔄 继续生成' : '🎨 提取花型'}
          </button>
        )}
      </div>
    </>
  );
}
