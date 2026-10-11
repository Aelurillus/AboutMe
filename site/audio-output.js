export function createAudioOutput(audio, initialVolume) {
  let level = clamp(initialVolume), muted = audio.muted, context, gain, graphFailed = false;
  function clamp(value) { return Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0.35; }
  function apply() {
    if (gain) {
      audio.volume = 1; audio.muted = false;
      gain.gain.setTargetAtTime(muted ? 0 : level, context.currentTime, 0.015);
    } else { audio.volume = level; audio.muted = muted; }
  }
  apply();
  return {
    get volume() { return level; },
    get muted() { return muted; },
    setVolume(value) { level = clamp(value); apply(); },
    setMuted(value) { muted = Boolean(value); apply(); },
    activate() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context || graphFailed) return;
      if (!context) {
        let candidate;
        try {
          candidate = new Context();
          const nextGain = candidate.createGain();
          candidate.createMediaElementSource(audio).connect(nextGain);
          nextGain.connect(candidate.destination);
          context = candidate; gain = nextGain; apply();
        } catch {
          graphFailed = true; candidate?.close().catch(() => {}); apply(); return;
        }
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    },
  };
}
