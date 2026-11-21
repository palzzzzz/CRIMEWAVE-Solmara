// Weather: a rain mode (GPU-animated streaks around the camera, greyed sky + fog, reduced tyre grip, lightning + thunder, rain hiss).
// Rain rolls in and out on its own (about every few minutes); CW.weather.set('rain' | 'clear') forces it, and L toggles it.
(function () {
  const CW = window.CW;
  const Wx = (CW.weather = { mode: 'clear', wet: 0, target: 0, grip: 1, t: 0, next: 150, flash: 0, bolt: 6 });
  let mesh = null, uni = null;

  Wx.init = function (scene) {
    const N = 2600, pos = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2), r = CW.makeRng(515);
    for (let i = 0; i < N; i++) { const x = r(), y = r(), z = r(); for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('e', new THREE.BufferAttribute(end, 1));
    uni = { t: { value: 0 }, cam: { value: new THREE.Vector3() }, amt: { value: 0 }, col: { value: new THREE.Color(0xcfe0ee) } };
    const m = new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'attribute float e; uniform float t; uniform vec3 cam; varying float vA;' +
        'void main(){ vec3 s = position; float S = 70.0; float H = 38.0;' +
        'float fy = fract(s.y - t * 0.85);' +
        'vec3 w = vec3(cam.x + (fract(s.x - cam.x / S + t * 0.02) - 0.5) * S, cam.y - 8.0 + fy * H, cam.z + (fract(s.z - cam.z / S) - 0.5) * S);' +
        'w += vec3(e * 0.35, e * 1.5, e * 0.12); vA = 0.55 * (1.0 - e * 0.7);' +
        'gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }',
      fragmentShader: 'uniform float amt; uniform vec3 col; varying float vA; void main(){ gl_FragColor = vec4(col, vA * amt); }',
    });
    mesh = new THREE.LineSegments(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 8; scene.add(mesh);
  };

  Wx.set = function (mode) {
    Wx.mode = mode; Wx.target = mode === 'rain' ? 1 : 0; Wx.next = 120 + Math.random() * 160;
    if (CW.hud.shown) CW.hud.toast(mode === 'rain' ? 'LLUVIA  —  LAS CALLES RESBALAN' : 'LA LLUVIA CEDE');
  };

  // Called by sky.apply after the time-of-day colours are set: grey everything out in proportion to Wx.wet.
  Wx.tint = function (sky) {
    const w = Wx.wet; if (w < 0.01) return;
    const u = sky.uniforms, g = Wx.grey || (Wx.grey = new THREE.Color(0x6b7782));
    const lum = (u.hor.value.r + u.hor.value.g + u.hor.value.b) / 3, gg = Wx.g2 || (Wx.g2 = new THREE.Color());
    gg.copy(g).multiplyScalar(0.35 + lum * 1.15);
    u.top.value.lerp(gg, 0.55 * w); u.hor.value.lerp(gg, 0.62 * w); u.sunAmt.value *= 1 - 0.85 * w;
    sky.scene.fog.color.copy(u.hor.value); sky.scene.fog.near = 130 - 90 * w; sky.scene.fog.far = 820 - 480 * w;
    sky.sunLight.intensity *= 1 - 0.55 * w; sky.hemi.intensity *= 1 - 0.1 * w + Wx.flash * 1.8; sky.hemi.color.lerp(gg, 0.5 * w);
  };

  Wx.update = function (dt, playing) {
    Wx.t += dt;
    if (playing) { Wx.next -= dt; if (Wx.next <= 0) Wx.set(Wx.mode === 'rain' ? 'clear' : 'rain'); if (CW.input.pressed('KeyL')) Wx.set(Wx.mode === 'rain' ? 'clear' : 'rain'); }
    Wx.wet = CW.damp(Wx.wet, Wx.target, 0.35, dt); if (Math.abs(Wx.wet - Wx.target) < 0.004) Wx.wet = Wx.target;
    Wx.grip = 1 - 0.22 * Wx.wet;
    mesh.visible = Wx.wet > 0.02; uni.t.value = Wx.t; uni.amt.value = Math.min(1, Wx.wet * 1.1); uni.cam.value.copy(CW.camera.position);
    // lightning: a flash of light then a delayed rumble
    Wx.flash = Math.max(0, Wx.flash - dt * 2.4);
    if (Wx.wet > 0.7 && playing) {
      Wx.bolt -= dt;
      if (Wx.bolt <= 0) { Wx.bolt = 14 + Math.random() * 22; Wx.flash = 1; const dly = 0.6 + Math.random() * 2.2; setTimeout(() => CW.sfx.play('thunder', 0.55 + Math.random() * 0.4), dly * 1000); }
    }
    if (CW.audio) CW.sfx.rain(Wx.wet);
  };
})();
