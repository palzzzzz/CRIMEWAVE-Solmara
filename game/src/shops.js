// Walk-in shops (clothing boutique, gun store, minimarket), Roxy's repaint garage (clears wanted, upgrades, stores one
// personal vehicle) and the harbour fence (sell stolen cars). Shop / garage menus share one overlay.
(function () {
  const CW = window.CW, $ = (id) => document.getElementById(id);
  const X = (CW.shops = { list: [], menu: null, sel: 0, mine: null, mineRec: null, outfit: { ray: 0, luna: 0 }, T: 0 });
  const hs = () => CW.hud.state;
  const lamCache = {};
  const lam = (c) => lamCache[c] || (lamCache[c] = new THREE.MeshLambertMaterial({ color: c }));
  const bas = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  const SW = 13, SD = 11, WH = 3.4;

  function box(g, w, h, d, c, x, y, z, basic) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic ? bas(c) : lam(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
  function signTex(text, bg, fg, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 ' + Math.floor(h * 0.4) + 'px Impact, Arial Black, sans-serif'; x.fillText(text, w / 2, h / 2 + 3);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  const clerk = (scene, o) => { const m = CW.makePerson(Object.assign({ id: 'clerk', hair: 0x2a1c14, pants: 0x2a3036, shoes: 0x1a1a1a, female: false, shades: false }, o)); scene.add(m); return m; };

  // ---- shop catalogue -----------------------------------------------------------------------------------------------
  const OUTFITS = [
    { n: 'BOMBER ATARDECER', d: 'Chaqueta bomber coral', p: 180, col: 0xff6b4a, cap: 0 },
    { n: 'BLÁZER TURQUESA', d: 'Elegante, fresco y de aspecto caro', p: 260, col: 0x12a7a0, cap: 0 },
    { n: 'CORREDOR NOCTURNO', d: 'Chaqueta negra + gorra dorada', p: 320, col: 0x1f1f28, cap: 0xffc83d },
    { n: 'CAMISA FIESTERA', d: 'Floral rosa + gorra blanca', p: 140, col: 0xff7fb0, cap: 0xf6f1e6 },
  ];
  function applyOutfit(e, idx) {
    const u = e.model.userData; if (u.outfit) { u.outfit.parent.remove(u.outfit); u.outfit = null; }
    X.outfit[e.id] = idx; if (!idx) return;
    const o = OUTFITS[idx - 1], g = new THREE.Group(), tw = e.def.female ? 0.42 : 0.5;
    box(g, tw + 0.05, 0.5, 0.31, o.col, 0, 1.25, 0); box(g, tw + 0.05, 0.08, 0.31, 0xf5f1e6, 0, 0.98, 0);
    [u.armL, u.armR].forEach((a) => box(a.sh, 0.17, 0.3, 0.18, o.col, 0, -0.14, 0));
    if (o.cap) { box(g, 0.3, 0.1, 0.32, o.cap, 0, 1.97, 0); box(g, 0.26, 0.04, 0.16, o.cap, 0, 1.93, 0.2); }
    u.body.add(g); u.outfit = g;
  }
  X.applyAll = function () { ['ray', 'luna'].forEach((id) => applyOutfit(CW.player.crew[id], X.outfit[id] || 0)); };

  const give = (id) => { const W = CW.weapons; W.give(id); CW.sfx.play('pickup', 0.8); return true; };
  const SHOPS = {
    boutique: { title: 'BOUTIQUE SOL Y COSTURA', sub: 'ROPA  ·  CAMBIA EL LOOK DEL PERSONAJE ACTIVO', bg: '#e8456f', fg: '#fff3d0', name: 'SOL Y COSTURA',
      items: () => [{ n: 'LOOK ORIGINAL', d: 'Vuelve al atuendo de siempre', p: 0, f() { applyOutfit(CW.player.active, 0); return true; } }].concat(OUTFITS.map((o, i) => ({ n: o.n, d: o.d, p: o.p, own: X.outfit[CW.player.active.id] === i + 1, f() { if (X.outfit[CW.player.active.id] === i + 1) { CW.hud.toast('YA LO LLEVAS PUESTO'); return false; } applyOutfit(CW.player.active, i + 1); return true; } }))) },
    gun: { title: 'CAÑÓN Y BALA', sub: 'ARMAS  ·  LA REP DESBLOQUEA LAS GRANDES', bg: '#1c2f3a', fg: '#ffcf5a', name: 'CAÑÓN Y BALA',
      items: () => { const W = CW.weapons; return [
        { n: 'MUNICIÓN DE PISTOLA  +36', d: 'Nueve milímetros, balas sueltas', p: 120, f() { W.give('pistol', 36); CW.sfx.play('pickup', 0.8); return true; } },
        { n: 'SUBFUSIL', d: 'Automático de 30 tiros', p: 1200, rep: 2, own: W.own.smg, f() { return give('smg'); } },
        { n: 'ESCOPETA', d: 'De corredera, 9 perdigones', p: 1800, rep: 3, own: W.own.shotgun, f() { return give('shotgun'); } },
        { n: 'MOLOTOV  x3', d: 'Bombas de gasolina', p: 300, rep: 2, f() { W.give('molotov', 3); CW.sfx.play('pickup', 0.8); return true; } },
        { n: 'REPONER TODA LA MUNICIÓN', d: 'Rellena todas tus armas', p: 350, f() { W.refill(); CW.sfx.play('pickup', 0.8); return true; } },
        { n: 'CHALECO ANTIBALAS', d: 'Chaleco completo', p: 450, f() { if (hs().armour >= 100) { CW.hud.toast('LA ARMADURA YA ESTÁ LLENA'); return false; } hs().armour = 100; CW.sfx.play('pickup', 0.8); return true; } }]; } },
    mart: { title: 'MINI EXPRESS', sub: 'COMIDA, BEBIDA Y MALAS DECISIONES  ·  ABIERTO LAS 24 HORAS', bg: '#12a7a0', fg: '#fff3d0', name: 'MINI EXPRESS',
      items: () => [
        { n: 'HAMBURGUESA', d: '+40 de salud', p: 40, f() { if (hs().hp >= 100) { CW.hud.toast('LA SALUD YA ESTÁ LLENA'); return false; } hs().hp = Math.min(100, hs().hp + 40); return true; } },
        { n: 'GASEOSA', d: 'Recupera la resistencia', p: 20, f() { CW.player.stamina = 100; CW.player.winded = false; return true; } },
        { n: 'BOTIQUÍN', d: 'Salud completa', p: 150, f() { if (hs().hp >= 100) { CW.hud.toast('LA SALUD YA ESTÁ LLENA'); return false; } hs().hp = 100; return true; } },
        { n: 'RASPADITA', d: 'Una de cada cuatro gana hasta $400', p: 25, f() { if (Math.random() < 0.25) { const w = 100 + Math.floor(Math.random() * 4) * 100; hs().cash += w; CW.hud.toast('¡GANASTE!  +$' + w); } else CW.hud.toast('NO HUBO PREMIO'); return true; } }] },
  };

  // ---- building the three shops ---------------------------------------------------------------------------------------------
  function freeRect(x0, x1, z0, z1) {
    let ok = true; CW.world.forNear((x0 + x1) / 2, (z0 + z1) / 2, 12, (o) => {
      if (!ok) return; if (o.t === 0) { if (o.x1 > x0 && o.x0 < x1 && o.z1 > z0 && o.z0 < z1) ok = false; } else if (o.x + o.r > x0 && o.x - o.r < x1 && o.z + o.r > z0 && o.z - o.r < z1) ok = false;
    }); return ok;
  }
  function buildShop(scene, kind, cx, cz) {
    const def = SHOPS[kind], g = new THREE.Group(); g.position.set(cx, 0, cz); scene.add(g);
    const wallC = kind === 'boutique' ? 0xffc8dd : kind === 'gun' ? 0x6e7a82 : 0xcfeee8, trim = kind === 'boutique' ? 0xe8456f : kind === 'gun' ? 0x1c2f3a : 0x12a7a0;
    const hw = SW / 2, hd = SD / 2, t = 0.4;
    box(g, SW, 0.1, SD, kind === 'gun' ? 0x58626a : 0xf1e4c3, 0, 0.06, 0);
    box(g, SW + 1.4, 0.06, SD + 1.4, 0xd8cfb8, 0, 0.03, 0);
    // walls (back, north, south, front split around a 4.2 m doorway) + colliders
    const walls = [];
    const wall = (w, d, x, z) => { walls.push(box(g, w, WH, d, wallC, x, WH / 2, z)); CW.world.addBox(cx + x - w / 2, cx + x + w / 2, cz + z - d / 2, cz + z + d / 2, WH); };
    wall(t, SD, hw - t / 2, 0); wall(SW, t, 0, -hd + t / 2); wall(SW, t, 0, hd - t / 2);
    const seg = hd - 2.1; wall(t, seg, -hw + t / 2, -(2.1 + seg / 2)); wall(t, seg, -hw + t / 2, 2.1 + seg / 2);
    const lintel = box(g, t, 0.8, 4.2, wallC, -hw + t / 2, WH - 0.4, 0);   // lintel over the doorway; the shop is open-top so the camera can look in
    // roof edge strips so it reads as a roofline
    box(g, SW + 0.5, 0.3, 0.3, trim, 0, WH + 0.3, -hd); box(g, SW + 0.5, 0.3, 0.3, trim, 0, WH + 0.3, hd); box(g, 0.3, 0.3, SD, trim, hw, WH + 0.3, 0); box(g, 0.3, 0.3, SD, trim, -hw, WH + 0.3, 0);
    // sign + awning
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: signTex(def.name, def.bg, def.fg, 512, 128), side: THREE.DoubleSide, fog: false }));
    sign.rotation.y = -Math.PI / 2; sign.position.set(-hw - 0.4, WH + 1.9, 0); g.add(sign);
    [-3.6, 3.6].forEach((z) => box(g, 0.2, 1.4, 0.2, 0x2a2f33, -hw - 0.4, WH + 0.7, z));
    for (let i = 0; i < 9; i++) box(g, 1.7, 0.1, 0.92, i % 2 ? 0xfff3d0 : trim, -hw - 0.95, WH - 0.35 - 0, -4 + i * 0.92 + 0.0).rotation.z = -0.35;
    box(g, 0.08, 1.2, 0.5, 0xfff09a, -hw - 0.03, 2.2, -3.2, true); box(g, 0.06, 0.28, 1.5, 0xff4a8a, -hw - 0.06, 2.2, 3.2, true);   // OPEN neon
    // interior
    const clerkSkin = [0xd9a070, 0xb9805a, 0x8d5a3b][kind.length % 3];
    box(g, 1.2, 1.05, 5.4, 0x6a4a32, hw - 3.4, 0.55, 0); box(g, 1.3, 0.08, 5.5, 0xf1e4c3, hw - 3.4, 1.1, 0);
    CW.world.addBox(cx + hw - 4.0, cx + hw - 2.8, cz - 2.7, cz + 2.7, 1.1);
    const c = clerk(scene, { skin: clerkSkin, shirt: trim, female: kind === 'boutique', hair: kind === 'boutique' ? 0x7a3a2a : 0x1a1210 }); c.position.set(cx + hw - 1.9, 0, cz); c.rotation.y = -Math.PI / 2; c.userData.clerk = true; X.clerks.push(c);
    box(g, 0.1, 2, 4, 0x2a3036, hw - 0.6, 1.6, 0, true);
    const k0 = g.children.length;
    if (kind === 'boutique') {
      [-3.5, -0.5, 2.5].forEach((z, i) => { box(g, 0.1, 1.5, 0.1, 0xbfc5c8, -2.5, 0.8, z); box(g, 0.1, 1.5, 0.1, 0xbfc5c8, -2.5, 0.8, z + 1.4); box(g, 0.08, 0.08, 1.5, 0xbfc5c8, -2.5, 1.5, z + 0.7); for (let k = 0; k < 5; k++) box(g, 0.12, 0.8, 0.22, [0xff6b4a, 0x12a7a0, 0xffc83d, 0xe8456f, 0xf6f1e6][(i + k) % 5], -2.5, 1.0, z + 0.15 + k * 0.28); CW.world.addBox(cx - 2.7, cx - 2.3, cz + z - 0.1, cz + z + 1.5, 1.5); });
      [-1.2, 1.2].forEach((z, i) => { box(g, 0.3, 0.12, 0.3, 0x2a2f33, 1.5, 0.1, z); box(g, 0.34, 1.15, 0.22, i ? 0x12a7a0 : 0xe8456f, 1.5, 0.75, z); box(g, 0.2, 0.2, 0.2, 0xe9d3b8, 1.5, 1.45, z); });
      box(g, 0.06, 2.1, 2.2, 0x9fd8e8, hw - 0.7 - 0.0, 1.4, -3.6, true);
    } else if (kind === 'gun') {
      for (let k = 0; k < 6; k++) { box(g, 0.1, 0.12, 0.9, 0x2a2f33, hw - 0.75, 2.1 + (k % 2) * 0.6, -4.2 + k * 1.2, true); box(g, 0.1, 0.35, 0.16, 0x2a2f33, hw - 0.75, 1.9 + (k % 2) * 0.6, -4.0 + k * 1.2, true); }
      [[-3, -3.5], [-3, 3.2], [-0.5, -4]].forEach(([x, z]) => { box(g, 1.2, 0.9, 0.9, 0x5a6a3a, x, 0.5, z); CW.world.addBox(cx + x - 0.6, cx + x + 0.6, cz + z - 0.45, cz + z + 0.45, 0.9); });
      box(g, 1.4, 0.08, 1.4, 0xd6283e, -3.5, 0.12, 0, false);
    } else {
      [-3, 0, 3].forEach((z) => { box(g, 0.8, 1.8, 2.2, 0xe8e0cf, -2.5, 0.95, z - 0.2); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) box(g, 0.5, 0.22, 0.4, [0xff6b4a, 0x12a7a0, 0xffc83d, 0xe8456f][(r + k) % 4], -2.5, 0.4 + r * 0.42, z - 0.9 + k * 0.5); CW.world.addBox(cx - 2.95, cx - 2.05, cz + z - 1.3, cz + z + 0.9, 1.8); });
      box(g, 0.9, 2.0, 2.6, 0x9fe6f0, 4.8, 1.05, -3.6, false);
    }
    const k1 = g.children.length;
    // ceiling lamp strips (lit interior look at night too)
    box(g, 0.14, 0.1, 6, 0xfff3c0, hw - 0.5, WH - 0.5, 0, true);   // warm light bar over the counter wall
    const ip = { x: cx + hw - 5.0, z: cz };
    const shop = { kind, def, cx, cz, ip, door: { x: cx - hw, z: cz }, group: g, sign, walls, lintel, props: g.children.slice(k0, k1), clerk: c }; X.list.push(shop); return shop;
  }

  X.inside = (x, z) => X.list.some((s) => Math.abs(x - s.cx) < SW / 2 && Math.abs(z - s.cz) < SD / 2);
  X.init = function (scene) {
    X.clerks = []; X.T = 0;
    // find free sand beside the beachfront boulevard
    const zs = []; for (let z = -190; z <= 190; z += 6) zs.push(z); zs.sort((a, b) => Math.abs(a - 18) - Math.abs(b - 18));
    const kinds = ['boutique', 'gun', 'mart'], placed = [];
    for (const z of zs) {
      if (placed.length >= 3) break;
      if (placed.some((p) => Math.abs(p - z) < 34)) continue;
      for (const cx of [262, 266]) if (freeRect(cx - SW / 2 - 4, cx + SW / 2 + 2, z - SD / 2 - 2, z + SD / 2 + 2) && cx + SW / 2 < 286) { buildShop(scene, kinds[placed.length], cx, z); placed.push(z); break; }
    }
    // the stored personal vehicle (if any) is recreated in the garage yard
    X.garageSlot = () => { const l = CW.world.landmarks.garage; return { x: l.x - 16, z: l.z + 8 }; };
    // the mod bay's lift / turntable stands on the garage yard spot the G prompt already uses
    const gz = gZone(); X.lift = CW.carmods.buildLift(scene, gz.x, gz.z);
  };

  // ---- car-mod bay: the car moves onto the lift while the garage menu is open, then goes back where it was ---------------------
  const CM = () => CW.carmods;
  function enterBay(car) {
    const L = gZone();
    X.bay = { car, x: car.x, z: car.z, h: car.h, spin: car.h, last: performance.now(), vy: 0 };
    car.x = L.x; car.z = L.z; car.vx = car.vz = 0; car.speed = 0;
    if (!car.mods) car.mods = CM().blank();
    $('modbay').style.display = 'block'; $('shopui').classList.add('bay'); $('hud').style.visibility = 'hidden'; renderMods();
  }
  function leaveBay() {
    const b = X.bay; if (!b) return; X.bay = null;
    const car = b.car; car.liftY = 0; car.x = b.x; car.z = b.z; car.h = b.h; car.vx = car.vz = 0; car.speed = 0;
    car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.h;
    $('modbay').style.display = 'none'; $('shopui').classList.remove('bay'); $('hud').style.visibility = '';    CW.cam.cd = undefined; CW.cam.carYaw = car.h;
  }
  function modRows(car) {
    const M = CM(), mods = car.mods, bike = car.type.id === 'bike', pi = M.paintIndex(car);
    return [
      { key: 'paint', label: 'PINTURA', cur: pi >= 0 ? M.PAINT[pi].n : 'PERSONALIZADO', price: M.PRICE.paint, opts: M.PAINT.map((p, i) => ({ sw: p.c, on: i === pi, t: p.n, f: () => (i === pi ? null : () => M.setPaint(car, p.c)) })) },
      { key: 'spoiler', label: 'ALERÓN', cur: M.SPOILER[mods.sp], price: M.PRICE.spoiler, na: bike, opts: M.SPOILER.map((n, i) => ({ bt: n, on: i === mods.sp, t: n, f: () => (i === mods.sp ? null : () => { mods.sp = i; M.refresh(car); }) })) },
      { key: 'neon', label: 'NEÓN BAJO EL AUTO', cur: M.NEON[mods.ne].n, price: M.PRICE.neon, opts: M.NEON.map((n, i) => ({ sw: n.c, off: !n.c, on: i === mods.ne, t: n.n, f: () => (i === mods.ne ? null : () => { mods.ne = i; M.refresh(car); }) })) },
      { key: 'wheel', label: 'LLANTAS', cur: M.WHEEL[mods.wh], price: M.PRICE.wheel, na: bike, opts: M.WHEEL.map((n, i) => ({ bt: n, on: i === mods.wh, t: n, f: () => (i === mods.wh ? null : () => { mods.wh = i; M.refresh(car); }) })) },
    ];
  }
  const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
  function renderMods() {
    const b = X.bay; if (!b) return; const rows = modRows(b.car); X.modRows = rows;
    $('mb-rows').innerHTML = rows.map((r, ri) => '<div class="mrow' + (r.na ? ' na' : '') + '"><div class="ml"><span>' + r.label + '  <i>' + r.cur + '</i></span><b>' + (r.na ? 'N/D' : '$' + r.price) + '</b></div><div class="opts">' + r.opts.map((o, oi) =>
      o.sw !== undefined ? '<div class="sw' + (o.off ? ' off' : '') + (o.on ? ' on' : '') + '" title="' + o.t + '" data-r="' + ri + '" data-o="' + oi + '"' + (o.off ? '' : ' style="background:' + hex(o.sw) + (r.key === 'neon' ? ';box-shadow:0 0 10px ' + hex(o.sw) + ',inset 0 -5px 8px rgba(0,0,0,.25)' : '') + '"') + '></div>'
        : '<div class="bt' + (o.on ? ' on' : '') + '" data-r="' + ri + '" data-o="' + oi + '">' + o.t + '</div>').join('') + '</div></div>').join('');
    Array.from($('mb-rows').querySelectorAll('[data-r]')).forEach((el) => el.addEventListener('click', () => applyMod(+el.dataset.r, +el.dataset.o)));
  }
  function applyMod(ri, oi) {
    const b = X.bay; if (!b) return; const row = modRows(b.car)[ri], o = row && row.opts[oi]; if (!o || row.na) return;
    const go = o.f(); if (!go) return;
    const free = oi === 0 && row.key !== 'paint', st = hs(), price = free ? 0 : row.price;
    if (st.cash < price) { CW.hud.toast('NO ALCANZA EL EFECTIVO'); CW.sfx.play('click', 0.5); return; }
    go(); st.cash -= price; CW.sfx.play('pickup', 0.9); CW.hud.toast(row.label + '  ' + o.t + (price ? '  -$' + price : '')); renderMods(); $('shop-cash').textContent = '$' + st.cash.toLocaleString('en-US');
  }
  function cycleMod(ri) {
    const b = X.bay; if (!b) return; const row = modRows(b.car)[ri]; if (!row || row.na) return;
    const cur = row.opts.findIndex((o) => o.on); applyMod(ri, (cur + 1) % row.opts.length);
  }
  // per-frame: the platform turns on real time (the world is near-frozen while a menu is open), the camera orbits the lift
  function bayFrame() {
    const b = X.bay, car = b.car, L = gZone(), M = CM(), now = performance.now(), rdt = Math.min(0.05, (now - b.last) / 1000); b.last = now;
    b.spin += rdt * 0.5; car.h = b.spin; car.x = L.x; car.z = L.z; car.vx = car.vz = 0; car.speed = 0; car.awake = true;
    car.liftY = CW.damp(car.liftY || 0, M.LIFT_Y, 6, rdt);
    car.mesh.position.set(L.x, car.liftY, L.z); car.mesh.rotation.set(0, car.h, 0);
    X.lift.userData.disc.rotation.y = car.h;
    const c = CW.camera, R = Math.max(10.5, car.type.l * 2.6);
    c.position.set(L.x + R * 0.42, 3.9, L.z - R * 0.9); c.fov = 40; c.updateProjectionMatrix();
    c.lookAt(L.x, M.LIFT_Y + 0.75, L.z);
  }

  // ---- UI overlay -------------------------------------------------------------------------------------------------------------------------
  let items = [];
  function openMenu(kind, title, sub, list) {
    X.menu = { kind }; items = list; X.sel = 0; if (document.exitPointerLock) document.exitPointerLock();
    $('shop-foot').textContent = kind === 'garage' ? 'PRESIONA UN NÚMERO O HAZ CLIC  ·  G / ESC PARA SALIR' : 'PRESIONA UN NÚMERO O HAZ CLIC  ·  E / ESC PARA SALIR';
    $('shop-title').textContent = title; $('shop-sub').textContent = sub; $('shopui').style.display = 'block'; renderMenu();
    if (kind === 'garage' && CW.player.car) enterBay(CW.player.car);
  }
  function closeMenu() { X.menu = null; leaveBay(); $('shopui').style.display = 'none'; }
  X.close = closeMenu;
  function renderMenu() {
    const st = hs(); $('shop-cash').textContent = '$' + st.cash.toLocaleString('en-US');
    $('shop-list').innerHTML = items.map((it, i) => { const lock = it.rep && st.rep < it.rep; return '<div class="it ' + (lock ? 'lock' : '') + (it.own ? ' own' : '') + '" data-i="' + i + '"><span class="k">' + (i + 1) + '</span><span class="n">' + it.n + '<small>' + (it.d || '') + '</small></span><span class="p">' + (lock ? 'REQUIERE REP ' + it.rep : it.own ? 'LO TIENES' : it.p === 0 ? 'GRATIS' : '$' + it.p.toLocaleString('en-US')) + '</span></div>'; }).join('');
    Array.from($('shop-list').children).forEach((el) => el.addEventListener('click', () => buy(+el.dataset.i)));
  }
  function buy(i) {
    const it = items[i], st = hs(); if (!it) return;
    if (it.rep && st.rep < it.rep) { CW.hud.toast('REQUIERE NIVEL DE REP ' + it.rep); CW.sfx.play('click', 0.5); return; }
    if (it.p > 0 && st.cash < it.p) { CW.hud.toast('NO ALCANZA EL EFECTIVO'); CW.sfx.play('click', 0.5); return; }
    if (it.f()) { st.cash -= it.p; if (it.p) CW.hud.toast('COMPRADO  ' + it.n); }
    if (X.menu && X.menu.kind === 'garage') { items = garageItems(); }
    else if (X.menu) { items = SHOPS[X.menu.kind].items(); }
    renderMenu();
  }

  // ---- garage + fence ------------------------------------------------------------------------------------------------------------------------
  const gZone = () => { const l = CW.world.landmarks.garage; return { x: l.x, z: l.z + 7 }; };
  const fZone = () => { const l = CW.world.landmarks.fence; return { x: l.x, z: l.z + 7 }; };
  const VALUE = { sports: 1500, sedan: 700, hatch: 450, suv: 950, taxi: 520, van: 640, pickup: 700, bike: 520 };
  const salePrice = (c) => Math.round((VALUE[c.type.id] || 600) * (0.35 + 0.65 * c.hp / 100) / 10) * 10;
  function ejectPlayer() {
    const P = CW.player, e = P.active, V = CW.vehicles, car = P.car; if (!car) return;
    const p = V.exit(); e.model.visible = true; e.x = p.x; e.z = p.z; e.vx = e.vz = 0; e.h = car.h; e.model.userData.setPose('none'); e.model.rotation.set(0, car.h, 0); e.model.position.set(e.x, 0, e.z);
    CW.cam.yaw = car.h + Math.PI; CW.cam.cd = undefined; CW.cam.pitch = 0.3; P.mode = 'foot'; P.car = null;
  }
  const PAINT = [0xff5a3c, 0xffc23a, 0x2fd0c4, 0xe0407a, 0x4f6fb5, 0xf2f0e6, 0x5f8f6d, 0x8b3f58, 0x2c2f33];
  function repaint(car) { let c; do { c = PAINT[Math.floor(Math.random() * PAINT.length)]; } while (c === car.color); CW.carmods.setPaint(car, c); renderMods(); }
  function garageItems() {
    const car = CW.player.car, W = CW.police, S = CW.story; if (!car) return [];
    const free = S.free && S.st === 1, price = 200 + W.level * 150;
    return [
      { n: free ? 'REPINTAR  (INVITA LA CASA)' : 'REPINTAR + PLACAS NUEVAS', d: W.level > 0 ? 'Borra tu búsqueda (' + W.level + (W.level > 1 ? ' estrellas' : ' estrella') + ')' : 'Color nuevo, borrón y cuenta nueva', p: free ? 0 : price,
        f() { repaint(car); if (W.level > 0) { W.clear(false); } CW.hud.toast('PINTURA NUEVA'); if (S.state === 'active' && S.free && S.st === 1) S.st = 2; CW.sfx.play('pickup', 1); return true; } },
      { n: 'AFINACIÓN DEL MOTOR  NV ' + lv(car.eng, 1.12) + '/3', d: '+12% de velocidad máxima y aceleración por nivel', p: 900 * (1 + lv(car.eng, 1.12)), rep: 2 + lv(car.eng, 1.12), own: lv(car.eng, 1.12) >= 3, f() { if (lv(car.eng, 1.12) >= 3) { CW.hud.toast('MOTOR AL MÁXIMO'); return false; } car.eng = (car.eng || 1) * 1.12; return true; } },
      { n: 'PANELES BLINDADOS  NV ' + lv(car.arm, 1 / 1.25) + '/3', d: '20% menos de daño por choques y balas por nivel', p: 800 * (1 + lv(car.arm, 1 / 1.25)), rep: 2 + lv(car.arm, 1 / 1.25), own: lv(car.arm, 1 / 1.25) >= 3, f() { if (lv(car.arm, 1 / 1.25) >= 3) { CW.hud.toast('PANELES AL MÁXIMO'); return false; } car.arm = (car.arm || 1) * 0.8; return true; } },
      { n: car.mine ? 'ESTE ES TU VEHÍCULO PERSONAL' : 'GUARDAR COMO MI VEHÍCULO PERSONAL', d: 'Estacionado a salvo en el patio para siempre (reemplaza al anterior)', p: 0, own: car.mine, f() { if (car.mine) return false; storeCar(car); closeMenu(); return false; } },
    ];
  }
  function lv(v, step) { if (!v) return 0; return Math.round(Math.log(v) / Math.log(step)); }
  function storeCar(car) {
    const V = CW.vehicles; leaveBay(); if (X.mine && X.mine !== car) { X.mine.mine = false; X.mine.owned = false; X.mine.hidden = true; }
    ejectPlayer(); const s = X.garageSlot(); car.x = s.x; car.z = s.z; car.h = 0; car.vx = car.vz = 0; car.awake = false; car.owned = true; car.mine = true; car.stolen = false; car.hp = Math.max(car.hp, 60); X.mine = car; void V;
    CW.hud.toast('VEHÍCULO GUARDADO  ·  TE ESPERA EN EL PATIO'); CW.sfx.play('pickup', 1);
  }
  function sell(car) {
    const price = salePrice(car), st = hs(); st.cash += price; ejectPlayer(); car.hidden = true; car.mesh.visible = false; car.stolen = false; car.x = -999; car.z = -999; car.awake = false;
    CW.hud.toast('EL RECEPTADOR PAGÓ  $' + price.toLocaleString('en-US')); CW.sfx.play('pickup', 1); CW.story.addRep(8, 'ENTREGA');
    if (CW.story.state === 'active' && CW.story.idx === 1) CW.story.count++;
    if (CW.solfeed) CW.solfeed.news('Otro ' + car.type.name + ' se esfumó de las calles. La chatarrería del puerto tiene trabajo esta noche.');
  }

  X.save = function () { const m = X.mine; return { outfit: X.outfit, mine: m && !m.hidden ? { t: m.type.id, c: m.color, e: m.eng || 1, a: m.arm || 1, hp: m.hp } : null }; };
  X.load = function (s) {
    X.outfit = (s && s.outfit) || { ray: 0, luna: 0 };
    if (X.mine) { X.mine.hidden = true; X.mine.mine = false; X.mine.owned = false; X.mine = null; }
    if (s && s.mine) { const m = s.mine, sl = X.garageSlot(), car = CW.vehicles.add(m.t, m.c, sl.x, sl.z, 0); car.eng = m.e; car.arm = m.a; car.hp = m.hp; car.owned = true; car.mine = true; X.mine = car; }
    X.applyAll();
  };
  X.newGame = function () { X.outfit = { ray: 0, luna: 0 }; X.load(null); closeMenu(); };

  // ---- per-frame ------------------------------------------------------------------------------------------------------------------------------
  X.update = function (dt) {
    const P = CW.player, I = CW.input, f = CW.player.focus(); X.T += dt;
    X.clerks.forEach((c) => c.userData.update(dt, 0));
    if (X.menu) {
      if (I.pressed('Escape') || I.pressed('KeyG') || (X.menu.kind !== 'garage' && I.pressed('KeyE'))) { closeMenu(); return; }
      if (X.menu.kind === 'garage' && P.mode !== 'car') { closeMenu(); return; }
      if (X.bay) { ['KeyZ', 'KeyX', 'KeyC', 'KeyV'].forEach((k, i) => { if (I.pressed(k)) cycleMod(i); }); bayFrame(); }
      for (let i = 0; i < 9; i++) if (I.pressed('Digit' + (i + 1))) buy(i);
      if (I.pressed('ArrowDown')) X.sel = Math.min(items.length - 1, X.sel + 1); if (I.pressed('ArrowUp')) X.sel = Math.max(0, X.sel - 1);
      if (I.pressed('Enter')) buy(X.sel);
      Array.from($('shop-list').children).forEach((el, i) => { el.style.background = i === X.sel ? 'rgba(255,200,61,.14)' : ''; });
      return;
    }
    if (CW.police.ended || CW.solfeed.open) return;
    let prompt = null;
    if (P.mode === 'foot') {
      const sh = X.list.find((s) => Math.hypot(f.x - s.ip.x, f.z - s.ip.z) < 3.2 && Math.abs(f.x - s.cx) < SW / 2);
      if (sh && !P.prompt) { prompt = 'E  ' + SHOPS[sh.kind].title; if (I.pressed('KeyE')) { openMenu(sh.kind, SHOPS[sh.kind].title, SHOPS[sh.kind].sub, SHOPS[sh.kind].items()); return; } }
    } else if (P.mode === 'car' && P.car) {
      const car = P.car, g = gZone(), fz = fZone();
      if (Math.hypot(car.x - g.x, car.z - g.z) < 10 && car.speed < 5 && !car.cop) { prompt = 'G  GARAJE DE ROXY'; if (I.pressed('KeyG') || X.stageOpen) { X.stageOpen = false; openMenu('garage', 'PINTURA ROXY', 'REPINTAR BORRA TUS ESTRELLAS  ·  MEJORAS  ·  GUARDA UN VEHÍCULO PERSONAL', garageItems()); return; } }
      else if (Math.hypot(car.x - fz.x, car.z - fz.z) < 11 && car.speed < 6 && car.stolen && !car.owned && !car.cop) {
        if (CW.police.level > 0) prompt = 'RECEPTADOR: ESTÁ MUY CALIENTE, DESPISTA A LA POLICÍA PRIMERO'; else { prompt = 'G  VENDER AUTO ROBADO  $' + salePrice(car).toLocaleString('en-US'); if (I.pressed('KeyG')) sell(car); }
      }
      else if (Math.hypot(car.x - fz.x, car.z - fz.z) < 11 && car.speed < 6 && car.owned) prompt = 'RECEPTADOR: ESTE ES TUYO, NO SE VENDE';
    }
    if (prompt) P.prompt = prompt;
  };

  // (the minimap draws the shop icons from X.list in hud.js)
})();
