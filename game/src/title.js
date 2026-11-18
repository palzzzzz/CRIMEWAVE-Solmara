// The live 3D cover scene: golden hour, orbiting camera, Ray + Luna leaning on the sports car, menu.
(function () {
  const CW = window.CW;
  const T = (CW.title = { active: false, t: 0, sel: 0, howto: false, items: [] });
  const $ = (id) => document.getElementById(id);
  let puffT = 0;
  const CX = 189, CZ = 0.6;

  T.enter = function () {
    T.active = true; T.t = 0; T.howto = false;
    const P = CW.player, car = CW.vehicles.hero;
    // key-art staging: the car angled across the road, Ray on the front fender, Luna sat on the rear deck
    if (!T.carHome) T.carHome = { x: car.x, z: car.z, h: car.h };
    car.x = CX; car.z = CZ; car.h = Math.PI + 0.38; car.vx = car.vz = 0; car.awake = false;
    const s = Math.sin(car.h), c = Math.cos(car.h);
    const fx = s, fz = c, lx = -c, lz = s;     // forward, and the car side that faces the camera (east)
    const face = Math.atan2(lx, lz);
    P.setLeanPose(true);
    P.crew.luna.model.userData.setPose('luna-sit');
    P.place(P.crew.ray, CX + fx * 1.5 + lx * 1.28, CZ + fz * 1.5 + lz * 1.28, face + 0.18);
    P.place(P.crew.luna, CX - fx * 1.45 + lx * 1.0, CZ - fz * 1.3 + lz * 0.62, face - 0.22);
    P.crew.luna.model.position.y = 0.06;
    P.crew.ray.model.visible = P.crew.luna.model.visible = true;
    if (!T.fill) {
      T.fill = new THREE.DirectionalLight(0xffc9a0, 0.7); T.fill.position.set(260, 30, 12); T.fill.target.position.set(CX, 1, CZ);
      CW.scene.add(T.fill); CW.scene.add(T.fill.target);
    }
    T.fill.visible = true;
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
    c.lookAt(CX - 40, 8.3, CZ + 0.1);
    c.fov = 40; c.updateProjectionMatrix();
    CW.cam.tx = CX; CW.cam.tz = CZ;
    CW.player.crew.luna.model.position.y = 0.06;
    // idle animation
    const P = CW.player, r = P.crew.ray.model.userData, l2 = P.crew.luna.model.userData;
    const br = Math.sin(T.t * 1.7) * 0.012;
    r.body.position.y = br; l2.body.position.y = -br;
    r.head.rotation.y = -0.15 + Math.sin(T.t * 0.5) * 0.12; l2.head.rotation.y = 0.2 + Math.sin(T.t * 0.4 + 2) * 0.08;
    // cigarette: raise to mouth and lower again, smoke curl while raised
    const cyc = (T.t % 7) / 7, up = cyc < 0.45 ? 1 : cyc < 0.55 ? 1 - (cyc - 0.45) / 0.1 : 0;
    r.armR.sh.rotation.x = -0.55 + (1 - up) * -0.1 + up * 0; r.armR.el.rotation.x = -1.95 + (1 - up) * 0.85;
    puffT -= dt;
    if (puffT <= 0) {
      puffT = 0.14;
      const tip = new THREE.Vector3(); P.crew.ray.cig.localToWorld(tip.set(0, 0, 0.09));
      CW.fx.puff(tip.x, tip.y, tip.z, { color: 0xdedede, size: 0.09, grow: 0.22, vy: 0.5, vx: -Math.sin(T.t * 2.2) * 0.18, vz: Math.cos(T.t * 1.7) * 0.15, a: 0.55, life: 3.2 });
    }
  };
})();
