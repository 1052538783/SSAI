/**
 * useGemini — API 调用 Hook
 * 封装 GeminiService 为 React Hook 形式
 */

import { useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useLogStore } from '../stores/useLogStore';
import { callGeminiApi } from '../services/gemini';
import type { GeminiRequestBody, ParsedApiResult } from '../types/api';
import type { AppPhase } from '../types/state';

export function useGemini() {
  const apiKey = useAppStore(s => s.apiKey);
  const { addLog } = useLogStore();
  const abortRef = useRef<AbortController | null>(null);

  /** 发送请求 */
  const callApi = useCallback(async (
    requestBody: GeminiRequestBody,
    options?: {
      modelType?: 'image' | 'text';
      phase?: AppPhase;
      timeoutMs?: number;
    }
  ): Promise<ParsedApiResult> => {
    if (!apiKey) {
      return { success: false, text: '', images: [], modelParts: [], error: 'API Key 未设置' };
    }

    abortRef.current = new AbortController();

    return callGeminiApi({
      apiKey,
      requestBody,
      modelType: options?.modelType || 'image',
      phase: options?.phase || 1,
      timeoutMs: options?.timeoutMs,
      signal: abortRef.current.signal,
      onLog: addLog,
    });
  }, [apiKey, addLog]);

  /** 取消正在进行的请求 */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { callApi, cancel, isReady: !!apiKey };
}
