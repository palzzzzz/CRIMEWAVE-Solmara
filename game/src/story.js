// Story: the 7-mission chain, phone calls + dialogue with portraits, REP progression, map markers, save state.
(function () {
  const CW = window.CW, $ = (id) => document.getElementById(id);
  const S = (CW.story = { idx: 0, state: 'idle', wait: 6, st: 0, timer: 0, count: 0, talk: null, ring: null, log: [], obj: null, retry: false, free: false, target: null, beamT: 0, unread: 0, timeScale: 1 });
  const hs = () => CW.hud.state;
  const cache = {};
  const set = (id, k, v, prop) => { if (cache[id + (prop || '')] !== v) { cache[id + (prop || '')] = v; $(id)[prop || 'textContent'] = v; } };

  // ---- cast + portraits ---------------------------------------------------------------------------------
  const CAST = {
    luna: { name: 'LUNA', role: 'CREW  ·  PLANNER', bg: ['#12a7a0', '#0b4f5c'], shirt: '#37c9b8', skin: '#b9805a' },
    ray: { name: 'RAY', role: 'CREW  ·  DRIVER', bg: ['#ff8a4a', '#7a2a3a'], shirt: '#ff7b54', skin: '#5a3822' },
    teo: { name: 'TEO SALVAGE', role: 'THE FENCE  ·  HARBOUR', bg: ['#d9a85a', '#5a3a22'], shirt: '#6e7a4e', skin: '#d9a070' },
    roxy: { name: 'ROXY', role: 'THE WHEELWOMAN  ·  GARAGE', bg: ['#e8456f', '#4a1a4a'], shirt: '#3f6fb5', skin: '#8d5a3b' },
  };
  S.cast = CAST;
  function poly(x, pts, col) { x.fillStyle = col; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.fill(); }
  function drawPortrait(who, cv) {
    const x = (cv || $('portrait')).getContext('2d'), P = CAST[who];
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, P.bg[0]); g.addColorStop(1, P.bg[1]); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(255,230,160,.22)'; x.beginPath(); x.arc(100, 26, 20, 0, 7); x.fill();
    for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 70 + i * 12, 128, 5); }
    if (who === 'luna') poly(x, [[30, 36], [98, 36], [106, 104], [88, 112], [40, 112], [22, 104]], '#1a1018');
    if (who === 'ray') { x.fillStyle = '#120c08'; x.beginPath(); x.ellipse(64, 38, 36, 30, 0, 0, 7); x.fill(); }
    poly(x, [[8, 128], [20, 100], [44, 92], [84, 92], [108, 100], [120, 128]], P.shirt);
    if (who === 'roxy') { x.fillStyle = '#c9a23a'; x.fillRect(32, 98, 8, 30); x.fillRect(88, 98, 8, 30); }
    if (who === 'teo') poly(x, [[44, 92], [64, 112], [84, 92], [84, 128], [44, 128]], '#4d5a38');
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(53, 78, 22, 20); x.fillStyle = P.skin; x.fillRect(53, 78, 22, 16);
    poly(x, [[40, 38], [88, 38], [92, 62], [81, 86], [64, 93], [47, 86], [36, 62]], P.skin);
    // hair + signature gear
    if (who === 'luna') { poly(x, [[37, 48], [91, 48], [88, 30], [40, 30]], '#1a1018'); poly(x, [[36, 38], [48, 38], [40, 74], [32, 70]], '#1a1018'); poly(x, [[80, 38], [92, 38], [96, 70], [88, 74]], '#1a1018'); x.fillStyle = '#0c0c10'; x.fillRect(43, 56, 42, 11); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(48, 58, 8, 3); x.fillStyle = '#c93a4a'; x.fillRect(56, 77, 16, 4); }
    else if (who === 'ray') { x.fillStyle = '#ff6b4a'; x.fillRect(38, 44, 52, 9); x.fillStyle = '#120c08'; x.fillRect(47, 57, 8, 5); x.fillRect(73, 57, 8, 5); x.fillStyle = 'rgba(30,18,12,.75)'; x.fillRect(48, 76, 32, 8); x.fillStyle = '#e8d8c0'; x.fillRect(56, 80, 16, 2); }
    else if (who === 'teo') { poly(x, [[34, 46], [94, 46], [90, 26], [40, 24]], '#3a4a5a'); x.fillStyle = '#2a3642'; x.fillRect(30, 44, 68, 6); x.fillStyle = '#cfd3d6'; x.fillRect(34, 56, 7, 20); x.fillRect(87, 56, 7, 20); x.fillStyle = '#120c08'; x.fillRect(47, 59, 8, 5); x.fillRect(73, 59, 8, 5); poly(x, [[48, 74], [80, 74], [76, 82], [52, 82]], '#cfd3d6'); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(44, 52, 40, 2); }
    else if (who === 'roxy') { x.fillStyle = '#120c08'; x.beginPath(); x.arc(64, 22, 14, 0, 7); x.fill(); poly(x, [[37, 46], [91, 46], [88, 32], [40, 32]], '#120c08'); x.fillStyle = '#e8312f'; x.fillRect(36, 40, 56, 8); x.fillStyle = '#2a2f33'; x.beginPath(); x.arc(52, 36, 9, 0, 7); x.arc(76, 36, 9, 0, 7); x.fill(); x.fillStyle = '#5fd0d8'; x.beginPath(); x.arc(52, 36, 6, 0, 7); x.arc(76, 36, 6, 0, 7); x.fill(); x.fillStyle = '#120c08'; x.fillRect(47, 60, 8, 5); x.fillRect(73, 60, 8, 5); x.fillStyle = 'rgba(20,12,8,.5)'; x.fillRect(70, 68, 12, 5); x.fillStyle = '#c93a4a'; x.fillRect(56, 77, 16, 4); }
  }

  // ---- contact card (bottom centre): who, role and ONE line of the mission script, shown for a few seconds on start / progress / pass ----
  let cardT = 0, cardWho = '';
  function showCard(who, text, tag) {
    const c = CAST[who]; if (!c) return;
    if (cardWho !== who) { cardWho = who; drawPortrait(who, $('card-pt')); }
    $('card-tag').textContent = tag; $('card-name').textContent = c.name; $('card-role').textContent = c.role; $('card-text').textContent = '“' + text + '”';
    cardT = 5.5;
  }
  S.card = showCard;

  // ---- phone log + calls + dialogue ---------------------------------------------------------------------------------
  function logMsg(who, text) { S.log.unshift({ who, text, t: CW.sky.clock() }); if (S.log.length > 40) S.log.pop(); S.unread++; }
  S.call = function (who, lines, done) {
    S.ring = { who, lines, done, t: 0, rings: 0 };
    $('call-name').textContent = CAST[who].name; $('callin').style.display = 'block';
    lines.forEach((l) => logMsg(l[0], l[1]));
  };
  S.say = function (lines, phone, done) {
    S.talk = { lines, i: 0, t: 0, phone: !!phone, done, hold: 0 };
    $('dlg').style.display = 'flex'; $('dlg').classList.toggle('phone', !!phone); showLine();
  };
  function showLine() {
    const k = S.talk, l = k.lines[k.i], P = CAST[l[0]]; k.t = 0; k.hold = 0;
    drawPortrait(l[0]); $('dlg-name').textContent = P.name; $('dlg-role').textContent = P.role; $('dlg-text').textContent = '';
  }
  function updateTalk(dt) {
    const I = CW.input, k = S.talk, text = k.lines[k.i][1];
    k.t += dt; const n = Math.min(text.length, Math.floor(k.t * 55));
    set('dlg-text', 'dt', text.slice(0, n));
    if (n >= text.length) k.hold += dt;
    const adv = I.pressed('Enter') || I.pressed('NumpadEnter') || k.hold > 1.6 + text.length * 0.03;
    if (I.pressed('Enter') && n < text.length) { k.t = 999; return; }
    if (adv && n >= text.length) { k.i++; if (k.i >= k.lines.length) { $('dlg').style.display = 'none'; S.talk = null; if (k.done) k.done(); } else showLine(); }
  }
  function updateRing(dt) {
    const r = S.ring, I = CW.input; r.t += dt;
    if (Math.floor(r.t / 1.3) > r.rings) { r.rings++; CW.sfx.tone('sine', 880, 880, 0.12, 0.3, 0.9); CW.sfx.tone('sine', 740, 740, 0.12, 0.3, 0.9, 0.16); }
    if (I.pressed('Enter') || r.t > 10) { $('callin').style.display = 'none'; S.ring = null; S.say(r.lines, true, r.done); }
  }

  // ---- REP ------------------------------------------------------------------------------------------------------------------
  S.repNeed = (lv) => 80 + lv * 60;
  S.addRep = function (n, why) {
    const st = hs(); st.repXp += n;
    while (st.rep < 10 && st.repXp >= S.repNeed(st.rep)) { st.repXp -= S.repNeed(st.rep); st.rep++; st.cash += 250 * st.rep; CW.hud.toast('REP LEVEL ' + st.rep + '  ·  BONUS $' + 250 * st.rep); CW.sfx.play('pickup', 1); }
    if (st.rep >= 10) st.repXp = Math.min(st.repXp, S.repNeed(9) - 1);
    st.repNeed = S.repNeed(st.rep);
    if (why && n) CW.hud.toast('+' + n + ' REP  ·  ' + why);
  };

  // ---- missions ------------------------------------------------------------------------------------------------------------------
  const lm = () => CW.world.landmarks;
  const fencePt = () => ({ x: lm().fence.x, z: lm().fence.z + 7 });
  const garagePt = () => ({ x: lm().garage.x, z: lm().garage.z + 7 });
  const foc = () => CW.player.focus();
  const near = (p, r) => { const f = foc(); return Math.hypot(f.x - p.x, f.z - p.z) < r; };
  const obj = (text, mk, n, of) => { S.obj = { text, mk, n, of }; };
  const wantedZero = () => CW.police.level === 0;
  const gangDead = (grp) => CW.enemies.gang.filter((g) => grp.indexOf(g.grp) >= 0 && g.state === 'dead').length;
  function reviveGang(grp) { CW.enemies.gang.forEach((g) => { if (grp.indexOf(g.grp) < 0) return; g.state = 'idle'; g.hp = 60; g.x = g.home.x; g.z = g.home.z; g.prov = false; g.gun.visible = true; g.model.rotation.x = 0; g.vx = g.vz = 0; }); }
  function roofTarget() {
    let best = { h: 0, x: -40, z: -40 };
    for (let x = -220; x <= 60; x += 20) for (let z = -220; z <= 60; z += 20) CW.world.forNear(x, z, 12, (o) => { if (o.t === 0 && o.h > best.h && o.h < 150 && o.x1 - o.x0 > 8 && o.x1 - o.x0 < 60) best = { h: o.h, x: (o.x0 + o.x1) / 2, z: (o.z0 + o.z1) / 2 }; });
    return best;
  }
  const CPS = [{ x: 160, z: -160 }, { x: 0, z: -80 }, { x: -160, z: 160 }];

  const MISSIONS = [
    { t: 'WELCOME TO SOLMARA', who: 'luna', pay: 500, rep: 25, nx: ['Drive it to the Fence yard at the harbour', 'Meet Teo Salvage'],
      brief: [['luna', 'Ray, wake up. Solmara will not rob itself.'], ['luna', 'Teo runs Harbour Fence & Salvage, down at the docks. He buys what we steal and pays in cash.'], ['ray', 'Find a car, find Teo. Got it.']],
      outro: [['teo', 'So you are Luna\'s people. Good. Come back when you have wheels with a story behind them.']],
      begin() { S.st = 0; },
      tick() { const m = CW.player.mode; if (S.st === 0 && m !== 'foot') S.st = 1; const f = fencePt(); obj(S.st ? 'Drive to Harbour Fence & Salvage (the $ diamond)' : 'Get a car: walk up to one and press E', f, S.st, 2); return near(f, 14); } },
    { t: 'FENCE WORK', who: 'teo', pay: 700, rep: 30, nx: ['Steal a second car', 'Collect your pay from Teo'],
      brief: [['teo', 'Two cars. Stolen, not borrowed. Bring them to my yard, stop inside and press G. I do the rest.'], ['teo', 'Hot cars, hot cash. Do not bring cops to my door.']],
      outro: [['teo', 'Clean work. The wheels will not be missed. Roxy wants a word, she has a favour.']],
      begin() { S.count = 0; },
      tick() { const f = fencePt(); obj('Steal cars and sell them at the Fence yard (' + S.count + '/2). Park inside, press G.', f, S.count, 2); return S.count >= 2; } },
    { t: 'SPRAY AND PRAY', who: 'roxy', pay: 900, rep: 35, nx: ['Drive it to Roxy\'s garage', 'Press G in the bay for the free respray', 'Roxy pays out'],
      brief: [['roxy', 'Roxy here. Roxy\'s Repaint. I need a Vesper GT, any colour, so long as it is somebody else\'s.'], ['roxy', 'Bring it in, press G in the bay, and I will respray it free. First one is on the house.']],
      outro: [['roxy', 'Gorgeous. Come back any time heat gets stupid: a fresh coat clears your stars. For a price.']],
      begin() { S.st = 0; S.target = null; S.free = true; },
      tick() { const P = CW.player; if (S.st === 0 && P.mode === 'car' && P.car.type.id === 'sports') { S.st = 1; S.target = P.car; } if (S.st === 1 && (P.mode !== 'car' || P.car !== S.target) && !near(garagePt(), 60)) S.st = 0; const g = garagePt();
        obj(S.st === 0 ? 'Steal a VESPER GT (the low sports coupe)' : S.st === 1 ? 'Drive it into Roxy\'s garage bay (the garage icon), press G' : 'Repaint it', S.st ? g : null, S.st, 3); return S.st === 2; },
      end() { S.free = false; } },
    { t: 'THE COURIER RUN', who: 'luna', pay: 1400, rep: 40, nx: ['Checkpoint 2, then 3. Do not stop', 'Last drop: checkpoint 3', 'Luna pays out'],
      brief: [['luna', 'Timed job. Three drops across town, one hundred and seventy seconds, no stopping.'], ['luna', 'Beachfront, Downtown, then the harbour. Do not get caught.']],
      outro: [['luna', 'Under the clock. You are better at this than Ray said.'], ['ray', 'I heard that.']],
      begin() { S.st = 0; S.timer = 170; },
      tick() { const c = CPS[S.st]; obj('Hit checkpoint ' + (S.st + 1) + ' of 3. Beat the clock!', c, S.st, 3); if (near(c, 11)) { S.st++; CW.sfx.play('pickup', 1); if (S.st >= 3) return true; CW.hud.toast('CHECKPOINT ' + S.st + '/3'); } return false; } },
    { t: 'CABRAL\'S CORNER', who: 'ray', pay: 2000, rep: 50, nx: ['Find the nearest Cabral gunman', 'Finish the last of the crews, then Luna pays out'],
      brief: [['ray', 'The Cabral crews run Downtown and the Westside. They have been squeezing Teo for months.'], ['ray', 'Six of them. Pick a gun: the shop on the boardwalk sells the good stuff. Hold Q for the wheel.']],
      outro: [['luna', 'The Cabrals will not forget this. Neither will Solmara. Check SolFeed.']],
      begin() { reviveGang([1, 2]); },
      tick() { const d = gangDead([1, 2]); const alive = CW.enemies.gang.filter((g) => [1, 2].indexOf(g.grp) >= 0 && g.state !== 'dead'); const f = foc(); let b = null, bd = 1e9; alive.forEach((g) => { const q = Math.hypot(g.x - f.x, g.z - f.z); if (q < bd) { bd = q; b = g; } });
        obj('Take out the Cabral crews, Downtown and Westside (' + d + '/6)', b ? { x: b.x, z: b.z } : null, d, 6); return d >= 6; } },
    { t: 'HOT BAG', who: 'teo', pay: 2500, rep: 60, nx: ['Shake the cops once you have the bag', 'Take the bag to Roxy\'s garage', 'Roxy pays out'],
      brief: [['teo', 'A courier left a bag at the beachfront hotel. Pick it up on foot. Cops will notice, they always do.'], ['teo', 'Shake them, then bring the bag to Roxy\'s garage. Fresh paint, fresh start.']],
      outro: [['roxy', 'Bag, car and a smile. I love my job.']],
      begin() { S.st = 0; S.bag = { x: 180, z: -164 }; },
      tick() { const g = garagePt(); const P = CW.player;
        if (S.st === 0) { obj('Grab the bag at the beachfront hotel (on foot)', S.bag, 0, 3); if (near(S.bag, 4) && P.mode === 'foot') { S.st = 1; CW.police.raise(2.6, 'crime', true); CW.hud.toast('THE BAG IS HOT'); CW.sfx.play('pickup', 1); } }
        else if (S.st === 1) { obj('LOSE THE COPS (break line of sight, hide)', null, 1, 3); if (wantedZero()) S.st = 2; }
        else { obj('Deliver the bag to Roxy\'s garage', g, 2, 3); if (near(g, 12)) return true; } return false; } },
    { t: 'SUNSTONE', who: 'luna', pay: 6000, rep: 100, nx: ['Land on the roof to take the stone', 'Fly back to the pad with the air unit on you', 'Teo pays out'],
      brief: [['luna', 'This is it. The Sunstone, a diamond the size of a fist, in a Downtown penthouse safe.'], ['luna', 'No lobby. We go in through the roof: fly the helicopter off the harbour pad and land on the marked tower.'], ['luna', 'When you have it, the air unit will be on you. Land back on the pad at the harbour. Teo is waiting. Do not crash.'], ['ray', 'I always wanted to fly this thing.']],
      outro: [['teo', 'The Sunstone. In my yard. Solmara will never be the same.'], ['luna', 'Ray, Luna, Solmara. Not bad for a first week. The city is yours: keep the crimewave rolling.']],
      begin() { S.st = 0; S.roof = roofTarget(); S.timer = 0; },
      tick() { const P = CW.player, A = CW.air, pad = { x: A.heli.x, z: A.heli.z };
        if (S.st === 0) { obj(P.mode === 'heli' ? 'Fly to the marked tower and LAND on the roof (SHIFT to descend)' : 'Take the helicopter at the harbour pad (white H)', P.mode === 'heli' ? { x: S.roof.x, z: S.roof.z, y: S.roof.h } : { x: 60, z: 274 }, 0, 3); if (P.mode === 'heli' && Math.hypot(A.heli.x - S.roof.x, A.heli.z - S.roof.z) < 14 && A.heli.y - A.heli.floor < 1.2 && A.heli.floor > 6) { S.st = 1; S.timer = 170; CW.police.raise(3.7, 'crime', true); CW.hud.toast('SUNSTONE SECURED  ·  AIR UNIT INBOUND'); CW.sfx.play('pickup', 1); } if (!S.roofSeen) { S.roofSeen = 1; } }
        else { obj('Fly back and land on the harbour pad, Teo is waiting', { x: 60, z: 274, y: 0 }, 1, 3); const h = A.heli; if (P.mode === 'heli' && Math.hypot(h.x - 60, h.z - 274) < 9 && h.y - h.floor < 1.2) return true; if (P.mode !== 'heli' && near({ x: 60, z: 274 }, 14)) return true; } return false; },
      end() { S.finished = true; } },
  ];
  S.missions = MISSIONS;

  S.start = function () {
    const m = MISSIONS[S.idx]; S.state = 'active'; S.st = 0; S.timer = 0; S.count = 0; S.obj = null;
    if (m.begin) m.begin();
    S.cn = -1;
    const first = m.brief.find((l) => l[0] === m.who) || m.brief[0]; showCard(first[0], first[1], 'NEW JOB');
    CW.hud.banner('CHAPTER ' + (S.idx + 1) + '  ·  ' + m.t, 'MISSION STARTED');
  };
  S.complete = function () {
    const m = MISSIONS[S.idx], st = hs(); st.cash += m.pay; S.addRep(m.rep);
    if (m.end) m.end();
    CW.hud.banner('MISSION PASSED', m.t + '   +$' + m.pay.toLocaleString('en-US') + '   +' + m.rep + ' REP'); CW.sfx.play('mission', 1);
    if (CW.solfeed) CW.solfeed.news('Word is the crew pulled off "' + m.t.toLowerCase() + '". Respect.');
    S.idx++; S.state = 'idle'; S.wait = 12; S.obj = null; S.timer = 0; S.retry = false;
    const lastLine = m.outro[m.outro.length - 1];
    S.say(m.outro, false, () => showCard(lastLine[0], lastLine[1], 'JOB DONE'));
  };
  S.fail = function (why) {
    const m = MISSIONS[S.idx]; if (m.end) m.end();
    CW.sfx.play('fail', 1); CW.hud.banner('MISSION FAILED', why); S.state = 'idle'; S.wait = 10; S.retry = true; S.obj = null; S.timer = 0; S.st = 0;
  };

  // ---- world marker (light beam + ring) and minimap ----------------------------------------------------------------------------------------------------
  let beam = null;
  S.initMarker = function (scene) {
    beam = new THREE.Group();
    const bm = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 90, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    bm.position.y = 45; beam.add(bm);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.3, 28), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; beam.add(ring); beam.userData.ring = ring; beam.visible = false; scene.add(beam);
  };
  // (the minimap mission icon and GPS route are drawn by hud.js from S.obj.mk)

  // ---- save -------------------------------------------------------------------------------------------------------------------------------
  S.serialize = function () { return { idx: S.idx, log: S.log.slice(0, 12) }; };
  S.load = function (s) { S.idx = s && s.idx ? Math.min(s.idx, MISSIONS.length) : 0; S.log = (s && s.log) || []; S.state = 'idle'; S.wait = 6; S.retry = S.idx > 0; };
  S.newGame = function () { S.idx = 0; S.log = []; S.unread = 0; S.state = 'idle'; S.wait = 5; S.retry = false; S.talk = null; S.ring = null; S.obj = null; S.free = false; $('dlg').style.display = 'none'; $('callin').style.display = 'none'; };

  // ---- per-frame --------------------------------------------------------------------------------------------------------------------------------
  S.update = function (dt) {
    const W = CW.police;
    if (S.talk) updateTalk(dt); else if (S.ring) updateRing(dt);
    S.timeScale = S.talk && !S.talk.phone ? 0.45 : 1;
    if (S.state === 'active' && W.ended) S.fail('You went down. Try again');
    if (S.state === 'idle' && !W.ended && S.idx < MISSIONS.length && !S.talk && !S.ring) {
      S.wait -= dt;
      if (S.wait <= 0) {
        const m = MISSIONS[S.idx];
        if (S.retry) { S.call(m.who, [[m.who, 'Let\'s try "' + m.t.toLowerCase() + '" again. Same plan.']], () => S.start()); }
        else S.call(m.who, m.brief, () => S.start());
        S.wait = 99;
      }
    }
    if (S.state === 'active' && !W.ended) {
      const m = MISSIONS[S.idx];
      if (S.timer > 0) { S.timer -= dt; if (S.timer <= 0) { S.fail('Out of time'); return; } }
      if (!S.talk && m.tick()) S.complete();
    }
    // HUD
    const p = $('mission'), on = S.state === 'active' && !!S.obj;
    if (p.style.display !== (on ? 'block' : 'none')) p.style.display = on ? 'block' : 'none';
    if (on) {
      const m = MISSIONS[S.idx], o = S.obj;
      set('m-chapter', 'ch', 'CHAPTER ' + (S.idx + 1) + '/' + MISSIONS.length + '  ·  ' + CAST[m.who].name);
      set('m-title', 'mt', m.t); set('m-obj', 'mo', o.text);
      set('m-pt', 'pt', o.of ? o.n + '/' + o.of : '');
      $('m-barfill').style.width = (o.of ? Math.round(Math.min(1, o.n / o.of) * 100) : 0) + '%';
      set('m-next', 'nx', m.nx && o.of ? '<b>NEXT</b>' + m.nx[Math.min(m.nx.length - 1, Math.floor(o.n / o.of * m.nx.length))] : '', 'innerHTML');
      const tm = $('m-timer'); tm.style.display = S.timer > 0 ? 'block' : 'none'; if (S.timer > 0) { set('m-timer', 'tx', Math.floor(S.timer / 60) + ':' + ('0' + Math.floor(S.timer % 60)).slice(-2)); tm.classList.toggle('low', S.timer < 20); }
    }
    if (on) {   // progress card: the next scripted line of this mission's giver, whenever the stage counter moves
      const m = MISSIONS[S.idx], n = S.obj.n; if (S.cn === -1) S.cn = n; else if (n !== S.cn && n > S.cn) { S.cn = n; const l = m.brief[Math.min(n, m.brief.length - 1)]; showCard(l[0], l[1], 'UPDATE'); } else S.cn = n;
    }
    const hold = CW.hud.hold.indexOf('card') >= 0, cd = $('card');
    if (hold && cardT <= 0) { const m = MISSIONS[Math.min(S.idx, MISSIONS.length - 1)], l = m.brief[m.brief.length - 1]; showCard(l[0], l[1], 'UPDATE'); }
    if (cardT > 0) { cardT = hold ? 5 : cardT - dt; }
    const showC = cardT > 0 && !S.talk && !S.ring; if (cd.classList.contains('show') !== showC) cd.classList.toggle('show', showC);
    $('obj').style.display = on ? 'none' : 'block';   // the mission panel carries the objective while a job is live
    const idle = S.state === 'idle' && S.idx < MISSIONS.length, done = S.idx >= MISSIONS.length;
    set('obj', 'free', done ? 'STORY COMPLETE. Free roam: sell cars, upgrade at Roxy\'s, hit the shops, chase the stars.' : idle ? 'Waiting for the next call... P opens the phone. Free roam until then.' : S.obj ? S.obj.text : 'Free roam.');
    // beam
    const mk = S.state === 'active' && S.obj && S.obj.mk;
    if (beam) { beam.visible = !!mk; if (mk) { beam.position.set(mk.x, mk.y || 0, mk.z); beam.userData.ring.scale.setScalar(1 + Math.sin(performance.now() / 260) * 0.12); } }
  };
})();
