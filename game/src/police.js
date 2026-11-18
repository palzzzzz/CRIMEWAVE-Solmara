// Law: line-of-sight wanted system, police cars (patrol / pursuit / ramming / roadblocks / foot officers),
// the police-response HUD panel, radio chatter subtitles, siren audio, busted + wasted screens and respawn.
(function () {
  const CW = window.CW, T = CW.traffic, roads = CW.roads, L = CW.C.LINES, DIRS = roads.DIRS;
  const $ = (id) => document.getElementById(id);
  const CALLS = ['KILO-12', 'LIMA-07', 'ROMEO-31', 'TANGO-04', 'DELTA-19', 'ECHO-22', 'SIERRA-15', 'VICTOR-09', 'ALPHA-28', 'OSCAR-16'];
  const NEED = [0, 2, 3, 4, 5, 6];            // pursuit cars wanted per star level
  const VMAX = [0, 30, 34, 38, 42, 46];
  const STATE_LABEL = { pursuit: 'PURSUIT', ram: 'RAMMING', roadblock: 'ROADBLOCK', search: 'SEARCH', foot: 'ON FOOT', searchlight: 'SEARCHLIGHT' };
  const W = (CW.police = { level: 0, heat: 0, cops: [], officers: [], seen: false, lostT: 0, seenT: 0, last: { x: 0, z: 0 }, bust: 0, ended: null, active: false, time: 0 });
  const rnd = CW.makeRng(99);
  const COMPASS = ['SOUTH', 'EAST', 'NORTH', 'WEST'];   // +z is south on the minimap (north = -z)
  const head = (vx, vz) => (Math.hypot(vx, vz) < 1 ? 'NOWHERE' : COMPASS[(Math.round(Math.atan2(vx, vz) / (Math.PI / 2)) + 4) % 4]);

  // ---- line of sight through static obstacles --------------------------------------------------------
  function los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, n = Math.ceil(Math.hypot(dx, dz) / 3);
    let blocked = false;
    for (let k = 1; k < n && !blocked; k++) {
      const x = x0 + (dx * k) / n, z = z0 + (dz * k) / n;
      CW.world.forNear(x, z, 0.2, (o) => {
        if (blocked || o.h < 3) return;
        if (o.t === 0) { if (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1) blocked = true; }
        else if (Math.hypot(x - o.x, z - o.z) < o.r) blocked = true;
      });
    }
    return !blocked;
  }
  W.los = los;

  // ---- player helpers ---------------------------------------------------------------------------------
  function who() {
    const P = CW.player, car = P.mode === 'car' ? P.car : null, e = P.active;
    if (P.mode === 'heli') { const h = CW.air.heli, hs = Math.hypot(h.vx, h.vz); return { x: h.x, z: h.z, vx: h.vx, vz: h.vz, speed: h.y > h.floor + 3 ? Math.max(hs, 20) : hs, car: null, foot: false, heli: true }; }
    return car ? { x: car.x, z: car.z, vx: car.vx, vz: car.vz, speed: car.speed, car, foot: false } : { x: e.x, z: e.z, vx: e.vx, vz: e.vz, speed: e.speed, car: null, foot: true };
  }

  // ---- audio: siren wail + radio squelch --------------------------------------------------------------
  const audio = (CW.audio = CW.audio || { ctx: null, master: null, muted: false });
  function audioInit() {
    if (audio.ctx || !(window.AudioContext || window.webkitAudioContext)) return;
    try {
      audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      audio.master = audio.ctx.createGain(); audio.master.gain.value = audio.muted ? 0 : 1; audio.master.connect(audio.ctx.destination);
      const o = audio.ctx.createOscillator(), o2 = audio.ctx.createOscillator(), lfo = audio.ctx.createOscillator(), lg = audio.ctx.createGain(), g = audio.ctx.createGain(), f = audio.ctx.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 780; o2.frequency.value = 782; lfo.frequency.value = 0.8; lfo.type = 'triangle'; lg.gain.value = 190;
      lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); f.type = 'lowpass'; f.frequency.value = 1700; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(audio.master); o.start(); o2.start(); lfo.start();
      audio.siren = g;
    } catch (e) { audio.ctx = null; }
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) { audio.muted = !audio.muted; if (audio.master) audio.master.gain.value = audio.muted ? 0 : 1; if (CW.hud.shown) CW.hud.toast(audio.muted ? 'SOUND OFF' : 'SOUND ON'); } });
  function squelch() {
    if (!audio.ctx || audio.muted) return;
    try {
      const c = audio.ctx, len = Math.floor(c.sampleRate * 0.14), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.5;
      const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1800; g.gain.value = 0.35;
      s.connect(f); f.connect(g); g.connect(audio.master); s.start();
    } catch (e) { /* audio blocked */ }
  }

  // ---- radio chatter subtitles ------------------------------------------------------------------------
  const queue = [], cd = {}; let radioT = 0;
  W.say = function (unit, text, key, cool) {
    const now = W.time;
    if (key) { if (cd[key] && now < cd[key]) return; cd[key] = now + (cool || 8); }
    if (queue.length < 3) queue.push({ unit, text });
  };
  function radio(dt) {
    const box = $('radio'); radioT -= dt;
    if (radioT <= 0) {
      if (queue.length) { const m = queue.shift(); $('radio-unit').textContent = m.unit; $('radio-text').textContent = m.text; box.style.opacity = 1; radioT = 2.2 + m.text.length * 0.045; squelch(); }
      else box.style.opacity = 0;
    }
  }

  // ---- wanted level -----------------------------------------------------------------------------------
  const KIND_LINE = {
    carjack: (c) => 'All units, carjacking in progress. Driver dragged from a ' + c + '.',
    theft: (c) => 'Grand theft auto reported. Suspect took a ' + c + '.',
    runover: (c) => 'Pedestrian struck! Hit and run in a ' + c + '.',
    assault: () => 'Officer under attack! Suspect rammed a unit.',
    crime: () => 'Disturbance reported. All units respond.',
    shots: () => 'Shots fired! Multiple callers report gunfire.',
    murder: () => 'Homicide reported. Suspect is armed and dangerous.',
    arson: () => 'Petrol bomb! Someone is torching the street.',
  };
  function carName() { const p = who(); return p.car ? p.car.type.name : p.heli ? 'stolen helicopter' : 'unknown vehicle'; }

  W.raise = function (sev, kind, src) {
    if (W.ended) return;
    const p = who(), was = W.level;
    W.heat = Math.min(5, W.heat + sev); W.level = Math.min(5, Math.ceil(W.heat - 0.001));
    W.lostT = 0; W.last = { x: p.x, z: p.z };
    if (src) W.seen = true;
    if (CW.solfeed) CW.solfeed.crime(kind, p, W.level);
    if (W.level > was) {
      CW.hud.toast(was === 0 ? 'WANTED  ' + '★'.repeat(W.level) : 'WANTED LEVEL ' + '★'.repeat(W.level));
      if (was === 0) W.say('DISPATCH', (KIND_LINE[kind] || KIND_LINE.crime)(carName()), 'dispatch', 6);
      else W.say('DISPATCH', 'Suspect escalating. Raising the response to ' + W.level + ' stars.', 'esc', 6);
    }
  };

  // A crime happened at (x, z). Cops with line of sight react immediately; pedestrians phone it in.
  W.crime = function (kind, x, z, sev, range) {
    if (!W.active || W.ended) return;
    if (kind === 'assault' && W.level > 0) sev = 0.15;
    const sc = W.cops.find((c) => !c.hidden && c.cs !== 'idle' && c.cs !== 'dead' && Math.hypot(c.x - x, c.z - z) < 110 && los(c.x, c.z, x, z));
    if (sc) { W.raise(sev, kind, sc); return; }
    let n = 0;
    T.peds.forEach((p) => {
      if (n >= 2 || p.state === 'dead' || p.state === 'phone' || Math.hypot(p.x - x, p.z - z) > (range || 30) || rnd() > 0.8 || !los(p.x, p.z, x, z)) return;
      p.state = 'phone'; p.t = 2.2 + rnd() * 1.2; p.rep = { sev: sev * 0.8, kind }; p.cancelled = false; n++;
    });
    if (!n && W.level === 0) CW.hud.toast('NO WITNESSES');
  };
  W.report = function (rep) { if (rep) W.raise(rep.sev, rep.kind, null); };

  W.clear = function (silent) {
    const had = W.level > 0;
    W.heat = 0; W.level = 0; W.lostT = 0; W.seenT = 0; W.seen = false; W.bust = 0;
    W.cops.forEach((c) => {
      if (c.cs === 'idle' || c.cs === 'dead') return;
      if (c.officer) { c.officer.on = false; c.officer.model.visible = false; c.officer = null; }
      c.cs = 'leave'; T.attach(c, 13);
    });
    if (had && !silent) { CW.hud.toast('WANTED LEVEL LOST'); W.say('DISPATCH', 'All units, suspect lost. Return to patrol.', 'clear', 5); }
  };

  // ---- cop cars -----------------------------------------------------------------------------------------
  function makeCop(idx) {
    const car = CW.vehicles.add('cruiser', 0xf2f6f8, 0, 0, 0);
    car.cop = true; car.hidden = true; car.cs = 'idle'; car.call = CALLS[idx % CALLS.length]; car.owned = true;
    const t = car.type, m = car.mesh, roof = 0.3 + t.bh + t.ch + 0.1;
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.34), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.34), new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
    red.position.set(0.36, roof, t.cz); blue.position.set(-0.36, roof, t.cz);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.4), new THREE.MeshLambertMaterial({ color: 0x1a1d22 })); base.position.set(0, roof - 0.09, t.cz);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x1f3f8f });
    [-1, 1].forEach((s) => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, t.l * 0.7), stripeMat); st.position.set(s * (t.w / 2 + 0.005), 0.3 + t.bh * 0.5, 0); m.add(st); });
    const gr = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: 0xff3030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), gb = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: 0x3070ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    gr.scale.setScalar(3.4); gb.scale.setScalar(3.4); gr.position.copy(red.position); gb.position.copy(blue.position); gr.position.y += 0.2; gb.position.y += 0.2;
    m.add(red); m.add(blue); m.add(base); m.add(gr); m.add(gb);
    car.bar = { red, blue, gr, gb };
    return car;
  }
  function makeOfficer() {
    const model = CW.makePerson({ id: 'cop', skin: 0xd9a070, hair: 0x14202f, shirt: 0x1f3f8f, pants: 0x161d33, shoes: 0x101010, female: false, shades: true });
    CW.world.scene.add(model); model.visible = false;
    return { model, x: 0, z: 0, h: 0, on: false, car: null, vx: 0, vz: 0 };
  }

  W.init = function () {
    for (let i = 0; i < 10; i++) W.cops.push(makeCop(i));
    for (let i = 0; i < 4; i++) W.officers.push(makeOfficer());
  };

  W.start = function (F) {
    W.active = true; W.ended = null; W.heat = 0; W.level = 0; W.seen = false; W.lostT = 0; W.bust = 0;
    W.officers.forEach((o) => { o.on = false; o.model.visible = false; });
    W.cops.forEach((c, i) => {
      c.hp = 100; c.cop = true; c.cs = 'idle'; c.hidden = true; c.ai = null; c.officer = null; c.burnT = 0;
      if (i < 3 && T.relocate(c, F.x, F.z, 70, 160)) { c.cs = 'patrol'; c.ai.cruise = 10 + i; }
    });
    $('radio').style.opacity = 0; queue.length = 0;
    audioInit();
  };

  function hide(c) { c.hidden = true; c.cs = 'idle'; c.ai = null; if (c.officer) { c.officer.on = false; c.officer.model.visible = false; c.officer = null; } }

  function routeTarget(c, gi, gj, gx, gz) {
    const f = roads.bfs(gi, gj), n = roads.nearest(c.x, c.z);
    if (f[n.i * 7 + n.j] === 0) return { x: gx, z: gz };
    let best = null, bv = 1e9;
    for (let k = 0; k < 4; k++) {
      const a = n.i + DIRS[k][0], b = n.j + DIRS[k][1]; if (!roads.valid(a, b)) continue;
      const ahead = (L[a] - c.x) * Math.sin(c.h) + (L[b] - c.z) * Math.cos(c.h);
      const v = f[a * 7 + b] * 100 - (ahead > 0 ? 40 : 0);
      if (v < bv) { bv = v; best = { x: L[a], z: L[b] }; }
    }
    return best || { x: gx, z: gz };
  }

  function deploy(c, p) {
    if (c.officer) return;
    const o = W.officers.find((q) => !q.on); if (!o) return;
    o.on = true; o.car = c; c.officer = o; o.model.visible = true;
    const lx = Math.cos(c.h), lz = -Math.sin(c.h);
    o.x = c.x + lx * 1.8; o.z = c.z + lz * 1.8; o.vx = o.vz = 0;
    W.say(c.call, 'Suspect is on foot — moving in!', 'foot', 10);
  }

  function updateCop(c, dt, p, F) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (c.hp <= 0 && c.cs !== 'dead') { c.cs = 'dead'; c.deadT = 0; c.ai = null; if (c.officer) { c.officer.on = false; c.officer.model.visible = false; c.officer = null; } }
    if (c.cs === 'dead') { c.deadT += dt; if (Math.random() < dt * 10) CW.fx.puff(c.x, 1.2, c.z, { color: 0x222222, size: 0.9, grow: 1.6, vy: 1.8, a: 0.6, life: 1.6 }); if (c.deadT > 9 && d > 25) { c.hp = 100; hide(c); } return; }
    if (c.cs === 'idle') return;
    if (c.cs === 'patrol' || c.cs === 'leave') {
      if (!c.ai) T.attach(c, 11);
      if (W.level > 0 && c.cs === 'patrol') { c.cs = W.seen ? 'pursuit' : 'search'; return; }
      if (W.level > 0 && c.cs === 'leave') { c.cs = 'pursuit'; return; }
      T.laneStep(c, dt);
      if (c.cs === 'leave' && d > 150) hide(c);
      else if (c.cs === 'patrol' && d > 230) { c.cs = 'leave'; }
      return;
    }
    if (!c.ai) c.ai = { cruise: 0, off: 0 };
    if (c.cs === 'roadblock') {
      c.aiCtl = { throttle: 0, steer: 0, brake: true };
      c.rbMin = Math.min(c.rbMin || 1e9, d);
      if (W.level < 3 || d < 13 || d > c.rbMin + 28) { c.cs = W.seen ? 'pursuit' : 'search'; c.rbMin = 0; if (W.level >= 3 && d < 13) W.say(c.call, 'He is breaking through the roadblock!', 'break', 8); }
      return;
    }
    if (c.cs === 'foot') {
      c.aiCtl = { throttle: 0, steer: 0, brake: true };
      if (!p.foot && p.speed > 9) { c.cs = 'pursuit'; if (c.officer) { c.officer.on = false; c.officer.model.visible = false; c.officer = null; } }
      else if (d > 45) c.cs = 'pursuit';
      return;
    }
    // chase / search
    const vmax = VMAX[Math.max(1, W.level)];
    let tx, tz, vt = vmax;
    if (W.seen) {
      const slowP = p.foot || p.speed < 3.5;
      if (slowP && d < 26 && c.speed < 14) { c.cs = 'foot'; deploy(c, p); return; }
      if (d < 60 && los(c.x, c.z, p.x, p.z)) {
        tx = p.x + p.vx * 0.3; tz = p.z + p.vz * 0.3;
        const ram = d < 24 && c.speed > 9;
        if (ram && c.cs !== 'ram') W.say(c.call, 'Moving to ram — hold on!', 'ram', 10);
        c.cs = ram ? 'ram' : 'pursuit';
        vt = d < 20 ? Math.max(p.speed + 9, 14) : vmax;
      } else {
        const n = roads.nearest(p.x, p.z), r = routeTarget(c, n.i, n.j, p.x, p.z); tx = r.x; tz = r.z; c.cs = 'pursuit';
      }
    } else {
      c.cs = 'search';
      c.sT = (c.sT || 0) - dt;
      if (!c.sPt || c.sT <= 0 || Math.hypot(c.sPt.x - c.x, c.sPt.z - c.z) < 22) {
        const R = 45 + W.level * 14, a = rnd() * 6.283, rr = Math.sqrt(rnd()) * R;
        c.sPt = { x: CW.clamp(W.last.x + Math.cos(a) * rr, -240, 240), z: CW.clamp(W.last.z + Math.sin(a) * rr, -240, 240) }; c.sT = 9;
      }
      const n = roads.nearest(c.sPt.x, c.sPt.z), r = routeTarget(c, n.i, n.j, c.sPt.x, c.sPt.z); tx = r.x; tz = r.z; vt = 20;
    }
    T.drive(c, tx, tz, vt, dt);
    // avoid rear-ending civilians at full speed in a search; in a pursuit cops barge through
    if (!W.seen) { const gp = T.gap(c, 12); if (gp < 8) c.aiCtl.throttle = Math.min(c.aiCtl.throttle, c.speed > 6 ? -1 : 0); }
  }

  // dispatch cars to meet the wanted level, and set up roadblocks
  function dispatch(dt, p) {
    const level = W.level; W.dispT = (W.dispT || 0) - dt; W.rbT = (W.rbT || 0) - dt;
    if (level < 1) return;
    const chasers = W.cops.filter((c) => c.cs === 'pursuit' || c.cs === 'ram' || c.cs === 'search' || c.cs === 'foot').length;
    if (W.dispT <= 0 && chasers < NEED[level]) {
      W.dispT = 2.4;
      const c = W.cops.find((q) => q.cs === 'idle') || W.cops.find((q) => q.cs === 'leave' && Math.hypot(q.x - p.x, q.z - p.z) > 90);
      if (c && T.relocate(c, p.x, p.z, 95, 175, 0)) { c.cs = W.seen ? 'pursuit' : 'search'; c.hp = 100; c.officer = null; W.say(c.call, 'Responding — en route to the last known position.', 'resp', 12); }
    }
    if (level >= 3 && W.rbT <= 0 && !W.cops.some((c) => c.cs === 'roadblock')) {
      W.rbT = 4;
      const free = W.cops.filter((q) => q.cs === 'idle' || (q.cs === 'leave' && Math.hypot(q.x - p.x, q.z - p.z) > 90));
      if (free.length >= 3) {
        const pn = roads.nearest(p.x, p.z); let best = null, bs = -1e9;
        for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
          const nx = L[i] - p.x, nz = L[j] - p.z, dist = Math.hypot(nx, nz); if (dist < 100 || dist > 190) continue;
          const ahead = p.speed > 5 ? (nx * p.vx + nz * p.vz) / (dist * p.speed) : 0.3;
          const s = ahead * 120 - Math.abs(dist - 140); if (s > bs && !(i === pn.i && j === pn.j)) { bs = s; best = { i, j }; }
        }
        if (best) {
          const dx = p.x - L[best.i], dz = p.z - L[best.j];
          const ax = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];   // the road leading toward the player
          const sx = L[best.i] + ax[0] * 28, sz = L[best.j] + ax[1] * 28, px = -ax[1], pz = ax[0];
          if (Math.abs(sx) < 244 && Math.abs(sz) < 244) {
            free.slice(0, 3).forEach((c, k) => {
              const off = (k - 1) * 5.4;
              c.x = sx + px * off; c.z = sz + pz * off; c.h = Math.atan2(px, pz) + (k === 1 ? 0.12 : -0.06 * (k - 1)); c.vx = c.vz = c.fs = c.ls = c.speed = 0; c.hp = 100;
              c.hidden = false; c.awake = true; c.cs = 'roadblock'; c.rbMin = 1e9; c.ai = { cruise: 0, off: 0 }; c.officer = null;
            });
            W.say('DISPATCH', 'Roadblock going up on the ' + head(sx - p.x, sz - p.z) + 'bound route. Push him into it.', 'rb', 12);
          }
        }
      }
    }
  }

  function updateOfficers(dt, p) {
    W.officers.forEach((o) => {
      if (!o.on) return;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), hold = W.level >= 3 ? 11 : 1.4, sp = d > hold ? 5.3 + W.level * 0.25 : 0;
      o.vx = CW.damp(o.vx, (dx / (d || 1)) * sp, 10, dt); o.vz = CW.damp(o.vz, (dz / (d || 1)) * sp, 10, dt);
      o.x += o.vx * dt; o.z += o.vz * dt; const r = CW.world.resolve(o.x, o.z, 0.4); o.x = r.x; o.z = r.z;
      if (sp > 0) o.h = CW.dampAngle(o.h, Math.atan2(dx, dz), 12, dt);
      o.model.position.set(o.x, 0, o.z); o.model.rotation.y = o.h; o.model.userData.update(dt, Math.hypot(o.vx, o.vz));
      if (!p.foot && p.speed > 9) { o.on = false; o.model.visible = false; if (o.car) o.car.officer = null; }
    });
  }

  // ---- busted / wasted ----------------------------------------------------------------------------------
  W.hurt = function (amount, cause) {
    const st = CW.hud.state; if (W.ended) return;
    if (st.armour > 0) { const a = Math.min(st.armour, amount * 0.7); st.armour -= a; amount -= a; }
    st.hp = Math.max(0, st.hp - amount); W.hurtFlash = Math.max(W.hurtFlash || 0, Math.min(0.6, 0.15 + amount * 0.05));
    if (st.hp <= 0) W.wasted(cause);
  };

  function endScreen(kind, title, sub) {
    const el = $('endscreen'); el.className = kind; el.style.display = 'flex';
    $('end-title').textContent = title; $('end-sub').textContent = sub; $('end-hint').style.opacity = 0;
    W.ended = { kind, t: 0 };
    $('bustwrap').style.opacity = 0; $('radio').style.opacity = 0; $('hurt').style.opacity = 0;
    CW.game.state = 'ended';
    if (document.exitPointerLock) document.exitPointerLock();
  }
  W.busted = function () {
    if (W.ended) return;
    const st = CW.hud.state, fine = Math.min(st.cash, Math.max(150, Math.round(st.cash * 0.1)));
    W.ended = { kind: 'busted', fine };
    endScreen('busted', 'BUSTED', 'You were taken in by the Solmara PD.  Fine: $' + fine.toLocaleString('en-US'));
    W.ended.fine = fine; W.say('DISPATCH', 'Suspect in custody. Good work, everyone.', 'cust', 1);
  };
  W.wasted = function (cause) {
    if (W.ended) return;
    const st = CW.hud.state, bill = Math.min(st.cash, 200 + Math.round(st.cash * 0.05));
    endScreen('wasted', 'WASTED', (cause ? cause + '.  ' : '') + 'Hospital bill: $' + bill.toLocaleString('en-US'));
    W.ended.fine = bill;
  };
  function respawn() {
    const P = CW.player, V = CW.vehicles, st = CW.hud.state, e = P.active, kind = W.ended.kind;
    st.cash = Math.max(0, st.cash - W.ended.fine);
    if (CW.air) CW.air.onRespawn();
    if (CW.weapons) CW.weapons.reset();
    e.model.userData.setPose('none'); e.model.rotation.set(0, 0, 0);
    if (P.mode === 'car' && P.car) { const car = P.car; car.driven = false; V.driven = null; e.model.visible = true; P.mode = 'foot'; P.car = null; if (kind === 'busted') car.hidden = false; }
    const lm = CW.world.landmarks[kind === 'busted' ? 'police' : 'hospital'];
    P.place(e, lm.x, lm.z, Math.PI);
    const cam = CW.cam; cam.yaw = 0; cam.pitch = 0.3; cam.tx = lm.x; cam.tz = lm.z; cam.cd = undefined; cam.ty = 1.55;
    st.hp = 100; st.armour = 0;
    W.clear(true); W.cops.forEach((c) => { if (c.cs !== 'idle' && c.cs !== 'patrol') hide(c); });
    $('endscreen').style.display = 'none'; W.ended = null; CW.game.state = 'play';
    CW.hud.toast(kind === 'busted' ? 'RELEASED FROM SOLMARA POLICE STATION' : 'DISCHARGED FROM SOLMARA GENERAL');
  }

  // a wrecked car you are sat in burns, then blows
  function wrecks(dt, p) {
    const car = p.car;
    if (!car || car.hp > 0) return;
    car.burnT = (car.burnT || 0) + dt;
    if (car.burnT < 0.1) CW.hud.toast('CAR ON FIRE — GET OUT! (E)');
    if (Math.random() < dt * 24) CW.fx.puff(car.x, 1.2, car.z, { color: Math.random() < 0.5 ? 0xff7a1a : 0x222222, size: 0.9, grow: 1.8, vy: 2.4, a: 0.7, life: 1.1 });
    if (car.burnT > 4.5) {
      for (let i = 0; i < 14; i++) CW.fx.puff(car.x + (Math.random() - 0.5) * 3, 1 + Math.random(), car.z + (Math.random() - 0.5) * 3, { color: i % 2 ? 0xffa020 : 0x333333, size: 1.6, grow: 3, vy: 3 + Math.random() * 2, a: 0.8, life: 1.6 });
      T.danger(car.x, car.z, 30, 5); car.hidden = true; car.mesh.visible = false;
      W.wasted('Your car exploded');
    }
  }

  // ---- HUD pieces -----------------------------------------------------------------------------------------
  let panelT = 0, lastHTML = '';
  function panel(dt, p) {
    panelT -= dt; if (panelT > 0) return; panelT = 0.2;
    const box = $('police');
    if (W.level < 1) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const units = [];
    W.cops.forEach((c) => {
      if (c.hidden || c.cs === 'idle' || c.cs === 'patrol' || c.cs === 'leave' || c.cs === 'dead') return;
      units.push({ call: c.call, d: Math.hypot(c.x - p.x, c.z - p.z), st: STATE_LABEL[c.cs] || 'PURSUIT', hp: c.hp });
    });
    if (CW.air && CW.air.policeHeli && CW.air.policeHeli.active) units.push(CW.air.policeHeli.panelRow(p));
    units.sort((a, b) => a.d - b.d);
    let h = '<div class="ph"><span>POLICE RESPONSE</span><b>' + units.length + ' UNIT' + (units.length === 1 ? '' : 'S') + '</b></div>';
    h += '<div class="ps ' + (W.seen ? 'seen' : 'lost') + '">' + (W.seen ? 'SUSPECT IN SIGHT' : 'SEARCHING  ' + Math.max(0, Math.ceil(W.lostT)) + 's  ·  LAST KNOWN ON MAP') + '</div>';
    units.slice(0, 6).forEach((u) => { h += '<div class="u"><b>' + u.call + '</b><span>' + (u.d >= 1000 ? (u.d / 1000).toFixed(1) + ' km' : Math.round(u.d) + ' m') + '</span><em class="s-' + u.st.replace(' ', '') + '">' + u.st + '</em></div>'; });
    if (!units.length) h += '<div class="u"><b>—</b><span></span><em>NO UNITS NEARBY</em></div>';
    if (h !== lastHTML) { lastHTML = h; box.innerHTML = h; }
  }

  W.drawMap = function (ctx, scale, p) {
    if (W.level < 1) return;
    const t = W.time;
    const r = 52 + W.level * 11;
    if (!W.seen) {
      ctx.save(); ctx.fillStyle = 'rgba(255,50,60,' + (0.16 + 0.07 * Math.sin(t * 5)) + ')'; ctx.strokeStyle = 'rgba(255,80,80,.95)'; ctx.lineWidth = 2.5 / scale; ctx.setLineDash([9 / scale, 6 / scale]);
      ctx.beginPath(); ctx.arc(W.last.x, W.last.z, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    const flash = Math.floor(t * 4) % 2 === 0;
    W.cops.forEach((c) => {
      if (c.hidden || c.cs === 'idle' || c.cs === 'dead') return;
      let dx = c.x - p.x, dz = c.z - p.z; const d = Math.hypot(dx, dz), lim = 97;
      if (c.cs === 'patrol' && W.level === 0) return;
      let x = c.x, z = c.z; if (d > lim) { x = p.x + (dx / d) * lim; z = p.z + (dz / d) * lim; }
      ctx.fillStyle = c.cs === 'roadblock' ? '#ff3030' : flash ? '#ff3030' : '#3a7bff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 / scale;
      ctx.beginPath();
      if (c.cs === 'roadblock') ctx.rect(x - 4 / scale, z - 4 / scale, 8 / scale, 8 / scale); else ctx.arc(x, z, (d > lim ? 3 : 4.4) / scale, 0, 7);
      ctx.fill(); ctx.stroke();
    });
  };

  // ---- per-frame ----------------------------------------------------------------------------------------
  let sightT = 0;
  W.update = function (dt, F) {
    if (!W.active) return;
    W.time += dt;
    const st = CW.hud.state;
    if (W.ended) {
      W.ended.t = (W.ended.t || 0) + dt;
      if (W.ended.t > 1.6) $('end-hint').style.opacity = 1;
      const I = CW.input;
      if (W.ended.t > 1.6 && (I.pressed('Enter') || I.pressed('Space') || I.pressed('Mouse0') || W.ended.t > 9)) respawn();
      return;
    }
    const p = who();
    // hurt flash
    W.hurtFlash = Math.max(0, (W.hurtFlash || 0) - dt); $('hurt').style.opacity = W.hurtFlash;
    wrecks(dt, p);
    // line of sight to the player
    sightT -= dt;
    if (sightT <= 0) {
      sightT = 0.22; let seen = false;
      for (let i = 0; i < W.cops.length && !seen; i++) {
        const c = W.cops[i]; if (c.hidden || c.cs === 'idle' || c.cs === 'dead') continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < 95 && los(c.x, c.z, p.x, p.z)) seen = true;
      }
      for (let i = 0; i < W.officers.length && !seen; i++) { const o = W.officers[i]; if (o.on && Math.hypot(o.x - p.x, o.z - p.z) < 70) seen = true; }
      if (CW.air && CW.air.policeSees && CW.air.policeSees(p)) seen = true;
      const spotter = W.cops.find((c) => !c.hidden && c.cs !== 'idle' && c.cs !== 'dead');
      if (seen && !W.seen && W.level > 0) W.say(spotter ? spotter.call : 'DISPATCH', 'Visual on suspect — ' + carName() + ', heading ' + head(p.vx, p.vz) + '.', 'vis', 9);
      if (!seen && W.seen && W.level > 0) W.say('DISPATCH', 'Lost visual. Last seen heading ' + head(p.vx, p.vz) + '. Set up a search.', 'lost', 8);
      W.seen = seen && W.level > 0;
    }
    // heat bookkeeping
    if (W.level > 0) {
      if (W.seen) {
        W.lostT = 0; W.last = { x: p.x, z: p.z }; W.seenT += dt;
        if (W.seenT > 26 && W.level < 4) { W.seenT = 0; W.raise(0.6, 'crime', null); }
      } else {
        W.seenT = 0; W.lostT += dt;
        if (W.lostT > 9) {
          const near = W.cops.some((c) => !c.hidden && c.cs !== 'idle' && c.cs !== 'patrol' && Math.hypot(c.x - p.x, c.z - p.z) < 70);
          const was = W.level; W.heat -= dt * (near ? 0.11 : 0.2); W.level = Math.min(5, Math.ceil(W.heat - 0.001));
          if (W.heat <= 0) W.clear(false); else if (W.level < was) { CW.hud.toast('WANTED LEVEL DOWN  ' + '★'.repeat(W.level)); W.say('DISPATCH', 'Suspect still at large — stand by.', 'down', 6); }
          const sr = W.cops.find((c) => !c.hidden && c.cs === 'search');
          if (Math.floor(W.lostT) % 14 === 0 && Math.floor(W.lostT) !== W.lastSay) { W.lastSay = Math.floor(W.lostT); W.say(sr ? sr.call : 'DISPATCH', 'Nothing yet. Keep checking the side streets.', 'srch', 12); }
        }
      }
    }
    // ram detection: player's car touching a cop while not wanted
    if (p.car) W.cops.forEach((c) => {
      if (c.hidden || c.cs === 'idle' || c.cs === 'dead') return;
      if (Math.abs(c.x - p.x) < 4.6 && Math.abs(c.z - p.z) < 4.6 && Math.hypot(c.vx - p.vx, c.vz - p.vz) > 6 && W.time > (W.ramCd || 0)) { W.ramCd = W.time + 2; W.crime('assault', c.x, c.z, 1.2, 0); }
    });
    // cops
    W.cops.forEach((c) => updateCop(c, dt, p, F));
    dispatch(dt, p);
    updateOfficers(dt, p);
    // siren lights + audio
    const flash = Math.floor(W.time * 7) % 2 === 0; let loud = 0;
    W.cops.forEach((c) => {
      if (c.hidden || c.cs === 'idle') return;
      const active = c.cs !== 'patrol' && c.cs !== 'leave' && c.cs !== 'dead';
      c.bar.red.visible = c.bar.gr.visible = active && flash; c.bar.blue.visible = c.bar.gb.visible = active && !flash;
      if (!active) { c.bar.red.visible = c.bar.blue.visible = true; c.bar.gr.visible = c.bar.gb.visible = false; }
      if (active) loud = Math.max(loud, Math.pow(Math.max(0, 1 - Math.hypot(c.x - p.x, c.z - p.z) / 170), 2));
    });
    if (audio.siren) audio.siren.gain.value = CW.damp(audio.siren.gain.value, loud * 0.045, 6, dt);
    // busted meter
    let near = false;
    if (W.level > 0 && (p.foot || p.speed < 3.5)) {
      near = W.officers.some((o) => o.on && Math.hypot(o.x - p.x, o.z - p.z) < 1.9) || W.cops.some((c) => !c.hidden && (c.cs === 'foot' || c.cs === 'ram' || c.cs === 'pursuit' || c.cs === 'roadblock') && Math.hypot(c.x - p.x, c.z - p.z) < 5.2);
    }
    W.bust = CW.clamp(W.bust + (near ? dt / 1.7 : -dt * 0.7), 0, 1);
    if (W.bust >= 1) { W.busted(); return; }
    $('bustwrap').style.opacity = W.bust > 0.02 ? 1 : 0; $('bustbar').style.width = Math.round(W.bust * 100) + '%';
    // HUD state
    st.wanted = W.level;
    $('stars').classList.toggle('search', W.level > 0 && !W.seen);
    panel(dt, p); radio(dt);
  };
})();
