// Bootstrap, game states (title / play), main loop and autosave.
(function () {
  const CW = window.CW;
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  CW.scene = scene;
  CW.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2200);
  CW.renderer = renderer;

  const game = (CW.game = { state: 'boot', t: 0, saveT: 0 });

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    CW.camera.aspect = window.innerWidth / window.innerHeight; CW.camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  CW.initMaterials();
  CW.world.build(scene);
  CW.sky.init(scene);
  CW.fx.init(scene);
  CW.explosions.init(scene);   // the one permanent blast PointLight is created here, before the first render
  CW.vehicles.spawnParked();
  CW.traffic.init();
  CW.police.init();
  CW.player.init(scene);
  CW.weapons.init(scene);
  CW.enemies.init();
  CW.air.init(scene);
  CW.weather.init(scene);
  CW.hud.init();
  CW.story.initMarker(scene);
  CW.solfeed.init();
  CW.shops.init(scene);
  CW.title.bind();

  game.start = function (cont) {
    CW.title.leave();
    CW.player.startNew(); CW.gunner.reset();
    CW.weapons.reset(); CW.air.reset(); CW.enemies.reset(); CW.weather.set('clear');
    CW.sky.hour = CW.C.START_HOUR;
    const st = CW.hud.state;
    CW.solfeed.reset(); CW.radio.st = 0;
    const s0 = cont ? CW.save.read() : null;
    if (s0) {
      CW.story.load(s0.story); CW.shops.load(s0.shops);
      if (s0.wp) { Object.assign(CW.weapons.own, s0.wp.own); Object.keys(s0.wp.ammo || {}).forEach((k) => { if (CW.weapons.ammo[k]) Object.assign(CW.weapons.ammo[k], s0.wp.ammo[k]); }); if (s0.wp.cur && CW.weapons.own[s0.wp.cur]) CW.weapons.equip(s0.wp.cur, true); }
      st.armour = s0.armour || 0;
    } else {
      CW.story.newGame(); CW.shops.newGame();
      Object.keys(CW.weapons.own).forEach((k) => { if (k !== 'fists' && k !== 'knife' && k !== 'pistol') delete CW.weapons.own[k]; });
      CW.weapons.order.forEach((k) => { const d = CW.weapons.defs[k]; CW.weapons.ammo[k] = { mag: d.mag || 0, res: k === 'pistol' ? 48 : 0 }; });
      CW.weapons.cur = 'pistol';
    }
    if (cont) {
      const s = s0;
      if (s) {
        st.cash = s.cash; st.rep = s.rep; st.repXp = s.repXp || 0;
        const e = CW.player.crew[s.protag] || CW.player.crew.ray;
        CW.player.active = e;
        CW.player.place(e, s.x, s.z, s.h || 0);
        CW.player.place(CW.player.other(), s.x + 1.5, s.z + 2, 0);
        CW.sky.hour = s.hour;
      }
    } else { st.cash = 2500; st.rep = 1; st.repXp = 0; }
    st.repNeed = CW.story.repNeed(st.rep);
    CW.hud.show(true);
    st.hp = 100; st.wanted = 0; if (!cont) st.armour = 0;
    const F = CW.player.focus();
    CW.traffic.activate(F.x, F.z);
    CW.police.start(F);
    game.state = 'play';
    CW.hud.toast('WELCOME TO SOLMARA');
    canvas.addEventListener('click', lock);
  };

  function lock() { if (game.state === 'play' && !document.pointerLockElement && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } }

  function save() {
    if (capType || stageQ) return;   // staged / capture sessions never touch the real save
    const P = CW.player, e = P.active, st = CW.hud.state;
    const f = P.mode === 'car' && P.car ? P.car : e;
    const Wp = CW.weapons;
    CW.save.write({ cash: st.cash, rep: st.rep, repXp: st.repXp, armour: Math.round(st.armour || 0), protag: e.id, x: f.x, z: f.z, h: f.h, hour: CW.sky.hour,
      story: CW.story.serialize(), shops: CW.shops.save(), wp: { own: Wp.own, ammo: Wp.ammo, cur: Wp.cur } });
  }

  let last = performance.now(), simT = 0, fpsAcc = 0, fpsN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (CW.weapons.wheelOpen) dt *= 0.22;   // the weapon wheel slows the world right down
    if (CW.solfeed.open || CW.shops.menu) dt *= 0.05;   // phone + shop menus nearly freeze it
    dt *= CW.story.timeScale;
    simT += dt;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { CW.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const playing = game.state === 'play';
    if (game.state === 'title') CW.title.update(dt);
    const live = playing || game.state === 'ended';
    const sdt = game.state === 'ended' ? dt * 0.3 : dt;
    if (playing) { CW.player.update(dt); CW.weapons.update(dt); CW.shops.update(dt); CW.solfeed.update(dt); CW.radio.update(dt); }
    if (game.state === 'play' || game.state === 'ended') CW.story.update(dt);
    if (live) { const F0 = CW.player.focus(); CW.traffic.update(sdt, F0); CW.police.update(dt, F0); CW.enemies.update(sdt); CW.weapons.simulate(sdt); CW.air.update(sdt); }
    CW.weather.update(dt, playing);
    if (CW.audio && CW.audio.ctx) {
      const P = CW.player, car = playing && P.mode === 'car' && P.car ? P.car : null;
      CW.sfx.engine(!!car, car ? Math.min(1, car.speed / car.type.max) : 0, car ? Math.abs(CW.input.isDown('KeyW') ? 1 : 0.2) : 0, car && car.type.id === 'bike');
      CW.sfx.sea(playing ? CW.clamp((CW.player.focus().x - 120) / 120, 0, 1) : 0.6, simT);
    }
    CW.vehicles.update(sdt, playing);
    if (live) CW.explosions.update(sdt, playing);   // after vehicles: layers the tumble over the car pose
    if (capture && playing) captureStep(dt);
    if (playing) CW.gunner.update(dt);   // after the car has moved, so Luna stays glued to the seat
    if (capture && playing) { const c = CW.camera; c.updateMatrixWorld(true); }
    CW.world.update(dt, simT);
    const focus = playing ? CW.player.focus() : { x: 245, z: 40 };
    CW.sky.update(dt, focus, CW.camera);
    if (playing) {
      CW.hud.update(dt);
      game.saveT += dt; if (game.saveT > 5) { game.saveT = 0; save(); }
    }
    renderer.render(scene, CW.camera);
    CW.input.endFrame();
  }

  // ---- staging / capture hooks (ALL OFF unless the URL carries ?capture= or ?stage=; normal play never reads them) ------
  // ?capture=sports|sedan|<car type id>  Skips the title, puts Ray in the named car with Luna aboard, pins the wanted level at 4 stars
  //   with busted disabled, parks an invulnerable cruiser in SMG range and holds the cinematic camera, so a screenshot of Luna
  //   firing needs no chase timing. Spawns in DOWNTOWN (&loc=beach for the old beachfront road).
  // ?stage=late   late-game state: big cash, REP 10, every weapon + full ammo, armour, story at chapter 6. Alone or with capture.
  // ?stage=boom   (implies capture) three driverless cars parked nose to tail ahead of the player; the middle one is set burning
  //   after &boom=<seconds> (default 2.5) and blows through the normal wreck path, thrown neighbours included. No police staging.
  // Camera (capture only), all optional: &cam=<side metres, default 3.4> &camh=<lens height m, 0.9> &camf=<metres ahead, 6.4>
  //   &fov=<deg> &hr=<hour> &hud=0.   cam is signed: negative swings the lens to the driver's side.
  const capQ = new URLSearchParams(location.search), stageQ = capQ.get('stage');
  const capType = capQ.get('capture') || (stageQ === 'boom' ? 'sports' : null);
  let capture = null;
  const qn = (k, d) => { const v = parseFloat(capQ.get(k)); return isFinite(v) ? v : d; };
  function stageLate() {
    const st = CW.hud.state, Wp = CW.weapons;
    st.cash = 485000; st.rep = 10; st.repXp = CW.story.repNeed(9) - 1; st.repNeed = CW.story.repNeed(10); st.armour = 100; st.hp = 100;
    Wp.order.forEach((k) => Wp.give(k, 999)); Wp.refill();
    CW.story.idx = 5; CW.story.retry = true; CW.story.wait = 6;
  }
  function captureStart() {
    const type = capType === 'sports' || !CW.CAR_TYPES[capType] ? (capType === 'sedan' ? 'sedan' : 'sports') : capType;
    game.start(false);
    if (stageQ === 'late') stageLate();
    const P = CW.player, W = CW.police, beach = capQ.get('loc') === 'beach';
    const S = beach ? CW.world.spawn : { x: stageQ === 'boom' ? -64 : -6, z: 2.7, h: Math.PI / 2 };   // DOWNTOWN: east-bound lane of the z=0 avenue, just short of the x=0 junction (clear sight line down the cross street)
    const h = S.h, sn = Math.sin(h), cs = Math.cos(h);
    const R = { x: -cs, z: sn };   // car-right (passenger side), as used by gunner.js
    const car = CW.vehicles.add(type, CW.CAR_TYPES[type].colors[0], S.x, S.z, h);
    CW.vehicles.enter(car); P.mode = 'car'; P.car = car; P.crew.ray.model.visible = false;
    car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = h;
    CW.sky.hour = qn('hr', 17.2);
    capture = { car, cop: W.cops[0], R, h, side: qn('cam', 3.4), camh: qn('camh', 0.9), camf: qn('camf', 6.4), fov: qn('fov', 40), boom: null, beach };
    W.dispT = 1e9; W.rbT = 1e9; W.busted = function () {};
    if (stageQ === 'boom') {
      // three parked cars nose to tail on the lane ahead; the middle one is the one that burns
      const kinds = [['sedan', 1], ['hatch', 0], ['suv', 2]], cars = [];
      kinds.forEach((k, i) => {
        const cols = CW.CAR_TYPES[k[0]].colors, d = 17 + i * 5.6;
        const c = CW.vehicles.add(k[0], cols[k[1] % cols.length], car.x + sn * d, car.z + cs * d + 0.4 * (i - 1), h);
        c.awake = false; c.hp = 100; c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = h; cars.push(c);
      });
      capture.boom = { cars, t: 0, at: qn('boom', 2.5), lit: false, cx: cars[1].x, cz: cars[1].z };
    }
    document.body.classList.add('capture');
    if (capQ.get('hud') === '0') document.getElementById('hud').style.visibility = 'hidden';
  }
  function captureStep(dt) {
    const { car, cop, R, h, side, camh, camf, fov, boom } = capture, W = CW.police, st = CW.hud.state, P = CW.player, sn = Math.sin(h), cs = Math.cos(h), c = CW.camera;
    car.vx = car.vz = 0; car.speed = 0; car.hp = 100; st.hp = 100; P.mode = 'car'; P.car = car;
    let tx, tz, ty;   // what the lens looks at
    if (boom) {
      boom.t += dt; W.heat = 0; W.level = 0; st.wanted = 0;
      W.cops.forEach((q) => { if (!q.hidden) { q.hidden = true; q.cs = 'idle'; } });
      if (!boom.lit && boom.t >= boom.at) { boom.lit = true; boom.cars[1].hp = 0; }
      // front 3/4, low, off the street axis: the lens sits behind the row and swings out, looking at the middle car
      tx = boom.cx; tz = boom.cz; ty = 1.1;
      c.position.set(tx - sn * (camf + 4) + R.x * (side + 2.5), camh, tz - cs * (camf + 4) + R.z * (side + 2.5));
    } else {
      CW.gunner.pause = 0;   // capture only: no burst pauses, so a still frame is likely to catch a flash
      W.heat = 4; W.level = 4; W.lostT = 0; W.bust = 0; W.seen = true; st.wanted = 4;
      W.cops.forEach((q) => { if (q !== cop && !q.hidden) { q.hidden = true; q.cs = 'idle'; } });
      // staged cruiser: out the passenger side, a little ahead, broadside to Luna, never takes damage (closer downtown: narrower streets)
      const out = capture.beach ? 21 : 14;
      cop.hidden = false; cop.awake = true; cop.cs = 'roadblock'; cop.rbMin = 1e9; cop.hp = 100; cop.ai = cop.ai || { cruise: 0, off: 0 };
      cop.x = car.x + R.x * out + sn * 3; cop.z = car.z + R.z * out + cs * 3; cop.h = h + Math.PI / 2; cop.vx = cop.vz = 0; cop.speed = 0;
      // low front 3/4: ahead of the bonnet, swung out on Luna's side, aimed at the window line
      tx = car.x + R.x * 0.6; tz = car.z + R.z * 0.6; ty = 1.25;
      c.position.set(car.x + sn * camf + R.x * side, camh, car.z + cs * camf + R.z * side);
    }
    c.fov = fov; c.updateProjectionMatrix(); c.lookAt(tx, ty, tz);
    const near = boom ? 7 : 25;
    CW.traffic.peds.forEach((p) => { if (Math.hypot(p.x - c.position.x, p.z - c.position.z) < near) p.model.visible = false; });   // no bystanders in the evidence frame
    // anything else within 12 m of the lens would hide the subject: hide it (the staged boom cars are exempt)
    CW.vehicles.list.forEach((v) => { if (v !== car && v !== cop && !(boom && boom.cars.includes(v)) && Math.hypot(v.x - c.position.x, v.z - c.position.z) < 12) v.mesh.visible = false; });
  }

  game.state = 'title';
  CW.title.enter();
  requestAnimationFrame(frame);
  if (capType) captureStart();
  else if (stageQ === 'late') { game.start(false); stageLate(); }
  window.addEventListener('beforeunload', () => { if (game.state === 'play') save(); });
})();
