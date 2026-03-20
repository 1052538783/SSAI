/**
 * ImageOverlayToolbar — 通用图片悬浮工具栏组件
 * 鼠标Hover时显示底部渐变遮罩 + 操作按钮工具栏
 * 触摸设备上始终可见
 */

interface ToolbarAction {
  icon: string;        // emoji 图标
  label: string;       // 文字标签
  onClick: () => void;
  variant?: 'default' | 'danger' | 'accent';
}

interface Props {
  actions: ToolbarAction[];
  /** 是否使用精简模式（不显示文字标签，仅图标） */
  compact?: boolean;
}

/**
 * 用法示例：
 * <div className="group relative">
 *   <img ... />
 *   <ImageOverlayToolbar actions={[
 *     { icon: '✏️', label: '微调', onClick: ... },
 *     { icon: '🗑️', label: '删除', onClick: ..., variant: 'danger' },
 *   ]} />
 * </div>
 */
export default function ImageOverlayToolbar({ actions, compact = false }: Props) {
  if (actions.length === 0) return null;

  // 根据 variant 选择按钮样式
  const getButtonClass = (variant?: 'default' | 'danger' | 'accent') => {
    const base = 'image-toolbar-btn';
    switch (variant) {
      case 'danger': return `${base} image-toolbar-btn-danger`;
      case 'accent': return `${base} image-toolbar-btn-accent`;
      default: return base;
    }
  };

  return (
    <div className="image-overlay-toolbar">
      {/* 底部渐变遮罩 */}
      <div className="image-overlay-gradient" />
      {/* 按钮容器 */}
      <div className="image-toolbar-buttons">
        {actions.map((action, i) => (
          <button
            key={i}
            className={getButtonClass(action.variant)}
            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
            title={action.label}
          >
            <span className="text-sm">{action.icon}</span>
            {!compact && <span className="text-[10px] font-medium leading-none">{action.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
