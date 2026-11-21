// Life on the streets: the road graph, lane-following traffic AI, pedestrians on the pavements, car theft / jacking.
(function () {
  const CW = window.CW, C = CW.C, L = C.LINES, N = L.length;
  const rnd = CW.makeRng(777);

  // ---- road graph: 7 x 7 junctions, 4 directions (0:+z 1:+x 2:-z 3:-x) ---------------------------------
  const roads = (CW.roads = { DIRS: [[0, 1], [1, 0], [0, -1], [-1, 0]] });
  const DIRS = roads.DIRS;
  roads.valid = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
  roads.nearest = (x, z) => ({ i: CW.clamp(Math.round((x + 240) / 80), 0, N - 1), j: CW.clamp(Math.round((z + 240) / 80), 0, N - 1) });
  roads.bfs = function (gi, gj) {      // steps from every junction to (gi, gj)
    const d = new Int16Array(N * N).fill(99), q = [[gi, gj]]; d[gi * N + gj] = 0;
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h];
      for (let k = 0; k < 4; k++) {
        const a = i + DIRS[k][0], b = j + DIRS[k][1];
        if (roads.valid(a, b) && d[a * N + b] === 99) { d[a * N + b] = d[i * N + j] + 1; q.push([a, b]); }
      }
    }
    return d;
  };
  const dirHeading = (d) => Math.atan2(DIRS[d][0], DIRS[d][1]);

  const T = (CW.traffic = { cars: [], peds: [], dangers: [], active: false, jacked: 0 });

  // ---- steering / speed controller shared with the police -----------------------------------------------
  // Drives `car` toward (tx, tz) aiming for speed `vt` (m/s); writes car.aiCtl which vehicles.js feeds to the physics.
  T.drive = function (car, tx, tz, vt, dt) {
    const err = CW.angleDiff(car.h, Math.atan2(tx - car.x, tz - car.z));
    let steer = CW.clamp(err * 2.4, -1, 1), throttle = 0;
    const fs = car.fs;
    if (car.rev > 0) { car.rev -= dt; throttle = -1; steer = -steer; vt = 0; }
    else {
      vt *= 1 - 0.55 * Math.min(1, Math.abs(err) / 0.9);
      if (fs > vt + 1.5) throttle = fs > 0.5 ? -1 : 0; else if (fs < vt - 0.5) throttle = 1;
    }
    car.aiCtl = { throttle, steer, brake: false };
    if (vt > 3 && car.speed < 0.9 && car.rev <= 0) { car.stuck = (car.stuck || 0) + dt; if (car.stuck > 2.6) { car.rev = 1.3; car.stuck = 0; } }
    else car.stuck = Math.max(0, (car.stuck || 0) - dt);
  };

  // Gap (metres) to the nearest thing in front of the car: other cars, pedestrians, the on-foot player.
  T.gap = function (car, look, pedsOnly) {
    const s = Math.sin(car.h), c = Math.cos(car.h);
    let best = 99;
    const test = (x, z, half, lat) => {
      const rx = x - car.x, rz = z - car.z, fwd = rx * s + rz * c, side = rx * c - rz * s;
      if (fwd > 0 && fwd < look && Math.abs(side) < lat) best = Math.min(best, fwd - half - car.type.l * 0.5);
    };
    if (!pedsOnly) CW.vehicles.list.forEach((o) => { if (o !== car && !o.hidden && Math.abs(o.x - car.x) < look + 4 && Math.abs(o.z - car.z) < look + 4) test(o.x, o.z, o.type.l * 0.5, 2.1); });
    T.peds.forEach((p) => { if (p.state !== 'dead' && Math.abs(p.x - car.x) < look + 3 && Math.abs(p.z - car.z) < look + 3) test(p.x, p.z, 0.3, 1.7); });
    const P = CW.player; if (P.mode === 'foot') test(P.active.x, P.active.z, 0.3, 1.7);
    return best;
  };

  // ---- lane following ----------------------------------------------------------------------------------
  // car.ai = { i, j: target junction, d: travel direction, off: lane offset, cruise, ax, az: lane anchor }
  function setSegment(a) {
    const D = DIRS[a.d];
    a.ax = L[a.i] - 80 * D[0] + -D[1] * a.off; a.az = L[a.j] - 80 * D[1] + D[0] * a.off;
  }
  T.laneStep = function (car, dt) {
    const a = car.ai; let D = DIRS[a.d];
    const rem = (L[a.i] - car.x) * D[0] + (L[a.j] - car.z) * D[1];
    if (rem < 9 + car.speed * 0.15) {
      const opts = [];
      for (let k = 0; k < 4; k++) if (k !== (a.d + 2) % 4 && roads.valid(a.i + DIRS[k][0], a.j + DIRS[k][1])) { opts.push(k); if (k === a.d) opts.push(k, k); }
      const nd = opts.length ? opts[Math.floor(rnd() * opts.length)] : (a.d + 2) % 4;
      a.d = nd; D = DIRS[nd];
      const ni = a.i + D[0], nj = a.j + D[1];
      if (roads.valid(ni, nj)) { a.pi = a.i; a.pj = a.j; a.i = ni; a.j = nj; }
      setSegment(a);
      // anchor = the junction we just left (so the lane line passes the junction we are crossing)
      a.ax = L[a.pi] + -D[1] * a.off; a.az = L[a.pj] + D[0] * a.off;
    }
    const s = (car.x - a.ax) * D[0] + (car.z - a.az) * D[1];
    const tp = Math.max(s + 8 + car.speed * 0.3, 5);
    const gap = T.gap(car, 6 + car.speed * 1.15);
    let vt = Math.min(a.cruise, Math.sqrt(Math.max(0, gap - 2.2)) * 3.4);
    if (a.hold > 0) { a.hold -= dt; vt = 0; }
    T.drive(car, a.ax + D[0] * tp, a.az + D[1] * tp, vt, dt);
    return vt;
  };

  // put a car that is already on the road back into the lane system (police returning to patrol)
  T.attach = function (car, cruise) {
    const n = roads.nearest(car.x, car.z); let bd = 9, bk = 0;
    for (let k = 0; k < 4; k++) if (roads.valid(n.i + DIRS[k][0], n.j + DIRS[k][1])) { const d = Math.abs(CW.angleDiff(car.h, dirHeading(k))); if (d < bd) { bd = d; bk = k; } }
    const D = DIRS[bk];
    car.ai = { i: n.i + D[0], j: n.j + D[1], pi: n.i, pj: n.j, d: bk, off: C.LANE, cruise: cruise || 11, hold: 0 };
    car.ai.ax = L[n.i] + -D[1] * C.LANE; car.ai.az = L[n.j] + D[0] * C.LANE;
  };

  // place a car on a random road segment between `r0` and `r1` metres from (fx, fz), heading along it
  T.relocate = function (car, fx, fz, r0, r1, lane) {
    for (let n = 0; n < 40; n++) {
      const i = Math.floor(rnd() * N), j = Math.floor(rnd() * N), d = Math.floor(rnd() * 4), D = DIRS[d];
      const ni = i + D[0], nj = j + D[1]; if (!roads.valid(ni, nj)) continue;
      const off = lane === 0 ? 0 : C.LANE, s = 14 + rnd() * 52;
      const x = L[i] + D[0] * s + -D[1] * off, z = L[j] + D[1] * s + D[0] * off;
      const dist = Math.hypot(x - fx, z - fz);
      if (dist < r0 || dist > r1 || Math.abs(x) > 244 || Math.abs(z) > 244) continue;
      if (CW.vehicles.list.some((o) => o !== car && !o.hidden && Math.abs(o.x - x) < 7 && Math.abs(o.z - z) < 7)) continue;
      car.x = x; car.z = z; car.h = dirHeading(d); car.vx = car.vz = 0; car.fs = car.ls = car.speed = 0;
      car.hp = 100; car.awake = true; car.hidden = false; car.rev = 0; car.stuck = 0; car.burnT = 0; car.stolen = false;
      const sp = 8 + rnd() * 6; car.vx = Math.sin(car.h) * sp; car.vz = Math.cos(car.h) * sp;
      car.ai = { i: ni, j: nj, pi: i, pj: j, d, off, cruise: 10 + rnd() * 7, hold: 0 }; setSegment(car.ai);
      car.ai.ax = L[i] + -D[1] * off; car.ai.az = L[j] + D[0] * off;
      return true;
    }
    return false;
  };

  // ---- pedestrians --------------------------------------------------------------------------------------
  const pedValid = (n) => roads.valid(n.i, n.j) && Math.abs(L[n.i] + 10 * n.sx) < 247 && Math.abs(L[n.j] + 10 * n.sz) < 247;
  const pedPos = (n) => ({ x: L[n.i] + 10 * n.sx, z: L[n.j] + 10 * n.sz });
  function pedNeighbors(n) {
    const o = [{ i: n.i, j: n.j, sx: -n.sx, sz: n.sz, cross: 1 }, { i: n.i, j: n.j, sx: n.sx, sz: -n.sz, cross: 1 }];
    o.push({ i: n.i, j: n.j + n.sz, sx: n.sx, sz: -n.sz }); o.push({ i: n.i + n.sx, j: n.j, sx: -n.sx, sz: n.sz });
    return o.filter(pedValid);
  }
  const SHIRTS = [0xff7b54, 0x37c9b8, 0xf2c94c, 0xe0407a, 0x6fa3d8, 0xa5d56a, 0xf5f1e6, 0xc9593f, 0x8f6fd1];
  const PANTS = [0xefe3c8, 0x3b4a6b, 0x6a5a48, 0xd8cfc0, 0x2f3b45, 0x8aa0a8];
  const SKINS = [0xd9a070, 0xb9805a, 0xf0c8a0, 0x8d5a3b, 0xe2b48a];
  const HAIRS = [0x20160f, 0x4a3020, 0x1a1018, 0xb8864a, 0x7a3b22];

  function makePed() {
    const f = rnd() < 0.5;
    const def = { id: 'npc', skin: 0, hair: HAIRS[Math.floor(rnd() * HAIRS.length)], shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)], pants: PANTS[Math.floor(rnd() * PANTS.length)], shoes: 0xf5f1e6, female: f, shades: rnd() < 0.3 };
    def.skin = SKINS[Math.floor(rnd() * SKINS.length)];
    const model = CW.makePerson(def); CW.world.scene.add(model);
    return { model, x: 0, z: 0, h: 0, vx: 0, vz: 0, state: 'walk', n: null, prev: null, tgt: null, speed: 1.4, t: 0, hp: 40, fx: 0, fz: 0, lie: 0, report: 0, def };
  }
  T.placePed = function (p, x, z) { p.x = x; p.z = z; p.model.position.set(x, 0, z); p.model.visible = true; p.model.rotation.set(0, p.h, 0); };
  T.respawnPed = function (p, fx, fz, r0, r1) {
    for (let k = 0; k < 40; k++) {
      const n = { i: Math.floor(rnd() * N), j: Math.floor(rnd() * N), sx: rnd() < 0.5 ? 1 : -1, sz: rnd() < 0.5 ? 1 : -1 };
      if (!pedValid(n)) continue;
      const q = pedPos(n), nb = pedNeighbors(n); if (!nb.length) continue;
      const along = nb[Math.floor(rnd() * nb.length)], tp = pedPos(along), u = 0.1 + rnd() * 0.8;
      const x = q.x + (tp.x - q.x) * u, z = q.z + (tp.z - q.z) * u, d = Math.hypot(x - fx, z - fz);
      if (d < r0 || d > r1) continue;
      p.n = n; p.prev = n; p.tgt = along; p.state = 'walk'; p.t = 0; p.hp = 40; p.lie = 0; p.report = 0; p.speed = 1.2 + rnd() * 0.5;
      p.h = Math.atan2(tp.x - q.x, tp.z - q.z); T.placePed(p, x, z); p.model.rotation.x = 0; p.model.position.y = 0;
      return;
    }
  };
  T.danger = function (x, z, r, t) { T.dangers.push({ x, z, r, t: t || 4 }); };

  function killPed(p, vx, vz) { p.state = 'dead'; p.t = 0; p.vx = vx; p.vz = vz; p.hp = 0; }
  T.hurtPed = function (p, dmg, vx, vz) { if (p.state === 'dead') return false; p.hp -= dmg; if (p.hp <= 0) { killPed(p, vx || 0, vz || 0); return true; } if (p.state !== 'flee') { p.state = 'flee'; p.t = 5; } return false; };

  function startFlee(p, sx, sz, secs) {
    if (p.state === 'dead') return;
    if (p.state !== 'flee') { p.state = 'flee'; p.model.userData.panic = 1; }
    p.t = Math.max(p.t, secs); p.fx = sx; p.fz = sz;
  }

  function nearestPedNode(p) {
    const q = roads.nearest(p.x, p.z); let best = null, bd = 1e9;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const n = { i: q.i, j: q.j, sx, sz }; if (!pedValid(n)) return;
      const c = pedPos(n), d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = n; }
    });
    return best;
  }

  function updatePed(p, dt, F) {
    const u = p.model.userData;
    if (p.state === 'dead') {
      p.t += dt;
      const k = Math.min(1, p.t * 3.5);
      p.vx *= Math.exp(-3 * dt); p.vz *= Math.exp(-3 * dt);
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.model.rotation.x = -1.5 * k; p.model.position.set(p.x, 0.16 * k, p.z);
      u.update(dt, 0);
      return;
    }
    let speed = p.speed;
    if (p.state === 'flee') {
      p.t -= dt;
      const d = Math.hypot(p.fx, p.fz) || 1;
      p.vx = CW.damp(p.vx, (p.fx / d) * 5.8, 10, dt); p.vz = CW.damp(p.vz, (p.fz / d) * 5.8, 10, dt);
      p.x += p.vx * dt; p.z += p.vz * dt;
      speed = Math.hypot(p.vx, p.vz);
      if (speed > 0.5) p.h = CW.dampAngle(p.h, Math.atan2(p.vx, p.vz), 12, dt);
      if (p.t <= 0) { p.n = nearestPedNode(p) || p.n; p.prev = p.n; const nb = pedNeighbors(p.n); p.tgt = nb[Math.floor(rnd() * nb.length)]; p.state = 'walk'; }
    } else if (p.state === 'phone') {
      p.t -= dt; speed = 0; p.vx = p.vz = 0;
      if (p.t <= 0) { p.state = 'walk'; if (CW.police && !p.cancelled) CW.police.report(p.rep); }
    } else {
      const tp = pedPos(p.tgt), dx = tp.x - p.x, dz = tp.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.6) {
        const nb = pedNeighbors(p.tgt).filter((n) => !(n.i === p.prev.i && n.j === p.prev.j && n.sx === p.prev.sx && n.sz === p.prev.sz));
        const wt = nb.map((n) => (n.cross ? 0.7 : 3));
        let sum = 0; wt.forEach((w) => (sum += w)); let r = rnd() * sum, pick = nb[0];
        for (let k = 0; k < nb.length; k++) { r -= wt[k]; if (r <= 0) { pick = nb[k]; break; } }
        p.prev = p.tgt; p.tgt = pick || p.prev;
      } else {
        p.vx = CW.damp(p.vx, (dx / d) * p.speed, 8, dt); p.vz = CW.damp(p.vz, (dz / d) * p.speed, 8, dt);
        p.x += p.vx * dt; p.z += p.vz * dt; p.h = CW.dampAngle(p.h, Math.atan2(dx, dz), 8, dt);
      }
      speed = Math.hypot(p.vx, p.vz);
    }
    if (Math.abs(p.x - F.x) < 90 && Math.abs(p.z - F.z) < 90) { const r = CW.world.resolve(p.x, p.z, 0.35); p.x = r.x; p.z = r.z; }
    p.model.position.set(p.x, 0, p.z); p.model.rotation.set(0, p.h, 0);
    u.update(dt, speed);
    if (p.state === 'phone') { u.armR.sh.rotation.x = -1.7; u.armR.el.rotation.x = -1.6; }
    if (p.state === 'flee') { u.armL.sh.rotation.x = -2.4; u.armR.sh.rotation.x = -2.2; }
  }

  // ---- theft & jacking ---------------------------------------------------------------------------------
  T.spawnDriver = function (car) {
    const P = CW.player; let far = null, bd = -1;
    T.peds.forEach((p) => { if (p.state === 'dead') return; const d = Math.hypot(p.x - car.x, p.z - car.z); if (d > bd) { bd = d; far = p; } });
    if (!far) return;
    const t = car.type, lx = Math.cos(car.h), lz = -Math.sin(car.h);
    far.n = null; far.state = 'flee'; far.t = 7; far.vx = far.vz = 0;
    T.placePed(far, car.x + lx * (t.w / 2 + 0.7), car.z + lz * (t.w / 2 + 0.7)); far.h = car.h;
    far.fx = lx * 2 + (far.x - P.active.x); far.fz = lz * 2 + (far.z - P.active.z);
    far.model.userData.panic = 1; far.cancelled = true;
  };

  T.onEnter = function (car) {
    const e = CW.player.active;
    if (car.owned) { car.stolen = false; return; }
    const jack = !!car.ai;
    const ti = T.cars.indexOf(car);
    if (ti >= 0) {   // the player owns it now: top the traffic back up with a fresh car
      T.cars.splice(ti, 1); car.traffic = false;
      const t = CW.CAR_TYPES.sedan, n = CW.vehicles.add('sedan', t.colors[Math.floor(rnd() * t.colors.length)], 0, 0, 0);
      n.hidden = true; n.traffic = true; T.cars.push(n);
    }
    if (jack) {
      T.spawnDriver(car); T.jacked++; T.danger(car.x, car.z, 24, 5);
      CW.hud.toast('AUTO ROBADO  ' + car.type.name);
      car.rev = 0; car.hold = 0;
      if (CW.police) CW.police.crime('carjack', car.x, car.z, 1.0, 40);
    } else if (!car.stolen) {
      if (CW.police) CW.police.crime('theft', car.x, car.z, 0.8, 28);
    }
    car.stolen = true; car.stolenAt = performance.now();
    void e;
  };

  // ---- spawn / update ----------------------------------------------------------------------------------
  const TYPES = [['sedan', 16], ['hatch', 13], ['suv', 9], ['taxi', 10], ['van', 6], ['sports', 6], ['pickup', 9], ['bike', 5], ['coupe', 9], ['wagon', 8], ['minivan', 7], ['buggy', 5]];
  T.init = function () {
    CW.vehicles.list.slice(0, 3).forEach((c) => (c.owned = true));   // the cars the story hands you
    for (let k = 0; k < 22; k++) {
      let r = rnd() * 100, key = 'sedan';
      for (const [n, w] of TYPES) { r -= w; if (r <= 0) { key = n; break; } }
      const t = CW.CAR_TYPES[key], car = CW.vehicles.add(key, t.colors[Math.floor(rnd() * t.colors.length)], 0, 0, 0);
      car.hidden = true; car.traffic = true; T.cars.push(car);
    }
    for (let k = 0; k < 28; k++) { const p = makePed(); p.model.visible = false; p.state = 'dead'; p.t = 99; T.peds.push(p); }
  };

  T.activate = function (fx, fz) {
    T.active = true;
    T.cars.forEach((c) => { c.hp = 100; T.relocate(c, fx, fz, 30, 150); });
    T.peds.forEach((p) => T.respawnPed(p, fx, fz, 6, 110));
  };

  T.update = function (dt, F) {
    if (!T.active) return;
    const P = CW.player, V = CW.vehicles;
    for (let k = T.dangers.length - 1; k >= 0; k--) { T.dangers[k].t -= dt; if (T.dangers[k].t <= 0) T.dangers.splice(k, 1); }
    // cars
    T.cars.forEach((c) => {
      if (c.driven) return;
      const dist = Math.hypot(c.x - F.x, c.z - F.z);
      if (c.hidden) { c.relT = (c.relT || 0) - dt; if (c.relT <= 0) { c.relT = 0.7; T.relocate(c, F.x, F.z, 100, 170); } return; }
      if (!c.ai) {   // stolen away / wrecked: leave it, recycle when far from the player
        if (dist > 150 && !c.stolen) { c.hidden = true; }
        return;
      }
      if (c.hp <= 0) { c.ai = null; return; }
      T.laneStep(c, dt);
      if (dist > 190 || (c.rev === 0 && c.stuck > 20)) T.relocate(c, F.x, F.z, 110, 170);
    });
    // pedestrians
    T.peds.forEach((p, idx) => {
      if (p.state === 'dead' && p.t > 14) { T.respawnPed(p, F.x, F.z, 60, 115); return; }
      if (p.state !== 'dead') {
        const dist = Math.hypot(p.x - F.x, p.z - F.z);
        if (dist > 135) { T.respawnPed(p, F.x, F.z, 60, 115); return; }
        // danger: fast cars, crime scenes
        for (let i = 0; i < V.list.length; i++) {
          const c = V.list[i]; if (c.hidden || c.speed < 8 || !(c.driven || c.cop || c.speed > 19)) continue;
          const dx = p.x - c.x, dz = p.z - c.z; if (Math.abs(dx) > 15 || Math.abs(dz) > 15) continue;
          const d = Math.hypot(dx, dz); if (d > 15) continue;
          if (d < 5 || (dx * c.vx + dz * c.vz) / (d * c.speed) > 0.2) { const px = -c.vz / c.speed, pz = c.vx / c.speed, side = dx * px + dz * pz >= 0 ? 1 : -1; startFlee(p, px * side * 3 + dx / d, pz * side * 3 + dz / d, 3.5); break; }
        }
        for (let i = 0; i < T.dangers.length; i++) {
          const g = T.dangers[i], dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz);
          if (d < g.r) startFlee(p, dx / (d || 1), dz / (d || 1), 4);
        }
        // run-overs
        for (let i = 0; i < V.list.length; i++) {
          const c = V.list[i]; if (c.hidden || c.speed < 3 || Math.abs(c.x - p.x) > 6 || Math.abs(c.z - p.z) > 6) continue;
          const cs = c.circles();
          if (cs.some(([cx, cz, r]) => Math.hypot(p.x - cx, p.z - cz) < r + 0.35)) {
            const heavy = c.speed > 6;
            T.hurtPed(p, heavy ? 80 : 6, c.vx * 0.55, c.vz * 0.55);
            if (heavy) { T.danger(p.x, p.z, 18, 4); if (CW.police && c.driven) CW.police.crime('runover', p.x, p.z, 1.6, 45); if (c.driven) CW.hud.toast('PEATÓN ATROPELLADO'); }
            break;
          }
        }
      }
      updatePed(p, dt, F);
      void idx;
    });
    // the on-foot player gets hit by cars
    if (P.mode === 'foot') {
      const e = P.active;
      P.hitCd = Math.max(0, (P.hitCd || 0) - dt);
      V.list.forEach((c) => {
        if (c.hidden || c.driven || c.speed < 5 || P.hitCd > 0 || Math.abs(c.x - e.x) > 6 || Math.abs(c.z - e.z) > 6) return;
        if (c.circles().some(([cx, cz, r]) => Math.hypot(e.x - cx, e.z - cz) < r + 0.5)) {
          P.hitCd = 1; e.vx += c.vx * 0.5; e.vz += c.vz * 0.5;
          if (CW.police) CW.police.hurt(c.speed * 2.4, 'Atropellado');
        }
      });
    }
  };
})();
