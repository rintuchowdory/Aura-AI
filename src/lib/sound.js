let ctx;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function playSound(type) {
  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    if (type === "send") {
      o.frequency.setValueAtTime(600, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.1);
      g.gain.setValueAtTime(0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
      o.start(c.currentTime);
      o.stop(c.currentTime + 0.15);
    } else if (type === "receive") {
      o.frequency.setValueAtTime(400, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.08);
      g.gain.setValueAtTime(0.2, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
      o.start(c.currentTime);
      o.stop(c.currentTime + 0.2);
    } else if (type === "error") {
      o.type = "sawtooth";
      o.frequency.setValueAtTime(200, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.3);
      g.gain.setValueAtTime(0.2, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
      o.start(c.currentTime);
      o.stop(c.currentTime + 0.3);
    }
  } catch {
    /* audio not available (e.g. autoplay-restricted) — ignore */
  }
}
