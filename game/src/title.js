// Escena de portada en vivo: noche de lluvia intensa, cámara orbital, Ray (pistola) y Luna (subfusil) junto al VESPER GT
// con su perro, menú de 5 opciones (JUGAR, MISIONES, OPCIONES, CÓMO JUGAR, SALIR).
(function () {
  const CW = window.CW;
  const T = (CW.title = { fix: (function () { const v = parseFloat(new URLSearchParams(location.search).get('tt')); return isFinite(v) ? v : null; })(), active: false, t: 0, sel: 0, howto: false, modal: null, rain: true, items: [] });
  const ITEMS = ['m-new', 'm-missions', 'm-options', 'm-how', 'm-quit'];
  const $ = (id) => document.getElementById(id);
  const CX = 189, CZ = 0.6;

  // a simple low-poly dog (box body, head, snout, ears, tail, four legs), warm tan with a white chest/socks so it reads on wet asphalt
  function makeDog() {
    const g = new THREE.Group(), M = (c) => new THREE.MeshLambertMaterial({ color: c }), tan = M(0xe0963c), dark = M(0x6b3a17), white = M(0xfff4e0), nose = M(0x16100c);
    const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; (parent || g).add(b); return b; };
    box(0.34, 0.34, 0.78, tan, 0, 0.56, 0);                 // body
    box(0.26, 0.24, 0.1, white, 0, 0.52, 0.4);              // chest patch
    const head = new THREE.Group(); head.position.set(0, 0.84, 0.46); g.add(head);
    box(0.3, 0.28, 0.3, tan, 0, 0, 0, head);                // skull
    box(0.18, 0.15, 0.2, white, 0, -0.06, 0.2, head);       // snout
    box(0.07, 0.06, 0.04, nose, 0, -0.02, 0.31, head);      // nose
    box(0.07, 0.15, 0.1, dark, 0.17, 0.08, -0.02, head);    // ears
    box(0.07, 0.15, 0.1, dark, -0.17, 0.08, -0.02, head);
    box(0.05, 0.05, 0.03, nose, 0.08, 0.05, 0.151, head);   // eyes
    box(0.05, 0.05, 0.03, nose, -0.08, 0.05, 0.151, head);
    const tail = new THREE.Group(); tail.position.set(0, 0.7, -0.4); g.add(tail);
    box(0.07, 0.07, 0.34, dark, 0, 0.1, -0.1, tail).rotation.x = 0.7;
    [[0.12, 0.3], [-0.12, 0.3], [0.12, -0.3], [-0.12, -0.3]].forEach((p) => { box(0.09, 0.4, 0.09, tan, p[0], 0.2, p[1]); box(0.1, 0.08, 0.12, white, p[0], 0.04, p[1] + 0.02); });
    g.userData = { head, tail };
    return g;
  }

  // ---- menu-scene dressing: rainy-night pedestrians, a police helicopter pacing behind the crew with its searchlight on them, a small make.fun board ----
  const SH = [0xff7b54, 0x37c9b8, 0xf2c94c, 0xe0407a, 0x6fa3d8, 0xa5d56a, 0xf5f1e6, 0x8f6fd1, 0xc9593f], PN = [0xefe3c8, 0x3b4a6b, 0x6a5a48, 0x2f3b45, 0x8aa0a8], SK = [0xd9a070, 0xb9805a, 0xf0c8a0, 0x8d5a3b, 0xe2b48a], HR = [0x20160f, 0x4a3020, 0x1a1018, 0xb8864a, 0x7a3b22];
  function umbrella(col) {
    const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), m); dome.scale.y = 0.62; dome.position.y = 2.3; dome.castShadow = true; g.add(dome);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x15151a })); pole.position.y = 1.75; g.add(pole);
    return g;
  }
  function buildCrowd() {
    const out = [];
    // [x, z, direction (+1 east / -1 west), speed, umbrella]  : pavements on both sides + a few people crossing the avenue further down
    const spec = [[184, 7.4, -1, 1.3, 1], [181, -7.6, 1, 1.5, 0], [176, 8.6, -1, 1.2, 0], [174, -8.8, 1, 1.6, 1], [170, 9.4, 1, 1.4, 0], [166, -9.2, -1, 1.2, 1], [161, 8.9, -1, 1.5, 0], [158, -9.4, 1, 1.3, 0], [152, 9.2, 1, 1.4, 1], [149, -8.6, -1, 1.5, 0], [143, 8.8, -1, 1.3, 0], [138, -9.1, 1, 1.4, 1], [132, 9, 1, 1.2, 0], [129, -8.8, -1, 1.5, 0], [178, 4.5, 0, 1.6, 0], [169, -4, 0, 1.7, 1], [162, 3, 0, 1.5, 0], [155, -3.5, 0, 1.6, 1], [173, 0, 0, 1.4, 0], [148, 2, 0, 1.7, 0]];
    spec.forEach(([x, z, dir, sp, um], i) => {
      const m = CW.makePerson({ id: 'npc', skin: SK[i % 5], hair: HR[i % 5], shirt: SH[i % 9], pants: PN[(i * 3) % 5], shoes: 0x1c1c22, female: i % 2 === 1, shades: false });
      CW.scene.add(m); if (um) { const u = umbrella([0xe8456f, 0x2ff0ff, 0xffd34a, 0x8f6fd1][i % 4]); m.add(u); m.userData.umb = u; }
      out.push({ m, x, z, dir, sp, cross: dir === 0, x0: x, z0: z, k: i });
    });
    return out;
  }
  function updateCrowd(dt) {
    T.crowd.forEach((p) => {
      // positions are a pure function of the menu clock (T.t), so a fixed &tt=<s> staging gives the same frame every run
      if (p.cross) { const sg = p.k % 2 ? 1 : -1, span = 18, u = (((p.z0 + 9) / span + sg * p.sp * T.t / span) % 1 + 1) % 1; p.z = -9 + u * span; p.m.rotation.y = sg > 0 ? 0 : Math.PI; }
      else { const span = 70, u = ((((p.x0 - 115) / span + p.dir * p.sp * T.t / span) % 1) + 1) % 1; p.x = 115 + u * span; p.m.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      p.m.position.set(p.x, 0, p.z); p.m.userData.update(dt, p.sp * 1.3);
      if (p.m.userData.umb) { p.m.userData.armR.sh.rotation.set(-2.5, 0, 0.1); p.m.userData.armR.el.rotation.x = -0.4; }
    });
  }
  const HELI = { x: 0, z: 0, hx: 0, hz: 0, sx: 0, sz: 0, h: 0 };
  function updateHeli(dt) {
    const A = CW.air.policeHeli, e = T.t * 0.42, tx = CX - 22 + Math.sin(e * 0.7) * 3, tz = CZ + Math.sin(e) * 14;
    const px = HELI.x, pz = HELI.z; HELI.x = tx; HELI.z = tz;
    const vx = (tx - px) / Math.max(dt, 1e-3), vz = (tz - pz) / Math.max(dt, 1e-3), spd = Math.hypot(vx, vz);
    if (spd > 0.5) HELI.h = CW.dampAngle(HELI.h, Math.atan2(vx, vz), 3, dt);
    A.x = tx; A.z = tz; A.y = 7.2 + Math.sin(T.t * 0.9) * 0.4; A.t = (A.t || 0) + dt;
    const mk = A.mk; mk.root.visible = true; mk.root.position.set(A.x, A.y, A.z); mk.root.rotation.set(0.08, HELI.h, Math.sin(T.t * 0.8) * 0.05);
    mk.rotor.rotation.y += dt * 38; mk.blur.material.opacity = 0.16; mk.tail.rotation.x += dt * 55;
    const fl = Math.floor(A.t * 6) % 2 === 0; mk.red.visible = fl; mk.blue.visible = !fl;
    // the searchlight: sweeps a little around the crew, never leaves them
    const cxm = CX + T.crewMid.x, czm = CZ + T.crewMid.z; HELI.sx = cxm + Math.sin(T.t * 1.3) * 1.2; HELI.sz = czm + Math.cos(T.t * 1.1) * 1.0;
    const dxs = HELI.sx - A.x, dzs = HELI.sz - A.z, len = Math.hypot(dxs, A.y, dzs);
    A.cone.visible = A.disc.visible = true;
    A.cone.position.set(A.x, A.y - 1.4, A.z); A.cone.lookAt(HELI.sx, 0, HELI.sz); A.cone.scale.set(3.6, 3.6, len); A.cone.material.opacity = 0.2;
    A.disc.position.set(HELI.sx, 0.24, HELI.sz); A.disc.scale.set(3.6, 1, 3.6); A.disc.material.opacity = 0.5;
    T.spot.position.set(A.x, A.y - 1.4, A.z); T.spot.target.position.set(HELI.sx, 1.0, HELI.sz); T.spot.target.updateMatrixWorld();
  }

  T.enter = function () {
    T.active = true; T.t = 0; T.howto = false;
    const P = CW.player, car = CW.vehicles.hero, Wx = CW.weather;
    // key-art staging: the car angled across the road; Ray (pistol) and Luna (SMG) stand on the camera side, the dog between them
    if (!T.carHome) T.carHome = { x: car.x, z: car.z, h: car.h };
    car.x = CX; car.z = CZ; car.h = Math.PI + 0.38; car.vx = car.vz = 0; car.awake = false;
    const s = Math.sin(car.h), c = Math.cos(car.h);
    const fx = s, fz = c, lx = -c, lz = s;     // forward, and the car side that faces the camera (east)
    const face = Math.atan2(lx, lz);
    P.setLeanPose(false);
    const ru = P.crew.ray.model.userData, lu = P.crew.luna.model.userData;
    ru.setPose('ray-pistol'); lu.setPose('luna-smg');
    P.crew.ray.cig.visible = false;   // no cigarette, no prop but the pistol
    P.place(P.crew.ray, CX + fx * 2.0 + lx * 1.95, CZ + fz * 2.0 + lz * 1.95, face + 0.28);
    P.place(P.crew.luna, CX - fx * 2.0 + lx * 1.95, CZ - fz * 2.0 + lz * 1.95, face - 0.3);
    P.crew.ray.model.visible = P.crew.luna.model.visible = true;
    if (ru.guns) { ru.guns.pistol.visible = true; if (ru.guns.pistol.userData.flash) ru.guns.pistol.userData.flash.visible = false; }
    if (lu.guns) { lu.guns.smg.visible = true; if (lu.guns.smg.userData.flash) lu.guns.smg.userData.flash.visible = false; }
    if (!T.dog) { T.dog = makeDog(); CW.scene.add(T.dog); }
    T.dog.visible = true; T.dog.scale.setScalar(1.15);
    T.dog.position.set(CX + fx * 1.25 + lx * 2.3, 0, CZ + fz * 1.25 + lz * 2.3); T.dog.rotation.y = face + 0.15;   // between their feet, looking at the lens
    if (!T.fill) {
      // night key-art lighting: a cool key from the camera side, a magenta and a cyan neon rim so both faces and the car's flank read in the rain
      T.fill = new THREE.DirectionalLight(0x9fb8ff, 0.85); T.fill.position.set(260, 30, 12); T.fill.target.position.set(CX, 1, CZ);
      CW.scene.add(T.fill); CW.scene.add(T.fill.target);
      T.pink = new THREE.PointLight(0xff3fd0, 2.4, 22, 1.5); T.pink.position.set(CX - 3.2, 3.2, CZ + 5.5); CW.scene.add(T.pink);
      T.cyan = new THREE.PointLight(0x2ff0ff, 1.1, 22, 1.5); T.cyan.position.set(CX + 3.6, 2.6, CZ - 4.5); CW.scene.add(T.cyan);
      T.warm = new THREE.PointLight(0xffd9a8, 2.4, 12, 1.6); T.warm.position.set(CX + 2.5, 1.9, CZ + 6.2); CW.scene.add(T.warm);
    }
    T.fill.visible = T.pink.visible = T.cyan.visible = T.warm.visible = true;
    // dressing
    T.crewMid = { x: CX + fx * 0 + lx * 1.95 - CX, z: lz * 1.95 };
    if (!T.crowd) T.crowd = buildCrowd();
    T.crowd.forEach((p) => { p.m.visible = true; });
    if (!T.spot) { T.spot = new THREE.SpotLight(0xeaf6ff, 3.2, 60, 0.2, 0.5, 1.0); CW.scene.add(T.spot); CW.scene.add(T.spot.target); }
    T.spot.visible = true;
    const A = CW.air.policeHeli; CW.brand.markPoliceHeli(); CW.brand.setPoliceHeliText('POLICE'); A.mk.root.visible = true; A.cone.visible = A.disc.visible = true; HELI.x = CX - 25; HELI.z = CZ; HELI.h = 0;
    if (!T.board) { T.board = CW.brand.buildWall(CW.scene, 168, 11.4, Math.PI, 8.4, 3.0); }
    T.board.visible = true;
    // very heavy rain: the existing rain system pinned at its maximum intensity (wet = 1), no auto-clear while the title is up
    const rn = T.rain ? 1 : 0; Wx.mode = rn ? 'rain' : 'clear'; Wx.target = rn; Wx.wet = rn; Wx.next = 1e9;
    CW.sky.hour = CW.C.TITLE_HOUR; CW.sky.frozen = true;
    $('title').style.display = 'flex'; $('hud').style.display = 'none';
    T.items = ITEMS; T.modal = null;
    T.sel = 0; T.render(); T.refreshOptions();
  };

  T.leave = function () {
    T.active = false; CW.sky.frozen = false;
    if (T.fill) T.fill.visible = T.pink.visible = T.cyan.visible = T.warm.visible = false;
    if (T.dog) T.dog.visible = false;
    if (T.crowd) T.crowd.forEach((p) => { p.m.visible = false; });
    if (T.spot) T.spot.visible = false;
    if (T.board) T.board.visible = false;
    { const A = CW.air.policeHeli; CW.brand.setPoliceHeliText('POLICÍA'); A.mk.root.visible = false; A.cone.visible = A.disc.visible = false }
    ['ray', 'luna'].forEach((id) => { const gs = CW.player.crew[id].model.userData.guns; if (gs) Object.keys(gs).forEach((k) => { gs[k].visible = false; }); });
    CW.weather.wet = 0; CW.weather.target = 0; CW.weather.mode = 'clear';
    const car = CW.vehicles.hero; if (T.carHome) { car.x = T.carHome.x; car.z = T.carHome.z; car.h = T.carHome.h; }
    $('title').style.display = 'none'; $('howto').style.display = 'none'; closeModal();
  };

  T.render = function () {
    T.items.forEach((id, i) => $(id).classList.toggle('sel', i === T.sel));
  };

  function closeModal() { T.modal = null; ['options', 'playchoice'].forEach((id) => { $(id).style.display = 'none'; }); }
  function openModal(id) { T.modal = id; $(id).style.display = 'flex'; }
  const muted = () => !!(CW.audio && CW.audio.muted);
  T.refreshOptions = function () {
    const s = 'SONIDO: ' + (muted() ? 'APAGADO' : 'ACTIVADO');
    $('o-sound').firstChild.textContent = s; $('p-sound').firstChild.textContent = s;
    $('o-rain').firstChild.textContent = 'LLUVIA EN EL MENÚ: ' + (T.rain ? 'SÍ' : 'NO');
  };
  T.toggleSound = function () {
    const a = (CW.audio = CW.audio || { ctx: null, master: null, muted: false }); a.muted = !a.muted; if (a.master) a.master.gain.value = a.muted ? 0 : 1;
    T.refreshOptions(); if (CW.hud.shown) CW.hud.toast(a.muted ? 'SONIDO APAGADO' : 'SONIDO ACTIVADO');
  };

  T.choose = function (i) {
    const id = T.items[i];
    if (id === 'm-how') { T.howto = true; $('howto').style.display = 'flex'; return; }
    if (id === 'm-missions') { CW.mapscreen.toggle(true); return; }
    if (id === 'm-options') { T.refreshOptions(); openModal('options'); return; }
    if (id === 'm-quit') { try { window.close(); } catch (e) { /* ignore */ } $('hint').textContent = '¡HASTA LUEGO! PUEDES CERRAR ESTA PESTAÑA.'; return; }
    if (CW.save.read()) { openModal('playchoice'); return; }
    CW.game.start(false);
  };

  T.bind = function () {
    T.items = ITEMS;
    T.items.forEach((id, i) => {
      $(id).addEventListener('mouseenter', () => { if (T.active && !T.howto && !T.modal) { T.sel = i; T.render(); } });
      $(id).addEventListener('click', () => { if (T.active && !T.howto && !T.modal) T.choose(i); });
    });
    $('howto-close').addEventListener('click', () => { T.howto = false; $('howto').style.display = 'none'; });
    $('c-continue').addEventListener('click', () => CW.game.start(true));
    $('c-new').addEventListener('click', () => CW.game.start(false));
    $('c-back').addEventListener('click', closeModal);
    $('o-back').addEventListener('click', closeModal);
    $('o-sound').addEventListener('click', T.toggleSound);
    $('o-rain').addEventListener('click', () => { T.rain = !T.rain; const W = CW.weather; W.mode = T.rain ? 'rain' : 'clear'; W.target = T.rain ? 1 : 0; T.refreshOptions(); });
    let sure = false;
    $('o-reset').addEventListener('click', () => { const b = $('o-reset'); if (!sure) { sure = true; b.firstChild.textContent = '¿SEGURO? HAZ CLIC DE NUEVO'; return; } sure = false; try { localStorage.removeItem(CW.save.key); } catch (e) { /* blocked */ } b.firstChild.textContent = 'PARTIDA BORRADA'; });
  };

  T.update = function (dt) {
    const I = CW.input;
    T.t = T.fix !== null ? T.fix : T.t + dt;   // &tt=<s> (staging only) freezes the menu clock
    if (CW.mapscreen.open) { /* the map screen owns the keys */ }
    else if (T.howto) {
      if (I.pressed('Escape') || I.pressed('Enter') || I.pressed('Space')) { T.howto = false; $('howto').style.display = 'none'; }
    } else if (T.modal) {
      if (I.pressed('Escape')) closeModal();
      else if (T.modal === 'playchoice' && (I.pressed('Enter') || I.pressed('Space'))) CW.game.start(true);
    } else {
      const n = ITEMS.length;
      if (I.pressed('ArrowRight') || I.pressed('ArrowDown') || I.pressed('KeyD') || I.pressed('KeyS')) { T.sel = (T.sel + 1) % n; T.render(); }
      if (I.pressed('ArrowLeft') || I.pressed('ArrowUp') || I.pressed('KeyA') || I.pressed('KeyW')) { T.sel = (T.sel + n - 1) % n; T.render(); }
      if (I.pressed('Enter') || I.pressed('Space')) T.choose(T.sel);
    }
    // orbit camera
    // slow, low orbit on the beach side looking west: car in the lower frame, sunset + downtown behind
    const a = Math.sin(T.t * 0.16) * 0.2, R = 10.6 + Math.sin(T.t * 0.1) * 0.7, hgt = 0.95 + Math.sin(T.t * 0.12 + 1) * 0.1;
    const c = CW.camera;
    c.position.set(CX + Math.cos(a) * R, hgt, CZ + Math.sin(a) * R);
    c.lookAt(CX - 40, 5.6, CZ + 0.1);   // aimed a little lower than before so the crew + dog clear the menu strip
    c.fov = 40; c.updateProjectionMatrix();
    CW.cam.tx = CX; CW.cam.tz = CZ;
    if (T.rain) { CW.weather.wet = 1; CW.weather.target = 1; }   // la lluvia se mantiene al máximo mientras el menú está abierto
    // idle animation: breathing, head turns, the dog's tail wagging and head tilt
    const P = CW.player, r = P.crew.ray.model.userData, l2 = P.crew.luna.model.userData;
    const br = Math.sin(T.t * 1.7) * 0.012;
    r.body.position.y = br; l2.body.position.y = -br;
    r.head.rotation.y = -0.15 + Math.sin(T.t * 0.5) * 0.12; l2.head.rotation.y = 0.2 + Math.sin(T.t * 0.4 + 2) * 0.08;
    if (T.crowd) updateCrowd(dt);
    if (T.spot) updateHeli(dt);
    if (T.dog) { const d = T.dog.userData; d.tail.rotation.y = Math.sin(T.t * 7) * 0.5; d.head.rotation.z = Math.sin(T.t * 0.8) * 0.1; }
  };
})();
