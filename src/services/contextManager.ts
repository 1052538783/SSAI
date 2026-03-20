/**
 * ContextManager — 管理多轮对话上下文
 *
 * 🔑 关键职责：
 * 1. 维护 conversationHistory（含 ThoughtSignature）
 * 2. 确保 model turn 的 parts 中 thoughtSignature 被完整保留
 * 3. 防止重复 push（原代码的bug）
 * 4. 提供安全的上下文追加/重置方法
 */

import type { ApiPart, ApiContent } from '../types/api';
import type { ConversationTurn } from '../types/state';

export class ContextManager {
  /** 完整的对话历史 */
  private history: ConversationTurn[] = [];

  /** 获取当前历史副本（用于构建请求） */
  getHistory(): ApiContent[] {
    return this.history.map(turn => ({
      role: turn.role,
      parts: turn.parts,
    }));
  }

  /** 获取历史长度 */
  get length(): number {
    return this.history.length;
  }

  /**
   * 追加 user turn（文本 + 可选图片）
   */
  addUserTurn(text: string, images?: Array<{ mimeType: string; data: string }>): void {
    const parts: ApiPart[] = [{ text }];
    if (images) {
      images.forEach(img => {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      });
    }
    this.history.push({ role: 'user', parts });
  }

  /**
   * 追加 model turn（从 API 响应解析后的 parts）
   * 🔑 会自动保留 thoughtSignature
   * 🔑 防止重复 push（检查最后一条是否已是相同内容）
   */
  addModelTurn(modelParts: ApiPart[]): void {
    // 防重复：检查最后一条是否已是 model turn 且 parts 长度一致
    const lastTurn = this.history[this.history.length - 1];
    if (
      lastTurn &&
      lastTurn.role === 'model' &&
      lastTurn.parts.length === modelParts.length
    ) {
      // 简单比较：如果最后一条 model turn 的第一个 text 与新的第一个 text 相同，跳过
      const lastText = lastTurn.parts.find(p => p.text)?.text;
      const newText = modelParts.find(p => p.text)?.text;
      if (lastText && newText && lastText === newText) {
        console.warn('[ContextManager] 跳过重复的 model turn push');
        return;
      }
    }

    this.history.push({ role: 'model', parts: modelParts });
  }

  /**
   * 用一组完整的 contents 替换当前历史
   * （用于从 API 请求体中恢复完整上下文）
   */
  replaceHistory(contents: ApiContent[]): void {
    this.history = contents.map(c => ({
      role: c.role as 'user' | 'model',
      parts: c.parts,
    }));
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
  }

  /**
   * 构建包含新用户消息的完整请求 contents
   * （用于多轮对话请求）
   */
  buildRequestContents(
    userText: string,
    userImages?: Array<{ mimeType: string; data: string }>
  ): ApiContent[] {
    const userParts: ApiPart[] = [{ text: userText }];
    if (userImages) {
      userImages.forEach(img => {
        userParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      });
    }
    return [
      ...this.getHistory(),
      { role: 'user', parts: userParts },
    ];
  }

  /**
   * 从响应更新历史上下文
   * - 将原始请求的 contents 更新到历史中
   * - 追加 model 响应
   * 🔑 这是安全的一步式更新，避免分开调用导致的重复 push
   */
  updateFromResponse(requestContents: ApiContent[], modelParts: ApiPart[]): void {
    // 将请求 contents 直接作为新的历史基线
    this.replaceHistory(requestContents);
    // 追加 model 响应
    this.history.push({ role: 'model', parts: modelParts });
  }
}

// 单例导出
export const contextManager = new ContextManager();
