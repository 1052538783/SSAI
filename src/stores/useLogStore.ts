/**
 * 日志状态管理 (Zustand)
 * 管理前端日志面板的显示状态和日志条目
 *
 * 🔑 v2.1 升级：
 * - 从 phase 过滤改为 functionTag 过滤
 * - 支持 rawRequest/rawResponse 新字段
 */

import { create } from 'zustand';
import type { LogEntry, FunctionTag } from '../types/state';
import { saveLog as saveLogToDB, getLogs, clearLogs as clearLogsDB, type LogRecord } from '../db/dexieDB';

interface LogState {
  /** 日志条目列表 */
  entries: LogEntry[];
  /** 日志面板是否展开 */
  isOpen: boolean;
  /** 未读日志数 */
  unreadCount: number;
  /** 当前过滤的功能标签（null=全部） */
  filterTag: FunctionTag | null;

  // --- Actions ---
  addLog: (entry: LogEntry) => void;
  togglePanel: () => void;
  setOpen: (val: boolean) => void;
  clearUnread: () => void;
  setFilterTag: (tag: FunctionTag | null) => void;
  clearAll: () => void;
  loadFromDB: () => Promise<void>;
}

/** 将 LogEntry 转换为 DB 记录 */
function toDBRecord(entry: LogEntry): LogRecord {
  return {
    timestamp: entry.timestamp,
    functionTag: entry.functionTag,
    phase: entry.phase,
    modelId: entry.modelId,
    requestType: entry.requestType,
    inputSummary: entry.inputSummary,
    inputImageCount: entry.inputImageCount,
    outputText: entry.outputText,
    outputImageCount: entry.outputImageCount,
    durationMs: entry.durationMs,
    promptTokens: entry.tokensUsed?.promptTokens,
    candidatesTokens: entry.tokensUsed?.candidatesTokens,
    totalTokens: entry.tokensUsed?.totalTokens,
    error: entry.error,
    status: entry.status,
    rawRequest: entry.rawRequest,
    rawResponse: entry.rawResponse,
  };
}

export const useLogStore = create<LogState>((set, get) => ({
  entries: [],
  isOpen: false,
  unreadCount: 0,
  filterTag: null,

  addLog: (entry) => {
    set((s) => ({
      entries: [entry, ...s.entries].slice(0, 200), // 内存中最多200条
      unreadCount: s.isOpen ? 0 : s.unreadCount + 1,
    }));
    // 异步写入 DB
    saveLogToDB(toDBRecord(entry)).catch(console.error);
  },

  togglePanel: () => set((s) => ({
    isOpen: !s.isOpen,
    unreadCount: !s.isOpen ? 0 : s.unreadCount, // 打开时清零
  })),

  setOpen: (val) => set({
    isOpen: val,
    unreadCount: val ? 0 : get().unreadCount,
  }),

  clearUnread: () => set({ unreadCount: 0 }),

  setFilterTag: (tag) => set({ filterTag: tag }),

  clearAll: () => {
    set({ entries: [], unreadCount: 0 });
    clearLogsDB().catch(console.error);
  },

  loadFromDB: async () => {
    try {
      const dbLogs = await getLogs();
      const entries: LogEntry[] = dbLogs.map((r) => ({
        id: String(r.id || r.timestamp),
        timestamp: r.timestamp,
        functionTag: (r.functionTag as FunctionTag) || 'system',
        phase: r.phase as 1 | 2 | 3 | 4 | undefined,
        modelId: r.modelId,
        requestType: r.requestType as 'image' | 'text',
        inputSummary: r.inputSummary,
        inputImageCount: r.inputImageCount,
        outputText: r.outputText,
        outputImageCount: r.outputImageCount,
        durationMs: r.durationMs,
        tokensUsed: r.totalTokens ? {
          promptTokens: r.promptTokens || 0,
          candidatesTokens: r.candidatesTokens || 0,
          totalTokens: r.totalTokens,
        } : undefined,
        error: r.error,
        status: r.status as 'success' | 'error' | 'timeout' | 'cancelled',
        rawRequest: r.rawRequest,
        rawResponse: r.rawResponse,
      }));
      set({ entries });
    } catch (e) {
      console.error('[LogStore] 加载日志失败:', e);
    }
  },
}));
