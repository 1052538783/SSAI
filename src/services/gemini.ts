/**
 * GeminiService — 统一的 Gemini API 调用服务
 *
 * 核心能力：
 * 1. 统一请求/响应处理（支持 IMAGE_MODEL 和 TEXT_MODEL）
 * 2. 动态并发池（可配置并发数，自动管理任务队列）
 * 3. 超时重试机制（含 AbortController 管理）
 * 4. 日志自动注入（每次调用自动写入 LogStore，含原始请求/返回）
 * 5. ThoughtSignature 自动提取
 *
 * 🔑 v2.1 升级：
 * - 日志从 phase 改为 functionTag 功能标签
 * - 新增 rawRequest/rawResponse 原始数据日志
 * - generateContent 支持动态 modelId + 日志注入
 */

import {
  IMAGE_API_URL,
  API_TIMEOUT_MS,
  MAX_RETRIES,
  IMAGE_MODEL_ID,
  getTextApiUrl,
  getProviderForModel,
  getBailianChatUrl,
} from '../config/models';
import type {
  GeminiRequestBody,
  GeminiResponse,
  ParsedApiResult,
  ApiPart,
  ApiResponsePart,
} from '../types/api';
import type { FunctionTag, LogEntry } from '../types/state';
import { sanitizeForLog } from './jsonParser';
import { buildOpenAIRequestBody, parseOpenAIResponse } from './openaiAdapter';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// 响应解析
// ============================================================

/**
 * 解析 Gemini API 的原始响应为统一的 ParsedApiResult
 * 🔑 会保留 thoughtSignature
 */
export function parseGeminiResponse(data: GeminiResponse): ParsedApiResult {
  if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content?.parts) {
    return {
      success: false,
      text: '',
      images: [],
      modelParts: [],
      tokensUsed: data.usageMetadata,
      error: `API未返回有效内容${data.candidates?.[0]?.finishReason ? ` (${data.candidates[0].finishReason})` : ''}`,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }

  const parts = data.candidates[0].content.parts;
  let text = '';
  const images: string[] = [];

  // 🔑 保留完整的 model parts（含 thoughtSignature）
  const modelParts: ApiPart[] = parts.map((part: ApiResponsePart) => {
    const parsed: ApiPart = {};
    if (part.text) {
      text += part.text;
      parsed.text = part.text;
    }
    // 统一处理 inlineData / inline_data 两种格式
    const inlineData = part.inlineData || part.inline_data;
    if (inlineData?.data) {
      images.push(inlineData.data);
      parsed.inlineData = { mimeType: inlineData.mimeType, data: inlineData.data };
    }
    // 🔑 必须保存 thoughtSignature
    if (part.thoughtSignature) {
      parsed.thoughtSignature = part.thoughtSignature;
    }
    return parsed;
  });

  return {
    success: true,
    text,
    images,
    modelParts,
    tokensUsed: data.usageMetadata,
    finishReason: data.candidates[0].finishReason,
  };
}

// ============================================================
// 单次 API 调用（含重试）
// ============================================================

export interface CallApiOptions {
  /** API Key（API易 或 百炼） */
  apiKey: string;
  /** 请求体（Gemini 原生格式，百炼会自动转换） */
  requestBody: GeminiRequestBody;
  /** 使用生图模型还是文本模型 */
  modelType?: 'image' | 'text';
  /** 指定文本分析的模型ID（可选，不传则用 gemini-3.1-pro-preview） */
  textModelId?: string;
  /** 百炼API Key（文本模型使用百炼时需要） */
  bailianApiKey?: string;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 全局取消信号 */
  signal?: AbortSignal;
  /** 功能标签（用于日志分类） */
  functionTag?: FunctionTag;
  /** 兼容旧代码：phase 字段 */
  phase?: 1 | 2 | 3 | 4;
  /** 日志写入回调 */
  onLog?: (entry: LogEntry) => void;
}

/**
 * 调用 Gemini API（含超时重试）
 * 自动注入日志
 */
export async function callGeminiApi(options: CallApiOptions): Promise<ParsedApiResult> {
  const {
    apiKey,
    requestBody,
    modelType = 'image',
    textModelId,
    bailianApiKey,
    timeoutMs = API_TIMEOUT_MS,
    maxRetries = MAX_RETRIES,
    signal,
    functionTag = 'image_generation',
    phase,
    onLog,
  } = options;

  // 🔑 根据 modelType 和 textModelId 确定实际模型和提供商
  const modelId = modelType === 'text' ? (textModelId || 'gemini-3.1-pro-preview') : IMAGE_MODEL_ID;
  const provider = modelType === 'text' ? getProviderForModel(modelId) : 'apiyi';
  const effectiveApiKey = provider === 'bailian' ? (bailianApiKey || apiKey) : apiKey;
  const apiUrl = provider === 'bailian'
    ? getBailianChatUrl()
    : (modelType === 'text' ? getTextApiUrl(modelId) : IMAGE_API_URL);

  // 统计图片数量
  let inputImageCount = 0;
  requestBody.contents.forEach(c => {
    c.parts.forEach(p => {
      if (p.inlineData || p.inline_data) inputImageCount++;
    });
  });

  // 提取 prompt 摘要
  const inputSummary = requestBody.contents
    .flatMap(c => c.parts.filter(p => p.text).map(p => p.text!))
    .join(' ')
    .slice(0, 200);

  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 检查全局取消
    if (signal?.aborted) {
      const cancelEntry: LogEntry = {
        id: uuidv4(),
        timestamp: Date.now(),
        functionTag,
        phase,
        modelId,
        requestType: modelType,
        inputSummary,
        inputImageCount,
        outputText: '',
        outputImageCount: 0,
        durationMs: Date.now() - startTime,
        status: 'cancelled',
        rawRequest: sanitizeForLog(requestBody),
      };
      onLog?.(cancelEntry);
      return { success: false, text: '', images: [], modelParts: [], error: '用户取消' };
    }

    // 创建本次请求的 AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 绑定全局取消信号
    const onGlobalAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onGlobalAbort);

    try {
      console.log(`[织梦AI] 发送请求 (${attempt + 1}/${maxRetries + 1}) → ${modelId} [${provider}]`);

      // 🔑 根据 provider 构建不同的请求
      let fetchUrl: string;
      let fetchHeaders: Record<string, string>;
      let fetchBody: string;
      let actualRequestForLog: any = requestBody; // 日志用：记录实际发出的请求体

      if (provider === 'bailian') {
        // 百炼 OpenAI 兼容格式
        fetchUrl = apiUrl;
        fetchHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveApiKey}`,
        };
        const openaiBody = buildOpenAIRequestBody(requestBody, modelId);
        fetchBody = JSON.stringify(openaiBody);
        actualRequestForLog = openaiBody; // 日志记录转换后的格式
        // 🔑 调试：打印实际发出的 OpenAI 格式请求
        console.log(`[织梦AI] 百炼请求详情:`, {
          url: fetchUrl,
          keyPrefix: effectiveApiKey?.slice(0, 8) + '...',
          model: openaiBody.model,
          messageCount: openaiBody.messages?.length,
          firstMessage: openaiBody.messages?.[0]?.role,
          body: openaiBody,
        });
      } else {
        // API易 Gemini 原生格式（key 通过 URL 参数传递）
        fetchUrl = `${apiUrl}?key=${effectiveApiKey}`;
        fetchHeaders = { 'Content-Type': 'application/json' };
        fetchBody = JSON.stringify(requestBody);
      }

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: fetchBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onGlobalAbort);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        const errMsg = errData.error?.message || `HTTP ${response.status}`;
        console.error(`[织梦AI] API返回错误 (${response.status}):`, errMsg);

        // 5xx / 429 才重试（指数退避 + 随机抖动）
        if (attempt < maxRetries && (response.status >= 500 || response.status === 429)) {
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`[织梦AI] 准备重试... 指数退避 ${Math.round(backoffMs)}ms`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }

        const errorEntry: LogEntry = {
          id: uuidv4(),
          timestamp: Date.now(),
          functionTag,
          phase,
          modelId,
          requestType: modelType,
          inputSummary,
          inputImageCount,
          outputText: errMsg,
          outputImageCount: 0,
          durationMs: Date.now() - startTime,
          status: 'error',
          error: errMsg,
          rawRequest: sanitizeForLog(requestBody),
        };
        onLog?.(errorEntry);

        return { success: false, text: '', images: [], modelParts: [], error: errMsg };
      }

      const data = await response.json();
      // 🔑 根据 provider 使用不同的解析器
      const result = provider === 'bailian'
        ? parseOpenAIResponse(data)
        : parseGeminiResponse(data as GeminiResponse);
      const durationMs = Date.now() - startTime;

      // 写入日志（含原始请求和返回）
      // 🔑 token 统计兼容 Gemini（usageMetadata）和 OpenAI（usage）格式
      const tokenInfo = data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        candidatesTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        candidatesTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined;

      const logEntry: LogEntry = {
        id: uuidv4(),
        timestamp: Date.now(),
        functionTag,
        phase,
        modelId,
        requestType: modelType,
        inputSummary,
        inputImageCount,
        outputText: result.text.slice(0, 500),
        outputImageCount: result.images.length,
        durationMs,
        tokensUsed: tokenInfo,
        status: result.success ? 'success' : 'error',
        error: result.error,
        rawRequest: sanitizeForLog(actualRequestForLog),
        rawResponse: sanitizeForLog(data),
      };
      onLog?.(logEntry);

      return result;

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onGlobalAbort);

      const err = error as Error;

      if (err.name === 'AbortError') {
        if (signal?.aborted) {
          // 用户主动取消
          return { success: false, text: '', images: [], modelParts: [], error: '用户取消' };
        }
        // 超时 — 指数退避重试
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`[织梦AI] 请求超时 (${timeoutMs}ms)，指数退避 ${Math.round(backoffMs)}ms 后重试...`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }
        const timeoutEntry: LogEntry = {
          id: uuidv4(), timestamp: Date.now(), functionTag, phase, modelId,
          requestType: modelType, inputSummary, inputImageCount,
          outputText: '', outputImageCount: 0,
          durationMs: Date.now() - startTime,
          status: 'timeout', error: '请求超时',
          rawRequest: sanitizeForLog(requestBody),
        };
        onLog?.(timeoutEntry);
        return { success: false, text: '', images: [], modelParts: [], error: '请求超时' };
      }

      // 其他网络错误 — 指数退避重试
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`[织梦AI] 网络错误，指数退避 ${Math.round(backoffMs)}ms 后重试...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      const errEntry: LogEntry = {
        id: uuidv4(), timestamp: Date.now(), functionTag, phase, modelId,
        requestType: modelType, inputSummary, inputImageCount,
        outputText: '', outputImageCount: 0,
        durationMs: Date.now() - startTime,
        status: 'error', error: err.message,
        rawRequest: sanitizeForLog(requestBody),
      };
      onLog?.(errEntry);
      return { success: false, text: '', images: [], modelParts: [], error: err.message };
    }
  }

  return { success: false, text: '', images: [], modelParts: [], error: '超出最大重试次数' };
}

// ============================================================
// 动态并发池
// ============================================================

export interface ConcurrentPoolOptions<T> {
  /** 任务列表 */
  tasks: Array<{
    id: string;
    label: string;
    execute: () => Promise<T>;
  }>;
  /** 并发数量（动态，默认=任务数量，但受上限约束） */
  concurrency?: number;
  /** 进度回调 */
  onProgress?: (completed: number, total: number, taskId: string, result: T) => void;
  /** 单个任务失败回调 */
  onTaskError?: (taskId: string, error: Error) => void;
  /** 全局取消信号 */
  signal?: AbortSignal;
}

/**
 * 动态并发执行多个任务
 * - 默认并发数 = Math.min(tasks.length, 4)
 * - 支持取消、进度回调、错误隔离
 */
export async function runConcurrentPool<T>(
  options: ConcurrentPoolOptions<T>
): Promise<Map<string, T | Error>> {
  const {
    tasks,
    concurrency = Math.min(tasks.length, 4), // 🔑 动态并发：4张=4并发
    onProgress,
    onTaskError,
    signal,
  } = options;

  const results = new Map<string, T | Error>();
  let nextIndex = 0;
  let completed = 0;
  const total = tasks.length;

  async function runWorker(): Promise<void> {
    while (nextIndex < total) {
      if (signal?.aborted) break;

      const currentIndex = nextIndex++;
      const task = tasks[currentIndex];

      try {
        const result = await task.execute();
        results.set(task.id, result);
        completed++;
        onProgress?.(completed, total, task.id, result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.set(task.id, err);
        completed++;
        onTaskError?.(task.id, err);
        // 不中断其他任务
      }
    }
  }

  // 启动 N 个 worker
  const actualConcurrency = Math.min(concurrency, total);
  console.log(`[并发池] 启动 ${actualConcurrency} 个 worker，共 ${total} 个任务`);

  await Promise.all(
    Array.from({ length: actualConcurrency }, () => runWorker())
  );

  return results;
}

/**
 * 快捷生成纯文本内容的辅助函数
 *
 * 🔑 v2.1 升级：
 * - 动态 API URL 生成
 * - 自动注入日志（含原始请求/返回）
 * - 返回完整 result 对象用于上层获取 rawResponse
 */
export interface GenerateContentOptions {
  apiKey: string;
  requestBody: GeminiRequestBody;
  modelId: string;
  /** 百炼API Key（使用百炼模型时需要） */
  bailianApiKey?: string;
  /** 日志写入回调（可选） */
  onLog?: (entry: LogEntry) => void;
  /** 功能标签（默认 prompt_analysis） */
  functionTag?: FunctionTag;
  /** 取消信号 */
  signal?: AbortSignal;
}

/**
 * 生成纯文本内容（含日志注入）
 * @returns 原始文本结果
 */
export async function generateContent(
  apiKeyOrOpts: string | GenerateContentOptions,
  requestBody?: GeminiRequestBody,
  modelId?: string,
): Promise<string> {
  // 兼容旧的三参数调用方式
  let opts: GenerateContentOptions;
  if (typeof apiKeyOrOpts === 'string') {
    opts = {
      apiKey: apiKeyOrOpts,
      requestBody: requestBody!,
      modelId: modelId || 'gemini-3.1-pro-preview',
    };
  } else {
    opts = apiKeyOrOpts;
  }

  // 🔑 根据模型判断提供商
  const provider = getProviderForModel(opts.modelId);
  const effectiveApiKey = provider === 'bailian' ? (opts.bailianApiKey || opts.apiKey) : opts.apiKey;
  const apiUrl = provider === 'bailian' ? getBailianChatUrl() : getTextApiUrl(opts.modelId);
  const startTime = Date.now();

  // 统计图片数量
  let inputImageCount = 0;
  opts.requestBody.contents.forEach(c => {
    c.parts.forEach(p => {
      if (p.inlineData || p.inline_data) inputImageCount++;
    });
  });

  const inputSummary = opts.requestBody.contents
    .flatMap(c => c.parts.filter(p => p.text).map(p => p.text!))
    .join(' ')
    .slice(0, 300);

  // 🔑 根据 provider 构建请求
  let fetchUrl: string;
  let fetchHeaders: Record<string, string>;
  let fetchBodyStr: string;

  if (provider === 'bailian') {
    fetchUrl = apiUrl;
    fetchHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${effectiveApiKey}`,
    };
    fetchBodyStr = JSON.stringify(buildOpenAIRequestBody(opts.requestBody, opts.modelId));
  } else {
    fetchUrl = `${apiUrl}?key=${effectiveApiKey}`;
    fetchHeaders = { 'Content-Type': 'application/json' };
    fetchBodyStr = JSON.stringify(opts.requestBody);
  }

  const fetchOpts: RequestInit = {
    method: 'POST',
    headers: fetchHeaders,
    body: fetchBodyStr,
  };
  if (opts.signal) fetchOpts.signal = opts.signal;

  const response = await fetch(fetchUrl, fetchOpts);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP ${response.status}`;

    // 写入错误日志
    if (opts.onLog) {
      opts.onLog({
        id: uuidv4(),
        timestamp: Date.now(),
        functionTag: opts.functionTag || 'prompt_analysis',
        modelId: opts.modelId,
        requestType: 'text',
        inputSummary,
        inputImageCount,
        outputText: errMsg,
        outputImageCount: 0,
        durationMs: Date.now() - startTime,
        status: 'error',
        error: errMsg,
        rawRequest: sanitizeForLog(opts.requestBody),
        rawResponse: sanitizeForLog(errData),
      });
    }

    throw new Error(errMsg);
  }

  const data = await response.json();
  // 🔑 根据 provider 解析响应
  const result = provider === 'bailian'
    ? parseOpenAIResponse(data)
    : parseGeminiResponse(data as GeminiResponse);
  const durationMs = Date.now() - startTime;

  // 写入成功日志
  if (opts.onLog) {
    opts.onLog({
      id: uuidv4(),
      timestamp: Date.now(),
      functionTag: opts.functionTag || 'prompt_analysis',
      modelId: opts.modelId,
      requestType: 'text',
      inputSummary,
      inputImageCount,
      outputText: result.text.slice(0, 500),
      outputImageCount: result.images.length,
      durationMs,
      tokensUsed: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        candidatesTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
      status: result.success ? 'success' : 'error',
      error: result.error,
      rawRequest: sanitizeForLog(opts.requestBody),
      rawResponse: sanitizeForLog(data),
    });
  }

  if (!result.success) throw new Error(result.error);
  return result.text;
}
