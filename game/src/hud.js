// HUD: DOM overlay + circular canvas minimap. Everything is labelled.
(function () {
  const CW = window.CW;
  const H = (CW.hud = { shown: false, state: { cash: 2500, rep: 1, repXp: 0, repNeed: 100, hp: 100, armour: 0, wanted: 0 } });
  const $ = (id) => document.getElementById(id);
  let map = null, mm = null, mctx = null, lastDistrict = -1, bannerT = 0, toastT = 0;
  const cache = {};
  const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
  const setW = (id, pct) => { const k = id + '%'; const v = Math.round(pct); if (cache[k] !== v) { cache[k] = v; $(id).style.width = v + '%'; } };

  H.init = function () {
    mm = $('mm'); mctx = mm.getContext('2d');
    // the stars row
    let s = ''; for (let i = 0; i < 5; i++) s += '<span class="star">★</span>';
    $('stars').innerHTML = s;
    // pre-render the whole city map once
    const S = 2, E = 340, c = document.createElement('canvas'); c.width = c.height = E * 2 * S;
    const x = c.getContext('2d'); x.scale(S, S); x.translate(E, E);
    x.fillStyle = '#2fbfc9'; x.fillRect(-E, -E, E * 2, E * 2);
    x.fillStyle = '#86bf72'; x.fillRect(-E, -E, E + 300, E + 300);
    x.fillStyle = '#f1dcab'; x.fillRect(248, -E, 52, E + 248);
    x.fillStyle = '#9ea39f'; x.fillRect(-E, 248, E + 288, 52);
    x.fillStyle = '#9ea39f'; x.fillRect(-300, 248, 588, 52);
    x.fillStyle = '#5b6469'; x.fillRect(-248, -248, 496, 496);
    CW.world.blocks.forEach((b) => {
      x.fillStyle = b.district === 0 ? '#f2e5c8' : b.district === 1 ? '#cfd3d1' : '#b9b8ae';
      x.fillRect(b.cx - 32, b.cz - 32, 64, 64);
    });
    CW.world.footprints.forEach((f) => {
      x.fillStyle = f.park ? '#6fc065' : '#8d8a9a'; x.fillRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0);
    });
    x.fillStyle = '#f2c230'; CW.C.LINES.forEach((l) => { x.fillRect(l - 0.4, -248, 0.8, 496); x.fillRect(-248, l - 0.4, 496, 0.8); });
    const lm = CW.world.landmarks;
    [['police', '#2f6fd6'], ['hospital', '#e0344a'], ['garage', '#ff9f1c'], ['fence', '#a64dff']].forEach(([k, col]) => { if (lm[k]) { x.fillStyle = col; x.beginPath(); x.arc(lm[k].x, lm[k].z, 6, 0, 7); x.fill(); } });
    map = c;
  };

  H.show = function (v) { H.shown = v; $('hud').style.display = v ? 'block' : 'none'; };
  H.toast = function (t) { $('toast').textContent = t; $('toast').style.opacity = 1; toastT = 2.6; };

  function drawMinimap(P, cam) {
    const R = mm.width / 2, scale = R / 105;
    const e = P.active, car = P.mode === 'car' ? P.car : null;
    const px = car ? car.x : e.x, pz = car ? car.z : e.z, hd = car ? car.h : e.h;
    mctx.clearRect(0, 0, mm.width, mm.height);
    mctx.save(); mctx.beginPath(); mctx.arc(R, R, R - 2, 0, 7); mctx.clip();
    mctx.fillStyle = '#2fbfc9'; mctx.fillRect(0, 0, mm.width, mm.height);
    mctx.translate(R, R); mctx.rotate(cam.yaw); mctx.scale(scale, scale); mctx.translate(-px, -pz);
    mctx.drawImage(map, -340, -340, 680, 680);
    if (CW.enemies) CW.enemies.drawMap(mctx, scale, { x: px, z: pz });
    if (CW.police) CW.police.drawMap(mctx, scale, { x: px, z: pz });
    if (CW.air) {   // the helicopter pad, and the police helicopter as a flashing wedge
      const hp = CW.air.heli; mctx.save(); mctx.fillStyle = '#ffffff'; mctx.strokeStyle = '#0b2a33'; mctx.lineWidth = 1.5 / scale; mctx.beginPath(); mctx.arc(hp.x, hp.z, 5.5 / scale, 0, 7); mctx.fill(); mctx.stroke();
      mctx.translate(hp.x, hp.z); mctx.rotate(-cam.yaw); mctx.fillStyle = '#0b2a33'; mctx.font = '900 ' + 8 / scale + 'px Impact, sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText('H', 0, 0.4 / scale); mctx.restore();
      const ph = CW.air.policeHeli; if (ph.active) { const dx = ph.x - px, dz = ph.z - pz, d = Math.hypot(dx, dz), lim = 97; let x = ph.x, z = ph.z; if (d > lim) { x = px + (dx / d) * lim; z = pz + (dz / d) * lim; } mctx.save(); mctx.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ff3030' : '#3a7bff'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.4 / scale; mctx.beginPath(); mctx.moveTo(x, z - 6 / scale); mctx.lineTo(x + 5 / scale, z + 4 / scale); mctx.lineTo(x - 5 / scale, z + 4 / scale); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore(); }
    }
    // player arrow
    mctx.translate(px, pz); mctx.rotate(-hd); mctx.scale(1 / scale, 1 / scale);
    mctx.fillStyle = '#fff'; mctx.strokeStyle = '#0b2a33'; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.moveTo(0, 11); mctx.lineTo(-7, -7); mctx.lineTo(0, -3); mctx.lineTo(7, -7); mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
    // ring + north tick
    mctx.lineWidth = 4; mctx.strokeStyle = '#102a33'; mctx.beginPath(); mctx.arc(R, R, R - 2, 0, 7); mctx.stroke();
    const nx = R + Math.sin(cam.yaw) * (R - 13), ny = R - Math.cos(cam.yaw) * (R - 13);
    mctx.fillStyle = '#ffd36b'; mctx.font = '900 13px Impact, sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText('N', nx, ny);
  }

  H.update = function (dt) {
    if (!H.shown) return;
    const P = CW.player, st = H.state, e = P.active;
    drawMinimap(P, CW.cam);
    setText('cash', '$' + st.cash.toLocaleString('en-US'));
    setText('clock', CW.sky.clock() + (CW.weather && CW.weather.wet > 0.3 ? '  ·  RAIN' : ''));
    setW('stbar', P.stamina); $('stbar').style.opacity = P.winded ? 0.55 : 1;
    setText('who', e.def.name);
    setW('hpbar', st.hp); setW('arbar', st.armour); setW('repbar', (st.repXp / st.repNeed) * 100);
    setText('replv', 'REP LV ' + st.rep + '   ' + st.repXp + '/' + st.repNeed);
    const stars = $('stars').children;
    for (let i = 0; i < 5; i++) { const on = i < st.wanted; if (stars[i].dataset.on !== String(on)) { stars[i].dataset.on = String(on); stars[i].classList.toggle('on', on); } }
    const car = P.mode === 'car' ? P.car : null;
    $('carpanel').style.display = car ? 'block' : 'none';
    if (car) {
      setText('spd', String(Math.round(car.speed * 3.6)));
      setText('carname', car.type.name);
      setW('carhp', car.hp);
      setText('carcond', car.hp > 66 ? 'CONDITION  GOOD' : car.hp > 33 ? 'CONDITION  DAMAGED' : car.hp > 0 ? 'CONDITION  CRITICAL' : 'CONDITION  WRECKED');
      $('drift').style.opacity = car.drift > 0.3 ? 1 : 0;
    }
    const pr = $('prompt'); const text = P.prompt || ''; if (cache.prompt !== text) { cache.prompt = text; pr.textContent = text; pr.style.opacity = text ? 1 : 0; }
    // district banner
    const fx = car ? car.x : e.x, fz = car ? car.z : e.z, d = CW.districtAt(fx, fz);
    setText('dname', CW.DISTRICTS[d].name);
    if (d !== lastDistrict) { lastDistrict = d; bannerT = 3.4; $('banner').textContent = CW.DISTRICTS[d].name; $('bannersub').textContent = CW.DISTRICTS[d].sub; }
    if (bannerT > 0) { bannerT -= dt; $('bannerwrap').style.opacity = bannerT > 0.6 ? 1 : Math.max(0, bannerT / 0.6); }
    if (P.toast) { H.toast(P.toast); P.toast = null; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  };
})();
