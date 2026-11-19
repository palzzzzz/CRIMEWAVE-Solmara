// The live 3D cover scene: golden hour behind a maximum-intensity downpour, orbiting camera, Ray (pistol) + Luna (SMG)
// standing beside the sports car with their dog, menu.
(function () {
  const CW = window.CW;
  const T = (CW.title = { active: false, t: 0, sel: 0, howto: false, items: [] });
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
    P.place(P.crew.ray, CX + fx * 1.05 + lx * 1.95, CZ + fz * 1.05 + lz * 1.95, face + 0.28);
    P.place(P.crew.luna, CX - fx * 1.0 + lx * 1.95, CZ - fz * 1.0 + lz * 1.95, face - 0.3);
    P.crew.ray.model.visible = P.crew.luna.model.visible = true;
    if (ru.guns) { ru.guns.pistol.visible = true; if (ru.guns.pistol.userData.flash) ru.guns.pistol.userData.flash.visible = false; }
    if (lu.guns) { lu.guns.smg.visible = true; if (lu.guns.smg.userData.flash) lu.guns.smg.userData.flash.visible = false; }
    if (!T.dog) { T.dog = makeDog(); CW.scene.add(T.dog); }
    T.dog.visible = true; T.dog.scale.setScalar(1.15);
    T.dog.position.set(CX + fx * 0.02 + lx * 2.15, 0, CZ + fz * 0.02 + lz * 2.15); T.dog.rotation.y = face + 0.15;   // between their feet, looking at the lens
    if (!T.fill) {
      T.fill = new THREE.DirectionalLight(0xffc9a0, 0.7); T.fill.position.set(260, 30, 12); T.fill.target.position.set(CX, 1, CZ);
      CW.scene.add(T.fill); CW.scene.add(T.fill.target);
    }
    T.fill.visible = true;
    // very heavy rain: the existing rain system pinned at its maximum intensity (wet = 1), no auto-clear while the title is up
    Wx.mode = 'rain'; Wx.target = 1; Wx.wet = 1; Wx.next = 1e9;
    CW.sky.hour = CW.C.TITLE_HOUR; CW.sky.frozen = true;
    $('title').style.display = 'flex'; $('hud').style.display = 'none';
    const has = !!CW.save.read();
    $('m-continue').classList.toggle('disabled', !has);
    $('m-continue').querySelector('small').textContent = has ? 'RESUME YOUR LAST SESSION' : 'NO SAVE YET';
    T.items = ['m-new', 'm-continue', 'm-how'];
    T.sel = 0; T.render();
  };

  T.leave = function () {
    T.active = false; CW.sky.frozen = false;
    if (T.fill) T.fill.visible = false;
    if (T.dog) T.dog.visible = false;
    ['ray', 'luna'].forEach((id) => { const gs = CW.player.crew[id].model.userData.guns; if (gs) Object.keys(gs).forEach((k) => { gs[k].visible = false; }); });
    CW.weather.wet = 0; CW.weather.target = 0; CW.weather.mode = 'clear';
    const car = CW.vehicles.hero; if (T.carHome) { car.x = T.carHome.x; car.z = T.carHome.z; car.h = T.carHome.h; }
    $('title').style.display = 'none'; $('howto').style.display = 'none';
  };

  T.render = function () {
    T.items.forEach((id, i) => $(id).classList.toggle('sel', i === T.sel));
  };

  T.choose = function (i) {
    const id = T.items[i];
    if (id === 'm-how') { T.howto = true; $('howto').style.display = 'flex'; return; }
    if (id === 'm-continue' && !CW.save.read()) return;
    CW.game.start(id === 'm-continue');
  };

  T.bind = function () {
    T.items = ['m-new', 'm-continue', 'm-how'];
    T.items.forEach((id, i) => {
      $(id).addEventListener('mouseenter', () => { if (T.active && !T.howto) { T.sel = i; T.render(); } });
      $(id).addEventListener('click', () => { if (T.active && !T.howto) T.choose(i); });
    });
    $('howto-close').addEventListener('click', () => { T.howto = false; $('howto').style.display = 'none'; });
  };

  T.update = function (dt) {
    const I = CW.input;
    T.t += dt;
    if (T.howto) {
      if (I.pressed('Escape') || I.pressed('Enter') || I.pressed('Space')) { T.howto = false; $('howto').style.display = 'none'; }
    } else {
      if (I.pressed('ArrowDown') || I.pressed('KeyS')) { T.sel = (T.sel + 1) % 3; T.render(); }
      if (I.pressed('ArrowUp') || I.pressed('KeyW')) { T.sel = (T.sel + 2) % 3; T.render(); }
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
    CW.weather.wet = 1; CW.weather.target = 1;   // keep the downpour at maximum for as long as the title is up
    // idle animation: breathing, head turns, the dog's tail wagging and head tilt
    const P = CW.player, r = P.crew.ray.model.userData, l2 = P.crew.luna.model.userData;
    const br = Math.sin(T.t * 1.7) * 0.012;
    r.body.position.y = br; l2.body.position.y = -br;
    r.head.rotation.y = -0.15 + Math.sin(T.t * 0.5) * 0.12; l2.head.rotation.y = 0.2 + Math.sin(T.t * 0.4 + 2) * 0.08;
    if (T.dog) { const d = T.dog.userData; d.tail.rotation.y = Math.sin(T.t * 7) * 0.5; d.head.rotation.z = Math.sin(T.t * 0.8) * 0.1; }
  };
})();
