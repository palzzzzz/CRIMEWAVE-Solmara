// Story: the 7-mission chain, phone calls + dialogue with portraits, REP progression, map markers, save state.
(function () {
  const CW = window.CW, $ = (id) => document.getElementById(id);
  const S = (CW.story = { idx: 0, state: 'idle', wait: 6, st: 0, timer: 0, count: 0, talk: null, ring: null, log: [], obj: null, retry: false, free: false, target: null, beamT: 0, unread: 0, timeScale: 1 });
  const hs = () => CW.hud.state;
  const cache = {};
  const set = (id, k, v, prop) => { if (cache[id + (prop || '')] !== v) { cache[id + (prop || '')] = v; $(id)[prop || 'textContent'] = v; } };

  // ---- cast + portraits ---------------------------------------------------------------------------------
  const CAST = {
    luna: { name: 'LUNA', role: 'EQUIPO  ·  PLANIFICADORA', bg: ['#12a7a0', '#0b4f5c'], shirt: '#37c9b8', skin: '#b9805a' },
    ray: { name: 'RAY', role: 'EQUIPO  ·  CONDUCTOR', bg: ['#ff8a4a', '#7a2a3a'], shirt: '#ff7b54', skin: '#5a3822' },
    teo: { name: 'TEO SALVADOR', role: 'EL RECEPTADOR  ·  PUERTO', bg: ['#d9a85a', '#5a3a22'], shirt: '#6e7a4e', skin: '#d9a070' },
    roxy: { name: 'ROXY', role: 'LA MECÁNICA  ·  GARAJE', bg: ['#e8456f', '#4a1a4a'], shirt: '#3f6fb5', skin: '#8d5a3b' },
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
    if (CW.hud.hold.indexOf('dlg') >= 0) return;   // capture/staging only (?hold=dlg): the line types out and then stays on screen
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
    while (st.rep < 10 && st.repXp >= S.repNeed(st.rep)) { st.repXp -= S.repNeed(st.rep); st.rep++; st.cash += 250 * st.rep; CW.hud.toast('NIVEL DE REP ' + st.rep + '  ·  BONO $' + 250 * st.rep); CW.sfx.play('pickup', 1); }
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
    { t: 'BIENVENIDOS A PUERTO MAREA', who: 'luna', pay: 500, rep: 25, nx: ['Llévalo a la chatarrería del puerto', 'Conoce a Teo Salvador'],
      brief: [['luna', 'Ray, despierta. Puerto Marea no se va a robar solo.'], ['luna', 'Teo lleva la Chatarrería El Puerto, allá en los muelles. Compra lo que robamos y paga en efectivo.'], ['ray', 'Buscar un auto, buscar a Teo. Entendido.']],
      outro: [['teo', 'Así que eres de la gente de Luna. Bien. Vuelve cuando tengas autos con historia.']],
      begin() { S.st = 0; },
      tick() { const m = CW.player.mode; if (S.st === 0 && m !== 'foot') S.st = 1; const f = fencePt(); obj(S.st ? 'Maneja hasta la Chatarrería El Puerto (el diamante $)' : 'Consigue un auto: acércate a uno y presiona E', f, S.st, 2); return near(f, 14); } },
    { t: 'ENTREGA DE AUTOS', who: 'teo', pay: 700, rep: 30, nx: ['Roba un segundo auto', 'Cobra tu pago a Teo'],
      brief: [['teo', 'Dos autos. Robados, no prestados. Tráelos a mi patio, detente adentro y presiona G. Yo hago el resto.'], ['teo', 'Autos calientes, dinero caliente. No traigas policías a mi puerta.']],
      outro: [['teo', 'Trabajo limpio. Nadie va a extrañar esas ruedas. Roxy quiere hablar contigo, tiene un favor.']],
      begin() { S.count = 0; },
      tick() { const f = fencePt(); obj('Roba autos y véndelos en el patio del receptador (' + S.count + '/2). Estaciona adentro, presiona G.', f, S.count, 2); return S.count >= 2; } },
    { t: 'PINTURA Y PLEGARIA', who: 'roxy', pay: 900, rep: 35, nx: ['Llévalo al garaje de Roxy', 'Presiona G en el taller para el repintado gratis', 'Roxy te paga'],
      brief: [['roxy', 'Habla Roxy. Necesito un Vesper GT, del color que sea, mientras sea de otro.'], ['roxy', 'Tráelo, presiona G en el taller y te lo repinto gratis. El primero va por la casa.']],
      outro: [['roxy', 'Hermoso. Vuelve cuando la cosa se ponga fea: una mano de pintura te borra las estrellas. Con costo.']],
      begin() { S.st = 0; S.target = null; S.free = true; },
      tick() { const P = CW.player; if (S.st === 0 && P.mode === 'car' && P.car.type.id === 'sports') { S.st = 1; S.target = P.car; } if (S.st === 1 && (P.mode !== 'car' || P.car !== S.target) && !near(garagePt(), 60)) S.st = 0; const g = garagePt();
        obj(S.st === 0 ? 'Roba un VESPER GT (el cupé deportivo bajo)' : S.st === 1 ? 'Llévalo al taller de Roxy (el ícono del garaje), presiona G' : 'Repíntalo', S.st ? g : null, S.st, 3); return S.st === 2; },
      end() { S.free = false; } },
    { t: 'LA CARRERA DEL MENSAJERO', who: 'luna', pay: 1400, rep: 40, nx: ['Punto 2, luego el 3. No te detengas', 'Última entrega: punto 3', 'Luna te paga'],
      brief: [['luna', 'Trabajo contrarreloj. Tres entregas por la ciudad, ciento setenta segundos, sin parar.'], ['luna', 'La costanera, el centro y luego el puerto. Que no te atrapen.']],
      outro: [['luna', 'Dentro del tiempo. Eres mejor de lo que dijo Ray.'], ['ray', 'Te oí.']],
      begin() { S.st = 0; S.timer = 170; },
      tick() { const c = CPS[S.st]; obj('Llega al punto ' + (S.st + 1) + ' de 3. ¡Gana al reloj!', c, S.st, 3); if (near(c, 11)) { S.st++; CW.sfx.play('pickup', 1); if (S.st >= 3) return true; CW.hud.toast('PUNTO ' + S.st + '/3'); } return false; } },
    { t: 'LA ESQUINA DE LOS CABRAL', who: 'ray', pay: 2000, rep: 50, nx: ['Busca al pistolero Cabral más cercano', 'Acaba con las últimas bandas y Luna te paga'],
      brief: [['ray', 'Las bandas Cabral controlan el centro y el oeste. Llevan meses apretando a Teo.'], ['ray', 'Son seis. Elige un arma: la tienda del malecón vende lo bueno. Mantén Q para la rueda.']],
      outro: [['luna', 'Los Cabral no lo van a olvidar. Puerto Marea tampoco. Mira SolFeed.']],
      begin() { reviveGang([1, 2]); },
      tick() { const d = gangDead([1, 2]); const alive = CW.enemies.gang.filter((g) => [1, 2].indexOf(g.grp) >= 0 && g.state !== 'dead'); const f = foc(); let b = null, bd = 1e9; alive.forEach((g) => { const q = Math.hypot(g.x - f.x, g.z - f.z); if (q < bd) { bd = q; b = g; } });
        obj('Elimina a las bandas Cabral, centro y oeste (' + d + '/6)', b ? { x: b.x, z: b.z } : null, d, 6); return d >= 6; } },
    { t: 'BOLSA CALIENTE', who: 'teo', pay: 2500, rep: 60, nx: ['Despista a la policía cuando tengas la bolsa', 'Lleva la bolsa al garaje de Roxy', 'Roxy te paga'],
      brief: [['teo', 'Un mensajero dejó una bolsa en el hotel de la costanera. Recógela a pie. La policía se dará cuenta, siempre lo hace.'], ['teo', 'Despístalos y lleva la bolsa al garaje de Roxy. Pintura nueva, vida nueva.']],
      outro: [['roxy', 'Bolsa, auto y una sonrisa. Amo mi trabajo.']],
      begin() { S.st = 0; S.bag = { x: 180, z: -164 }; },
      tick() { const g = garagePt(); const P = CW.player;
        if (S.st === 0) { obj('Toma la bolsa en el hotel de la costanera (a pie)', S.bag, 0, 3); if (near(S.bag, 4) && P.mode === 'foot') { S.st = 1; CW.police.raise(2.6, 'crime', true); CW.hud.toast('LA BOLSA ESTÁ CALIENTE'); CW.sfx.play('pickup', 1); } }
        else if (S.st === 1) { obj('DESPISTA A LA POLICÍA (rompe la línea de visión, escóndete)', null, 1, 3); if (wantedZero()) S.st = 2; }
        else { obj('Entrega la bolsa en el garaje de Roxy', g, 2, 3); if (near(g, 12)) return true; } return false; } },
    { t: 'PIEDRA DEL SOL', who: 'luna', pay: 6000, rep: 100, nx: ['Aterriza en la azotea para tomar la piedra', 'Vuela de regreso a la plataforma con la unidad aérea encima', 'Teo te paga'],
      brief: [['luna', 'Este es el golpe. La Piedra del Sol, un diamante del tamaño de un puño, en la caja fuerte de un penthouse del centro.'], ['luna', 'Sin vestíbulo. Entramos por el techo: vuela el helicóptero desde la plataforma del puerto y aterriza en la torre marcada.'], ['luna', 'Cuando la tengas, la unidad aérea te va a seguir. Aterriza de nuevo en la plataforma del puerto. Teo te espera. No te estrelles.'], ['ray', 'Siempre quise pilotar esta cosa.']],
      outro: [['teo', 'La Piedra del Sol. En mi patio. Puerto Marea nunca volverá a ser igual.'], ['luna', 'Ray, Luna, Puerto Marea. Nada mal para una primera semana. La ciudad es tuya: que siga la marea criminal.']],
      begin() { S.st = 0; S.roof = roofTarget(); S.timer = 0; },
      tick() { const P = CW.player, A = CW.air, pad = { x: A.heli.x, z: A.heli.z };
        if (S.st === 0) { obj(P.mode === 'heli' ? 'Vuela hasta la torre marcada y ATERRIZA en la azotea (SHIFT para descender)' : 'Toma el helicóptero en la plataforma del puerto (la H blanca)', P.mode === 'heli' ? { x: S.roof.x, z: S.roof.z, y: S.roof.h } : { x: 60, z: 274 }, 0, 3); if (P.mode === 'heli' && Math.hypot(A.heli.x - S.roof.x, A.heli.z - S.roof.z) < 14 && A.heli.y - A.heli.floor < 1.2 && A.heli.floor > 6) { S.st = 1; S.timer = 170; CW.police.raise(3.7, 'crime', true); CW.hud.toast('PIEDRA DEL SOL ASEGURADA  ·  UNIDAD AÉREA EN CAMINO'); CW.sfx.play('pickup', 1); } if (!S.roofSeen) { S.roofSeen = 1; } }
        else { obj('Vuela de regreso y aterriza en la plataforma del puerto, Teo te espera', { x: 60, z: 274, y: 0 }, 1, 3); const h = A.heli; if (P.mode === 'heli' && Math.hypot(h.x - 60, h.z - 274) < 9 && h.y - h.floor < 1.2) return true; if (P.mode !== 'heli' && near({ x: 60, z: 274 }, 14)) return true; } return false; },
      end() { S.finished = true; } },
  ];
  S.missions = MISSIONS;

  S.start = function () {
    const m = MISSIONS[S.idx]; S.state = 'active'; S.st = 0; S.timer = 0; S.count = 0; S.obj = null;
    if (m.begin) m.begin();
    S.cn = -1;
    const first = m.brief.find((l) => l[0] === m.who) || m.brief[0]; showCard(first[0], first[1], 'NUEVO TRABAJO');
    CW.hud.banner('CAPÍTULO ' + (S.idx + 1) + '  ·  ' + m.t, 'MISIÓN INICIADA');
  };
  S.complete = function () {
    const m = MISSIONS[S.idx], st = hs(); st.cash += m.pay; S.addRep(m.rep);
    if (m.end) m.end();
    CW.hud.banner('¡MISIÓN CUMPLIDA!', m.t + '   +$' + m.pay.toLocaleString('en-US') + '   +' + m.rep + ' REP'); CW.sfx.play('mission', 1);
    if (CW.solfeed) CW.solfeed.news('Dicen que el equipo sacó adelante "' + m.t.toLowerCase() + '". Respeto.');
    S.idx++; S.state = 'idle'; S.wait = 12; S.obj = null; S.timer = 0; S.retry = false;
    const lastLine = m.outro[m.outro.length - 1];
    S.say(m.outro, false, () => showCard(lastLine[0], lastLine[1], 'TRABAJO HECHO'));
  };
  S.fail = function (why) {
    const m = MISSIONS[S.idx]; if (m.end) m.end();
    CW.sfx.play('fail', 1); CW.hud.banner('MISIÓN FALLIDA', why); S.state = 'idle'; S.wait = 10; S.retry = true; S.obj = null; S.timer = 0; S.st = 0;
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
    if (S.state === 'active' && W.ended) S.fail('Caíste. Inténtalo de nuevo');
    if (S.state === 'idle' && !W.ended && S.idx < MISSIONS.length && !S.talk && !S.ring) {
      S.wait -= dt;
      if (S.wait <= 0) {
        const m = MISSIONS[S.idx];
        if (S.retry) { S.call(m.who, [[m.who, 'Probemos "' + m.t.toLowerCase() + '" otra vez. Mismo plan.']], () => S.start()); }
        else S.call(m.who, m.brief, () => S.start());
        S.wait = 99;
      }
    }
    if (S.state === 'active' && !W.ended) {
      const m = MISSIONS[S.idx];
      if (S.timer > 0) { S.timer -= dt; if (S.timer <= 0) { S.fail('Se acabó el tiempo'); return; } }
      const done = !S.talk || CW.hud.hold.indexOf('dlg') >= 0 ? m.tick() : false;   // (?hold=dlg staging keeps the objective ticking under the held call, so the mission panel fills)
      if (!S.talk && done) S.complete();
    }
    // HUD
    const p = $('mission'), on = S.state === 'active' && !!S.obj;
    if (p.style.display !== (on ? 'block' : 'none')) p.style.display = on ? 'block' : 'none';
    if (on) {
      const m = MISSIONS[S.idx], o = S.obj;
      if (S.iconIdx !== S.idx) { S.iconIdx = S.idx; const ic = $('m-icon'), g = ic.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 100, 100); g.translate(50, 50); CW.brand.missionIcon(g, S.idx, 30, '#ffffff', '#0f1236'); }   // this chapter's own icon
      set('m-chapter', 'ch', 'CAPÍTULO ' + (S.idx + 1) + '/' + MISSIONS.length + '  ·  ' + CAST[m.who].name);
      set('m-title', 'mt', m.t); set('m-obj', 'mo', o.text);
      set('m-pt', 'pt', o.of ? o.n + '/' + o.of : '');
      $('m-barfill').style.width = (o.of ? Math.round(Math.min(1, o.n / o.of) * 100) : 0) + '%';
      set('m-next', 'nx', m.nx && o.of ? '<b>SIGUIENTE</b>' + m.nx[Math.min(m.nx.length - 1, Math.floor(o.n / o.of * m.nx.length))] : '', 'innerHTML');
      const tm = $('m-timer'); tm.style.display = S.timer > 0 ? 'block' : 'none'; if (S.timer > 0) { set('m-timer', 'tx', Math.floor(S.timer / 60) + ':' + ('0' + Math.floor(S.timer % 60)).slice(-2)); tm.classList.toggle('low', S.timer < 20); }
    }
    if (on) {   // progress card: the next scripted line of this mission's giver, whenever the stage counter moves
      const m = MISSIONS[S.idx], n = S.obj.n; if (S.cn === -1) S.cn = n; else if (n !== S.cn && n > S.cn) { S.cn = n; const l = m.brief[Math.min(n, m.brief.length - 1)]; showCard(l[0], l[1], 'NOVEDAD'); } else S.cn = n;
    }
    const hold = CW.hud.hold.indexOf('card') >= 0, cd = $('card');
    if (hold && cardT <= 0) { const m = MISSIONS[Math.min(S.idx, MISSIONS.length - 1)], l = m.brief[m.brief.length - 1]; showCard(l[0], l[1], 'NOVEDAD'); }
    if (cardT > 0) { cardT = hold ? 5 : cardT - dt; }
    const showC = cardT > 0 && (!S.talk || CW.hud.hold.indexOf('dlg') >= 0) && !S.ring; if (cd.classList.contains('show') !== showC) cd.classList.toggle('show', showC);
    $('obj').style.display = on ? 'none' : 'block';   // the mission panel carries the objective while a job is live
    const idle = S.state === 'idle' && S.idx < MISSIONS.length, done = S.idx >= MISSIONS.length;
    set('obj', 'free', done ? 'HISTORIA COMPLETA. Modo libre: vende autos, mejora en lo de Roxy, visita las tiendas, persigue las estrellas.' : idle ? 'Esperando la próxima llamada... P abre el teléfono. Modo libre mientras tanto.' : S.obj ? S.obj.text : 'Modo libre.');
    // beam
    const mk = S.state === 'active' && S.obj && S.obj.mk;
    if (beam) { beam.visible = !!mk; if (mk) { beam.position.set(mk.x, mk.y || 0, mk.z); beam.userData.ring.scale.setScalar(1 + Math.sin(performance.now() / 260) * 0.12); } }
  };
})();
