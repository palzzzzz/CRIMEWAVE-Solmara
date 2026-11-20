// Garage car mods: paint, spoiler, neon underglow and wheel styles, plus the lift / turntable the mod bay puts the car on.
// State lives on the Car object that is also the world car (car.color for paint, car.mods for the rest), so applying a mod
// changes the garage view and the car out in the world at once. Nothing here touches the save format.
(function () {
  const CW = window.CW, M = (CW.carmods = {});

  M.PAINT = [
    { n: 'FLAME', c: 0xff5a3c }, { n: 'SUNRISE', c: 0xffc23a }, { n: 'LAGOON', c: 0x2fd0c4 }, { n: 'ROSE', c: 0xe0407a }, { n: 'COBALT', c: 0x2f56c8 },
    { n: 'PEARL', c: 0xf2f0e6 }, { n: 'LIME', c: 0x8fd23a }, { n: 'GRAPE', c: 0x7a3fb0 }, { n: 'WINE', c: 0x8b1f3f }, { n: 'ONYX', c: 0x1b1d21 },
  ];
  M.SPOILER = ['STOCK', 'DUCKTAIL', 'GT WING', 'RACE WING'];
  M.NEON = [{ n: 'OFF', c: 0 }, { n: 'CYAN', c: 0x19e6ff }, { n: 'MAGENTA', c: 0xff2bd6 }, { n: 'LIME', c: 0x9dff2b }, { n: 'AMBER', c: 0xffa51f }, { n: 'ICE', c: 0xcfe8ff }];
  M.WHEEL = ['STOCK', 'CHROME SPOKE', 'GOLD SPOKE', 'BLACKOUT'];
  M.PRICE = { paint: 150, spoiler: 300, neon: 250, wheel: 200 };
  M.blank = () => ({ sp: 0, ne: 0, wh: 0 });

  // ---- shared geometry + materials ------------------------------------------------------------------------------------------
  const UB = new THREE.BoxGeometry(1, 1, 1), UC = new THREE.CylinderGeometry(1, 1, 1, 24);
  const matCache = {};
  const gloss = (c, r, m) => { const k = c + '|' + r + '|' + m; return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m })); };
  const neonMat = {};
  const glowMat = (c) => neonMat['g' + c] || (neonMat['g' + c] = new THREE.MeshBasicMaterial({ color: c, map: CW.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85, fog: false }));
  const tubeMat = (c) => neonMat['t' + c] || (neonMat['t' + c] = new THREE.MeshBasicMaterial({ color: c, fog: false }));
  function bx(g, w, h, d, mat, x, y, z, rx) { const m = new THREE.Mesh(UB, mat); m.scale.set(w, h, d); m.position.set(x, y, z); if (rx) m.rotation.x = rx; m.castShadow = true; g.add(m); return m; }

  // ---- spoilers ---------------------------------------------------------------------------------------------------------------
  function spoiler(g, t, style, color) {
    const hl = t.l / 2, id = t.id, sports = id === 'sports', roof = id === 'hatch' || id === 'suv' || id === 'van' || id === 'pickup';
    const z = sports ? -hl + 0.28 : roof ? t.cz - t.cl / 2 + 0.1 : -hl + 0.3;
    const yb = sports ? 0.78 : roof ? 0.3 + t.bh + t.ch + 0.05 : 0.3 + t.bh + 0.02;
    const ww = t.w * (roof ? 0.78 : 0.88), paint = gloss(color, 0.18, 0.15), dark = gloss(0x16191b, 0.4, 0.3), carbon = gloss(0x0d0f11, 0.25, 0.4);
    if (style === 1) { bx(g, ww, 0.07, 0.36, paint, 0, yb + 0.07, z, 0.28); bx(g, ww * 0.96, 0.05, 0.05, dark, 0, yb + 0.02, z + 0.12); }
    else if (style === 2) {
      const h = sports ? 0.5 : 0.3;
      [1, -1].forEach((s) => { bx(g, 0.06, h, 0.1, dark, s * ww * 0.32, yb + h / 2, z); bx(g, 0.045, 0.22, 0.5, paint, s * ww * 0.5, yb + h + 0.05, z); });
      bx(g, ww, 0.05, 0.46, paint, 0, yb + h + 0.02, z, -0.1);
    } else if (style === 3) {
      const h = sports ? 0.72 : 0.5;
      [1, -1].forEach((s) => { bx(g, 0.07, h, 0.12, dark, s * ww * 0.3, yb + h / 2, z); bx(g, 0.05, 0.42, 0.78, carbon, s * ww * 0.52, yb + h + 0.1, z); });
      bx(g, ww, 0.05, 0.5, carbon, 0, yb + h, z + 0.04, -0.06);
      bx(g, ww, 0.045, 0.3, paint, 0, yb + h + 0.2, z - 0.1, -0.5);
    }
  }

  // ---- wheels (overlay on the stock hubs: a disc, spokes and a cap on each outer face) --------------------------------------
  function wheels(g, t, style) {
    const wr = t.id === 'suv' || t.id === 'van' || t.id === 'pickup' ? 0.42 : 0.36, hw = t.w / 2, hl = t.l / 2;
    const face = style === 1 ? gloss(0xffffff, 0.04, 1) : style === 2 ? gloss(0xffc23a, 0.22, 1) : gloss(0x101215, 0.35, 0.6);
    const spoke = style === 3 ? gloss(0xd6283e, 0.3, 0.4) : style === 2 ? gloss(0xfff0b0, 0.15, 1) : gloss(0xe9f1f5, 0.05, 1);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
      const w = new THREE.Group(); w.position.set(sx * (hw + 0.17), wr, sz * hl * 0.62);
      const d = new THREE.Mesh(UC, face); d.rotation.z = Math.PI / 2; d.scale.set(wr * 0.62, 0.03, wr * 0.62); w.add(d);
      const rim = new THREE.Mesh(UC, spoke); rim.rotation.z = Math.PI / 2; rim.scale.set(wr * 0.64, 0.045, wr * 0.64); rim.position.x = -sx * 0.012; w.add(rim);
      for (let i = 0; i < 6; i++) { const p = new THREE.Group(); p.rotation.x = (i / 6) * Math.PI; bx(p, 0.035, wr * 1.14, 0.07, spoke, sx * 0.02, 0, 0); w.add(p); }
      const cap = new THREE.Mesh(UC, spoke); cap.rotation.z = Math.PI / 2; cap.scale.set(wr * 0.16, 0.06, wr * 0.16); cap.position.x = sx * 0.02; w.add(cap);
      g.add(w);
    });
  }

  // ---- neon underglow: a soft ground pool plus tube strips along the sills --------------------------------------------------
  function neon(g, t, col) {
    const hw = t.w / 2, hl = t.l / 2, tm = tubeMat(col);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(t.w + 1.6, t.l + 1.4), glowMat(col)); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.07; pool.renderOrder = 3; g.add(pool);
    [1, -1].forEach((s) => { bx(g, 0.05, 0.05, t.l * 0.72, tm, s * hw * 0.94, 0.2, 0); });
    bx(g, t.w * 0.7, 0.05, 0.05, tm, 0, 0.2, hl * 0.82); bx(g, t.w * 0.7, 0.05, 0.05, tm, 0, 0.2, -hl * 0.82);
  }

  // Rebuilds the extras group of a car from car.mods and car.color. Safe to call any time; the base car mesh is untouched.
  M.refresh = function (car) {
    if (!car || !car.mesh) return;
    const mesh = car.mesh, mods = car.mods || (car.mods = M.blank()), t = car.type;
    if (mesh.userData.modGrp) { mesh.remove(mesh.userData.modGrp); mesh.userData.modGrp.traverse((o) => { if (o.isMesh && o.geometry !== UB && o.geometry !== UC) o.geometry.dispose(); }); }
    const g = mesh.userData.modGrp = new THREE.Group(); mesh.add(g);
    if (t.id !== 'bike') {
      if (mods.sp) spoiler(g, t, mods.sp, car.color);
      if (mods.wh) wheels(g, t, mods.wh);
    }
    if (mods.ne && M.NEON[mods.ne]) neon(g, t.id === 'bike' ? { id: 'bike', w: 1.0, l: t.l } : t, M.NEON[mods.ne].c);
  };

  M.setPaint = function (car, c) { car.color = c; car.mesh.userData.body.geometry = CW.carGeometry(car.type.id, c); M.refresh(car); };
  M.paintIndex = (car) => M.PAINT.findIndex((p) => p.c === car.color);

  // ---- the lift / turntable that stands in Roxy's yard ---------------------------------------------------------------------
  M.LIFT_Y = 0.55;
  M.buildLift = function (scene, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0.1, z); scene.add(g);
    const std = (c, r, m) => gloss(c, r, m);
    const base = new THREE.Mesh(UC, std(0x2a2f33, 0.6, 0.3)); base.scale.set(4.3, 0.16, 4.3); base.position.y = 0.08; base.receiveShadow = true; g.add(base);
    const ring = new THREE.Mesh(UC, tubeMat(0xffc83d)); ring.scale.set(4.34, 0.03, 4.34); ring.position.y = 0.17; g.add(ring);
    // hydraulic posts under the platform edge
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; bx(g, 0.34, M.LIFT_Y, 0.34, std(0x8c979e, 0.35, 0.7), Math.cos(a) * 3.1, M.LIFT_Y / 2 + 0.1, Math.sin(a) * 3.1); }
    const disc = new THREE.Group(); disc.position.y = M.LIFT_Y; g.add(disc); g.userData.disc = disc;
    const top = new THREE.Mesh(UC, std(0x3b4248, 0.55, 0.35)); top.scale.set(3.9, 0.12, 3.9); top.position.y = -0.06; top.receiveShadow = true; disc.add(top);
    const edge = new THREE.Mesh(UC, tubeMat(0xffc83d)); edge.scale.set(3.94, 0.04, 3.94); edge.position.y = -0.02; disc.add(edge);
    const inner = new THREE.Mesh(UC, std(0x2b3035, 0.7, 0.2)); inner.scale.set(3.62, 0.02, 3.62); inner.position.y = 0.005; inner.receiveShadow = true; disc.add(inner);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; bx(disc, 0.12, 0.012, 0.5, tubeMat(i % 3 ? 0xf2f0e6 : 0xd6283e), Math.cos(a) * 3.4, 0.012, Math.sin(a) * 3.4).rotation.y = -a; }
    // corner light masts so the bay reads at night
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, px = Math.cos(a) * 5, pz = Math.sin(a) * 5; bx(g, 0.14, 2.6, 0.14, std(0x4a5359, 0.5, 0.4), px, 1.4, pz); bx(g, 0.34, 0.2, 0.34, tubeMat(0xfff0c0), px, 2.8, pz); }
    return g;
  };
})();
