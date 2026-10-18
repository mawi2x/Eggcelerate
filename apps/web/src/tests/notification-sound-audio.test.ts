import { afterEach, expect, it, vi } from "vitest";
import { createNotificationSound } from "../app/features/farm/notification-sound";

afterEach(() => vi.unstubAllGlobals());

it("unlocks on interaction, queues separate chimes, and releases audio", () => {
  const starts: number[] = [];
  const close = vi.fn(async () => {});
  const resume = vi.fn(async () => { context.state = "running"; });
  const context = {
    state: "suspended", currentTime: 10, destination: {}, close, resume,
    createOscillator: () => ({
      type: "", frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(),
      start: (time: number) => starts.push(time), stop: vi.fn(), onended: null,
    }),
    createGain: () => ({
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn(),
    }),
  };
  const constructor = vi.fn(function () { return context; });
  vi.stubGlobal("AudioContext", constructor);
  const sound = createNotificationSound();
  sound.play();
  expect(constructor).not.toHaveBeenCalled();
  window.dispatchEvent(new Event("pointerdown"));
  expect(resume).toHaveBeenCalledOnce();
  sound.play();
  sound.play();
  expect(starts).toEqual([10, 10.13, 10.45, 10.58]);
  sound.dispose();
  expect(close).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event("keydown"));
  sound.play();
  expect(starts).toHaveLength(4);
  expect(constructor).toHaveBeenCalledOnce();
});

it("leaves notifications working when audio is unavailable", () => {
  vi.stubGlobal("AudioContext", undefined);
  const sound = createNotificationSound();
  expect(() => {
    window.dispatchEvent(new Event("keydown"));
    sound.play();
    sound.dispose();
  }).not.toThrow();
});
