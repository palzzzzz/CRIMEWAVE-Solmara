// Low-poly models: cars (one merged mesh each), articulated people, palms, street lamps.
(function () {
  const CW = window.CW;
  const B = () => new CW.Batch();

  // cylinder between two points
  function cylAlong(batch, p0, p1, r0, r1, seg, color) {
    const dir = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    batch.cyl((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, r1, r0, len, seg, color, e.x, e.y, e.z);
  }
  CW.cylAlong = cylAlong;

  // ---- cars ----------------------------------------------------------------
  const carGeoCache = {}, wheelGeoCache = {};
  CW.carGeometry = function (typeId, color) {
    const key = typeId + ':' + color;
    if (carGeoCache[key]) return carGeoCache[key];
    const t = CW.CAR_TYPES[typeId];
    const b = B(), tb = B(), rb = B();   // body (glossy clearcoat), tyres (rubber), rims (chrome): three meshes per car
    const glass = 0x1f3a48, dark = 0x23282c, lightF = 0xfff3b8, lightR = 0xff3b30;
    const keepWheels = () => { if (!wheelGeoCache[typeId]) wheelGeoCache[typeId] = { tyre: tb.build(CW.mats.tyre).geometry, rim: rb.build(CW.mats.chrome).geometry }; };
    const y0 = 0.3, top = y0 + t.bh, roof = top + t.ch;
    const hw = t.w / 2, hl = t.l / 2;
    const isVan = typeId === 'van', isSuv = typeId === 'suv', isPick = typeId === 'pickup';
    if (typeId === 'bike') {
      const bl = t.l / 2, wr0 = 0.36;
      [1, -1].forEach((s) => { tb.cyl(0, wr0, s * (bl - 0.4), wr0, wr0, 0.16, 12, 0x15181a, 0, 0, Math.PI / 2); rb.cyl(0, wr0, s * (bl - 0.4), wr0 * 0.55, wr0 * 0.55, 0.18, 12, 0xffffff, 0, 0, Math.PI / 2); });
      b.box(0, 0.55, -0.05, 0.2, 0.2, 1.1, dark); b.box(0, 0.86, 0.22, 0.34, 0.3, 0.58, color); b.box(0, 0.78, -0.4, 0.3, 0.1, 0.72, 0x1c1f22);
      b.box(0, 0.62, -0.82, 0.22, 0.08, 0.5, color); b.box(0.22, 0.4, -0.3, 0.09, 0.09, 0.85, 0xc9ced1); b.box(0, 0.5, 0.2, 0.3, 0.3, 0.4, 0x30363b);
      cylAlong(b, [0, 1.0, 0.55], [0, 0.4, 0.7], 0.04, 0.05, 6, 0xc9ced1); b.box(0, 1.08, 0.52, 0.72, 0.06, 0.06, dark);
      b.box(0, 0.92, 0.74, 0.22, 0.2, 0.12, lightF); b.box(0, 0.86, -1.02, 0.22, 0.09, 0.05, lightR); b.box(0, 0.5, 0.74, 0.06, 0.35, 0.06, 0xc9ced1);
      keepWheels(); const gb = b.build(CW.mats.car).geometry; carGeoCache[key] = gb; return gb;
    }
    // wheels
    const wr = isSuv || isVan || isPick ? 0.42 : 0.36;
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
      tb.cyl(sx * (hw - 0.1), wr, sz * hl * 0.62, wr, wr, 0.28, 14, 0x15181a, 0, 0, Math.PI / 2);
      rb.cyl(sx * (hw - 0.0), wr, sz * hl * 0.62, wr * 0.55, wr * 0.55, 0.3, 14, 0xffffff, 0, 0, Math.PI / 2);
    });
    b.box(0, y0 - 0.02, 0, t.w * 0.9, 0.18, t.l * 0.96, dark);                   // underbody
    if (typeId === 'sports') {
      // angular wedge: slab nose, stepped shoulders rising to high haunches, a thin glasshouse, slit lights, big rear wing
      const w = t.w, L = t.l, hh = 0.42;
      b.box(0, y0 + 0.15, 0, w, 0.3, L * 0.98, color);                              // low slab, full length
      b.box(0, y0 + 0.34, -0.55, w * 0.98, 0.14, 1.9, color);                       // haunches, tallest at the back
      b.box(0, y0 + 0.3, 0.75, w * 0.9, 0.08, 1.1, color);                          // lower shoulder wedge step
      b.box(0, y0 + 0.33, -1.8, w * 0.96, 0.2, 0.6, color);                         // high tail
      b.box(0, y0 + 0.33, 1.7, w * 0.8, 0.04, 0.8, color);                          // knife-edge nose blade
      [1, -1].forEach((s) => {
        b.box(s * (hw + 0.008), y0 + 0.2, -0.1, 0.03, 0.035, L * 0.8, 0x111416);     // sharp character crease
        b.box(s * (hw + 0.012), y0 + 0.14, -0.7, 0.03, 0.16, 0.9, 0x111416);         // side intake
        b.box(s * hw * 0.6, y0 + 0.24, hl * 0.98 + 0.01, 0.58, 0.045, 0.05, lightF); // slim slit headlight
        b.box(s * hw * 0.74, y0 + 0.31, hl * 0.98 + 0.01, 0.25, 0.04, 0.05, 0xffc24a);
        b.box(s * w * 0.3, y0 + 0.76, -hl + 0.28, 0.07, 0.34, 0.1, 0x16191b);        // wing struts
        b.box(s * (w * 0.51), y0 + 0.92, -hl + 0.28, 0.05, 0.3, 0.7, color);         // wing end plates
      });
      b.box(0, y0 + 0.29, hl * 0.98 + 0.012, w * 0.3, 0.06, 0.05, 0x111416);          // nose intake
      b.box(0, y0 + 0.36, -hl * 0.98 - 0.012, w * 0.86, 0.05, 0.05, lightR);        // full-width tail bar
      b.box(0, y0 + 0.02, hl - 0.2, w * 1.04, 0.05, 0.5, 0x16191b);                  // front splitter
      b.box(0, y0 + 0.04, -hl + 0.15, w * 0.8, 0.12, 0.35, 0x16191b);                // rear diffuser
      b.box(0, y0 + 0.9, -hl + 0.28, w * 1.04, 0.05, 0.62, 0x16191b);                // large rear wing
      b.box(0, y0 + 0.94, -hl + 0.2, w * 1.04, 0.04, 0.2, color);                    // wing flap
      b.box(0, y0 + hh + 0.22, -0.2, w * 0.7, 0.3, 1.5, glass);                       // thin glasshouse
      b.box(0, y0 + hh + 0.1, 0.78, w * 0.7, 0.14, 0.7, glass);                       // raked windscreen step
      b.box(0, y0 + hh + 0.38, -0.2, w * 0.66, 0.05, 1.2, color);                     // roof panel
      b.box(0, y0 + hh + 0.2, -1.2, w * 0.66, 0.2, 0.55, 0x16191b);                  // engine deck slats
    } else {
    b.box(0, y0 + t.bh / 2, 0, t.w, t.bh, t.l, color);                            // main body
    b.box(0, top + 0.01, hl * 0.62, t.w * 0.92, 0.04, t.l * 0.26, color);       // hood panel line
    if (typeId !== 'sports') {
      b.box(0, y0 + 0.14, hl - 0.04, t.w * 1.02, 0.28, 0.18, dark);               // front bumper
      b.box(0, y0 + 0.14, -hl + 0.04, t.w * 1.02, 0.28, 0.18, dark);              // rear bumper
    }
    // lights (the wedge supercar has its own slit lights)
    if (typeId !== 'sports') {
      b.box(hw * 0.62, y0 + t.bh * 0.66, hl + 0.01, 0.42, 0.17, 0.06, lightF);
      b.box(-hw * 0.62, y0 + t.bh * 0.66, hl + 0.01, 0.42, 0.17, 0.06, lightF);
      b.box(hw * 0.62, y0 + t.bh * 0.66, -hl - 0.01, 0.42, 0.15, 0.06, lightR);
      b.box(-hw * 0.62, y0 + t.bh * 0.66, -hl - 0.01, 0.42, 0.15, 0.06, lightR);
      b.box(0, y0 + t.bh * 0.3, hl + 0.02, t.w * 0.4, 0.14, 0.05, 0x111416);       // grille
    }
    // cabin
    const cw = t.w * 0.88;
    if (isVan) {
      b.box(0, top + t.ch / 2, t.cz, cw, t.ch, t.cl, color);
      b.box(0, top + t.ch * 0.58, t.cz + t.cl / 2 + 0.01, cw * 0.92, t.ch * 0.55, 0.05, glass);
      b.box(hw * 0.88 + 0.01, top + t.ch * 0.58, t.cz + t.cl * 0.34, 0.05, t.ch * 0.45, t.cl * 0.22, glass);
      b.box(-hw * 0.88 - 0.01, top + t.ch * 0.58, t.cz + t.cl * 0.34, 0.05, t.ch * 0.45, t.cl * 0.22, glass);
    } else {
      b.box(0, top + t.ch / 2, t.cz, cw, t.ch, t.cl, glass);
      b.box(0, roof + 0.03, t.cz, cw * 1.02, 0.07, t.cl * 0.84, color);
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => b.box(sx * cw * 0.5, top + t.ch / 2, t.cz + sz * t.cl * 0.5, 0.09, t.ch, 0.1, color));
    }
    }
    if (typeId === 'taxi') {
      b.box(0, roof + 0.2, t.cz, 0.7, 0.2, 0.32, 0xfff3d0);
      b.box(0, y0 + t.bh * 0.5, 0, t.w * 1.003, 0.1, t.l * 0.8, 0x1d1d1d);
    }
    if (isPick) {
      const bz = -hl + 1.3, bl = 2.5;   // load bed behind the cab: dark floor, three walls, a roll bar
      b.box(0, top + 0.02, bz, t.w * 0.84, 0.03, bl - 0.1, 0x2a2e32);
      [1, -1].forEach((s) => b.box(s * (hw - 0.05), top + 0.17, bz, 0.1, 0.34, bl, color));
      b.box(0, top + 0.17, -hl + 0.06, t.w, 0.34, 0.1, color); b.box(0, top + 0.17, bz + bl / 2 - 0.05, t.w, 0.34, 0.1, color);
      b.box(0, roof + 0.2, bz + bl / 2 + 0.05, t.w * 0.9, 0.08, 0.08, dark);
    }
    if (isSuv) {
      b.box(0, roof + 0.12, t.cz, 0.08, 0.06, t.cl * 0.8, dark);
      b.box(hw * 0.5, roof + 0.12, t.cz, 0.08, 0.06, t.cl * 0.8, dark);
      b.box(-hw * 0.5, roof + 0.12, t.cz, 0.08, 0.06, t.cl * 0.8, dark);
    }
    keepWheels();
    const g = b.build(CW.mats.car).geometry;
    carGeoCache[key] = g;
    return g;
  };

  CW.makeCarMesh = function (typeId, color) {
    const grp = new THREE.Group();
    grp.rotation.order = 'YXZ';
    const m = new THREE.Mesh(CW.carGeometry(typeId, color), CW.mats.car);
    m.castShadow = true; m.receiveShadow = false;
    grp.add(m);
    const w = wheelGeoCache[typeId];   // filled by carGeometry above
    const tm = new THREE.Mesh(w.tyre, CW.mats.tyre), rm = new THREE.Mesh(w.rim, CW.mats.chrome);
    tm.castShadow = true; rm.castShadow = true; grp.add(tm, rm);
    grp.userData.body = m;
    return grp;
  };

  // ---- people --------------------------------------------------------------
  const matCache = {};
  const mat = (c) => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c }));
  const bx = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; return m; };

  CW.makePerson = function (def) {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const f = def.female;
    const tw = f ? 0.42 : 0.5;
    // legs
    const mkLeg = (sx) => {
      const hip = new THREE.Group(); hip.position.set(sx * 0.12, 0.92, 0);
      hip.add(bx(0.19, 0.82, 0.21, def.pants, 0, -0.43, 0));
      hip.add(bx(0.21, 0.1, 0.32, def.shoes, 0, -0.87, 0.05));
      body.add(hip); return hip;
    };
    const legL = mkLeg(1), legR = mkLeg(-1);
    // torso, hips
    body.add(bx(tw, 0.62, 0.27, def.shirt, 0, 1.22, 0));
    body.add(bx(tw * 0.96, 0.2, 0.26, def.pants, 0, 0.98, 0));
    // arms
    const mkArm = (sx) => {
      const sh = new THREE.Group(); sh.position.set(sx * (tw / 2 + 0.08), 1.46, 0);
      sh.add(bx(0.13, 0.3, 0.14, def.shirt, 0, -0.14, 0));
      const el = new THREE.Group(); el.position.set(0, -0.3, 0);
      el.add(bx(0.11, 0.3, 0.12, def.skin, 0, -0.14, 0));
      sh.add(el); body.add(sh); return { sh, el };
    };
    const armL = mkArm(1), armR = mkArm(-1);
    // head
    const head = new THREE.Group(); head.position.set(0, 1.62, 0);
    head.add(bx(0.2, 0.06, 0.2, def.skin, 0, -0.06, 0));
    head.add(bx(0.24, 0.26, 0.25, def.skin, 0, 0.1, 0));
    head.add(bx(0.27, 0.1, 0.29, def.hair, 0, 0.26, -0.01));
    if (f) { head.add(bx(0.27, 0.46, 0.1, def.hair, 0, -0.03, -0.14)); head.add(bx(0.06, 0.3, 0.2, def.hair, 0.14, 0.05, -0.03)); head.add(bx(0.06, 0.3, 0.2, def.hair, -0.14, 0.05, -0.03)); }
    else if (def.id === 'ray') {
      // afro: a rounded stack of dark boxes, with a coral bandana band and a knot at the back
      head.add(bx(0.4, 0.2, 0.4, def.hair, 0, 0.3, -0.03));
      head.add(bx(0.34, 0.14, 0.34, def.hair, 0, 0.45, -0.03));
      head.add(bx(0.44, 0.16, 0.3, def.hair, 0, 0.26, -0.05));
      head.add(bx(0.3, 0.1, 0.1, def.hair, 0, 0.3, -0.2));
      const band = def.bandana;
      head.add(bx(0.47, 0.115, 0.4, band, 0, 0.24, -0.03));     // wide band that clears the afro on every side
      head.add(bx(0.2, 0.1, 0.05, 0xfff1d0, 0, 0.24, 0.18));    // cream front patch so it reads from the front
      head.add(bx(0.14, 0.14, 0.1, band, 0, 0.24, -0.26));
      head.add(bx(0.08, 0.26, 0.04, band, 0.08, 0.08, -0.3));
      head.add(bx(0.08, 0.22, 0.04, band, -0.08, 0.09, -0.3));
    } else { head.add(bx(0.26, 0.14, 0.1, def.hair, 0, 0.2, -0.12)); }
    if (def.shades) head.add(bx(0.27, 0.06, 0.05, 0x0c0c10, 0, 0.12, 0.13));
    else { head.add(bx(0.05, 0.04, 0.03, 0x1a1210, 0.06, 0.12, 0.13)); head.add(bx(0.05, 0.04, 0.03, 0x1a1210, -0.06, 0.12, 0.13)); }
    body.add(head);
    if (def.id === 'ray') head.add(bx(0.2, 0.06, 0.05, 0x2a1c14, 0, 0.0, 0.12)); // stubble
    root.userData = { body, legL, legR, armL, armR, head, phase: 0, swing: 0 };
    root.userData.update = function (dt, speed) {
      const u = root.userData;
      const k = CW.clamp(speed / 6, 0, 1);
      u.phase += dt * (3 + speed * 1.7);
      const s = Math.sin(u.phase);
      u.swing = CW.damp(u.swing, k, 12, dt);
      legL.rotation.x = s * 0.9 * u.swing; legR.rotation.x = -s * 0.9 * u.swing;
      armL.sh.rotation.x = -s * 0.8 * u.swing; armR.sh.rotation.x = s * 0.8 * u.swing;
      armL.el.rotation.x = -0.25 - 0.5 * u.swing * (speed > 4 ? 1 : 0.3); armR.el.rotation.x = armL.el.rotation.x;
      body.position.y = Math.abs(s) * 0.05 * u.swing;
      body.rotation.x = 0.03 + 0.12 * (speed > 4 ? u.swing : 0);
    };
    root.userData.setPose = function (pose) {
      const u = root.userData;
      [legL, legR].forEach((l) => l.rotation.set(0, 0, 0));
      [armL, armR].forEach((a) => { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); });
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); head.rotation.set(0, 0, 0);
      if (pose === 'ray-lean') {
        body.rotation.x = -0.1; legL.rotation.x = 0.28; legL.rotation.z = -0.12; legR.rotation.x = -0.05;
        armR.sh.rotation.x = -0.55; armR.el.rotation.x = -1.95; armR.sh.rotation.z = 0.15;
        armL.sh.rotation.x = 0.1; armL.el.rotation.x = -0.35; head.rotation.set(-0.08, -0.15, 0);
      } else if (pose === 'luna-sit') {
        body.rotation.x = -0.06; legR.rotation.set(0.42, 0, 0.06); legL.rotation.set(0.26, 0, -0.04);
        armL.sh.rotation.set(-0.75, 0, -0.55); armL.el.rotation.x = -1.9;
        armR.sh.rotation.set(-0.75, 0, 0.55); armR.el.rotation.x = -1.9;
        head.rotation.set(0.03, 0.15, 0.04);
      } else if (pose === 'ray-pistol') {
        // title: standing square to the lens, pistol in the right hand held low and forward, left hand relaxed; no other prop
        body.rotation.x = -0.04; legL.rotation.set(0.05, 0, -0.1); legR.rotation.set(-0.04, 0, 0.12);
        armR.sh.rotation.set(-1.15, 0, 0.1); armR.el.rotation.x = -0.35;
        armL.sh.rotation.set(0.12, 0, -0.1); armL.el.rotation.x = -0.35; head.rotation.set(-0.04, -0.12, 0);
      } else if (pose === 'luna-smg') {
        // title: two-handed SMG at low ready (right hand on the grip, left hand under the foregrip)
        body.rotation.x = -0.05; legL.rotation.set(0.1, 0, -0.12); legR.rotation.set(-0.08, 0, 0.1);
        armR.sh.rotation.set(-1.2, 0, 0.08); armR.el.rotation.x = -0.4;
        armL.sh.rotation.set(-1.25, 0, -0.34); armL.el.rotation.x = -0.75; head.rotation.set(0.02, 0.18, 0);
      } else if (pose === 'bike') {
        body.rotation.x = 0.3; body.position.y = -0.18; legL.rotation.set(-1.1, 0, -0.1); legR.rotation.set(-1.1, 0, 0.1);
        armL.sh.rotation.set(-1.15, 0, -0.1); armL.el.rotation.x = -0.35; armR.sh.rotation.set(-1.15, 0, 0.1); armR.el.rotation.x = -0.35; head.rotation.x = -0.25;
      } else if (pose === 'luna-lean') {
        body.rotation.x = -0.09; legR.rotation.x = 0.3; legR.rotation.z = 0.1; legL.rotation.x = -0.04;
        armL.sh.rotation.set(-0.75, 0, -0.55); armL.el.rotation.x = -1.9;
        armR.sh.rotation.set(-0.75, 0, 0.55); armR.el.rotation.x = -1.9;
        head.rotation.set(0.04, 0.2, 0);
      }
    };
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return root;
  };

  // ---- palms and lamps (write into shared batches) -------------------------
  CW.addPalm = function (solid, fol, x, z, scale, rng, angOpt, leanOpt) {
    const s = scale || 1;
    const lean = leanOpt !== undefined ? leanOpt : rng.range(0.05, 0.28), ang = angOpt !== undefined ? angOpt : rng.range(0, Math.PI * 2);
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const segs = 4, L = rng.range(1.7, 2.3) * s;
    let p = [x, 0, z];
    for (let i = 0; i < segs; i++) {
      const th = lean * (0.4 + i * 0.35);
      const q = [p[0] + Math.sin(th) * dx * L, p[1] + Math.cos(th) * L, p[2] + Math.sin(th) * dz * L];
      cylAlong(solid, p, q, (0.19 - i * 0.025) * s, (0.22 - i * 0.025) * s, 6, i % 2 ? 0x8a6a48 : 0x9c7a55);
      p = q;
    }
    const n = 9, r0 = rng.range(0, 6);
    for (let k = 0; k < n; k++) {
      const a = r0 + (k / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const cx = Math.cos(a), cz = Math.sin(a), px = -cz, pz = cx;
      const len = rng.range(2.4, 3.1) * s, wd = 0.5 * s, rise = rng.range(0.5, 1.1) * s;
      const m = [p[0] + cx * len * 0.5, p[1] + rise, p[2] + cz * len * 0.5];
      const e = [p[0] + cx * len, p[1] + rise - 1.0 * s, p[2] + cz * len];
      const dk = k % 2 ? 0x2f8a45 : 0x3a9a4a, lt = k % 2 ? 0x56b85a : 0x66c765;
      fol.quad([p[0] - px * 0.05, p[1], p[2] - pz * 0.05], [p[0] + px * 0.05, p[1], p[2] + pz * 0.05], [m[0] + px * wd, m[1], m[2] + pz * wd], [m[0] - px * wd, m[1], m[2] - pz * wd], dk);
      fol.quad([m[0] - px * wd, m[1], m[2] - pz * wd], [m[0] + px * wd, m[1], m[2] + pz * wd], [e[0] + px * 0.04, e[1], e[2] + pz * 0.04], [e[0] - px * 0.04, e[1], e[2] - pz * 0.04], lt);
    }
    solid.sphere(p[0] + 0.15, p[1] - 0.15, p[2], 0.16 * s, 0x6a4a2a);
    solid.sphere(p[0] - 0.12, p[1] - 0.2, p[2] + 0.1, 0.15 * s, 0x6a4a2a);
  };

  CW.addLamp = function (solid, lampB, glowList, x, z, rot) {
    const dx = Math.cos(rot), dz = Math.sin(rot);
    solid.cyl(x, 3.2, z, 0.06, 0.09, 6.4, 6, 0x36424a);
    const ax = x + dx * 1.3, az = z + dz * 1.3;
    solid.box((x + ax) / 2, 6.35, (z + az) / 2, Math.abs(dx) * 1.3 + 0.1, 0.1, Math.abs(dz) * 1.3 + 0.1, 0x36424a);
    lampB.box(ax, 6.22, az, 0.5, 0.14, 0.5, 0xfff0c0);
    glowList.push(ax, 6.0, az);
  };
})();
