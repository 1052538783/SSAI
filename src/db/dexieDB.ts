/**
 * Dexie.js 数据库定义
 * 替代原有的 IndexedDB 手动管理
 */

import Dexie, { type Table } from 'dexie';

// ============================================================
// 数据库表记录类型
// ============================================================

/** 花型历史记录 */
export interface PatternRecord {
  id?: number;
  base64: string;
  index: number;
  regionTag: string;
  timestamp: number;
}

/** 效果图历史记录 */
export interface RenderRecord {
  id?: number;
  base64: string;
  timestamp: number;
}

/** 应用状态键值对 */
export interface AppStateRecord {
  key: string;
  value: string;
}

/** 日志记录（持久化） */
export interface LogRecord {
  id?: number;
  timestamp: number;
  /** 功能标签（新）：prompt_analysis / image_generation / system */
  functionTag: string;
  /** 兼容旧代码：保留 phase 字段 */
  phase?: number;
  modelId: string;
  requestType: string;
  inputSummary: string;
  inputImageCount: number;
  outputText: string;
  outputImageCount: number;
  durationMs: number;
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  error?: string;
  status: string;
  /** 原始请求体JSON（图片base64已安全截断） */
  rawRequest?: string;
  /** 原始返回体JSON（图片base64已安全截断） */
  rawResponse?: string;
}

// ============================================================
// 数据库类
// ============================================================

class ZhimengDatabase extends Dexie {
  patterns!: Table<PatternRecord>;
  renders!: Table<RenderRecord>;
  appState!: Table<AppStateRecord>;
  logs!: Table<LogRecord>;

  constructor() {
    super('ZhimengAI_v2');

    // v1 初始 schema
    this.version(1).stores({
      patterns: '++id, index, timestamp',
      renders: '++id, timestamp',
      appState: 'key',
      logs: '++id, timestamp, phase, status',
    });

    // v2 升级：日志表新增 functionTag 索引
    this.version(2).stores({
      patterns: '++id, index, timestamp',
      renders: '++id, timestamp',
      appState: 'key',
      logs: '++id, timestamp, functionTag, status',
    }).upgrade(tx => {
      // 旧日志记录进行迁移：根据 phase 自动推断 functionTag
      return tx.table('logs').toCollection().modify(log => {
        if (!log.functionTag) {
          if (log.requestType === 'text') {
            log.functionTag = 'prompt_analysis';
          } else if (log.requestType === 'image') {
            log.functionTag = 'image_generation';
          } else {
            log.functionTag = 'system';
          }
        }
      });
    });
  }
}

/** 数据库单例 */
export const db = new ZhimengDatabase();

// ============================================================
// 辅助方法
// ============================================================

/** 保存花型到数据库 */
export async function savePattern(base64: string, index: number, regionTag: string): Promise<number> {
  const id = await db.patterns.add({
    base64,
    index,
    regionTag,
    timestamp: Date.now(),
  });
  // 只保留最新20条
  const count = await db.patterns.count();
  if (count > 20) {
    const oldest = await db.patterns.orderBy('timestamp').limit(count - 20).toArray();
    await db.patterns.bulkDelete(oldest.map(r => r.id!));
  }
  return id as number;
}

/** 保存效果图到数据库 */
export async function saveRender(base64: string): Promise<number> {
  const id = await db.renders.add({ base64, timestamp: Date.now() });
  const count = await db.renders.count();
  if (count > 20) {
    const oldest = await db.renders.orderBy('timestamp').limit(count - 20).toArray();
    await db.renders.bulkDelete(oldest.map(r => r.id!));
  }
  return id as number;
}

/** 获取所有花型历史 */
export async function getPatternHistory(): Promise<PatternRecord[]> {
  return db.patterns.orderBy('timestamp').reverse().toArray();
}

/** 获取所有效果图历史 */
export async function getRenderHistory(): Promise<RenderRecord[]> {
  return db.renders.orderBy('timestamp').reverse().toArray();
}

/** 保存应用状态 */
export async function saveAppStateValue(key: string, value: string): Promise<void> {
  await db.appState.put({ key, value });
}

/** 加载应用状态 */
export async function loadAppStateValue(key: string): Promise<string | undefined> {
  const record = await db.appState.get(key);
  return record?.value;
}

/** 删除花型 */
export async function deletePattern(id: number): Promise<void> {
  await db.patterns.delete(id);
}

/** 删除效果图 */
export async function deleteRender(id: number): Promise<void> {
  await db.renders.delete(id);
}

/** 保存日志 */
export async function saveLog(entry: LogRecord): Promise<void> {
  await db.logs.add(entry);
  // 只保留最新500条日志
  const count = await db.logs.count();
  if (count > 500) {
    const oldest = await db.logs.orderBy('timestamp').limit(count - 500).toArray();
    await db.logs.bulkDelete(oldest.map(r => r.id!));
  }
}

/** 获取所有日志 */
export async function getLogs(): Promise<LogRecord[]> {
  return db.logs.orderBy('timestamp').reverse().limit(100).toArray();
}

/** 清空日志 */
export async function clearLogs(): Promise<void> {
  await db.logs.clear();
}
