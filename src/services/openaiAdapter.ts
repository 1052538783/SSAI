/**
 * OpenAI 兼容格式适配器 — 百炼 Qwen3.5 Plus
 *
 * 将 Gemini 原生格式的请求体转换为 OpenAI Chat Completions 格式,
 * 并将 OpenAI 响应解析为统一的 ParsedApiResult。
 *
 * 🔑 核心功能：
 * - Gemini parts → OpenAI messages 转换
 * - inlineData base64 → data:image/xxx;base64,xxx URL 格式
 * - OpenAI response → ParsedApiResult 统一解析
 */

import type { GeminiRequestBody, ParsedApiResult, ApiPart } from '../types/api';

// ============================================================
// 请求转换：Gemini → OpenAI
// ============================================================

/** OpenAI 格式消息内容（多模态） */
interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

/** OpenAI Chat Completions 请求体 */
interface OpenAIChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | OpenAIContentPart[];
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/** OpenAI Chat Completions 响应体 */
interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

/**
 * 将 Gemini 格式请求体转换为 OpenAI Chat Completions 格式
 * @param geminiBody Gemini 原生格式请求体
 * @param modelId 百炼模型 ID（如 qwen3.5-plus）
 */
export function buildOpenAIRequestBody(
  geminiBody: GeminiRequestBody,
  modelId: string,
): OpenAIChatRequest {
  const messages: OpenAIChatRequest['messages'] = [];

  for (const content of geminiBody.contents) {
    const role = content.role === 'model' ? 'assistant' : 'user';
    const contentParts: OpenAIContentPart[] = [];
    let hasMultiModal = false;

    for (const part of content.parts) {
      if (part.text) {
        contentParts.push({ type: 'text', text: part.text });
      }

      // 处理 inlineData / inline_data → image_url
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData?.data) {
        hasMultiModal = true;
        const dataUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`;
        contentParts.push({
          type: 'image_url',
          image_url: { url: dataUrl },
        });
      }
    }

    // 如果只有纯文本，使用简单 string 格式
    if (!hasMultiModal && contentParts.length === 1 && contentParts[0].type === 'text') {
      messages.push({ role, content: contentParts[0].text! });
    } else {
      messages.push({ role, content: contentParts });
    }
  }

  const request: OpenAIChatRequest = {
    model: modelId,
    messages,
    stream: false,
  };

  // 传递 temperature
  if (geminiBody.generationConfig?.temperature !== undefined) {
    request.temperature = geminiBody.generationConfig.temperature;
  }

  return request;
}

// ============================================================
// 响应解析：OpenAI → ParsedApiResult
// ============================================================

/**
 * 将 OpenAI Chat Completions 响应解析为统一的 ParsedApiResult
 */
export function parseOpenAIResponse(data: OpenAIChatResponse): ParsedApiResult {
  // 错误响应
  if (data.error) {
    return {
      success: false,
      text: '',
      images: [],
      modelParts: [],
      error: data.error.message || 'OpenAI API 返回错误',
    };
  }

  if (!data.choices || data.choices.length === 0 || !data.choices[0].message?.content) {
    return {
      success: false,
      text: '',
      images: [],
      modelParts: [],
      error: `API未返回有效内容${data.choices?.[0]?.finish_reason ? ` (${data.choices[0].finish_reason})` : ''}`,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }

  const text = data.choices[0].message.content || '';

  // 构建兼容的 modelParts（百炼只返回文本，无 thoughtSignature）
  const modelParts: ApiPart[] = [{ text }];

  return {
    success: true,
    text,
    images: [], // 百炼 Qwen 分析模型不返回图片
    modelParts,
    tokensUsed: data.usage ? {
      promptTokenCount: data.usage.prompt_tokens,
      candidatesTokenCount: data.usage.completion_tokens,
      totalTokenCount: data.usage.total_tokens,
    } : undefined,
    finishReason: data.choices[0].finish_reason,
  };
}
