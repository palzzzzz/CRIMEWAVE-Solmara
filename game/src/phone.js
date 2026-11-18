// The phone (P): SolFeed social feed reacting to your visible crimes, mission messages and a mission log.
// Going viral raises how fast wanted climbs; lying low lets the feed cool.
(function () {
  const CW = window.CW, $ = (id) => document.getElementById(id);
  const F = (CW.solfeed = { posts: [], buzz: 0, open: false, tab: 0, quiet: 0, ambT: 30, lastKind: {}, wasLevel: 0, trendFired: false });
  const HANDLES = ['@palmtree_pat', '@sunny_side_sol', '@jetski_jo', '@harbour_hannah', '@noodle_nico', '@biz_in_solmara', '@beachbum_bea', '@tower_tess', '@cab_driver_carl', '@mango_mia', '@night_owl_ola', '@wavy_wes'];
  const WEIGHT = { carjack: 9, theft: 5, runover: 12, assault: 4, crime: 5, shots: 10, murder: 18, arson: 14 };
  const TEXT = {
    carjack: ['someone just dragged a driver out of a {car} on {where}!! insane', 'carjacking in {where}. my hands are still shaking', 'they took a {car} right in front of me. {where} is not safe #solmara'],
    theft: ['saw a guy hotwire a {car} in {where} like it was nothing', 'who steals a car in broad daylight?? {where}', 'my cousin\'s {car} just got jacked in {where}'],
    runover: ['HIT AND RUN in {where}. a pedestrian got clipped. call someone!!', 'reckless driver in {where}, someone is hurt #solmara'],
    assault: ['they just rammed a cop car in {where}. unreal', 'police under attack in {where}, sirens everywhere'],
    crime: ['something is kicking off in {where}. cops everywhere', 'sirens in {where} again. what did I miss'],
    shots: ['SHOTS FIRED in {where}. everyone is hiding behind a palm tree', 'gunfire near {where}. stay inside #solmara', 'is that gunfire?? {where} is a warzone rn'],
    murder: ['someone is dead in {where}. I can\'t stop shaking', 'a body in {where}. the city is losing it #crimewave'],
    arson: ['somebody is throwing petrol bombs in {where}!! the street is on fire', 'fire in {where}, fire trucks nowhere, send help'],
  };
  const AMB = ['sunset over the harbour tonight, 10/10 would crime again... I mean visit', 'best empanada stand on the beachfront, fight me', 'traffic on the boulevard is a nightmare as usual', 'anyone else hear a helicopter? just me?', 'rain forecast tomorrow. bring a jacket, Solmara', 'new boutique on the boardwalk is sooo cute', 'free gun shop rumour? asking for a friend (no I am not)', 'quiet night in Solmara. suspicious.'];
  const rnd = () => Math.random();

  function add(user, text, cls, big) { const p = { user, text, cls: cls || '', t: CW.sky.clock(), likes: Math.floor(2 + rnd() * 20), rate: big ? 8 + rnd() * 10 : 0.4 + rnd() * 1.4 }; F.posts.unshift(p); if (F.posts.length > 40) F.posts.pop(); F.unread = (F.unread || 0) + 1; if (F.open && F.tab === 0) render(); return p; }
  F.news = function (text) { add('@SOLMARA_NEWS', text, 'news'); };

  F.crime = function (kind, p, level) {
    const now = performance.now() / 1000; if (F.lastKind[kind] && now - F.lastKind[kind] < 4) return; F.lastKind[kind] = now; F.quiet = 0;
    const where = CW.DISTRICTS[CW.districtAt(p.x, p.z)].name.toLowerCase().replace('solmara ', ''), car = p.car ? p.car.type.name : p.heli ? 'helicopter' : 'car';
    const tpl = TEXT[kind] || TEXT.crime;
    const post = add(HANDLES[Math.floor(rnd() * HANDLES.length)], tpl[Math.floor(rnd() * tpl.length)].replace('{where}', where).replace('{car}', car), '', F.buzz > 40);
    F.buzz = Math.min(100, F.buzz + (WEIGHT[kind] || 5) * (level >= 3 ? 1.3 : 1));
    if (F.buzz >= 40 && !F.trendFired) { F.trendFired = true; post.cls = 'viral'; add('@SOLMARA_NEWS', 'TRENDING: #CrimewaveSolmara. Tourists are filming the suspect. Police response intensifies.', 'news viral', true); CW.hud.toast('SOLFEED  ·  YOU ARE GOING VIRAL'); }
  };
  // multiplier on wanted gain (police.raise): viral crimes heat up faster
  F.gain = function () { return 1 + (Math.max(0, F.buzz - 15) / 85) * 0.6; };

  const tabsEl = () => $('ph-tabs').children;
  function render() {
    const b = $('ph-body'); let h = '';
    if (F.tab === 0) {
      h = F.posts.length ? F.posts.map((p) => '<div class="post ' + p.cls + '"><span class="u">' + p.user + '</span><span class="t">' + p.t + '</span><div>' + p.text + '</div><div class="lk">&#9829; ' + Math.floor(p.likes) + (p.cls.indexOf('viral') >= 0 ? '  ·  TRENDING' : '') + '</div></div>').join('') : '<div class="post"><div>Nothing yet. Citizens post when they see you commit a crime. Behave... or don\'t.</div></div>';
    } else if (F.tab === 1) {
      const L = CW.story.log; h = L.length ? L.map((m) => '<div class="msg"><span class="u">' + CW.story.cast[m.who].name + '</span><span class="t" style="opacity:.5;font-size:10px;margin-left:6px">' + m.t + '</span><div>' + m.text + '</div></div>').join('') : '<div class="msg">No messages yet.</div>';
    } else {
      const S = CW.story, M = S.missions[S.idx];
      h = '<div class="msg"><span class="u">CHAPTER ' + Math.min(S.idx + 1, S.missions.length) + ' OF ' + S.missions.length + '</span><div>' + (M ? M.t + (S.state === 'active' && S.obj ? '<br>' + S.obj.text : '<br>Waiting for the next call.') : 'Story complete. The city is yours.') + '</div></div>';
      h += S.missions.map((m, i) => '<div class="msg" style="opacity:' + (i < S.idx ? 1 : 0.45) + '"><span class="u">' + (i < S.idx ? '&#10003; ' : (i + 1) + '. ') + m.t + '</span><div>Reward $' + m.pay.toLocaleString('en-US') + ' · ' + m.rep + ' REP</div></div>').join('');
      const st = CW.hud.state; h += '<div class="msg"><span class="u">REP LEVEL ' + st.rep + '</span><div>' + st.repXp + ' / ' + st.repNeed + ' to the next level. Higher REP unlocks gun-store stock and upgrades.</div></div>';
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
    if (W.level === 0 && F.wasLevel >= 2) add(HANDLES[Math.floor(rnd() * HANDLES.length)], 'lol the cops lost them. the suspect just vanished into {where}'.replace('{where}', 'the traffic'), '');
    F.wasLevel = W.level;
    F.ambT -= dt; if (F.ambT <= 0) { F.ambT = 45 + rnd() * 60; add(HANDLES[Math.floor(rnd() * HANDLES.length)], AMB[Math.floor(rnd() * AMB.length)], ''); }
    rT -= dt; if (F.open && rT <= 0) { rT = 1; render(); $('ph-clock').textContent = CW.sky.clock(); }
    // HUD tag
    const el = $('solhud'), b = Math.round(F.buzz), unread = (CW.story.unread || 0);
    let txt = '', cls = '';
    if (b >= 40) { txt = 'SOLFEED  VIRAL ' + b + '%  ·  HEAT +' + Math.round((F.gain() - 1) * 100) + '%'; cls = 'hot'; }
    else if (b >= 8) { txt = 'SOLFEED  BUZZ ' + b + '%  ·  LYING LOW COOLS IT'; cls = ''; }
    else if (unread) { txt = '☎  ' + unread + ' NEW  ·  P PHONE'; cls = 'cool'; }
    if (el.dataset.t !== txt) { el.dataset.t = txt; el.textContent = txt; el.style.display = txt ? 'block' : 'none'; el.className = cls; }
    void st;
  };
  F.reset = function () { F.posts.length = 0; F.buzz = 0; F.quiet = 0; F.trendFired = false; F.unread = 0; F.ambT = 20; F.open = false; $('phone').style.display = 'none'; add('@SOLMARA_NEWS', 'Welcome to Solmara, the sun, the sea and the sirens. Post what you see.', 'news'); F.unread = 0; };
})();
