// Staging only (?capture=robbery): dresses one of the EXISTING shops as a joyería (sign, glass display cases with emissive diamonds, one smashed,
// a bag of diamonds on the counter) and poses existing person models as hostages (transforms only). Nothing here runs in normal play.
(function () {
  const CW = window.CW;
  const S = (CW.stage = {});

  const stdMat = {};
  const gem = (col) => stdMat[col] || (stdMat[col] = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.5, metalness: 0.3, roughness: 0.08, flatShading: true }));
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, depthWrite: false, emissive: 0x2a5a78 });
  const GEMS = [0xffffff, 0x8ff4ff, 0xff9ae8, 0xfff0a0, 0xc9a4ff];

  function diamond(parent, col, size, x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), gem(col)); m.scale.y = 1.35; m.position.set(x, y, z); m.rotation.set(0.2 * Math.sin(x * 9), ry || 0, 0.25 * Math.cos(z * 7)); parent.add(m);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: CW.glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, fog: false }));
    gl.scale.setScalar(size * 4.5); gl.position.set(x, y + size * 0.4, z); parent.add(gl); return m;
  }
  const box = (g, w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };

  // a glass display case; broken = no top pane, shards on the floor, stones spilled across the sill
  function caseAt(g, u, v, broken) {
    const c = new THREE.Group(); c.position.set(u, 0, v); g.add(c);
    box(c, 2.5, 0.85, 1.0, 0x2a1b34, 0, 0.425, 0); box(c, 2.6, 0.06, 1.1, 0xffd27a, 0, 0.88, 0);       // plinth + gold rim
    box(c, 2.3, 0.04, 0.8, 0x0d0716, 0, 0.93, 0);                                                         // velvet-black tray
    const gemsN = broken ? 5 : 12;
    for (let i = 0; i < gemsN; i++) { const col = GEMS[(i * 2 + u) % GEMS.length | 0] || GEMS[i % GEMS.length]; diamond(c, GEMS[i % GEMS.length], 0.1 + (i % 3) * 0.035, -1.0 + (i % 6) * 0.4 + (i % 2) * 0.08, 1.04, -0.22 + (i % 2) * 0.4 - (i > 5 ? 0.0 : 0.05), i); void col; }
    if (!broken) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.9), glassMat); top.position.set(0, 1.18, 0); c.add(top);
      [[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]].forEach(([x, z]) => box(c, 0.05, 0.5, 0.05, 0xffd27a, x, 1.18, z));
      box(c, 2.4, 0.04, 0.9, 0xffd27a, 0, 1.44, 0).visible = false;
    } else {
      // jagged glass left in the frame + shards on the floor + stones that spilled
      [[-1.2, -0.45], [1.2, -0.45], [-1.2, 0.45], [1.2, 0.45]].forEach(([x, z]) => box(c, 0.05, 0.5, 0.05, 0xffd27a, x, 1.18, z));
      for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 3), glassMat); t.position.set(-1.0 + i * 0.66, 1.12, 0.45); t.rotation.set(0, 0, (i % 2 ? 0.2 : -0.2)); c.add(t); }
      for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.06 + (i % 4) * 0.025, 0), new THREE.MeshLambertMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.6, emissive: 0x5a9ab8 })); s.position.set(-1.5 + (i * 0.37) % 3.0, 0.03 + (i % 3) * 0.01, 0.7 + ((i * 53) % 10) * 0.07); s.rotation.set(i, i * 2, i * 3); c.add(s); }
      [[0.9, 0.04, 0.85, 0], [1.2, 0.04, 1.05, 2], [0.5, 0.04, 1.2, 3], [-1.4, 0.04, 0.9, 1]].forEach(([x, y, z, k]) => diamond(c, GEMS[k], 0.11, x, y + 0.12, z, k));
    }
    return c;
  }

  // transform-only poses on an existing person model
  function handsUp(p, spread) {
    const u = p.userData, s = spread === undefined ? 0.28 : spread;
    u.armL.sh.rotation.set(-Math.PI + 0.08, 0, s); u.armR.sh.rotation.set(-Math.PI + 0.08, 0, -s);
    u.armL.el.rotation.x = -0.18; u.armR.el.rotation.x = -0.18;
  }
  function kneel(p) {
    const u = p.userData; u.body.position.y = -0.52; u.body.rotation.x = 0.05;
    u.legL.rotation.x = 1.5; u.legR.rotation.x = 1.5;   // both lower legs fold back under the body
  }

  const FACING = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

  // shop: an entry of CW.shops.list ; returns { npcs, cash, bag, face(camX,camZ) }
  S.jewelry = function (shop, scene, flip) {
    const FV = flip ? -1 : 1;   // flip = camera on the south side: every v is mirrored
    const g = shop.group, cx = shop.cx, cz = shop.cz, W = (u, v) => ({ x: cx + u, z: cz + v });
    // sign: JOYERÍA in gold neon
    const tex = CW.makeSignTexture('JOYERÍA', 512, 128, { bg: '#10061e', fg: '#ffd27a', edge: '#ff3fd0', glow: true });
    shop.sign.material.map = tex; shop.sign.material.needsUpdate = true;
    // empty the boutique, open it up like a dollhouse towards the camera (north + east walls); the sign also hangs inside, readable from the shop floor
    const isg = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: tex, fog: false })); isg.position.set(-6.05, 3.0, 0); isg.rotation.y = Math.PI / 2; g.add(isg);
    shop.props.forEach((o) => { o.visible = false; });
    [shop.walls[0], shop.walls[flip ? 2 : 1]].forEach((o) => { if (o) o.visible = false; });
    // cases along the south wall
    caseAt(g, -4.1, 4.3 * -FV, false); caseAt(g, -0.6, 4.3 * -FV, true); caseAt(g, 2.9, 4.3 * -FV, false);
    // cases along the east side of the counter's end and a pair on the far wall
    // jewellery bag on the counter + loose stones (counter top is y 1.15, spans u 2.5..3.7, v -2.7..2.7)
    const bag = new THREE.Group(); bag.position.set(3.1, 1.17, 1.7 * FV); g.add(bag);
    box(bag, 0.95, 0.42, 0.55, 0x15151c, 0, 0.21, 0); box(bag, 0.97, 0.06, 0.57, 0xffd27a, 0, 0.43, 0);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 14, Math.PI), new THREE.MeshLambertMaterial({ color: 0x15151c })); strap.position.set(0, 0.45, 0); strap.rotation.y = Math.PI / 2; bag.add(strap);
    [[-0.25, 0.52, -0.05, 0], [0.05, 0.58, 0.08, 1], [0.28, 0.5, -0.1, 2], [-0.05, 0.62, -0.14, 3]].forEach(([x, y, z, k]) => diamond(bag, GEMS[k], 0.13, x, y, z, k));
    [[3.0, -0.6, 0], [3.3, -1.5, 1], [2.75, 0.2, 4], [3.2, -0.1, 2], [2.8, -1.1, 3]].forEach(([u, v, k]) => diamond(g, GEMS[k], 0.1, u, 1.3, v * FV, k));
    g.children.forEach((o) => { if (o.geometry && o.geometry.type === "BoxGeometry" && Math.abs(o.position.y - 3.7) < 0.01 && o.visible) o.visible = false; });   // roof-edge strips (the camera sits right at one)
    // darker marble floor + wood counter top so the stones and the cash pop instead of glaring
    const darken = (o, col) => { o.material = o.material.clone(); o.material.color.setHex(col); };
    darken(g.children[0], 0x2a2236); darken(g.children[1], 0x3a3045);
    g.children.forEach((o) => { if (o.material && o.material.color && o.material.color.getHex() === 0xf1e4c3 && o.geometry.type === "BoxGeometry" && o.geometry.parameters.height < 0.2 && o.geometry.parameters.width < 2) darken(o, 0x4a3326); });
    g.children.forEach((o) => { if (o.geometry && o.geometry.type === "BoxGeometry" && o.material && o.material.color && o.material.color.getHex() === 0x2a3036 && o.geometry.parameters.height === 2) o.visible = false; });   // dark back panel
    // lights inside (a warm shop light + a cold spill so the stones read)
    const warm = new THREE.PointLight(0xfff0d0, 0.8, 14, 1.6); warm.position.set(0.5, 3.2, 0.0); g.add(warm);
    const cold = new THREE.PointLight(0xc4dcff, 0.55, 22, 1.3); cold.position.set(6.0, 3.6, -5.0 * FV); g.add(cold);   // fill from the camera side so the hostages are lit from the front
    g.children.forEach((o) => { if (o.position && o.position.x < -6.2 && o.position.x > -8 && o.position.y > 2.2 && o.position.y < 4 && o.geometry && o.geometry.type === "BoxGeometry" && o !== shop.sign) o.visible = false; });   // awning + posts out of the way
    // the clerk (existing model): hands up, facing the street side
    const out = { shop, npcs: [], bag, W, warm, FV };
    const cl = shop.clerk; if (CW.shops.clerks) CW.shops.clerks = CW.shops.clerks.filter((q) => q !== cl);
    out.clerk = cl;
    // hostages: existing person model, transforms only
    const mk = (id, o) => { const p = CW.makePerson(Object.assign({ id, hair: 0x2a1c14, pants: 0x2a3036, shoes: 0x1a1a1a, female: false, shades: false }, o)); scene.add(p); out.npcs.push(p); return p; };
    out.cust = [
      { p: mk('c1', { skin: 0xd9a070, shirt: 0xe8456f, pants: 0x3b4a6b, female: true, hair: 0x7a3a2a }), u: 0.8, v: 1.1, kneel: false },
      { p: mk('c2', { skin: 0x8d5a3b, shirt: 0xf6f1e6, pants: 0x2a3036, hair: 0x120c08 }), u: -1.0, v: 3.0, kneel: false },
      { p: mk('c3', { skin: 0xb9805a, shirt: 0x12a7a0, pants: 0xefe3c8, female: true, hair: 0x1a1018 }), u: -0.1, v: 2.0, kneel: true },
    ];
    return out;
  };

  // aim every pose at the lens; called every staged frame
  S.pose = function (J, camX, camZ, rayPos) {
    const { cx, cz } = J.shop;
    J.cust.forEach((c) => {
      const x = cx + c.u, z = cz + c.v; c.p.position.set(x, 0, z); c.p.rotation.y = FACING(x, z, camX, camZ) + (c.kneel ? 0.1 : 0);
      c.p.visible = true; handsUp(c.p, 0.3); if (c.kneel) kneel(c.p);
    });
    const cl = J.clerk, cx0 = cl.position.x, cz0 = cl.position.z; cl.rotation.y = FACING(cx0, cz0, camX, camZ) * 0.5 + (-Math.PI / 2) * 0.5; cl.visible = true; handsUp(cl, 0.2);
    void rayPos;
  };
})();
