// Arranque, estados del juego (título / juego / pausa), bucle principal y autoguardado.
(function () {
  const CW = window.CW;
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // clarity: render at up to 2x device pixels, max anisotropic filtering on every texture, filmic tone mapping for punchier contrast
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  CW.aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 4);
  // The game's colours are authored for a straight (linear) output, so a stock filmic curve greys them out. Instead the linear
  // tone-mapping slot gets a hue-keeping S-curve (smoothstep blend) with a soft highlight shoulder: deeper shadows, brighter lights.
  THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 LinearToneMapping( vec3 color ) {\n\treturn toneMappingExposure * color;\n}',
    'vec3 LinearToneMapping( vec3 color ) {\n\tvec3 c = toneMappingExposure * color;\n\tvec3 hi = max( c - 0.76, 0.0 );\n\tc = min( c, vec3( 0.76 ) ) + 0.24 * ( 1.0 - exp( -hi / 0.24 ) );\n\tvec3 s = clamp( c, 0.0, 1.0 ); s = s * s * ( 3.0 - 2.0 * s );\n\treturn mix( c, s, 0.6 );\n}');
  renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = 0.97;
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
  CW.brand.buildWall(scene, 252, -266, 0, 40, 21);   // el gran letrero de make.fun al final de la avenida principal (costanera)
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
  document.getElementById('howto').style.zIndex = 30;   // la ayuda también se abre desde la pausa
  CW.title.bind();
  scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach((m) => { ['map', 'emissiveMap'].forEach((k) => { if (m[k] && m[k].anisotropy !== undefined) m[k].anisotropy = CW.aniso; }); }); });

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
    CW.hud.toast('BIENVENIDOS A PUERTO MAREA');
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

  let last = performance.now(), simT = 0, fpsAcc = 0, fpsN = 0, frozen = false, simNow = 0, stepNo = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const ff = capType && FIXED && FREEZE > 0 && qn('skip', 0) ? 10 : 1;   // &skip=1 (with &fixed and &freeze): ten fixed steps per animation frame until the freeze
    for (let i = 0; i < ff && !(frozen && i); i++) frameStep(now);
  }
  function frameStep(now) {
    if (frozen) { renderer.render(scene, CW.camera); return; }   // capture only: &freeze reached, the frame stays put
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (CW.mapscreen.update()) { renderer.render(scene, CW.camera); CW.input.endFrame(); return; }   // M: pantalla de mapa (lee el estado, el mundo se detiene)
    if (game.state === 'play' && !capType && !stageQ) {
      if (PZ.open) { if (CW.input.pressed('Escape')) setPause(false); renderer.render(scene, CW.camera); CW.input.endFrame(); return; }
      const busy = CW.solfeed.open || CW.shops.menu || CW.bigmap.open || CW.weapons.wheelOpen;
      if (CW.input.pressed('Escape') && !busy) { setPause(true); renderer.render(scene, CW.camera); CW.input.endFrame(); return; }
    }
    if (capType && FIXED) { dt = FIXED; simNow += FIXED * 1000; if (window.__reseed) window.__reseed(stepNo++); }   // capture only: &fixed=<dt> makes every frame the same length, wall clock out of the loop
    if (capture) dt *= qn('ts', 1);   // capture only: &ts=<scale> slows the simulation so a burst of screenshots can resolve a fast event
    if (CW.weapons.wheelOpen) dt *= 0.22;   // the weapon wheel slows the world right down
    if (CW.solfeed.open || CW.shops.menu || CW.bigmap.open || CW.mapscreen.open) dt *= 0.05;   // phone + shop menus + the full map nearly freeze it
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
    if (capture && playing) { if (capture.rob) robberyStep(dt); else if (capture.heli) heliStep(dt); else captureStep(dt); }
    if (playing) CW.gunner.update(dt);   // after the car has moved, so Luna stays glued to the seat
    if (capture && playing) { const c = CW.camera; c.updateMatrixWorld(true); }
    CW.world.update(dt, simT);
    const focus = playing ? CW.player.focus() : { x: 245, z: 40 };
    CW.sky.update(dt, focus, CW.camera);
    if (playing) {
      CW.hud.update(dt);
      game.saveT += dt; if (game.saveT > 5) { game.saveT = 0; save(); }
    }
    if (!(capture && FIXED && qn('skip', 0) && FREEZE > 0 && (capture.t || 0) < FREEZE - 0.35)) renderer.render(scene, CW.camera);   // &skip=1: no drawing until just before &freeze, so a slow machine reaches the frame fast
    CW.input.endFrame();
    if (capture && FREEZE > 0 && (capture.t || 0) >= FREEZE) { frozen = true; document.body.classList.add('frozen'); window.__frozen = true; }
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
  // Beachfront chase staging (&chase=<m/s>, all optional): &loc=strip puts the run on the coastal avenue x=240 (&sh=<heading rad, 0 = south>);
  //   &wl=<1-5> wanted stars (default 4); &cops=<2-10> pursuit cruisers in formation behind/around the car; &peds=<n> pedestrians on both pavements;
  //   &scene=1 parked/cruising/wrecked street dressing (follows the strip axis); &near=<m> bystander-hide radius round the lens (default 25).
  //   &hold=dlg keeps a phone-call dialogue box on screen (with card/radio it shows all three); &mission=<n> fills the mission panel.
  //   Determinism: &seed=<n> seeds Math.random, &fixed=<dt s> fixes the frame length (and the performance.now clock), &freeze=<s of chase time> stops the
  //   world there: window.__frozen turns true and the page renders the same last frame for as long as you like.
  const capQ = new URLSearchParams(location.search), stageQ = capQ.get('stage');
  const capType = capQ.get('capture') || (stageQ === 'boom' || stageQ === 'market' ? 'sports' : null);
  let capture = null;
  const qn = (k, d) => { const v = parseFloat(capQ.get(k)); return isFinite(v) ? v : d; };
  const FIXED = capType ? qn('fixed', 0) : 0, FREEZE = capType ? qn('freeze', 0) : 0;
  function stageDeterminism() {
    // (&seed is applied by the inline script in index.html, before any module binds Math.random)
    if (FIXED) performance.now = () => simNow;
  }
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
  // ?capture=robbery: asalto a la joyería (staging con lo que ya existe: tienda, cliente/cajero, pickups de efectivo, W.raise, patrulla).
  //   &wl=<1-5> &hr=<hora> &cam=<lado> &camh &camf &fov &look=<u>,<v>,<y> &say=<texto del subtítulo>
  function robberyStart() {
    stageDeterminism();
    game.start(false);
    const P = CW.player, W = CW.police, shop = CW.shops.list.find((s) => s.kind === 'boutique') || CW.shops.list[0];
    const FV = qn('flip', 1) ? -1 : 1, J = CW.stage.jewelry(shop, CW.scene, FV < 0);
    CW.sky.hour = qn('hr', 21.6); CW.weather.set('clear');
    W.dispT = 1e9; W.rbT = 1e9; W.busted = function () {};
    CW.story.wait = 1e9;   // sin llamada de misión durante la toma
    W.raise(qn('sev', 4.8), 'shots', true);   // sistema real: sube el nivel, avisa por radio, genera la respuesta
    CW.story.say([['ray', capQ.get('say') || '¡Todos quietos! ¡Las manos donde pueda verlas!']], false);
    // cash on the counter: the existing 'cash' pickups, lifted to counter height every frame
    const cash = []; [[3.0, -1.4], [3.2, -0.2], [2.9, 0.9]].forEach(([u, v]) => { CW.enemies.drop(shop.cx + u, shop.cz + v, 'cash'); cash.push(CW.enemies.pickups[CW.enemies.pickups.length - 1]); });
    capture = { rob: J, FV, t: 0, shop, cash, wl: CW.clamp(Math.round(qn('wl', 5)), 1, 5) };
    document.body.classList.add('capture');
    ['bannerwrap'].forEach((id) => { document.getElementById(id).style.visibility = 'hidden'; });
  }
  function robberyStep(dt) {
    const J = capture.rob, shop = capture.shop, W = CW.police, st = CW.hud.state, P = CW.player, c = CW.camera, cx = shop.cx, cz = shop.cz;
    capture.t += dt;
    const lk = (capQ.get('look') || '-1.2,0.9,1.2').split(',').map(Number), FV0 = capture.FV; FV = capture.FV, cu = qn('cu', 8.6), cv = qn('cv', -4.4) * FV, ch = qn('camh', 3.0);
    const camX = cx + cu, camZ = cz + cv;
    st.hp = 100; P.mode = 'foot'; P.car = null;
    W.heat = capture.wl; W.level = capture.wl; W.lostT = 0; W.bust = 0; W.seen = true; st.wanted = capture.wl;
    // the protagonist: Ray with the pistol out, aimed at the clerk behind the counter
    const ray = P.crew.ray, ru = ray.model.userData, rx = cx + qn('ru', 0.3), rz = cz + qn('rv', 0.2) * FV;
    P.active = ray; ray.model.visible = true; P.crew.luna.model.visible = false;
    ray.x = rx; ray.z = rz; ray.vx = ray.vz = 0; ray.h = Math.atan2(cx + 4.4 - rx, cz + 0.2 * FV - rz); ray.model.position.set(rx, 0, rz); ray.model.rotation.y = ray.h;
    ru.setPose('ray-pistol'); if (ru.guns) { ru.guns.pistol.visible = true; if (ru.guns.pistol.userData.flash) ru.guns.pistol.userData.flash.visible = false; }
    ray.cig.visible = false;
    CW.stage.pose(J, camX, camZ);
    // the cruiser pulls up outside the door (existing cop car, flashing)
    const fleet = W.cops.slice(0, qn('cops', 2)); capture.fleet = fleet;
    W.cops.forEach((q) => { if (!fleet.includes(q) && !q.hidden) { q.hidden = true; q.cs = 'idle'; } });
    const pos = [[qn('pu', -8.8), qn('pv', 0.3) * FV, qn('ph', 1.45)], [-12.6, -3.4 * FV, 1.2]];
    fleet.forEach((q, i) => { q.hidden = false; q.awake = true; q.cs = 'roadblock'; q.rbMin = 1e9; q.hp = 100; q.ai = q.ai || { cruise: 0, off: 0 }; q.x = cx + pos[i][0]; q.z = cz + pos[i][1]; q.h = pos[i][2]; q.vx = q.vz = 0; q.speed = 0; q.mesh.position.set(q.x, 0, q.z); q.mesh.rotation.y = q.h; });
    capture.cash.forEach((p, i) => { p.on = true; p.life = 99; if (p.mesh.children[1]) p.mesh.children[1].visible = false; if (p.mesh.children[2]) p.mesh.children[2].visible = false; if (i && p.mesh.children[3]) p.mesh.children[3].visible = false; p.mesh.position.set(cx + [3.0, 3.2, 2.9][i], 1.55, cz + [-1.4, -0.2, 0.9][i] * 1); });
    c.position.set(camX, ch, camZ); c.fov = qn('fov', 56); c.updateProjectionMatrix(); c.lookAt(cx + lk[0], lk[2], cz + lk[1] * FV0);
    shop.group.children.forEach((o) => { if (o.isMesh && o.visible && Math.hypot(cx + o.position.x - c.position.x, cz + o.position.z - c.position.z) < 2.6 && Math.abs(o.position.y - c.position.y) < 2.6) o.visible = false; });   // nothing between the lens and the scene
    document.getElementById('prompt').style.visibility = 'hidden';
    CW.traffic.peds.forEach((p) => { if (Math.hypot(p.x - c.position.x, p.z - c.position.z) < 30) p.model.visible = false; });
    CW.vehicles.list.forEach((v) => { if (!fleet.includes(v) && Math.hypot(v.x - c.position.x, v.z - c.position.z) < 9) v.mesh.visible = false; });
  }
  // ?capture=heli: el helicóptero policial sobre la costanera de noche, con el reflector, mirando al letrero de make.fun
  function heliStart() {
    stageDeterminism();
    game.start(false);
    const W = CW.police, A = CW.air.policeHeli;
    CW.sky.hour = qn('hr', 22.4); CW.weather.set('clear'); CW.story.wait = 1e9;
    W.dispT = 1e9; W.rbT = 1e9; W.busted = function () {};
    W.raise(qn('sev', 4.5), 'shots', true);
    A.active = true; A.state = 'orbit'; A.hp = 400; A.leaveT = 0; A.vx = A.vz = A.vy = 0; A.mk.root.visible = true; A.cone.visible = true; A.disc.visible = true;
    capture = { heli: true, t: 0 };
    document.body.classList.add('capture');
    if (capQ.get('hud') === '0') document.getElementById('hud').style.visibility = 'hidden';
    ['bannerwrap', 'toast'].forEach((id) => { document.getElementById(id).style.visibility = 'hidden'; });
  }
  function heliStep(dt) {
    const A = CW.air.policeHeli, W = CW.police, st = CW.hud.state, P = CW.player, c = CW.camera, e = P.active;
    capture.t += dt; st.hp = 100; W.heat = 5; W.level = 5; W.seen = true; W.lostT = 0; st.wanted = 5; W.bust = 0;
    const px = qn('px', 240), pz = qn('pz', -196);
    P.mode = 'foot'; e.x = px; e.z = pz; e.vx = e.vz = 0; e.model.position.set(px, 0, pz); e.model.visible = false; P.crew.luna.model.visible = false;
    A.hp = 400; A.state = 'orbit'; A.x = qn('hx', 229); A.z = qn('hz', -212); A.y = qn('hy', 25); A.vx = A.vz = A.vy = 0; A.h = qn('hh', 0.5); A.spot.x = A.x + 1; A.spot.z = A.z + 8; A.sees = true;
    A.mk.root.position.set(A.x, A.y, A.z); A.mk.root.rotation.set(0, A.h, 0);
    c.position.set(qn('cx', 236), qn('ch', 2.2), qn('cz', -170)); c.fov = qn('fov', 60); c.updateProjectionMatrix(); c.lookAt(qn('tx', 246), qn('ty', 17), qn('tz', -240));
    CW.traffic.peds.forEach((p) => { if (Math.hypot(p.x - c.position.x, p.z - c.position.z) < 25) p.model.visible = false; });
    CW.vehicles.list.forEach((v) => { if (Math.hypot(v.x - c.position.x, v.z - c.position.z) < 10) v.mesh.visible = false; });
  }
  // ?stage=map&idx=<0-7>: pantalla de mapa con el progreso de ese capítulo
  function stageMap() { game.start(false); CW.story.idx = CW.clamp(Math.round(qn('idx', 5)), 0, CW.story.missions.length); CW.story.state = 'idle'; CW.story.wait = 1e9; CW.sky.hour = qn('hr', 21); CW.mapscreen.toggle(true); }

  function captureStart() {
    if (capType === 'robbery') return robberyStart();
    if (capType === 'heli') return heliStart();
    stageDeterminism();
    const type = capType === 'sports' || !CW.CAR_TYPES[capType] ? (capType === 'sedan' ? 'sedan' : 'sports') : capType;
    game.start(false);
    if (stageQ === 'late') stageLate();
    stageMission();
    if (CW.hud.hold.indexOf('dlg') >= 0) CW.story.say([['luna', capQ.get('say') || 'Cinco estrellas y un helicóptero, Ray. No bajes de cien.']], true);   // staging: a phone call held open over the chase
    const P = CW.player, W = CW.police, beach = capQ.get('loc') === 'beach', strip = capQ.get('loc') === 'strip';
    const S = strip ? { x: 240 - CW.C.LANE * Math.cos(qn('sh', 0)), z: 0, h: qn('sh', 0) } : beach ? CW.world.spawn : { x: stageQ === 'boom' ? -64 : stageQ === 'market' ? 258 : -6, z: stageQ === 'market' ? 6.5 : 2.7, h: Math.PI / 2 };   // DOWNTOWN: east-bound lane of the z=0 avenue, just short of the x=0 junction (clear sight line down the cross street)
    const h = S.h, sn = Math.sin(h), cs = Math.cos(h);
    const R = { x: -cs, z: sn };   // car-right (passenger side), as used by gunner.js
    const car = CW.vehicles.add(type, CW.CAR_TYPES[type].colors[0], S.x, S.z, h);
    CW.vehicles.enter(car); P.mode = 'car'; P.car = car; P.crew.ray.model.visible = false;
    car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = h;
    CW.sky.hour = qn('hr', 17.2);
    capture = { car, cop: W.cops[0], R, h, chase: qn('chase', 0), side: qn('cam', 3.4), camh: qn('camh', 0.9), camf: qn('camf', 6.4), fov: qn('fov', 40), boom: null, beach, axisX: strip ? 240 : null };
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
    if (capQ.get('nobanner') === '1') ['bannerwrap', 'toast'].forEach((id) => { document.getElementById(id).style.visibility = 'hidden'; });   // staging: the district banner and the toast stay out of the heli's way
  }
  // &peds=<n>: n pedestrians planted on both pavements (10 m off the avenue axis) around where the car will be at &freeze, alert and running in place;
  // positions are absolute, so the frozen frame is the same every run
  function stagePeds(car, v, sn, cs, R, dt) {
    const T = CW.traffic, n = Math.min(T.peds.length, Math.round(qn('peds', 0)));
    if (!capture.pedZero) capture.pedZero = { x: car.x, z: car.z };
    // the car really covers about twice &chase per second (vehicles.js integrates its velocity on top of the staged step), so measure the true ground speed
    if (capture.pp && capture.pf > 2) { const e = Math.hypot(car.x - capture.pp.x, car.z - capture.pp.z) / dt; if (e > 1) capture.eff = e; }
    capture.pp = { x: car.x, z: car.z }; capture.pf = (capture.pf || 0) + 1;
    const z0 = capture.pedZero, tf = qn('freeze', 3), ve = capture.eff || 2 * v;
    for (let i = 0; i < n; i++) {
      const cross = i % 4 === 3;   // every fourth one is caught in the road, bolting across it
      const p = T.peds[i], side = i % 2 ? 1 : -1, back = 6 + (i * 37 % 61) * 0.7 + (i % 3), lat = cross ? -2 + (i * 7 % 9) * 0.7 : 10.4 + (i % 4) * 0.5 + (i % 5 === 0 ? 1.6 : 0);
      const ax = z0.x + sn * ve * tf - sn * back, az = z0.z + cs * ve * tf - cs * back;   // a point on the car's track `back` metres behind where it will be at freeze
      p.state = 'flee'; p.t = 60; p.hp = 100; p.model.visible = true; p.model.rotation.x = 0;
      p.fx = R.x * side * (cross ? 1.4 : 0.9) - sn * 0.3; p.fz = R.z * side * (cross ? 1.4 : 0.9) - cs * 0.3; p.vx = p.fx * 3; p.vz = p.fz * 3; p.h = Math.atan2(p.fx, p.fz);
      p.x = (capture.axisX !== null ? capture.axisX : ax) + R.x * side * lat; p.z = az + R.z * side * lat;
      if (capture.axisX === null) p.x = ax + R.x * side * lat;
      p.model.position.set(p.x, 0, p.z); p.model.rotation.y = p.h;
    }
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
      const wl = CW.clamp(Math.round(qn('wl', 4)), 1, 5), nC = capture.chase ? CW.clamp(Math.round(qn('cops', 2)), 2, W.cops.length) : 1, fleet = W.cops.slice(0, nC);
      W.heat = wl; W.level = wl; W.lostT = 0; W.bust = 0; W.seen = true; st.wanted = wl;
      capture.fleet = fleet;
      W.cops.forEach((q) => { if (!fleet.includes(q) && !q.hidden) { q.hidden = true; q.cs = 'idle'; } });
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
        const offs = [[qn('c1', 9), qn('c1s', 3.0)], [qn('c2', 16), qn('c2s', 2.2)], [19, 3.0], [26, -3.0], [33, 2.6], [40, -2.6], [47, 3.0], [54, -2.2], [61, 2.8], [68, -2.8]];   // first two on Luna's side so her line of fire does not cross our own hull; the rest fan out across the avenue
        fleet.forEach((q, i) => {
          q.hidden = false; q.awake = true; q.cs = 'pursuit'; q.hp = 100; q.ai = q.ai || { cruise: 0, off: 0 };
          q.x = car.x - sn * offs[i][0] + R.x * offs[i][1]; q.z = car.z - cs * offs[i][0] + R.z * offs[i][1]; q.h = h; q.vx = sn * v; q.vz = cs * v; q.speed = v;
          q.mesh.position.set(q.x, 0, q.z); q.mesh.rotation.y = h;
        });
        capture.t = (capture.t || 0) + dt;
        if (qn('peds', 0)) stagePeds(car, v, sn, cs, R, dt);
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
            if (capture.axisX !== null) { v.x = capture.axisX + R.x * s.z - sn * s.back; v.z = car.z - cs * s.back; } else { v.x = car.x - s.back; v.z = s.z; }   // strip: lateral offset measured from the avenue axis, along-track relative to the car
            v.h = s.hh; v.vx = v.vz = 0; v.speed = 0;
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
    const near = boom ? 7 : market ? 0 : qn('near', 25);
    CW.traffic.peds.forEach((p) => { if (Math.hypot(p.x - c.position.x, p.z - c.position.z) < near) p.model.visible = false; });   // no bystanders in the evidence frame
    // anything else within 12 m of the lens would hide the subject: hide it (the staged boom cars are exempt)
    CW.vehicles.list.forEach((v) => { if (v !== car && v !== cop && !(capture.fleet && capture.chase && capture.fleet.includes(v)) && !(boom && boom.cars.includes(v)) && Math.hypot(v.x - c.position.x, v.z - c.position.z) < 12) v.mesh.visible = false; });
  }

  // ?stage=garage  puts Ray in a car (&car=sports) at Roxy's yard and opens the car-mod bay straight away (&hr=<hour>, &sp= &ne= &wh= preset mods).
  function stageGarage() {
    game.start(false);
    const P = CW.player, V = CW.vehicles, g = CW.world.landmarks.garage, type = CW.CAR_TYPES[capQ.get('car')] ? capQ.get('car') : 'sports';
    const car = V.add(type, CW.CAR_TYPES[type].colors[0], g.x, g.z + 2, 0);
    V.enter(car); P.mode = 'car'; P.car = car; P.crew.ray.model.visible = false; car.mesh.position.set(car.x, 0, car.z);
    CW.sky.hour = qn('hr', 14.5);
    car.owned = true; car.stolen = false; CW.police.dispT = 1e9; CW.police.rbT = 1e9; CW.police.busted = function () {}; CW.police.clear(false);   // staging: no heat from the borrowed car
    car.mods = CW.carmods.blank(); car.mods.sp = qn('sp', 0); car.mods.ne = qn('ne', 0); car.mods.wh = qn('wh', 0); CW.carmods.refresh(car);
    CW.shops.stageOpen = true;
  }
  // ---- pausa (ESC en juego): REANUDAR, MAPA Y MISIONES, CÓMO JUGAR, SONIDO, SALIR AL MENÚ -----------------------------------
  const PZ = (CW.pause = { open: false });
  const $p = (id) => document.getElementById(id);
  function setPause(v) { PZ.open = v; $p('pause').style.display = v ? 'flex' : 'none'; if (v) { if (document.exitPointerLock) document.exitPointerLock(); CW.title.refreshOptions(); } }
  $p('p-resume').addEventListener('click', () => setPause(false));
  $p('p-map').addEventListener('click', () => CW.mapscreen.toggle(true));
  $p('p-how').addEventListener('click', () => { $p('howto').style.display = 'flex'; });
  $p('p-sound').addEventListener('click', () => CW.title.toggleSound());
  $p('p-menu').addEventListener('click', () => { save(); location.reload(); });
  $p('howto-close').addEventListener('click', () => { $p('howto').style.display = 'none'; });

  game.state = 'title';
  CW.title.enter();
  requestAnimationFrame(frame);
  if (stageQ === 'garage') stageGarage();
  else if (stageQ === 'map') stageMap();
  else if (capType) captureStart();
  else if (stageQ === 'late') { game.start(false); stageLate(); stageMission(); }
  window.addEventListener('beforeunload', () => { if (game.state === 'play') save(); });
})();
