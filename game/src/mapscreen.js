// Pantalla de mapa (M): el mapa de Puerto Marea con sus 3 distritos, la lista de las 7 misiones con marca de completada
// y el porcentaje de progreso en grande. Se abre desde el menú (MISIONES / M), el juego (M) y la pausa.
(function () {
  const CW = window.CW;
  const S = (CW.mapscreen = { open: false });
  const WORLD = 620, CX = -4, CZ = -1;
  let wrap = null, cv = null, ctx = null, W = 0, H = 0, dpr = 1, k = 1, ox = 0, oy = 0, U = 1;
  const FONT = 'Impact, "Arial Black", sans-serif', BODY = '"Trebuchet MS", "Segoe UI", sans-serif';

  // where each of the 7 missions happens (pins on the map)
  function anchors() {
    const lm = CW.world.landmarks, L = CW.C.LINES, f = lm.fence || { x: 0, z: 0 }, g = lm.garage || { x: 0, z: 0 };
    return [{ x: f.x, z: f.z + 7 }, { x: f.x + 24, z: f.z + 7 }, { x: g.x, z: g.z + 7 }, { x: 160, z: -160 }, { x: L[2], z: L[2] }, { x: 180, z: -164 + 22 }, { x: 60, z: 274 }];
  }
  const done = () => { const st = CW.story; if (CW.game.state === 'play' || CW.game.state === 'ended') return st.idx; const s = CW.save.read(); return s && s.story && s.story.idx ? s.story.idx : st.idx; };
  S.done = () => Math.min(CW.story.missions.length, done());
  S.percent = () => Math.round((S.done() / CW.story.missions.length) * 100);

  function build() {
    wrap = document.createElement('div'); wrap.id = 'mapscreen';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:24;display:none;background:#070a1c;';
    cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;height:100%;display:block;'; wrap.appendChild(cv); document.body.appendChild(wrap); ctx = cv.getContext('2d');
    wrap.addEventListener('click', () => S.toggle(false));
  }
  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    U = Math.min(W / 1280, H / 800);
  }
  S.toggle = function (v) {
    if (!wrap) build();
    S.open = v === undefined ? !S.open : v; wrap.style.display = S.open ? 'block' : 'none';
    if (S.open) { if (document.exitPointerLock) document.exitPointerLock(); layout(); S.draw(); }
    if (CW.sfx && CW.sfx.play && CW.audio && CW.audio.ctx) CW.sfx.play('click', 0.6);
  };

  S.update = function () {
    const I = CW.input, g = CW.game.state;
    const free = g === 'title' ? !CW.title.howto && !CW.title.modal : g === 'play' ? !(CW.solfeed.open || CW.shops.menu || CW.bigmap.open || CW.story.talk || CW.weapons.wheelOpen || (CW.pause && CW.pause.open)) : false;
    if (S.open) { if (I.pressed('KeyM') || I.pressed('Escape')) S.toggle(false); else S.draw(); return true; }
    if (I.pressed('KeyM') && free) S.toggle(true);
    return false;
  };
  window.addEventListener('resize', () => { if (S.open) { layout(); S.draw(); } });

  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  S.draw = function () {
    if (!ctx) return;
    const c = ctx, A = CW.hud.api, M = CW.story.missions, n = M.length, nd = S.done(), pct = S.percent();
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    // background
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a0d2a'); bg.addColorStop(1, '#190a2e'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const headH = 78 * U, footH = 40 * U, pw = Math.round(W * 0.37), mx0 = 28 * U, mw = W - pw - mx0 - 22 * U, my0 = headH, mh = H - headH - footH;
    k = Math.min(mw, mh) / WORLD; ox = mx0 + mw / 2 - CX * k; oy = my0 + mh / 2 - CZ * k;
    const X = (x) => ox + (x - CX) * k, Y = (z) => oy + (z - CZ) * k;
    // header
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = '900 ' + Math.round(46 * U) + 'px ' + FONT; c.fillStyle = '#fff'; c.shadowColor = '#ff3fd0'; c.shadowBlur = 18 * U;
    c.fillText('MAPA DE PUERTO MAREA', 28 * U, headH * 0.52); c.shadowBlur = 0;
    // map panel
    const tl = { x: X(-296), y: Y(-296) }, br = { x: X(288), y: Y(294) };
    c.save(); c.beginPath(); c.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); c.clip();
    const base = A.getMap();
    if (base) { c.imageSmoothingQuality = 'high'; c.drawImage(base, ox - (A.E + CX) * k, oy - (A.E + CZ) * k, A.E * 2 * k, A.E * 2 * k); }
    else { c.fillStyle = '#3aa6c4'; c.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); }
    // the three districts (same borders as CW.districtAt)
    const dz = [['#ff9a4a', -296, -296, 288, 160], ['#4aa8ff', -296, -296, 80, 160], ['#2fe0c0', -296, 160, 288, 294]];
    c.fillStyle = 'rgba(255,150,70,.30)'; c.fillRect(X(80), Y(-296), X(288) - X(80), Y(160) - Y(-296));
    c.fillStyle = 'rgba(70,130,255,.28)'; c.fillRect(X(-296), Y(-296), X(80) - X(-296), Y(160) - Y(-296));
    c.fillStyle = 'rgba(40,220,190,.30)'; c.fillRect(X(-296), Y(160), X(288) - X(-296), Y(294) - Y(160)); void dz;
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3 * U; c.setLineDash([12 * U, 8 * U]);
    c.beginPath(); c.moveTo(X(80), Y(-296)); c.lineTo(X(80), Y(160)); c.moveTo(X(-296), Y(160)); c.lineTo(X(288), Y(160)); c.stroke(); c.setLineDash([]);
    c.restore();
    c.strokeStyle = '#2ff0ff'; c.lineWidth = 4 * U; c.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    // district names
    c.textAlign = 'center'; c.lineJoin = 'round'; c.font = '900 ' + Math.round(38 * U) + 'px ' + FONT;
    [['CENTRO', -108, -232, '#14336f'], ['COSTANERA', 184, -232, '#7a2f06'], ['EL PUERTO', -4, 232, '#065a4a']].forEach(([t, x, z, col]) => { c.lineWidth = 9 * U; c.strokeStyle = 'rgba(255,255,255,.95)'; c.strokeText(t, X(x), Y(z)); c.fillStyle = col; c.fillText(t, X(x), Y(z)); });
    // mission pins
    const an = anchors(), t = performance.now() / 1000;
    an.forEach((p, i) => {
      const isDone = i < nd, cur = i === nd && nd < n, r = (cur ? 19 : 16) * U * (cur ? 1 + Math.sin(t * 5) * 0.08 : 1);
      c.beginPath(); c.arc(X(p.x), Y(p.z), r, 0, 7); c.fillStyle = isDone ? '#19c37d' : cur ? '#ffd23f' : '#cfd6e6'; c.fill(); c.lineWidth = 4 * U; c.strokeStyle = '#0f1236'; c.stroke(); c.lineWidth = 2 * U; c.strokeStyle = '#fff'; c.stroke();
      c.fillStyle = '#0f1236'; c.font = '900 ' + Math.round(20 * U) + 'px ' + FONT; c.textAlign = 'center'; c.fillText(isDone ? '✓' : String(i + 1), X(p.x), Y(p.z) + 1 * U);
    });
    // you
    if (CW.game.state === 'play' || CW.game.state === 'ended') {
      const f = CW.player.focus(), px = X(f.x), py = Y(f.z);
      c.beginPath(); c.arc(px, py, 9 * U, 0, 7); c.fillStyle = '#ff3fd0'; c.fill(); c.lineWidth = 3 * U; c.strokeStyle = '#fff'; c.stroke();
      c.font = '900 ' + Math.round(17 * U) + 'px ' + FONT; c.lineWidth = 6 * U; c.strokeStyle = '#0f1236'; c.strokeText('TÚ', px, py - 22 * U); c.fillStyle = '#fff'; c.fillText('TÚ', px, py - 22 * U);
    }
    // ---- right panel: progress + the 7 missions ----
    const px0 = W - pw, pad = 20 * U;
    c.fillStyle = 'rgba(8,10,34,.92)'; c.fillRect(px0, my0 - 14 * U, pw, mh + 14 * U + footH * 0.4);
    c.fillStyle = '#ff3fd0'; c.fillRect(px0, my0 - 14 * U, 5 * U, mh + 14 * U + footH * 0.4);
    c.textAlign = 'left'; c.font = '700 ' + Math.round(17 * U) + 'px ' + BODY; c.fillStyle = '#9fd8ff'; c.fillText('PROGRESO', px0 + pad, my0 + 6 * U);
    c.font = '900 ' + Math.round(104 * U) + 'px ' + FONT; c.fillStyle = '#fff'; c.shadowColor = '#2ff0ff'; c.shadowBlur = 22 * U; c.fillText(pct + '%', px0 + pad, my0 + 72 * U); c.shadowBlur = 0;
    c.font = '700 ' + Math.round(18 * U) + 'px ' + BODY; c.fillStyle = '#ffd9a8'; c.textAlign = 'right'; c.fillText(nd + ' de ' + n + ' misiones', W - pad, my0 + 100 * U); c.textAlign = 'left';
    const by = my0 + 122 * U, bw = pw - pad * 2; rrect(c, px0 + pad, by, bw, 14 * U, 7 * U); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill();
    const gr = c.createLinearGradient(px0 + pad, 0, px0 + pad + bw, 0); gr.addColorStop(0, '#ff3fd0'); gr.addColorStop(1, '#2ff0ff'); rrect(c, px0 + pad, by, Math.max(10 * U, bw * pct / 100), 14 * U, 7 * U); c.fillStyle = gr; c.fill();
    const ly0 = by + 40 * U, rh = (my0 + mh - ly0) / n;
    c.font = '700 ' + Math.round(16 * U) + 'px ' + BODY; c.fillStyle = '#9fd8ff'; c.fillText('MISIONES', px0 + pad, ly0 - 12 * U);
    M.forEach((m, i) => {
      const y = ly0 + i * rh, isDone = i < nd, cur = i === nd && nd < n;
      if (cur) { c.fillStyle = 'rgba(255,210,63,.16)'; c.fillRect(px0 + 10 * U, y + 2 * U, pw - 20 * U, rh - 4 * U); }
      const bx = px0 + pad + 14 * U, by2 = y + rh / 2;
      c.beginPath(); c.arc(bx, by2, 14 * U, 0, 7); c.fillStyle = isDone ? '#19c37d' : cur ? '#ffd23f' : 'rgba(255,255,255,.18)'; c.fill();
      c.fillStyle = isDone || cur ? '#0f1236' : '#cfd6e6'; c.font = '900 ' + Math.round(18 * U) + 'px ' + FONT; c.textAlign = 'center'; c.fillText(isDone ? '✓' : String(i + 1), bx, by2 + 1 * U);
      c.textAlign = 'left'; c.font = '900 ' + Math.round(21 * U) + 'px ' + FONT; c.fillStyle = isDone ? '#9ff0c8' : cur ? '#ffe27a' : '#b9c2dc'; c.fillText(m.t, bx + 26 * U, by2 - 8 * U);
      c.font = '600 ' + Math.round(13 * U) + 'px ' + BODY; c.fillStyle = isDone ? '#7fd6ac' : '#8e98b8'; c.fillText(isDone ? 'COMPLETADA  ·  +$' + m.pay.toLocaleString('en-US') : (cur ? 'EN CURSO  ·  ' : '') + 'Recompensa $' + m.pay.toLocaleString('en-US') + '  ·  ' + m.rep + ' REP', bx + 26 * U, by2 + 12 * U);
    });
    // footer
    c.textAlign = 'center'; c.font = '700 ' + Math.round(15 * U) + 'px ' + BODY; c.fillStyle = '#ffd9a8'; c.fillText('M / ESC / CLIC: CERRAR   ·   N: MAPA CON RUTAS', mx0 + mw / 2, H - footH * 0.45);
  };
})();
