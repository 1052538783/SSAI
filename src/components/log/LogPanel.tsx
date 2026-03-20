/**
 * 日志面板组件 — 右侧抽屉式
 *
 * 🔑 v2.1 重构：
 * - 从 Phase1~4 过滤改为功能标签过滤（分析提示词 / 生成图像 / 系统）
 * - 展开后可查看 原始请求 和 原始返回（折叠面板，可复制）
 * - 图片 base64 在日志中以 [Base64 图片数据, NKB] 标注展示
 */

import { useState } from 'react';
import { useLogStore } from '../../stores/useLogStore';
import type { FunctionTag } from '../../types/state';

/** 功能标签的显示配置 */
const TAG_CONFIG: Record<FunctionTag, { label: string; emoji: string; color: string }> = {
  prompt_analysis: { label: '分析提示词', emoji: '🔍', color: 'text-purple-400' },
  image_generation: { label: '生成图像', emoji: '🎨', color: 'text-cyan-400' },
  system: { label: '系统', emoji: '⚙️', color: 'text-gray-400' },
};

export default function LogPanel() {
  const { entries, isOpen, setOpen, filterTag, setFilterTag, clearAll } = useLogStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 原始请求/返回的展开状态
  const [showRawSection, setShowRawSection] = useState<Record<string, 'request' | 'response' | null>>({});

  // 过滤
  const filtered = filterTag
    ? entries.filter(e => e.functionTag === filterTag)
    : entries;

  // Token 总计
  const totalTokens = entries.reduce((sum, e) => sum + (e.tokensUsed?.totalTokens || 0), 0);

  // 复制文本到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[8999]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 面板 */}
      <div className={`log-panel ${isOpen ? 'open' : ''}`}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-bold text-sm">请求日志</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
              {entries.length}条
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800/50"
              onClick={clearAll}
            >
              清空
            </button>
            <button
              className="btn-icon w-7 h-7 text-xs"
              onClick={() => setOpen(false)}
            >✕</button>
          </div>
        </div>

        {/* Token 统计 */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800/30 text-[11px] text-gray-500 flex-shrink-0">
          <span>总耗Token: <span className="text-cyan-400 font-mono">{totalTokens.toLocaleString()}</span></span>
          <span>成功: <span className="text-green-400 font-mono">{entries.filter(e => e.status === 'success').length}</span></span>
          <span>失败: <span className="text-red-400 font-mono">{entries.filter(e => e.status !== 'success').length}</span></span>
        </div>

        {/* 功能标签过滤 */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800/30 flex-shrink-0">
          <button
            className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
              filterTag === null
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setFilterTag(null)}
          >
            全部
          </button>
          {(Object.keys(TAG_CONFIG) as FunctionTag[]).map(tag => (
            <button
              key={tag}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                filterTag === tag
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => setFilterTag(tag)}
            >
              <span>{TAG_CONFIG[tag].emoji}</span>
              <span>{TAG_CONFIG[tag].label}</span>
              <span className="opacity-60">({entries.filter(e => e.functionTag === tag).length})</span>
            </button>
          ))}
        </div>

        {/* 日志列表 */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-600">
              暂无日志
            </div>
          ) : (
            filtered.map(entry => {
              const tagCfg = TAG_CONFIG[entry.functionTag] || TAG_CONFIG.system;
              const rawState = showRawSection[entry.id] || null;

              return (
                <div
                  key={entry.id}
                  className="log-entry"
                >
                  {/* 摘要行 */}
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      entry.status === 'success' ? 'log-badge-success' :
                      entry.status === 'timeout' ? 'log-badge-timeout' :
                      'log-badge-error'
                    }`}>
                      {entry.status === 'success' ? '✓' : entry.status === 'timeout' ? '⏱' : '✗'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString('zh-CN')}
                    </span>
                    <span className={`text-[10px] ${tagCfg.color} flex items-center gap-0.5`}>
                      <span>{tagCfg.emoji}</span>
                      <span>{tagCfg.label}</span>
                    </span>
                    <span className="text-[10px] text-gray-400 truncate flex-1" title={entry.modelId}>
                      {entry.modelId.replace('gemini-', '').replace('-preview', '')}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {(entry.durationMs / 1000).toFixed(1)}s
                    </span>
                    {entry.outputImageCount > 0 && (
                      <span className="text-[10px] text-cyan-400">
                        🖼{entry.outputImageCount}
                      </span>
                    )}
                  </div>

                  {/* 展开详情 */}
                  {expandedId === entry.id && (
                    <div className="mt-3 space-y-2 text-[11px] fade-in-up">
                      {/* 基本信息 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-gray-500">
                          <span className="text-gray-400 font-bold">模型：</span>
                          <span className="font-mono text-cyan-400">{entry.modelId}</span>
                        </div>
                        <div className="text-gray-500">
                          <span className="text-gray-400 font-bold">类型：</span>
                          {entry.requestType === 'image' ? '🖼 生图' : '💬 文本'}
                          &nbsp; | 输入图片: {entry.inputImageCount}张
                        </div>
                      </div>

                      {entry.tokensUsed && (
                        <div className="text-gray-500 bg-gray-900/30 p-2 rounded-lg">
                          <span className="text-gray-400 font-bold">Token：</span>
                          <span className="font-mono">
                            输入<span className="text-amber-400">{entry.tokensUsed.promptTokens.toLocaleString()}</span>
                            {' + '}输出<span className="text-emerald-400">{entry.tokensUsed.candidatesTokens.toLocaleString()}</span>
                            {' = '}<span className="text-cyan-400 font-bold">{entry.tokensUsed.totalTokens.toLocaleString()}</span>
                          </span>
                        </div>
                      )}

                      {/* Prompt 摘要 */}
                      <div>
                        <span className="text-gray-400 font-bold">Prompt摘要：</span>
                        <pre className="mt-1 p-2 rounded-lg bg-gray-900/50 text-gray-400 text-[10px] whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                          {entry.inputSummary}
                        </pre>
                      </div>

                      {/* 输出文本 */}
                      {entry.outputText && (
                        <div>
                          <span className="text-gray-400 font-bold">输出文本：</span>
                          <pre className="mt-1 p-2 rounded-lg bg-gray-900/50 text-gray-400 text-[10px] whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                            {entry.outputText}
                          </pre>
                        </div>
                      )}

                      {/* 错误信息 */}
                      {entry.error && (
                        <div className="p-2 rounded-lg bg-red-900/20 text-red-400 text-[10px]">
                          ❌ {entry.error}
                        </div>
                      )}

                      {/* 原始请求/返回切换按钮 */}
                      <div className="flex gap-2 mt-2">
                        {entry.rawRequest && (
                          <button
                            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
                              rawState === 'request'
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                                : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowRawSection(prev => ({
                                ...prev,
                                [entry.id]: prev[entry.id] === 'request' ? null : 'request',
                              }));
                            }}
                          >
                            📤 原始请求
                          </button>
                        )}
                        {entry.rawResponse && (
                          <button
                            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
                              rawState === 'response'
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowRawSection(prev => ({
                                ...prev,
                                [entry.id]: prev[entry.id] === 'response' ? null : 'response',
                              }));
                            }}
                          >
                            📥 原始返回
                          </button>
                        )}
                      </div>

                      {/* 原始请求展示 */}
                      {rawState === 'request' && entry.rawRequest && (
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-amber-400 font-bold">📤 原始请求体</span>
                            <button
                              className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded bg-gray-800/50"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(entry.rawRequest!); }}
                            >
                              📋 复制
                            </button>
                          </div>
                          <pre className="p-3 rounded-lg bg-gray-950/70 border border-amber-500/20 text-gray-400 text-[10px] whitespace-pre-wrap break-all max-h-64 overflow-y-auto font-mono">
                            {entry.rawRequest}
                          </pre>
                        </div>
                      )}

                      {/* 原始返回展示 */}
                      {rawState === 'response' && entry.rawResponse && (
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-emerald-400 font-bold">📥 原始返回体</span>
                            <button
                              className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded bg-gray-800/50"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(entry.rawResponse!); }}
                            >
                              📋 复制
                            </button>
                          </div>
                          <pre className="p-3 rounded-lg bg-gray-950/70 border border-emerald-500/20 text-gray-400 text-[10px] whitespace-pre-wrap break-all max-h-64 overflow-y-auto font-mono">
                            {entry.rawResponse}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
