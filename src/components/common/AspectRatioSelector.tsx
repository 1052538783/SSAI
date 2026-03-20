/**
 * AspectRatioSelector — 通用宽高比选择器组件
 * 适用于所有生图步骤，提供标准预设 + AI 推荐标识
 */

import { ASPECT_RATIO_OPTIONS } from '../../config/models';

interface Props {
  value: string;
  onChange: (ratio: string) => void;
  /** AI 推荐的宽高比（如果有） */
  recommended?: string | null;
  /** 紧凑模式（不显示描述文字） */
  compact?: boolean;
}

export default function AspectRatioSelector({ value, onChange, recommended, compact = false }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {ASPECT_RATIO_OPTIONS.map(opt => {
          const isSelected = value === opt.value;
          const isRecommended = recommended === opt.value;
          return (
            <button
              key={opt.value}
              className={`relative px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                  : isRecommended
                    ? 'bg-amber-500/10 border-amber-400/30 text-amber-300 hover:bg-amber-500/20'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
              onClick={() => onChange(opt.value)}
              title={opt.desc}
            >
              <span className="mr-1">{opt.icon}</span>
              <span>{opt.label}</span>
              {isRecommended && !isSelected && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-amber-500 text-black px-1 rounded-full font-bold leading-tight">
                  推荐
                </span>
              )}
              {isRecommended && isSelected && (
                <span className="ml-1 text-[8px] text-amber-400">⭐</span>
              )}
            </button>
          );
        })}
      </div>
      {!compact && (
        <div className="text-[10px] text-gray-500">
          当前：{ASPECT_RATIO_OPTIONS.find(o => o.value === value)?.desc || value}
          {recommended && recommended !== value && (
            <span className="text-amber-400 ml-2">📐 推荐 {recommended}</span>
          )}
        </div>
      )}
    </div>
  );
}
