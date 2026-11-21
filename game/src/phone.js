// El teléfono (P): SolFeed, el feed social reacting to your visible crimes, mission messages and a mission log.
// Going viral raises how fast wanted climbs; lying low lets the feed cool.
(function () {
  const CW = window.CW, $ = (id) => document.getElementById(id);
  const F = (CW.solfeed = { posts: [], buzz: 0, open: false, tab: 0, quiet: 0, ambT: 30, lastKind: {}, wasLevel: 0, trendFired: false });
  const HANDLES = ['@pato_palmera', '@sol_y_arena', '@jetski_jorge', '@helena_del_puerto', '@nico_fideos', '@negocios_marea', '@bea_playera', '@tessa_torre', '@carlos_taxista', '@mia_mango', '@ola_nocturna', '@wes_olas'];
  const WEIGHT = { carjack: 9, theft: 5, runover: 12, assault: 4, crime: 5, shots: 10, murder: 18, arson: 14 };
  const TEXT = {
    carjack: ['¡¡acaban de sacar a un conductor de un {car} {where}!! increíble', 'robo de auto {where}. todavía me tiemblan las manos', 'se llevaron un {car} frente a mis ojos. {where} ya no es seguro #puertomarea'],
    theft: ['vi a un tipo hacerle puente a un {car} {where} como si nada', '¿quién roba un auto a plena luz del día?? {where}', 'le acaban de robar el {car} a mi primo {where}'],
    runover: ['ATROPELLO Y FUGA {where}. un peatón salió volando. ¡llamen a alguien!', 'conductor temerario {where}, hay un herido #puertomarea'],
    assault: ['acaban de embestir una patrulla {where}. increíble', 'atacan a la policía {where}, sirenas por todos lados'],
    crime: ['se está armando algo {where}. policías por todas partes', 'sirenas {where} otra vez. ¿qué me perdí?'],
    shots: ['DISPAROS {where}. todos escondidos detrás de una palmera', 'tiros {where}. quédense adentro #puertomarea', '¿eso son balazos?? {where} está hecho una zona de guerra'],
    murder: ['hay un muerto {where}. no puedo dejar de temblar', 'un cuerpo {where}. la ciudad se está volviendo loca #mareacriminal'],
    arson: ['¡¡alguien lanza molotovs {where}!! la calle está en llamas', 'fuego {where}, ni un bombero, manden ayuda'],
  };
  const AMB = ['atardecer sobre el puerto esta noche, 10/10 volvería a delinquir... digo, a visitar', 'la mejor empanada de la costanera, no me discutan', 'el tráfico del bulevar es una pesadilla, como siempre', '¿alguien más oyó un helicóptero? ¿solo yo?', 'mañana dicen que llueve. lleven chaqueta, Puerto Marea', 'la boutique nueva del malecón está muuuy linda', '¿rumor de armería gratis? pregunto por un amigo (no, no soy yo)', 'noche tranquila en Puerto Marea. sospechoso.'];
  const rnd = () => Math.random();

  function add(user, text, cls, big) { const p = { user, text, cls: cls || '', t: CW.sky.clock(), likes: Math.floor(2 + rnd() * 20), rate: big ? 8 + rnd() * 10 : 0.4 + rnd() * 1.4 }; F.posts.unshift(p); if (F.posts.length > 40) F.posts.pop(); F.unread = (F.unread || 0) + 1; if (F.open && F.tab === 0) render(); return p; }
  F.news = function (text) { add('@MAREA_NOTICIAS', text, 'news'); };

  F.crime = function (kind, p, level) {
    const now = performance.now() / 1000; if (F.lastKind[kind] && now - F.lastKind[kind] < 4) return; F.lastKind[kind] = now; F.quiet = 0;
    const where = CW.DISTRICTS[CW.districtAt(p.x, p.z)].loc, car = p.car ? p.car.type.name : p.heli ? 'helicóptero' : 'auto';
    const tpl = TEXT[kind] || TEXT.crime;
    const post = add(HANDLES[Math.floor(rnd() * HANDLES.length)], tpl[Math.floor(rnd() * tpl.length)].split('{where}').join(where).split('{car}').join(car), '', F.buzz > 40);
    F.buzz = Math.min(100, F.buzz + (WEIGHT[kind] || 5) * (level >= 3 ? 1.3 : 1));
    if (F.buzz >= 40 && !F.trendFired) { F.trendFired = true; post.cls = 'viral'; add('@MAREA_NOTICIAS', 'TENDENCIA: #MareaCriminal. Los turistas están grabando al sospechoso. La respuesta policial se intensifica.', 'news viral', true); CW.hud.toast('SOLFEED  ·  TE ESTÁS VOLVIENDO VIRAL'); }
  };
  // multiplier on wanted gain (police.raise): viral crimes heat up faster
  F.gain = function () { return 1 + (Math.max(0, F.buzz - 15) / 85) * 0.6; };

  const tabsEl = () => $('ph-tabs').children;
  function render() {
    const b = $('ph-body'); let h = '';
    if (F.tab === 0) {
      h = F.posts.length ? F.posts.map((p) => '<div class="post ' + p.cls + '"><span class="u">' + p.user + '</span><span class="t">' + p.t + '</span><div>' + p.text + '</div><div class="lk">&#9829; ' + Math.floor(p.likes) + (p.cls.indexOf('viral') >= 0 ? '  ·  TENDENCIA' : '') + '</div></div>').join('') : '<div class="post"><div>Todavía nada. Los vecinos publican cuando te ven cometer un delito. Pórtate bien... o no.</div></div>';
    } else if (F.tab === 1) {
      const L = CW.story.log; h = L.length ? L.map((m) => '<div class="msg"><span class="u">' + CW.story.cast[m.who].name + '</span><span class="t" style="opacity:.5;font-size:10px;margin-left:6px">' + m.t + '</span><div>' + m.text + '</div></div>').join('') : '<div class="msg">Sin mensajes todavía.</div>';
    } else {
      const S = CW.story, M = S.missions[S.idx];
      h = '<div class="msg"><span class="u">CAPÍTULO ' + Math.min(S.idx + 1, S.missions.length) + ' DE ' + S.missions.length + '</span><div>' + (M ? M.t + (S.state === 'active' && S.obj ? '<br>' + S.obj.text : '<br>Esperando la próxima llamada.') : 'Historia completa. La ciudad es tuya.') + '</div></div>';
      h += S.missions.map((m, i) => '<div class="msg" style="opacity:' + (i < S.idx ? 1 : 0.45) + '"><span class="u">' + (i < S.idx ? '&#10003; ' : (i + 1) + '. ') + m.t + '</span><div>Recompensa $' + m.pay.toLocaleString('en-US') + ' · ' + m.rep + ' REP</div></div>').join('');
      const st = CW.hud.state; h += '<div class="msg"><span class="u">NIVEL DE REP ' + st.rep + '</span><div>' + st.repXp + ' / ' + st.repNeed + ' para el siguiente nivel. Más REP desbloquea armas y mejoras.</div></div>';
    }
    b.innerHTML = h;
  }
  function setTab(t) { F.tab = t; for (let i = 0; i < 3; i++) tabsEl()[i].classList.toggle('on', i === t); if (t === 1) CW.story.unread = 0; if (t === 0) F.unread = 0; render(); }
  F.toggle = function (v) {
    F.open = v === undefined ? !F.open : v; $('phone').style.display = F.open ? 'flex' : 'none';
    if (F.open) { if (document.exitPointerLock) document.exitPointerLock(); setTab(F.tab); CW.sfx.play('click', 0.6); }
  };
  F.init = function () { Array.from(tabsEl()).forEach((el, i) => el.addEventListener('click', () => setTab(i))); };

  let rT = 0;
  F.update = function (dt) {
    const I = CW.input, W = CW.police, st = F.open;
    if (I.pressed('KeyP') && !(CW.shops && CW.shops.menu)) F.toggle();
    if (F.open) { if (I.pressed('Escape')) F.toggle(false); if (I.pressed('Digit1')) setTab(0); if (I.pressed('Digit2')) setTab(1); if (I.pressed('Digit3')) setTab(2); }
    // likes tick, buzz cools (faster once you are lying low)
    F.quiet += dt; F.posts.slice(0, 6).forEach((p) => { p.likes += p.rate * dt * (F.buzz > 40 ? 3 : 1); });
    F.buzz = Math.max(0, F.buzz - dt * (F.quiet > 25 ? 3.2 : 0.9));
    if (F.buzz < 22) F.trendFired = false;
    if (W.level === 0 && F.wasLevel >= 2) add(HANDLES[Math.floor(rnd() * HANDLES.length)], 'jaja la policía los perdió. el sospechoso se esfumó entre el tráfico', '');
    F.wasLevel = W.level;
    F.ambT -= dt; if (F.ambT <= 0) { F.ambT = 45 + rnd() * 60; add(HANDLES[Math.floor(rnd() * HANDLES.length)], AMB[Math.floor(rnd() * AMB.length)], ''); }
    rT -= dt; if (F.open && rT <= 0) { rT = 1; render(); $('ph-clock').textContent = CW.sky.clock(); }
    // HUD tag
    const el = $('solhud'), b = Math.round(F.buzz), unread = (CW.story.unread || 0);
    let txt = '', cls = '';
    if (b >= 40) { txt = 'SOLFEED  VIRAL ' + b + '%  ·  CALOR +' + Math.round((F.gain() - 1) * 100) + '%'; cls = 'hot'; }
    else if (b >= 8) { txt = 'SOLFEED  REVUELO ' + b + '%  ·  ESCONDERTE LO ENFRÍA'; cls = ''; }
    else if (unread) { txt = '☎  ' + unread + (unread === 1 ? ' NUEVO' : ' NUEVOS') + '  ·  P TELÉFONO'; cls = 'cool'; }
    if (el.dataset.t !== txt) { el.dataset.t = txt; el.textContent = txt; el.style.display = txt ? 'block' : 'none'; el.className = cls; }
    void st;
  };
  F.reset = function () { F.posts.length = 0; F.buzz = 0; F.quiet = 0; F.trendFired = false; F.unread = 0; F.ambT = 20; F.open = false; $('phone').style.display = 'none'; add('@MAREA_NOTICIAS', 'Bienvenidos a Puerto Marea: el sol, el mar y las sirenas. Publica lo que veas.', 'news'); F.unread = 0; };
})();
