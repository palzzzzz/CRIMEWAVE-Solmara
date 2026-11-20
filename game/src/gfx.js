// Geometry batching (merge-by-hand so static city geometry is a handful of draw calls) and canvas textures.
(function () {
  const CW = window.CW;
  const colCache = new Map();
  const rgb = (c) => { let v = colCache.get(c); if (!v) { v = CW.hex(c); colCache.set(c, v); } return v; };
  CW.rgb = rgb;

  const WIN_TILE_W = 16;   // metres of facade covered by one texture tile (4 windows)
  const WIN_TILE_H = 14.4; // 4 floors of 3.6 m
  CW.WIN = { W: WIN_TILE_W, H: WIN_TILE_H, FLOOR: 3.6, BAY: 4 };

  // corners listed bottom-left, bottom-right, top-right, top-left as seen from outside
  const FACES = [
    { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], side: 'x' },
    { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], side: 'x' },
    { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], side: 'z' },
    { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], side: 'z' },
    { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], side: 'y' },
    { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], side: 'y' },
  ];

  class Batch {
    constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.count = 0; }

    vert(x, y, z, nx, ny, nz, col, u, v) {
      this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); this.u.push(u, v); this.count++;
    }

    // generic quad from four [x,y,z] points (counter-clockwise from the front). Colour per quad.
    quad(a, b, c, d, color, uvs) {
      const col = rgb(color);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const t = uvs || [0, 0, 0, 0, 0, 0, 0, 0];
      this.vert(a[0], a[1], a[2], nx, ny, nz, col, t[0], t[1]);
      this.vert(b[0], b[1], b[2], nx, ny, nz, col, t[2], t[3]);
      this.vert(c[0], c[1], c[2], nx, ny, nz, col, t[4], t[5]);
      this.vert(a[0], a[1], a[2], nx, ny, nz, col, t[0], t[1]);
      this.vert(c[0], c[1], c[2], nx, ny, nz, col, t[4], t[5]);
      this.vert(d[0], d[1], d[2], nx, ny, nz, col, t[6], t[7]);
    }

    // axis-aligned (optionally yawed) box. opts.win -> facade UVs; opts.skip -> array of face indices to omit
    box(cx, cy, cz, sx, sy, sz, color, ry, opts) {
      const col = rgb(color);
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      const cs = Math.cos(ry || 0), sn = Math.sin(ry || 0);
      const win = opts && opts.win;
      const skip = opts && opts.skip;
      const u0 = win ? (opts.u0 || 0) : 0;
      const vb = win ? (cy - hy) / WIN_TILE_H : 0;
      for (let f = 0; f < 6; f++) {
        if (skip && skip.indexOf(f) >= 0) continue;
        const F = FACES[f];
        const pts = [];
        for (let k = 0; k < 4; k++) {
          const lx = F.c[k][0] * hx, ly = F.c[k][1] * hy, lz = F.c[k][2] * hz;
          pts.push([cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs]);
        }
        const nx = F.n[0] * cs + F.n[2] * sn, nz = -F.n[0] * sn + F.n[2] * cs, ny = F.n[1];
        let uv;
        if (win && F.side !== 'y') {
          const w = (F.side === 'x' ? sz : sx) / WIN_TILE_W;
          const h = sy / WIN_TILE_H;
          uv = [u0, vb, u0 + w, vb, u0 + w, vb + h, u0, vb + h];
        } else if (win) {
          uv = [0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012];
        } else uv = [0, 0, 0, 0, 0, 0, 0, 0];
        const order = [0, 1, 2, 0, 2, 3];
        for (let i = 0; i < 6; i++) {
          const k = order[i];
          this.vert(pts[k][0], pts[k][1], pts[k][2], nx, ny, nz, col, uv[k * 2], uv[k * 2 + 1]);
        }
      }
    }

    // flat horizontal rectangle facing up
    flat(cx, y, cz, w, d, color, ry) { this.box(cx, y - 0.005, cz, w, 0.01, d, color, ry, { skip: [0, 1, 2, 3, 5] }); }

    // any three.js geometry placed by position / euler / scale
    geo(g, x, y, z, color, rx, ry, rz, sx, sy, sz) {
      const col = rgb(color);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
        new THREE.Vector3(sx || 1, sy || 1, sz || 1));
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      const ng = g.index ? g.toNonIndexed() : g;
      const pa = ng.attributes.position, na = ng.attributes.normal, ua = ng.attributes.uv;
      const v = new THREE.Vector3(), n = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m);
        n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        this.vert(v.x, v.y, v.z, n.x, n.y, n.z, col, ua ? ua.getX(i) * 0 : 0, 0);
      }
    }

    cyl(x, y, z, rt, rb, h, seg, color, rx, ry, rz) {
      const key = rt + '|' + rb + '|' + h + '|' + seg;
      let g = Batch.cache[key];
      if (!g) g = Batch.cache[key] = new THREE.CylinderGeometry(rt, rb, h, seg || 8, 1);
      this.geo(g, x, y, z, color, rx, ry, rz);
    }
    cone(x, y, z, r, h, seg, color, rx, ry, rz) { this.cyl(x, y, z, 0.001, r, h, seg, color, rx, ry, rz); }
    sphere(x, y, z, r, color, sx, sy, sz) {
      const key = 's' + r;
      let g = Batch.cache[key];
      if (!g) g = Batch.cache[key] = new THREE.SphereGeometry(r, 8, 6);
      this.geo(g, x, y, z, color, 0, 0, 0, sx, sy, sz);
    }

    build(material, cast, receive) {
      if (!this.count) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const m = new THREE.Mesh(g, material);
      m.castShadow = !!cast; m.receiveShadow = !!receive;
      return m;
    }
  }
  Batch.cache = {};
  CW.Batch = Batch;

  // ---- canvas textures -----------------------------------------------------
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  CW.canvas = canvas;

  CW.makeFacadeTextures = function () {
    const S = 256, cell = 64;
    const day = canvas(S, S), glow = canvas(S, S);
    const d = day.getContext('2d'), g = glow.getContext('2d');
    d.fillStyle = '#f4efe6'; d.fillRect(0, 0, S, S);
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    const r = CW.makeRng(77);
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const x = cx * cell + 12, y = cy * cell + 12, w = cell - 24, h = cell - 22;
        // spandrel / ledge line under every window row
        d.fillStyle = '#d9d2c4'; d.fillRect(cx * cell, cy * cell + cell - 6, cell, 6);
        const grad = d.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, '#79b7c9'); grad.addColorStop(1, '#27566b');
        d.fillStyle = grad; d.fillRect(x, y, w, h);
        d.fillStyle = 'rgba(255,255,255,0.28)'; d.beginPath(); d.moveTo(x, y + h); d.lineTo(x + w * 0.55, y); d.lineTo(x + w * 0.8, y); d.lineTo(x + w * 0.25, y + h); d.fill();
        d.fillStyle = '#e6dfd0'; d.fillRect(x - 2, y - 2, w + 4, 2); d.fillRect(x + w / 2 - 1, y, 2, h);
        if (r() < 0.5) {
          const warm = r() < 0.75;
          g.fillStyle = warm ? (r() < 0.5 ? '#ffd27a' : '#ffbd5a') : '#9fe3ff';
          g.fillRect(x, y, w, h);
          d.fillStyle = 'rgba(255,214,130,0.12)'; d.fillRect(x, y, w, h);
        }
      }
    }
    const mk = (c) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
      return t;
    };
    return { day: mk(day), glow: mk(glow) };
  };

  CW.makeAsphaltTexture = function () {
    const c = canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#4b5258'; x.fillRect(0, 0, 256, 256);
    const r = CW.makeRng(5);
    for (let i = 0; i < 2600; i++) {
      const v = 60 + Math.floor(r() * 36);
      x.fillStyle = 'rgba(' + v + ',' + (v + 4) + ',' + (v + 8) + ',0.45)';
      x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  };

  CW.makeGlowTexture = function () {
    const c = canvas(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };

  CW.makeSmokeTexture = function () {
    const c = canvas(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };

  // Neon / signage plate. style: {bg, fg, edge, font}
  CW.makeSignTexture = function (text, w, h, style) {
    const c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = style.bg; x.fillRect(0, 0, w, h);
    if (style.stripe) { x.fillStyle = style.stripe; x.fillRect(0, h - h * 0.12, w, h * 0.12); }
    x.lineWidth = Math.max(3, h * 0.04); x.strokeStyle = style.edge || style.fg; x.strokeRect(x.lineWidth, x.lineWidth, w - x.lineWidth * 2, h - x.lineWidth * 2);
    const lines = text.split('\n');
    const fs = Math.floor((h * 0.62) / lines.length);
    x.font = (style.font || '900 ') + fs + 'px Impact, "Arial Black", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (style.glow) { x.shadowColor = style.fg; x.shadowBlur = h * 0.12; }
    x.fillStyle = style.fg;
    lines.forEach((ln, i) => x.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.05, w * 0.92));
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    return t;
  };

  CW.makeHelipadTexture = function () {
    const c = canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#6f7b80'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#f2c230'; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, 116, 0, 7); x.stroke();
    x.fillStyle = '#f5f1e6'; x.font = '900 150px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 128, 136);
    return new THREE.CanvasTexture(c);
  };

  // ---- shared materials ----------------------------------------------------
  CW.initMaterials = function () {
    const tex = CW.makeFacadeTextures();
    CW.mats = {
      win: new THREE.MeshLambertMaterial({ map: tex.day, emissiveMap: tex.glow, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true }),
      solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
      foliage: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
      asphalt: new THREE.MeshLambertMaterial({ map: CW.makeAsphaltTexture() }),
    };
    // Cars: clearcoat gloss (low roughness, strong reflections of the live sky environment), chrome rims, rubber tyres.
    // Sparse sun glints are added in the car shader: a hashed grid of tiny facets, each with its own jittered normal, so a few
    // sparkle as the view / sun angle lines up. sky.js keeps the sun direction (view space) and the daylight gate current.
    const spark = (CW.spark = { sun: { value: new THREE.Vector3(0, 1, 0) }, k: { value: 0 } });
    const car = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.8 });
    car.onBeforeCompile = (sh) => {
      sh.uniforms.sparkSun = spark.sun; sh.uniforms.sparkK = spark.k;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = transformed;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform vec3 sparkSun; uniform float sparkK;')
        .replace('#include <output_fragment>', [
          '{ vec3 cell = floor(vOP * 9.0);',
          '  float h1 = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);',
          '  float h2 = fract(sin(dot(cell, vec3(39.346, 11.135, 83.155))) * 24634.6345);',
          '  float h3 = fract(sin(dot(cell, vec3(73.156, 52.235, 9.151))) * 31415.9265);',
          '  vec3 vd = normalize(vViewPosition);',
          '  vec3 n2 = normalize(normal + (vec3(h2, h3, fract(h1 * 91.7)) - 0.5) * 0.9);',
          '  float g = pow(max(dot(reflect(-vd, n2), sparkSun), 0.0), 36.0);',
          '  float fade = 1.0 - smoothstep(14.0, 38.0, length(vViewPosition));',
          '  outgoingLight += vec3(1.0, 0.96, 0.86) * step(0.93, h1) * g * sparkK * fade * 2.6; }',
          '#include <output_fragment>'].join('\n'));
    };
    car.customProgramCacheKey = () => 'carspark1';
    CW.mats.car = car;
    CW.mats.tyre = new THREE.MeshLambertMaterial({ vertexColors: true });
    CW.mats.chrome = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 1, envMapIntensity: 1.35 });
    CW.envMats = [car, CW.mats.chrome];   // everything that reflects the sky environment (sky.js fills envMap)
    CW.glowTex = CW.makeGlowTexture();
    CW.smokeTex = CW.makeSmokeTexture();
  };
})();
