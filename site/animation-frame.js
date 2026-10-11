// One render callback per display frame; idle effects do not keep a loop alive.
export function createFrameQueue(render, request = requestAnimationFrame, cancel = cancelAnimationFrame) {
  let pending = null, generation = 0;
  function schedule() {
    if (pending !== null) return;
    const current = generation;
    pending = request(time => {
      if (current !== generation) return;
      pending = null;
      if (render(time) === true) schedule();
    });
  }
  return {
    request: schedule,
    cancel() { generation++; if (pending !== null) cancel(pending); pending = null; },
  };
}

// The same motion speed at 60, 120, or 144 Hz.
export function approach(current, target, elapsed, response = 45) {
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, elapsed) / response));
  return Math.abs(target - next) < 0.015 ? target : next;
}
