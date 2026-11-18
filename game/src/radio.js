// Car radio: four named stations with procedural WebAudio music (drums, bass, chords, lead) and track titles on the HUD.
// R cycles stations while driving, M mutes everything (handled by the shared master gain).
(function () {
  const CW = window.CW, $ = (id) => document.getElementById(id);
  const R = (CW.radio = { st: 0, track: 0, out: null, next: 0, step: 0, bar: 0, on: false });
  const STATIONS = [
    { name: 'SOL FM', freq: '88.4', genre: 'TROPICAL HOUSE', bpm: 122, root: 57, style: 'house', tracks: ['Midnight Boulevard', 'Palm Tree Alibi', 'Coral Heist', 'Sunset Fadeout'] },
    { name: 'CRIMEWAVE FM', freq: '101.1', genre: 'NEON SYNTHWAVE', bpm: 98, root: 52, style: 'synth', tracks: ['Neon Tide', 'Getaway Lights', 'Chrome Horizon', 'Zero Stars'] },
    { name: 'MAR AZUL JAZZ', freq: '94.7', genre: 'COASTAL JAZZ', bpm: 88, root: 53, style: 'jazz', tracks: ['Blue Hour in Solmara', 'Salt on the Piano', 'Late Ferry', 'Cigarette Smoke Waltz'] },
    { name: 'HARBOUR HEAVY', freq: '107.9', genre: 'DOCKSIDE DRUM & BASS', bpm: 170, root: 45, style: 'dnb', tracks: ['Crane Operator', 'Container Rave', 'Rust Belt Runner', 'Foghorn'] },
  ];
  R.stations = STATIONS;
  const PROGS = [[0, 0, -2, -4], [0, -4, -2, -5], [0, 3, -2, -5], [0, -2, 3, 5]];
  const SHIFT = [0, 2, 5, -2];
  const A = () => CW.audio && CW.audio.ctx ? CW.audio : null;
  let nbuf = null;
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function osc(type, f, t, d, g, f2) {
    const a = A(), c = a.ctx, o = c.createOscillator(), v = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v); v.connect(R.out); o.start(t); o.stop(t + d + 0.05);
  }
  function lp(type, f, t, d, g, cut) {
    const a = A(), c = a.ctx, o = c.createOscillator(), v = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut;
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.02); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(fl); fl.connect(v); v.connect(R.out); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(t, d, hp, g) {
    const a = A(), c = a.ctx; if (!nbuf || nbuf.sampleRate !== c.sampleRate) { nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const dd = nbuf.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), v = c.createGain(); s.buffer = nbuf; f.type = 'highpass'; f.frequency.value = hp;
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(v); v.connect(R.out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }
  const kick = (t, g) => { osc('sine', 150, t, 0.16, g || 0.9, 42); };
  const snare = (t) => { noise(t, 0.14, 1800, 0.35); osc('triangle', 210, t, 0.08, 0.3, 120); };
  const hat = (t, g, d) => noise(t, d || 0.04, 7000, g);
  const PENT = [0, 3, 5, 7, 10, 12, 15];

  function playStep(m, i, t) {
    const prog = PROGS[R.track % 4], sh = SHIFT[R.track % 4], root = m.root + sh, deg = prog[R.bar % 4], rn = root + deg;
    const pick = (k) => PENT[(k + R.bar) % PENT.length];
    if (m.style === 'house') {
      if (i % 4 === 0) kick(t); if (i === 4 || i === 12) { noise(t, 0.12, 2200, 0.3); } if (i % 4 === 2) hat(t, 0.16, 0.09); else if (i % 2 === 1) hat(t, 0.05);
      if ([0, 3, 6, 10, 12].indexOf(i) >= 0) lp('sawtooth', hz(rn - 12), t, 0.2, 0.3, 380);
      if ([2, 5, 10, 14].indexOf(i) >= 0) [0, 3, 7].forEach((o) => lp('triangle', hz(rn + o + 12), t, 0.16, 0.07, 2400));
      if (i % 4 === 1 && (R.bar + i) % 3) osc('square', hz(rn + 24 + pick(i) - 12), t, 0.1, 0.05);
    } else if (m.style === 'synth') {
      if (i === 0 || i === 8 || (i === 14 && R.bar % 2)) kick(t, 0.8); if (i === 4 || i === 12) snare(t); if (i % 2 === 0) hat(t, 0.07);
      if (i % 2 === 0) lp('sawtooth', hz(rn - 12), t, 0.2, 0.26, 520 + (i % 8) * 90);
      if (i === 0) [0, 3, 7, 12].forEach((o, k) => lp('sawtooth', hz(rn + o) * (1 + k * 0.002), t, 60 / m.bpm * 4, 0.05, 1400));
      if (i % 2 === 1) osc('square', hz(rn + 12 + pick(i >> 1)), t, 0.12, 0.04);
    } else if (m.style === 'jazz') {
      if ([0, 4, 6, 8, 12, 14].indexOf(i) >= 0) noise(t, 0.12, 6000, i % 4 === 0 ? 0.12 : 0.07); if (i === 4 || i === 12) hat(t, 0.1, 0.08);
      if (i % 4 === 0) lp('triangle', hz(rn - 12 + [0, 7, 3, 10][(i >> 2) % 4]), t, 0.3, 0.34, 420);
      if (i === 0 || i === 6 || i === 10) [0, 3, 7, 10].forEach((o) => osc('sine', hz(rn + o), t, 0.7, 0.06));
      if (i % 2 === 0 && (R.bar * 7 + i) % 5 < 2) osc('triangle', hz(rn + 12 + pick(i)), t, 0.28, 0.09);
    } else {
      if (i === 0 || i === 10) kick(t, 0.8); if (i === 4 || i === 12) snare(t); hat(t, i % 2 ? 0.05 : 0.09, 0.03);
      if (i === 0 || i === 8) { const b = hz(rn - 24); lp('sawtooth', b, t, 0.22, 0.3, 300); lp('sawtooth', b * 1.01, t, 0.22, 0.25, 500); }
      if (i === 6 || i === 14) lp('square', hz(rn - 12 + pick(i)), t, 0.1, 0.07, 1500);
    }
  }

  R.update = function (dt) {
    const P = CW.player, I = CW.input, a = A(), car = P.mode === 'car' && P.car && CW.game.state === 'play';
    const off = R.st >= STATIONS.length;
    if (car && I.pressed('KeyR')) { R.st = (R.st + 1) % (STATIONS.length + 1); R.track = 0; R.bar = 0; R.step = 0; R.next = 0; const s = STATIONS[R.st]; CW.hud.toast(s ? 'RADIO  ·  ' + s.freq + ' ' + s.name : 'RADIO OFF'); CW.sfx.play('click', 0.6); }
    const el = $('radiohud'); const on = car && CW.hud.shown;
    const key = on ? R.st + ':' + R.track : ''; if (el.dataset.k !== key) { el.dataset.k = key; el.style.display = on ? 'block' : 'none'; if (on) { const s = STATIONS[R.st]; el.innerHTML = s ? '<b>' + s.freq + '  ' + s.name + '</b>&#9835; ' + s.tracks[R.track % 4] + '<small>' + s.genre + '  ·  R NEXT STATION</small>' : '<b>RADIO OFF</b><small>R TURN ON</small>'; } }
    if (!a) return;
    if (!R.out) { R.out = a.ctx.createGain(); R.out.gain.value = 0; R.out.connect(a.master); }
    R.out.gain.setTargetAtTime(car && !off ? 0.55 : 0, a.ctx.currentTime, 0.25);
    if (!(car && !off)) { R.next = 0; return; }
    const m = STATIONS[R.st], sd = 60 / m.bpm / 4, now = a.ctx.currentTime;
    if (!R.next || R.next < now - 0.3) R.next = now + 0.06;
    let guard = 0;
    while (R.next < now + 0.18 && guard++ < 8) {
      const i = R.step % 16; playStep(m, i, R.next); R.next += sd; R.step++;
      if (R.step % 16 === 0) { R.bar++; if (R.bar % 16 === 0) { R.track = (R.track + 1) % 4; el.dataset.k = ''; CW.hud.toast('NOW PLAYING  ·  ' + m.tracks[R.track]); } }
    }
  };
})();
