/**
 * 移动端底部导航 — 替代桌面端左侧面板
 * Plan 要求：平板两栏 → 移动端单栏（竖屏触摸友好）
 */


import { useAppStore } from '../../stores/useAppStore';

interface Props {
  onOpenUploadSheet: () => void;
  onOpenSettingsSheet: () => void;
}

export default function MobileBottomNav({ onOpenUploadSheet, onOpenSettingsSheet }: Props) {
  const { currentPhase } = useAppStore();

  return (
    <nav className="hidden max-md:flex fixed bottom-0 left-0 right-0 z-[6000] bg-[rgba(10,14,26,0.95)] border-t border-gray-800/50 px-2 py-1">
      <button
        className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] text-gray-400 active:text-indigo-400 transition-colors"
        onClick={onOpenUploadSheet}
      >
        <span className="text-lg">📂</span>
        <span>上传</span>
      </button>
      <button
        className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] text-gray-400 active:text-indigo-400 transition-colors"
        onClick={onOpenSettingsSheet}
      >
        <span className="text-lg">⚙️</span>
        <span>设置</span>
      </button>
      <button className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] text-indigo-400">
        <span className="text-lg">
          {currentPhase === 1 ? '🎨' : currentPhase === 2 ? '🛏️' : currentPhase === 3 ? '📸' : '📋'}
        </span>
        <span>画布</span>
      </button>
    </nav>
  );
}
