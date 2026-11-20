// Sky dome, sun/moon, hemisphere light, fog, stars and the 24-hour cycle that drives window / lamp lighting.
(function () {
  const CW = window.CW;
  const K = (h, top, hor, sun, sunI, hs, hg, hI) => ({ h, top: new THREE.Color(top), hor: new THREE.Color(hor), sun: new THREE.Color(sun), sunI, hs: new THREE.Color(hs), hg: new THREE.Color(hg), hI });
  const KEYS = [
    K(0, 0x050a1e, 0x16284a, 0x7f9bff, 0.38, 0x3a4c86, 0x14182c, 0.7),
    K(5.0, 0x0b1436, 0x2a2f5c, 0x7f9bff, 0.3, 0x3a4c86, 0x14182c, 0.65),
    K(5.9, 0x3a4d8a, 0xf59a78, 0xffa070, 0.7, 0x8a8fb0, 0x5a4a50, 0.75),
    K(7.5, 0x4aa3e0, 0xcfe9ef, 0xfff0cf, 1.2, 0xbfdcf0, 0x8a9a6a, 0.9),
    K(12, 0x2f8fe0, 0xcdeaf5, 0xffffff, 1.45, 0xc5e2f5, 0x9aa070, 1.0),
    // dusk grade: from late afternoon the horizon and fill light slide from gold to orange-magenta so every evening frame shares one palette
    K(16, 0x3d96e0, 0xe8dccf, 0xffe2b0, 1.3, 0xc9d6f0, 0x9a9068, 0.95),
    K(17.5, 0x6a8ee0, 0xffc29c, 0xffa65e, 1.55, 0xf8c4b4, 0x9a7468, 1.05),
    K(18.6, 0x64509e, 0xff8a82, 0xff7c5a, 1.0, 0xe48aa8, 0x6a4260, 0.85),
    K(19.4, 0x241e58, 0x8a4682, 0xa88cff, 0.4, 0x5a4a98, 0x26203e, 0.65),
    K(21, 0x070d28, 0x1b2a52, 0x7f9bff, 0.38, 0x3a4c86, 0x14182c, 0.7),
    K(24, 0x050a1e, 0x16284a, 0x7f9bff, 0.38, 0x3a4c86, 0x14182c, 0.7),
  ];
  const tmp = new THREE.Color();

  const sky = (CW.sky = { hour: 17, night: 0, dir: new THREE.Vector3(), frozen: false });

  sky.init = function (scene) {
    sky.scene = scene;
    sky.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
    scene.add(sky.hemi);
    sky.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sky.sunLight.castShadow = true;
    const sc = sky.sunLight.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 420;
    sky.sunLight.shadow.mapSize.set(2048, 2048);
    sky.sunLight.shadow.bias = -0.0006;
    sky.sunLight.shadow.normalBias = 0.05;
    scene.add(sky.sunLight); scene.add(sky.sunLight.target);
    scene.fog = new THREE.Fog(0xffc68a, 130, 820);

    sky.uniforms = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunAmt: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: sky.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; varying vec3 vP;' +
        'void main(){ vec3 d = normalize(vP); float h = max(d.y,0.0); vec3 c = mix(hor, top, pow(h,0.5));' +
        'if(d.y<0.0) c = mix(hor, hor*0.7, clamp(-d.y*4.0,0.0,1.0));' +
        'float s = max(dot(d, normalize(sunDir)),0.0); c += sunCol*(pow(s,6.0)*0.35 + pow(s,48.0)*0.5)*sunAmt; c += vec3(1.0,0.97,0.85)*smoothstep(0.9993,0.9998,s)*sunAmt*1.6;' +
        'gl_FragColor = vec4(c,1.0); }',
    });
    sky.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 14), mat);
    sky.dome.renderOrder = -10; sky.dome.frustumCulled = false;
    scene.add(sky.dome);

    const sp = [], r = CW.makeRng(9);
    for (let i = 0; i < 420; i++) { const a = r() * 6.283, e = Math.acos(r() * 0.95), R = 960; sp.push(Math.sin(e) * Math.cos(a) * R, Math.cos(e) * R, Math.sin(e) * Math.sin(a) * R); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sky.starMat = new THREE.PointsMaterial({ size: 3, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false, sizeAttenuation: false });
    sky.stars = new THREE.Points(sg, sky.starMat); sky.stars.frustumCulled = false; scene.add(sky.stars);
    sky.apply(sky.hour);
    // reflection environment for glossy car paint + chrome: the sky dome itself (same shader, same uniforms) baked to a PMREM
    // cube, re-baked every half game-hour so dawn / dusk / night reflections follow the clock
    const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(sky.dome.geometry, mat));
    // bright sky strips (a low horizon band + two overhead softboxes) give flat panels something crisp to mirror: the "gloss" read
    const strip = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false });
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, p = new THREE.Mesh(new THREE.PlaneGeometry(250, 380), strip); p.position.set(Math.cos(a) * 600, 250, Math.sin(a) * 600); p.lookAt(0, 250, 0); envScene.add(p); }   // window-like slats: panels sweep light across the paint as a car turns
    [[-260, 480, 180, 520, 120], [300, 430, -260, 420, 100]].forEach(([x, y, z, w, h]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), strip); p.position.set(x, y, z); p.lookAt(0, 0, 0); envScene.add(p); });
    const pm = new THREE.PMREMGenerator(CW.renderer); let rt = null;
    sky.bakeEnv = function () {
      strip.color.copy(sky.sunLight.color).multiplyScalar(0.12 + 1.1 * (1 - sky.night));
      const old = rt; rt = pm.fromScene(envScene, 0, 1, 2000); sky.envHour = sky.hour;
      CW.envMats.forEach((m) => { const first = !m.envMap; m.envMap = rt.texture; if (first) m.needsUpdate = true; });
      if (old) old.dispose();
    };
    sky.bakeEnv();
  };

  function sample(h) {
    let a = KEYS[0], b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    return { a, b, t: (h - a.h) / (b.h - a.h || 1) };
  }

  sky.apply = function (h) {
    sky.hour = h;
    const { a, b, t } = sample(h);
    const top = tmp.copy(a.top).lerp(b.top, t); sky.uniforms.top.value.copy(top);
    sky.uniforms.hor.value.copy(a.hor).lerp(b.hor, t);
    sky.scene.fog.color.copy(sky.uniforms.hor.value);
    sky.sunLight.color.copy(a.sun).lerp(b.sun, t);
    sky.sunLight.intensity = CW.lerp(a.sunI, b.sunI, t);
    sky.hemi.color.copy(a.hs).lerp(b.hs, t); sky.hemi.groundColor.copy(a.hg).lerp(b.hg, t);
    sky.hemi.intensity = CW.lerp(a.hI, b.hI, t);
    sky.uniforms.sunCol.value.copy(sky.sunLight.color);
    // direction: sun arc 5.5 -> 19, moon arc otherwise
    let ang, isSun = true;
    if (h >= 5.5 && h <= 19) ang = ((h - 5.5) / 13.5) * Math.PI;
    else { isSun = false; ang = (((h > 19 ? h - 19 : h + 5) / 10.5)) * Math.PI; }
    sky.dir.set(Math.cos(ang), Math.sin(ang), 0.3).normalize();
    sky.isSun = isSun;
    sky.uniforms.sunDir.value.copy(sky.dir);
    sky.uniforms.sunAmt.value = isSun ? 1 : 0.0;
    const elev = isSun ? sky.dir.y : -1;
    sky.night = 1 - CW.smooth(-0.02, 0.22, elev);
    sky.starMat.opacity = CW.smooth(0.4, 0.9, sky.night);
    CW.mats.win.emissiveIntensity = sky.night * 0.95;
    if (CW.world.glowMat) CW.world.glowMat.opacity = sky.night;
    CW.world.billboards.forEach((m) => { m.material.emissiveIntensity = 0.2 + 0.8 * sky.night; });
    sky.scene.fog.near = 130; sky.scene.fog.far = 820;
    if (CW.weather && CW.weather.tint) CW.weather.tint(sky);
  };

  const ldir = new THREE.Vector3();
  sky.update = function (dt, focus, cam) {
    if (!sky.frozen) { sky.hour += dt / CW.C.DAY_SECONDS_PER_HOUR; if (sky.hour >= 24) sky.hour -= 24; }
    sky.apply(sky.hour);
    ldir.copy(sky.dir); ldir.y = Math.max(ldir.y, 0.24); ldir.normalize();
    const f = focus;
    sky.sunLight.target.position.set(f.x, 0, f.z);
    sky.sunLight.position.set(f.x + ldir.x * 200, ldir.y * 200, f.z + ldir.z * 200);
    sky.sunLight.target.updateMatrixWorld();
    sky.dome.position.copy(cam.position); sky.stars.position.copy(cam.position);
    let dh = Math.abs(sky.hour - sky.envHour); if (dh > 12) dh = 24 - dh;
    if (dh > 0.5) sky.bakeEnv();
    // car glints: sun direction in view space, only in daylight and dry weather
    const S = CW.spark; S.sun.value.copy(ldir).transformDirection(cam.matrixWorldInverse);
    S.k.value = (1 - sky.night) * (CW.weather ? 1 - CW.weather.wet : 1) * (sky.dir.y > 0 ? 1 : 0);
  };

  sky.clock = function () {
    const h = Math.floor(sky.hour), m = Math.floor((sky.hour - h) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };
})();
