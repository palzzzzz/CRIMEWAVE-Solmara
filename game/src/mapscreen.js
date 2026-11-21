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

  // ---- vector bits ----------------------------------------------------------------------------------------------------------
  const MNAME = ['BIENVENIDA', 'ENTREGA DE AUTOS', 'PINTURA', 'CARRERA', 'BANDAS CABRAL', 'BOLSA CALIENTE', 'PIEDRA DEL SOL'];
  function padlock(c, x, y, r, col) {   // a clear padlock: body, shackle, keyhole
    c.save(); c.translate(x, y); c.lineJoin = c.lineCap = 'round';
    c.beginPath(); c.arc(0, -r * 0.2, r * 0.46, Math.PI, 0); c.lineWidth = r * 0.34; c.strokeStyle = '#0f1236'; c.stroke(); c.lineWidth = r * 0.2; c.strokeStyle = col; c.stroke();
    rrect(c, -r * 0.7, -r * 0.2, r * 1.4, r * 1.0, r * 0.18); c.fillStyle = col; c.fill(); c.lineWidth = r * 0.12; c.strokeStyle = '#0f1236'; c.stroke();
    c.fillStyle = '#0f1236'; c.beginPath(); c.arc(0, r * 0.22, r * 0.16, 0, 7); c.fill(); c.fillRect(-r * 0.06, r * 0.22, r * 0.12, r * 0.34);
    c.restore();
  }
  // a round pin carrying the mission's own icon; state: 'done' green + tick, 'cur' yellow pulsing, 'open' white, 'lock' grey padlock
  function pin(c, x, y, r, i, state, U, t) {
    const col = state === 'done' ? '#19c37d' : state === 'cur' ? '#ffd23f' : state === 'lock' ? '#8d96b4' : '#4f58c4';
    if (state === 'cur') { const ph = (t * 0.9) % 1; c.lineWidth = 4 * U; c.strokeStyle = 'rgba(255,210,63,' + 0.8 * (1 - ph) + ')'; c.beginPath(); c.arc(x, y, r * (1.15 + ph * 0.8), 0, 7); c.stroke(); }
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 5 * U; c.strokeStyle = '#0f1236'; c.stroke(); c.lineWidth = 2.6 * U; c.strokeStyle = '#fff'; c.stroke();
    if (state === 'lock') padlock(c, x, y, r * 0.74, '#e9eefc');
    else { c.save(); c.translate(x, y); CW.brand.missionIcon(c, i, r * 0.76, '#ffffff', '#0f1236'); c.restore(); }
    if (state === 'done') { c.beginPath(); c.arc(x + r * 0.78, y - r * 0.78, r * 0.42, 0, 7); c.fillStyle = '#19c37d'; c.fill(); c.lineWidth = 2.4 * U; c.strokeStyle = '#fff'; c.stroke(); c.lineWidth = 2.6 * U; c.beginPath(); c.moveTo(x + r * 0.6, y - r * 0.78); c.lineTo(x + r * 0.74, y - r * 0.62); c.lineTo(x + r * 1.0, y - r * 0.95); c.stroke(); }
  }
  // districts, indexed as CW.districtAt: 0 COSTANERA, 1 CENTRO, 2 EL PUERTO
  const DIST = [{ n: 'COSTANERA', x0: 80, x1: 288, z0: -296, z1: 160, cx: 184 }, { n: 'CENTRO', x0: -296, x1: 80, z0: -296, z1: 160, cx: -108 }, { n: 'EL PUERTO', x0: -296, x1: 288, z0: 160, z1: 294, cx: -90 }];
  // a district is open once a mission placed in it has been reached (or the player stands in it)
  function opened() {
    const nd = S.done(), an = anchors(), o = [false, false, false];
    an.forEach((p, i) => { if (i <= nd) o[CW.districtAt(p.x, p.z)] = true; });
    if (CW.game.state === 'play' || CW.game.state === 'ended') { const f = CW.player.focus(); o[CW.districtAt(f.x, f.z)] = true; }
    return o;
  }
  S.opened = opened;

  S.draw = function () {
    if (!ctx) return;
    const c = ctx, A = CW.hud.api, M = CW.story.missions, n = M.length, nd = S.done(), pct = S.percent(), op = opened();
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a0d2a'); bg.addColorStop(1, '#190a2e'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const headH = 54 * U, footH = 28 * U, pw = Math.round(W * 0.27), legW = 172 * U, my0 = headH, mh = H - headH - footH;
    const mapL = 14 * U + legW + 10 * U, mapR = W - pw - 12 * U;
    k = mh / 596; ox = (mapL + mapR) / 2 - CX * k; oy = my0 + mh / 2 - CZ * k;
    const X = (x) => ox + (x - CX) * k, Y = (z) => oy + (z - CZ) * k;
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = '900 ' + Math.round(40 * U) + 'px ' + FONT; c.fillStyle = '#fff'; c.shadowColor = '#ff3fd0'; c.shadowBlur = 16 * U;
    c.fillText('MAPA DE PUERTO MAREA', 20 * U, headH * 0.5); c.shadowBlur = 0;
    // ---- map ----
    const tl = { x: X(-296), y: Y(-296) }, br = { x: X(288), y: Y(294) };
    c.save(); c.beginPath(); c.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); c.clip();
    const base = A.getMap();
    if (base) { c.imageSmoothingQuality = 'high'; c.drawImage(base, ox - (A.E + CX) * k, oy - (A.E + CZ) * k, A.E * 2 * k, A.E * 2 * k); } else { c.fillStyle = '#3aa6c4'; c.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); }
    const tint = ['rgba(255,150,70,.26)', 'rgba(70,130,255,.24)', 'rgba(40,220,190,.26)'];
    DIST.forEach((d, id) => { c.fillStyle = tint[id]; c.fillRect(X(d.x0), Y(d.z0), X(d.x1) - X(d.x0), Y(d.z1) - Y(d.z0)); });
    // districts still closed: a dark silhouette (the street grid barely shows through) with a hatch
    DIST.forEach((d, id) => {
      if (op[id]) return; const x0 = X(d.x0), y0 = Y(d.z0), w = X(d.x1) - x0, h = Y(d.z1) - y0;
      // soft scattered fog: a few jittered blobs over the district, drawn at low resolution (pixel mosaic of the real map, darkened)
      const cell = 8 * U, lw = Math.max(2, Math.ceil(w / cell)), lh = Math.max(2, Math.ceil(h / cell)), s = 1 / cell;
      const lo = document.createElement('canvas'); lo.width = lw; lo.height = lh; const l = lo.getContext('2d');
      if (base) { l.imageSmoothingEnabled = true; l.drawImage(base, (ox - (A.E + CX) * k - x0) * s, (oy - (A.E + CZ) * k - y0) * s, A.E * 2 * k * s, A.E * 2 * k * s); }
      l.fillStyle = 'rgba(14,18,52,.36)'; l.fillRect(0, 0, lw, lh);
      l.globalCompositeOperation = 'destination-in';
      const m = document.createElement('canvas'); m.width = lw; m.height = lh; const q = m.getContext('2d');
      const hs = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7 + id * 74.7) * 43758.5453; return v - Math.floor(v); };
      const gx = 3, gy = id === 2 ? 2 : 4;
      for (let i = 0; i < gx; i++) for (let j = 0; j < gy; j++) {
        if (!(i === 1 && j === Math.floor(gy / 2)) && hs(i, j) < 0.3) continue;
        const bx = (i + 0.2 + hs(i + 5, j) * 0.6) / gx * lw, by = (j + 0.2 + hs(i, j + 9) * 0.6) / gy * lh, br = Math.min(lw / gx, lh / gy) * (0.62 + hs(i + 2, j + 2) * 0.4);
        const g = q.createRadialGradient(bx, by, br * 0.25, bx, by, br); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = g; q.fillRect(0, 0, lw, lh);
      }
      l.drawImage(m, 0, 0);
      c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip(); c.imageSmoothingEnabled = false; c.drawImage(lo, x0, y0, lw * cell, lh * cell); c.restore();
    });
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3 * U; c.setLineDash([12 * U, 8 * U]);
    c.beginPath(); c.moveTo(X(80), Y(-296)); c.lineTo(X(80), Y(160)); c.moveTo(X(-296), Y(160)); c.lineTo(X(288), Y(160)); c.stroke(); c.setLineDash([]);
    c.restore();
    c.strokeStyle = '#2ff0ff'; c.lineWidth = 4 * U; c.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    c.textAlign = 'center'; c.lineJoin = 'round';
    DIST.forEach((d, id) => {
      const x = X(d.cx);
      if (op[id]) { const y = Y(id === 2 ? 276 : -276); c.font = '900 ' + Math.round(40 * U) + 'px ' + FONT; c.lineWidth = 9 * U; c.strokeStyle = 'rgba(255,255,255,.95)'; c.strokeText(d.n, x, y); c.fillStyle = ['#7a2f06', '#14336f', '#065a4a'][id]; c.fillText(d.n, x, y); }
      else { const cy = Y(id === 2 ? 228 : -70); c.globalAlpha = 0.8; padlock(c, x, cy - 18 * U, 17 * U, '#aab4dc'); c.font = '900 ' + Math.round(20 * U) + 'px ' + FONT; c.fillStyle = '#b4bde0'; c.lineWidth = 4 * U; c.strokeStyle = 'rgba(15,18,54,.85)'; c.strokeText('SIN EXPLORAR', x, cy + 12 * U); c.fillText('SIN EXPLORAR', x, cy + 12 * U); c.font = '700 ' + Math.round(12 * U) + 'px ' + BODY; c.fillStyle = '#98a3cf'; c.lineWidth = 3 * U; c.strokeText(d.n, x, cy + 30 * U); c.fillText(d.n, x, cy + 30 * U); c.globalAlpha = 1; }
    });
    // places: garage, fence, helipad, shops (only in open districts)
    const lm = CW.world.landmarks, ir = 15 * U, show = (x, z) => op[CW.districtAt(x, z)];
    if (lm.garage && show(lm.garage.x, lm.garage.z)) A.badge(c, 'house', X(lm.garage.x), Y(lm.garage.z), ir, A.INK, 'garage');
    if (lm.fence && show(lm.fence.x, lm.fence.z)) A.badge(c, 'diamond', X(lm.fence.x), Y(lm.fence.z), ir * 0.95, A.INK, 'fence');
    if (show(60, 274)) A.badge(c, 'circle', X(60), Y(274), ir, A.WHITE, 'heli');
    if (CW.shops) CW.shops.list.forEach((sh) => { if (show(sh.cx, sh.cz)) A.badge(c, sh.kind === 'boutique' ? 'circle' : sh.kind === 'gun' ? 'hex' : 'square', X(sh.cx), Y(sh.cz), ir, A.GREEN, sh.kind === 'boutique' ? 'boutique' : sh.kind === 'gun' ? 'gun' : 'market'); });
    // mission pins: each with its own icon; padlock when locked
    const an = anchors(), t = performance.now() / 1000;
    an.forEach((p, i) => { const st = i < nd ? 'done' : i === nd && nd < n ? 'cur' : 'lock'; pin(c, X(p.x), Y(p.z), (st === 'cur' ? 27 : 23) * U * (st === 'cur' ? 1 + Math.sin(t * 5) * 0.05 : 1), i, st, U, t); });
    if (CW.game.state === 'play' || CW.game.state === 'ended') {
      const f = CW.player.focus(), px = X(f.x), py = Y(f.z);
      c.beginPath(); c.arc(px, py, 10 * U, 0, 7); c.fillStyle = '#ff3fd0'; c.fill(); c.lineWidth = 3.4 * U; c.strokeStyle = '#fff'; c.stroke();
      c.font = '900 ' + Math.round(19 * U) + 'px ' + FONT; c.lineWidth = 6 * U; c.strokeStyle = '#0f1236'; c.strokeText('TÚ', px, py - 24 * U); c.fillStyle = '#fff'; c.fillText('TÚ', px, py - 24 * U);
    }
    // ---- legend (left column) ----
    const lx = 14 * U, ly0 = my0 - 4 * U, rowH = (mh + 6 * U) / 17;
    c.fillStyle = 'rgba(8,10,34,.88)'; rrect(c, lx - 4 * U, ly0, legW + 4 * U, mh + 6 * U, 8 * U); c.fill();
    c.textAlign = 'left'; c.font = '900 ' + Math.round(19 * U) + 'px ' + FONT; c.fillStyle = '#ffc83d'; c.fillText('LEYENDA', lx + 8 * U, ly0 + rowH * 0.5);
    let row = 1; const ir2 = 14.5 * U;
    const line = (label, drawIcon) => { const y = ly0 + rowH * (row + 0.5); drawIcon(lx + 8 * U + ir2, y); c.textAlign = 'left'; c.font = '800 ' + Math.round(14 * U) + 'px ' + BODY; c.fillStyle = '#e9eefc'; c.fillText(label, lx + 8 * U + ir2 * 2 + 9 * U, y); row++; };
    for (let i = 0; i < n; i++) line((i + 1) + ' ' + MNAME[i], (x, y) => pin(c, x, y, ir2, i, 'open', U, 0));
    line('GARAJE', (x, y) => A.badge(c, 'house', x, y, ir2 * 0.95, A.INK, 'garage')); line('RECEPTADOR', (x, y) => A.badge(c, 'diamond', x, y, ir2 * 0.9, A.INK, 'fence'));
    line('HELIPUERTO', (x, y) => A.badge(c, 'circle', x, y, ir2, A.WHITE, 'heli')); line('TIENDAS', (x, y) => A.badge(c, 'hex', x, y, ir2, A.GREEN, 'gun'));
    line('MISIÓN BLOQUEADA', (x, y) => pin(c, x, y, ir2, 0, 'lock', U, 0)); line('COMPLETADA', (x, y) => pin(c, x, y, ir2, 0, 'done', U, 0));
    line('SIN EXPLORAR', (x, y) => { c.fillStyle = '#0a0c20'; c.fillRect(x - ir2, y - ir2 * 0.8, ir2 * 2, ir2 * 1.6); c.strokeStyle = '#8f9bc8'; c.lineWidth = 2 * U; c.strokeRect(x - ir2, y - ir2 * 0.8, ir2 * 2, ir2 * 1.6); });
    // ---- right panel: PROGRESO (big) + mission list with icons ----
    const px0 = W - pw, pad = 18 * U;
    c.fillStyle = 'rgba(8,10,34,.92)'; c.fillRect(px0, my0 - 10 * U, pw, mh + 10 * U + footH * 0.5); c.fillStyle = '#ff3fd0'; c.fillRect(px0, my0 - 10 * U, 5 * U, mh + 10 * U + footH * 0.5);
    c.textAlign = 'left'; c.font = '900 ' + Math.round(34 * U) + 'px ' + FONT; c.fillStyle = '#9fd8ff'; c.fillText('PROGRESO', px0 + pad, my0 + 18 * U);
    c.font = '900 ' + Math.round(132 * U) + 'px ' + FONT; c.fillStyle = '#fff'; c.shadowColor = '#2ff0ff'; c.shadowBlur = 24 * U; c.fillText(pct + '%', px0 + pad, my0 + 104 * U); c.shadowBlur = 0;
    c.font = '800 ' + Math.round(18 * U) + 'px ' + BODY; c.fillStyle = '#ffd9a8'; c.textAlign = 'right'; c.fillText(nd + ' de ' + n + ' misiones', W - pad, my0 + 160 * U); c.textAlign = 'left';
    const by = my0 + 176 * U, bw = pw - pad * 2; rrect(c, px0 + pad, by, bw, 14 * U, 7 * U); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill();
    const gr = c.createLinearGradient(px0 + pad, 0, px0 + pad + bw, 0); gr.addColorStop(0, '#ff3fd0'); gr.addColorStop(1, '#2ff0ff'); rrect(c, px0 + pad, by, Math.max(10 * U, bw * pct / 100), 14 * U, 7 * U); c.fillStyle = gr; c.fill();
    const ly1 = by + 28 * U, rh = (my0 + mh - ly1) / n;
    M.forEach((m, i) => {
      const y = ly1 + i * rh, isDone = i < nd, cur = i === nd && nd < n, lock = !isDone && !cur;
      if (cur) { c.fillStyle = 'rgba(255,210,63,.16)'; c.fillRect(px0 + 10 * U, y + 1 * U, pw - 20 * U, rh - 2 * U); }
      const bx = px0 + pad + 20 * U, by2 = y + rh / 2;
      pin(c, bx, by2, Math.min(19 * U, rh * 0.42), i, isDone ? 'done' : cur ? 'cur' : 'lock', U, 0);
      c.textAlign = 'left'; c.font = '900 ' + Math.round(19 * U) + 'px ' + FONT; c.fillStyle = isDone ? '#9ff0c8' : cur ? '#ffe27a' : '#9aa4c4'; c.fillText((i + 1) + '. ' + m.t, bx + 30 * U, by2 - 8 * U, pw - pad * 2 - 40 * U);
      c.font = '600 ' + Math.round(12.5 * U) + 'px ' + BODY; c.fillStyle = isDone ? '#7fd6ac' : '#8e98b8'; c.fillText(isDone ? 'COMPLETADA  ·  +$' + m.pay.toLocaleString('en-US') : lock ? 'BLOQUEADA  ·  completa la anterior' : 'EN CURSO  ·  $' + m.pay.toLocaleString('en-US') + '  ·  ' + m.rep + ' REP', bx + 30 * U, by2 + 11 * U);
    });
    c.textAlign = 'center'; c.font = '700 ' + Math.round(14 * U) + 'px ' + BODY; c.fillStyle = '#ffd9a8'; c.fillText('M / ESC / CLIC: CERRAR   ·   N: MAPA CON RUTAS', (mapL + mapR) / 2, H - footH * 0.5);
  };
})();
