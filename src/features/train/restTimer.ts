/**
 * Rest timer store + WebAudio beep, ported from legacy:
 * - presets 60/90/120s, Start/Pause toggle, Reset
 * - 880Hz beep (0.35s) + navigator.vibrate([200,100,200]) at zero
 * - auto-starts at 90s after logging/repeating a set (today only)
 */
import { create } from 'zustand';
import { REST_TIMER_AUTO_START_SECONDS } from '@/lib/domain';

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const g = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

let audioCtx: AudioContext | null = null;

/** Create/resume the AudioContext inside a user gesture so the beep can play later. */
export function unlockAudio(): void {
  try {
    const Ctor = getAudioCtor();
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* audio unsupported — timer still works */
  }
}

function beep(): void {
  try {
    const Ctor = getAudioCtor();
    if (Ctor) {
      if (!audioCtx) audioCtx = new Ctor();
      const ctx = audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    /* audio unsupported */
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([200, 100, 200]);
  }
}

export interface RestTimerState {
  secondsLeft: number;
  /** Last selected duration — Start resumes to this when secondsLeft is 0. */
  total: number;
  running: boolean;
  /**
   * True only after a countdown actually reaches zero — distinct from an idle
   * 0:00. Drives the "rest is over" colour; an untouched timer stays ice blue.
   */
  finished: boolean;
  /** Start fresh with `seconds`, or resume (secondsLeft > 0 ? secondsLeft : total) when omitted. */
  start: (seconds?: number) => void;
  pause: () => void;
  reset: () => void;
}

let interval: ReturnType<typeof setInterval> | null = null;

function clearTick(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  secondsLeft: 0,
  total: REST_TIMER_AUTO_START_SECONDS,
  running: false,
  finished: false,

  start: (seconds) => {
    clearTick();
    if (seconds !== undefined) {
      set({ total: seconds, secondsLeft: seconds, running: true, finished: false });
    } else {
      const resume = get().secondsLeft > 0 ? get().secondsLeft : get().total;
      set({ secondsLeft: resume, running: true, finished: false });
    }
    interval = setInterval(() => {
      const next = get().secondsLeft - 1;
      if (next <= 0) {
        clearTick();
        set({ secondsLeft: 0, running: false, finished: true });
        beep();
      } else {
        set({ secondsLeft: next });
      }
    }, 1000);
  },

  pause: () => {
    clearTick();
    set({ running: false });
  },

  reset: () => {
    clearTick();
    set({ running: false, secondsLeft: 0, finished: false });
  },
}));

/** Legacy: unlockAudio(); startTimer(90) after each logged/repeated set (today only). */
export function autoStartRestTimer(): void {
  unlockAudio();
  useRestTimerStore.getState().start(REST_TIMER_AUTO_START_SECONDS);
}
