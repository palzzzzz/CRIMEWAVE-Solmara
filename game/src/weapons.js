// Combat: the six-weapon set (fists, knife, pistol, SMG, shotgun, molotov), the radial weapon wheel (hold Q),
// draw / reload / recoil animation, ammo + reserves, ballistics against peds / gang / cops / cars, tracers,
// muzzle flash, molotov fire patches and the combat HUD (weapon strip, crosshair, hit marker).
(function () {
  const CW = window.CW, T = CW.traffic;
  const $ = (id) => document.getElementById(id);
  const Wp = (CW.weapons = { cur: 'pistol', prev: 'fists', own: { fists: true, knife: true, pistol: true }, ammo: {}, drawT: 9, reloadT: 0, cd: 0, kick: 0, aimK: 0, recent: 0, wheelOpen: false,
    aimFace: null, shoulder: 0, shake: 0, frame: 0, fires: [], shots: 0, kills: 0, hitT: 0, flash: 0 });

  // dmg per hit, rate shots/s, mag, spread (radians), range m, reload s, draw s, recoil, stats [damage, rate, range, accuracy] 0..1
  const DEFS = {
    fists: { id: 'fists', key: 1, name: 'PUÑOS', melee: true, dmg: 14, rate: 2.6, range: 1.9, draw: 0.2, stats: [0.2, 0.55, 0.05, 1], blurb: 'A puño limpio' },
    knife: { id: 'knife', key: 2, name: 'CUCHILLO', melee: true, dmg: 32, rate: 2.0, range: 2.2, draw: 0.3, stats: [0.4, 0.5, 0.06, 1], blurb: 'Silencioso y afilado' },
    pistol: { id: 'pistol', key: 3, name: 'PISTOLA', dmg: 24, rate: 3.6, auto: false, mag: 12, spread: 0.012, range: 80, reload: 1.3, draw: 0.35, recoil: 0.6, pellets: 1, resMax: 96, startRes: 48, stats: [0.4, 0.42, 0.62, 0.82], blurb: 'Semiautomática de 12 tiros' },
    smg: { id: 'smg', key: 4, name: 'SUBFUSIL', dmg: 13, rate: 12, auto: true, mag: 30, spread: 0.032, range: 60, reload: 1.7, draw: 0.4, recoil: 0.34, pellets: 1, resMax: 240, startRes: 90, stats: [0.3, 0.95, 0.5, 0.48], blurb: 'Automática de 30 tiros' },
    shotgun: { id: 'shotgun', key: 5, name: 'ESCOPETA', dmg: 12, rate: 1.1, auto: false, mag: 6, spread: 0.08, range: 30, reload: 2.2, draw: 0.55, recoil: 1.4, pellets: 9, resMax: 48, startRes: 18, stats: [0.95, 0.2, 0.25, 0.3], blurb: 'De corredera, 9 perdigones' },
    molotov: { id: 'molotov', key: 6, name: 'MOLOTOV', throw: true, rate: 0.8, mag: 1, range: 34, draw: 0.55, resMax: 9, startRes: 3, stats: [0.85, 0.1, 0.55, 0.6], blurb: 'Bomba de gasolina, arde 9 s' },
  };
  const ORDER = ['fists', 'knife', 'pistol', 'smg', 'shotgun', 'molotov'];
  Wp.defs = DEFS; Wp.order = ORDER;
  ORDER.forEach((id) => { const d = DEFS[id]; Wp.ammo[id] = { mag: d.mag || 0, res: id === 'pistol' ? 48 : 0 }; });

  const matCache = {};
  const mat = (c) => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c }));
  const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, fog: false }, o || {}));
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();

  // ---- gun models (barrel along +z, grip at the origin, hung from the forearm) ----------------------------
  function gunModel(id) {
    const g = new THREE.Group(), M = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); g.add(m); return m; };
    let mz = 0.3;
    if (id === 'pistol') { M(0.07, 0.09, 0.27, 0x2b3036, 0, 0.05, 0.1); M(0.06, 0.15, 0.075, 0x1b1e22, 0, -0.07, -0.02); M(0.03, 0.03, 0.04, 0x888e94, 0, 0.1, 0.22); mz = 0.26; }
    else if (id === 'smg') { M(0.08, 0.11, 0.42, 0x30353b, 0, 0.04, 0.12); M(0.05, 0.22, 0.07, 0x1b1e22, 0, -0.14, 0.1); M(0.06, 0.15, 0.07, 0x1b1e22, 0, -0.08, -0.04); M(0.035, 0.035, 0.18, 0x888e94, 0, 0.05, 0.43); M(0.05, 0.07, 0.2, 0x1b1e22, 0, 0.0, -0.22); mz = 0.54; }
    else if (id === 'shotgun') { M(0.045, 0.045, 0.78, 0x5a5f66, 0, 0.07, 0.34); M(0.045, 0.045, 0.78, 0x4a4f56, 0, 0.0, 0.34); M(0.07, 0.07, 0.24, 0x7a4a2a, 0, 0.0, 0.34); M(0.07, 0.13, 0.3, 0x7a4a2a, 0, 0.0, -0.17); M(0.06, 0.12, 0.1, 0x1b1e22, 0, -0.1, 0.0); mz = 0.76; }
    else if (id === 'knife') { M(0.03, 0.055, 0.3, 0xdfe6ea, 0, 0.0, 0.2); M(0.05, 0.08, 0.03, 0x2b2f33, 0, 0, 0.04); M(0.04, 0.05, 0.14, 0x3a2418, 0, 0, -0.04); mz = 0.38; }
    else if (id === 'molotov') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 8), new THREE.MeshLambertMaterial({ color: 0x4aa05a, transparent: true, opacity: 0.85 })); b.position.set(0, 0.0, 0.02); g.add(b); b.rotation.x = Math.PI / 2; b.position.set(0, 0, 0.12);
      const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0x4aa05a, transparent: true, opacity: 0.85 })); nk.rotation.x = Math.PI / 2; nk.position.set(0, 0, 0.28); g.add(nk);
      M(0.04, 0.04, 0.08, 0xe8dcc0, 0, 0, 0.36);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.setScalar(0.55); fl.position.set(0, 0, 0.44); g.add(fl); g.userData.flame = fl; mz = 0.4;
    }
    if (!DEFS[id].melee && !DEFS[id].throw) {
      const f = new THREE.Group(); f.position.set(0, 0.05, mz + 0.06); f.visible = false;
      const pm = basic(0xffd27a, { map: CW.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const a = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), pm), b = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), pm);
      a.rotation.z = Math.PI / 4; b.rotation.y = Math.PI / 2; b.rotation.z = Math.PI / 4; a.position.z = 0.12; b.position.z = 0.12;
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: 0xffb040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(1.5); gl.position.z = 0.1;
      f.add(a); f.add(b); f.add(gl); g.add(f); g.userData.flash = f;
    }
    g.userData.mz = mz;
    g.rotation.x = Math.PI / 2; g.position.set(0, -0.29, 0); g.visible = false;
    return g;
  }
  Wp.gunModel = gunModel;
  Wp.attachGun = function (model, id) { const g = gunModel(id); model.userData.armR.el.add(g); g.visible = true; return g; };
  function dressCrew(e) {
    const gs = (e.model.userData.guns = {});
    ORDER.forEach((id) => { if (id === 'fists') return; const g = gunModel(id); e.model.userData.armR.el.add(g); gs[id] = g; });
  }

  // ---- tracers, impacts ---------------------------------------------------------------------------------------
  const tracers = [];
  function initFx(scene) {
    const gm = new THREE.BoxGeometry(0.035, 0.035, 1);
    for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(gm, basic(0xffe9a0, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; m.userData.t = 0; scene.add(m); tracers.push(m); }
    const fg = [];
    for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: 0xff7a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); fg.push(s); }
    Wp.flames = fg;
    const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), new THREE.MeshLambertMaterial({ color: 0x4aa05a })); bm.visible = false; scene.add(bm);
    const bf = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); bf.scale.setScalar(0.7); bf.position.y = 0.2; bm.add(bf);
    Wp.bottle = bm; Wp.bottleLive = null;
  }
  let tNext = 0;
  Wp.tracer = function (x0, y0, z0, x1, y1, z1, color, life, w) {
    const m = tracers[tNext]; tNext = (tNext + 1) % tracers.length;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz); if (len < 0.5) return;
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.lookAt(x1, y1, z1); m.scale.set(w || 1, w || 1, len);
    m.material.color.setHex(color || 0xffe9a0); m.visible = true; m.userData.t = m.userData.max = life || 0.07;
  };
  const puff = (x, y, z, o) => CW.fx.puff(x, y, z, o);
  function blood(x, y, z) { for (let i = 0; i < 3; i++) puff(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, { color: 0xb3121c, size: 0.3, grow: 0.9, vy: 0.4 + Math.random(), vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, a: 0.85, life: 0.5 }); }
  function spark(x, y, z, col) { for (let i = 0; i < 2; i++) puff(x, y, z, { color: col || 0xffd070, size: 0.28, grow: 1.1, vy: 0.3 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, a: 0.9, life: 0.35 }); puff(x, y, z, { color: 0xbbbbbb, size: 0.4, grow: 1.2, vy: 0.6, a: 0.5, life: 0.7 }); }
  Wp.blood = blood; Wp.spark = spark;

  // distance-attenuated sound
  Wp.sound = function (name, x, z, boost) {
    const f = CW.player.focus(), d = Math.hypot(x - f.x, z - f.z), v = Math.pow(Math.max(0, 1 - d / (170 * (boost || 1))), 1.6);
    if (v > 0.01) CW.sfx.play(name, v);
  };

  // ---- ray casting ----------------------------------------------------------------------------------------------
  let targets = [], tFrame = -1;
  function buildTargets() {
    targets.length = 0;
    const f = CW.player.focus(), E = CW.enemies, H = CW.air;
    T.peds.forEach((p) => { if (p.state !== 'dead') targets.push({ k: 'ped', ref: p, x: p.x, z: p.z, r: 0.4, y0: 0, y1: 1.85 }); });
    if (E) E.gang.forEach((g) => { if (g.state !== 'dead') targets.push({ k: 'gang', ref: g, x: g.x, z: g.z, r: 0.42, y0: 0, y1: 1.85 }); });
    CW.police.officers.forEach((o) => { if (o.on) targets.push({ k: 'cop', ref: o, x: o.x, z: o.z, r: 0.42, y0: 0, y1: 1.85 }); });
    CW.vehicles.list.forEach((c) => {
      if (c.hidden || c.driven || Math.abs(c.x - f.x) > 120 || Math.abs(c.z - f.z) > 120) return;
      c.circles().forEach((q) => targets.push({ k: 'car', ref: c, x: q[0], z: q[1], r: q[2], y0: 0.1, y1: c.type.id === 'bike' ? 1.3 : 1.75 }));
    });
    if (H && H.policeHeli.active && H.policeHeli.state !== 'down') { const h = H.policeHeli; targets.push({ k: 'heli', ref: h, x: h.x, z: h.z, r: 3.0, y0: h.y - 1.8, y1: h.y + 1.8 }); }
  }
  Wp.cast = function (ox, oy, oz, dx, dy, dz, range) {
    if (tFrame !== Wp.frame) { buildTargets(); tFrame = Wp.frame; }
    let bt = range, hit = null;
    if (dy < -1e-4) { const tg = -oy / dy; if (tg > 0 && tg < bt) { bt = tg; hit = { k: 'ground' }; } }
    if (Math.hypot(dx, dz) > 1e-4) {
      for (let s = 0.8; s < bt; s += 1.2) {
        const x = ox + dx * s, y = oy + dy * s, z = oz + dz * s; if (y < 0) break; let b = false;
        CW.world.forNear(x, z, 0.1, (o) => { if (b || o.h <= y) return; if (o.t === 0) { if (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1) b = true; } else if (Math.hypot(x - o.x, z - o.z) < o.r) b = true; });
        if (b) { bt = s; hit = { k: 'wall' }; break; }
      }
    }
    const a = dx * dx + dz * dz;
    if (a > 1e-8) {
      for (let i = 0; i < targets.length; i++) {
        const tg = targets[i], rx = ox - tg.x, rz = oz - tg.z;
        if (Math.abs(rx) > range + 4 || Math.abs(rz) > range + 4) continue;
        const b2 = 2 * (rx * dx + rz * dz), c = rx * rx + rz * rz - tg.r * tg.r, disc = b2 * b2 - 4 * a * c; if (disc < 0) continue;
        const t = (-b2 - Math.sqrt(disc)) / (2 * a); if (t < 0 || t >= bt) continue;
        const y = oy + dy * t; if (y < tg.y0 || y > tg.y1) continue;
        bt = t; hit = { k: tg.k, ref: tg.ref, y };
      }
    }
    return { t: bt, hit, x: ox + dx * bt, y: oy + dy * bt, z: oz + dz * bt };
  };

  // ---- damage -----------------------------------------------------------------------------------------------------
  function dealDamage(h, dmg, dx, dz, melee) {
    const W = CW.police, E = CW.enemies; if (!h) return false;
    const ref = h.ref;
    switch (h.k) {
      case 'ped': {
        const head = h.y > 1.55 && !melee, killed = T.hurtPed(ref, dmg * (head ? 2.4 : 1), dx * 5, dz * 5);
        blood(ref.x, h.y || 1.2, ref.z); T.danger(ref.x, ref.z, 24, 4);
        if (killed) { Wp.kills++; W.crime('murder', ref.x, ref.z, 1.3, 45); if (E) E.drop(ref.x, ref.z, 'cash'); Wp.sound('hit', ref.x, ref.z); }
        else if (melee) W.crime('assault', ref.x, ref.z, 0.5, 35);
        return true;
      }
      case 'gang': E.hurtGang(ref, dmg * (h.y > 1.55 && !melee ? 2.2 : 1), dx, dz); blood(ref.x, h.y || 1.2, ref.z); return true;
      case 'cop': E.hurtOfficer(ref, dmg * (h.y > 1.55 && !melee ? 2.2 : 1), dx, dz); blood(ref.x, h.y || 1.2, ref.z); return true;
      case 'car': {
        const was = ref.hp; ref.hp = Math.max(0, ref.hp - dmg * 0.2); ref.hitFlash = 0.2;
        if (ref.cop) { W.crime('assault', ref.x, ref.z, 1.2, 0); if (was > 0 && ref.hp <= 0) W.crime('assault', ref.x, ref.z, 1.5, 0); }
        else if (ref.ai) { ref.ai.cruise = Math.min(28, ref.ai.cruise + 6); T.danger(ref.x, ref.z, 22, 3); }
        return true;
      }
      case 'heli': ref.hp -= dmg; CW.air.policeHeli.hit = 0.2; return true;
      default: return false;
    }
  }
  Wp.dealDamage = dealDamage;

  // ---- aiming ------------------------------------------------------------------------------------------------------
  const chest = { x: 0, y: 1.35, z: 0 };
  function aimPoint() {
    const e = CW.player.active, c = CW.camera;
    c.getWorldDirection(v3);
    const s0 = Math.max(1.5, (e.x - c.position.x) * v3.x + (1.35 + e.y - c.position.y) * v3.y + (e.z - c.position.z) * v3.z);
    const r = Wp.cast(c.position.x + v3.x * s0, c.position.y + v3.y * s0, c.position.z + v3.z * s0, v3.x, v3.y, v3.z, 140);
    return { x: r.x, y: r.y, z: r.z, hit: r.hit };
  }
  function muzzleOrigin(e, ap) {
    chest.x = e.x; chest.z = e.z; chest.y = 1.35 + e.y;
    let fx = ap.x - e.x, fz = ap.z - e.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const rx = -fz, rz = fx;   // right of facing (x, z) -> (-z, x) in this handedness
    return { x: e.x + fx * 0.65 + rx * 0.2, y: chest.y, z: e.z + fz * 0.65 + rz * 0.2, fx, fz };
  }

  // ---- shooting ----------------------------------------------------------------------------------------------------
  let gunCrimeT = 0;
  function shoot(e, d) {
    const a = Wp.ammo[d.id]; a.mag--; Wp.cd = 1 / d.rate; Wp.recent = 1.6; Wp.kick = Math.min(1.6, Wp.kick + d.recoil); Wp.shots++;
    const ap = aimPoint(), o = muzzleOrigin(e, ap);
    let dx = ap.x - o.x, dy = ap.y - o.y, dz = ap.z - o.z; const l = Math.hypot(dx, dy, dz);
    if (l < 2.2) { CW.camera.getWorldDirection(v3); dx = v3.x; dy = v3.y; dz = v3.z; } else { dx /= l; dy /= l; dz /= l; }
    const moving = Math.min(1, e.speed / 6), sp = d.spread * (1.35 - 0.55 * Wp.aimK) * (1 + moving * 0.9) * (1 + Wp.kick * 0.3);
    for (let p = 0; p < d.pellets; p++) {
      let rx = dx + (Math.random() - 0.5) * 2 * sp, ry = dy + (Math.random() - 0.5) * 2 * sp, rz = dz + (Math.random() - 0.5) * 2 * sp; const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
      const r = Wp.cast(o.x, o.y, o.z, rx, ry, rz, d.range);
      if (r.hit) { if (r.hit.k === 'wall' || r.hit.k === 'ground') spark(r.x, Math.max(0.1, r.y), r.z); else { dealDamage(r.hit, d.dmg, rx, rz, false); Wp.hitT = 0.18; CW.sfx.play('hit', 0.5); if (r.hit.k === 'car') spark(r.x, r.y, r.z); } }
      if (p < 4 || d.pellets === 1) Wp.tracer(o.x, o.y - 0.05, o.z, r.x, r.y, r.z, 0xffe9a0, 0.06);
    }
    const g = e.model.userData.guns[d.id]; if (g && g.userData.flash) { g.userData.flash.visible = true; g.userData.flash.rotation.z = Math.random() * 3; g.userData.flash.scale.setScalar(0.8 + Math.random() * 0.6); Wp.flash = 0.055; Wp.flashRef = g.userData.flash; }
    CW.sfx.play(d.id, 1); T.danger(e.x, e.z, 30, 4);
    CW.fx.puff(o.x + o.fx * 0.4, o.y, o.z + o.fz * 0.4, { color: 0xcccccc, size: 0.25, grow: 0.8, vy: 0.4, a: 0.35, life: 0.5 });
    Wp.shake = Math.max(Wp.shake, 0.012 * d.recoil * 3); CW.cam.pitch = CW.clamp(CW.cam.pitch - 0.004 * d.recoil * (d.pellets > 1 ? 2.2 : 1), -0.45, 1.2);
    gunCrimeT -= 1; if (gunCrimeT <= 0) { gunCrimeT = d.id === 'smg' ? 14 : 3; CW.police.crime('shots', e.x, e.z, d.id === 'pistol' ? 0.45 : 0.6, 55); }
    if (d.id === 'shotgun') setTimeout(() => CW.sfx.play('rack', 0.6), 480);
    Wp.pump = d.id === 'shotgun' ? 0.5 : 0;
  }

  // ---- melee ---------------------------------------------------------------------------------------------------------
  let swing = 0, swingDid = true, swingHand = 0;
  function startMelee(e, d) {
    swing = 0.32; swingDid = false; swingHand ^= 1; Wp.cd = 1 / d.rate; Wp.recent = 1.0; Wp.swingK = d.id === 'knife' ? 1 : 0;
    CW.sfx.play('swish', 0.7);
  }
  function meleeHit(e, d) {
    let any = false; const fx = Math.sin(e.h), fz = Math.cos(e.h);
    if (tFrame !== Wp.frame) { buildTargets(); tFrame = Wp.frame; }
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]; if (t.k === 'car' || t.k === 'heli') continue;
      const dx = t.x - e.x, dz = t.z - e.z, dist = Math.hypot(dx, dz); if (dist > d.range + t.r || dist < 1e-3) continue;
      if ((dx * fx + dz * fz) / dist < 0.55) continue;
      dealDamage({ k: t.k, ref: t.ref, y: 1.2 }, d.dmg, dx / dist, dz / dist, true);
      if (t.ref.vx !== undefined) { t.ref.vx += (dx / dist) * 3; t.ref.vz += (dz / dist) * 3; }
      any = true; Wp.hitT = 0.18; if (d.id === 'knife') break;
    }
    if (any) CW.sfx.play(d.id === 'knife' ? 'stab' : 'punch', 0.9);
  }

  // ---- molotov + fire --------------------------------------------------------------------------------------------------
  const flying = [];
  function throwMolotov(e) {
    const a = Wp.ammo.molotov; a.mag--; Wp.cd = 1 / DEFS.molotov.rate; Wp.recent = 1.4; swing = 0.45; swingDid = true; Wp.throwT = 0.45; Wp.throwDid = false;
    CW.sfx.play('swish', 0.6);
  }
  function releaseMolotov(e) {
    const ap = aimPoint(), o = muzzleOrigin(e, ap);
    let tx = ap.x, tz = ap.z, ty = Math.max(0, ap.y); const dd = Math.hypot(tx - o.x, tz - o.z), R = DEFS.molotov.range;
    if (dd > R) { tx = o.x + (tx - o.x) * R / dd; tz = o.z + (tz - o.z) * R / dd; ty = 0; }
    const dist = Math.min(dd, R), tf = CW.clamp(dist / 17, 0.45, 1.7), g = 14;
    flying.push({ x: o.x, y: o.y + 0.2, z: o.z, vx: (tx - o.x) / tf, vz: (tz - o.z) / tf, vy: (ty - o.y + 0.5 * g * tf * tf) / tf, t: 0, spin: 0 });
    Wp.sound('whoosh', e.x, e.z, 0.5);
  }
  function stepFlying(dt) {
    const b = Wp.bottle; let live = null;
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i]; f.t += dt; f.vy -= 14 * dt;
      const px = f.x, pz = f.z; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; f.spin += dt * 14;
      let boom = f.y <= 0.15 || f.t > 3.5;
      if (!boom) CW.world.forNear(f.x, f.z, 0.3, (o) => { if (boom || o.h <= f.y) return; if (o.t === 0 ? (f.x > o.x0 && f.x < o.x1 && f.z > o.z0 && f.z < o.z1) : Math.hypot(f.x - o.x, f.z - o.z) < o.r) { boom = true; f.x = px; f.z = pz; } });
      if (!boom && f.y < 2.2 && f.t > 0.12) { if (tFrame !== Wp.frame) { buildTargets(); tFrame = Wp.frame; } for (const t of targets) if (t.k !== 'heli' && Math.hypot(t.x - f.x, t.z - f.z) < t.r + 0.5 && f.y < t.y1 && f.y > t.y0 - 0.2) { boom = true; break; } }
      if (boom) { shatter(f.x, f.z); flying.splice(i, 1); } else live = f;
    }
    if (live) { b.visible = true; b.position.set(live.x, live.y, live.z); b.rotation.set(live.spin, 0, live.spin * 0.6); } else b.visible = false;
  }
  function shatter(x, z) {
    CW.sfx.play('glass', Math.pow(Math.max(0, 1 - Math.hypot(x - CW.player.focus().x, z - CW.player.focus().z) / 160), 1.4));
    const spots = []; Wp.flames.forEach((s) => { if (!s.userData.busy) spots.push(s); });
    const fire = { x, z, r: 4.6, t: 9.5, age: 0, fl: [], crimeT: 0 };
    for (let i = 0; i < 9 && i < spots.length; i++) { const s = spots[i]; s.userData.busy = true; s.visible = true; const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * fire.r * 0.85; s.userData.ox = Math.cos(a) * rr; s.userData.oz = Math.sin(a) * rr; s.userData.ph = Math.random() * 6; fire.fl.push(s); }
    Wp.fires.push(fire); if (Wp.fires.length > 4) endFire(Wp.fires.shift());
    for (let i = 0; i < 6; i++) puff(x + (Math.random() - 0.5) * 2, 0.6, z + (Math.random() - 0.5) * 2, { color: 0xffa030, size: 1.4, grow: 3, vy: 2.2, a: 0.8, life: 0.8 });
    CW.traffic.danger(x, z, 30, 7); CW.police.crime('arson', x, z, 1.1, 50);
    Wp.sound('whoosh', x, z, 0.8);
  }
  function endFire(f) { f.fl.forEach((s) => { s.userData.busy = false; s.visible = false; }); }
  function stepFires(dt) {
    const P = CW.player, W = CW.police, E = CW.enemies, V = CW.vehicles;
    for (let i = Wp.fires.length - 1; i >= 0; i--) {
      const f = Wp.fires[i]; f.age += dt; f.t -= dt;
      const k = f.t < 1.5 ? Math.max(0, f.t / 1.5) : Math.min(1, f.age / 0.5);
      f.fl.forEach((s) => { const u = s.userData, ph = f.age * 9 + u.ph; s.position.set(f.x + u.ox, 0.9 + Math.abs(Math.sin(ph * 0.7)) * 0.6, f.z + u.oz); s.scale.setScalar((2.1 + Math.sin(ph) * 0.6) * k); s.material.color.setHex(Math.sin(ph * 1.3) > 0.3 ? 0xffc040 : 0xff6a1a); });
      if (Math.random() < dt * 9) puff(f.x + (Math.random() - 0.5) * f.r, 1.2, f.z + (Math.random() - 0.5) * f.r, { color: 0x333333, size: 1.1, grow: 1.8, vy: 2.2, a: 0.5, life: 1.4 });
      if (f.t <= 0) { endFire(f); Wp.fires.splice(i, 1); continue; }
      T.peds.forEach((p) => { if (p.state === 'dead' || Math.hypot(p.x - f.x, p.z - f.z) > f.r) return; if (T.hurtPed(p, 32 * dt, 0, 0)) { W.crime('murder', p.x, p.z, 1.0, 40); Wp.kills++; } });
      if (E) { E.gang.forEach((g) => { if (g.state !== 'dead' && Math.hypot(g.x - f.x, g.z - f.z) < f.r) E.hurtGang(g, 22 * dt, 0, 0); });
        W.officers.forEach((o) => { if (o.on && Math.hypot(o.x - f.x, o.z - f.z) < f.r) E.hurtOfficer(o, 26 * dt, 0, 0); }); }
      V.list.forEach((c) => {
        if (c.hidden || Math.abs(c.x - f.x) > f.r + 3 || Math.abs(c.z - f.z) > f.r + 3) return;
        if (!c.circles().some((q) => Math.hypot(q[0] - f.x, q[1] - f.z) < f.r + q[2])) return;
        const was = c.hp; c.hp = Math.max(0, c.hp - 26 * dt); c.hitFlash = 0.1;
        if (c.cop && was > 0) W.crime('assault', c.x, c.z, 0.3, 0);
        if (was > 0 && c.hp <= 0 && !c.driven) T.danger(c.x, c.z, 24, 5);   // the fire + (driverless) blast now live in explosions.js
      });
      const pf = P.focus(); if (P.mode !== 'heli' && Math.hypot(pf.x - f.x, pf.z - f.z) < f.r - 0.4) W.hurt(14 * dt, 'BURNED ALIVE');
    }
  }

  // ---- equip / reload -------------------------------------------------------------------------------------------------
  Wp.equip = function (id, quiet) {
    if (!DEFS[id]) return false; if (!Wp.own[id]) { if (!quiet) CW.hud.toast(DEFS[id].name + ' NO LA TIENES — BUSCA UNA'); return false; }
    if (Wp.cur === id) return true;
    Wp.prev = Wp.cur; Wp.cur = id; Wp.drawT = 0; Wp.reloadT = 0; swing = 0; Wp.kick = 0;
    if (!quiet) CW.sfx.play('draw', 0.7);
    return true;
  };
  function startReload(d) {
    const a = Wp.ammo[d.id]; if (Wp.reloadT > 0 || a.mag >= d.mag || a.res <= 0) return;
    Wp.reloadT = d.reload; Wp.reloadFull = d.reload; CW.sfx.play(d.id === 'shotgun' ? 'rack' : 'reload', 0.7);
  }
  Wp.give = function (id, n) {
    const d = DEFS[id]; if (!d) return;
    const a = Wp.ammo[id], had = Wp.own[id]; Wp.own[id] = true;
    if (d.melee) return;
    if (!had) { a.mag = d.throw ? 1 : d.mag; a.res = Math.min(d.resMax, (d.startRes || 0) - (d.throw ? 1 : 0)); }
    else { a.res = Math.min(d.resMax, a.res + (n === undefined ? Math.ceil((d.startRes || 6) * 0.6) : n)); if (d.throw && a.mag === 0 && a.res > 0) { a.mag = 1; a.res--; } }
  };
  Wp.refill = function () {
    let n = 0; ORDER.forEach((id) => { const d = DEFS[id]; if (!Wp.own[id] || d.melee) return; const a = Wp.ammo[id]; a.res = Math.min(d.resMax, a.res + (d.throw ? 2 : d.mag * 2)); n++; });
    return n;
  };

  // ---- weapon wheel -----------------------------------------------------------------------------------------------------
  let wctx = null, wopenT = 0, wx = 0, wy = 0, wmx0 = 0, wmy0 = 0, wsel = 0;
  function icon(c, id, s, col) {
    c.save(); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = s * 0.12; c.lineJoin = 'round'; c.lineCap = 'round';
    const R = (x, y, w, h) => c.fillRect(x * s, y * s, w * s, h * s);
    if (id === 'fists') { c.beginPath(); c.roundRect ? c.roundRect(-0.7 * s, -0.35 * s, 0.7 * s, 0.7 * s, 0.18 * s) : c.rect(-0.7 * s, -0.35 * s, 0.7 * s, 0.7 * s); c.fill(); c.beginPath(); c.roundRect ? c.roundRect(0.05 * s, -0.5 * s, 0.7 * s, 0.7 * s, 0.18 * s) : c.rect(0.05 * s, -0.5 * s, 0.7 * s, 0.7 * s); c.fill(); }
    else if (id === 'knife') { c.beginPath(); c.moveTo(-0.9 * s, 0.1 * s); c.lineTo(0.1 * s, -0.15 * s); c.lineTo(0.95 * s, -0.5 * s); c.lineTo(0.5 * s, 0.05 * s); c.lineTo(0.0 * s, 0.2 * s); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(-0.98 * s, 0.0 * s, 0.5 * s, 0.22 * s); }
    else if (id === 'pistol') { R(-0.6, -0.25, 1.3, 0.28); R(-0.55, 0.0, 0.34, 0.62); R(-0.2, 0.03, 0.3, 0.1); }
    else if (id === 'smg') { R(-0.8, -0.22, 1.5, 0.3); R(-0.15, 0.05, 0.26, 0.75); R(-0.55, 0.05, 0.2, 0.38); R(0.7, -0.12, 0.35, 0.1); R(-1.0, -0.18, 0.28, 0.2); }
    else if (id === 'shotgun') { R(-0.2, -0.22, 1.35, 0.14); R(-0.2, -0.05, 1.2, 0.14); R(-1.1, -0.2, 0.9, 0.3); R(-0.9, 0.05, 0.3, 0.35); R(0.1, 0.1, 0.5, 0.16); }
    else if (id === 'molotov') { R(-0.22, -0.2, 0.44, 0.8); R(-0.1, -0.55, 0.2, 0.4); c.fillStyle = '#ffb43a'; c.beginPath(); c.moveTo(-0.15 * s, -0.55 * s); c.quadraticCurveTo(0, -1.25 * s, 0.2 * s, -0.55 * s); c.closePath(); c.fill(); }
    c.restore();
  }
  function drawWheel() {
    const c = wctx, S = 600, cx = S / 2, R0 = 112, R1 = 238, step = Math.PI / 3;
    c.clearRect(0, 0, S, S); c.save(); c.translate(cx, cx);
    for (let i = 0; i < 6; i++) {
      const id = ORDER[i], d = DEFS[id], own = Wp.own[id], sel = i === wsel, ang = -Math.PI / 2 + i * step, a0 = ang - step / 2 + 0.025, a1 = ang + step / 2 - 0.025, rs = sel ? R1 + 10 : R1;
      c.beginPath(); c.arc(0, 0, rs, a0, a1); c.arc(0, 0, R0, a1, a0, true); c.closePath();
      if (sel) { const g = c.createLinearGradient(0, -rs, 0, rs); g.addColorStop(0, 'rgba(255,120,70,.95)'); g.addColorStop(1, 'rgba(232,69,111,.9)'); c.fillStyle = g; } else c.fillStyle = own ? 'rgba(10,34,42,.82)' : 'rgba(10,22,28,.5)';
      c.fill(); c.lineWidth = sel ? 4 : 2; c.strokeStyle = sel ? '#ffc83d' : 'rgba(255,241,214,.28)'; c.stroke();
      const mr = (R0 + R1) / 2 + (sel ? 6 : 0), px = Math.cos(ang) * mr, py = Math.sin(ang) * mr;
      c.save(); c.translate(px, py - 12); CW.brand.weaponIcon(c, id, 44, own ? (sel ? '#ffffff' : '#ffe9a8') : 'rgba(255,255,255,.25)', own ? undefined : 'rgba(8,12,24,.4)'); c.restore();
      c.textAlign = 'center'; c.font = '900 15px Impact, sans-serif'; c.fillStyle = own ? '#fff' : 'rgba(255,255,255,.35)'; c.fillText(d.key + '  ' + d.name, px, py + 36);
      const a = Wp.ammo[id]; c.font = 'bold 13px Trebuchet MS, sans-serif'; c.fillStyle = sel ? '#fff7d6' : '#ffc83d';
      c.fillText(!own ? 'NO TIENES' : d.melee ? 'MELÉ' : d.throw ? 'x ' + (a.mag + a.res) : a.mag + ' | ' + a.res, px, py + 53);
    }
    // centre card: name, blurb, stat bars
    const id = ORDER[wsel], d = DEFS[id], own = Wp.own[id];
    c.beginPath(); c.arc(0, 0, R0 - 8, 0, 7); c.fillStyle = 'rgba(8,24,30,.9)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#ffc83d'; c.stroke();
    c.textAlign = 'center'; c.fillStyle = '#ffc83d'; c.font = '900 26px Impact, sans-serif'; c.fillText(d.name, 0, -62);
    c.fillStyle = 'rgba(255,241,214,.8)'; c.font = '12px Trebuchet MS, sans-serif'; c.fillText(own ? d.blurb : 'Aún no la encuentras', 0, -44);
    const labs = ['DAÑO', 'CADENCIA', 'ALCANCE', 'PRECISIÓN'];
    labs.forEach((l, k) => {
      const y = -24 + k * 24; c.textAlign = 'left'; c.fillStyle = '#d8f6f0'; c.font = 'bold 11px Trebuchet MS, sans-serif'; c.fillText(l, -78, y + 9);
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(-6, y, 84, 11); const v = own ? d.stats[k] : 0; const g = c.createLinearGradient(-6, 0, 78, 0); g.addColorStop(0, '#ffc83d'); g.addColorStop(1, '#ff6b4a'); c.fillStyle = g; c.fillRect(-6, y, 84 * v, 11);
    });
    c.restore();
  }
  function wheelUpdate(I) {
    if (!Wp.wheelOpen) return;
    if (I.locked) { wx = CW.clamp(wx + I.mdx, -170, 170); wy = CW.clamp(wy + I.mdy, -170, 170); } else { wx = CW.clamp(I.mouse.x - wmx0, -170, 170) + 0; wy = CW.clamp(I.mouse.y - wmy0, -170, 170); if (I.mdx || I.mdy) { wx = CW.clamp(wx, -170, 170); } }
    if (Math.hypot(wx, wy) > 32) wsel = ((Math.round((Math.atan2(wy, wx) + Math.PI / 2) / (Math.PI / 3)) % 6) + 6) % 6;
    for (let i = 0; i < 6; i++) if (I.pressed('Digit' + (i + 1))) wsel = i;
    drawWheel();
    const dot = $('wheeldot'); dot.style.transform = 'translate(' + wx + 'px,' + wy + 'px)';
  }
  Wp.openWheel = function () {
    if (Wp.wheelOpen) return; Wp.wheelOpen = true; wopenT = 0; wx = wy = 0; wmx0 = CW.input.mouse.x; wmy0 = CW.input.mouse.y; wsel = ORDER.indexOf(Wp.cur);
    $('wheel').style.display = 'flex'; drawWheel();
  };
  Wp.closeWheel = function (apply) {
    if (!Wp.wheelOpen) return; Wp.wheelOpen = false; $('wheel').style.display = 'none';
    if (apply) { const id = wopenT < 0.18 && Math.hypot(wx, wy) < 32 ? Wp.prev : ORDER[wsel]; Wp.equip(id); }
  };

  // ---- HUD (weapon strip, crosshair) ---------------------------------------------------------------------------------------
  const hc = {};
  function hudUpdate(foot) {
    const slots = $('weap').children;
    for (let i = 0; i < 6; i++) {
      const id = ORDER[i], d = DEFS[id], a = Wp.ammo[id], on = id === Wp.cur, own = !!Wp.own[id];
      const txt = !own ? '—' : d.melee ? '∞' : d.throw ? 'x' + (a.mag + a.res) : a.mag + '/' + a.res;
      const key = (on ? 'o' : own ? 'a' : 'x') + txt;
      if (hc[i] !== key) { hc[i] = key; slots[i].className = 'slot' + (on ? ' on' : '') + (own ? '' : ' na'); slots[i].lastChild.textContent = txt; }
    }
    const cr = $('cross'), gun = DEFS[Wp.cur].throw || (!DEFS[Wp.cur].melee), show = foot && gun && !Wp.wheelOpen;
    if (cr.style.opacity !== (show ? '1' : '0')) cr.style.opacity = show ? '1' : '0';
    if (show) { const sp = Math.round(8 + (1 - Wp.aimK) * 12 + Wp.kick * 14 + (DEFS[Wp.cur].pellets > 1 ? 10 : 0)); cr.style.setProperty('--sp', sp + 'px'); cr.classList.toggle('rl', Wp.reloadT > 0); }
    const hm = $('hitm'); hm.style.opacity = Wp.hitT > 0 ? Math.min(1, Wp.hitT * 8) : 0;
    const rl = $('reloadbar'); if (foot && Wp.reloadT > 0 && Wp.reloadFull) { rl.style.opacity = 1; rl.firstElementChild.style.width = Math.round((1 - Wp.reloadT / Wp.reloadFull) * 100) + '%'; } else rl.style.opacity = 0;
  }

  // ---- model pose ------------------------------------------------------------------------------------------------------------
  function pose(e, dt, elev) {
    const u = e.model.userData, d = DEFS[Wp.cur], gs = u.guns;
    ORDER.forEach((id) => { if (gs[id]) gs[id].visible = id === Wp.cur; });
    const k = CW.clamp(Wp.drawT / d.draw, 0, 1), kk = k * k * (3 - 2 * k), rec = Wp.kick;
    if (d.melee) {
      if (swing > 0) {
        const p = 1 - swing / 0.32, s = Math.sin(Math.PI * Math.min(1, p)), hand = d.id === 'knife' ? 0 : swingHand, A = hand ? u.armL : u.armR;
        A.sh.rotation.x = -2.0 * s; A.sh.rotation.z = (hand ? 1 : -1) * (d.id === 'knife' ? (0.9 - p * 1.8) : 0); A.el.rotation.x = -0.3 - 0.4 * s; u.body.rotation.y = (hand ? 1 : -1) * 0.5 * (1 - 2 * p) * s;
      } else if (Wp.recent > 0.01) { u.armR.sh.rotation.x = -1.0; u.armR.el.rotation.x = -1.5; u.armL.sh.rotation.x = -0.9; u.armL.el.rotation.x = -1.6; }
      return;
    }
    if (d.throw) {
      let a = -0.5 * kk;
      if (Wp.throwT > 0) { const p = 1 - Wp.throwT / 0.45; a = p < 0.35 ? 0.9 * (p / 0.35) : 0.9 - 3.2 * ((p - 0.35) / 0.65); u.body.rotation.y = -0.4 * Math.sin(Math.PI * p); }
      else a = -0.4 - 1.0 * Wp.aimK;
      u.armR.sh.rotation.x = a * (Wp.throwT > 0 ? 1 : kk); u.armR.el.rotation.x = -0.5; u.armL.sh.rotation.x = -0.2;
      const g = gs.molotov; if (g) { g.visible = Wp.throwT > 0 ? !Wp.throwDid : Wp.ammo.molotov.mag > 0; if (g.userData.flame) g.userData.flame.scale.setScalar(0.5 + Math.random() * 0.15); }
      return;
    }
    const two = d.id !== 'pistol', ang = (-0.75 + (-1.5708 - elev + 0.75) * Wp.aimK) * kk, r = Wp.reloadT > 0 ? 1 - Wp.reloadT / Wp.reloadFull : 0, tilt = Math.sin(Math.PI * r);
    u.armR.sh.rotation.set(ang - rec * 0.22 + tilt * 0.9, 0, two ? 0.2 : 0.05); u.armR.el.rotation.x = -0.1 - tilt * 0.3;
    if (two) { u.armL.sh.rotation.set(ang - rec * 0.2 + 0.08 + tilt * (-0.2), 0, -0.55 - tilt * 0.2); u.armL.el.rotation.x = -0.5 - tilt * 0.9; }
    else if (r > 0) { u.armL.sh.rotation.set(-1.2 + tilt * -0.2, 0, -0.5); u.armL.el.rotation.x = -1.2 * tilt; }
    else if (Wp.aimK > 0.4) { u.armL.sh.rotation.set(ang + 0.1, 0, -0.5); u.armL.el.rotation.x = -0.9; }
    u.body.rotation.x -= rec * 0.06; u.head.rotation.x = -elev * 0.4;
    if (d.id === 'shotgun' && Wp.pump > 0) u.armL.el.rotation.x -= Math.sin(Wp.pump * 12) * 0.4;
  }

  const uiOpen = () => !!((CW.shops && CW.shops.menu) || (CW.solfeed && CW.solfeed.open) || (CW.story && CW.story.talk));
  // ---- per-frame: player control ----------------------------------------------------------------------------------------------
  Wp.update = function (dt) {
    Wp.frame++;
    const P = CW.player, I = CW.input, e = P.active, W = CW.police;
    if (P.mode !== 'foot' || W.ended) {
      Wp.closeWheel(false); Wp.aimFace = null; Wp.shoulder = 0;
      [P.crew.ray, P.crew.luna].forEach((c) => { const gs = c.model.userData.guns; if (gs) ORDER.forEach((id) => { if (gs[id]) gs[id].visible = false; }); });
      hudUpdate(false); return;
    }
    // other crew member holds nothing
    const o = P.other(), og = o.model.userData.guns; if (og) ORDER.forEach((id) => { if (og[id]) og[id].visible = false; });
    // wheel
    if (I.pressed('KeyQ')) Wp.openWheel();
    if (Wp.wheelOpen) { wopenT += dt / 0.25; if (!I.isDown('KeyQ')) Wp.closeWheel(true); else wheelUpdate(I); }
    else if (!uiOpen()) for (let i = 0; i < 6; i++) if (I.pressed('Digit' + (i + 1))) Wp.equip(ORDER[i]);
    const d = DEFS[Wp.cur], a = Wp.ammo[d.id];
    Wp.cd = Math.max(0, Wp.cd - dt); Wp.drawT += dt; Wp.kick = Math.max(0, Wp.kick - dt * 3.2); Wp.recent = Math.max(0, Wp.recent - dt); Wp.hitT = Math.max(0, Wp.hitT - dt); Wp.pump = Math.max(0, (Wp.pump || 0) - dt);
    gunCrimeT = Math.min(gunCrimeT + dt * 0.5, 14);
    if (Wp.throwT > 0) { Wp.throwT -= dt; const p = 1 - Wp.throwT / 0.45; if (!Wp.throwDid && p > 0.55) { Wp.throwDid = true; releaseMolotov(e); } if (Wp.throwT <= 0) { Wp.drawT = 0.15; if (a.mag === 0 && a.res > 0) { a.mag = 1; a.res--; } } }
    if (Wp.reloadT > 0) { Wp.reloadT -= dt; if (Wp.reloadT <= 0) { const n = Math.min(d.mag - a.mag, a.res); a.mag += n; a.res -= n; Wp.reloadT = 0; } }
    const gun = !d.melee && !d.throw, canAct = !Wp.wheelOpen && Wp.drawT >= d.draw && Wp.reloadT <= 0 && !(Wp.throwT > 0);
    // aim state
    const wantAim = (gun || d.throw) && (I.isDown('Mouse2') || Wp.recent > 0.05 || (d.throw && Wp.throwT > 0));
    Wp.aimK = CW.damp(Wp.aimK, wantAim ? 1 : 0, wantAim ? 14 : 5, dt);
    if (gun && I.pressed('KeyR')) startReload(d);
    const fire = !Wp.wheelOpen && !uiOpen() && (d.auto ? I.isDown('Mouse0') : I.pressed('Mouse0'));
    if (fire && Wp.cd <= 0 && canAct) {
      if (d.melee) { if (swing <= 0) startMelee(e, d); }
      else if (d.throw) { if (a.mag > 0) throwMolotov(e); else if (a.res > 0) { a.mag = 1; a.res--; } else if (I.pressed('Mouse0')) { CW.sfx.play('click', 0.5); CW.hud.toast('SIN MOLOTOVS'); Wp.cd = 0.3; } }
      else if (a.mag > 0) shoot(e, d);
      else if (a.res > 0) startReload(d);
      else if (I.pressed('Mouse0') || Wp.cd <= 0) { CW.sfx.play('click', 0.6); CW.hud.toast('SIN MUNICIÓN'); Wp.cd = 0.35; }
    }
    if (swing > 0) { swing -= dt; if (!swingDid && d.melee && 1 - swing / 0.32 > 0.38) { swingDid = true; meleeHit(e, d); } }
    // facing + camera shoulder
    let elev = 0;
    if (Wp.aimK > 0.5 || (swing > 0 && d.melee) || Wp.throwT > 0) {
      const ap = aimPoint(); Wp.aimFace = Math.atan2(ap.x - e.x, ap.z - e.z);
      const dh = Math.hypot(ap.x - e.x, ap.z - e.z) || 1; elev = Math.atan2(ap.y - (1.35 + e.y), dh);
    } else Wp.aimFace = null;
    Wp.shoulder = CW.damp(Wp.shoulder, (gun || d.throw) ? 0.35 + 0.65 * Wp.aimK : 0, 7, dt);
    // pose after the locomotion animation has run
    pose(e, dt, CW.clamp(elev, -0.9, 0.9));
    if (Wp.flash > 0) { Wp.flash -= dt; if (Wp.flash <= 0 && Wp.flashRef) Wp.flashRef.visible = false; }
    if (Wp.shake > 0) { const c = CW.camera; c.position.x += (Math.random() - 0.5) * Wp.shake; c.position.y += (Math.random() - 0.5) * Wp.shake; c.position.z += (Math.random() - 0.5) * Wp.shake; Wp.shake = Math.max(0, Wp.shake - dt * 0.12); }
    hudUpdate(true);
  };

  // world simulation that keeps running during busted / wasted screens
  Wp.simulate = function (dt) {
    stepFlying(dt); stepFires(dt);
    tracers.forEach((m) => { if (!m.visible) return; m.userData.t -= dt; if (m.userData.t <= 0) m.visible = false; else m.material.opacity = m.userData.t / m.userData.max; });
    const V = CW.vehicles, f = CW.player.focus();
    V.list.forEach((c) => { if (c.hp <= 0 && !c.hidden && Math.abs(c.x - f.x) < 70 && Math.abs(c.z - f.z) < 70 && Math.random() < dt * 7) puff(c.x + (Math.random() - 0.5) * 1.5, 1.0, c.z + (Math.random() - 0.5) * 1.5, { color: Math.random() < 0.5 ? 0xff8a20 : 0x2a2a2a, size: 0.8, grow: 1.6, vy: 2.0, a: 0.7, life: 0.9 }); });
  };

  Wp.init = function (scene) {
    initFx(scene);
    ['ray', 'luna'].forEach((id) => dressCrew(CW.player.crew[id]));
    const w = $('weap'); w.innerHTML = ORDER.map((id) => '<div class="slot"><canvas class="wic" width="160" height="80"></canvas><b>' + DEFS[id].key + '</b>' + DEFS[id].name + '<span class="am"></span></div>').join('');
    Array.from(w.querySelectorAll('canvas.wic')).forEach((cv, i) => { const x = cv.getContext('2d'); x.translate(80, 44); CW.brand.weaponIcon(x, ORDER[i], 62, '#fff1c8'); });
    wctx = $('wheelc').getContext('2d');
  };
  Wp.reset = function () { Wp.closeWheel(false); flying.length = 0; Wp.fires.forEach(endFire); Wp.fires.length = 0; Wp.reloadT = 0; Wp.cd = 0; swing = 0; Wp.throwT = 0; };
})();
