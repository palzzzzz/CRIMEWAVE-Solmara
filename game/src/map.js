// Full-screen city map (N). Drawn from the same street graph + pre-rendered base map as the minimap.
// Click (or move the cursor with the arrows and press ENTER) to set a checkpoint: the route is planned with the HUD's BFS
// router (CW.hud.api.planRoute) and shown on this map and, once it is closed, on the minimap (CW.hud.wp).
(function () {
  const CW = window.CW;
  const M = (CW.bigmap = { open: false, cx: 0, cz: 0, cur: { x: 0, z: 0 }, mouseUsed: true });
  const WORLD = 620, CX = -4, CZ = -1;   // world metres shown (the island is -296..294), and its centre
  let wrap = null, cv = null, ctx = null, W = 0, H = 0, k = 1, ox = 0, oy = 0, dpr = 1;

  function build() {
    wrap = document.createElement('div'); wrap.id = 'bigmap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:14;display:none;background:rgba(5,20,28,.9);cursor:crosshair;';
    cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;height:100%;display:block;';
    wrap.appendChild(cv); document.body.appendChild(wrap); ctx = cv.getContext('2d');
    wrap.addEventListener('mousemove', (e) => { M.mouseUsed = true; setCursor(e.clientX, e.clientY); });
    wrap.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    wrap.addEventListener('click', (e) => { setCursor(e.clientX, e.clientY); pick(); });
    wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); CW.hud.wp = null; });
  }
  const toWorld = (sx, sy) => ({ x: (sx - ox) / k + CX, z: (sy - oy) / k + CZ });
  const toScr = (x, z) => ({ x: ox + (x - CX) * k, y: oy + (z - CZ) * k });
  function setCursor(sx, sy) { const w = toWorld(sx, sy); M.cur.x = CW.clamp(w.x, -296, 288); M.cur.z = CW.clamp(w.z, -296, 294); }
  function pick() { CW.hud.wp = { x: M.cur.x, z: M.cur.z }; CW.sfx.play('click', 0.6); M.routeLen = null; }

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    k = Math.min(W * 0.94, H * 0.84) / WORLD; ox = W / 2 - CX * k; oy = H / 2 + H * 0.01 - CZ * k;
  }

  M.toggle = function (v) {
    if (!wrap) build();
    M.open = v === undefined ? !M.open : v; wrap.style.display = M.open ? 'block' : 'none';
    if (M.open) {
      if (document.exitPointerLock) document.exitPointerLock();
      layout(); const f = CW.player.focus(); M.cur.x = f.x; M.cur.z = f.z; M.mouseUsed = false; CW.sfx.play('click', 0.6);
    }
  };

  // returns true while open (main.js then holds the player + weapons still)
  M.update = function (dt) {
    const I = CW.input;
    if (!M.open) {
      const busy = CW.solfeed.open || CW.shops.menu || CW.story.talk || CW.weapons.wheelOpen || CW.game.state !== 'play';
      if (I.pressed('KeyN') && !busy) M.toggle(true);
      return M.open;
    }
    if (I.pressed('KeyN') || I.pressed('Escape')) { M.toggle(false); return false; }
    const ax = I.axis(['ArrowLeft'], ['ArrowRight']), az = I.axis(['ArrowUp'], ['ArrowDown']);
    if (ax || az) { M.mouseUsed = false; M.cur.x = CW.clamp(M.cur.x + ax * 3, -296, 288); M.cur.z = CW.clamp(M.cur.z + az * 3, -296, 294); }   // 3 m per frame (real time: the world runs at 5% while the map is open)
    if (I.pressed('Enter') || I.pressed('NumpadEnter')) pick();
    if (I.pressed('KeyC') || I.pressed('Backspace')) CW.hud.wp = null;
    draw();
    return true;
  };

  function draw() {
    const A = CW.hud.api, c = ctx, P = CW.player, U = Math.max(1, Math.min(W, H) / 580);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const base = A.getMap();
    const tl = toScr(-310, -310), br = toScr(300, 304);
    c.save(); c.beginPath(); c.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); c.clip();
    if (base) { c.imageSmoothingQuality = 'high'; c.drawImage(base, ox - (A.E + CX) * k, oy - (A.E + CZ) * k, A.E * 2 * k, A.E * 2 * k); }
    c.restore();
    // frame around the sea
    c.strokeStyle = A.INK; c.lineWidth = 4; c.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    // district names
    // (sizes are chosen so every label is still >= ~11 px when a 1280 px screenshot is shrunk to 640 px)
    const tag = (t, x, y, align, size, bg, fg) => {   // pill label: dark ink plate, white text, anchored at (x, y)
      c.save(); c.font = '900 ' + Math.round(size) + 'px Impact, "Arial Black", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
      const w = c.measureText(t).width + size * 0.8, h = size * 1.45, x0 = align === 'l' ? x : align === 'r' ? x - w : x - w / 2;
      c.fillStyle = bg || 'rgba(15,42,58,.94)'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.roundRect ? c.roundRect(x0, y - h / 2, w, h, h * 0.3) : c.rect(x0, y - h / 2, w, h); c.fill(); c.stroke();
      c.fillStyle = fg || '#fff'; c.fillText(t, x0 + size * 0.4, y + size * 0.04); c.restore();
    };
    c.save(); c.font = '900 ' + Math.round(34 * U) + 'px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    [['CENTRO', -100, -268], ['COSTANERA', 190, -268], ['EL PUERTO', -150, 268]].forEach(([t, x, z]) => { const s = toScr(x, z); c.lineWidth = 7 * U; c.strokeStyle = 'rgba(255,255,255,.92)'; c.strokeText(t, s.x, s.y); c.fillStyle = A.INK; c.fillText(t, s.x, s.y); });
    c.restore();
    const ir = 14 * U, LS = 20 * U;
    // police search zone
    const Wp = CW.police;
    if (Wp && Wp.level >= 1 && !Wp.seen) {
      const s = toScr(Wp.last.x, Wp.last.z), pulse = Math.sin(performance.now() / 250);
      c.save(); c.fillStyle = 'rgba(255,58,74,' + (0.2 + 0.08 * pulse) + ')'; c.strokeStyle = 'rgba(255,58,74,.95)'; c.lineWidth = 3 * U; c.setLineDash([9 * U, 6 * U]);
      c.beginPath(); c.arc(s.x, s.y, (52 + Wp.level * 11) * k, 0, 7); c.fill(); c.stroke(); c.restore();
    }
    const car = P.mode === 'car' ? P.car : null, e = P.active, px = car ? car.x : e.x, pz = car ? car.z : e.z, hd = car ? car.h : e.h;
    // routes: mission (yellow) then checkpoint (magenta)
    const route = (tx, tz, col) => {
      const r = A.planRoute(px, pz, tx, tz), pts = r.pts, n = pts.length; let len = 0;
      for (let i = 1; i < n; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      c.save(); c.lineJoin = c.lineCap = 'round';
      [[9 * U, A.INK], [5.5 * U, col]].forEach(([lw, cc]) => {
        c.strokeStyle = cc; c.lineWidth = lw; c.beginPath();
        for (let i = 0; i < n - (r.offRoad ? 1 : 0); i++) { const s = toScr(pts[i].x, pts[i].z); c[i ? 'lineTo' : 'moveTo'](s.x, s.y); }
        c.stroke();
        if (r.offRoad) { c.save(); c.setLineDash([6 * U, 6 * U]); c.beginPath(); let s = toScr(pts[n - 2].x, pts[n - 2].z); c.moveTo(s.x, s.y); s = toScr(pts[n - 1].x, pts[n - 1].z); c.lineTo(s.x, s.y); c.stroke(); c.restore(); }
      });
      c.restore(); return len;
    };
    const o = CW.story && CW.story.obj, mk = o && o.mk;
    if (mk) route(mk.x, mk.z, A.YELLOW);
    let wlen = 0; if (CW.hud.wp) wlen = route(CW.hud.wp.x, CW.hud.wp.z, A.MAG);
    // landmarks + shops
    const lm = CW.world.landmarks;
    if (lm.garage) { const s = toScr(lm.garage.x, lm.garage.z); A.badge(c, 'house', s.x, s.y, ir, A.INK, 'garage'); tag('GARAJE', s.x, s.y + ir * 2, 'c', LS); }
    if (lm.fence) { const s = toScr(lm.fence.x, lm.fence.z); A.badge(c, 'diamond', s.x, s.y, ir * 0.95, A.INK, 'fence'); tag('RECEPTADOR', s.x, s.y + ir * 2, 'c', LS); }
    if (CW.air) { const s = toScr(CW.air.heli.x, CW.air.heli.z); A.badge(c, 'circle', s.x, s.y, ir * 0.95, A.WHITE, 'heli'); tag('HELIPUERTO', s.x, s.y - ir * 2, 'c', LS); }
    const SN = { boutique: 'SOL Y COSTURA', gun: 'CAÑÓN Y BALA', mart: 'MINI EXPRESS' };
    if (CW.shops) CW.shops.list.forEach((sh) => { const s = toScr(sh.cx, sh.cz); A.badge(c, sh.kind === 'boutique' ? 'circle' : sh.kind === 'gun' ? 'hex' : 'square', s.x, s.y, ir, A.GREEN, sh.kind === 'boutique' ? 'boutique' : sh.kind === 'gun' ? 'gun' : 'market'); tag(SN[sh.kind] || 'TIENDA', s.x + ir * 1.5, s.y, 'l', LS * 0.9, 'rgba(10,90,80,.95)'); });
    // mission icon
    if (mk) {
      const s = toScr(mk.x, mk.z);
      c.lineWidth = 6 * U; c.strokeStyle = A.INK; c.beginPath(); c.arc(s.x, s.y, ir * 2, 0, 7); c.stroke();
      c.lineWidth = 3.4 * U; c.strokeStyle = A.YELLOW; c.beginPath(); c.arc(s.x, s.y, ir * 2, 0, 7); c.stroke();
      A.badge(c, 'circle', s.x, s.y, ir * 1.5, A.YELLOW, 'mission'); tag('MISIÓN', s.x, s.y - ir * 3.2, 'c', LS, A.YELLOW, A.INK);
    }
    // checkpoint pin
    if (CW.hud.wp) {
      const s = toScr(CW.hud.wp.x, CW.hud.wp.z);
      c.lineWidth = 6 * U; c.strokeStyle = A.INK; c.beginPath(); c.arc(s.x, s.y, ir * 1.9, 0, 7); c.stroke();
      c.lineWidth = 3.4 * U; c.strokeStyle = A.MAG; c.beginPath(); c.arc(s.x, s.y, ir * 1.9, 0, 7); c.stroke();
      A.badge(c, 'diamond', s.x, s.y, ir * 1.25, A.MAG, null); tag('DESTINO', s.x, s.y - ir * 3.2, 'c', LS, A.MAG, A.INK);
    }
    // police dots
    if (Wp && Wp.level >= 1) Wp.cops.forEach((q) => { if (q.hidden || q.cs === 'idle' || q.cs === 'dead') return; const s = toScr(q.x, q.z); c.fillStyle = Math.floor(performance.now() / 250) % 2 ? A.RED : A.BLUE; c.strokeStyle = A.WHITE; c.lineWidth = 1.6 * U; c.beginPath(); c.arc(s.x, s.y, 4.5 * U, 0, 7); c.fill(); c.stroke(); });
    // player: view cone (camera look direction) + facing arrow
    const ps = toScr(px, pz), cy = CW.cam.yaw, va = Math.atan2(-Math.cos(cy), -Math.sin(cy));
    c.save(); c.translate(ps.x, ps.y);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 70 * k * 1.2); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 84 * k, va - 0.62, va + 0.62); c.closePath(); c.fill();
    c.rotate(-hd); c.lineJoin = 'round'; c.fillStyle = A.WHITE; c.strokeStyle = A.INK; c.lineWidth = 4.2 * U;
    c.beginPath(); c.moveTo(0, 15 * U); c.lineTo(-10.5 * U, -10 * U); c.lineTo(0, -4 * U); c.lineTo(10.5 * U, -10 * U); c.closePath(); c.stroke(); c.fill(); c.restore();
    tag('TÚ', ps.x, ps.y - 30 * U, 'c', LS * 1.1, '#fff', A.INK);
    // north marker (north = up, as on the minimap)
    { const nx = Math.max(46 * U, tl.x - 44 * U), ny = tl.y + 62 * U; c.save(); c.translate(nx, ny); c.fillStyle = A.INK; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 26 * U, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#ff3a4a'; c.beginPath(); c.moveTo(0, -23 * U); c.lineTo(8 * U, -4 * U); c.lineTo(-8 * U, -4 * U); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.font = '900 ' + Math.round(22 * U) + 'px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', 0, 12 * U); c.restore(); }
    // cursor
    const cs = toScr(M.cur.x, M.cur.z); c.save(); c.strokeStyle = A.INK; c.lineWidth = 4 * U; c.beginPath(); c.moveTo(cs.x - 12 * U, cs.y); c.lineTo(cs.x + 12 * U, cs.y); c.moveTo(cs.x, cs.y - 12 * U); c.lineTo(cs.x, cs.y + 12 * U); c.stroke();
    c.strokeStyle = A.WHITE; c.lineWidth = 2 * U; c.stroke(); c.restore();
    // header + legend + hints
    c.save(); c.textBaseline = 'top'; c.lineJoin = 'round';
    c.font = '900 ' + Math.round(40 * U) + 'px Impact, "Arial Black", sans-serif'; c.textAlign = 'left'; c.fillStyle = '#ffc83d'; c.fillText('MAPA DE PUERTO MAREA', 24, 14 * U);
    c.font = '700 ' + Math.round(20 * U) + 'px "Trebuchet MS", sans-serif'; c.fillStyle = '#fff1d6';
    c.fillText(CW.hud.wp ? 'RUTA  ' + Math.round(wlen / 5) * 5 + ' M' : 'HAZ CLIC EN EL MAPA PARA MARCAR UN DESTINO', 26, 14 * U + 48 * U);
    c.textAlign = 'center'; c.fillStyle = '#ffd9a8'; c.font = '700 ' + Math.round(17 * U) + 'px "Trebuchet MS", sans-serif';
    c.fillText('CLIC / FLECHAS + ENTER: DESTINO  ·  C: BORRAR  ·  N / ESC: CERRAR', W / 2, H - 22 * U);
    // legend (top-right corner)
    const items = [[A.YELLOW, 'MISIÓN'], [A.MAG, 'DESTINO'], [A.GREEN, 'TIENDA'], [A.INK, 'GARAJE / RECEPTADOR'], ['rgba(255,58,74,.8)', 'BÚSQUEDA POLICIAL']];
    c.font = '800 ' + Math.round(17 * U) + 'px "Trebuchet MS", sans-serif'; c.textAlign = 'left'; const lx = W - 220 * U;
    c.fillStyle = 'rgba(5,20,28,.75)'; c.fillRect(lx - 18 * U, 8 * U, 230 * U, items.length * 26 * U + 14 * U);
    items.forEach((it, i) => { const y = 18 * U + i * 26 * U; c.fillStyle = it[0]; c.strokeStyle = A.WHITE; c.lineWidth = 2; c.beginPath(); c.arc(lx, y + 9 * U, 8 * U, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#fff1d6'; c.fillText(it[1], lx + 18 * U, y); });
    c.restore();
  }
  window.addEventListener('resize', () => { if (M.open) layout(); });
})();
