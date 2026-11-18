// CRIMEWAVE: Solmara — shared constants, helpers and data tables.
// Every game script attaches itself to the single global CW (plain <script> tags, no modules).
(function () {
  const CW = (window.CW = window.CW || {});

  // ---- small helpers -------------------------------------------------------
  CW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  CW.lerp = (a, b, t) => a + (b - a) * t;
  CW.smooth = (a, b, x) => { const t = CW.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  CW.damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  CW.angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  CW.dampAngle = (cur, target, rate, dt) => cur + CW.angleDiff(cur, target) * (1 - Math.exp(-rate * dt));

  // Seeded RNG so the city is identical every run.
  CW.makeRng = function (seed) {
    let s = seed >>> 0;
    const r = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  };
  CW.rng = CW.makeRng(20260518);
  CW.hex = (n) => ({ r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 });

  // ---- world layout --------------------------------------------------------
  CW.C = {
    ROAD_W: 16,            // asphalt width of every street
    BLOCK: 64,             // block slab edge (grid pitch 80 minus road)
    PITCH: 80,
    LINES: [-240, -160, -80, 0, 80, 160, 240],
    LANE: 2.7,             // lane-centre offset from the street centre line
    PARK: 6.4,             // parked-car offset from the street centre line
    CURB: 0.16,
    BOUNDS: { x0: -296, x1: 288, z0: -296, z1: 294 },
    SEA_Y: -0.35,
    DAY_SECONDS_PER_HOUR: 70,
    START_HOUR: 17.0,
    TITLE_HOUR: 18.05,
  };

  CW.DISTRICTS = [
    { id: 0, name: 'BEACHFRONT', sub: 'Palms, pastel hotels and the boardwalk' },
    { id: 1, name: 'DOWNTOWN', sub: 'Towers, neon and traffic' },
    { id: 2, name: 'SOLMARA HARBOUR', sub: 'Docks, warehouses and cranes' },
  ];

  CW.districtAt = function (x, z) {
    if (z > 160) return 2;
    if (x > 80) return 0;
    return 1;
  };

  // ---- cars (original names, no real brands) -------------------------------
  // l/w: length/width, bh: body height, ch: cabin height, cz: cabin centre offset (+ = toward front)
  // cl: cabin length, max: top speed m/s, acc: acceleration, steer: yaw rate, grip: lateral grip, mass
  CW.CAR_TYPES = {
    sports: { id: 'sports', name: 'VESPER GT', l: 4.5, w: 1.95, bh: 0.55, ch: 0.5, cz: -0.35, cl: 2.0, max: 54, acc: 22, steer: 1.95, grip: 7.0, mass: 1.1, colors: [0xff5a3c, 0xffc23a, 0x2fd0c4, 0xf2f0e6, 0xe0407a] },
    sedan: { id: 'sedan', name: 'MARLIN LX', l: 4.6, w: 1.9, bh: 0.62, ch: 0.55, cz: -0.2, cl: 2.4, max: 41, acc: 14, steer: 1.8, grip: 6.0, mass: 1.3, colors: [0x3aa6a0, 0xe9d9b0, 0xd9604a, 0x4f6fb5, 0xbfc7c9, 0x8b3f58] },
    hatch: { id: 'hatch', name: 'PICO RUNABOUT', l: 3.6, w: 1.75, bh: 0.58, ch: 0.58, cz: -0.15, cl: 2.0, max: 34, acc: 13, steer: 2.15, grip: 6.5, mass: 0.9, colors: [0xffb347, 0x7fc8e8, 0xff7a8a, 0xa5d56a, 0xf6efe0] },
    suv: { id: 'suv', name: 'BULWARK 4X4', l: 4.8, w: 2.05, bh: 0.8, ch: 0.72, cz: -0.35, cl: 2.9, max: 37, acc: 12, steer: 1.5, grip: 5.5, mass: 1.7, colors: [0x2c4a52, 0xd7c9a3, 0x7a2e2e, 0x33373d, 0x5f8f6d] },
    taxi: { id: 'taxi', name: 'SOL CAB', l: 4.6, w: 1.9, bh: 0.62, ch: 0.55, cz: -0.2, cl: 2.4, max: 39, acc: 14, steer: 1.8, grip: 6.0, mass: 1.3, colors: [0xffd21f] },
    van: { id: 'van', name: 'HAULER VAN', l: 5.3, w: 2.05, bh: 1.0, ch: 0.95, cz: -0.1, cl: 4.0, max: 31, acc: 8.5, steer: 1.35, grip: 5.0, mass: 2.0, colors: [0xf2f0e6, 0x3d7e91, 0xc2523a, 0xd9b84a] },
  };

  // ---- protagonists --------------------------------------------------------
  CW.CREW = {
    ray: { id: 'ray', name: 'RAY', skin: 0xd9a070, hair: 0x20160f, shirt: 0xff7b54, pants: 0xefe3c8, shoes: 0xf5f1e6, female: false, shades: false },
    luna: { id: 'luna', name: 'LUNA', skin: 0xb9805a, hair: 0x1a1018, shirt: 0x37c9b8, pants: 0xf3efe4, shoes: 0xff9f43, female: true, shades: true },
  };

  CW.palette = {
    beach: [0xffb3a7, 0xffd6a5, 0xfdf2d0, 0xa8e6cf, 0xffc8dd, 0xcdb4db, 0xbde0fe, 0xfff1c9],
    downtown: [0xf28b82, 0xf6c177, 0xe8d5b5, 0x9ad0cc, 0xd6a3c9, 0xf5ede0, 0x8fb8de, 0xe9967a],
    glass: [0x7fb7c7, 0x6fa3b8, 0x9bc4d0, 0x5d93a9],
    harbour: [0x8a9a9f, 0xb36a4f, 0x5f8a8b, 0xc9b28a, 0x7b8d6e, 0xa7745b],
    container: [0xd94f3d, 0x2f7f8f, 0xe8a33d, 0x3f6fb5, 0x5f9a5a, 0xc9c1b0, 0xb5527a],
  };

  CW.save = {
    key: 'crimewave-solmara-save-v1',
    read() { try { const s = localStorage.getItem(this.key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    write(o) { try { localStorage.setItem(this.key, JSON.stringify(o)); } catch (e) { /* storage blocked */ } },
  };
})();
