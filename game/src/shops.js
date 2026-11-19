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
    { n: 'SUNSET BOMBER', d: 'Coral bomber jacket', p: 180, col: 0xff6b4a, cap: 0 },
    { n: 'TEAL BLAZER', d: 'Sharp, cool, expensive-looking', p: 260, col: 0x12a7a0, cap: 0 },
    { n: 'NIGHT RUNNER', d: 'Black jacket + gold cap', p: 320, col: 0x1f1f28, cap: 0xffc83d },
    { n: 'PARTY SHIRT', d: 'Pink floral + white cap', p: 140, col: 0xff7fb0, cap: 0xf6f1e6 },
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
    boutique: { title: 'SOL & SEAM BOUTIQUE', sub: 'CLOTHING  ·  SWAP YOUR LOOK FOR THE ACTIVE CREW MEMBER', bg: '#e8456f', fg: '#fff3d0', name: 'SOL & SEAM',
      items: () => [{ n: 'FRESH LOOK: DEFAULT', d: 'Back to the original outfit', p: 0, f() { applyOutfit(CW.player.active, 0); return true; } }].concat(OUTFITS.map((o, i) => ({ n: o.n, d: o.d, p: o.p, own: X.outfit[CW.player.active.id] === i + 1, f() { if (X.outfit[CW.player.active.id] === i + 1) { CW.hud.toast('ALREADY WEARING IT'); return false; } applyOutfit(CW.player.active, i + 1); return true; } }))) },
    gun: { title: 'BARREL & BULLET', sub: 'WEAPONS  ·  REP UNLOCKS THE BIG GUNS', bg: '#1c2f3a', fg: '#ffcf5a', name: 'BARREL&BULLET',
      items: () => { const W = CW.weapons; return [
        { n: 'PISTOL AMMO  +36', d: 'Nine-mil, loose rounds', p: 120, f() { W.give('pistol', 36); CW.sfx.play('pickup', 0.8); return true; } },
        { n: 'SMG', d: '30 round full-auto', p: 1200, rep: 2, own: W.own.smg, f() { return give('smg'); } },
        { n: 'SHOTGUN', d: 'Pump action, 9 pellets', p: 1800, rep: 3, own: W.own.shotgun, f() { return give('shotgun'); } },
        { n: 'MOLOTOV  x3', d: 'Petrol bombs', p: 300, rep: 2, f() { W.give('molotov', 3); CW.sfx.play('pickup', 0.8); return true; } },
        { n: 'RESTOCK ALL AMMO', d: 'Top up every gun you own', p: 350, f() { W.refill(); CW.sfx.play('pickup', 0.8); return true; } },
        { n: 'BODY ARMOUR', d: 'Full vest', p: 450, f() { if (hs().armour >= 100) { CW.hud.toast('ARMOUR ALREADY FULL'); return false; } hs().armour = 100; CW.sfx.play('pickup', 0.8); return true; } }]; } },
    mart: { title: 'QUIK-MART', sub: 'FOOD, DRINK AND BAD DECISIONS  ·  OPEN 24 HOURS', bg: '#12a7a0', fg: '#fff3d0', name: 'QUIK-MART',
      items: () => [
        { n: 'BURGER', d: '+40 health', p: 40, f() { if (hs().hp >= 100) { CW.hud.toast('HEALTH ALREADY FULL'); return false; } hs().hp = Math.min(100, hs().hp + 40); return true; } },
        { n: 'FIZZY SODA', d: 'Refills stamina', p: 20, f() { CW.player.stamina = 100; CW.player.winded = false; return true; } },
        { n: 'FIRST-AID KIT', d: 'Full health', p: 150, f() { if (hs().hp >= 100) { CW.hud.toast('HEALTH ALREADY FULL'); return false; } hs().hp = 100; return true; } },
        { n: 'SCRATCH TICKET', d: 'One in four wins up to $400', p: 25, f() { if (Math.random() < 0.25) { const w = 100 + Math.floor(Math.random() * 4) * 100; hs().cash += w; CW.hud.toast('WINNER  +$' + w); } else CW.hud.toast('NOT A WINNER'); return true; } }] },
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
    const wall = (w, d, x, z) => { box(g, w, WH, d, wallC, x, WH / 2, z); CW.world.addBox(cx + x - w / 2, cx + x + w / 2, cz + z - d / 2, cz + z + d / 2, WH); };
    wall(t, SD, hw - t / 2, 0); wall(SW, t, 0, -hd + t / 2); wall(SW, t, 0, hd - t / 2);
    const seg = hd - 2.1; wall(t, seg, -hw + t / 2, -(2.1 + seg / 2)); wall(t, seg, -hw + t / 2, 2.1 + seg / 2);
    box(g, t, 0.8, 4.2, wallC, -hw + t / 2, WH - 0.4, 0);   // lintel over the doorway; the shop is open-top so the camera can look in
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
    // ceiling lamp strips (lit interior look at night too)
    box(g, 0.14, 0.1, 6, 0xfff3c0, hw - 0.5, WH - 0.5, 0, true);   // warm light bar over the counter wall
    const ip = { x: cx + hw - 5.0, z: cz };
    const shop = { kind, def, cx, cz, ip, door: { x: cx - hw, z: cz } }; X.list.push(shop); return shop;
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
  };

  // ---- UI overlay -------------------------------------------------------------------------------------------------------------------------
  let items = [];
  function openMenu(kind, title, sub, list) {
    X.menu = { kind }; items = list; X.sel = 0; if (document.exitPointerLock) document.exitPointerLock();
    $('shop-foot').textContent = kind === 'garage' ? 'PRESS A NUMBER OR CLICK  ·  G / ESC TO LEAVE' : 'PRESS A NUMBER OR CLICK  ·  E / ESC TO LEAVE';
    $('shop-title').textContent = title; $('shop-sub').textContent = sub; $('shopui').style.display = 'block'; renderMenu();
  }
  function closeMenu() { X.menu = null; $('shopui').style.display = 'none'; }
  X.close = closeMenu;
  function renderMenu() {
    const st = hs(); $('shop-cash').textContent = '$' + st.cash.toLocaleString('en-US');
    $('shop-list').innerHTML = items.map((it, i) => { const lock = it.rep && st.rep < it.rep; return '<div class="it ' + (lock ? 'lock' : '') + (it.own ? ' own' : '') + '" data-i="' + i + '"><span class="k">' + (i + 1) + '</span><span class="n">' + it.n + '<small>' + (it.d || '') + '</small></span><span class="p">' + (lock ? 'REP ' + it.rep + ' NEEDED' : it.own ? 'OWNED' : it.p === 0 ? 'FREE' : '$' + it.p.toLocaleString('en-US')) + '</span></div>'; }).join('');
    Array.from($('shop-list').children).forEach((el) => el.addEventListener('click', () => buy(+el.dataset.i)));
  }
  function buy(i) {
    const it = items[i], st = hs(); if (!it) return;
    if (it.rep && st.rep < it.rep) { CW.hud.toast('NEEDS REP LEVEL ' + it.rep); CW.sfx.play('click', 0.5); return; }
    if (it.p > 0 && st.cash < it.p) { CW.hud.toast('NOT ENOUGH CASH'); CW.sfx.play('click', 0.5); return; }
    if (it.f()) { st.cash -= it.p; if (it.p) CW.hud.toast('PURCHASED  ' + it.n); }
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
  function repaint(car) { let c; do { c = PAINT[Math.floor(Math.random() * PAINT.length)]; } while (c === car.color); car.color = c; car.mesh.userData.body.geometry = CW.carGeometry(car.type.id, c); }
  function garageItems() {
    const car = CW.player.car, W = CW.police, S = CW.story; if (!car) return [];
    const free = S.free && S.st === 1, price = 200 + W.level * 150;
    return [
      { n: free ? 'REPAINT  (ON THE HOUSE)' : 'REPAINT + NEW PLATES', d: W.level > 0 ? 'Clears your wanted level (' + W.level + ' star' + (W.level > 1 ? 's' : '') + ')' : 'New colour, clean slate', p: free ? 0 : price,
        f() { repaint(car); if (W.level > 0) { W.clear(false); } CW.hud.toast('FRESH PAINT' + (W.level === 0 ? '' : '')); if (S.state === 'active' && S.free && S.st === 1) S.st = 2; CW.sfx.play('pickup', 1); return true; } },
      { n: 'ENGINE TUNE  LV ' + lv(car.eng, 1.12) + '/3', d: '+12% top speed and acceleration per level', p: 900 * (1 + lv(car.eng, 1.12)), rep: 2 + lv(car.eng, 1.12), own: lv(car.eng, 1.12) >= 3, f() { if (lv(car.eng, 1.12) >= 3) { CW.hud.toast('ENGINE FULLY TUNED'); return false; } car.eng = (car.eng || 1) * 1.12; return true; } },
      { n: 'ARMOURED PANELS  LV ' + lv(car.arm, 1 / 1.25) + '/3', d: 'Take 20% less crash and bullet damage per level', p: 800 * (1 + lv(car.arm, 1 / 1.25)), rep: 2 + lv(car.arm, 1 / 1.25), own: lv(car.arm, 1 / 1.25) >= 3, f() { if (lv(car.arm, 1 / 1.25) >= 3) { CW.hud.toast('PANELS FULLY ARMOURED'); return false; } car.arm = (car.arm || 1) * 0.8; return true; } },
      { n: car.mine ? 'THIS IS YOUR PERSONAL VEHICLE' : 'STORE AS MY PERSONAL VEHICLE', d: 'Parked safely in the yard for good (replaces the old one)', p: 0, own: car.mine, f() { if (car.mine) return false; storeCar(car); closeMenu(); return false; } },
    ];
  }
  function lv(v, step) { if (!v) return 0; return Math.round(Math.log(v) / Math.log(step)); }
  function storeCar(car) {
    const V = CW.vehicles; if (X.mine && X.mine !== car) { X.mine.mine = false; X.mine.owned = false; X.mine.hidden = true; }
    ejectPlayer(); const s = X.garageSlot(); car.x = s.x; car.z = s.z; car.h = 0; car.vx = car.vz = 0; car.awake = false; car.owned = true; car.mine = true; car.stolen = false; car.hp = Math.max(car.hp, 60); X.mine = car; void V;
    CW.hud.toast('VEHICLE STORED  ·  IT WAITS IN THE YARD'); CW.sfx.play('pickup', 1);
  }
  function sell(car) {
    const price = salePrice(car), st = hs(); st.cash += price; ejectPlayer(); car.hidden = true; car.mesh.visible = false; car.stolen = false; car.x = -999; car.z = -999; car.awake = false;
    CW.hud.toast('FENCE PAID  $' + price.toLocaleString('en-US')); CW.sfx.play('pickup', 1); CW.story.addRep(8, 'DELIVERY');
    if (CW.story.state === 'active' && CW.story.idx === 1) CW.story.count++;
    if (CW.solfeed) CW.solfeed.news('Another ' + car.type.name + ' vanished from the streets. Harbour Fence is busy tonight.');
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
      if (Math.hypot(car.x - g.x, car.z - g.z) < 10 && car.speed < 5 && !car.cop) { prompt = "G  ROXY'S GARAGE"; if (I.pressed('KeyG')) { openMenu('garage', "ROXY'S REPAINT", 'REPAINT CLEARS YOUR STARS  ·  UPGRADES  ·  STORE ONE PERSONAL VEHICLE', garageItems()); return; } }
      else if (Math.hypot(car.x - fz.x, car.z - fz.z) < 11 && car.speed < 6 && car.stolen && !car.owned && !car.cop) {
        if (CW.police.level > 0) prompt = 'FENCE: TOO HOT, LOSE THE COPS FIRST'; else { prompt = 'G  SELL STOLEN CAR  $' + salePrice(car).toLocaleString('en-US'); if (I.pressed('KeyG')) sell(car); }
      }
      else if (Math.hypot(car.x - fz.x, car.z - fz.z) < 11 && car.speed < 6 && car.owned) prompt = 'FENCE: THIS ONE IS YOURS, NOT FOR SALE';
    }
    if (prompt) P.prompt = prompt;
  };

  // (the minimap draws the shop icons from X.list in hud.js)
})();
