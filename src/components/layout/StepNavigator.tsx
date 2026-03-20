/**
 * 步骤导航组件 — 四步流程导航
 */

import { useAppStore } from '../../stores/useAppStore';
import { useLogStore } from '../../stores/useLogStore';

const STEPS = [
  { phase: 1, emoji: '🎨', label: '花型提取' },
  { phase: 2, emoji: '🛏️', label: '铺床渲染' },
  { phase: 3, emoji: '📸', label: '一键营销出图' },
] as const;

export default function StepNavigator() {
  const { currentPhase, setPhase } = useAppStore();
  const { togglePanel, unreadCount } = useLogStore();

  return (
    <nav className="step-nav">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <span className="text-lg">🧵</span>
        <span className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          织梦AI
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono">
          v2.0
        </span>
      </div>

      {/* 步骤 */}
      {STEPS.map((step, idx) => (
        <div key={step.phase} className="flex items-center">
          {idx > 0 && (
            <div
              className={`step-connector ${currentPhase > step.phase ? 'completed' : ''}`}
            />
          )}
          <button
            className={`step-item ${
              currentPhase === step.phase ? 'active' :
              currentPhase > step.phase ? 'completed' : ''
            }`}
            onClick={() => {
              // 🔑 工作流解耦：允许用户跳转到任意步骤
              setPhase(step.phase as 1 | 2 | 3);
            }}
          >
            <span className="text-base">{step.emoji}</span>
            <span>{step.label}</span>
            {currentPhase > step.phase && <span className="text-xs">✓</span>}
          </button>
        </div>
      ))}

      {/* 右侧工具栏 */}
      <div className="ml-auto flex items-center gap-2">
        {/* 日志按钮 */}
        <button
          className="btn-icon relative"
          onClick={togglePanel}
          title="查看请求日志"
        >
          📋
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
