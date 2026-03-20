/**
 * Phase 3 — 营销出图 (主图 + 详情图) 一键直出
 * 支持主图和详情图的参考图分别上传，自动抓取面料生成专属营销文案
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useLogStore } from '../../stores/useLogStore';
import { callGeminiApi, runConcurrentPool, generateContent } from '../../services/gemini';
import { buildMaterialPrompt, buildSingleImageOptimizePrompt, buildSingleRefAnalysisPrompt, buildSingleDetailRefAnalysisPrompt } from '../../services/promptEngine';
import { compileToonToText, fuseToonWithUserAssets } from '../../services/toonCompiler';
import { parseRobustJson, validateToonData } from '../../services/jsonParser';
import type { ToonData } from '../../types/toonSchema';
import { DEFAULT_TEMPERATURES, MATERIAL_API_TIMEOUT_MS } from '../../config/models';
import { MAIN_IMAGE_MODULES, DETAIL_PAGE_MODULES, getFabricSourcePrompt } from '../../config/materials';
import { FABRIC_MARKETING_DICT } from '../../config/fabrics';
import ImageOverlayToolbar from '../common/ImageOverlayToolbar';
import AspectRatioSelector from '../common/AspectRatioSelector';
import ProductCustomizer from './ProductCustomizer';
import { v4 as uuidv4 } from 'uuid';
import { getRenderHistory, type RenderRecord } from '../../db/dexieDB';
import type { GeminiRequestBody } from '../../types/api';
import type { UploadedImage } from '../../types/state';

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  openImageModal: (base64: string) => void;
}

export default function Phase3MaterialLibrary({ showToast, openImageModal }: Props) {
  const {
    apiKey, bailianApiKey, mainRenderBase64, outputResolution, fabric, style,
    mainImageResults, detailImageResults, isMarketingGenerating,
    mainImageAspectRatio, detailImageAspectRatio,
    setMainImageResults, updateMainImageResult, setDetailImageResults, updateDetailImageResult, setIsMarketingGenerating,
    mainImageRefs, detailImageRefs, setMainImageRefs, setDetailImageRefs,
    setMainImageAspectRatio, setDetailImageAspectRatio,
    userModifiedPrompt, editedPromptStructure, editedPromptStyle, editedPromptNegative,
    setMainRenderBase64, addChatMessage, upsertChatMessage,
    extractedDominantColor,
    analysisModelId, productCustomization, setProductCustomization,
    addMainRound, addDetailRound,
    analyzedMainRefIds, analyzedDetailRefIds, markRefsAnalyzed,
    clearMainImageResult, clearDetailImageResult,
    loadProductCustomization,
  } = useAppStore();

  // 🔑 历史铺床效果图
  const [historyRenders, setHistoryRenders] = useState<RenderRecord[]>([]);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  useEffect(() => {
    getRenderHistory().then(setHistoryRenders).catch(console.error);
  }, [mainRenderBase64]);

  // 🔑 v2.1: 页面加载时恢复持久化的productCustomization
  useEffect(() => {
    loadProductCustomization();
  }, [loadProductCustomization]);

  // 🔑 根据参考图推荐宽高比（前端计算，不消耗 API）
  const [recommendedMainRatio, setRecommendedMainRatio] = useState<string | null>(null);
  const [recommendedDetailRatio, setRecommendedDetailRatio] = useState<string | null>(null);

  // 分析图片宽高比并推荐最接近的标准比例
  const analyzeImageRatio = useCallback((base64: string, mimeType: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const ratio = width / height;
        // 匹配最近的标准比例
        const standards = [
          { value: '1:1', ratio: 1 },
          { value: '3:4', ratio: 0.75 },
          { value: '4:3', ratio: 1.333 },
          { value: '16:9', ratio: 1.778 },
          { value: '9:16', ratio: 0.5625 },
        ];
        let closest = standards[0];
        let minDiff = Math.abs(ratio - closest.ratio);
        for (const s of standards) {
          const diff = Math.abs(ratio - s.ratio);
          if (diff < minDiff) { minDiff = diff; closest = s; }
        }
        resolve(closest.value);
      };
      img.onerror = () => resolve('1:1');
      img.src = `data:${mimeType};base64,${base64}`;
    });
  }, []);

  // 上传参考图时自动推荐宽高比
  useEffect(() => {
    if (mainImageRefs.length > 0) {
      const firstRef = mainImageRefs[0];
      analyzeImageRatio(firstRef.base64, firstRef.mimeType).then(setRecommendedMainRatio);
    } else {
      setRecommendedMainRatio(null);
    }
  }, [mainImageRefs, analyzeImageRatio]);

  useEffect(() => {
    if (detailImageRefs.length > 0) {
      const firstRef = detailImageRefs[0];
      analyzeImageRatio(firstRef.base64, firstRef.mimeType).then(setRecommendedDetailRatio);
    } else {
      setRecommendedDetailRatio(null);
    }
  }, [detailImageRefs, analyzeImageRatio]);

  const mainModules = MAIN_IMAGE_MODULES.filter(m => m.enabled);
  const detailModules = DETAIL_PAGE_MODULES.filter(m => m.enabled);

  // 初始化“骨架”网格
  useEffect(() => {
    if (mainRenderBase64) {
      const mainKeysMatch = mainImageResults.length === mainModules.length && mainImageResults.every((r, i) => r.key === mainModules[i].key);
      if (!mainKeysMatch) {
         setMainImageResults(mainModules.map((m, idx) => ({ key: m.key, base64: null, status: 'idle', sortOrder: idx })));
      }

      const detailKeysMatch = detailImageResults.length === detailModules.length && detailImageResults.every((r, i) => r.key === detailModules[i].key);
      if (!detailKeysMatch) {
         setDetailImageResults(detailModules.map((m, idx) => ({ key: m.key, base64: null, status: 'idle', sortOrder: idx })));
      }
    }
  }, [mainRenderBase64, mainImageResults.length, detailImageResults.length, setMainImageResults, setDetailImageResults, mainModules, detailModules]);

  // 从历史记录选择效果图作为底图
  const handleSelectHistoryRender = useCallback((record: RenderRecord) => {
    setMainRenderBase64(record.base64);
    setShowHistoryPicker(false);
    addChatMessage({
      id: uuidv4(), role: 'system-success', timestamp: Date.now(),
      text: '✅ 已从历史记录加载铺床效果图作为营销底图', images: [],
    });
    showToast('已加载历史效果图', 'success');
  }, [setMainRenderBase64, addChatMessage, showToast]);

  const { addLog } = useLogStore();
  const abortRef = useRef<AbortController | null>(null);

  // ============================================================
  // 上传参考图逻辑 (支持批量)
  // ============================================================
  const processUpload = (files: FileList | null, isMain: boolean) => {
    if (!files || files.length === 0) return;

    const currentRefs = isMain ? mainImageRefs : detailImageRefs;
    const maxLimit = isMain ? 5 : 8;
    
    if (currentRefs.length >= maxLimit) {
      showToast(`最多只能上传 ${maxLimit} 张参考图`, 'error'); 
      return;
    }

    const availableSlots = maxLimit - currentRefs.length;
    const filesToProcess = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, availableSlots);
    
    if (filesToProcess.length < Array.from(files).length) {
       showToast(`只截取了前 ${filesToProcess.length} 张图片，已达上限 ${maxLimit} 张`, 'info');
    }

    const targetSize = 512;
    
    Promise.all(filesToProcess.map(file => {
      return new Promise<UploadedImage>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let { width, height } = img;
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
              const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
              resolve({ id: uuidv4(), base64: base64Data, mimeType: 'image/jpeg', filename: file.name });
            }
          };
          if (typeof e.target?.result === 'string') img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    })).then(newImages => {
       if (isMain) {
         setMainImageRefs([...mainImageRefs, ...newImages]);
       } else {
         setDetailImageRefs([...detailImageRefs, ...newImages]);
       }
    });
  };

  // ============================================================
  // 构建单任务 Execute 函数
  // ============================================================
  const buildExecuteTask = useCallback((
    mod: typeof MAIN_IMAGE_MODULES[0], 
    idx: number, 
    isMain: boolean, 
    scene1Base64Cache?: { current: string | null }
  ) => {
    return async () => {
      if (isMain) updateMainImageResult(idx, { status: 'generating' });
      else updateDetailImageResult(idx, { status: 'generating' });

      // 动态判断是否是面料溯源图
      let rawPrompt = mod.prompt;
      if (mod.key === 'fabric_source') {
        rawPrompt = getFabricSourcePrompt(fabric);
      }
      
      // 🔑 接入 Prompt Control Center 的人工干预逻辑以及单图自定义
      let prompt = '';
      
      const customPrompt = (isMain ? mainImageResults : detailImageResults)[idx]?.customPrompt;

      if (customPrompt) {
         // 用户针对单张图片专门修改过的 Prompt，直接使用
         prompt = customPrompt;
      } else if (userModifiedPrompt && editedPromptStructure) {
        // 如果用户在全局手动修改了，使用全局的结构、风格和负向词
        prompt = [
          editedPromptStructure,
          editedPromptStyle,
          editedPromptNegative ? `NEGATIVE: ${editedPromptNegative}` : '',
          `\n\nSPECIFIC SHOT DESCRIPTION (CRITICAL):\n${rawPrompt}`
        ].filter(Boolean).join('\n\n');
      } else {
        // 否则使用默认的构造引擎
        prompt = buildMaterialPrompt(rawPrompt, fabric, style);
      }

      // 🔑 v2.1: 注入 productCustomization 上下文增强（闭环）
      const custHints: string[] = [];
      if (productCustomization.bedroomStyle) {
        custHints.push(`[Bedroom Style] ${productCustomization.bedroomStyle}`);
      }
      if (productCustomization.lightingPreference) {
        custHints.push(`[Lighting] ${productCustomization.lightingPreference}`);
      }
      if (productCustomization.cameraAnglePreference) {
        custHints.push(`[Camera Angle] ${productCustomization.cameraAnglePreference}`);
      }
      if (productCustomization.fontPreference) {
        custHints.push(`[Font Preference] ${productCustomization.fontPreference}`);
      }
      if (productCustomization.modelDescription) {
        custHints.push(`[Model Description] ${productCustomization.modelDescription}`);
      }
      if (productCustomization.sellingPoints?.length > 0) {
        custHints.push(`[Selling Points] ${productCustomization.sellingPoints.join(' | ')}`);
      }
      if (productCustomization.platform) {
        custHints.push(`[Target Platform] ${productCustomization.platform}`);
      }
      if (productCustomization.needEnglishVersion) {
        custHints.push('[Language] Include English version text alongside Chinese');
      }
      if (custHints.length > 0) {
        prompt += '\n\n## User Customization Context\n' + custHints.join('\n');
      }
      
      const userParts: any[] = [{ text: prompt }];

      // 注入 3D 渲染主图
      userParts.push({ inlineData: { mimeType: 'image/png', data: mainRenderBase64 } });

      // 注入对应的参考图
      const refs = isMain ? mainImageRefs : detailImageRefs;
      refs.forEach(r => {
        userParts.push({ inlineData: { mimeType: r.mimeType, data: r.base64 } });
      });

      // 如果是场景氛围图2，且场景1已生成，追加场景1作为参考
      if (!isMain && mod.key === 'scene_closeup' && scene1Base64Cache?.current) {
        userParts.push({ inlineData: { mimeType: 'image/png', data: scene1Base64Cache.current } });
      }
      // 如果是主图的 scene_ambience，逻辑类似但我们通常作为独立的生成

      // 组装特有的营销文案系统指令（仅当没有 customPrompt 时才注入，避免覆盖用户自定义）
      const marketingCopy = FABRIC_MARKETING_DICT[fabric] || FABRIC_MARKETING_DICT['纯棉'];
      if (isMain && !customPrompt) {
        userParts[0].text = `[Marketing Direction] Use the following copy for text overlay: "${marketingCopy}".\n${userParts[0].text}`;
      }

      const requestBody: GeminiRequestBody = {
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: {
          temperature: DEFAULT_TEMPERATURES.material,
          responseModalities: ['TEXT', 'IMAGE'],
          // 主图部分使用 1:1 或 3:4，这里统一暂用配置
          imageConfig: { aspectRatio: isMain ? mainImageAspectRatio : detailImageAspectRatio, imageSize: outputResolution },
        },
      };

      const result = await callGeminiApi({
        apiKey, requestBody, modelType: 'image', phase: 3,
        timeoutMs: MATERIAL_API_TIMEOUT_MS,
        signal: abortRef.current?.signal, onLog: addLog,
      });

      if (result.success && result.images.length > 0) {
        if (isMain) {
          updateMainImageResult(idx, { base64: result.images[0], status: 'done' });
          if (mod.key === 'scene_ambience' && scene1Base64Cache) scene1Base64Cache.current = result.images[0];
        } else {
          updateDetailImageResult(idx, { base64: result.images[0], status: 'done' });
        }
        return result.images[0];
      } else {
        if (isMain) updateMainImageResult(idx, { status: 'error', error: result.error || '生成失败' });
        else updateDetailImageResult(idx, { status: 'error', error: result.error || '生成失败' });
        throw new Error(result.error || '生成失败');
      }
    };
  }, [updateMainImageResult, updateDetailImageResult, fabric, userModifiedPrompt, editedPromptStructure, editedPromptStyle, editedPromptNegative, style, mainRenderBase64, mainImageRefs, detailImageRefs, mainImageResults, detailImageResults, apiKey, outputResolution, addLog]);

  // ============================================================
  // 分步生成逻辑：步骤 一
  // ============================================================
  const handleGenerateMainImages = useCallback(async () => {
    if (!apiKey || !mainRenderBase64 || isMarketingGenerating) return;
    setIsMarketingGenerating(true);

    setMainImageResults(mainImageResults.map(r => ({ ...r, status: 'generating' as const })));

    addChatMessage({
      id: uuidv4(), role: 'system', timestamp: Date.now(),
      text: `⏳ 正在并发生成 ${mainModules.length} 张营销主图... 面料: ${fabric}`, images: [],
    });

    abortRef.current = new AbortController();
    const scene1Base64Cache = { current: null as string | null };

    const tasks = mainModules.map((mod, idx) => ({
      id: `main_${mod.key}`, label: mod.label,
      execute: buildExecuteTask(mod, idx, true, scene1Base64Cache)
    }));

    try {
      await runConcurrentPool({
        tasks, concurrency: Math.min(tasks.length, 4),
        signal: abortRef.current.signal,
        onProgress: (completed, total) => {
          upsertChatMessage({
            id: 'progress-marketing-main', role: 'system', timestamp: Date.now(),
            text: `🎯 主图生成进度：${completed}/${total}`, images: [],
          });
        },
      });

      upsertChatMessage({
        id: 'progress-marketing-main', role: 'system-success', timestamp: Date.now(),
        text: '✅ 营销主图生成完毕！请确认无误后点击生成详情图。', images: [],
      });
      // 🔑 v2.1: 保存本轮结果到历史
      const currentResults = useAppStore.getState().mainImageResults;
      const completedResults = currentResults.filter(r => r.status === 'done');
      if (completedResults.length > 0) addMainRound([...currentResults]);
      showToast('✅ 主图生成完成！', 'success');
    } catch (e) {
      showToast(`主图生成出错: ${(e as Error).message}`, 'error');
    } finally {
      setIsMarketingGenerating(false);
      abortRef.current = null;
    }
  }, [apiKey, mainRenderBase64, isMarketingGenerating, fabric, addChatMessage, upsertChatMessage, setMainImageResults, setIsMarketingGenerating, showToast, mainModules, buildExecuteTask]);

  // ============================================================
  // 分步生成逻辑：步骤 二
  // ============================================================
  const handleGenerateDetailImages = useCallback(async () => {
    if (!apiKey || !mainRenderBase64 || isMarketingGenerating) return;
    setIsMarketingGenerating(true);

    setDetailImageResults(detailImageResults.map(r => ({ ...r, status: 'generating' as const })));

    addChatMessage({
      id: uuidv4(), role: 'system', timestamp: Date.now(),
      text: `⏳ 正在并发生成 ${detailModules.length} 张详情图... 面料: ${fabric}`, images: [],
    });

    abortRef.current = new AbortController();
    
    // 尝试从已生成的主图中提取 scene_ambience 作为参考
    const scene1Base64Cache = { current: null as string | null };
    const ambienceResult = mainImageResults.find(r => r.key === 'scene_ambience' && r.status === 'done' && r.base64);
    if (ambienceResult) {
       scene1Base64Cache.current = ambienceResult.base64;
    }

    const tasks = detailModules.map((mod, idx) => ({
      id: `detail_${mod.key}`, label: mod.label,
      execute: buildExecuteTask(mod, idx, false, scene1Base64Cache)
    }));

    try {
      const scene2TaskIdx = tasks.findIndex(t => t.id === 'detail_scene_closeup');
      const batch1 = [...tasks];
      let scene2Task = null;

      if (scene2TaskIdx >= 0 && scene1Base64Cache.current) {
         scene2Task = tasks[scene2TaskIdx];
         batch1.splice(scene2TaskIdx, 1);
      }

      await runConcurrentPool({
        tasks: batch1, concurrency: Math.min(batch1.length, 4),
        signal: abortRef.current.signal,
        onProgress: (completed, total) => {
          upsertChatMessage({
            id: 'progress-marketing-detail', role: 'system', timestamp: Date.now(),
            text: `🎯 详情图生成进度：${completed}/${total + (scene2Task ? 1 : 0)}`, images: [],
          });
        },
      });

      if (scene2Task) await scene2Task.execute().catch(() => {});

      upsertChatMessage({
        id: 'progress-marketing-detail', role: 'system-success', timestamp: Date.now(),
        text: '✅ 详情图生成完毕！', images: [],
      });
      // 🔑 v2.1: 保存本轮结果到历史
      const currentDetailResults = useAppStore.getState().detailImageResults;
      const completedDetailResults = currentDetailResults.filter(r => r.status === 'done');
      if (completedDetailResults.length > 0) addDetailRound([...currentDetailResults]);
      showToast('✅ 详情图生成完成！', 'success');
    } catch (e) {
      showToast(`详情图生成出错: ${(e as Error).message}`, 'error');
    } finally {
      setIsMarketingGenerating(false);
      abortRef.current = null;
    }
  }, [apiKey, mainRenderBase64, isMarketingGenerating, fabric, addChatMessage, upsertChatMessage, setDetailImageResults, setIsMarketingGenerating, showToast, detailModules, mainImageResults, buildExecuteTask]);

  // ============================================================
  // 🔄 单张重生成
  // ============================================================
  const handleRegenerateSingle = useCallback(async (moduleIndex: number, isMain: boolean) => {
    if (!apiKey || !mainRenderBase64) return;
    const mod = isMain ? mainModules[moduleIndex] : detailModules[moduleIndex];
    if (!mod) return;

    if (isMain) updateMainImageResult(moduleIndex, { status: 'generating', error: undefined });
    else updateDetailImageResult(moduleIndex, { status: 'generating', error: undefined });

    try {
      const task = buildExecuteTask(mod, moduleIndex, isMain);
      await task();
      showToast(`✅ ${mod.label} 重新生成成功`, 'success');
    } catch {
      // 状态已经在 buildExecuteTask 里抛出错误的 catch 里被拦截并设置了
      showToast(`${mod.label} 重生成失败`, 'error');
    }
  }, [apiKey, mainRenderBase64, mainModules, detailModules, updateMainImageResult, updateDetailImageResult, showToast, buildExecuteTask]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsMarketingGenerating(false);
    showToast('已取消', 'info');
  }, [setIsMarketingGenerating, showToast]);

  const [editingPromptMod, setEditingPromptMod] = useState<{ mod: typeof MAIN_IMAGE_MODULES[0], idx: number, isMain: boolean } | null>(null);
  const [editingPromptValue, setEditingPromptValue] = useState('');
  const [isAIOptimizing, setIsAIOptimizing] = useState(false);
  const [selectedRefIndices, setSelectedRefIndices] = useState<Set<number>>(new Set());

  // 🔑 模块2 & 3：AI 全局分析状态
  const [isAnalyzingMainPrompts, setIsAnalyzingMainPrompts] = useState(false);
  const [isAnalyzingDetailPrompts, setIsAnalyzingDetailPrompts] = useState(false);

  // 🔑 模块1：直接上传铺床效果图（跳过Phase2）
  const handleDirectRenderUpload = useCallback((files: FileList) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 1);
    if (imageFiles.length === 0) return;
    const file = imageFiles[0];
    const targetSize = 1024;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
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
          setMainRenderBase64(base64Data);
          addChatMessage({
            id: uuidv4(), role: 'system-success', timestamp: Date.now(),
            text: '✅ 已直接上传铺床效果图作为底图，可直接进入营销出图', images: [],
          });
          showToast('已上传铺床效果图', 'success');
        }
      };
      if (typeof e.target?.result === 'string') img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [setMainRenderBase64, addChatMessage, showToast]);

  // 🔑 模块2：一键分析主图提示词（v2.1 逐张独立并发）
  const handleGlobalAnalyzeMainPrompts = useCallback(async () => {
    if (!apiKey || !mainRenderBase64 || mainImageRefs.length === 0) {
      showToast('请先上传参考图和底图', 'error');
      return;
    }
    setIsAnalyzingMainPrompts(true);
    addChatMessage({
      id: uuidv4(), role: 'system', timestamp: Date.now(),
      text: `✨ AI 正在逐张独立分析 ${mainImageRefs.length} 张参考图（上下文完全隔离）...`, images: [],
    });

    // 汇总卖点、字体、模特信息
    const allSellingPoints: string[] = [];
    const allFonts: string[] = [];
    let detectedModel = { has_model: false, description: '' };

    try {
      // 为每张参考图创建独立的分析任务
      const tasks = mainImageRefs.map((ref, refIdx) => ({
        id: `main_analysis_${refIdx}`,
        label: `主图参考图 ${refIdx + 1}`,
        execute: async () => {
          const moduleLabel = refIdx < mainModules.length ? mainModules[refIdx].cnPrompt.slice(0, 20) : '营销主图';
          const prompt = buildSingleRefAnalysisPrompt({
            fabric,
            refIndex: refIdx + 1,
            totalRefs: mainImageRefs.length,
            moduleLabel,
            platform: productCustomization.platform || undefined,
          });

          const userParts: any[] = [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: mainRenderBase64 } },
            { inlineData: { mimeType: ref.mimeType, data: ref.base64 } },
          ];

          const reqBody: GeminiRequestBody = {
            contents: [{ role: 'user', parts: userParts }],
            generationConfig: { temperature: 0.7 },
          };

          const result = await generateContent({
            apiKey, bailianApiKey, requestBody: reqBody, modelId: analysisModelId,
            onLog: addLog, functionTag: 'prompt_analysis',
          });
          if (!result || !result.trim()) throw new Error('AI返回为空');

          // 使用鲁棒JSON解析
          const parsed = parseRobustJson(result);
          if (!parsed.success || !parsed.data) {
            console.error('[织梦AI] 主图分析JSON解析失败:', parsed.error, parsed.repairLog);
            throw new Error(parsed.error || 'JSON解析失败');
          }

          const data = parsed.data as any;
          const toonRaw = data.toonData || data;

          // 收集卖点、字体、模特信息
          if (Array.isArray(data.selling_points)) {
            allSellingPoints.push(...data.selling_points);
          }
          if (data.detected_font) allFonts.push(data.detected_font);
          if (data.model_presence?.has_model) {
            detectedModel = data.model_presence;
          }

          // ToonData 校验 + 融合 + 编译
          const validation = validateToonData(toonRaw);
          if (validation.warnings.length > 0) {
            console.warn(`[织梦AI] 主图${refIdx + 1} ToonData校验警告:`, validation.warnings);
          }

          const fused = fuseToonWithUserAssets(validation.toonData as ToonData, {
            patternDescription: 'Render strict adherence to user uploaded floral pattern',
          });
          const compiledPrompt = compileToonToText(fused);

          // 🔑 只更新 customPrompt，不清空已生成的图片
          if (refIdx < mainModules.length) {
            updateMainImageResult(refIdx, { customPrompt: compiledPrompt });
          }

          return compiledPrompt;
        },
      }));

      await runConcurrentPool({
        tasks, concurrency: Math.min(tasks.length, 8),
        onProgress: (completed, total) => {
          upsertChatMessage({
            id: 'progress-analyze-main', role: 'system', timestamp: Date.now(),
            text: `🔍 主图分析进度：${completed}/${total}`, images: [],
          });
        },
      });

      // 汇总结果写入 productCustomization
      const uniquePoints = [...new Set(allSellingPoints)];
      if (uniquePoints.length > 0 || allFonts.length > 0) {
        setProductCustomization({
          sellingPoints: uniquePoints,
          fontPreference: allFonts[0] || '',
          modelPhotoBase64: null,
          modelDescription: detectedModel.has_model ? detectedModel.description : '',
        });
      }

      upsertChatMessage({
        id: 'progress-analyze-main', role: 'system-success', timestamp: Date.now(),
        text: `✅ AI 已独立分析 ${mainImageRefs.length} 张参考图并生成 Toon 提示词！` +
          (uniquePoints.length > 0 ? `\n📌 识别卖点 ${uniquePoints.length} 个` : '') +
          (detectedModel.has_model ? '\n👤 检测到模特' : ''),
        images: [],
      });
      // 🔑 v2.1: 标记这批参考图为已分析
      markRefsAnalyzed(mainImageRefs.map(r => r.id), true);
      showToast('✅ 主图提示词已自动填充！', 'success');
    } catch (e) {
      showToast(`AI分析失败: ${(e as Error).message}`, 'error');
    } finally {
      setIsAnalyzingMainPrompts(false);
    }
  }, [apiKey, mainRenderBase64, mainImageRefs, fabric, analysisModelId, productCustomization.platform, addChatMessage, upsertChatMessage, updateMainImageResult, showToast, mainModules, addLog, setProductCustomization, markRefsAnalyzed]);

  // 🔑 模块3：一键分析详情图提示词（v2.1 逐张独立并发）
  const handleGlobalAnalyzeDetailPrompts = useCallback(async () => {
    if (!apiKey || !mainRenderBase64 || detailImageRefs.length === 0) {
      showToast('请先上传详情参考图', 'error');
      return;
    }
    setIsAnalyzingDetailPrompts(true);
    addChatMessage({
      id: uuidv4(), role: 'system', timestamp: Date.now(),
      text: `✨ AI 正在逐张独立分析 ${detailImageRefs.length} 张详情参考图（上下文隔离模式）...`, images: [],
    });

    const allSellingPoints: string[] = [];
    let successCount = 0;

    try {
      const tasks = detailImageRefs.map((ref, refIdx) => ({
        id: `detail_analysis_${refIdx}`,
        label: `详情参考图 ${refIdx + 1}`,
        execute: async () => {
          const prompt = buildSingleDetailRefAnalysisPrompt({
            fabric, style,
            refIndex: refIdx + 1,
            totalRefs: detailImageRefs.length,
            platform: productCustomization.platform || undefined,
          });

          const userParts: any[] = [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: mainRenderBase64 } },
            { inlineData: { mimeType: ref.mimeType, data: ref.base64 } },
          ];

          const reqBody: GeminiRequestBody = {
            contents: [{ role: 'user', parts: userParts }],
            generationConfig: { temperature: 0.7 },
          };

          const result = await generateContent({
            apiKey, bailianApiKey, requestBody: reqBody, modelId: analysisModelId,
            onLog: addLog, functionTag: 'prompt_analysis',
          });
          if (!result || !result.trim()) throw new Error('AI返回为空');

          const parsed = parseRobustJson(result);
          if (!parsed.success || !parsed.data) {
            console.error(`[织梦AI] 详情图${refIdx + 1}分析JSON解析失败:`, parsed.error);
            throw new Error(parsed.error || 'JSON解析失败');
          }

          const data = parsed.data as any;
          const toonRaw = data.toonData || data;

          // 收集卖点
          if (Array.isArray(data.selling_points)) {
            allSellingPoints.push(...data.selling_points);
          }

          // ToonData 校验 + 融合 + 编译
          const validation = validateToonData(toonRaw);
          if (validation.warnings.length > 0) {
            console.warn(`[织梦AI] 详情图${refIdx + 1} ToonData校验警告:`, validation.warnings);
          }

          const fused = fuseToonWithUserAssets(validation.toonData as ToonData, {
            patternDescription: 'Render strict adherence to user uploaded floral pattern',
          });
          const compiledPrompt = compileToonToText(fused);

          // 🔑 只更新 customPrompt，保留已生成图片
          if (refIdx < detailModules.length) {
            updateDetailImageResult(refIdx, {
              customPrompt: compiledPrompt,
              status: 'idle',
            });
          }

          successCount++;
          return compiledPrompt;
        },
      }));

      await runConcurrentPool({
        tasks, concurrency: Math.min(tasks.length, 8),
        onProgress: (completed, total) => {
          upsertChatMessage({
            id: 'progress-analyze-detail', role: 'system', timestamp: Date.now(),
            text: `🔍 详情图分析进度：${completed}/${total}`, images: [],
          });
        },
      });

      // 汇总卖点到 productCustomization
      const uniquePoints = [...new Set([...(productCustomization.sellingPoints || []), ...allSellingPoints])];
      if (allSellingPoints.length > 0) {
        setProductCustomization({ sellingPoints: uniquePoints });
      }

      upsertChatMessage({
        id: 'progress-analyze-detail', role: 'system-success', timestamp: Date.now(),
        text: `✅ AI 已独立分析 ${successCount}/${detailImageRefs.length} 张详情图并生成排版方案！`,
        images: [],
      });
      // 🔑 v2.1: 标记这批参考图为已分析
      markRefsAnalyzed(detailImageRefs.map(r => r.id), false);
      showToast(`✅ ${successCount} 张详情图提示词已填充！`, 'success');
    } catch (e) {
      showToast(`AI分析失败: ${(e as Error).message}`, 'error');
    } finally {
      setIsAnalyzingDetailPrompts(false);
    }
  }, [apiKey, mainRenderBase64, detailImageRefs, fabric, style, analysisModelId, productCustomization, addChatMessage, upsertChatMessage, updateDetailImageResult, showToast, detailModules, addLog, setProductCustomization, markRefsAnalyzed]);
  
  const handleOpenPromptEditor = (mod: typeof MAIN_IMAGE_MODULES[0], idx: number, isMain: boolean) => {
     setEditingPromptMod({ mod, idx, isMain });
     setSelectedRefIndices(new Set());
     // 读取当前图片已有的专属 prompt 或 默认的基础 prompt
     const results = isMain ? mainImageResults : detailImageResults;
     const currentCustom = results[idx]?.customPrompt;
     if (currentCustom) {
       setEditingPromptValue(currentCustom);
     } else {
       // 如果没有自定义过，显示中文提示词便于查看和编辑
       let rawCnPrompt = mod.cnPrompt;
       if (mod.key === 'fabric_source') rawCnPrompt = `动态面料溯源场景图，根据纯棉、真丝等面料自动生成对应材质特写。当前面料：${fabric}`;
       setEditingPromptValue(rawCnPrompt);
     }
  };

  const handleSavePromptEditor = () => {
    if (!editingPromptMod) return;
    const { idx, isMain } = editingPromptMod;
    if (isMain) updateMainImageResult(idx, { customPrompt: editingPromptValue });
    else updateDetailImageResult(idx, { customPrompt: editingPromptValue });

    setEditingPromptMod(null);
    showToast('提示词已修改，点生成即可生效', 'success');
  };

  const handleAIOptimizePrompt = async () => {
    if (!editingPromptMod || !apiKey) return;
    const { mod, isMain } = editingPromptMod;
    
    setIsAIOptimizing(true);
    showToast('AI 正在分析参考图重写提示词（Toon 格式）...', 'info');

    try {
      let rawCnPrompt = mod.cnPrompt;
      if (mod.key === 'fabric_source') rawCnPrompt = `动态面料溯源场景图，根据纯棉、真丝等面料自动生成对应材质特写。当前面料：${fabric}`;

      // 只使用用户手动选择的参考图（如果有选择的话），否则全部发送
      const allRefs = isMain ? mainImageRefs : detailImageRefs;
      const refs = selectedRefIndices.size > 0
        ? allRefs.filter((_, i) => selectedRefIndices.has(i))
        : allRefs;

      // 🔑 使用统一的 buildSingleImageOptimizePrompt（输出 ToonData JSON）
      const optimizePrompt = buildSingleImageOptimizePrompt({
        moduleLabel: mod.label,
        baseCnPrompt: rawCnPrompt,
        fabric,
        refCount: refs.length,
      });

      const userParts: any[] = [{ text: optimizePrompt }];

      // 加入主渲染图作为基础参考
      if (mainRenderBase64) {
         userParts.push({ inlineData: { mimeType: 'image/png', data: mainRenderBase64 }});
      }

      refs.forEach(r => {
        userParts.push({ inlineData: { mimeType: r.mimeType, data: r.base64 } });
      });

      const reqBody: GeminiRequestBody = {
         contents: [{ role: 'user', parts: userParts }],
         generationConfig: { temperature: 0.7 }
      };

      // 🔑 v2.1: 使用 options 对象 + analysisModelId + onLog
      const result = await generateContent({
        apiKey, bailianApiKey, requestBody: reqBody, modelId: analysisModelId,
        onLog: addLog, functionTag: 'prompt_analysis',
      });

      if (result && result.trim()) {
         // 🔑 v2.1: 使用 parseRobustJson 替代手工 regex
         const parsed = parseRobustJson(result);
         if (parsed.success && parsed.data) {
           const toonRaw = (parsed.data as any).toonData || parsed.data;
           const validation = validateToonData(toonRaw);
           if (validation.warnings.length > 0) {
             console.warn('[织梦AI] 单图优化ToonData校验警告:', validation.warnings);
           }
           const fused = fuseToonWithUserAssets(validation.toonData as ToonData, {
             patternDescription: 'Render strict adherence to user uploaded floral pattern',
             pantoneColor: extractedDominantColor
               ? `Pantone (${extractedDominantColor.name}) ${extractedDominantColor.hex}`
               : 'a neutral solid color matching the pattern background',
           });
           setEditingPromptValue(compileToonToText(fused));
           showToast('AI 分析完成，已编译为 Toon 格式', 'success');
         } else {
           // JSON 解析失败，回退使用纯文本结果
           setEditingPromptValue(result.trim());
           showToast(`AI 分析完成（纯文本格式）${parsed.repairLog ? '，解析有修复' : ''}`, 'success');
         }
      } else {
         showToast('AI 返回为空，请稍后重试', 'error');
      }
    } catch (e) {
      showToast(`AI 优化失败: ${(e as Error).message}`, 'error');
    } finally {
      setIsAIOptimizing(false);
    }
  };

  // 🔑 v2.1: renderGrid 支持多轮历史查看
  const renderGrid = (title: string, results: any[], modules: any[], isMain: boolean) => {
    // 获取历史轮次
    const rounds = isMain ? useAppStore.getState().mainImageRounds : useAppStore.getState().detailImageRounds;
    const activeRound = isMain ? useAppStore.getState().activeMainRound : useAppStore.getState().activeDetailRound;
    const setActiveRound = isMain
      ? (idx: number) => useAppStore.getState().setActiveMainRound(idx)
      : (idx: number) => useAppStore.getState().setActiveDetailRound(idx);

    // 当前显示的结果：如果选中了历史轮次，展示历史轮次；否则展示当前轮
    const displayResults = activeRound >= 0 && activeRound < rounds.length
      ? rounds[activeRound]
      : results;
    const isViewingHistory = activeRound >= 0 && activeRound < rounds.length;

    return (
    <div className="glass-card-static p-4 fade-in-up mt-3">
      <div className="text-xs text-indigo-300 font-bold mb-3 flex items-center justify-between">
        <span>{title} ({displayResults.filter((r: any) => r.status === 'done').length}/{displayResults.length})</span>
        {/* 轮次标签栏 */}
        {rounds.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveRound(-1)}
              className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${
                !isViewingHistory
                  ? 'bg-indigo-500/30 text-indigo-200 font-medium'
                  : 'text-gray-500 hover:text-gray-300 bg-white/5'
              }`}
            >当前</button>
            {rounds.map((_, rIdx) => (
              <button
                key={rIdx}
                onClick={() => setActiveRound(rIdx)}
                className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${
                  activeRound === rIdx
                    ? 'bg-amber-500/30 text-amber-200 font-medium'
                    : 'text-gray-500 hover:text-gray-300 bg-white/5'
                }`}
              >第{rIdx + 1}轮</button>
            ))}
          </div>
        )}
      </div>
      {isViewingHistory && (
        <div className="mb-2 text-[10px] text-amber-400/70 flex items-center gap-1">
          <span>⏳</span>
          <span>正在查看历史第 {activeRound + 1} 轮结果，点击“当前”回到最新结果</span>
        </div>
      )}
      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        {modules.map((mod, idx) => {
          const result = displayResults[idx];
          if (!result) return null;
          return (
            <div key={mod.key} className="rounded-xl overflow-hidden border border-gray-700/30 bg-gray-900/30 group relative">
              <div className="aspect-square relative bg-gray-900/50">
                {result.status === 'done' && result.base64 ? (
                  <img src={`data:image/png;base64,${result.base64}`} alt={mod.label} className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity" onClick={() => result.base64 && openImageModal(result.base64)} />
                ) : result.status === 'generating' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800/50">
                    <div className="text-2xl animate-pulse">{mod.emoji}</div>
                    <div className="text-[10px] text-gray-500 mt-1">生成中...</div>
                  </div>
                ) : result.status === 'error' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/10">
                    <div className="text-2xl">❌</div>
                    <div className="text-[10px] text-red-400 mt-1 px-2 text-center">{result.error}</div>
                  </div>
                ) : result.status === 'idle' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800/60 p-4">
                    <div className="text-3xl opacity-50 mb-2">{mod.emoji}</div>
                    <div className="text-[10px] text-gray-400 text-center line-clamp-3 mb-3">{mod.cnPrompt}</div>
                    <div className="flex gap-2 flex-wrap justify-center">
                      <button 
                        onClick={() => handleOpenPromptEditor(mod, idx, isMain)}
                        className="border border-indigo-500/50 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/30 text-[10px] px-3 py-1 rounded-full transition"
                      >
                        ✏️ 编辑提示词
                      </button>
                      <button
                        onClick={() => handleRegenerateSingle(idx, isMain)}
                        disabled={isMarketingGenerating || !mainRenderBase64}
                        className="border border-emerald-500/50 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/30 text-[10px] px-3 py-1 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        🚀 生成此图
                      </button>
                    </div>
                    {result.customPrompt && <div className="absolute top-2 right-2 flex space-x-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span></div>}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800/30"><div className="text-3xl opacity-30">{mod.emoji}</div></div>
                )}
                {(result.status === 'done' || result.status === 'error') && !isMarketingGenerating && (
                  <ImageOverlayToolbar compact actions={[
                    ...(result.status === 'done' && result.base64 ? [{ icon: '🔍', label: '放大', onClick: () => result.base64 && openImageModal(result.base64) }] : []),
                    { icon: '✏️', label: '编辑提示词', onClick: () => handleOpenPromptEditor(mod, idx, isMain) },
                    { icon: '🔄', label: '重新生成', onClick: () => handleRegenerateSingle(idx, isMain), variant: 'accent' as const },
                    { icon: '🗑️', label: '清空此结果', onClick: () => {
                      if (isMain) clearMainImageResult(idx);
                      else clearDetailImageResult(idx);
                      showToast('已清空，可重新分析或生成', 'info');
                    }},
                  ]} />
                )}
              </div>
              <div className="px-2 py-1.5 text-[11px] text-gray-300 text-center bg-gray-900/80 font-medium">
                {mod.emoji} {mod.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    );
  };

  return (
    <>
      {/* 🔑 无底图时：显示直接上传入口 + 历史效果图快速选择 */}
      {!mainRenderBase64 && (
        <>
          {/* 🔑 模块1：直接上传铺床效果图入口 */}
          <div className="glass-card-static p-4 fade-in-up">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-amber-300 font-bold">📤 直接上传铺床效果图</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">跳过渲染</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              上传你已有的铺床效果图或实拍照片，直接进入排版出图环节。
            </p>
            <label
              className="block border-2 border-dashed border-gray-600 rounded-xl p-6 text-center hover:border-indigo-400/50 cursor-pointer transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleDirectRenderUpload(e.dataTransfer.files);
              }}
            >
              <div className="text-3xl mb-2">🛏️</div>
              <div className="text-sm text-gray-400">拖拽或点击上传（1张）</div>
              <div className="text-[10px] text-gray-500 mt-1">支持 JPG/PNG</div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) handleDirectRenderUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* 历史效果图快速选择 */}
          {historyRenders.length > 0 && (
            <div className="glass-card-static p-4 fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-400 font-medium">📂 或从历史铺床效果图中选择底图</div>
                <span className="text-[10px] text-gray-500">{historyRenders.length} 张可用</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {historyRenders.slice(0, 12).map(r => (
                  <img
                    key={r.id}
                    src={`data:image/png;base64,${r.base64}`}
                    alt=""
                    className="w-full aspect-[3/4] object-cover rounded-lg cursor-pointer border-2 border-gray-700/50 hover:border-indigo-400 hover:scale-[1.03] transition-all shadow-md"
                    onClick={() => handleSelectHistoryRender(r)}
                  />
                ))}
              </div>
            </div>
          )}

          {historyRenders.length === 0 && (
            <div className="glass-card-static p-3 fade-in-up text-center">
              <div className="text-[11px] text-gray-500">💡 也可以在 Phase 2 生成铺床渲染图后自动进入</div>
            </div>
          )}
        </>
      )}

      {/* 有底图时：正常显示营销出图界面 */}
      {mainRenderBase64 && (
      <div className="glass-card-static p-4 fade-in-up">
        {/* 全局信息提示区 */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative w-20 h-24 flex-shrink-0 group cursor-pointer" onClick={() => setShowHistoryPicker(!showHistoryPicker)}>
             <img src={`data:image/png;base64,${mainRenderBase64}`} alt="" className="w-full h-full object-cover rounded-lg border border-indigo-400/30 shadow-lg group-hover:opacity-70 transition"/>
             <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">底图</div>
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
               <span className="text-[10px] bg-black/60 text-white px-2 py-1 rounded-md">🔄 换图</span>
             </div>
          </div>
          <div className="flex-1 text-sm bg-gray-800/30 p-3 rounded-lg border border-gray-700/50">
             <div className="text-gray-300">面料: <span className="text-indigo-400 font-medium">{fabric}</span></div>
             <div className="text-gray-400 text-xs mt-1">AI 专营销文案策略: </div>
             <div className="text-amber-400/90 text-xs mt-1 italic">"{FABRIC_MARKETING_DICT[fabric] || FABRIC_MARKETING_DICT['纯棉']}"</div>
          </div>
        </div>

        {/* 🔑 底图切换：展开历史效果图弹层 */}
        {showHistoryPicker && historyRenders.length > 0 && (
          <div className="mb-4 p-3 rounded-xl border border-indigo-500/30 bg-indigo-900/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-indigo-300 font-medium">🔄 选择其他历史效果图作为底图</span>
              <button className="text-[10px] text-gray-500 hover:text-gray-300" onClick={() => setShowHistoryPicker(false)}>✕ 关闭</button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {historyRenders.slice(0, 12).map(r => (
                <img
                  key={r.id}
                  src={`data:image/png;base64,${r.base64}`}
                  alt=""
                  className="w-full aspect-[3/4] object-cover rounded-lg cursor-pointer border-2 border-gray-700/50 hover:border-indigo-400 transition-all"
                  onClick={() => handleSelectHistoryRender(r)}
                />
              ))}
            </div>
          </div>
        )}


        {/* 分析模型切换 + 参考图上传区 */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400 font-medium">📚 参考图 & 分析配置</div>
          {/* 模型切换 */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-1 py-0.5">
            <button
              onClick={() => useAppStore.getState().setAnalysisModelId('gemini-3.1-pro-preview')}
              className={`px-2.5 py-1 text-[10px] rounded-full transition-all font-medium ${
                analysisModelId === 'gemini-3.1-pro-preview'
                  ? 'bg-violet-500/30 text-violet-200 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >Pro</button>
            <button
              onClick={() => useAppStore.getState().setAnalysisModelId('gemini-3.1-flash-lite-preview')}
              className={`px-2.5 py-1 text-[10px] rounded-full transition-all font-medium ${
                analysisModelId === 'gemini-3.1-flash-lite-preview'
                  ? 'bg-emerald-500/30 text-emerald-200 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >Lite</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* 🖼️ 主图参考区（含宽高比 + 操作按钮） */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-gray-400 font-medium flex justify-between">
              <span>🖼️ 主图参考 ({mainImageRefs.length}/5)</span>
              {mainImageRefs.length > 0 && <span className="text-red-400 cursor-pointer text-[10px]" onClick={() => {
                if (isAnalyzingMainPrompts || isMarketingGenerating) { showToast('正在处理中，请等待完成后再操作', 'error'); return; }
                if (mainImageResults.some(r => r.customPrompt)) { if (!confirm('已有AI分析生成的提示词会保留，确认清空参考图吗？')) return; }
                setMainImageRefs([]);
              }}>清空</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {mainImageRefs.map(img => (
                <div key={img.id} className="relative w-12 h-16 group">
                  <img src={`data:image/jpeg;base64,${img.base64}`} alt="ref" className="w-full h-full object-cover rounded-md opacity-70 group-hover:opacity-100 transition" />
                  <button className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    onClick={() => setMainImageRefs(mainImageRefs.filter(r => r.id !== img.id))}>×</button>
                </div>
              ))}
              {mainImageRefs.length < 5 && (
                <label className="w-12 h-16 border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center text-gray-500 hover:border-indigo-400 hover:text-indigo-400 cursor-pointer transition">
                  <span className="text-xl">+</span>
                  <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => { if (e.target.files) processUpload(e.target.files, true); e.target.value=''; }} />
                </label>
              )}
            </div>
            {/* 📐 主图宽高比 */}
            <div>
              <div className="text-[11px] text-gray-400 font-medium mb-1.5">📐 主图宽高比</div>
              <AspectRatioSelector
                value={mainImageAspectRatio}
                onChange={setMainImageAspectRatio}
                recommended={recommendedMainRatio}
                compact
              />
            </div>
            {/* 🎬 主图操作按钮 */}
            {mainImageResults.length > 0 && (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/15 p-2.5">
                <div className="flex gap-2">
                  {mainImageRefs.length > 0 && (
                    <button
                      className="flex-1 text-xs py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-[0_0_12px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isAnalyzingMainPrompts || isMarketingGenerating}
                      onClick={handleGlobalAnalyzeMainPrompts}
                    >
                      {(() => {
                        if (isAnalyzingMainPrompts) return <span className="animate-pulse">⏳ AI 正在分析参考图...</span>;
                        const newCount = mainImageRefs.filter(r => !analyzedMainRefIds.has(r.id)).length;
                        if (newCount > 0 && mainImageResults.some(r => r.customPrompt)) {
                          return `✨ 增量分析 ${newCount} 张新图`;
                        }
                        if (mainImageResults.some(r => r.customPrompt)) {
                          return '✅ 提示词已就绪 · 点击重新分析';
                        }
                        return '✨ AI分析参考图 → 自动填提示词';
                      })()}
                    </button>
                  )}
                  <button
                    className={`${mainImageRefs.length > 0 ? 'flex-1' : 'w-full'} text-xs py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold shadow-[0_0_12px_rgba(99,102,241,0.4)] hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={isMarketingGenerating || !mainRenderBase64 || isAnalyzingMainPrompts}
                    onClick={handleGenerateMainImages}
                  >
                    🚀 {mainImageRefs.length > 0 ? '直接生成（用当前提示词）' : '一键生成所有主图'}
                  </button>
                </div>
                {mainImageRefs.length === 0 && (
                  <div className="mt-1.5 text-[10px] text-indigo-400/70 flex items-center gap-1">
                    <span>💡</span>
                    <span>上传主图参考图后，可使用 <strong className="text-indigo-300">AI 智能分析</strong> 自动生成专业排版提示词</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 📋 详情图参考区（含宽高比 + 操作按钮） */}
          <div className="flex flex-col gap-3">
             <div className="text-xs text-gray-400 font-medium flex justify-between">
              <span>📋 详情图参考 ({detailImageRefs.length}/8)</span>
              {detailImageRefs.length > 0 && <span className="text-red-400 cursor-pointer text-[10px]" onClick={() => {
                if (isAnalyzingDetailPrompts || isMarketingGenerating) { showToast('正在处理中，请等待完成后再操作', 'error'); return; }
                if (detailImageResults.some(r => r.customPrompt)) { if (!confirm('已有AI分析生成的提示词会保留，确认清空参考图吗？')) return; }
                setDetailImageRefs([]);
              }}>清空</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {detailImageRefs.map(img => (
                <div key={img.id} className="relative w-12 h-16 group">
                  <img src={`data:image/jpeg;base64,${img.base64}`} alt="ref" className="w-full h-full object-cover rounded-md opacity-70 group-hover:opacity-100 transition" />
                  <button className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    onClick={() => setDetailImageRefs(detailImageRefs.filter(r => r.id !== img.id))}>×</button>
                </div>
              ))}
              {detailImageRefs.length < 8 && (
                 <label className="w-12 h-16 border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center text-gray-500 hover:border-indigo-400 hover:text-indigo-400 cursor-pointer transition">
                  <span className="text-xl">+</span>
                  <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => { if (e.target.files) processUpload(e.target.files, false); e.target.value=''; }} />
                </label>
              )}
            </div>
            {/* 📐 详情图宽高比 */}
            <div>
              <div className="text-[11px] text-gray-400 font-medium mb-1.5">📐 详情图宽高比</div>
              <AspectRatioSelector
                value={detailImageAspectRatio}
                onChange={setDetailImageAspectRatio}
                recommended={recommendedDetailRatio}
                compact
              />
            </div>
            {/* 🎬 详情图操作按钮 */}
            {detailImageResults.length > 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 p-2.5">
                <div className="flex gap-2">
                  {detailImageRefs.length > 0 && (
                    <button
                      className="flex-1 text-xs py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isAnalyzingDetailPrompts || isMarketingGenerating}
                      onClick={handleGlobalAnalyzeDetailPrompts}
                    >
                      {(() => {
                        if (isAnalyzingDetailPrompts) return <span className="animate-pulse">⏳ AI 正在识别参考图内容...</span>;
                        const newDCount = detailImageRefs.filter(r => !analyzedDetailRefIds.has(r.id)).length;
                        if (newDCount > 0 && detailImageResults.some(r => r.customPrompt)) {
                          return `✨ 增量分析 ${newDCount} 张新图`;
                        }
                        if (detailImageResults.some(r => r.customPrompt)) {
                          return '✅ 排版方案已就绪 · 点击重新分析';
                        }
                        return '✨ AI分析参考图 → 动态生成排版方案';
                      })()}
                    </button>
                  )}
                  <button
                    className={`${detailImageRefs.length > 0 ? 'flex-1' : 'w-full'} text-xs py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold shadow-[0_0_12px_rgba(20,184,166,0.4)] hover:shadow-[0_0_20px_rgba(20,184,166,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={isMarketingGenerating || isAnalyzingDetailPrompts}
                    onClick={handleGenerateDetailImages}
                  >
                    🚀 {detailImageRefs.length > 0 ? '直接生成（用当前提示词）' : '一键生成所有详情图'}
                  </button>
                </div>
                {detailImageRefs.length === 0 && (
                  <div className="mt-1.5 text-[10px] text-emerald-400/70 flex items-center gap-1">
                    <span>💡</span>
                    <span>上传详情参考图后，可使用 <strong className="text-emerald-300">AI 智能识别</strong> 自动分析内容并生成排版方案</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 产品自定义面板（有底图时显示） */}
      {mainRenderBase64 && (
        <div className="mt-3 fade-in-up">
          <ProductCustomizer showToast={showToast} />
        </div>
      )}

      {mainImageResults.length > 0 && renderGrid('🖼️ 高点击率主图区', mainImageResults, mainModules, true)}

      {detailImageResults.length > 0 && renderGrid('📋 高转化详情图区', detailImageResults, detailModules, false)}

      {isMarketingGenerating && (
        <div className="flex justify-start fade-in-up mt-2">
          <div className="chat-bubble-ai flex items-center gap-2 border border-indigo-500/30">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-indigo-200">正在并发生成营销套图...</span>
            <button className="text-xs text-red-400 hover:text-red-300 ml-2 border-l border-gray-600 pl-2" onClick={handleCancel}>⏹ 取消</button>
          </div>
        </div>
      )}

      <div data-action-bar="phase3" className="flex flex-col gap-3 mt-4">
        {/* 底部操作区 — 生成中状态提示 */}
      </div>

      {/* 弹窗：单图提示词编辑 */}
      {editingPromptMod && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="bg-gray-800/80 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2">
                  <span className="text-xl">{editingPromptMod.mod.emoji}</span>
                  自定义专属提示词: {editingPromptMod.mod.label}
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">您可以手动修改即将发送给 AI 的提示词内容，或让 AI 看参考图自动优化。</p>
              </div>
              <button className="text-gray-400 hover:text-white" onClick={() => setEditingPromptMod(null)}>✕</button>
            </div>
            
            <div className="p-4 flex flex-col gap-4">
               <div>
                  <textarea
                    className="w-full bg-gray-950/50 border border-gray-700 text-gray-300 text-sm p-3 rounded-lg font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner resize-none"
                    rows={8}
                    value={editingPromptValue}
                    onChange={(e) => setEditingPromptValue(e.target.value)}
                    placeholder="在这里输入简体中文提示词描述画面..."
                  />
               </div>

               <div className="bg-indigo-900/10 border border-indigo-500/20 p-3 rounded-lg">
                 {/* 参考图选择区 */}
                 {(() => {
                   const refs = editingPromptMod.isMain ? mainImageRefs : detailImageRefs;
                   if (refs.length === 0) return null;
                   return (
                     <div className="mb-3">
                       <div className="text-[11px] text-gray-400 mb-2 flex items-center justify-between">
                         <span>🖼️ 指定参考图进行分析 (点击选择，不选则使用全部)</span>
                         {selectedRefIndices.size > 0 && <span className="text-indigo-400 font-medium">已选 {selectedRefIndices.size} 张</span>}
                       </div>
                       <div className="flex gap-2 flex-wrap">
                         {refs.map((r, ri) => (
                           <div
                             key={ri}
                             className={`w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${
                               selectedRefIndices.has(ri)
                                 ? 'border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)] ring-1 ring-indigo-400'
                                 : 'border-gray-600/50 opacity-60 hover:opacity-100'
                             }`}
                             onClick={() => {
                               setSelectedRefIndices(prev => {
                                 const next = new Set(prev);
                                 if (next.has(ri)) next.delete(ri);
                                 else next.add(ri);
                                 return next;
                               });
                             }}
                           >
                             <img src={`data:${r.mimeType};base64,${r.base64}`} alt="" className="w-full h-full object-cover" />
                             {selectedRefIndices.has(ri) && (
                               <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/40">
                                 <span className="text-indigo-200 text-lg drop-shadow-md">✓</span>
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                   );
                 })()}

                 <div className="flex items-center justify-between">
                   <div className="text-xs text-indigo-300/80 mr-3">
                     {selectedRefIndices.size > 0
                       ? `AI 将只分析您选中的 ${selectedRefIndices.size} 张参考图来优化您的专属提示词。`
                       : '让大模型分析你上传的图片，自动改写包含排版和细节的专业提示词。'
                     }
                   </div>
                   <button 
                     onClick={handleAIOptimizePrompt} 
                     disabled={isAIOptimizing}
                     className="btn-primary text-xs whitespace-nowrap bg-gradient-to-r from-purple-600 to-indigo-600 border-none px-4 py-2"
                   >
                     {isAIOptimizing ? <span className="animate-pulse">✨ AI 分析中...</span> : '✨ 依据参考图优化提示词'}
                   </button>
                 </div>
               </div>
            </div>

            <div className="bg-gray-800/50 px-4 py-3 border-t border-gray-700 flex justify-end gap-3">
              <button 
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition"
                onClick={() => setEditingPromptMod(null)}
              >取消</button>
              <button 
                className="px-6 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-900"
                onClick={handleSavePromptEditor}
              >保存改动</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

