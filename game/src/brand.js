// Marca + idioma: (1) CW.es.tr traduce las pocas cadenas de air.js (que no se toca) cuando pasan por el HUD,
// (2) texturas del logo "make.fun" (1024 px, texto blanco, letrero de neón), el gran letrero de pared y la librea del VESPER GT.
(function () {
  const CW = window.CW;
  const MAP = {
    'HELICOPTER  —  SPACE UP · SHIFT DOWN · W/S FORWARD · A/D TURN': 'HELICÓPTERO  —  ESPACIO SUBE · SHIFT BAJA · W/S ADELANTE · A/D GIRA',
    'HELICOPTER DAMAGED': 'HELICÓPTERO DAÑADO',
    'TURN BACK — OUT OF THE CITY': 'REGRESA — SALES DE LA CIUDAD',
    'Your helicopter crashed': 'Tu helicóptero se estrelló',
    'E  EXIT HELICOPTER': 'E  BAJAR DEL HELICÓPTERO',
    'Air support inbound. Searchlight on the suspect.': 'Apoyo aéreo en camino. Reflector sobre el sospechoso.',
    'Air One is hit — going down! Mayday, mayday!': '¡Aire Uno herido, nos caemos! ¡Auxilio, auxilio!',
    'Suspect lost. Air One returning to base.': 'Sospechoso perdido. Aire Uno regresa a la base.',
    'SPINNING UP…': 'ARRANCANDO…',
    'ON THE GROUND — SPACE TO LIFT OFF': 'EN TIERRA — ESPACIO PARA DESPEGAR',
    'LANDED — E TO EXIT': 'ATERRIZADO — E PARA BAJAR',
    'AIRBORNE': 'EN VUELO',
  };
  CW.es = { tr: (s) => (s && MAP[s]) || s };
  // h-state is written straight from air.js: translate it as it changes
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('h-state'); if (!el) return;
    new MutationObserver(() => { const t = MAP[el.textContent]; if (t) el.textContent = t; }).observe(el, { childList: true, characterData: true, subtree: true });
  });

  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function fitFont(x, text, maxW, px, family) { x.font = '900 ' + px + 'px ' + family; const w = x.measureText(text).width; return w > maxW ? Math.floor(px * maxW / w) : px; }
  const FAM = '"Arial Black", Impact, "Trebuchet MS", sans-serif';
  const B = (CW.brand = {});

  // the neon board: dark glass panel, double neon border, big white "make.fun", 1024 x 512
  B.boardTexture = function () {
    if (B._board) return B._board;
    const W = 1024, H = 512, c = canvas(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120a2a'); g.addColorStop(1, '#0a0618'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const rg = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.6); rg.addColorStop(0, 'rgba(120,70,255,.35)'); rg.addColorStop(1, 'rgba(120,70,255,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
    const rr = (i, col, lw, blur) => { x.save(); x.strokeStyle = col; x.lineWidth = lw; x.shadowColor = col; x.shadowBlur = blur; x.beginPath(); x.roundRect ? x.roundRect(i, i, W - 2 * i, H - 2 * i, 38) : x.rect(i, i, W - 2 * i, H - 2 * i); x.stroke(); x.restore(); };
    rr(22, '#ff3fd0', 12, 26); rr(50, '#2ff0ff', 8, 20);
    const text = 'make.fun', px = fitFont(x, text, W * 0.84, 250, FAM);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 ' + px + 'px ' + FAM;
    x.save(); x.shadowColor = '#ff3fd0'; x.shadowBlur = 50; x.fillStyle = '#ffffff'; x.fillText(text, W / 2, H / 2 + 6); x.restore();
    x.save(); x.shadowColor = '#2ff0ff'; x.shadowBlur = 18; x.fillStyle = '#ffffff'; x.fillText(text, W / 2, H / 2 + 6); x.restore();
    x.fillStyle = '#ffffff'; x.fillText(text, W / 2, H / 2 + 6);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 16; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; return (B._board = t);
  };
  // livery: transparent, white letters with a dark rim and a pink / cyan offset, 1024 x 200
  B.liveryTexture = function () {
    if (B._liv) return B._liv;
    const W = 1024, H = 200, c = canvas(W, H), x = c.getContext('2d'), text = 'make.fun', px = fitFont(x, text, W * 0.94, 170, FAM);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 ' + px + 'px ' + FAM; x.lineJoin = 'round';
    x.fillStyle = '#ff3fd0'; x.fillText(text, W / 2 + 7, H / 2 + 9); x.fillStyle = '#2ff0ff'; x.fillText(text, W / 2 - 5, H / 2 + 7);
    x.strokeStyle = '#12091f'; x.lineWidth = 16; x.strokeText(text, W / 2, H / 2 + 4);
    x.fillStyle = '#ffffff'; x.fillText(text, W / 2, H / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 16; return (B._liv = t);
  };

  // big wall + lit board. (x, z) = foot centre of the wall; ry = direction the board faces (0 = +z)
  B.buildWall = function (scene, x, z, ry, w, h) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const bw = w - 2.4, bh = h - 2.0, by = h * 0.5 + 0.4;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h + 1.2, 1.6), new THREE.MeshLambertMaterial({ color: 0x5d636c })); wall.position.set(0, (h + 1.2) / 2, 0); wall.castShadow = true; g.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, 2.2), new THREE.MeshLambertMaterial({ color: 0x3a3f46 })); cap.position.set(0, h + 1.45, 0); g.add(cap);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw / 2 > bh ? bh : bw / 2), new THREE.MeshBasicMaterial({ map: B.boardTexture(), fog: false }));
    const bph = bw / 2 > bh ? bh : bw / 2; board.scale.set(1, 1, 1); board.position.set(0, by, 0.85); g.add(board);
    const neon = (col, ww, hh, px, py) => { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.16), new THREE.MeshBasicMaterial({ color: col, fog: false })); m.position.set(px, py, 0.9); g.add(m); };
    const hx = bw / 2 + 0.25, hy = bph / 2 + 0.25;
    neon(0xff3fd0, bw + 0.9, 0.22, 0, by + hy); neon(0xff3fd0, bw + 0.9, 0.22, 0, by - hy); neon(0x2ff0ff, 0.22, bph + 0.7, -hx, by); neon(0x2ff0ff, 0.22, bph + 0.7, hx, by);
    // soft light wash on the wall and the road in front
    const wash = new THREE.PointLight(0xc070ff, 1.1, 60, 1.6); wash.position.set(0, by, 6); g.add(wash);
    g.userData.board = board; B.wall = g; return g;
  };

  // livery on every VESPER GT: both doors, bonnet, roof (read from behind and above)
  B.livery = function (car) {
    const t = car.type; if (t.id !== 'sports' || !car.mesh || car.mesh.userData.liv) return;
    const grp = new THREE.Group(); car.mesh.userData.liv = grp; car.mesh.add(grp);
    const mat = () => new THREE.MeshLambertMaterial({ map: B.liveryTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, emissive: 0x444444, emissiveMap: B.liveryTexture() });
    const plane = (w, h, px, py, pz, rx, ry, rz) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat()); m.position.set(px, py, pz); m.rotation.set(rx, ry, rz); m.renderOrder = 4; grp.add(m); };
    const hw = t.w / 2;
    plane(1.45, 0.283, hw + 0.026, 0.45, -0.15, 0, Math.PI / 2, 0);         // left door (car-right)
    plane(1.45, 0.283, -hw - 0.026, 0.45, -0.15, 0, -Math.PI / 2, 0);       // right door
    plane(1.25, 0.244, 0, 0.664, 0.95, -Math.PI / 2, 0, Math.PI);            // bonnet
    plane(1.15, 0.224, 0, 1.133, -0.2, -Math.PI / 2, 0, Math.PI);            // roof
  };
})();

// ---- siluetas vectoriales de las armas (rueda de armas + ranuras del HUD) ------------------------------------------------------------
// weaponIcon dibuja en el ctx, centrada en (0,0), con media anchura = s px (el icono ocupa unos 2s x 1.2s). Relleno claro + contorno oscuro.
(function () {
  const CW = window.CW, B = CW.brand;
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p[0], p[1])); c.closePath(); }
  B.weaponIcon = function (c, id, s, fill, rim) {
    c.save(); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    const ink = rim || 'rgba(8,12,24,.85)', lw = 0.075;
    const F = () => { c.lineWidth = lw; c.strokeStyle = ink; c.stroke(); c.fillStyle = fill; c.fill(); };
    if (id === 'fists') {
      rr(c, -0.95, -0.3, 0.5, 0.6, 0.08); F();                                   // muñeca
      rr(c, -0.5, -0.42, 0.9, 0.84, 0.2); F();                                   // palma
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0.4, -0.32 + i * 0.215, 0.13, 0, 7); F(); }   // nudillos
      c.beginPath(); c.ellipse(0.05, 0.38, 0.4, 0.15, -0.12, 0, 7); F();         // pulgar
    } else if (id === 'knife') {
      rr(c, -1.0, -0.13, 0.62, 0.26, 0.1); F();                                  // mango
      rr(c, -0.4, -0.34, 0.12, 0.68, 0.05); F();                                 // guarda
      c.beginPath(); c.moveTo(-0.28, -0.2); c.lineTo(0.55, -0.22); c.quadraticCurveTo(1.0, -0.12, 1.02, 0.02); c.lineTo(-0.28, 0.17); c.closePath(); F();   // hoja
      c.beginPath(); c.moveTo(-0.1, -0.02); c.lineTo(0.7, -0.07); c.lineWidth = 0.04; c.strokeStyle = 'rgba(8,12,24,.45)'; c.stroke();
    } else if (id === 'pistol') {
      rr(c, -0.8, -0.42, 1.7, 0.36, 0.07); F();                                  // corredera
      rr(c, -0.55, -0.1, 1.15, 0.16, 0.04); F();                                 // armazón
      poly(c, [[-0.6, 0.04], [-0.16, 0.04], [-0.3, 0.66], [-0.74, 0.66]]); F(); // empuñadura
      c.beginPath(); c.arc(0.12, 0.14, 0.17, 0, Math.PI); c.lineWidth = 0.09; c.strokeStyle = ink; c.stroke(); c.lineWidth = 0.05; c.strokeStyle = fill; c.stroke();   // guardamonte
      c.fillStyle = ink; c.fillRect(0.72, -0.5, 0.07, 0.08); c.fillRect(-0.7, -0.5, 0.1, 0.08);
    } else if (id === 'smg') {
      rr(c, -0.75, -0.3, 1.45, 0.34, 0.07); F();                                 // cuerpo
      rr(c, 0.68, -0.22, 0.38, 0.12, 0.04); F();                                 // cañón
      poly(c, [[-0.75, -0.24], [-1.08, -0.18], [-1.08, 0.12], [-0.75, 0.02]]); F();   // culata
      poly(c, [[-0.05, 0.02], [0.26, 0.02], [0.2, 0.66], [-0.14, 0.66]]); F();   // cargador
      poly(c, [[-0.52, 0.04], [-0.28, 0.04], [-0.38, 0.5], [-0.62, 0.5]]); F(); // empuñadura
      rr(c, -0.4, -0.42, 0.5, 0.12, 0.04); F();                                  // mira
    } else if (id === 'shotgun') {
      rr(c, -0.1, -0.24, 1.15, 0.13, 0.05); F();                                 // cañón
      rr(c, -0.05, -0.08, 0.95, 0.11, 0.05); F();                                // tubo del cargador
      rr(c, -0.38, -0.3, 0.56, 0.36, 0.07); F();                                 // recámara
      rr(c, 0.3, 0.02, 0.4, 0.17, 0.07); F();                                    // guardamanos
      poly(c, [[-0.38, -0.26], [-1.05, 0.04], [-1.05, 0.44], [-0.5, 0.3], [-0.38, 0.05]]); F();   // culata
    } else if (id === 'molotov') {
      rr(c, -0.12, -0.55, 0.24, 0.5, 0.06); F();                                 // cuello
      rr(c, -0.38, -0.1, 0.76, 0.78, 0.2); F();                                  // botella
      c.beginPath(); c.moveTo(0, -1.0); c.quadraticCurveTo(0.26, -0.78, 0.1, -0.55); c.lineTo(-0.1, -0.55); c.quadraticCurveTo(-0.28, -0.76, 0, -1.0); c.closePath(); c.lineWidth = lw; c.strokeStyle = ink; c.stroke(); c.fillStyle = '#ffb43a'; c.fill();   // llama
      c.fillStyle = 'rgba(8,12,24,.35)'; c.fillRect(-0.38, 0.12, 0.76, 0.2);
    }
    c.restore();
  };
})();
