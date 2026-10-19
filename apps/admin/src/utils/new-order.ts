/**
 * 新单提醒的全局状态：WS 收到 order:new 时累加，订单页读取后清零
 * （菜单上的角标与页面提示共用，避免各页面各自建连接）
 */
type Listener = (count: number) => void;

let count = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn(count);
}

export function bumpNewOrder(): void {
  count += 1;
  emit();
}

export function resetNewOrderCount(): void {
  if (count === 0) return;
  count = 0;
  emit();
}

export function subscribeNewOrderCount(fn: Listener): () => void {
  listeners.add(fn);
  fn(count);
  return () => listeners.delete(fn);
}

/** 提示音：新单到达时用 WebAudio 合成两声短促蜂鸣，不依赖音频资源 */
export function beep(): void {
  try {
    const AudioCtor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    [0, 0.25].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i === 0 ? 880 : 1320;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // 浏览器限制自动播放时忽略
  }
}
