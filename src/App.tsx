/**
 * 织梦AI v2.0 — 入口组件
 * 三栏布局（左控制面板 + 中画布 + 右日志面板）
 * + PromptControlCenter + 移动端适配
 *
 * 🔑 v2.2：API Key 不再持久化，每次启动需重新输入
 */

import { useEffect, useCallback, useState } from 'react';
import { useLogStore } from './stores/useLogStore';
import StepNavigator from './components/layout/StepNavigator';
import LeftPanel from './components/layout/LeftPanel';
import CenterCanvas from './components/layout/CenterCanvas';
import LogPanel from './components/log/LogPanel';
import PromptControlCenter from './components/prompt/PromptControlCenter';
import MobileBottomNav from './components/layout/MobileBottomNav';
import Toast, { type ToastItem } from './components/common/Toast';
import ImageModal from './components/common/ImageModal';

function App() {
  const { loadFromDB } = useLogStore();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modalImage, setModalImage] = useState<string | null>(null);

  // 初始化：仅加载日志（Key 不再持久化）
  useEffect(() => {
    (async () => {
      try {
        await loadFromDB();
      } catch (e) {
        console.error('[织梦AI] 初始化失败:', e);
      }
    })();
  }, [loadFromDB]);

  // Toast 通知
  const showToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    duration = 3000,
  ) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  // 图片弹窗
  const openImageModal = useCallback((base64: string) => {
    setModalImage(base64);
  }, []);

  const closeImageModal = useCallback(() => {
    setModalImage(null);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 顶部步骤导航 */}
      <StepNavigator />

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧控制面板（桌面端可见） */}
        <LeftPanel showToast={showToast} />

        {/* 中间画布区 */}
        <CenterCanvas
          showToast={showToast}
          openImageModal={openImageModal}
        />
      </div>

      {/* 提示词控制中心（底部浮动面板） */}
      <PromptControlCenter />

      {/* 日志面板（右侧抽屉） */}
      <LogPanel />

      {/* 移动端底部导航 */}
      <MobileBottomNav
        onOpenUploadSheet={() => showToast('移动端上传功能', 'info')}
        onOpenSettingsSheet={() => showToast('移动端设置功能', 'info')}
      />

      {/* Toast 通知容器 */}
      <Toast toasts={toasts} />

      {/* 图片放大弹窗 */}
      {modalImage && (
        <ImageModal base64={modalImage} onClose={closeImageModal} />
      )}
    </div>
  );
}

export default App;
