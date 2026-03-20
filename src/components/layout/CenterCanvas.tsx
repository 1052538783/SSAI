/**
 * CenterCanvas — 瘦路由容器
 * 职责：
 * 1. 根据 currentPhase 渲染对应的 Phase 子组件
 * 2. 渲染对话历史（通用）
 * 3. 管理滚动
 */

import { useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import Phase1PatternExtract from '../phases/Phase1PatternExtract';
import Phase2BedRender from '../phases/Phase2BedRender';
import Phase3MaterialLibrary from '../phases/Phase3MaterialLibrary';

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  openImageModal: (base64: string) => void;
}

export default function CenterCanvas({ showToast, openImageModal }: Props) {
  const currentPhase = useAppStore(s => s.currentPhase);
  const chatMessages = useAppStore(s => s.chatMessages);
  const uploadedImages = useAppStore(s => s.uploadedImages);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚到底 — 仅在新增用户消息时触发，系统消息（如AI分析进度）不触发
  // 这样可以防止点击"AI分析参考图"按钮时页面跳转到底部详情图区域
  const prevLenRef = useRef(chatMessages.length);
  useEffect(() => {
    if (scrollRef.current && chatMessages.length > prevLenRef.current) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      // 只有用户消息才自动滚到底，其他系统提示消息不触发滚动
      if (lastMsg && lastMsg.role === 'user') {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevLenRef.current = chatMessages.length;
  }, [chatMessages.length]);

  return (
    <main className="flex-1 flex flex-col overflow-hidden max-md:w-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 对话历史（通用） */}
        {chatMessages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' :
              msg.role === 'ai' ? 'justify-start' : 'justify-center'
            } fade-in-up`}
          >
            {msg.role === 'user' ? (
              <div className="chat-bubble-user max-w-[80%]">
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                {msg.images && msg.images.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {msg.images.map((img, i) => (
                      <img
                        key={i}
                        src={`data:image/png;base64,${img}`}
                        alt="" className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80"
                        onClick={() => openImageModal(img)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : msg.role === 'ai' ? (
              <div className="chat-bubble-ai max-w-[80%]">
                {msg.text && <p className="text-sm whitespace-pre-wrap mb-2">{msg.text}</p>}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {msg.images.map((img, i) => (
                      <img
                        key={i}
                        src={`data:image/png;base64,${img}`}
                        alt="" className="w-40 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => openImageModal(img)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={`text-xs px-3 py-1.5 rounded-full ${
                msg.role === 'system-success'
                  ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                  : 'bg-gray-800/50 text-gray-500 border border-gray-700/20'
              }`}>
                {msg.text}
              </div>
            )}
          </div>
        ))}

        {/* 空状态引导 */}
        {chatMessages.length === 0 && currentPhase !== 1 && (
          <div className="flex-1 flex items-center justify-center min-h-[40vh]">
            <div className="text-center glass-card-static p-8 max-w-sm">
              <div className="text-5xl mb-3">
                {currentPhase === 2 ? '🛏️' : currentPhase === 3 ? '📸' : '📋'}
              </div>
              <h3 className="text-base font-bold mb-2">
                {currentPhase === 2 ? '铺床渲染' : '一键营销出图'}
              </h3>
              <p className="text-xs text-gray-500">
                {currentPhase === 2 ? '将确认的花型渲染到逼真的床品场景上。' : '一键直出4张核心主图及8张高转化详情。'}
              </p>
            </div>
          </div>
        )}

        {/* Phase 1 专属空状态：如果没有聊天记录，且没有上传图片，且由内部组件自己决定（这里仅展示占位或由内部处理） */}
        {chatMessages.length === 0 && currentPhase === 1 && uploadedImages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50 min-h-[20vh] pointer-events-none">
             {/* 占位，避免画面太空，真正的引导在左边栏或历史花型区 */}
             <div className="text-4xl mb-2">🎨</div>
             <p className="text-sm text-gray-400">请在左侧上传参考图或从历史列表中选择</p>
          </div>
        )}

        {/* Phase 子组件 */}
        {currentPhase === 1 && <Phase1PatternExtract showToast={showToast} openImageModal={openImageModal} />}
        {currentPhase === 2 && <Phase2BedRender showToast={showToast} openImageModal={openImageModal} />}
        {currentPhase === 3 && <Phase3MaterialLibrary showToast={showToast} openImageModal={openImageModal} />}
      </div>
    </main>
  );
}
