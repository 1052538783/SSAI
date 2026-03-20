/**
 * useAudio — 音效反馈 Hook
 * 使用 Tone.js 提供操作音效反馈
 */

import { useCallback, useRef, useState } from 'react';
import * as Tone from 'tone';

export function useAudio() {
  const [enabled, setEnabled] = useState(false);
  const synthRef = useRef<Tone.Synth | null>(null);

  /** 初始化音频上下文（需要用户交互后调用） */
  const init = useCallback(async () => {
    try {
      await Tone.start();
      synthRef.current = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.05, release: 0.3 },
        volume: -20,
      }).toDestination();
      setEnabled(true);
    } catch {
      console.warn('[Audio] Tone.js 初始化失败');
    }
  }, []);

  /** 成功音效 — 上行音程 */
  const playSuccess = useCallback(() => {
    if (!synthRef.current || !enabled) return;
    const now = Tone.now();
    synthRef.current.triggerAttackRelease('C5', '8n', now);
    synthRef.current.triggerAttackRelease('E5', '8n', now + 0.1);
  }, [enabled]);

  /** 错误音效 — 下行音程 */
  const playError = useCallback(() => {
    if (!synthRef.current || !enabled) return;
    const now = Tone.now();
    synthRef.current.triggerAttackRelease('A3', '16n', now);
    synthRef.current.triggerAttackRelease('F3', '16n', now + 0.08);
  }, [enabled]);

  /** 点击音效 — 单音 */
  const playClick = useCallback(() => {
    if (!synthRef.current || !enabled) return;
    synthRef.current.triggerAttackRelease('G4', '32n');
  }, [enabled]);

  /** 完成音效 — 和弦 */
  const playComplete = useCallback(() => {
    if (!synthRef.current || !enabled) return;
    const now = Tone.now();
    synthRef.current.triggerAttackRelease('C5', '8n', now);
    synthRef.current.triggerAttackRelease('E5', '8n', now + 0.12);
    synthRef.current.triggerAttackRelease('G5', '8n', now + 0.24);
  }, [enabled]);

  return {
    init,
    enabled,
    setEnabled,
    playSuccess,
    playError,
    playClick,
    playComplete,
  };
}
