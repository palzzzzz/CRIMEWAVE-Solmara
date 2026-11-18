// Air: the flyable helicopter on the harbour helipad (take-off, whole-city flight, roof / ground landing, rotor, altitude
// shadow, rotor wash) and the police helicopter with a moving searchlight that appears at 4+ stars (CW.air hooks).
(function () {
  const CW = window.CW, $ = (id) => document.getElementById(id);
  const A = (CW.air = { heli: null, policeHeli: null });
  const PAD = { x: 60, z: 274 };
  const mats = {};
  const lam = (c) => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
  const bx = (p, w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };

  // ---- model --------------------------------------------------------------------------------------------------
  function buildHeli(o) {
    const root = new THREE.Group(); root.rotation.order = 'YXZ';
    const g = new THREE.Group(); root.add(g);
    bx(g, 1.9, 1.7, 3.4, o.body, 0, 1.3, 0.2); bx(g, 1.5, 1.2, 1.5, o.body, 0, 1.0, 2.3); bx(g, 1.52, 0.85, 1.4, o.glass, 0, 1.45, 2.4); bx(g, 1.95, 0.75, 1.5, o.glass, 0, 1.6, 0.8);
    bx(g, 1.94, 0.3, 3.4, o.accent, 0, 0.72, 0.2); bx(g, 1.1, 0.55, 1.9, o.accent, 0, 2.38, -0.3);
    bx(g, 0.45, 0.5, 4.8, o.body, 0, 1.6, -3.7); bx(g, 0.1, 1.35, 1.0, o.accent, 0, 2.3, -5.8); bx(g, 1.7, 0.08, 0.55, o.accent, 0, 1.75, -5.7);
    [-1, 1].forEach((s) => { bx(g, 0.09, 0.09, 4.0, 0x2a2f33, s * 1.05, 0.22, 0.5); bx(g, 0.08, 0.85, 0.08, 0x2a2f33, s * 1.0, 0.65, 1.4); bx(g, 0.08, 0.85, 0.08, 0x2a2f33, s * 1.0, 0.65, -0.55); });
    bx(g, 0.18, 0.5, 0.18, 0x2a2f33, 0, 2.85, 0);
    const rotor = new THREE.Group(); rotor.position.set(0, 3.15, 0); g.add(rotor);
    bx(rotor, 10.6, 0.05, 0.36, 0x2c3238, 0, 0, 0); bx(rotor, 0.36, 0.05, 10.6, 0x2c3238, 0, 0, 0); bx(rotor, 0.4, 0.22, 0.4, 0x555c63, 0, 0, 0);
    const blur = new THREE.Mesh(new THREE.CircleGeometry(5.3, 28), new THREE.MeshBasicMaterial({ color: 0xdfe8ee, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false })); blur.rotation.x = -Math.PI / 2; blur.position.y = 3.17; g.add(blur);
    const tail = new THREE.Group(); tail.position.set(0.3, 2.2, -5.8); g.add(tail); bx(tail, 0.04, 1.5, 0.16, 0x2c3238, 0, 0, 0); bx(tail, 0.04, 0.16, 1.5, 0x2c3238, 0, 0, 0);
    const lights = [];
    const spr = (c, x, y, z, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); g.add(sp); lights.push(sp); return sp; };
    const nav = [spr(0xff2a2a, 1.1, 1.3, 0.3, 1.1), spr(0x2aff6a, -1.1, 1.3, 0.3, 1.1), spr(0xffffff, 0, 2.2, -6.2, 1.2)];
    let red = null, blue = null;
    if (o.police) { bx(g, 1.4, 0.12, 0.4, 0x111418, 0, 0.55, 1.9); red = spr(0xff2a2a, 0.6, 0.5, 1.9, 2.8); blue = spr(0x2a6bff, -0.6, 0.5, 1.9, 2.8); bx(g, 2.0, 0.22, 2.0, 0x1f3f8f, 0, 1.3, -0.6); }
    return { root, rotor, tail, blur, nav, red, blue };
  }

  // ---- player helicopter ----------------------------------------------------------------------------------------
  let shadow = null;
  function init(scene) {
    const mk = buildHeli({ body: 0xf4efe2, accent: 0xff6b4a, glass: 0x1f4a5e });
    scene.add(mk.root);
    A.heli = { x: PAD.x, y: 0.12, z: PAD.z, h: Math.PI, vx: 0, vy: 0, vz: 0, fs: 0, ls: 0, floor: 0.1, rs: 0, occ: false, dead: false, hp: 100, pitch: 0, roll: 0, mk, rotorSfx: CW.sfx.makeRotor(), washT: 0, turn: 0, up: 0 };
    shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false }));
    shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
    // police helicopter
    const pk = buildHeli({ body: 0x1d2a4a, accent: 0xf2f6f8, glass: 0x0c1a26, police: true });
    pk.root.visible = false; scene.add(pk.root);
    const coneGeo = new THREE.CylinderGeometry(0.12, 1, 1, 20, 1, true); coneGeo.translate(0, -0.5, 0); coneGeo.rotateX(-Math.PI / 2);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    cone.visible = false; cone.frustumCulled = false; scene.add(cone);
    const discGeo = new THREE.CircleGeometry(1, 28); discGeo.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false }));
    disc.visible = false; scene.add(disc);
    A.policeHeli = { active: false, state: 'in', x: 0, y: 60, z: 0, h: 0, vx: 0, vz: 0, hp: 400, spot: { x: 0, z: 0 }, ang: 0, cool: 0, leaveT: 0, mk: pk, cone, disc, hit: 0, sees: false, rs: 1, t: 0, sw: 0, rotorSfx: CW.sfx.makeRotor(), vy: 0, spin: 0 };
    A.policeHeli.panelRow = (p) => ({ call: 'AIR-1', d: Math.hypot(A.policeHeli.x - p.x, A.policeHeli.z - p.z), st: 'SEARCHLIGHT', hp: A.policeHeli.hp });
  }
  A.init = init;
  A.policeSees = () => A.policeHeli.active && A.policeHeli.state === 'orbit' && A.policeHeli.sees;

  A.reset = function () {
    const h = A.heli; Object.assign(h, { x: PAD.x, y: 0.12, z: PAD.z, h: Math.PI, vx: 0, vy: 0, vz: 0, fs: 0, ls: 0, rs: 0, occ: false, dead: false, hp: 100, pitch: 0, roll: 0 });
    h.mk.root.visible = true;
    const ph = A.policeHeli; ph.active = false; ph.cool = 0; ph.mk.root.visible = false; ph.cone.visible = false; ph.disc.visible = false;
  };
  A.onRespawn = function () {
    const P = CW.player; if (P.mode === 'heli') { P.mode = 'foot'; P.active.model.visible = true; }
    A.heli.occ = false; if (A.heli.dead || A.heli.hp <= 0) A.reset(); else { A.heli.vx = A.heli.vz = A.heli.vy = 0; }
    $('heli').style.display = 'none';
  };

  A.canEnter = function (e) { const h = A.heli; return !h.occ && !h.dead && Math.hypot(e.x - h.x, e.z - h.z) < 7 && h.y < h.floor + 2.5; };
  A.enter = function () {
    const P = CW.player, h = A.heli, e = P.active; h.occ = true; P.mode = 'heli'; e.model.visible = false; P.prompt = null;
    CW.cam.carYaw = h.h; CW.cam.look = 0; CW.hud.toast('HELICOPTER  —  SPACE UP · SHIFT DOWN · W/S FORWARD · A/D TURN');
  };

  // landing floor + building collision for a circle at (x, y, z)
  function collide(h, dt) {
    let floor = 0.1; const r = 2.7; let hitSpeed = 0;
    CW.world.forNear(h.x, h.z, r + 2, (o) => {
      let inside, dx = 0, dz = 0, d = 0;
      if (o.t === 0) {
        const cx = CW.clamp(h.x, o.x0, o.x1), cz = CW.clamp(h.z, o.z0, o.z1); dx = h.x - cx; dz = h.z - cz; d = Math.hypot(dx, dz);
        inside = h.x > o.x0 - 1.2 && h.x < o.x1 + 1.2 && h.z > o.z0 - 1.2 && h.z < o.z1 + 1.2;
      } else { dx = h.x - o.x; dz = h.z - o.z; d = Math.hypot(dx, dz) - o.r; inside = d < 1.2; }
      if (h.y >= o.h - 0.4) { if (inside && o.r !== 0.001) floor = Math.max(floor, o.h + 0.1); return; }
      if (d >= r) return;
      let nx, nz;
      if (o.t === 1 || d > 1e-5) { const l = Math.hypot(dx, dz) || 1; nx = dx / l; nz = dz / l; } else { nx = h.x < (o.x0 + o.x1) / 2 ? -1 : 1; nz = 0; }
      const pen = r - Math.max(0, d); h.x += nx * pen; h.z += nz * pen;
      const vn = h.vx * nx + h.vz * nz; if (vn < 0) { h.vx -= 1.4 * vn * nx; h.vz -= 1.4 * vn * nz; h.fs *= 0.5; h.ls *= 0.5; hitSpeed = Math.max(hitSpeed, -vn); }
    });
    h.floor = floor;
    h.hitCd = Math.max(0, (h.hitCd || 0) - dt);
    if (hitSpeed > 5 && h.hitCd <= 0) { h.hitCd = 0.6; h.hp -= (hitSpeed - 4) * 2.4; CW.weapons.shake = 0.4; CW.sfx.play('crash', 0.8); CW.hud.toast('HELICOPTER DAMAGED'); }
  }

  A.fly = function (dt) {
    const P = CW.player, I = CW.input, h = A.heli, e = P.active, cam = CW.cam;
    h.rs = Math.min(1, h.rs + dt / 2.8);
    const ready = h.rs > 0.85 ? 1 : 0;
    const fIn = I.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']), turn = I.axis(['KeyD'], ['KeyA']), sIn = I.axis(['ArrowLeft'], ['ArrowRight']);
    const up = (I.isDown('Space') ? 1 : 0) - (I.isDown('ShiftLeft') || I.isDown('ShiftRight') || I.isDown('KeyC') ? 1 : 0);
    const alt = h.y - h.floor, grounded = alt < 0.35;
    h.fs += (fIn * 54 * ready * (grounded ? 0.25 : 1) - h.fs) * Math.min(1, dt * 0.95);
    h.ls += (sIn * 26 * ready * (grounded ? 0 : 1) - h.ls) * Math.min(1, dt * 1.5);
    h.turn += (turn - h.turn) * Math.min(1, dt * 4);
    h.h += h.turn * 1.2 * dt * ready;
    h.up = up;
    let vyT = up * (up > 0 ? 14 : 15) * ready;
    if (vyT < 0 && alt < 14) vyT = Math.max(vyT, -(2.2 + alt * 0.85));   // flare: holding SHIFT settles gently onto the ground
    h.vy += (vyT - h.vy) * Math.min(1, dt * 2.4);
    const s = Math.sin(h.h), c = Math.cos(h.h);
    h.vx = s * h.fs - c * h.ls; h.vz = c * h.fs + s * h.ls;
    h.x += h.vx * dt; h.z += h.vz * dt; h.y += h.vy * dt;
    h.y = Math.min(h.y, 260);
    collide(h, dt);
    const b = { x0: -318, x1: 520, z0: -318, z1: 345 };
    if (h.x < b.x0 || h.x > b.x1 || h.z < b.z0 || h.z > b.z1) { h.x = CW.clamp(h.x, b.x0, b.x1); h.z = CW.clamp(h.z, b.z0, b.z1); h.fs *= 0.9; h.ls *= 0.9; CW.hud.toast('TURN BACK — OUT OF THE CITY'); }
    if (h.y <= h.floor) { const imp = -h.vy; if (imp > 9) { h.hp -= (imp - 9) * 7; CW.sfx.play('crash', 0.9); CW.weapons.shake = 0.5; } h.y = h.floor; if (h.vy < 0) h.vy = 0; if (!ready) h.vy = 0; h.fs *= Math.exp(-1.6 * dt); h.ls *= Math.exp(-3 * dt); }
    // visual attitude
    const spd = Math.hypot(h.vx, h.vz), pT = (h.fs / 54) * 0.26 + (h.vy < -5 ? -0.05 : 0), rT = (h.ls / 26) * 0.3 - h.turn * 0.16 * Math.abs(h.fs / 54);
    h.pitch += (pT - h.pitch) * Math.min(1, dt * 3); h.roll += (rT - h.roll) * Math.min(1, dt * 3);
    // player entity follows
    e.x = h.x; e.z = h.z; e.h = h.h; e.vx = h.vx; e.vz = h.vz; e.speed = spd; e.model.position.set(h.x, -50, h.z);
    // crash
    if (h.hp <= 0 && !h.dead) { explode(h); CW.police.wasted('Your helicopter crashed'); return; }
    // camera
    if (I.mdx || I.mdy) { cam.look -= I.mdx * 0.004; cam.lookIdle = 0; } else cam.lookIdle += dt;
    if (cam.lookIdle > 1.8) cam.look = CW.damp(cam.look, 0, 3, dt);
    cam.look = CW.clamp(cam.look, -2.8, 2.8);
    cam.carYaw = CW.dampAngle(cam.carYaw, h.h, 2.6, dt);
    const yaw = cam.carYaw + cam.look, dist = 15.5 + spd * 0.11, ch = h.y + 4.6 + spd * 0.03;
    const px = h.x - Math.sin(yaw) * dist, pz = h.z - Math.cos(yaw) * dist, c3 = CW.camera;
    cam.x = CW.damp(cam.x, px, 14, dt); cam.z = CW.damp(cam.z, pz, 14, dt); cam.y = CW.damp(cam.y, Math.max(2.2, ch), 5, dt);
    const r = CW.world.resolve(cam.x, cam.z, 0.6); if (r.hit && cam.y < 42) { cam.x = r.x; cam.z = r.z; }
    c3.position.set(cam.x, cam.y, cam.z);
    c3.lookAt(h.x + Math.sin(yaw) * 5, h.y + 0.6, h.z + Math.cos(yaw) * 5);
    cam.fov = CW.damp(cam.fov, 62 + Math.min(spd, 55) * 0.3, 3, dt); c3.fov = cam.fov; c3.updateProjectionMatrix();
    cam.yaw = yaw + Math.PI; cam.tx = h.x; cam.tz = h.z;
    // exit
    const can = alt < 1.4 && spd < 5;
    P.prompt = can ? 'E  EXIT HELICOPTER' : null;
    if (I.pressed('KeyE') && can) {
      h.occ = false; P.mode = 'foot'; const rx = -c, rz = s; let px2 = h.x + rx * 5, pz2 = h.z + rz * 5; let q = CW.world.resolve(px2, pz2, 0.5);
      if (q.hit) { px2 = h.x - rx * 5; pz2 = h.z - rz * 5; q = CW.world.resolve(px2, pz2, 0.5); }
      e.model.visible = true; e.x = q.x; e.z = q.z; e.y = h.floor > 1 ? h.floor : 0; e.vx = e.vz = 0; e.model.position.set(e.x, e.y, e.z);
      cam.yaw = h.h + Math.PI; cam.cd = undefined; cam.pitch = 0.3; cam.tx = e.x; cam.tz = e.z; cam.ty = 1.55; P.prompt = null;
      if (CW.hud.shown) $('heli').style.display = 'none';
    }
    P.other().model.userData.update(dt, 0);
  };

  function explode(h) {
    h.dead = true; h.mk.root.visible = false; CW.sfx.play('explode', 1);
    for (let i = 0; i < 16; i++) CW.fx.puff(h.x + (Math.random() - 0.5) * 5, h.y + Math.random() * 2, h.z + (Math.random() - 0.5) * 5, { color: i % 2 ? 0xffa020 : 0x333333, size: 2, grow: 3.4, vy: 3 + Math.random() * 3, a: 0.85, life: 1.8 });
    CW.traffic.danger(h.x, h.z, 40, 6);
  }

  // ---- police helicopter -----------------------------------------------------------------------------------------
  function tgtPlayer() {
    const P = CW.player;
    if (P.mode === 'car' && P.car) return { x: P.car.x, z: P.car.z, vx: P.car.vx, vz: P.car.vz };
    if (P.mode === 'heli') return { x: A.heli.x, z: A.heli.z, vx: A.heli.vx, vz: A.heli.vz };
    return { x: P.active.x, z: P.active.z, vx: P.active.vx, vz: P.active.vz };
  }
  function spawnPH(p) {
    const ph = A.policeHeli, a = Math.random() * 6.283;
    ph.active = true; ph.state = 'in'; ph.hp = 400; ph.x = p.x + Math.cos(a) * 320; ph.z = p.z + Math.sin(a) * 320; ph.y = 70; ph.vx = ph.vz = 0; ph.vy = 0; ph.leaveT = 0; ph.ang = a; ph.h = a + Math.PI; ph.spot.x = p.x; ph.spot.z = p.z; ph.sees = false; ph.sw = 0; ph.spin = 0;
    ph.mk.root.visible = true; ph.cone.visible = true; ph.disc.visible = true; ph.mk.root.rotation.set(0, ph.h, 0);
    CW.police.say('AIR-1', 'Air support inbound. Searchlight on the suspect.', 'air', 30);
  }
  function updatePolice(dt) {
    const W = CW.police, ph = A.policeHeli, p = tgtPlayer(); ph.t += dt; ph.cool = Math.max(0, ph.cool - dt); ph.hit = Math.max(0, ph.hit - dt);
    if (!ph.active) { if (W.level >= 4 && ph.cool <= 0 && !W.ended && CW.game.state === 'play') spawnPH(p); else return; }
    const mk = ph.mk;
    if (ph.state === 'down') {
      ph.vy -= 22 * dt; ph.y += ph.vy * dt; ph.spin += dt * 5; ph.x += ph.vx * dt; ph.z += ph.vz * dt; ph.h += ph.spin * dt;
      CW.fx.puff(ph.x, ph.y + 1, ph.z, { color: 0x222222, size: 1.6, grow: 2.4, vy: 1.5, a: 0.8, life: 1.4 });
      if (ph.y <= 0.6) { for (let i = 0; i < 18; i++) CW.fx.puff(ph.x + (Math.random() - 0.5) * 6, 1 + Math.random() * 2, ph.z + (Math.random() - 0.5) * 6, { color: i % 2 ? 0xffa020 : 0x333333, size: 2, grow: 3.6, vy: 2.5 + Math.random() * 3, a: 0.85, life: 1.8 }); CW.weapons.sound('explode', ph.x, ph.z); CW.traffic.danger(ph.x, ph.z, 35, 6); ph.active = false; ph.cool = 45; mk.root.visible = false; ph.cone.visible = false; ph.disc.visible = false; ph.rotorSfx.set(0, 9); }
    } else {
      if (ph.hp <= 0) { ph.state = 'down'; ph.vy = 0; ph.spin = 1.5; W.say('AIR-1', 'Air One is hit — going down! Mayday, mayday!', 'airdown', 4); W.raise(0.8, 'assault', null); }
      if (W.level >= 4) { ph.leaveT = 0; if (ph.state === 'leave') ph.state = 'in'; } else { ph.leaveT += dt; if (ph.leaveT > 10 && ph.state !== 'leave') { ph.state = 'leave'; W.say('AIR-1', 'Suspect lost. Air One returning to base.', 'airleave', 20); } }
      let tx, tz, ty;
      const hd = Math.hypot(ph.x - p.x, ph.z - p.z);
      if (ph.state === 'leave') { const dx = ph.x - p.x, dz = ph.z - p.z, l = Math.hypot(dx, dz) || 1; tx = ph.x + (dx / l) * 300; tz = ph.z + (dz / l) * 300; ty = 95; if (hd > 420) { ph.active = false; ph.cool = 15; mk.root.visible = false; ph.cone.visible = false; ph.disc.visible = false; ph.rotorSfx.set(0, 9); return; } }
      else { ph.ang += dt * 0.26; tx = p.x + Math.cos(ph.ang) * 36 + p.vx * 0.8; tz = p.z + Math.sin(ph.ang) * 36 + p.vz * 0.8; ty = 50 + Math.sin(ph.t * 0.3) * 4; if (hd < 70) ph.state = 'orbit'; }
      const dx = tx - ph.x, dz = tz - ph.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(ph.state === 'leave' ? 50 : 52, d * 0.7 + 4);
      ph.vx = CW.damp(ph.vx, (dx / d) * sp, 1.1, dt); ph.vz = CW.damp(ph.vz, (dz / d) * sp, 1.1, dt);
      ph.x += ph.vx * dt; ph.z += ph.vz * dt; ph.y += (ty - ph.y) * Math.min(1, dt * 0.8);
      const mv = Math.hypot(ph.vx, ph.vz); ph.h = CW.dampAngle(ph.h, mv > 8 ? Math.atan2(ph.vx, ph.vz) : Math.atan2(p.x - ph.x, p.z - ph.z), 1.6, dt);
      // searchlight: lock on when it is on the player, otherwise sweep around the last known position
      const sd = Math.hypot(ph.spot.x - p.x, ph.spot.z - p.z);
      ph.sees = ph.state === 'orbit' && sd < 15 && hd < 140;
      let sx, sz, rate;
      if (ph.sees || (ph.state === 'orbit' && W.seen)) { sx = p.x + p.vx * 0.35; sz = p.z + p.vz * 0.35; rate = 4.5; }
      else { ph.sw += dt * 0.8; const c0 = W.last; sx = c0.x + Math.cos(ph.sw) * 24 + Math.cos(ph.sw * 2.3) * 8; sz = c0.z + Math.sin(ph.sw * 1.1) * 24; rate = 2.2; }
      if (ph.state === 'in' && W.seen) { sx = p.x; sz = p.z; rate = 3; }
      const sdx = sx - ph.spot.x, sdz = sz - ph.spot.z, sl = Math.hypot(sdx, sdz), step = Math.min(sl, (sl * rate * 0.35 + 9) * dt);
      if (sl > 0.01) { ph.spot.x += (sdx / sl) * step; ph.spot.z += (sdz / sl) * step; }
    }
    // visuals
    mk.root.position.set(ph.x, ph.y, ph.z);
    const mv2 = Math.hypot(ph.vx, ph.vz);
    mk.root.rotation.set(ph.state === 'down' ? 0.3 : (mv2 / 52) * 0.22, ph.h, ph.state === 'down' ? ph.spin * 0.2 : 0);
    mk.rotor.rotation.y += dt * 38; mk.blur.material.opacity = 0.16; mk.tail.rotation.x += dt * 55;
    const fl = Math.floor(ph.t * 6) % 2 === 0; mk.red.visible = fl; mk.blue.visible = !fl; mk.nav.forEach((n, i) => { n.visible = i === 2 ? Math.floor(ph.t * 2) % 2 === 0 : true; });
    if (ph.state !== 'down') {
      const night = CW.sky.night, dxs = ph.spot.x - ph.x, dzs = ph.spot.z - ph.z, dys = -ph.y, len = Math.hypot(dxs, dys, dzs);
      ph.cone.position.set(ph.x, ph.y - 1.4, ph.z); ph.cone.lookAt(ph.spot.x, 0, ph.spot.z); ph.cone.scale.set(8.5, 8.5, len);
      ph.cone.material.opacity = 0.1 + 0.08 * night;
      ph.disc.position.set(ph.spot.x, 0.24, ph.spot.z); ph.disc.scale.set(8.5, 1, 8.5); ph.disc.material.opacity = 0.22 + 0.4 * night + (ph.sees ? 0.1 : 0);
    } else { ph.cone.visible = false; ph.disc.visible = false; }
    const f = CW.player.focus(), dist = Math.hypot(ph.x - f.x, ph.z - f.z);
    ph.rotorSfx.init(); ph.rotorSfx.set(ph.active ? Math.pow(Math.max(0, 1 - dist / 260), 1.5) : 0, 11);
  }

  // ---- per-frame visuals ----------------------------------------------------------------------------------------------
  let hc = {};
  A.update = function (dt) {
    const P = CW.player, h = A.heli, W = CW.police;
    if (!h) return;
    if (h.dead && !W.ended && P.mode !== 'heli') A.reset();
    if (!h.occ) {   // parked / idling: rotor winds down, heli settles
      h.rs = Math.max(0, h.rs - dt / 4.5); h.vx *= Math.exp(-2 * dt); h.vz *= Math.exp(-2 * dt);
      if (h.y > h.floor) { h.vy -= 9 * dt; h.y += h.vy * dt; collide(h, dt); if (h.y <= h.floor) { h.y = h.floor; h.vy = 0; } }
    }
    const m = h.mk;
    if (!h.dead) {
      m.root.visible = true; m.root.position.set(h.x, h.y, h.z); m.root.rotation.set(h.pitch, h.h, h.roll);
      m.rotor.rotation.y += dt * 40 * h.rs; m.tail.rotation.x += dt * 60 * h.rs; m.blur.material.opacity = 0.17 * h.rs * h.rs;
      m.nav.forEach((n, i) => { n.visible = i === 2 ? Math.floor(performance.now() / 500) % 2 === 0 : true; });
    }
    // altitude shadow
    const alt = Math.max(0, h.y - h.floor), sc = 3.6 + alt * 0.045;
    shadow.visible = !h.dead; shadow.position.set(h.x, h.floor + 0.2, h.z); shadow.scale.set(sc * 1.15, sc * 1.15, 1); shadow.material.opacity = Math.max(0.08, 0.42 - alt * 0.006);
    // rotor wash
    if (h.rs > 0.5 && alt < 9 && Math.random() < dt * 28) {
      const a = Math.random() * 6.283; CW.fx.puff(h.x + Math.cos(a) * 1.5, h.floor + 0.4, h.z + Math.sin(a) * 1.5, { color: 0xe6d3a8, size: 1.1, grow: 2.4, vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, vy: 0.3, a: 0.4, life: 1.1 });
    }
    // rotor sound (the audio context exists after the first key press)
    h.rotorSfx.init();
    const f = P.focus(), dist = Math.hypot(h.x - f.x, h.z - f.z);
    h.rotorSfx.set((P.mode === 'heli' ? 1 : Math.pow(Math.max(0, 1 - dist / 200), 1.5)) * h.rs, 8 + h.rs * 3);
    updatePolice(dt);
    // heli HUD panel
    const box = $('heli'), on = P.mode === 'heli' && CW.hud.shown;
    if (on !== hc.on) { hc.on = on; box.style.display = on ? 'block' : 'none'; }
    if (on) {
      const a = Math.round(alt), s = Math.round(Math.hypot(h.vx, h.vz) * 3.6), r = Math.round(h.rs * 100), hp = Math.round(Math.max(0, h.hp));
      if (hc.a !== a) { hc.a = a; $('h-alt').textContent = a; } if (hc.s !== s) { hc.s = s; $('h-spd').textContent = s; } if (hc.r !== r) { hc.r = r; $('h-rpm').textContent = r + '%'; }
      if (hc.hp !== hp) { hc.hp = hp; $('h-hp').style.width = hp + '%'; }
      const st = h.rs < 0.85 ? 'SPINNING UP…' : alt < 0.4 ? 'ON THE GROUND — SPACE TO LIFT OFF' : alt < 1.4 && Math.hypot(h.vx, h.vz) < 5 ? 'LANDED — E TO EXIT' : 'AIRBORNE';
      if (hc.t !== st) { hc.t = st; $('h-state').textContent = st; }
    }
  };
})();
