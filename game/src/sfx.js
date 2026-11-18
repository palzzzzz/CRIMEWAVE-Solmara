// Procedural WebAudio sound effects: guns, melee, pickups, glass + fire, thunder, rotor and rain loops.
// Uses the shared CW.audio context created by police.js (it is built on the first user gesture).
(function () {
  const CW = window.CW;
  const S = (CW.sfx = {});
  let nbuf = null, nctx = null;

  function A() { const a = CW.audio; return a && a.ctx && !a.muted ? a : null; }
  function noiseBuf(c) {
    if (nctx !== c) { nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; nctx = c; }
    return nbuf;
  }
  // filtered noise burst: filter sweeps f0 -> f1 over dur, gain decays
  S.noise = function (type, f0, f1, dur, g, vol, delay, q) {
    const a = A(); if (!a || vol <= 0.005) return; const c = a.ctx, t = c.currentTime + (delay || 0);
    try {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), o = c.createGain();
      s.buffer = noiseBuf(c); s.loop = true; f.type = type; f.Q.value = q || 0.8;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      o.gain.setValueAtTime(g * vol, t); o.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(o); o.connect(a.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    } catch (e) { /* audio blocked */ }
  };
  S.tone = function (type, f0, f1, dur, g, vol, delay) {
    const a = A(); if (!a || vol <= 0.005) return; const c = a.ctx, t = c.currentTime + (delay || 0);
    try {
      const o = c.createOscillator(), n = c.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      n.gain.setValueAtTime(g * vol, t); n.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(n); n.connect(a.master); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* audio blocked */ }
  };

  // vol: 0..1 (distance falloff already applied by the caller)
  S.play = function (name, vol) {
    vol = vol === undefined ? 1 : vol;
    switch (name) {
      case 'pistol': S.noise('lowpass', 5200, 500, 0.16, 0.9, vol); S.tone('square', 190, 45, 0.14, 0.5, vol); S.noise('highpass', 3000, 2000, 0.05, 0.4, vol); break;
      case 'smg': S.noise('lowpass', 6200, 800, 0.09, 0.8, vol); S.tone('square', 240, 70, 0.08, 0.4, vol); break;
      case 'shotgun': S.noise('lowpass', 4200, 260, 0.42, 1.2, vol); S.tone('sawtooth', 120, 28, 0.36, 0.8, vol); S.noise('highpass', 2500, 900, 0.1, 0.5, vol); S.noise('bandpass', 900, 500, 0.12, 0.7, vol, 0.46); break;
      case 'enemy': S.noise('lowpass', 4200, 500, 0.13, 0.6, vol); S.tone('square', 170, 50, 0.1, 0.32, vol); break;
      case 'punch': S.tone('sine', 150, 50, 0.12, 0.9, vol); S.noise('lowpass', 900, 200, 0.08, 0.6, vol); break;
      case 'swish': S.noise('bandpass', 700, 2600, 0.16, 0.45, vol, 0, 1.4); break;
      case 'stab': S.noise('highpass', 3500, 1500, 0.09, 0.5, vol); S.tone('triangle', 400, 120, 0.1, 0.3, vol); break;
      case 'click': S.tone('square', 1700, 900, 0.03, 0.25, vol); break;
      case 'reload': S.tone('square', 900, 400, 0.04, 0.3, vol); S.tone('square', 1500, 700, 0.04, 0.3, vol, 0.5); S.noise('highpass', 3000, 2000, 0.05, 0.3, vol, 0.5); break;
      case 'rack': S.tone('square', 600, 250, 0.06, 0.3, vol); S.noise('bandpass', 1800, 900, 0.09, 0.4, vol, 0.02); break;
      case 'draw': S.noise('bandpass', 1500, 3500, 0.1, 0.3, vol); S.tone('square', 1100, 600, 0.03, 0.2, vol, 0.09); break;
      case 'pickup': S.tone('sine', 660, 990, 0.1, 0.5, vol); S.tone('sine', 990, 1480, 0.14, 0.45, vol, 0.09); break;
      case 'hit': S.tone('sine', 1500, 1100, 0.05, 0.22, vol); break;
      case 'glass': S.noise('highpass', 4000, 3000, 0.3, 0.9, vol); S.tone('triangle', 2400, 1200, 0.1, 0.3, vol); S.noise('lowpass', 700, 200, 0.5, 0.6, vol, 0.05); break;
      case 'whoosh': S.noise('lowpass', 600, 250, 1.1, 0.7, vol, 0.04, 0.4); break;
      case 'explode': S.noise('lowpass', 2400, 60, 1.4, 1.5, vol); S.tone('sawtooth', 90, 22, 0.9, 1, vol); break;
      case 'thunder': S.noise('lowpass', 500, 60, 2.6, 1.3, vol, 0.0, 0.5); S.noise('lowpass', 300, 50, 2.2, 0.8, vol, 0.5, 0.5); break;
      case 'crash': S.noise('lowpass', 1800, 150, 0.5, 1.0, vol); S.tone('square', 130, 40, 0.3, 0.5, vol); break;
      default: break;
    }
  };

  // ---- persistent loops -----------------------------------------------------------------------------
  // rotor: thumping filtered noise, chop rate follows rotor speed
  S.makeRotor = function () {
    const o = { ready: false, g: null, lfo: null, set(vol, rate) { if (o.ready) { o.g.gain.value = o.base * vol; o.lfo.frequency.value = rate; } } };
    o.init = function () {
      const a = CW.audio; if (o.ready || !a || !a.ctx) return; const c = a.ctx;
      try {
        const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), dep = c.createGain(), lfo = c.createOscillator();
        src.buffer = noiseBuf(c); src.loop = true; f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 1.2;
        g.gain.value = 0; dep.gain.value = 0.55; lfo.type = 'sawtooth'; lfo.frequency.value = 9;
        src.connect(f); f.connect(g); lfo.connect(dep); dep.connect(g.gain); g.connect(a.master); src.start(); lfo.start();
        o.g = g; o.lfo = lfo; o.base = 0.55; o.ready = true;
      } catch (e) { o.ready = false; }
    };
    return o;
  };
  const rain = { ready: false };
  S.rain = function (vol) {
    const a = CW.audio; if (!a || !a.ctx) return;
    if (!rain.ready) {
      try {
        const c = a.ctx, src = c.createBufferSource(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
        src.buffer = noiseBuf(c); src.loop = true; hp.type = 'highpass'; hp.frequency.value = 1400; lp.type = 'lowpass'; lp.frequency.value = 7000; g.gain.value = 0;
        src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(a.master); src.start(); rain.g = g; rain.ready = true;
      } catch (e) { return; }
    }
    rain.g.gain.value = a.muted ? 0 : vol * 0.16;
  };
})();
