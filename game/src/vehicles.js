// Cars: arcade physics (grip / drift / handbrake), collisions, damage smoke, parked-car spawning, enter / exit.
(function () {
  const CW = window.CW, C = CW.C;

  // ---- tiny particle pool for smoke / tyre smoke ---------------------------
  const fx = (CW.fx = { pool: [], next: 0 });
  fx.init = function (scene) {
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false; s.userData = { life: 0, max: 1, vy: 0, grow: 1, a: 0.6 };
      scene.add(s); fx.pool.push(s);
    }
  };
  fx.puff = function (x, y, z, o) {
    o = o || {};
    const s = fx.pool[fx.next]; fx.next = (fx.next + 1) % fx.pool.length;
    s.position.set(x, y, z); s.visible = true;
    s.material.color.setHex(o.color || 0xffffff);
    s.userData.life = s.userData.max = o.life || 1.4; s.userData.vy = o.vy || 1.4; s.userData.grow = o.grow || 1.6; s.userData.a = o.a || 0.55;
    s.userData.vx = o.vx || 0; s.userData.vz = o.vz || 0;
    s.scale.setScalar(o.size || 0.8);
  };
  fx.update = function (dt) {
    fx.pool.forEach((s) => {
      const u = s.userData; if (!s.visible) return;
      u.life -= dt; if (u.life <= 0) { s.visible = false; return; }
      const k = u.life / u.max;
      s.position.y += u.vy * dt; s.position.x += (u.vx || 0) * dt; s.position.z += (u.vz || 0) * dt;
      s.scale.addScalar(u.grow * dt);
      s.material.opacity = u.a * k;
    });
  };

  // ---- vehicles ------------------------------------------------------------
  const V = (CW.vehicles = { list: [], driven: null });
  let glowSprites = null;

  class Car {
    constructor(typeId, color, x, z, h) {
      this.type = CW.CAR_TYPES[typeId]; this.color = color;
      this.x = x; this.z = z; this.h = h; this.vx = 0; this.vz = 0;
      this.yaw = 0; this.steer = 0; this.hp = 100; this.driven = false; this.awake = false;
      this.pitch = 0; this.roll = 0; this.fs = 0; this.ls = 0; this.drift = 0; this.speed = 0;
      this.mesh = CW.makeCarMesh(typeId, color);
      this.lights = [];
      const t = this.type;
      [[0.6, 0.75, t.l / 2 + 0.4, 0xfff0c0], [-0.6, 0.75, t.l / 2 + 0.4, 0xfff0c0], [0.6, 0.8, -t.l / 2 - 0.3, 0xff3a2a], [-0.6, 0.8, -t.l / 2 - 0.3, 0xff3a2a]].forEach(([x1, y1, z1, c]) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
        s.position.set(x1 * t.w * 0.8, y1, z1); s.scale.setScalar(c === 0xfff0c0 ? 2.2 : 1.2); s.visible = false; this.mesh.add(s); this.lights.push(s);
      });
      this.mesh.position.set(x, 0, z); this.mesh.rotation.y = h;
      if (CW.brand) CW.brand.livery(this);   // make.fun livery on every VESPER GT
    }
    circles() {
      const t = this.type, s = Math.sin(this.h), c = Math.cos(this.h), r = t.w * 0.5, o = t.l * 0.5 - r;
      return [[this.x + s * o, this.z + c * o, r], [this.x, this.z, r], [this.x - s * o, this.z - c * o, r]];
    }
    get dead() { return this.hp <= 0; }
  }
  V.Car = Car;

  V.add = function (typeId, color, x, z, h) {
    const c = new Car(typeId, color, x, z, h);
    CW.world.scene.add(c.mesh); V.list.push(c); return c;
  };

  V.spawnParked = function () {
    const r = CW.makeRng(4242), slots = CW.world.parkSlots.slice();
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
    const weights = [['sedan', 26], ['hatch', 18], ['suv', 12], ['taxi', 8], ['van', 8], ['sports', 10], ['pickup', 12], ['bike', 8]];
    const pick = () => { let n = r() * 102; for (const [k, w] of weights) { n -= w; if (n <= 0) return k; } return 'sedan'; };
    // the cover car, and a couple of rides near the on-foot spawn
    const hero = V.add('sports', 0xff5a3c, 246.4, 40, Math.PI); V.hero = hero;
    V.add('sports', 0xffc23a, 233.6, 44, 0);
    V.add('hatch', 0x7fc8e8, 233.6, 56, 0);
    V.add('bike', 0xe0407a, 233.6, 34.5, 0.1);
    V.add('pickup', 0xc2523a, 233.6, 68, 0);
    let n = 0;
    for (const s of slots) {
      if (n >= 90) break;
      if (Math.hypot(s.x - 189, s.z) < 34 || Math.hypot(s.x - 246, s.z - 40) < 26 || Math.hypot(s.x - 233, s.z - 48) < 22) continue;
      if (Math.abs(s.x) > 245 || Math.abs(s.z) > 245) continue;
      if (r() > 0.34) continue;
      const k = pick(), t = CW.CAR_TYPES[k], col = t.colors[Math.floor(r() * t.colors.length)];
      V.add(k, col, s.x + (r() - 0.5) * 0.5, s.z + (r() - 0.5) * 0.8, s.h + (r() - 0.5) * 0.05); n++;
    }
  };

  V.nearest = function (x, z, maxd) {
    let best = null, bd = maxd;
    V.list.forEach((c) => {
      if (c.driven || c.hidden || c.cop || c.hp <= 0) return;
      const d = Math.hypot(c.x - x, c.z - z) - c.type.l * 0.25;
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  };

  V.enter = function (car) {
    if (CW.traffic) CW.traffic.onEnter(car);   // jacking / theft bookkeeping, crime witnesses
    V.driven = car; car.driven = true; car.awake = true; car.ai = null; car.aiCtl = null;
  };
  V.exit = function () {
    const car = V.driven; if (!car) return null;
    car.driven = false; V.driven = null;
    const t = car.type, s = Math.sin(car.h), c = Math.cos(car.h);
    const lx = c, lz = -s;   // car-left
    const tries = [[lx, lz, t.w / 2 + 0.9], [-lx, -lz, t.w / 2 + 0.9], [-s, -c, t.l / 2 + 1], [s, c, t.l / 2 + 1]];
    for (const [dx, dz, d] of tries) {
      const px = car.x + dx * d, pz = car.z + dz * d, r = CW.world.resolve(px, pz, 0.45);
      if (!r.hit || r.depth < 0.1) return { x: px, z: pz };
    }
    return { x: car.x + lx * (t.w / 2 + 1.2), z: car.z + lz * (t.w / 2 + 1.2) };
  };

  function damage(car, amt) {
    if (amt <= 0) return;
    car.hp = Math.max(0, car.hp - amt * (car.arm || 1));
    car.hitFlash = 0.2;
  }

  function stepCar(car, dt, ctl) {
    const t = car.type, s = Math.sin(car.h), c = Math.cos(car.h);
    let fs = car.vx * s + car.vz * c, ls = car.vx * -c + car.vz * s;
    const fs0 = fs;
    const alive = car.hp > 0, healthF = 0.65 + 0.35 * (car.hp / 100);
    const eng = car.eng || 1, max = t.max * healthF * eng;
    if (ctl && alive) {
      if (ctl.throttle > 0) { if (fs < -0.5) fs = Math.min(0, fs + 32 * dt); else fs += t.acc * eng * Math.max(0, 1 - fs / max) * dt; }
      else if (ctl.throttle < 0) { if (fs > 0.5) fs = Math.max(0, fs - 34 * dt); else if (fs > -max * 0.3) fs -= t.acc * 0.6 * dt; }
      else { fs *= Math.exp(-0.32 * dt); fs -= Math.sign(fs) * Math.min(Math.abs(fs), 1.4 * dt); }
      if (ctl.brake) fs *= Math.exp(-1.6 * dt);
    } else { fs *= Math.exp(-(car.driven ? 0.8 : 2.6) * dt); fs -= Math.sign(fs) * Math.min(Math.abs(fs), 2.2 * dt); }
    const wet = CW.weather ? CW.weather.grip : 1;
    const grip = ctl && ctl.brake ? 1.5 : t.grip * (ctl ? wet : 1.6);
    const gl = ls; ls *= Math.exp(-grip * dt);
    const steerT = ctl ? ctl.steer : 0;
    car.steer += (steerT - car.steer) * Math.min(1, dt * 8);
    const sf = CW.clamp(Math.abs(fs) / 5, 0, 1) / (1 + Math.abs(fs) / 48);
    car.yaw = car.steer * t.steer * sf * Math.sign(fs || 1) * (ctl && ctl.brake ? 1.55 : 1);
    car.h += car.yaw * dt;
    car.vx = s * fs + -c * ls; car.vz = c * fs + s * ls;
    car.x += car.vx * dt; car.z += car.vz * dt;
    car.fs = fs; car.ls = ls; car.speed = Math.hypot(car.vx, car.vz);
    car.drift = Math.abs(ls) > 3.2 && car.speed > 9 ? Math.min(1, (Math.abs(ls) - 3.2) / 4) : 0;
    car.ax = (fs - fs0) / Math.max(dt, 1e-3);
    if (car.speed > 0.2 || car.ai) car.awake = true; else if (!car.driven) { car.awake = false; car.vx = car.vz = 0; }
  }

  function collideWorld(car) {
    const cs = car.circles();
    let hit = null;
    for (let i = 0; i < 3; i++) {
      const [x, z, r] = cs[i];
      const res = CW.world.resolve(x, z, r);
      if (res.hit) {
        const dx = res.x - x, dz = res.z - z;
        car.x += dx; car.z += dz;
        for (let k = i; k < 3; k++) { cs[k][0] += dx; cs[k][1] += dz; }
        hit = { nx: res.nx, nz: res.nz };
      }
    }
    if (hit) {
      const vn = car.vx * hit.nx + car.vz * hit.nz;
      if (vn < 0) {
        car.vx -= 1.3 * vn * hit.nx; car.vz -= 1.3 * vn * hit.nz;
        const imp = -vn;
        if (imp > 4) { damage(car, (imp - 3.5) * 2.2); car.bump = Math.min(1, imp / 18); }
        car.yaw += CW.clamp((hit.nx * Math.cos(car.h) - hit.nz * Math.sin(car.h)) * imp * 0.02, -0.5, 0.5);
      }
    }
  }

  function collideCars(a, b) {
    const ca = a.circles(), cb = b.circles(), ma = a.type.mass, mb = b.type.mass;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const dx = ca[i][0] - cb[j][0], dz = ca[i][1] - cb[j][1], rr = ca[i][2] + cb[j][2], d = Math.hypot(dx, dz);
      if (d >= rr || d < 1e-5) continue;
      const nx = dx / d, nz = dz / d, pen = rr - d;
      a.x += nx * pen * (mb / (ma + mb)); a.z += nz * pen * (mb / (ma + mb));
      b.x -= nx * pen * (ma / (ma + mb)); b.z -= nz * pen * (ma / (ma + mb));
      const vr = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (vr < 0) {
        const j2 = (-(1 + 0.35) * vr) / (1 / ma + 1 / mb);
        a.vx += (nx * j2) / ma; a.vz += (nz * j2) / ma; b.vx -= (nx * j2) / mb; b.vz -= (nz * j2) / mb;
        if (-vr > 4) { damage(a, (-vr - 3.5) * 1.6 * (mb / ma)); damage(b, (-vr - 3.5) * 1.6 * (ma / mb)); }
        a.awake = b.awake = true;
      }
      return;
    }
  }

  V.update = function (dt, active) {
    const I = CW.input, night = CW.sky.night;
    V.list.forEach((car) => {
      let ctl = null;
      if (car.hidden) { car.mesh.visible = false; return; }
      car.mesh.visible = true;
      if (car.driven && active) {
        ctl = { throttle: I.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']), steer: I.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']), brake: I.isDown('Space') };
      } else if (car.ai && car.hp > 0) ctl = car.aiCtl;
      if (!car.driven && !car.awake) { car.speed = 0; }
      else {
        stepCar(car, dt, ctl);
        collideWorld(car);
      }
      car.bump = (car.bump || 0) * Math.exp(-5 * dt);
    });
    // car-vs-car (only pairs where one is moving)
    const L = V.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.hidden || (!a.awake && !a.driven)) continue;
      for (let j = 0; j < L.length; j++) {
        if (i === j) continue; const b = L[j]; if (b.hidden) continue;
        if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) continue;
        if (j < i && (b.awake || b.driven)) continue;   // handle awake pairs once
        collideCars(a, b);
      }
    }
    // visuals
    L.forEach((car) => {
      if (car.hidden) return;
      const m = car.mesh;
      m.position.x = car.x; m.position.z = car.z;
      m.rotation.y = car.h;
      const pT = CW.clamp(-(car.ax || 0) * 0.0035, -0.06, 0.07), rT = CW.clamp(-car.yaw * car.fs * 0.0045 - car.ls * 0.006, -0.09, 0.09);
      car.pitch += (pT - car.pitch) * Math.min(1, dt * 6); car.roll += (rT - car.roll) * Math.min(1, dt * 6);
      m.rotation.x = car.pitch; m.rotation.z = car.roll;
      m.position.y = (car.liftY || 0) + (car.bump ? Math.sin(performance.now() * 0.05) * 0.03 * car.bump : 0);
      const lit = (car.driven || car.ai) && night > 0.25;
      car.lights.forEach((s) => (s.visible = lit));
      // smoke
      if (car.hp < 55 && Math.random() < dt * (car.hp < 25 ? 22 : 9) && car.mesh.visible) {
        const sn = Math.sin(car.h), cn = Math.cos(car.h);
        fx.puff(car.x + sn * car.type.l * 0.3, 1.1, car.z + cn * car.type.l * 0.3, { color: car.hp < 25 ? 0x222222 : 0x777777, size: 0.7, grow: 1.4, vy: 1.6, a: 0.6, life: 1.6 });
      }
      if (car.drift > 0.2 && Math.random() < dt * 30) {
        const sn = Math.sin(car.h), cn = Math.cos(car.h);
        fx.puff(car.x - sn * car.type.l * 0.35, 0.3, car.z - cn * car.type.l * 0.35, { color: 0xe8e8e8, size: 0.9, grow: 2.2, vy: 0.5, a: 0.45, life: 0.9 });
      }
    });
    fx.update(dt);
  };
})();
