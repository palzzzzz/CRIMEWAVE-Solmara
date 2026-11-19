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
    CW.title.leave(); CW.hud.wp = null; if (CW.bigmap.open) CW.bigmap.toggle(false);
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
    if (capture) dt *= qn('ts', 1);   // capture only: &ts=<scale> slows the simulation so a burst of screenshots can resolve a fast event
    if (CW.weapons.wheelOpen) dt *= 0.22;   // the weapon wheel slows the world right down
    if (CW.solfeed.open || CW.shops.menu || CW.bigmap.open) dt *= 0.05;   // phone + shop menus + the full map nearly freeze it
    dt *= CW.story.timeScale;
    simT += dt;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { CW.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const playing = game.state === 'play';
    if (game.state === 'title') CW.title.update(dt);
    const live = playing || game.state === 'ended';
    const sdt = game.state === 'ended' ? dt * 0.3 : dt;
    const mapOpen = playing && CW.bigmap.update(dt);   // N: full-screen map; while it is open the player + weapons stand still
    if (playing && !mapOpen) { CW.player.update(dt); CW.weapons.update(dt); CW.shops.update(dt); CW.solfeed.update(dt); CW.radio.update(dt); }
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
  const capType = capQ.get('capture') || (stageQ === 'boom' || stageQ === 'market' ? 'sports' : null);
  let capture = null;
  const qn = (k, d) => { const v = parseFloat(capQ.get(k)); return isFinite(v) ? v : d; };
  function stageLate() {
    const st = CW.hud.state, Wp = CW.weapons;
    st.cash = 485000; st.rep = 10; st.repXp = CW.story.repNeed(9) - 1; st.repNeed = CW.story.repNeed(10); st.armour = 100; st.hp = 100;
    Wp.order.forEach((k) => Wp.give(k, 999)); Wp.refill();
    CW.story.idx = 5; CW.story.retry = true; CW.story.wait = 6;
  }
  // &mission=<0-6>  staging only: jump to that chapter and start it live (skips the phone call) so the mission panel has real state
  function stageMission() {
    const m = capQ.get('mission'); if (m === null) return;
    CW.story.idx = CW.clamp(parseInt(m, 10) || 0, 0, CW.story.missions.length - 1); CW.story.start();
  }
  function captureStart() {
    const type = capType === 'sports' || !CW.CAR_TYPES[capType] ? (capType === 'sedan' ? 'sedan' : 'sports') : capType;
    game.start(false);
    if (stageQ === 'late') stageLate();
    stageMission();
    const P = CW.player, W = CW.police, beach = capQ.get('loc') === 'beach';
    const S = beach ? CW.world.spawn : { x: stageQ === 'boom' ? -64 : stageQ === 'market' ? 258 : -6, z: stageQ === 'market' ? 6.5 : 2.7, h: Math.PI / 2 };   // DOWNTOWN: east-bound lane of the z=0 avenue, just short of the x=0 junction (clear sight line down the cross street)
    const h = S.h, sn = Math.sin(h), cs = Math.cos(h);
    const R = { x: -cs, z: sn };   // car-right (passenger side), as used by gunner.js
    const car = CW.vehicles.add(type, CW.CAR_TYPES[type].colors[0], S.x, S.z, h);
    CW.vehicles.enter(car); P.mode = 'car'; P.car = car; P.crew.ray.model.visible = false;
    car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = h;
    CW.sky.hour = qn('hr', 17.2);
    capture = { car, cop: W.cops[0], R, h, chase: qn('chase', 0), side: qn('cam', 3.4), camh: qn('camh', 0.9), camf: qn('camf', 6.4), fov: qn('fov', 40), boom: null, beach };
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
      const out = capture.beach ? 21 : qn('out', 14);
      if (capture.chase) {
        // &chase=<speed m/s>: the car cruises east on the avenue, two cruisers tail it, the police heli trails overhead (capture only)
        const v = capture.chase, A = CW.air.policeHeli;
        if (!capture.started) {
          capture.started = true; car.x -= sn * qn('back', 150); car.z -= cs * qn('back', 150);
          if (!A.active) { A.active = true; A.state = 'orbit'; A.hp = 400; A.x = car.x - sn * 40; A.z = car.z - cs * 40; A.y = 34; A.vx = A.vz = A.vy = 0; A.leaveT = 0; A.ang = Math.atan2(-cs, -sn); A.h = h; A.spot.x = car.x; A.spot.z = car.z; A.mk.root.visible = true; A.cone.visible = true; A.disc.visible = true; }
        }
        car.x += sn * v * dt; car.z += cs * v * dt; car.vx = sn * v; car.vz = cs * v; car.speed = v;
        car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = h;
        const offs = [[qn('c1', 9), qn('c1s', 3.0)], [qn('c2', 16), qn('c2s', 2.2)]];   // both on Luna's side so her line of fire does not cross our own hull
        [cop, W.cops[1]].forEach((q, i) => {
          q.hidden = false; q.awake = true; q.cs = 'pursuit'; q.hp = 100; q.ai = q.ai || { cruise: 0, off: 0 };
          q.x = car.x - sn * offs[i][0] + R.x * offs[i][1]; q.z = car.z - cs * offs[i][0] + R.z * offs[i][1]; q.h = h; q.vx = sn * v; q.vz = cs * v; q.speed = v;
          q.mesh.position.set(q.x, 0, q.z); q.mesh.rotation.y = h;
        });
        W.cops.forEach((q, i) => { if (i > 1 && !q.hidden) { q.hidden = true; q.cs = 'idle'; } });
        capture.t = (capture.t || 0) + dt;
        if (qn('scene', 0)) {   // &scene=1: street behind the chase filled with supercars (parked + cruising) and smouldering wrecks, all pinned relative to our car
          const PK = CW.C.PARK;
          if (!capture.sc) {
            const S = [['sports', 2, 17, 2.7], ['sports', 1, 25, -2.7, -1], ['sports', 3, 31, 2.7], ['sports', 4, 38, -2.7, -1], ['sports', 0, 14, PK], ['suv', 2, 27, PK], ['sports', 1, 21, -PK], ['sports', 4, 36, PK], ['sports', 2, 46, 2.7], ['sports', 3, 44, -PK], ['sedan', 0, 52, -2.7, -1],
              ['sedan', 1, 24, -1.0, 0, 1], ['hatch', 2, 33, -6.0, 0, 1], ['suv', 1, 41, 3.8, 0, 1], ['sedan', 3, 19, -5.0, 0, 1], ['hatch', 0, 29, 0.5, 0, 1]];
            capture.sc = S.map(([ty, ci, back, z, dir, wreck], i) => {
              const cols = CW.CAR_TYPES[ty].colors, hh = wreck ? h + (i % 2 ? 0.6 : -0.5) : dir ? h + Math.PI : h;
              const v = CW.vehicles.add(ty, cols[ci % cols.length], car.x - back, z, hh); v.awake = false; v.ai = null;
              if (wreck) { v._big = 1; v.hp = 0; v._ws = 'after'; v._wt = 0; v._fuse = 1e9; v.mesh.traverse((o) => { if (o.isMesh && o.material && !o.material.isSpriteMaterial) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.22); } }); }
              return { v, back, z, dir: dir || 0, wreck, hh };
            });
          }
          capture.sc.forEach((s) => {
            const v = s.v; v.hidden = false; v.mesh.visible = true;
            if (s.wreck) { v.hp = 0; v._wt = Math.min(v._wt || 0, 2.5); }
            v.x = car.x - s.back + (s.dir ? -s.dir * 0 : 0); v.z = s.z; v.h = s.hh; v.vx = v.vz = 0; v.speed = 0;
            v.mesh.position.set(v.x, 0, v.z); v.mesh.rotation.y = s.hh;
          });
        }
        if (qn('hdown', 0) && capture.t >= qn('hdown', 0) && A.state !== 'down') { A.state = 'down'; A.vy = 0; A.spin = 1.5; A.vx = car.vx; A.vz = car.vz; }   // &hdown=<s>: shot down at that moment
        if (A.state !== 'down') { A.hp = 400; A.ang = Math.atan2(-cs, -sn) + 0.5; }
      } else {
      cop.hidden = false; cop.awake = true; cop.cs = 'roadblock'; cop.rbMin = 1e9; cop.hp = 100; cop.ai = cop.ai || { cruise: 0, off: 0 };
      cop.x = car.x + R.x * out + sn * 3; cop.z = car.z + R.z * out + cs * 3; cop.h = h + Math.PI / 2; cop.vx = cop.vz = 0; cop.speed = 0;
      }
      // low front 3/4: ahead of the bonnet, swung out on Luna's side, aimed at the window line
      tx = car.x + R.x * 0.6; tz = car.z + R.z * 0.6; ty = 1.25;
      c.position.set(car.x + sn * camf + R.x * side, camh, car.z + cs * camf + R.z * side);
      if (capture.chase) {
        // aim past the car at the pursuers; heli pinned in view: &lookb=<m behind car> &looky=<m high> &heli=<m behind>,<m high>,<m to the right>
        const lb = qn('lookb', 8), ly = qn('looky', 4), hb = qn('hb', 30), hy = qn('hy', 22), hs = qn('hs', 6), A = CW.air.policeHeli;
        tx = car.x - sn * lb + R.x * 0.6; tz = car.z - cs * lb + R.z * 0.6; ty = ly;
        if (A.state !== 'down') { A.x = car.x - sn * hb + R.x * hs; A.z = car.z - cs * hb + R.z * hs; A.y = hy; A.vx = car.vx; A.vz = car.vz; A.h = h; A.mk.root.position.set(A.x, A.y, A.z); }
      }
    }
    const market = stageQ === 'market';
    if (market) {
      // &stage=market: night-market firefight. Crowd (all 28 peds) flees hands-up along the pavement, blasts every &every s, heli overhead.
      const T = CW.traffic, A = CW.air.policeHeli, tm = capture.t = (capture.t || 0) + dt, ev = qn('every', 4);
      if (!capture.mk && tm > 1.2) {
        capture.mk = true;
        if (!A.active) { A.active = true; A.state = 'orbit'; A.hp = 400; A.leaveT = 0; A.vx = A.vz = A.vy = 0; A.spot.x = car.x; A.spot.z = car.z; A.mk.root.visible = true; A.cone.visible = true; A.disc.visible = true; }
        capture.shots = [];
        capture.reseat = (p, i) => {   // seat a ped mid-crowd, fleeing; called again when it dies or runs out of the frame
          p.state = 'flee'; p.t = 60; p.hp = 100; p.model.visible = true; p.model.rotation.x = 0; p.vx = p.vz = 0;
          p.x = car.x + 8 + (i % 14) * 1.6 + (i % 3) * 0.4; p.z = 3 + (i % 4) * 2.6;
          const k = i % 2 ? 1 : -1; p.fx = k * 0.8; p.fz = (i % 3 - 1) * 0.25;
          p.model.position.set(p.x, 0, p.z);
        };
        T.peds.forEach(capture.reseat);
      }
      if (capture.reseat) T.peds.forEach((p, i) => { if (p.state === 'dead' || p.x < car.x + 2 || p.x > car.x + 30 || p.z < 1.5 || p.z > 12.5) capture.reseat(p, i); else p.t = 60; });
      A.hp = 400; A.x = car.x + qn('hx', 16); A.z = car.z + qn('hz', -2); A.y = qn('hy', 26); A.vx = A.vz = 0; A.h = h; A.mk.root.position.set(A.x, A.y, A.z);
      const ph = tm % ev, n = Math.floor(tm / ev);
      if (capture.shots) [[0.5, 9, 7], [1.1, 24, 9], [1.7, 16, 4.5]].forEach(([at, dx, zz], i) => { const id = n * 3 + i; if (ph >= at && !capture.shots[id]) { capture.shots[id] = 1; CW.fx.explode(car.x + dx, zz, 5.5); } });
      if (qn('tx', null) !== null) { tx = qn('tx', tx); ty = qn('ty', ty); tz = qn('tz', tz); c.position.set(car.x + qn('px', 0), camh, qn('pz', -8)); }
    }
    c.fov = fov; c.updateProjectionMatrix(); c.lookAt(tx, ty, tz);
    const near = boom ? 7 : market ? 0 : 25;
    CW.traffic.peds.forEach((p) => { if (Math.hypot(p.x - c.position.x, p.z - c.position.z) < near) p.model.visible = false; });   // no bystanders in the evidence frame
    // anything else within 12 m of the lens would hide the subject: hide it (the staged boom cars are exempt)
    CW.vehicles.list.forEach((v) => { if (v !== car && v !== cop && !(capture.chase && v === CW.police.cops[1]) && !(boom && boom.cars.includes(v)) && Math.hypot(v.x - c.position.x, v.z - c.position.z) < 12) v.mesh.visible = false; });
  }

  game.state = 'title';
  CW.title.enter();
  requestAnimationFrame(frame);
  if (capType) captureStart();
  else if (stageQ === 'late') { game.start(false); stageLate(); stageMission(); }
  window.addEventListener('beforeunload', () => { if (game.state === 'play') save(); });
})();
