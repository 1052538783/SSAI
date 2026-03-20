/**
 * 图片放大弹窗组件
 */

import { downloadBase64Image } from '../../services/imageUtils';

interface Props {
  base64: string;
  onClose: () => void;
}

export default function ImageModal({ base64, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={`data:image/png;base64,${base64}`}
          alt="放大预览"
          className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
        />
        {/* 工具栏 */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            className="w-8 h-8 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={() => downloadBase64Image(base64)}
            title="下载"
          >
            💾
          </button>
          <button
            className="w-8 h-8 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={onClose}
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
