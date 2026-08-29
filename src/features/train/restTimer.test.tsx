import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { useRestTimerStore } from './restTimer';
import { RestTimerBar } from './RestTimerBar';

class MockOscillator {
  frequency = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class MockGain {
  gain = { setValueAtTime: vi.fn() };
  connect = vi.fn();
}
class MockAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  createOscillator() {
    return new MockOscillator();
  }
  createGain() {
    return new MockGain();
  }
  resume() {
    return Promise.resolve();
  }
}

let vibrate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', MockAudioContext);
  vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
  useRestTimerStore.getState().reset();
});

afterEach(() => {
  useRestTimerStore.getState().reset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('rest timer store', () => {
  it('counts down every second and vibrates at zero', () => {
    useRestTimerStore.getState().start(90);
    expect(useRestTimerStore.getState()).toMatchObject({ secondsLeft: 90, running: true });

    vi.advanceTimersByTime(1000);
    expect(useRestTimerStore.getState().secondsLeft).toBe(89);

    vi.advanceTimersByTime(89_000);
    expect(useRestTimerStore.getState()).toMatchObject({ secondsLeft: 0, running: false });
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
    expect(vibrate).toHaveBeenCalledTimes(1);

    // no zombie interval after finishing
    vi.advanceTimersByTime(5000);
    expect(useRestTimerStore.getState().secondsLeft).toBe(0);
  });

  it('pauses without losing time and resumes from where it stopped', () => {
    const store = useRestTimerStore.getState();
    store.start(60);
    vi.advanceTimersByTime(10_000);
    expect(useRestTimerStore.getState().secondsLeft).toBe(50);

    useRestTimerStore.getState().pause();
    vi.advanceTimersByTime(5000);
    expect(useRestTimerStore.getState()).toMatchObject({ secondsLeft: 50, running: false });

    useRestTimerStore.getState().start(); // resume, no argument
    vi.advanceTimersByTime(1000);
    expect(useRestTimerStore.getState()).toMatchObject({ secondsLeft: 49, running: true });
  });

  it('reset stops and zeroes the timer', () => {
    useRestTimerStore.getState().start(120);
    vi.advanceTimersByTime(3000);
    useRestTimerStore.getState().reset();
    expect(useRestTimerStore.getState()).toMatchObject({ secondsLeft: 0, running: false });
    vi.advanceTimersByTime(3000);
    expect(useRestTimerStore.getState().secondsLeft).toBe(0);
  });
});

describe('RestTimerBar', () => {
  it('starts a preset, ticks the display, toggles Pause/Start and resets', () => {
    renderWithTheme(<RestTimerBar />);

    expect(screen.getByRole('timer')).toHaveTextContent('0:00');

    fireEvent.click(screen.getByRole('button', { name: '90s' }));
    expect(screen.getByRole('timer')).toHaveTextContent('1:30');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('1:29');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('1:29');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
  });
});
