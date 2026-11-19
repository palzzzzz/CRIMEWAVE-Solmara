// Car explosions: CW.fx.explode(x, z, r). Additive fireball + dark smoke + a flash from ONE permanent PointLight (created at
// init, intensity 0, never added or removed at runtime so three never recompiles materials), burning charred wrecks, and the
// blast itself: driverless cars hop and tumble (visual only, the 2D physics just gets a velocity kick), pedestrians are killed
// and thrown away from the centre. Triggers: a driverless car whose hp reaches 0 burns 2-4 s and blows; the player's own
// car keeps its burn-then-WASTED flow (police.js calls explode); cop cars that die get fire + char but no blast.
// No chain reactions: a blast never lowers another unmanned car's hp.
(function () {
  const CW = window.CW, X = (CW.explosions = { list: [], launched: [], wrecks: 0 });
  const FIRE_N = 54, SMOKE_N = 56, MAX_EX = 3, MAX_WRECK = 5;
  const fire = [], smoke = [];
  let light = null, lightE = 0, scene = null;
  const CHAR = new THREE.Color(0x1d1a18), tmp = new THREE.Color();
  const rnd = Math.random;

  X.init = function (sc) {
    scene = sc;
    const mk = (tex, additive, arr, n) => {
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
        s.visible = false; s.userData = { life: 0, max: 1 }; sc.add(s); arr.push(s);
      }
    };
    mk(CW.glowTex, true, fire, FIRE_N); mk(CW.smokeTex, false, smoke, SMOKE_N);
    light = new THREE.PointLight(0xff9a40, 0, 85); light.position.set(0, 4, 0); sc.add(light);
    // scorch marks on the ground
    X.scorch = [];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(8,6,5,.85)'); gr.addColorStop(0.6, 'rgba(10,8,6,.55)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const st = new THREE.CanvasTexture(c);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.rotation.x = -Math.PI / 2; m.visible = false; m.userData = { t: 0 }; sc.add(m); X.scorch.push(m);
    }
    X.sn = 0;
  };

  const take = (arr) => { for (let i = 0; i < arr.length; i++) if (!arr[i].visible) return arr[i]; return null; };
  const spawn = (arr, x, y, z, o) => {
    const s = take(arr); if (!s) return null; const u = s.userData;
    s.position.set(x, y, z); s.visible = true; u.life = u.max = o.life; u.vx = o.vx || 0; u.vy = o.vy || 0; u.vz = o.vz || 0; u.g = o.g || 0; u.drag = o.drag || 0;
    u.s0 = o.size; u.grow = o.grow || 0; u.a = o.a; u.col = o.col || 0; u.own = null; u.fl = 0;
    s.material.depthTest = !o.core; s.scale.setScalar(o.size); s.material.opacity = 0; s.material.color.setHex(o.c0 || 0xffffff); return s;
  };
  const FIRE_COL = [0xfffbe0, 0xffc548, 0xff7a1a, 0x8a2a0c];   // white-hot -> orange -> deep red

  X.explode = function (x, z, r, opt) {
    opt = opt || {}; r = r || 7;
    const P = CW.player, T = CW.traffic, W = CW.police, E = CW.enemies, V = CW.vehicles, Wp = CW.weapons, src = opt.src || null;
    // ---- visuals: 2 core + 8 fire + 6 sparks + 6 smoke = 22 sprites, at most 3 blasts alive at once
    while (X.list.length >= MAX_EX) X.list.shift();
    X.list.push({ t: 0 });
    // white-hot core: a quick huge flash plus a smaller, longer-lived yellow-white heart (depth test off so the tumbling wrecks
    // cannot hide it), then eight fat fire puffs that cool white-yellow -> orange -> red
    const f0 = spawn(fire, x, 1.4, z, { life: 0.42, size: 4, grow: 32, a: 1, c0: 0xfff8e0, core: 1 }); if (f0) f0.userData.fl = 1;
    const f1 = spawn(fire, x, 1.5, z, { life: 0.8, size: 4, grow: 9, a: 1, c0: 0xffe590, core: 1 }); if (f1) f1.userData.fl = 1;
    for (let i = 0; i < 8; i++) {
      const a = rnd() * 6.283, sp = 2 + rnd() * 4;
      spawn(fire, x + Math.cos(a) * 0.6, 0.9 + rnd() * 0.8, z + Math.sin(a) * 0.6, { life: 0.8 + rnd() * 0.5, size: 3.0, grow: 8 + rnd() * 4, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + rnd() * 3.5, drag: 2, a: 1, col: 1 });
    }
    for (let i = 0; i < 6; i++) {
      const a = rnd() * 6.283, sp = 6 + rnd() * 11;
      spawn(fire, x, 1.1, z, { life: 0.7 + rnd() * 0.5, size: 0.38, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 7 + rnd() * 9, g: 22, a: 1, c0: 0xffc060 });
    }
    for (let i = 0; i < 6; i++) {
      const a = rnd() * 6.283, d = rnd() * 2.4;
      spawn(smoke, x + Math.cos(a) * d, 1.4 + rnd(), z + Math.sin(a) * d, { life: 2.6 + rnd() * 1.2, size: 2.6, grow: 2.6 + rnd() * 1.4, vx: Math.cos(a) * 0.8, vz: Math.sin(a) * 0.8, vy: 2.2 + rnd() * 1.6, drag: 0.5, a: 0.8, c0: i % 2 ? 0x2c2a29 : 0x191817 });
    }
    lightE = 1; light.position.set(x, 4, z);
    const sc = X.scorch[X.sn++ % X.scorch.length]; sc.position.set(x, 0.07, z); sc.scale.setScalar(r * 0.95); sc.rotation.z = rnd() * 6.28; sc.userData.t = 0; sc.visible = true;
    const fd = P ? Math.hypot(P.focus().x - x, P.focus().z - z) : 99;
    if (Wp) { Wp.sound('explode', x, z, 1.4); Wp.shake = Math.max(Wp.shake || 0, 0.5 * Math.max(0, 1 - fd / 45)); }
    if (T) T.danger(x, z, r * 3, 6);
    // ---- the blast: pedestrians (killed + thrown), driverless cars (thrown), gangsters / officers / player (hurt)
    if (T) T.peds.forEach((p) => {
      if (p.state === 'dead') return; const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); if (d > r) return;
      const k = 1 - d / r, sp = 8 + 20 * k; T.hurtPed(p, 1e9, (dx / (d || 1)) * sp, (dz / (d || 1)) * sp);
    });
    if (E) {
      E.gang.forEach((g) => { if (g.state === 'dead') return; const dx = g.x - x, dz = g.z - z, d = Math.hypot(dx, dz); if (d < r) E.hurtGang(g, 110 * (1 - d / r), dx / (d || 1), dz / (d || 1)); });
      W.officers.forEach((o) => { if (!o.on) return; const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); if (d < r) E.hurtOfficer(o, 110 * (1 - d / r), dx / (d || 1), dz / (d || 1)); });
    }
    const pcar = P && P.mode === 'car' ? P.car : null, lcar = CW.gunner && CW.gunner.aboard ? CW.gunner.car : null;
    if (P && P.mode !== 'heli' && P.mode !== 'car' && !opt.noHurt) { const pf = P.focus(), d = Math.hypot(pf.x - x, pf.z - z); if (d < r) W.hurt(55 * (1 - d / r) + 5, 'BLOWN UP'); }
    V.list.forEach((c) => {
      if (c.hidden || c === src) return; const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz); if (d > r * 1.15) return;
      if (c === pcar || c === lcar || c.driven) { if (c !== src) c.hp = Math.max(1, c.hp - 22 * (1 - d / (r * 1.15))); return; }   // the player's ride is shaken, never thrown
      if (c.cop || c.ai) return;   // driven-by-AI traffic / cruisers are not "driverless"
      const k = 1 - d / (r * 1.15), imp = 7 + 15 * k, nx = dx / (d || 1), nz = dz / (d || 1);
      c.vx += nx * imp; c.vz += nz * imp; c.awake = true;
      X.throwCar(c, 0.6 + 0.8 * k, 1);
    });
    if (src) X.throwCar(src, 0.35, 0);   // the wreck itself jumps off the ground
  };
  CW.fx.explode = X.explode;

  // visual-only tumble: height arc + whole turns of roll / pitch, applied after vehicles.update (which resets the pose each frame)
  X.throwCar = function (car, power, spin) {
    let l = X.launched.find((q) => q.car === car); if (!l) { if (X.launched.length >= 14) return; l = { car }; X.launched.push(l); }
    l.t = 0; l.dur = 0.9 + power * 0.7; l.h = 1.2 + power * 2.8;
    l.rz = spin ? (rnd() < 0.5 ? -1 : 1) * Math.PI * 2 * (rnd() < 0.5 ? 1 : 2) : 0; l.rx = spin ? (rnd() < 0.5 ? -1 : 1) * Math.PI * 2 * (rnd() < 0.4 ? 1 : 0) : 0;
  };

  // ---- charring: clone the car's materials once (same shader, no recompile) and darken them
  function setChar(car, k) {
    if (!car._cm) {
      car._cm = [];
      car.mesh.traverse((o) => { if (o.isMesh && o.material && !o.material.isSpriteMaterial) { car._cm.push({ o, orig: o.material, c0: o.material.color.clone() }); o.material = o.material.clone(); } });
    }
    car._cm.forEach((e) => { e.o.material.color.copy(e.c0).lerp(CHAR, 0.8 * k); });
  }
  function clear(car) {
    if (car._cm) { car._cm.forEach((e) => { e.o.material.dispose(); e.o.material = e.orig; }); car._cm = null; }
    if (car._fl) { car._fl.forEach((s) => { s.visible = false; s.userData.own = null; }); car._fl = null; }
    car._ws = undefined;
  }

  // ---- per frame: runs right after vehicles.update
  X.update = function (dt, playing) {
    const P = CW.player, V = CW.vehicles, F = P.focus(), pcar = P.mode === 'car' ? P.car : null, lcar = CW.gunner && CW.gunner.aboard ? CW.gunner.car : null;
    // police helicopter (air.js owns hp / spin / smoke / the descent): when a DOWNED one touches the ground (it goes inactive that
    // frame, last seen under 4 m) the real blast goes off here, so nearby cars are thrown and pedestrians caught like any other fireball
    const ph = CW.air && CW.air.policeHeli;
    if (ph) {
      // air.js sets state 'down' at hp 0 but the orbit branch right below overwrites it the same frame, so the heli never fell:
      // latch it here (runs after air.update); next frame air.js takes its own spin-and-fall branch
      if (ph.active && ph.hp <= 0 && ph.state !== 'down') ph.state = 'down';
      if (ph.active && ph.state === 'down') X.phDown = { x: ph.x, z: ph.z, y: ph.y };
      else if (X.phDown) { const d = X.phDown; X.phDown = null; if (!ph.active && d.y < 4) { X.explode(d.x, d.z, 11); X.heliBlasts = (X.heliBlasts || 0) + 1; } }
    }
    let nWreck = 0;
    for (let i = 0; i < V.list.length; i++) {
      const c = V.list[i];
      if (c.hidden || c.hp > 0) { if (c._ws !== undefined) clear(c); continue; }
      if (c._ws === undefined) { c._ws = 'burn'; c._wt = 0; c._fuse = c.cop ? 1e9 : 2 + rnd() * 2; c._int = 0; if (CW.weapons) CW.weapons.sound('whoosh', c.x, c.z, 0.7); }
      c._wt += dt;
      const held = c.driven || c === pcar || c === lcar;
      if (c._ws === 'burn') {
        setChar(c, Math.min(0.55, c._wt * 0.2));
        if (!c.cop && !held && c._wt >= c._fuse) { X.explode(c.x, c.z, 7.5, { src: c }); c._ws = 'after'; c._wt = 0; setChar(c, 1); }
        else if (c.cop && c._wt > 0.5) { c._ws = 'after'; c._wt = 0; setChar(c, 1); }
      } else if (c._ws === 'after') {
        if (c._wt > (c.cop ? 8 : 7)) { c._ws = 'out'; c._fl && c._fl.forEach((s) => { s.visible = false; s.userData.own = null; }); c._fl = null; }
      }
      if (c._ws === 'out') continue;
      if (Math.abs(c.x - F.x) > 130 || Math.abs(c.z - F.z) > 130) continue;
      if (++nWreck > MAX_WRECK) continue;
      // flames (2 additive sprites) + smoke trickle; intensity fades out over the last 2 s of the "after" phase
      const inten = c._ws === 'burn' ? Math.min(1, 0.45 + c._wt * 0.5) : Math.max(0, Math.min(1, ((c.cop ? 8 : 7) - c._wt) / 2));
      if (!c._fl) c._fl = [];
      while (c._fl.length < 2) { const s = take(fire); if (!s) break; s.visible = true; s.material.depthTest = true; s.userData.life = s.userData.max = 1e9; s.userData.fl = 2; s.userData.own = c; s.userData.k = c._fl.length; s.userData.ph = rnd() * 6; c._fl.push(s); }
      c._fl.forEach((s) => { const u = s.userData, ph = c._wt * 11 + u.ph, off = u.k ? 1.0 : -1.0, sn = Math.sin(c.h), cn = Math.cos(c.h);
        s.position.set(c.x + sn * off * c.type.l * 0.22, 0.75 + Math.abs(Math.sin(ph * 0.7)) * 0.5, c.z + cn * off * c.type.l * 0.22);
        s.scale.setScalar((1.5 + Math.sin(ph) * 0.45) * inten + 0.01); s.material.opacity = 0.9 * inten; s.material.color.setHex(Math.sin(ph * 1.3) > 0.2 ? 0xffc040 : 0xff6a1a); });
      c._int -= dt;
      if (c._int <= 0 && inten > 0.05) { c._int = (c._ws === 'burn' ? 0.16 : 0.26) + rnd() * 0.12; spawn(smoke, c.x + (rnd() - 0.5) * 1.6, 1.3, c.z + (rnd() - 0.5) * 1.6, { life: 1.8 + rnd(), size: 1.0, grow: 1.5, vy: 2.2, vx: 0.4, drag: 0.2, a: 0.6 * inten + 0.15, c0: 0x242321 }); }
    }
    // ---- sprite animation
    for (let i = 0; i < fire.length; i++) {
      const s = fire[i], u = s.userData; if (!s.visible || u.fl === 2) continue;
      u.life -= dt; if (u.life <= 0) { s.visible = false; continue; }
      const k = 1 - u.life / u.max; u.vy -= u.g * dt; const dg = Math.exp(-u.drag * dt); u.vx *= dg; u.vz *= dg; if (u.col) u.vy *= dg;
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt; if (s.position.y < 0.1 && u.g) { s.position.y = 0.1; u.vy = 0; u.vx *= 0.3; u.vz *= 0.3; }
      s.scale.setScalar(u.s0 + u.grow * k * (u.fl === 1 ? Math.sqrt(k) : 1));
      s.material.opacity = u.a * (u.fl === 1 ? (1 - k) * (1 - k) : Math.min(1, k * 8) * (1 - k));
      if (u.col) s.material.color.setHex(FIRE_COL[Math.min(3, Math.floor(k * 4))]);
    }
    for (let i = 0; i < fire.length; i++) { const s = fire[i]; if (s.userData.fl === 2 && s.visible && (!s.userData.own || s.userData.own.hidden || s.userData.own._fl == null)) { s.visible = false; s.userData.own = null; } }
    for (let i = 0; i < smoke.length; i++) {
      const s = smoke[i], u = s.userData; if (!s.visible) continue;
      u.life -= dt; if (u.life <= 0) { s.visible = false; continue; }
      const k = 1 - u.life / u.max, dg = Math.exp(-u.drag * dt); u.vx *= dg; u.vz *= dg; u.vy *= Math.exp(-0.45 * dt);
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt; s.scale.setScalar(u.s0 + u.grow * k * 1.6);
      s.material.opacity = u.a * Math.min(1, k * 6) * (1 - k * k);
    }
    // light flash
    if (lightE > 0) { lightE = Math.max(0, lightE - dt * 2.2); light.intensity = 15 * lightE * lightE; } else if (light.intensity) light.intensity = 0;
    for (let i = 0; i < X.scorch.length; i++) { const m = X.scorch[i]; if (!m.visible) continue; m.userData.t += dt; const o = Math.min(1, m.userData.t * 4) * Math.max(0, 1 - (m.userData.t - 40) / 20); m.material.opacity = o; if (o <= 0 && m.userData.t > 40) m.visible = false; }
    // thrown cars: arc + tumble layered over the pose vehicles.update just wrote
    for (let i = X.launched.length - 1; i >= 0; i--) {
      const l = X.launched[i], c = l.car; l.t += dt; const u = Math.min(1, l.t / l.dur);
      if (c.hidden || u >= 1) { X.launched.splice(i, 1); continue; }
      const e = u * u * (3 - 2 * u), m = c.mesh;
      m.position.y += 4 * l.h * u * (1 - u); m.rotation.z += l.rz * e; m.rotation.x += l.rx * e;
    }
    void playing;
  };
})();
