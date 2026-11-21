// Things that shoot back and things you pick up: gang crews that defend their corners, police officers and
// roadblock cops returning fire, weapon / health / armour / ammo / cash pickups and enemy drops.
(function () {
  const CW = window.CW, T = CW.traffic, W = CW.police, Wp = CW.weapons;
  const rnd = CW.makeRng(31337);
  const E = (CW.enemies = { gang: [], pickups: [], time: 0 });
  const LINES = CW.C.LINES;

  // ---- who is the player right now ------------------------------------------------------------------------
  function pl() {
    const P = CW.player, e = P.active, A = CW.air;
    if (P.mode === 'car' && P.car) { const c = P.car; return { x: c.x, z: c.z, vx: c.vx, vz: c.vz, speed: c.speed, car: c, foot: false, y: 0 }; }
    if (P.mode === 'heli' && A) return { x: A.heli.x, z: A.heli.z, vx: A.heli.vx, vz: A.heli.vz, speed: Math.hypot(A.heli.vx, A.heli.vz), car: null, foot: false, heli: A.heli, y: A.heli.y };
    return { x: e.x, z: e.z, vx: e.vx, vz: e.vz, speed: e.speed, car: null, foot: true, y: e.y || 0 };
  }

  // an enemy bullet toward the player. Returns true on a hit.
  function shootAt(sx, sy, sz, p, acc, dmgP, dmgCar, cause, color, sound) {
    const d = Math.hypot(p.x - sx, p.z - sz);
    let a = acc * (1 - CW.clamp(d / 95, 0, 0.82));
    if (p.foot) a *= p.speed > 5 ? 0.6 : p.speed > 1 ? 0.85 : 1; else a *= p.speed > 12 ? 0.4 : 0.75;
    if (p.heli && p.y > 7) a *= 0.2;
    const hit = Math.random() < a, jx = hit ? 0 : (Math.random() - 0.5) * 5, jz = hit ? 0 : (Math.random() - 0.5) * 5;
    Wp.tracer(sx, sy, sz, p.x + jx, hit ? (p.foot ? 1.2 : 1.0) : 0.4 + Math.random() * 1.5, p.z + jz, color || 0xffa56a, 0.09);
    Wp.sound(sound || 'enemy', sx, sz); T.danger(sx, sz, 18, 2);
    if (!hit) return false;
    if (p.car) { p.car.hp = Math.max(0, p.car.hp - dmgCar); p.car.hitFlash = 0.2; W.hurt(dmgP * 0.15, cause); Wp.spark(p.x, 1.1, p.z); }
    else if (p.heli) { p.heli.hp -= dmgCar * 0.6; Wp.spark(p.x, p.y, p.z); }
    else { W.hurt(dmgP, cause); Wp.blood(p.x, 1.2, p.z); }
    return true;
  }
  E.shootAt = shootAt;

  // ---- gang crews ---------------------------------------------------------------------------------------------
  const HIDEOUTS = [
    { i: 4, j: 5, sx: 1, sz: 1, name: 'BANDA DEL PUERTO', n: 4 },
    { i: 2, j: 2, sx: -1, sz: 1, name: 'BANDA DEL CENTRO', n: 3 },
    { i: 1, j: 4, sx: -1, sz: 1, name: 'BANDA DEL OESTE', n: 3 },
  ];
  function freeSpot(x, z) { for (let k = 0; k < 12; k++) { const a = k * 2.4, r = k * 0.7, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, q = CW.world.resolve(px, pz, 0.6); if (!q.hit) return { x: px, z: pz }; } return { x, z }; }
  const SKINS = [0xd9a070, 0xb9805a, 0x8d5a3b, 0xe2b48a];
  function makeGang(h, k, gi) {
    const smg = k === 0;
    const model = CW.makePerson({ id: 'gang', skin: SKINS[k % 4], hair: 0x120c10, shirt: [0x7a3fb0, 0x5b2a8a, 0x9a55d8][k % 3], pants: 0x1f1a2e, shoes: 0x111111, female: false, shades: true });
    CW.world.scene.add(model);
    const gun = Wp.attachGun(model, smg ? 'smg' : 'pistol');
    const base = freeSpot(LINES[h.i] + 10 * h.sx + (k % 2 ? 2.5 : -2) + k * 0.4, LINES[h.j] + 10 * h.sz + k * 1.8 - 2);
    const g = { model, gun, grp: gi, x: base.x, z: base.z, home: { x: base.x, z: base.z }, h: rnd() * 6, vx: 0, vz: 0, hp: 60, state: 'idle', weap: smg ? 'smg' : 'pistol', fireT: 1, burst: 0, strafe: 1, strT: 0, visT: 0, vis: false, lostT: 0, prov: false, aimK: 0, deadT: 0, wT: 0, wp: null, flashT: 0, name: h.name };
    model.position.set(g.x, 0, g.z);
    return g;
  }

  E.hurtGang = function (g, dmg, dx, dz) {
    if (g.state === 'dead') return;
    g.hp -= dmg; g.prov = true; g.vx += dx * 1.2; g.vz += dz * 1.2;
    if (g.state === 'idle') engage(g);
    E.gang.forEach((o) => { if (o.grp === g.grp && o.state === 'idle' && Math.hypot(o.x - g.x, o.z - g.z) < 45) engage(o); });
    if (g.hp <= 0) {
      g.state = 'dead'; g.deadT = 0; g.gun.visible = false; Wp.kills++;
      const dir = Math.hypot(dx, dz) || 1; g.vx = (dx / dir) * 3; g.vz = (dz / dir) * 3;
      E.drop(g.x, g.z, rnd() < 0.5 ? 'cash' : rnd() < 0.55 ? 'ammo' : 'health');
      CW.hud.state.repXp = (CW.hud.state.repXp || 0);
    }
  };
  function engage(g) { g.state = 'fight'; g.lostT = 0; g.strT = 0; g.fireT = 0.4 + rnd() * 0.6; }

  function walkTo(g, tx, tz, sp, dt) {
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz) || 1;
    g.vx = CW.damp(g.vx, (dx / d) * sp, 9, dt); g.vz = CW.damp(g.vz, (dz / d) * sp, 9, dt);
  }

  function updateGang(g, dt, p) {
    const u = g.model.userData, P = CW.player;
    if (g.state === 'dead') {
      g.deadT += dt; const k = Math.min(1, g.deadT * 3.5); g.vx *= Math.exp(-3 * dt); g.vz *= Math.exp(-3 * dt); g.x += g.vx * dt; g.z += g.vz * dt;
      g.model.rotation.x = -1.5 * k; g.model.position.set(g.x, 0.16 * k, g.z); u.update(dt, 0);
      if (g.deadT > 130 && Math.hypot(g.x - p.x, g.z - p.z) > 90) { g.state = 'idle'; g.hp = 60; g.x = g.home.x; g.z = g.home.z; g.prov = false; g.gun.visible = true; g.model.rotation.x = 0; }
      return;
    }
    const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz);
    g.visT -= dt; if (g.visT <= 0) { g.visT = 0.25 + rnd() * 0.1; g.vis = d < 75 && W.los(g.x, g.z, p.x, p.z); }
    const armed = P.mode === 'foot' && Wp.cur !== 'fists' && Wp.cur !== 'knife';
    let sp = 0;
    if (g.state === 'idle') {
      if (g.vis && ((armed && d < 28) || d < 9 || (p.car && p.speed < 6 && d < 12))) { engage(g); E.gang.forEach((o) => { if (o.grp === g.grp && o.state === 'idle' && Math.hypot(o.x - g.x, o.z - g.z) < 40) engage(o); }); }
      g.wT -= dt; if (g.wT <= 0) { g.wT = 2.5 + rnd() * 4; g.wp = rnd() < 0.6 ? { x: g.home.x + (rnd() - 0.5) * 4, z: g.home.z + (rnd() - 0.5) * 4 } : null; }
      if (g.wp && Math.hypot(g.wp.x - g.x, g.wp.z - g.z) > 0.5) { sp = 1.1; walkTo(g, g.wp.x, g.wp.z, sp, dt); } else { g.vx = CW.damp(g.vx, 0, 8, dt); g.vz = CW.damp(g.vz, 0, 8, dt); }
      if (g.vis && d < 22) g.h = CW.dampAngle(g.h, Math.atan2(dx, dz), 3, dt);
      g.aimK = CW.damp(g.aimK, 0, 6, dt);
    } else {
      if (g.vis) g.lostT = 0; else g.lostT += dt;
      if (g.lostT > 9 || d > 85) { g.state = 'idle'; g.prov = false; g.wp = g.home; }
      g.h = CW.dampAngle(g.h, Math.atan2(dx, dz), 9, dt);
      g.strT -= dt; if (g.strT <= 0) { g.strT = 1 + rnd() * 1.6; g.strafe = rnd() < 0.5 ? 1 : -1; }
      let want = 0; if (d > 19) want = 1; else if (d < 8) want = -1;
      if (!g.vis && d > 6) want = 1;
      const nx = dx / (d || 1), nz = dz / (d || 1), mx = nx * want + -nz * g.strafe * 0.7, mz = nz * want + nx * g.strafe * 0.7, ml = Math.hypot(mx, mz) || 1;
      sp = 3.7; g.vx = CW.damp(g.vx, (mx / ml) * sp, 8, dt); g.vz = CW.damp(g.vz, (mz / ml) * sp, 8, dt);
      g.aimK = CW.damp(g.aimK, 1, 9, dt);
      // fire
      g.fireT -= dt;
      const tooHigh = p.heli && p.y > 9;
      if (g.fireT <= 0 && g.vis && d < 58 && !tooHigh) {
        if (g.weap === 'smg') { shootAt(g.x, 1.3, g.z, p, 0.6, 4, 2.2, 'Baleado por la banda', 0xffa56a, 'smg'); g.burst++; g.fireT = g.burst >= 4 ? 1.05 : 0.1; if (g.burst >= 4) g.burst = 0; }
        else { shootAt(g.x, 1.3, g.z, p, 0.62, 7, 4, 'Baleado por la banda'); g.fireT = 0.7 + rnd() * 0.5; }
        g.flashT = 0.06;
      }
    }
    g.x += g.vx * dt; g.z += g.vz * dt;
    const r = CW.world.resolve(g.x, g.z, 0.4); g.x = r.x; g.z = r.z;
    const spd = Math.hypot(g.vx, g.vz);
    g.model.position.set(g.x, 0, g.z); g.model.rotation.set(0, g.h, 0);
    u.update(dt, spd);
    if (g.aimK > 0.05) {
      const el = 0, a = (-0.75 + (-1.5708 - el + 0.75) * g.aimK);
      u.armR.sh.rotation.set(a, 0, 0.06); u.armR.el.rotation.x = -0.1;
      if (g.weap === 'smg') { u.armL.sh.rotation.set(a + 0.05, 0, -0.5); u.armL.el.rotation.x = -0.5; }
    }
    const f = g.gun.userData.flash; if (f) { if (g.flashT > 0) { g.flashT -= dt; f.visible = true; f.rotation.z = Math.random() * 3; } else f.visible = false; }
  }

  // ---- police officers and cop cars shooting back -------------------------------------------------------------
  E.hurtOfficer = function (o, dmg, dx, dz) {
    if (!o.alive) { o.hp = 70; o.alive = true; }
    o.hp -= dmg; o.vx += dx * 1.0; o.vz += dz * 1.0;
    W.crime('assault', o.x, o.z, 1.2, 0);
    if (o.hp <= 0 && o.on) {
      o.on = false; o.alive = false; o.model.visible = false; if (o.gun) o.gun.visible = false;
      if (o.car) { o.car.officer = null; if (o.car.cs === 'foot') o.car.cs = 'pursuit'; o.car = null; }
      Wp.kills++; W.raise(1.4, 'assault', null); E.drop(o.x, o.z, 'ammo'); W.say('DISPATCH', '¡OFICIAL CAÍDO! ¡Oficial caído! ¡Todas las unidades a mi posición!', 'down', 6);
      Wp.blood(o.x, 1, o.z);
    }
  };

  function copShooters(dt, p) {
    if (W.level < 2 || W.ended) return;
    W.officers.forEach((o) => {
      if (!o.on) { if (o.alive) o.alive = false; if (o.gun) o.gun.visible = false; return; }
      if (!o.alive) { o.hp = 70; o.alive = true; }
      if (!o.gun) o.gun = Wp.attachGun(o.model, 'pistol');
      o.gun.visible = true;
      const d = Math.hypot(p.x - o.x, p.z - o.z); o.shootT = (o.shootT || 0.5) - dt; o.visT = (o.visT || 0) - dt;
      if (o.visT <= 0) { o.visT = 0.3; o.vis = d < 60 && W.los(o.x, o.z, p.x, p.z); }
      o.aimK = CW.damp(o.aimK || 0, o.vis && d < 45 ? 1 : 0, 8, dt);
      if (o.aimK > 0.05) { const u = o.model.userData, a = -0.75 + (-1.5708 + 0.75) * o.aimK; u.armR.sh.rotation.set(a, 0, 0.05); u.armR.el.rotation.x = -0.1; u.armL.sh.rotation.set(a + 0.1, 0, -0.45); u.armL.el.rotation.x = -0.9; o.h = CW.dampAngle(o.h, Math.atan2(p.x - o.x, p.z - o.z), 8, dt); }
      if (o.shootT <= 0 && o.vis && d < 45 && !(p.heli && p.y > 9)) { shootAt(o.x, 1.3, o.z, p, 0.55 + W.level * 0.04, 6 + W.level, 3.5, 'SHOT BY POLICE', 0xffd27a); o.shootT = 0.75 + Math.random() * 0.6; }
    });
    W.cops.forEach((c) => {
      if (c.hidden || c.hp <= 0) return;
      const stat = c.cs === 'roadblock' || c.cs === 'foot';
      if (!stat && !(W.level >= 4 && (c.cs === 'pursuit' || c.cs === 'ram'))) return;
      const d = Math.hypot(p.x - c.x, p.z - c.z); if (d > (stat ? 50 : 34)) return;
      c.shootT = (c.shootT === undefined ? Math.random() : c.shootT) - dt; if (c.shootT > 0) return;
      c.shootT = stat ? 0.9 + Math.random() * 0.7 : 1.5 + Math.random();
      if (!W.los(c.x, c.z, p.x, p.z)) return;
      if (c.cs === 'foot' && c.officer) return;   // the officer on the pavement does the shooting
      shootAt(c.x, 1.4, c.z, p, stat ? 0.45 : 0.3, 5, 3, 'SHOT BY POLICE', 0xffd27a);
    });
  }

  // ---- pickups ---------------------------------------------------------------------------------------------------
  const LABEL = { health: 'SALUD', armour: 'ARMADURA', ammo: 'MUNICIÓN', cash: 'EFECTIVO', pistol: 'PISTOLA', smg: 'SUBFUSIL', shotgun: 'ESCOPETA', molotov: 'MOLOTOV x3' };
  const COL = { health: 0xff4a5a, armour: 0x4aa8ff, ammo: 0xffc83d, cash: 0x6dff8a, pistol: 0xff9a3d, smg: 0xff9a3d, shotgun: 0xff9a3d, molotov: 0xff9a3d };
  const labelTex = {};
  function label(type) {
    if (labelTex[type]) return labelTex[type];
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = 'rgba(8,24,30,.78)'; x.fillRect(0, 8, 256, 48); x.strokeStyle = '#' + ('000000' + COL[type].toString(16)).slice(-6); x.lineWidth = 4; x.strokeRect(2, 10, 252, 44);
    x.fillStyle = '#fff'; x.font = '900 30px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(LABEL[type], 128, 33);
    const t = new THREE.CanvasTexture(c); labelTex[type] = t; return t;
  }
  const bm = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); return m; };
  function pickupMesh(type) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    if (type === 'health') { body.add(bm(0.62, 0.62, 0.62, 0xf5f1e6, 0, 0, 0)); body.add(bm(0.4, 0.14, 0.64, 0xe02a3c, 0, 0, 0)); body.add(bm(0.14, 0.4, 0.64, 0xe02a3c, 0, 0, 0)); }
    else if (type === 'armour') { body.add(bm(0.56, 0.66, 0.2, 0x2f7ad6, 0, 0, 0)); body.add(bm(0.4, 0.3, 0.24, 0x8fd0ff, 0, 0.1, 0)); body.add(bm(0.28, 0.2, 0.22, 0x2f7ad6, 0, -0.28, 0)); }
    else if (type === 'ammo') { body.add(bm(0.7, 0.4, 0.5, 0x4a5a3a, 0, -0.1, 0)); [-0.2, 0, 0.2].forEach((x) => body.add(bm(0.12, 0.34, 0.12, 0xffc83d, x, 0.22, 0))); }
    else if (type === 'cash') { body.add(bm(0.55, 0.22, 0.32, 0x3fbf5a, 0, 0, 0)); body.add(bm(0.18, 0.24, 0.34, 0xf5f1e6, 0, 0, 0)); }
    else { const gm = Wp.gunModel(type); gm.rotation.set(0, 0, 0); gm.position.set(0, 0, 0); gm.visible = true; gm.scale.setScalar(type === 'shotgun' ? 1.1 : 1.6); gm.rotation.y = Math.PI / 2; body.add(bm(0.9, 0.12, 0.9, 0x2a3a42, 0, -0.35, 0)); body.add(gm); gm.traverse((o) => { if (o.userData && o.userData.flash) o.userData.flash.visible = false; }); }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: COL[type], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 })); gl.scale.setScalar(2.8); g.add(gl);
    const bmm = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: COL[type], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 })); bmm.scale.set(1.0, 9, 1); bmm.position.y = 4; g.add(bmm);
    const lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(type), transparent: true, depthWrite: false })); lb.scale.set(2.3, 0.58, 1); lb.position.y = 1.55; g.add(lb);
    g.userData = { body, gl };
    CW.world.scene.add(g); return g;
  }
  function addPickup(type, x, z, opt) {
    const p = { type, x, z, mesh: pickupMesh(type), on: true, rt: 0, life: opt && opt.life, amt: (opt && opt.amt) || 0, fixed: !(opt && opt.life), ph: rnd() * 6 };
    p.mesh.position.set(x, 0.9, z); E.pickups.push(p); return p;
  }
  E.drop = function (x, z, type) { addPickup(type, x, z, { life: 60, amt: type === 'cash' ? 60 + Math.floor(rnd() * 120) : 0 }); };

  function collect(p, pl2) {
    const st = CW.hud.state; let msg = null;
    switch (p.type) {
      case 'health': if (st.hp >= 100) return false; st.hp = Math.min(100, st.hp + 50); msg = 'SALUD +50'; break;
      case 'armour': if (st.armour >= 100) return false; st.armour = Math.min(100, st.armour + 50); msg = 'ARMADURA +50'; break;
      case 'ammo': Wp.refill(); msg = 'MUNICIÓN REPUESTA'; break;
      case 'cash': st.cash += p.amt || 80; msg = 'EFECTIVO +$' + (p.amt || 80); break;
      default: { const had = Wp.own[p.type]; Wp.give(p.type); msg = (had ? 'MUNICIÓN  ' : 'CONSEGUIDA  ') + Wp.defs[p.type].name; if (!had) Wp.equip(p.type, true); }
    }
    CW.hud.toast(msg); CW.sfx.play('pickup', 0.8); return true;
  }

  const SPOTS = [
    [6, 3, -1, 1, 'smg'], [6, 4, -1, -1, 'health'], [6, 4, -1, 1, 'armour'], [5, 3, 1, 1, 'shotgun'], [6, 2, -1, 1, 'ammo'], [4, 5, 1, -1, 'molotov'], [3, 3, 1, 1, 'health'],
    [3, 4, -1, 1, 'armour'], [2, 2, 1, 1, 'shotgun'], [4, 1, 1, 1, 'smg'], [5, 5, -1, -1, 'molotov'], [4, 4, 1, -1, 'ammo'], [1, 5, 1, -1, 'health'], [5, 6, -1, -1, 'armour'], [0, 3, 1, 1, 'ammo'], [6, 3, -1, -1, 'molotov'],
  ];

  // ---- init / update / map ---------------------------------------------------------------------------------------
  E.init = function () {
    HIDEOUTS.forEach((h, gi) => { for (let k = 0; k < h.n; k++) E.gang.push(makeGang(h, k, gi)); });
    SPOTS.forEach(([i, j, sx, sz, type]) => { const s = freeSpot(LINES[i] + 10 * sx, LINES[j] + 10 * sz); addPickup(type, s.x, s.z); });
  };
  E.reset = function () { E.gang.forEach((g) => { g.state = 'idle'; g.hp = 60; g.x = g.home.x; g.z = g.home.z; g.prov = false; g.gun.visible = true; g.model.rotation.x = 0; g.vx = g.vz = 0; }); E.pickups.forEach((p) => { if (!p.fixed) { p.life = 0; } }); };

  E.update = function (dt) {
    E.time += dt;
    const p = pl(), P = CW.player, f = P.focus();
    E.gang.forEach((g) => updateGang(g, dt, p));
    copShooters(dt, p);
    for (let i = E.pickups.length - 1; i >= 0; i--) {
      const k = E.pickups[i], m = k.mesh;
      if (!k.fixed) { k.life -= dt; if (k.life <= 0) { CW.world.scene.remove(m); E.pickups.splice(i, 1); continue; } }
      if (!k.on) { k.rt -= dt; if (k.rt <= 0) { k.on = true; m.visible = true; } continue; }
      const dx = k.x - f.x, dz = k.z - f.z; if (Math.abs(dx) > 160 || Math.abs(dz) > 160) { m.visible = false; continue; } m.visible = true;
      m.userData.body.rotation.y += dt * 1.7; m.userData.body.position.y = Math.sin(E.time * 2.2 + k.ph) * 0.12; m.userData.gl.material.opacity = 0.65 + 0.2 * Math.sin(E.time * 4 + k.ph);
      if (P.mode === 'heli' || W.ended) continue;
      if (Math.hypot(dx, dz) < (P.mode === 'car' ? 3.0 : 2.0) && ((P.active.y || 0) < 1.5) && collect(k, p)) { if (k.fixed) { k.on = false; k.rt = 70; m.visible = false; } else { k.life = 0; } }
    }
  };

  // (the minimap draws pickups and gang members from E.pickups / E.gang in hud.js)
})();
