/** A quiet two-note chime, generated locally without a media download. */
export function createNotificationSound() {
  let context: AudioContext | undefined;
  let nextStart = 0;
  let disposed = false;

  const unlock = () => {
    try {
      if (disposed || !window.AudioContext) return;
      context ??= new window.AudioContext();
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      // Audio availability must never interrupt notification delivery.
    }
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return {
    play() {
      if (!context || context.state !== "running" || disposed) return;
      try {
        const start = Math.max(context.currentTime, nextStart);
        nextStart = start + 0.45;
        for (const [offset, frequency] of [[0, 660], [0.13, 880]]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start + offset);
          gain.gain.linearRampToValueAtTime(0.12, start + offset + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.2);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(start + offset);
          oscillator.stop(start + offset + 0.22);
        }
      } catch {
        // Unsupported or interrupted audio leaves the visual alert intact.
      }
    },
    dispose() {
      disposed = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (context && context.state !== "closed") void context.close().catch(() => {});
    },
  };
}
