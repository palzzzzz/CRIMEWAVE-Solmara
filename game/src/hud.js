// HUD: DOM overlay + circular canvas minimap. Everything is labelled.
//
// Minimap: the static city (water, district tints, parks, two-layer roads) is pre-rendered ONCE to an offscreen
// canvas (device-pixel-ratio aware, re-built only if the on-screen size changes). Every ~30 ms the visible circle is
// redrawn: clip, blit the map rotated to the camera yaw, then the dynamic layer (search zone, GPS route, icons, player).
(function () {
  const CW = window.CW;
  // ?hold=card,radio : capture/staging only, keeps the contact card and the radio pop-up on screen instead of timing out
  const H = (CW.hud = { hold: new URLSearchParams(location.search).get('hold') || '', shown: false, state: { cash: 2500, rep: 1, repXp: 0, repNeed: 100, hp: 100, armour: 0, wanted: 0 } });
  const $ = (id) => document.getElementById(id);
  let mm = null, mctx = null, lastDistrict = -1, bannerT = 0, toastT = 0;
  const cache = {};
  const COMPASS8 = ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'];   // north = -z, as on the minimap
  const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
  const setW = (id, pct) => { const k = id + '%'; const v = Math.round(pct); if (cache[k] !== v) { cache[k] = v; $(id).style.width = v + '%'; } };

  // ---- minimap constants -----------------------------------------------------------------------------------------
  const E = 400;                 // pre-rendered map covers world -E..E (the island is +-300, so a rotated view never shows a blank corner)
  const VIEW = 95;               // world metres from the player to the rim
  const STEP_MS = 30;            // dynamic layer ~30 Hz
  const HEIGHT_FRAC = 0.15;      // minimap diameter as a share of screen height
  // base map tints (soft) + the six colours every icon draws from: ink, white, yellow, red, blue, green
  const SEA = '#3aa6c4', FOAM = '#f6fbf7', BEACH = '#f8e7bd', DOWN = '#dfe1e6', HARB = '#c8d4dc', PARK = '#a9d997', CASING = '#41505c', ROAD = '#fffdf6';
  const INK = '#0f2a3a', WHITE = '#ffffff', YELLOW = '#ffd23f', RED = '#ff3a4a', BLUE = '#3a7bff', GREEN = '#17a98c';

  let map = null, mapS = 0, mmD = 0, mmK = 1, mmR = 0, mmT = 0;
  const L = CW.C.LINES, N = L.length;

  function buildMap(S) {
    const c = document.createElement('canvas'); c.width = c.height = Math.round(E * 2 * S);
    const x = c.getContext('2d'); x.scale(S, S); x.translate(E, E); x.lineJoin = x.lineCap = 'round';
    x.fillStyle = SEA; x.fillRect(-E, -E, E * 2, E * 2);
    const B = CW.C.BOUNDS;
    x.fillStyle = FOAM; x.fillRect(B.x0 - 4, B.z0 - 4, B.x1 - B.x0 + 8, B.z1 - B.z0 + 8);              // shoreline
    const zone = (col, x0, z0, x1, z1) => { x.fillStyle = col; x.fillRect(x0, z0, x1 - x0, z1 - z0); };
    zone(HARB, B.x0, 160, B.x1, B.z1);   // districtAt(): z>160 harbour, else x>80 beachfront, else downtown
    zone(BEACH, 80, B.z0, B.x1, 160);
    zone(DOWN, B.x0, B.z0, 80, 160);
    x.fillStyle = 'rgba(15,42,58,0.07)'; CW.world.blocks.forEach((b) => x.fillRect(b.cx - 32, b.cz - 32, 64, 64));   // block slabs, barely there
    x.fillStyle = PARK; CW.world.footprints.forEach((f) => { if (f.park) x.fillRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0); });
    const W = CW.C.ROAD_W, a = L[0], b = L[N - 1];
    [[W + 4, CASING], [W, ROAD]].forEach(([lw, col]) => {   // two layers: dark edge first everywhere, then the light fill, so junctions merge
      x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
      L.forEach((l) => { x.moveTo(l, a); x.lineTo(l, b); x.moveTo(a, l); x.lineTo(b, l); });
      x.stroke();
    });
    map = c; mapS = S;
  }

  // sizes the canvas to ~15% of the screen height at the device pixel ratio; rebuilds the base map only if it got noticeably blurrier
  H.layout = function () {
    if (!mm) return;
    const d = Math.round(CW.clamp(innerHeight * HEIGHT_FRAC, 96, 220)), k = window.devicePixelRatio || 1;
    mmD = d; mmK = k; mmR = d / 2;
    mm.width = mm.height = Math.round(d * k); mm.style.width = mm.style.height = d + 'px'; $('mmwrap').style.width = d + 'px';
    const bars = $('bars'); if (bars) bars.style.left = (22 + d + 18) + 'px';
    const need = Math.min(3, Math.max(1, (mmR / VIEW) * k * 1.25));
    if (!map || need > mapS * 1.15 || need < mapS * 0.6) buildMap(need);
    mmT = 0;
  };

  H.init = function () {
    mm = $('mm'); mctx = mm.getContext('2d');
    let s = ''; for (let i = 0; i < 5; i++) s += '<span class="star">★</span>';
    $('stars').innerHTML = s;
    H.layout();
    window.addEventListener('resize', H.layout);
    const hs = () => document.documentElement.style.setProperty('--hs', String(Math.max(1, Math.min(2, innerHeight / 720)).toFixed(3)));
    hs(); window.addEventListener('resize', hs);
  };

  H.show = function (v) { H.shown = v; $('hud').style.display = v ? 'block' : 'none'; };
  H.banner = function (t, s) { $('banner').textContent = t; $('bannersub').textContent = s || ''; bannerT = 3.6; };
  H.toast = function (t) { $('toast').textContent = t; $('toast').style.opacity = 1; toastT = 2.6; };

  // ---- GPS: route along the real street graph (CW.roads, a 7x7 junction grid) --------------------------------------------
  const fields = new Map();        // BFS step-count field per goal junction, cached
  const field = (i, j) => { const k = i * N + j; let f = fields.get(k); if (!f) { f = CW.roads.bfs(i, j); fields.set(k, f); } return f; };
  function snap(x, z) {            // nearest point on the street network + the two junctions at the ends of that street segment
    const n = CW.roads.nearest(x, z), lo = L[0], hi = L[N - 1];
    if (Math.abs(x - L[n.i]) <= Math.abs(z - L[n.j])) {
      const zz = CW.clamp(z, lo, hi), j0 = CW.clamp(Math.floor((zz - lo) / 80), 0, N - 2);
      return { x: L[n.i], z: zz, ends: [[n.i, j0], [n.i, j0 + 1]], seg: 'v' + n.i + ':' + j0 };
    }
    const xx = CW.clamp(x, lo, hi), i0 = CW.clamp(Math.floor((xx - lo) / 80), 0, N - 2);
    return { x: xx, z: L[n.j], ends: [[i0, n.j], [i0 + 1, n.j]], seg: 'h' + i0 + ':' + n.j };
  }
  // returns a world polyline [{x,z}...] and flags: `last` is how far the final leg leaves the roads (straight line)
  function planRoute(px, pz, tx, tz) {
    const sp = snap(px, pz), st = snap(tx, tz), pts = [{ x: px, z: pz }, { x: sp.x, z: sp.z }];
    if (sp.seg !== st.seg) {
      let best = null;
      for (const a of sp.ends) for (const b of st.ends) {
        const f = field(b[0], b[1]), c = Math.hypot(sp.x - L[a[0]], sp.z - L[a[1]]) + f[a[0] * N + a[1]] * 80 + Math.hypot(st.x - L[b[0]], st.z - L[b[1]]);
        if (!best || c < best.c) best = { c, a, b, f };
      }
      let [i, j] = best.a; pts.push({ x: L[i], z: L[j] });
      for (let g = 0; g < 16 && best.f[i * N + j] > 0; g++) {
        const cur = best.f[i * N + j];
        for (let k = 0; k < 4; k++) { const ni = i + CW.roads.DIRS[k][0], nj = j + CW.roads.DIRS[k][1]; if (CW.roads.valid(ni, nj) && best.f[ni * N + nj] < cur) { i = ni; j = nj; break; } }
        pts.push({ x: L[i], z: L[j] });
      }
    }
    pts.push({ x: st.x, z: st.z }, { x: tx, z: tz });
    return { pts, offRoad: Math.hypot(st.x - tx, st.z - tz) > 3 };
  }

  // ---- icon drawing (screen space, constant pixel size, upright) ---------------------------------------------------------
  const pt = { x: 0, y: 0, off: false, ang: 0 };
  function shapePath(c, shape, r) {
    c.beginPath();
    if (shape === 'hex') { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }
    else if (shape === 'square') { const q = r * 0.86, k = r * 0.3; c.moveTo(-q + k, -q); c.arcTo(q, -q, q, q, k); c.arcTo(q, q, -q, q, k); c.arcTo(-q, q, -q, -q, k); c.arcTo(-q, -q, q, -q, k); c.closePath(); }
    else if (shape === 'diamond') { c.moveTo(0, -r * 1.2); c.lineTo(r * 1.2, 0); c.lineTo(0, r * 1.2); c.lineTo(-r * 1.2, 0); c.closePath(); }
    else if (shape === 'house') { c.moveTo(0, -r * 1.1); c.lineTo(r * 1.05, -r * 0.25); c.lineTo(r * 0.9, r * 0.95); c.lineTo(-r * 0.9, r * 0.95); c.lineTo(-r * 1.05, -r * 0.25); c.closePath(); }
    else c.arc(0, 0, r, 0, 7);
  }
  const GLYPH = {
    boutique(c, g) { c.beginPath(); c.arc(0, -g * 0.62, g * 0.26, 0, 7); c.moveTo(0, -g * 0.36); c.lineTo(0, 0); c.lineTo(-g, g * 0.68); c.lineTo(g, g * 0.68); c.lineTo(0, 0); c.stroke(); },
    gun(c, g) { c.beginPath(); c.arc(0, 0, g * 0.62, 0, 7); c.moveTo(0, -g * 1.05); c.lineTo(0, -g * 0.32); c.moveTo(0, g * 1.05); c.lineTo(0, g * 0.32); c.moveTo(-g * 1.05, 0); c.lineTo(-g * 0.32, 0); c.moveTo(g * 1.05, 0); c.lineTo(g * 0.32, 0); c.stroke(); c.beginPath(); c.arc(0, 0, g * 0.16, 0, 7); c.fill(); },
    market(c, g) { c.beginPath(); c.moveTo(-g, -g * 0.05); c.lineTo(g, -g * 0.05); c.lineTo(g * 0.62, g * 0.88); c.lineTo(-g * 0.62, g * 0.88); c.closePath(); c.fill(); c.beginPath(); c.arc(0, -g * 0.05, g * 0.56, Math.PI, 0); c.stroke(); },
    fence(c, g) { c.font = '900 ' + Math.round(g * 2.1) + 'px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, g * 0.1); },
    garage(c, g) { c.beginPath(); c.moveTo(-g, g * 0.05); c.lineTo(-g * 0.55, g * 0.05); c.lineTo(-g * 0.3, -g * 0.55); c.lineTo(g * 0.4, -g * 0.55); c.lineTo(g * 0.65, g * 0.05); c.lineTo(g, g * 0.05); c.lineTo(g, g * 0.62); c.lineTo(-g, g * 0.62); c.closePath(); c.fill(); c.beginPath(); c.arc(-g * 0.52, g * 0.66, g * 0.27, 0, 7); c.arc(g * 0.52, g * 0.66, g * 0.27, 0, 7); c.fill(); },
    mission(c, g) { c.fillStyle = INK; c.fillRect(-g * 0.16, -g * 0.85, g * 0.32, g * 1.1); c.beginPath(); c.arc(0, g * 0.62, g * 0.2, 0, 7); c.fill(); },
    heli(c, g) { c.fillStyle = INK; c.font = '900 ' + Math.round(g * 2.2) + 'px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 0, g * 0.1); },
  };
  // a white-edged badge (thin dark outer line so the white edge also reads on the pale roads) with a white glyph
  function badge(c, shape, x, y, r, fill, glyph) {
    c.save(); c.translate(x, y); c.lineJoin = c.lineCap = 'round';
    shapePath(c, shape, r); c.fillStyle = fill; c.fill();
    const w = Math.max(1.6, r * 0.22);
    c.lineWidth = w + 1.6; c.strokeStyle = INK; c.stroke(); c.lineWidth = w; c.strokeStyle = WHITE; c.stroke();
    if (glyph) { c.fillStyle = c.strokeStyle = WHITE; c.lineWidth = Math.max(1.3, r * 0.17); GLYPH[glyph](c, r * 0.55); }
    c.restore();
  }

  // ---- per-draw minimap ------------------------------------------------------------------------------------------------------
  function drawMinimap(P, cam) {
    const c = mctx, d = mmD, R = mmR, sc = R / VIEW, u = d / 120, ir = Math.max(7.5, d * 0.072);   // u: general px unit, ir: badge radius
    const car = P.mode === 'car' ? P.car : null, e = P.active;
    const px = car ? car.x : e.x, pz = car ? car.z : e.z, hd = car ? car.h : e.h;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), now = performance.now() / 1000;
    const scr = (wx, wz, margin) => {   // world -> minimap pixels; with a margin, points past the rim are pinned to it (off = true)
      const dx = wx - px, dz = wz - pz; let X = (dx * cy - dz * sy) * sc, Y = (dx * sy + dz * cy) * sc;
      pt.off = false; pt.ang = Math.atan2(Y, X);
      if (margin !== undefined) { const m = Math.hypot(X, Y), lim = R - margin; if (m > lim) { X *= lim / m; Y *= lim / m; pt.off = true; } }
      pt.x = R + X; pt.y = R + Y; return pt;
    };
    c.setTransform(mmK, 0, 0, mmK, 0, 0); c.clearRect(0, 0, d, d);
    c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.clip();
    c.fillStyle = SEA; c.fillRect(0, 0, d, d);
    c.save(); c.translate(R, R); c.rotate(cam.yaw); c.scale(sc, sc); c.translate(-px, -pz); c.imageSmoothingQuality = 'high'; c.drawImage(map, -E, -E, E * 2, E * 2); c.restore();

    // red search zone while wanted and the cops have lost sight of you; breathes softly
    const Wp = CW.police;
    if (Wp && Wp.level >= 1 && !Wp.seen) {
      const s = scr(Wp.last.x, Wp.last.z), pulse = Math.sin(now * 4);
      c.save(); c.fillStyle = 'rgba(255,58,74,' + (0.2 + 0.08 * pulse) + ')'; c.strokeStyle = 'rgba(255,58,74,.95)'; c.lineWidth = 2.2 * u; c.setLineDash([8 * u, 5 * u]);
      c.beginPath(); c.arc(s.x, s.y, (52 + Wp.level * 11) * sc * (1 + 0.025 * pulse), 0, 7); c.fill(); c.stroke(); c.restore();
    }
    // GPS to the active mission target: along the street graph, last leg dashed if the target is off the grid
    const o = CW.story && CW.story.obj, mk = o && o.mk;
    if (mk) {
      const r = planRoute(px, pz, mk.x, mk.z), pts = r.pts, n = pts.length;
      c.save(); c.lineJoin = c.lineCap = 'round';
      [[5.6 * u, INK], [3.2 * u, YELLOW]].forEach(([lw, col]) => {
        c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
        for (let i = 0; i < n - (r.offRoad ? 1 : 0); i++) { const s = scr(pts[i].x, pts[i].z); c[i ? 'lineTo' : 'moveTo'](s.x, s.y); }
        c.stroke();
        if (r.offRoad) { c.save(); c.setLineDash([4 * u, 4 * u]); c.beginPath(); let s = scr(pts[n - 2].x, pts[n - 2].z); c.moveTo(s.x, s.y); s = scr(pts[n - 1].x, pts[n - 1].z); c.lineTo(s.x, s.y); c.stroke(); c.restore(); }
      });
      c.restore();
    }
    // landmarks: garage, fence, helipad, the three shops (distinct silhouette + glyph each)
    const lm = CW.world.landmarks, show = (x, z) => Math.hypot(x - px, z - pz) < VIEW * 1.25;
    if (lm.garage && show(lm.garage.x, lm.garage.z)) { const s = scr(lm.garage.x, lm.garage.z); badge(c, 'house', s.x, s.y, ir, INK, 'garage'); }
    if (lm.fence && show(lm.fence.x, lm.fence.z)) { const s = scr(lm.fence.x, lm.fence.z); badge(c, 'diamond', s.x, s.y, ir * 0.95, INK, 'fence'); }
    if (CW.air && show(CW.air.heli.x, CW.air.heli.z)) { const s = scr(CW.air.heli.x, CW.air.heli.z); badge(c, 'circle', s.x, s.y, ir * 0.95, WHITE, 'heli'); }
    if (CW.shops) CW.shops.list.forEach((sh) => { if (!show(sh.cx, sh.cz)) return; const s = scr(sh.cx, sh.cz); badge(c, sh.kind === 'boutique' ? 'circle' : sh.kind === 'gun' ? 'hex' : 'square', s.x, s.y, ir, GREEN, sh.kind === 'boutique' ? 'boutique' : sh.kind === 'gun' ? 'gun' : 'market'); });
    // pickups and the street gang: small dots
    if (CW.enemies) {
      CW.enemies.pickups.forEach((k) => { if (!k.on || !show(k.x, k.z)) return; const s = scr(k.x, k.z); c.fillStyle = GREEN; c.strokeStyle = WHITE; c.lineWidth = 1.5 * u; c.beginPath(); c.arc(s.x, s.y, 2.6 * u, 0, 7); c.fill(); c.stroke(); });
      CW.enemies.gang.forEach((g) => { if (g.state === 'dead' || !show(g.x, g.z)) return; const s = scr(g.x, g.z); c.fillStyle = g.state === 'fight' ? RED : INK; c.strokeStyle = WHITE; c.lineWidth = 1.5 * u; c.beginPath(); c.arc(s.x, s.y, 3 * u, 0, 7); c.fill(); c.stroke(); });
    }
    // police: flashing red/blue dots pinned to the rim when far, roadblocks as red squares; the police helicopter as a wedge
    if (Wp && Wp.level >= 1) {
      const flash = Math.floor(now * 4) % 2 === 0;
      Wp.cops.forEach((k) => {
        if (k.hidden || k.cs === 'idle' || k.cs === 'dead') return;
        const s = scr(k.x, k.z, 5 * u), rr = (s.off ? 3.2 : 4.4) * u; c.fillStyle = k.cs === 'roadblock' || flash ? RED : BLUE; c.strokeStyle = WHITE; c.lineWidth = 1.6 * u; c.beginPath();
        if (k.cs === 'roadblock') c.rect(s.x - rr, s.y - rr, rr * 2, rr * 2); else c.arc(s.x, s.y, rr, 0, 7);
        c.fill(); c.stroke();
      });
    }
    const ph = CW.air && CW.air.policeHeli;
    if (ph && ph.active) { const s = scr(ph.x, ph.z, 7 * u); c.save(); c.translate(s.x, s.y); c.fillStyle = Math.floor(now * 4) % 2 ? RED : BLUE; c.strokeStyle = WHITE; c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(0, -7 * u); c.lineTo(5.5 * u, 4.5 * u); c.lineTo(-5.5 * u, 4.5 * u); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    // active mission icon: big yellow badge, soft pulse + ripple; a rim arrow when it is out of view
    if (mk) {
      // thumbnail pass: everything ~1.5x bigger with a dark under-stroke, so it still reads when the whole frame is shrunk to ~480 px
      const s = scr(mk.x, mk.z, 13 * u), pulse = 1 + Math.sin(now * 4.5) * 0.2;
      if (s.off) {
        c.save(); c.translate(s.x, s.y); c.rotate(s.ang + Math.PI / 2); c.fillStyle = YELLOW; c.strokeStyle = INK; c.lineWidth = 4.4 * u; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(0, -14 * u); c.lineTo(12 * u, 9 * u); c.lineTo(0, 3 * u); c.lineTo(-12 * u, 9 * u); c.closePath(); c.stroke(); c.fill();
        c.strokeStyle = WHITE; c.lineWidth = 1.6 * u; c.stroke(); c.restore();
      } else {
        const ph2 = (now * 0.9) % 1;
        // static ring (dark outline + yellow) so the target is findable even between pulses, plus the expanding ripple
        c.lineWidth = 5.5 * u; c.strokeStyle = INK; c.beginPath(); c.arc(s.x, s.y, ir * 2.0, 0, 7); c.stroke();
        c.lineWidth = 3 * u; c.strokeStyle = YELLOW; c.beginPath(); c.arc(s.x, s.y, ir * 2.0, 0, 7); c.stroke();
        c.strokeStyle = 'rgba(255,210,63,' + (0.85 * (1 - ph2)) + ')'; c.lineWidth = 3.4 * u; c.beginPath(); c.arc(s.x, s.y, ir * (1.6 + ph2 * 1.6), 0, 7); c.stroke();
        badge(c, 'circle', s.x, s.y, ir * 1.6 * pulse, YELLOW, 'mission');
      }
    }
    // player arrow (points where the car / character faces)
    c.save(); c.translate(R, R); c.rotate(cam.yaw - hd); c.lineJoin = 'round'; c.fillStyle = WHITE; c.strokeStyle = INK; c.lineWidth = 4.2 * u;
    c.beginPath(); c.moveTo(0, 17 * u); c.lineTo(-12 * u, -12 * u); c.lineTo(0, -5 * u); c.lineTo(12 * u, -12 * u); c.closePath(); c.stroke(); c.fill(); c.restore();
    c.restore();
    // rim + north marker (rides the rim at the world's north)
    c.lineWidth = 3; c.strokeStyle = INK; c.beginPath(); c.arc(R, R, R - 1.5, 0, 7); c.stroke();
    const nr = R - ir * 0.95, nx = R + Math.sin(cam.yaw) * nr, ny = R - Math.cos(cam.yaw) * nr;
    c.save(); c.translate(nx, ny); shapePath(c, 'circle', ir * 0.9); c.fillStyle = INK; c.fill(); c.lineWidth = 1.8; c.strokeStyle = WHITE; c.stroke();
    c.fillStyle = WHITE; c.font = '900 ' + Math.round(ir * 1.05) + 'px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', 0, ir * 0.06); c.restore();
  }

  H.update = function (dt) {
    if (!H.shown) return;
    const P = CW.player, st = H.state, e = P.active;
    const t = performance.now(); if (t - mmT >= STEP_MS) { mmT = t; drawMinimap(P, CW.cam); }
    setText('cash', '$' + st.cash.toLocaleString('en-US'));
    setText('clock', CW.sky.clock() + (CW.weather && CW.weather.wet > 0.3 ? '  ·  RAIN' : ''));
    setW('stbar', P.stamina); $('stbar').style.opacity = P.winded ? 0.55 : 1;
    setText('who', e.def.name);
    setW('hpbar', st.hp); setW('arbar', st.armour); setW('repbar', (st.repXp / st.repNeed) * 100);
    setText('replv', 'REP LV ' + st.rep + '   ' + st.repXp + '/' + st.repNeed);
    const stars = $('stars').children;
    for (let i = 0; i < 5; i++) { const on = i < st.wanted; if (stars[i].dataset.on !== String(on)) { stars[i].dataset.on = String(on); stars[i].classList.toggle('on', on); } }
    // wanted status: big stars + whether the police can see you; when they cannot, where the search zone is (same circle the minimap draws)
    const Wp = CW.police, wb = $('wanted'), wOn = st.wanted > 0;
    if (cache.wOn !== wOn) { cache.wOn = wOn; wb.style.display = wOn ? 'block' : 'none'; }
    if (wOn) {
      const seen = Wp.seen; setText('wstat', seen ? 'IN SIGHT' : 'SEARCHING'); if (cache.wcls !== seen) { cache.wcls = seen; $('wstat').className = seen ? 'seen' : 'lost'; }
      let sub = '';
      if (!seen) {
        const pf = P.focus(), dx = Wp.last.x - pf.x, dz = Wp.last.z - pf.z, dist = Math.hypot(dx, dz), inside = dist < 52 + Wp.level * 11;
        sub = inside ? 'INSIDE THE SEARCH ZONE  ·  STAY HIDDEN' : 'SEARCH ZONE ' + COMPASS8[(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8] + '  ·  ' + Math.round(dist / 5) * 5 + ' M';
      }
      setText('wsub', sub);
    }
    const car = P.mode === 'car' ? P.car : null;
    $('carpanel').style.display = car ? 'block' : 'none';
    if (car) {
      setText('spd', String(Math.round(car.speed * 3.6)));
      setText('carname', car.type.name);
      setW('carhp', car.hp);
      const hc = car.hp > 66 ? '' : car.hp > 33 ? 'mid' : 'low'; if (cache.hpc !== hc) { cache.hpc = hc; $('carhp').className = hc; }
      // gear is cosmetic: five even slices of the top speed, N when rolling, R when the forward speed is negative
      setText('gear', car.fs < -0.6 ? 'R' : car.speed < 0.8 ? 'N' : String(CW.clamp(Math.ceil(car.speed / (car.type.max / 5)), 1, 5)));
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
