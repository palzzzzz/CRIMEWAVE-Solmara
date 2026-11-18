// Solmara: the whole city built from primitives. Beachfront (east), Downtown (centre/west), Harbour (south).
// Static geometry is merged per block (windows / solid / foliage) so culling still works and draw calls stay low.
(function () {
  const CW = window.CW, C = CW.C, R = CW.rng;
  const world = (CW.world = { scene: null, footprints: [], lampGlow: [], billboards: [], signs: [], landmarks: {}, parkSlots: [], blocks: [], titleSet: null });

  // ---- spatial hash of obstacles ------------------------------------------
  const CELL = 16;
  const cells = new Map();
  let stamp = 0;
  const ck = (i, j) => (i + 512) * 1024 + (j + 512);
  function insert(o, x0, z0, x1, z1) {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
        const k = ck(i, j); let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(o);
      }
  }
  world.addBox = (x0, x1, z0, z1, h) => insert({ t: 0, x0, x1, z0, z1, h: h || 10, q: 0 }, x0, z0, x1, z1);
  world.addCircle = (x, z, r, h) => insert({ t: 1, x, z, r, h: h || 8, q: 0 }, x - r, z - r, x + r, z + r);
  world.forNear = function (x, z, r, fn) {
    stamp++;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++)
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const a = cells.get(ck(i, j)); if (!a) continue;
        for (let n = 0; n < a.length; n++) { const o = a[n]; if (o.q !== stamp) { o.q = stamp; fn(o); } }
      }
  };

  // Push a circle out of static obstacles and the world edge. Returns {x,z,hit,nx,nz,depth}.
  const out = { x: 0, z: 0, hit: false, nx: 0, nz: 0, depth: 0 };
  world.resolve = function (x, z, r) {
    out.hit = false; out.nx = 0; out.nz = 0; out.depth = 0;
    const b = C.BOUNDS;
    if (x < b.x0 + r) { out.hit = true; out.nx = 1; out.depth = b.x0 + r - x; x = b.x0 + r; }
    if (x > b.x1 - r) { out.hit = true; out.nx = -1; out.depth = x - (b.x1 - r); x = b.x1 - r; }
    if (z < b.z0 + r) { out.hit = true; out.nz = 1; out.depth = b.z0 + r - z; z = b.z0 + r; }
    if (z > b.z1 - r) { out.hit = true; out.nz = -1; out.depth = z - (b.z1 - r); z = b.z1 - r; }
    world.forNear(x, z, r + 1, (o) => {
      let dx, dz, d, pen;
      if (o.t === 0) {
        const cx = CW.clamp(x, o.x0, o.x1), cz = CW.clamp(z, o.z0, o.z1);
        dx = x - cx; dz = z - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        if (d2 > 1e-9) { d = Math.sqrt(d2); pen = r - d; dx /= d; dz /= d; }
        else {
          const l = x - o.x0, rr = o.x1 - x, t = z - o.z0, bt = o.z1 - z, m = Math.min(l, rr, t, bt);
          dx = dz = 0; if (m === l) dx = -1; else if (m === rr) dx = 1; else if (m === t) dz = -1; else dz = 1; pen = m + r;
        }
      } else {
        dx = x - o.x; dz = z - o.z; d = Math.hypot(dx, dz); const rr = r + o.r;
        if (d >= rr) return;
        pen = rr - d; if (d > 1e-6) { dx /= d; dz /= d; } else { dx = 1; dz = 0; }
      }
      x += dx * pen; z += dz * pen;
      if (pen > out.depth || !out.hit) { out.nx = dx; out.nz = dz; out.depth = pen; }
      out.hit = true;
    });
    out.x = x; out.z = z;
    return out;
  };

  // ---- helpers -------------------------------------------------------------
  const snap = (v, s) => Math.max(s, Math.floor(v / s) * s);
  const FL = CW.WIN.FLOOR;

  function makeBatches() { return { win: new CW.Batch(), sol: new CW.Batch(), fol: new CW.Batch(), lamp: new CW.Batch() }; }
  function flush(bt, scene, cast) {
    const parts = [bt.win.build(CW.mats.win, true, true), bt.sol.build(CW.mats.solid, true, true), bt.fol.build(CW.mats.foliage, true, false), bt.lamp.build(CW.mats.lamp, false, false)];
    parts.forEach((m) => { if (m) scene.add(m); });
  }

  function plate(text, w, h, style, x, y, z, ry, basic) {
    const tex = CW.makeSignTexture(text, 512, Math.round(512 * h / w), style);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
    m.position.set(x, y, z); m.rotation.y = ry || 0;
    world.scene.add(m);
    if (!basic) world.billboards.push(m);
    return m;
  }
  world.plate = plate;

  const AD = [
    ['SOLMARA\nTOURISM', { bg: '#0e7c86', fg: '#ffe9a8', stripe: '#ff7a59' }],
    ['FIZZ COLA\nICE COLD', { bg: '#d6283e', fg: '#ffffff', stripe: '#ffd23f' }],
    ['LUNA SUN\nSPF 50', { bg: '#ffb24a', fg: '#2a1a3a', stripe: '#e8456f' }],
    ['HARBOUR\nBREWERY', { bg: '#1c3b5a', fg: '#ffd27a', stripe: '#3fc1c9' }],
    ['PALMA\nHOTELS', { bg: '#f4ece0', fg: '#d6456f', stripe: '#3fc1c9' }],
    ['NEON DREAMS\nNIGHTCLUB', { bg: '#1a1033', fg: '#ff4fd8', edge: '#3ff0ff', glow: true }],
    ['TURBO TACOS', { bg: '#4aa52e', fg: '#fff3b0', stripe: '#d6283e' }],
    ['SOL FM 99.1\nTHE COAST', { bg: '#2a1a5a', fg: '#7ef0ff', edge: '#ff7ad9', glow: true }],
  ];
  function billboard(x, y, z, ry, idx, w, h) {
    const a = AD[idx % AD.length];
    w = w || 14; h = h || 6.5;
    plate(a[0], w, h, a[1], x, y + h / 2 + 1.6, z, ry);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x3a444a }));
    const bx = Math.sin(ry || 0) * -0.25, bz = Math.cos(ry || 0) * -0.25;
    back.position.set(x + bx, y + h / 2 + 1.6, z + bz); back.rotation.y = ry || 0; back.castShadow = true;
    world.scene.add(back);
    const px = Math.cos(ry || 0) * (w * 0.33), pz = -Math.sin(ry || 0) * (w * 0.33);
    [1, -1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, y + 1.6, 0.35), new THREE.MeshLambertMaterial({ color: 0x4a555c })); p.position.set(x + px * s + bx, (y + 1.6) / 2, z + pz * s + bz); p.castShadow = true; world.scene.add(p); });
  }

  // ---- buildings -----------------------------------------------------------
  function rooftop(bt, x, z, w, d, h) {
    const n = R.int(1, 3);
    for (let i = 0; i < n; i++) {
      const ax = x + R.range(-w * 0.3, w * 0.3), az = z + R.range(-d * 0.3, d * 0.3);
      bt.sol.box(ax, h + 0.3 + 0.7, az, R.range(1.5, 3), 1.4, R.range(1.5, 3), 0x9aa3a6);
    }
    if (R.chance(0.35)) { const tx = x + R.range(-w * 0.25, w * 0.25), tz = z + R.range(-d * 0.25, d * 0.25); bt.sol.cyl(tx, h + 0.3 + 1.6, tz, 1.3, 1.3, 3.2, 8, 0x8b6f5a); bt.sol.cone(tx, h + 0.3 + 3.6, tz, 1.5, 0.9, 8, 0x6e5848); }
    if (R.chance(0.3) && h > 20) { bt.sol.cyl(x, h + 0.3 + 4, z, 0.1, 0.1, 8, 4, 0xbfc5c8); bt.lamp.box(x, h + 0.3 + 8, z, 0.4, 0.4, 0.4, 0xff3b30); world.lampGlow.push(x, h + 8.5, z); }
  }
  function awnings(bt, x, z, w, d, ca, cb) {
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([sx, sz]) => {
      if (!R.chance(0.7)) return;
      const len = (sx ? d : w) - 3; const n = Math.max(1, Math.floor(len / 1.6));
      for (let i = 0; i < n; i++) {
        const o = -len / 2 + (i + 0.5) * (len / n);
        const px = x + sx * (w / 2 + 0.8) + (sz ? o : 0), pz = z + sz * (d / 2 + 0.8) + (sx ? o : 0);
        bt.sol.box(px, 3.2, pz, sx ? 1.7 : len / n, 0.14, sz ? 1.7 : len / n, i % 2 ? ca : cb);
      }
    });
  }
  function addBuilding(bt, x, z, w, d, h, color, o) {
    o = o || {};
    bt.win.box(x, h / 2, z, w, h, d, color, 0, { win: true, u0: R.int(0, 3) * 0.25 });
    bt.sol.box(x, h + 0.15, z, w + 0.5, 0.3, d + 0.5, o.ledge || 0xf3ece0);
    world.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h + 0.3);
    world.footprints.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    if (!o.noRoof) rooftop(bt, x, z, w, d, h);
  }

  function lots(cx, cz, nx, nz) {
    const half = 29, gap = 2, res = [];
    const w = (2 * half - gap * (nx - 1)) / nx, d = (2 * half - gap * (nz - 1)) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
      res.push({ x: cx - half + w / 2 + i * (w + gap), z: cz - half + d / 2 + j * (d + gap), w, d });
    return res;
  }

  function palmRow(bt, x0, z0, x1, z1, step, scale, skipChance) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / step));
    for (let i = 0; i <= n; i++) {
      if (R.chance(skipChance || 0)) continue;
      const t = i / n, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      CW.addPalm(bt.sol, bt.fol, px, pz, scale * R.range(0.85, 1.2), R);
      world.addCircle(px, pz, 0.45, 8);
    }
  }

  function bench(bt, x, z, ry) {
    bt.sol.box(x, 0.5, z, 1.8, 0.1, 0.5, 0x9b6b43, ry); bt.sol.box(x, 0.8, z + (ry ? 0 : -0.22), ry ? 0.1 : 1.8, 0.4, ry ? 0.5 : 0.08, 0x9b6b43, 0);
    bt.sol.box(x - 0.7, 0.25, z, 0.1, 0.5, 0.45, 0x3a3f44); bt.sol.box(x + 0.7, 0.25, z, 0.1, 0.5, 0.45, 0x3a3f44);
  }

  function blockBeach(bt, cx, cz) {
    const nx = R.pick([1, 2, 2]), nz = R.pick([1, 2]);
    lots(cx, cz, nx, nz).forEach((l, i) => {
      const w = snap(l.w - 3, 4), d = snap(l.d - 3, 4);
      const fl = R.int(2, 5), h = fl * FL, col = R.pick(CW.palette.beach);
      addBuilding(bt, l.x, l.z, w, d, h, col, { ledge: 0xffffff });
      awnings(bt, l.x, l.z, w, d, R.pick([0xff6f61, 0x3fc1c9, 0xffc857]), 0xfaf3e3);
      if (R.chance(0.5)) { bt.sol.flat(l.x + w * 0.18, h + 0.32, l.z, w * 0.35, d * 0.5, 0x37d6d9); bt.sol.box(l.x - w * 0.25, h + 0.6, l.z, 0.15, 0.7, 0.15, 0xf2f0e6); bt.sol.cone(l.x - w * 0.25, h + 1.3, l.z, 1.4, 0.6, 8, R.pick([0xff6f61, 0xffc857])); }
      if (R.chance(0.45) && fl > 2) { const w2 = w * 0.62, d2 = d * 0.62; bt.win.box(l.x, h + (FL * 1.5) / 2 + 0.3, l.z, snap(w2, 4), FL * 1.5, snap(d2, 4), R.pick(CW.palette.beach), 0, { win: true }); world.footprints.push({ x0: l.x - w2 / 2, x1: l.x + w2 / 2, z0: l.z - d2 / 2, z1: l.z + d2 / 2 }); }
    });
    const o = 33;   // palm rows just inside the kerb
    palmRow(bt, cx - o + 1.5, cz - o + 1.2, cx + o - 1.5, cz - o + 1.2, 11, 1.0, 0.15);
    palmRow(bt, cx - o + 1.5, cz + o - 1.2, cx + o - 1.5, cz + o - 1.2, 11, 1.0, 0.15);
  }

  function blockDowntown(bt, cx, cz) {
    const dist = Math.hypot(cx, cz), core = dist < 125;
    const nx = core ? R.pick([1, 2]) : R.pick([2, 2, 3]), nz = core ? R.pick([1, 2]) : R.pick([2, 2]);
    lots(cx, cz, nx, nz).forEach((l) => {
      const w = snap(l.w - 2, 4), d = snap(l.d - 2, 4);
      const tall = core && R.chance(0.85);
      const fl = tall ? R.int(10, 24) : R.int(3, 8);
      const glass = tall && R.chance(0.5);
      const col = glass ? R.pick(CW.palette.glass) : R.pick(CW.palette.downtown);
      addBuilding(bt, l.x, l.z, w, d, fl * FL, col, { ledge: glass ? 0xd9e6ea : 0xf3ece0, noRoof: false });
      if (tall && w >= 16 && d >= 16 && R.chance(0.6)) {
        const w2 = snap(w * 0.6, 4), d2 = snap(d * 0.6, 4), f2 = R.int(3, 7);
        bt.win.box(l.x, fl * FL + 0.3 + (f2 * FL) / 2, l.z, w2, f2 * FL, d2, col, 0, { win: true });
        bt.sol.box(l.x, fl * FL + 0.3 + f2 * FL + 0.15, l.z, w2 + 0.4, 0.3, d2 + 0.4, 0xf3ece0);
        bt.sol.cyl(l.x, fl * FL + 0.3 + f2 * FL + 5, l.z, 0.12, 0.12, 10, 4, 0xbfc5c8);
        bt.lamp.box(l.x, fl * FL + 0.3 + f2 * FL + 10.2, l.z, 0.5, 0.5, 0.5, 0xff3b30);
        world.lampGlow.push(l.x, fl * FL + f2 * FL + 10.5, l.z);
      }
      if (!tall) awnings(bt, l.x, l.z, w, d, R.pick([0x2f9aa6, 0xe8566b, 0xf2b441]), 0xfaf3e3);
      if (fl >= 6 && R.chance(0.3)) billboard(l.x, fl * FL + 0.3, l.z, R.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), R.int(0, 7), Math.min(w - 2, 14), 6);
    });
    if (R.chance(0.5)) palmRow(bt, cx - 30, cz - 31.5, cx + 30, cz - 31.5, 14, 0.9, 0.3);
  }

  function blockPark(bt, cx, cz) {
    bt.sol.flat(cx, C.CURB + 0.05, cz, 58, 58, 0x7fc66a);
    bt.sol.flat(cx, C.CURB + 0.07, cz, 3.2, 58, 0xe8dcc0); bt.sol.flat(cx, C.CURB + 0.07, cz, 58, 3.2, 0xe8dcc0);
    bt.sol.cyl(cx, 0.5, cz, 6.5, 6.5, 0.7, 14, 0xd9d0bd); bt.sol.cyl(cx, 0.82, cz, 5.4, 5.4, 0.2, 14, 0x3fd0d8);
    bt.sol.cyl(cx, 1.8, cz, 0.5, 0.7, 2.2, 8, 0xe9e1cf); bt.sol.cyl(cx, 3.1, cz, 1.6, 0.4, 0.6, 10, 0xe9e1cf);
    world.addCircle(cx, cz, 6.6, 3);
    for (let i = 0; i < 26; i++) {
      const px = cx + R.range(-27, 27), pz = cz + R.range(-27, 27);
      if (Math.abs(px - cx) < 3 || Math.abs(pz - cz) < 3 || Math.hypot(px - cx, pz - cz) < 9) continue;
      if (R.chance(0.6)) { CW.addPalm(bt.sol, bt.fol, px, pz, R.range(0.9, 1.3), R); world.addCircle(px, pz, 0.45, 8); }
      else { bt.sol.cyl(px, 1.2, pz, 0.2, 0.28, 2.4, 6, 0x7a5a3a); bt.fol.geo(new THREE.IcosahedronGeometry(2.1, 0), px, 3.6, pz, R.pick([0x4aa84e, 0x5cbc5a, 0x3b9a56])); world.addCircle(px, pz, 0.5, 8); }
    }
    [[-9, 0], [9, 0], [0, 9], [0, -9]].forEach(([dx, dz], i) => bench(bt, cx + dx, cz + dz, i < 2 ? 0 : 0));
    const f = { x0: cx - 29, x1: cx + 29, z0: cz - 29, z1: cz + 29, park: true }; world.footprints.push(f);
  }

  function yardLines(bt, x0, z0, w, d, along) {
    bt.sol.flat(x0 + w / 2, C.CURB + 0.05, z0 + d / 2, w, d, 0x6c7378);
    const n = Math.floor((along ? w : d) / 3.2);
    for (let i = 1; i < n; i++) { const o = i * 3.2; if (along) bt.sol.flat(x0 + o, C.CURB + 0.07, z0 + d / 2, 0.14, d * 0.7, 0xf2f0e6); else bt.sol.flat(x0 + w / 2, C.CURB + 0.07, z0 + o, w * 0.7, 0.14, 0xf2f0e6); }
  }

  // landmark blocks: entrance yard faces the road on the side named by 'face' (z-) and the building sits at the back
  function blockLandmark(bt, cx, cz, kind) {
    const sc = kind === 'garage' ? { w: 36, d: 22, fl: 2, col: 0xf1e4c3, name: "ROXY'S\nREPAINT", st: { bg: '#d6283e', fg: '#fff3d0', stripe: '#ffd23f' } }
      : kind === 'police' ? { w: 36, d: 24, fl: 4, col: 0xdfe8f2, name: 'SOLMARA\nPOLICE', st: { bg: '#1f3f8f', fg: '#ffffff', stripe: '#e8456f' } }
        : kind === 'hospital' ? { w: 40, d: 28, fl: 5, col: 0xf5f7f7, name: 'SOLMARA\nGENERAL', st: { bg: '#f5f7f7', fg: '#d6283e', stripe: '#3fc1c9' } }
          : { w: 40, d: 26, fl: 2, col: 0xb9a88a, name: 'HARBOUR\nFENCE & SALVAGE', st: { bg: '#1c2f3a', fg: '#ffcf5a', stripe: '#ff6a4a' } };
    const bz = cz + 29 - sc.d / 2 - 1;      // back of the block
    addBuilding(bt, cx, bz, sc.w, sc.d, sc.fl * FL, sc.col, { noRoof: false });
    yardLines(bt, cx - 28, cz - 28.5, 56, 17, true);
    plate(sc.name, 14, 5, sc.st, cx, sc.fl * FL * 0.62 + 2.2, bz - sc.d / 2 - 0.1, Math.PI);
    bt.lamp.box(cx, sc.fl * FL * 0.62 + 5.2, bz - sc.d / 2 - 0.05, 14.4, 0.3, 0.1, 0xffe08a);
    if (kind === 'hospital') { bt.sol.box(cx + 14, 3, cz - 12, 0.4, 6, 0.4, 0xd6283e); bt.sol.box(cx + 14, 6.5, cz - 12, 4.2, 1.2, 0.3, 0xd6283e); bt.sol.box(cx + 14, 6.5, cz - 12, 1.2, 4.2, 0.3, 0xd6283e); bt.sol.flat(cx - 16, C.CURB + 0.05, cz - 20, 9, 9, 0xd6283e); }
    if (kind === 'police') { bt.sol.cyl(cx + 16, 5, cz - 8, 0.1, 0.1, 10, 4, 0xbfc5c8); bt.sol.box(cx + 17.3, 9, cz - 8, 2.4, 1.4, 0.1, 0x2f7fd6); }
    if (kind === 'garage') { bt.sol.box(cx, 2.1, bz - sc.d / 2 - 0.12, 9, 4.2, 0.25, 0x6a757c); for (let i = 0; i < 4; i++) bt.sol.box(cx, 0.8 + i, bz - sc.d / 2 - 0.27, 8.6, 0.12, 0.1, 0x8c979e); }
    if (kind === 'fence') { for (let i = 0; i < 5; i++) { const px = cx - 24 + i * 12; bt.sol.box(px, 1.3, cz - 11, 4.6, 2.6, 2.4, R.pick(CW.palette.container)); world.addBox(px - 2.3, px + 2.3, cz - 12.2, cz - 9.8, 2.6); } }
    const e = { x: cx, z: cz - 29 + 1.8 };
    world.landmarks[kind] = { x: e.x, z: e.z, bx: cx, bz, w: sc.w, d: sc.d };
  }

  function container(bt, x, z, along, h) {
    const l = 12, w = 2.5;
    for (let k = 0; k < h; k++) {
      const c = R.pick(CW.palette.container);
      bt.sol.box(x, 1.3 + k * 2.6, z, along ? l : w, 2.6, along ? w : l, c);
      const rx = along ? l : w, rz = along ? w : l;
      for (let r = -2; r <= 2; r++) bt.sol.box(x + (along ? r * 2.2 : 0), 1.3 + k * 2.6, z + (along ? 0 : r * 2.2), along ? 0.1 : w + 0.12, 2.5, along ? w + 0.12 : 0.1, (c >> 1) & 0x7f7f7f, 0);
    }
    world.addBox(x - (along ? l : w) / 2, x + (along ? l : w) / 2, z - (along ? w : l) / 2, z + (along ? w : l) / 2, h * 2.6);
  }

  function blockHarbour(bt, cx, cz, variant) {
    bt.sol.flat(cx, C.CURB + 0.02, cz, 58, 58, 0x9a9f9f);
    if (variant === 0) {      // warehouses
      [[-14, -15], [14, -15], [-14, 15], [14, 15]].forEach(([dx, dz], i) => {
        if (i > 1 && R.chance(0.4)) { container(bt, cx + dx - 5, cz + dz, true, R.int(1, 3)); container(bt, cx + dx + 8, cz + dz, true, R.int(1, 3)); return; }
        addBuilding(bt, cx + dx, cz + dz, 24, 24, R.int(2, 3) * FL * 1.4, R.pick(CW.palette.harbour), { ledge: 0x9aa3a6 });
      });
    } else if (variant === 1) { // container yard
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        if (R.chance(0.15)) continue;
        container(bt, cx - 21 + i * 14, cz - 21 + j * 14, i % 2 === 0, R.int(1, 3));
      }
    } else {                  // tank farm + office
      for (let i = 0; i < 4; i++) { const px = cx - 14 + (i % 2) * 28, pz = cz - 15 + Math.floor(i / 2) * 22; bt.sol.cyl(px, 5, pz, 7, 7, 10, 12, R.pick([0xeee6d4, 0xd9d2bf])); bt.sol.cyl(px, 10.2, pz, 7.2, 7.2, 0.4, 12, 0xc7432f); world.addCircle(px, pz, 7.2, 10); world.footprints.push({ x0: px - 7, x1: px + 7, z0: pz - 7, z1: pz + 7 }); }
      addBuilding(bt, cx, cz + 20, 28, 12, FL * 2, R.pick(CW.palette.harbour), {});
    }
  }

  // ---- build ---------------------------------------------------------------
  world.build = function (scene) {
    world.scene = scene;
    const L = C.LINES, mats = CW.mats;

    // far ground, hills, outskirts
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshLambertMaterial({ color: 0x78b866 }));
    grass.rotation.x = -Math.PI / 2; grass.position.set(-200, -0.04, -200); grass.receiveShadow = true; scene.add(grass);
    const hills = new CW.Batch();
    for (let i = 0; i < 34; i++) {
      const north = i < 17, t = (i % 17) / 16;
      const x = north ? -700 + t * 1000 + R.range(-30, 30) : -520 + R.range(-60, 40), z = north ? -520 + R.range(-60, 40) : -500 + t * 780;
      const r = R.range(90, 170), h = R.range(35, 105);
      hills.geo(new THREE.ConeGeometry(r, h, 7), x, h / 2 - 2, z, R.pick([0x3f8f55, 0x2f7a5a, 0x4a9a52, 0x6aa05a]), 0, R.range(0, 6));
    }
    for (let i = 0; i < 3; i++) hills.geo(new THREE.ConeGeometry(R.range(60, 100), R.range(14, 26), 6), 760 + i * 120, 4, -120 + i * 330, 0x3b7f93, 0, R.range(0, 6));
    scene.add(hills.build(new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0 })));

    // asphalt and kerbs
    const asph = new THREE.Mesh(new THREE.PlaneGeometry(496, 496), mats.asphalt);
    mats.asphalt.map.repeat.set(62, 62);
    asph.rotation.x = -Math.PI / 2; asph.position.set(0, 0, 0); asph.receiveShadow = true; scene.add(asph);

    // dock slab (also the quay wall), sand and boardwalk
    const dock = new CW.Batch();
    dock.box(-6, -1.6, 274, 588, 3.52, 52, 0x9fa3a0);
    dock.flat(-6, C.CURB + 0.02, 296.4, 588, 1.0, 0xf2c230);
    for (let x = -280; x <= 260; x += 40) dock.cyl(x, 0.35, 299.4, 0.35, 0.4, 0.5, 6, 0x2b3338);
    scene.add(dock.build(mats.solid, false, true));

    const xs = [248, 258, 268, 278, 286, 293, 302, 316, 340], hs = [0.0, 0.0, 0.02, -0.02, -0.18, -0.5, -1.0, -1.8, -3.2];
    const cs = [0xf4e2b5, 0xf4e2b5, 0xf2dcae, 0xe8cd98, 0xd2b684, 0xb99d70, 0xa88f68, 0x8f7f63, 0x6f6b5a];
    const rows = [-700, -300, 248], sp = [], sc = [], si = [];
    rows.forEach((z, j) => xs.forEach((x, i) => { sp.push(x, hs[i] - 0.01, z); const c = CW.hex(cs[i]); sc.push(c.r, c.g, c.b); }));
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; si.push(a, c, b, b, c, d); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); sg.setIndex(si); sg.computeVertexNormals();
    const sand = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ vertexColors: true })); sand.receiveShadow = true; scene.add(sand);

    // sea + shoreline foam
    const sg2 = new THREE.PlaneGeometry(1800, 1800, 72, 72); sg2.rotateX(-Math.PI / 2);
    const pa = sg2.attributes.position, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) {
      const d = Math.max(pa.getX(i) - 300, pa.getZ(i) - 300);
      const k = CW.clamp(d / 420, 0, 1), c1 = CW.hex(0x35dccc), c2 = CW.hex(0x1796b8), c3 = CW.hex(0x0b5486);
      const t = k < 0.35 ? k / 0.35 : (k - 0.35) / 0.65, a = k < 0.35 ? c1 : c2, b = k < 0.35 ? c2 : c3;
      col[i * 3] = a.r + (b.r - a.r) * t; col[i * 3 + 1] = a.g + (b.g - a.g) * t; col[i * 3 + 2] = a.b + (b.b - a.b) * t;
    }
    sg2.setAttribute('color', new THREE.BufferAttribute(col, 3));
    world.sea = new THREE.Mesh(sg2, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 70, specular: 0x6a7f90 }));
    world.sea.position.y = C.SEA_Y; scene.add(world.sea);
    const fc = CW.canvas(64, 16), fx = fc.getContext('2d'), fgd = fx.createLinearGradient(0, 0, 64, 0);
    fgd.addColorStop(0, 'rgba(255,255,255,0)'); fgd.addColorStop(0.7, 'rgba(255,255,255,0.9)'); fgd.addColorStop(1, 'rgba(255,255,255,0)'); fx.fillStyle = fgd; fx.fillRect(0, 0, 64, 16);
    world.foam = new THREE.Mesh(new THREE.PlaneGeometry(5, 600), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), transparent: true, depthWrite: false }));
    world.foam.rotation.x = -Math.PI / 2; world.foam.position.set(290, -0.28, -50); scene.add(world.foam);
    world.seaPos = sg2.attributes.position;
    world.seaBase = new Float32Array(pa.count * 2); for (let i = 0; i < pa.count; i++) { world.seaBase[i * 2] = pa.getX(i); world.seaBase[i * 2 + 1] = pa.getZ(i); }

    // street furniture batch + markings
    const furn = { win: new CW.Batch(), sol: new CW.Batch(), fol: new CW.Batch(), lamp: new CW.Batch() };
    const mk = new CW.Batch();
    const MY = 0.03, EDGE = 248;
    // kerbs round the city edge
    [[0, -EDGE - 1, 498, 2], [0, EDGE + 1, 498, 2]].forEach(([x, z, w, d]) => furn.sol.box(x, C.CURB / 2, z, w, C.CURB, d, 0xd8d0bc));
    [[-EDGE - 1, 0, 2, 498], [EDGE + 1, 0, 2, 498]].forEach(([x, z, w, d]) => furn.sol.box(x, C.CURB / 2, z, w, C.CURB, d, 0xd8d0bc));
    L.forEach((c) => {
      // centre lines and edge lines, skipping junction boxes
      for (let k = -1; k < L.length; k++) {
        const a = k < 0 ? -EDGE : L[k] + 8.4, b = k + 1 < L.length ? L[k + 1] - 8.4 : EDGE;
        if (b <= a) continue;
        const mid = (a + b) / 2, len = b - a;
        mk.flat(c - 0.22, MY, mid, 0.13, len, 0xf2c230); mk.flat(c + 0.22, MY, mid, 0.13, len, 0xf2c230);
        mk.flat(c - 4.9, MY, mid, 0.12, len, 0xf4f0e6); mk.flat(c + 4.9, MY, mid, 0.12, len, 0xf4f0e6);
        mk.flat(mid, MY, c - 0.22, len, 0.13, 0xf2c230); mk.flat(mid, MY, c + 0.22, len, 0.13, 0xf2c230);
        mk.flat(mid, MY, c - 4.9, len, 0.12, 0xf4f0e6); mk.flat(mid, MY, c + 4.9, len, 0.12, 0xf4f0e6);
      }
    });
    // junctions: zebra crossings, stop lines, traffic lights
    L.forEach((jx) => L.forEach((jz) => {
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dz]) => {
        const zx = jx + dx * 10.6, zz = jz + dz * 10.6;
        for (let s = -6.5; s <= 6.5; s += 1.4) { if (dz) mk.flat(zx + s, MY, zz, 0.7, 3.0, 0xf4f0e6); else mk.flat(zx, MY, zz + s, 3.0, 0.7, 0xf4f0e6); }
        const sx = jx + dx * 13.2, sz = jz + dz * 13.2;
        if (dz) mk.flat(sx + (dz > 0 ? -2.7 : 2.7), MY, sz, 5.0, 0.35, 0xf4f0e6); else mk.flat(sx, MY, sz + (dx > 0 ? 2.7 : -2.7), 0.35, 5.0, 0xf4f0e6);
      });
      [[1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const px = jx + sx * 9.2, pz = jz + sz * 9.2;
        furn.sol.cyl(px, 2.0, pz, 0.07, 0.08, 4.0, 6, 0x333b41); furn.sol.box(px, 4.4, pz, 0.45, 1.2, 0.45, 0x1f2428);
        furn.lamp.box(px, 4.75, pz, 0.52, 0.28, 0.52, 0xff3b30); furn.lamp.box(px, 4.4, pz, 0.46, 0.22, 0.46, 0x5b4a1a); furn.lamp.box(px, 4.05, pz, 0.52, 0.28, 0.52, 0x35e06a);
        world.addCircle(px, pz, 0.2, 5);
      });
    }));
    // street lamps along every street, alternating sides
    L.forEach((c) => {
      for (let t = -236, i = 0; t <= 236; t += 26, i++) {
        const near = L.some((l) => Math.abs(t - l) < 12); if (near) continue;
        const side = i % 2 ? 1 : -1;
        const x1 = c + side * 9.3, z1 = t; CW.addLamp(furn.sol, furn.lamp, world.lampGlow, x1, z1, side > 0 ? Math.PI : 0); world.addCircle(x1, z1, 0.2, 6);
        const x2 = t, z2 = c + side * 9.3; CW.addLamp(furn.sol, furn.lamp, world.lampGlow, x2, z2, side > 0 ? -Math.PI / 2 : Math.PI / 2); world.addCircle(x2, z2, 0.2, 6);
      }
    });
    scene.add(mk.build(mats.solid, false, true));

    // blocks
    const SPECIAL = { '-120,40': 'police', '-200,40': 'hospital', '-120,120': 'garage', '-120,200': 'fence', '-120,-40': 'park', '-200,-120': 'park' };
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const cx = -200 + i * 80, cz = -200 + j * 80, dist = CW.districtAt(cx, cz), bt = makeBatches();
      const kind = SPECIAL[cx + ',' + cz];
      const slabCol = dist === 0 ? 0xefe3c8 : dist === 1 ? 0xd2d4d0 : 0xb3b2a9;
      bt.sol.box(cx, C.CURB / 2, cz, C.BLOCK, C.CURB, C.BLOCK, slabCol);
      bt.sol.flat(cx, C.CURB + 0.03, cz, 58, 58, dist === 0 ? 0xe5d3ac : dist === 1 ? 0xbfc3c0 : 0x9b9c96);
      if (kind === 'park') blockPark(bt, cx, cz);
      else if (kind) blockLandmark(bt, cx, cz, kind);
      else if (dist === 0) blockBeach(bt, cx, cz);
      else if (dist === 1) blockDowntown(bt, cx, cz);
      else blockHarbour(bt, cx, cz, (i + j) % 3);
      flush(bt, scene);
      world.blocks.push({ cx, cz, district: dist, kind });
    }

    // boulevard palms, boardwalk, beach furniture, pier
    const bch = makeBatches();
    for (let z = -240; z <= 240; z += 10) { if (L.some((l) => Math.abs(z - l) < 11) || Math.abs(z - 40) < 9) continue; CW.addPalm(bch.sol, bch.fol, 250.6, z + R.range(-1, 1), 1.15, R); world.addCircle(250.6, z, 0.45, 9); }
    for (let z = -246; z < 246; z += 4) bch.sol.box(255, 0.1, z + 2, 8, 0.2, 3.9, z % 8 ? 0xc99a62 : 0xb98a56);
    for (let i = 0; i < 46; i++) {
      const x = R.range(262, 281), z = R.range(-236, 236); if (Math.abs(x - 264) < 9 && Math.abs(z - 40) < 9) continue;
      const c = R.pick([0xff6f61, 0x3fc1c9, 0xffc857, 0xf4f0e6, 0xe8569b]);
      bch.sol.cyl(x, 1.2, z, 0.04, 0.04, 2.4, 4, 0xe9e5da); bch.sol.cone(x, 2.35, z, 1.5, 0.55, 8, c);
      bch.sol.box(x + 1.6, 0.18, z + 0.5, 0.7, 0.12, 1.8, 0xf4f0e6); bch.sol.box(x - 1.6, 0.18, z - 0.4, 0.7, 0.12, 1.8, c);
      if (R.chance(0.3)) { CW.addPalm(bch.sol, bch.fol, x + R.range(-3, 3), z + R.range(-3, 3), 1.0, R); }
    }
    [-190, -70, 110].forEach((z) => {  // lifeguard towers
      bch.sol.box(266, 2.2, z, 2.2, 0.2, 2.2, 0xffffff); [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([a, b]) => bch.sol.box(266 + a, 1.1, z + b, 0.15, 2.2, 0.15, 0xe9e5da));
      bch.sol.box(266, 3.3, z, 2.0, 2.0, 2.0, 0xff6f61); bch.sol.box(266, 4.5, z, 2.6, 0.25, 2.6, 0xf4f0e6); world.addCircle(266, z, 1.5, 5);
    });
    bch.sol.box(305, 0.35, -110, 80, 0.3, 6, 0xb58a58); for (let x = 268; x < 345; x += 6) { bch.sol.box(x, -0.6, -107.5, 0.5, 1.6, 0.5, 0x6a4a2a); bch.sol.box(x, -0.6, -112.5, 0.5, 1.6, 0.5, 0x6a4a2a); }
    // beach bar (title scene backdrop) with thatch roof
    bch.sol.box(266, 1.6, 40, 8, 3.2, 6, 0xfdf2d0); world.addBox(262, 270, 37, 43, 3.2); bch.sol.cone(266, 4.2, 40, 6.6, 2.4, 4, 0xd9b45a, 0, Math.PI / 4, 0);
    for (let i = -1; i <= 1; i++) bch.sol.cyl(260.5, 0.55, 40 + i * 2, 0.3, 0.3, 1.1, 6, 0xe8569b);
    flush(bch, scene);
    world.footprints.push({ x0: 262, x1: 270, z0: 37, z1: 43 });

    // docks: cranes, boats, piers, helipad
    const dk = makeBatches();
    [-200, -120, -40, 40, 120, 200].forEach((px, i) => {
      dk.sol.box(px, 0.3, 328, 8, 0.4, 62, 0xb58a58);
      for (let z = 300; z < 356; z += 8) { dk.sol.box(px - 3.6, -0.8, z, 0.5, 2.2, 0.5, 0x6a4a2a); dk.sol.box(px + 3.6, -0.8, z, 0.5, 2.2, 0.5, 0x6a4a2a); }
      if (i % 2 === 0) {   // moored boat
        const bx = px + 8, bz = 322, hc = R.pick([0xf4f0e6, 0xd6283e, 0x2f7fd6, 0xffc857]);
        dk.sol.box(bx, 0.2, bz, 5, 1.6, 14, hc); dk.sol.box(bx, 1.8, bz - 1, 3.4, 1.6, 5, 0xf4f0e6); dk.sol.box(bx, 2.1, bz - 1, 3.5, 0.6, 5.1, 0x1f3a48); dk.sol.cone(bx, 0.2, bz + 8.3, 2.5, 3.4, 4, hc, Math.PI / 2, Math.PI / 4, 0);
      }
    });
    for (let i = 0; i < 5; i++) {   // sailboats
      const x = 380 + R.range(0, 160), z = R.range(-250, 250);
      dk.sol.box(x, 0.0, z, 3, 1.1, 9, 0xf4f0e6); dk.sol.cyl(x, 6, z, 0.12, 0.12, 12, 5, 0xcfd4d6);
      dk.fol.quad([x, 1.4, z + 0.3], [x, 1.4, z + 4.2], [x, 9, z + 0.3], [x, 9, z + 0.3], R.pick([0xffffff, 0xff7a59]));
    }
    for (let i = 0; i < 4; i++) { // gantry cranes on the quay
      const cx = -230 + i * 110 + 20, cz = 280;
      [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([a, b]) => dk.sol.box(cx + a, 11, cz + b, 0.9, 22, 0.9, 0xd9532f));
      dk.sol.box(cx, 22.5, cz, 12, 1.6, 12, 0xd9532f); dk.sol.box(cx, 23.6, cz + 14, 3, 2.2, 40, 0xf2f0e6); dk.sol.box(cx, 20, cz + 28, 1, 5, 1, 0x3a444a);
      world.addBox(cx - 5.6, cx + 5.6, cz - 5.6, cz + 5.6, 22);
      world.footprints.push({ x0: cx - 6, x1: cx + 6, z0: cz - 6, z1: cz + 6 });
    }
    flush(dk, scene);
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshLambertMaterial({ map: CW.makeHelipadTexture() }));
    hp.rotation.x = -Math.PI / 2; hp.position.set(60, C.CURB + 0.03, 274); hp.receiveShadow = true; scene.add(hp);
    world.landmarks.helipad = { x: 60, z: 274 };

    // west / north outskirts villas
    const ob = makeBatches();
    for (let t = -228; t <= 228; t += 26) {
      [[-274, t], [t, -274]].forEach(([x, z]) => { const w = 16, d = 14, h = R.int(1, 2) * FL; addBuilding(ob, x, z, w, d, h, R.pick(CW.palette.beach), { ledge: 0xffffff }); CW.addPalm(ob.sol, ob.fol, x + 11, z + 9, 1.1, R); });
    }
    flush(ob, scene);

    // billboards along the boulevard and the harbour wall
    [[-190, 0], [-130, 5], [130, 7]].forEach(([z, k]) => billboard(258, 0, z, -Math.PI / 2, k, 14, 6.5));
    [[-180, 3], [0, 1], [150, 6]].forEach(([x, k]) => billboard(x, 0, 250, Math.PI, k, 16, 7));
    flush(furn, scene);

    // glow sprites for lamps (night only)
    const gp = new THREE.BufferGeometry();
    gp.setAttribute('position', new THREE.Float32BufferAttribute(world.lampGlow, 3));
    world.glowMat = new THREE.PointsMaterial({ size: 5, map: CW.glowTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    scene.add((world.glow = new THREE.Points(gp, world.glowMat)));
    world.glow.frustumCulled = false;

    // title set neon + parking slots
    world.titleSet = { x: 245.0, z: 40, carX: 246.4 };
    plate('SOLMARA\nHARBOUR CLUB', 9, 3.2, { bg: '#16062e', fg: '#ff5fd2', edge: '#35f2ff', glow: true }, 264, 7.2, 24, -Math.PI / 2, true);
    plate('SOL BAR', 4.4, 1.5, { bg: '#08213a', fg: '#4ff5e0', edge: '#ffd24a', glow: true }, 261.9, 2.6, 40, -Math.PI / 2, true);
    plate('HARBOUR\nOPEN 24H', 6, 3, { bg: '#2a0a2a', fg: '#ffcf3a', edge: '#ff5a5a', glow: true }, 264, 7, 58, -Math.PI / 2, true);
    bchPosts(scene);
    // palms that frame the cover shot on both sides, leaning in toward the pair
    const fr = makeBatches();
    CW.addPalm(fr.sol, fr.fol, 181, 9.8, 1.45, R, -Math.PI / 2, 0.2);
    CW.addPalm(fr.sol, fr.fol, 181, -9.8, 1.45, R, Math.PI / 2, 0.2);
    CW.addPalm(fr.sol, fr.fol, 168, 11, 1.3, R, -Math.PI / 2, 0.22);
    CW.addPalm(fr.sol, fr.fol, 168, -11, 1.3, R, Math.PI / 2, 0.22);
    flush(fr, scene);

    // parking slots along every street
    L.forEach((c) => {
      for (let k = 0; k < L.length - 1; k++) {
        const a = L[k] + 14, b = L[k + 1] - 14;
        for (let s = a + 3; s < b - 2; s += 6.8) {
          [[1, Math.PI], [-1, 0]].forEach(([side, h]) => { world.parkSlots.push({ x: c + side * C.PARK, z: s, h }); });
          [[1, Math.PI / 2], [-1, -Math.PI / 2]].forEach(([side, h]) => { world.parkSlots.push({ x: s, z: c + side * C.PARK, h }); });
        }
      }
    });
    world.spawn = { x: 229.6, z: 30, h: Math.PI / 2 };
  };

  function bchPosts(scene) {
    const b = new CW.Batch();
    [[264, 19.8], [264, 28.2], [264, 55.2], [264, 60.8]].forEach(([x, z]) => b.cyl(x, 3.5, z, 0.14, 0.14, 7, 6, 0x333b41));
    scene.add(b.build(CW.mats.solid, true, false));
  }

  world.update = function (dt, t) {
    const pa = world.seaPos, base = world.seaBase;
    for (let i = 0; i < pa.count; i++) {
      const x = base[i * 2], z = base[i * 2 + 1];
      pa.setY(i, Math.sin(x * 0.045 + t * 0.9) * 0.22 + Math.sin(z * 0.06 + t * 1.2) * 0.18 + Math.sin((x + z) * 0.1 + t * 1.7) * 0.09);
    }
    pa.needsUpdate = true;
    world.foam.position.x = 289.5 + Math.sin(t * 0.8) * 2.2; world.foam.material.opacity = 0.45 + 0.4 * Math.sin(t * 0.8 + 1);
  };
})();
