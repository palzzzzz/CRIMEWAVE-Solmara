// Gunner Luna: when Ray drives, Luna rides in the passenger seat. At 2+ stars she leans out of the window and
// auto-fires an SMG (her own Uzi, infinite ammo) at the nearest hostile cop in range. Never fires when the player
// is Luna, on foot, in a bike, or when the line would cross the car's own body; only police take damage.
(function () {
  const CW = window.CW;
  const G = (CW.gunner = { aboard: false, car: null, fireK: 0, lean: 0.3, twist: 0, tgt: null, tgtT: 0, burst: 0, cd: 0, pause: 0, flashT: 0, announced: false });
  const HIP_Y = 0.92;                 // model-space hip height
  const RANGE = 48, DMG = 9, RATE = 0.085, BURST = 5, PAUSE = 0.7, SPREAD = 0.06;
  const qY = new THREE.Quaternion(), qZ = new THREE.Quaternion(), qT = new THREE.Quaternion(), q = new THREE.Quaternion(), qi = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1), DOWN = new THREE.Vector3(0, -1, 0);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), mz = new THREE.Vector3(), eul = new THREE.Euler();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  const rideable = (P) => P.mode === 'car' && P.car && P.car.type.id !== 'bike' && P.active === P.crew.ray && !CW.police.ended;

  // is the segment from (x0,z0) to (x1,z1) blocked by the car's own hull?
  function crossesHull(car, x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz || 1;
    return car.circles().some(([cx, cz, r]) => {
      const t = CW.clamp(((cx - x0) * dx + (cz - z0) * dz) / l2, 0, 1), px = x0 + dx * t - cx, pz = z0 + dz * t - cz;
      return px * px + pz * pz < (r * 0.92) * (r * 0.92);
    });
  }
  const insideHull = (car, x, z) => car.circles().some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r * 0.85);

  function pickTarget(car) {
    const W = CW.police, t = car.type, s = Math.sin(car.h), c = Math.cos(car.h);
    const ox = car.x - c * (t.w / 2 + 0.4), oz = car.z + s * (t.w / 2 + 0.4);   // approx muzzle outside the right window
    let best = null, bd = RANGE;
    const consider = (x, z, y, ref, kind) => {
      const d = Math.hypot(x - car.x, z - car.z); if (d >= bd || d < 2.5) return;
      if (crossesHull(car, ox, oz, x, z) || !W.los(ox, oz, x, z)) return;
      bd = d; best = { x, z, y, ref, kind };
    };
    W.cops.forEach((k) => { if (!k.hidden && k.hp > 0 && k.cs !== 'dead' && k.cs !== 'idle' && k.cs !== 'patrol' && k.cs !== 'leave' && k !== car) consider(k.x, k.z, 0.95, k, 'car'); });
    W.officers.forEach((o) => { if (o.on) consider(o.x, o.z, 1.25, o, 'cop'); });
    return best;
  }

  function drop(luna, ray, car) {
    // back on foot next to Ray (or by the passenger door if that is clear)
    const u = luna.model.userData;
    u.legL.visible = u.legR.visible = true;
    u.setPose('none'); luna.model.quaternion.identity(); luna.model.rotation.set(0, ray.h, 0);
    if (u.guns && u.guns.smg) { u.guns.smg.visible = false; if (u.guns.smg.userData.flash) u.guns.smg.userData.flash.visible = false; }
    let x = ray.x + 1.4, z = ray.z + 1.4;
    if (car) {
      const t = car.type, d = t.w / 2 + 0.9, px = car.x - Math.cos(car.h) * d, pz = car.z + Math.sin(car.h) * d, r = CW.world.resolve(px, pz, 0.45);
      if ((!r.hit || r.depth < 0.1) && Math.hypot(px - ray.x, pz - ray.z) < 12) { x = px; z = pz; }
    }
    const r2 = CW.world.resolve(x, z, 0.45);
    luna.x = r2.x; luna.z = r2.z; luna.h = ray.h; luna.vx = luna.vz = 0; luna.y = 0; luna.vy = 0;
    luna.model.position.set(luna.x, 0, luna.z); luna.model.visible = true;
  }

  G.update = function (dt) {
    const P = CW.player, luna = P.crew.luna, ray = P.crew.ray, W = CW.police;
    const on = rideable(P);
    if (!on) {
      if (G.aboard) { drop(luna, ray, G.car); G.aboard = false; G.car = null; G.fireK = 0; G.lean = 0.3; G.twist = 0; G.tgt = null; G.burst = 0; G.announced = false; }
      return;
    }
    const car = P.car, t = car.type, u = luna.model.userData;
    if (!G.aboard) { G.aboard = true; G.fireK = 0; G.lean = 0.3; G.twist = 0; u.setPose('none'); luna.model.visible = true; CW.hud.toast('LUNA RIDES SHOTGUN'); }
    G.car = car;
    const hot = W.level >= 2 && !W.ended;
    G.tgtT -= dt; if (G.tgtT <= 0) { G.tgtT = 0.2; G.tgt = hot ? pickTarget(car) : null; }
    // a cop that died / vanished since the last scan
    if (G.tgt && ((G.tgt.kind === 'car' && (G.tgt.ref.hidden || G.tgt.ref.hp <= 0)) || (G.tgt.kind === 'cop' && !G.tgt.ref.on))) G.tgt = null;
    if (G.tgt) { G.tgt.x = G.tgt.ref.x; G.tgt.z = G.tgt.ref.z; }
    const want = hot && G.tgt ? 1 : 0;
    G.fireK = CW.damp(G.fireK, want, want ? 9 : 5, dt);
    G.lean = CW.damp(G.lean, 0.3 + 0.35 * G.fireK, 8, dt);   // ~0.65 rad firing: upright enough not to read as lying on the roof
    const s = Math.sin(car.h), c = Math.cos(car.h), fk = G.fireK;
    // seat: right of centre, slightly ahead of the cabin middle; hips drop when idle so only shoulders show.
    // Firing: she hoists herself onto the door sill (hips out toward the window, lifted well above the beltline)
    // so the shoulders clear the roofline of even the low sports car.
    const bodyTop = 0.3 + t.bh, seatX = t.w * (0.27 + 0.12 * fk), seatZ = t.cz + t.cl * 0.18;
    const hipFire = 0.98 + (bodyTop - 0.72) * 0.6;   // sports 0.98, sedan ~1.10
    const hipY = bodyTop - 0.3 + (hipFire - (bodyTop - 0.3)) * fk;
    let twistT = 0;
    if (G.tgt) twistT = CW.clamp(wrap(Math.atan2(G.tgt.x - car.x, G.tgt.z - car.z) - car.h), -2.6, 2.6);
    G.twist += wrap(twistT * fk - G.twist) * Math.min(1, dt * 9);
    qY.setFromAxisAngle(UP, car.h); qZ.setFromAxisAngle(FWD, G.lean); qT.setFromAxisAngle(UP, G.twist);
    q.copy(qY).multiply(qZ).multiply(qT);
    const m = luna.model;
    m.quaternion.copy(q);
    v.set(0, HIP_Y, 0).applyQuaternion(q);
    m.position.set(car.x - c * seatX + s * seatZ - v.x, hipY - v.y, car.z + s * seatX + c * seatZ - v.z);
    m.visible = true; luna.x = car.x; luna.z = car.z; luna.h = car.h;
    // limbs: seated legs, arms blend from lap to aimed two-handed SMG
    // (legs angle down into the footwell as she rises so they do not poke through the cabin roof)
    const legRot = -1.35 + 0.35 * fk;
    u.legL.rotation.set(legRot, 0, 0); u.legR.rotation.set(legRot, 0, 0);
    // The body is tilted out of the window, so her legs would swing out through the door panel. The car body is solid
    // (no interior), so once she is up and firing the legs are simply hidden; they were never visible seated anyway.
    u.legL.visible = u.legR.visible = fk < 0.2;
    u.body.rotation.set(0, 0, 0); u.body.position.set(0, 0, 0);
    const gun = u.guns && u.guns.smg;
    ['smg', 'pistol', 'shotgun', 'molotov', 'knife'].forEach((k) => { if (u.guns && u.guns[k]) u.guns[k].visible = false; });
    m.updateMatrixWorld(true);
    let aimD = null;
    if (G.tgt) {
      u.armR.sh.getWorldPosition(v);
      v2.set(G.tgt.x - v.x, G.tgt.y - v.y, G.tgt.z - v.z).normalize();
      qi.copy(q).invert(); aimD = v2.clone().applyQuaternion(qi);
    }
    const armPose = (A, sx, idleZ) => {
      const idle = new THREE.Quaternion().setFromEuler(eul.set(-0.75, 0, idleZ));
      if (aimD) {
        const d = aimD.clone(); d.x += sx * -0.3; d.normalize();
        const aim = new THREE.Quaternion().setFromUnitVectors(DOWN, d);
        A.sh.quaternion.copy(idle).slerp(aim, fk);
      } else A.sh.quaternion.copy(idle);
      A.el.rotation.set(-1.9 + 1.8 * fk, 0, 0);
    };
    armPose(u.armR, -1, 0.55); armPose(u.armL, 1, -0.55);
    u.head.rotation.set(0.03, 0.15 * (1 - fk), 0.04);
    if (gun) gun.visible = fk > 0.15;
    // fire
    G.flashT -= dt;
    const fl = gun && gun.userData.flash;
    if (fl && G.flashT <= 0) fl.visible = false;
    G.cd -= dt; G.pause -= dt;
    if (hot && G.tgt && fk > 0.85 && gun && G.cd <= 0 && G.pause <= 0) {
      m.updateMatrixWorld(true);
      (fl || gun).getWorldPosition(mz);
      const tx = G.tgt.x, ty = G.tgt.y, tz = G.tgt.z;
      if (!insideHull(car, mz.x, mz.z) && !crossesHull(car, mz.x, mz.z, tx, tz)) {
        fire(car, mz, tx, ty, tz, fl);
        G.cd = RATE; if (++G.burst >= BURST) { G.burst = 0; G.pause = PAUSE + Math.random() * 0.35; }
      } else G.cd = 0.15;
    }
  };

  function fire(car, o, tx, ty, tz, fl) {
    const Wp = CW.weapons;
    let dx = tx - o.x, dy = ty - o.y, dz = tz - o.z; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    dx += (Math.random() - 0.5) * 2 * SPREAD; dy += (Math.random() - 0.5) * 2 * SPREAD * 0.6; dz += (Math.random() - 0.5) * 2 * SPREAD;
    const rl = Math.hypot(dx, dy, dz); dx /= rl; dy /= rl; dz /= rl;
    const r = Wp.cast(o.x, o.y, o.z, dx, dy, dz, RANGE + 8), h = r.hit;
    // only police take damage: no friendly fire on civilians / gang / own car, nothing passes through walls
    if (h && (h.k === 'cop' || (h.k === 'car' && h.ref.cop && h.ref !== car))) Wp.dealDamage(h, DMG, dx, dz, false);
    Wp.tracer(o.x, o.y, o.z, r.x, r.y, r.z, 0xffe9a0, 0.09, 2.2);
    if (fl) { fl.visible = true; fl.rotation.z = Math.random() * 3; fl.scale.setScalar(2.1 + Math.random() * 0.8); G.flashT = 0.07; }
    CW.sfx.play('smg', 0.4);
    CW.fx.puff(o.x + dx * 0.3, o.y, o.z + dz * 0.3, { color: 0xcccccc, size: 0.3, grow: 0.9, vy: 0.4, a: 0.35, life: 0.45 });
  }

  G.reset = function () { G.aboard = false; G.car = null; G.fireK = 0; G.tgt = null; G.burst = 0; };
})();
