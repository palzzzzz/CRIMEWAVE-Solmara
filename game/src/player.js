// The crew (Ray + Luna), on-foot movement, entering / exiting cars, and the follow / chase / orbit cameras.
(function () {
  const CW = window.CW;
  const P = (CW.player = { crew: {}, active: null, mode: 'foot', toast: null });
  const cam = (CW.cam = { yaw: 0.6, pitch: 0.35, dist: 5.6, carYaw: 0, look: 0, lookIdle: 0, x: 0, y: 3, z: 0, fov: 62, tx: 0, tz: 0, ty: 1.5 });

  P.init = function (scene) {
    ['ray', 'luna'].forEach((id) => {
      const def = CW.CREW[id];
      const model = CW.makePerson(def);
      scene.add(model);
      P.crew[id] = { def, id, model, x: 0, z: 0, h: 0, vx: 0, vz: 0, speed: 0, hp: 100 };
    });
    // Ray's cigarette (ember tip) for the title scene
    const cig = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.11), new THREE.MeshLambertMaterial({ color: 0xf5f1e6 }));
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.025), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
    tip.position.z = 0.065; cig.add(stick); cig.add(tip); cig.position.set(0, -0.3, 0.04);
    P.crew.ray.model.userData.armR.el.add(cig); P.crew.ray.cig = cig;
    P.active = P.crew.ray;
  };

  P.place = function (e, x, z, h) { e.x = x; e.z = z; e.h = h; e.vx = e.vz = 0; e.model.position.set(x, 0, z); e.model.rotation.y = h; };

  P.startNew = function () {
    const S = CW.world.spawn;
    P.setLeanPose(false);
    P.place(P.crew.ray, S.x, S.z, S.h); P.place(P.crew.luna, S.x + 1.6, S.z + 2.2, S.h - 0.4);
    P.active = P.crew.ray; P.mode = 'foot';
    P.crew.ray.cig.visible = false;
    cam.yaw = -Math.PI / 2 + 0.3; cam.pitch = 0.3;   // look east toward the sea
    cam.tx = S.x; cam.tz = S.z;
  };

  P.setLeanPose = function (on) {
    const r = P.crew.ray, l = P.crew.luna;
    if (on) { r.model.userData.setPose('ray-lean'); l.model.userData.setPose('luna-lean'); r.cig.visible = true; }
    else { r.model.userData.setPose('none'); l.model.userData.setPose('none'); }
  };

  const clampBoom = (tx, ty, tz, dir, dist) => {
    let d = dist;
    for (let k = 1; k <= 10; k++) {
      const t = (k / 10) * dist, x = tx + dir.x * t, y = ty + dir.y * t, z = tz + dir.z * t;
      if (y < 0.4) { d = Math.min(d, Math.max(1, t - 0.4)); break; }
      const r = CW.world.resolve(x, z, 0.35);
      if (r.hit && y < 60) { d = Math.max(1.2, t - 0.6); break; }
    }
    return d;
  };

  function pushFromCars(e) {
    CW.vehicles.list.forEach((c) => {
      if (Math.abs(c.x - e.x) > 6 || Math.abs(c.z - e.z) > 6) return;
      c.circles().forEach(([cx, cz, r]) => {
        const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz), rr = r + 0.4;
        if (d < rr && d > 1e-5) { e.x += (dx / d) * (rr - d); e.z += (dz / d) * (rr - d); }
      });
    });
  }

  function onFoot(dt) {
    const e = P.active, I = CW.input;
    cam.yaw -= I.mdx * 0.0035; cam.pitch = CW.clamp(cam.pitch + I.mdy * 0.003, -0.15, 1.2);
    if (I.isDown('ArrowLeft')) cam.yaw += 1.8 * dt; if (I.isDown('ArrowRight')) cam.yaw -= 1.8 * dt;
    cam.dist = CW.clamp(cam.dist + I.wheel * 0.6, 3, 11);
    const f = I.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']), s = I.axis(['KeyA'], ['KeyD']);
    let mx = -Math.sin(cam.yaw) * f + Math.cos(cam.yaw) * s, mz = -Math.cos(cam.yaw) * f - Math.sin(cam.yaw) * s;
    const len = Math.hypot(mx, mz);
    const run = I.isDown('ShiftLeft') || I.isDown('ShiftRight');
    const sp = len > 0 ? (run ? 6.6 : 3.4) : 0;
    if (len > 0) { mx /= len; mz /= len; }
    e.vx = CW.damp(e.vx, mx * sp, 14, dt); e.vz = CW.damp(e.vz, mz * sp, 14, dt);
    e.x += e.vx * dt; e.z += e.vz * dt;
    pushFromCars(e);
    const r = CW.world.resolve(e.x, e.z, 0.4); e.x = r.x; e.z = r.z;
    e.speed = Math.hypot(e.vx, e.vz);
    if (e.speed > 0.3) e.h = CW.dampAngle(e.h, Math.atan2(e.vx, e.vz), 14, dt);
    e.model.position.set(e.x, 0, e.z); e.model.rotation.y = e.h;
    e.model.userData.update(dt, e.speed);
    const o = P.other();
    o.model.userData.update(dt, 0);
    // enter car
    const car = CW.vehicles.nearest(e.x, e.z, 3.6);
    P.prompt = car ? 'E  ENTER ' + car.type.name : null;
    if (I.pressed('KeyE') && car) {
      CW.vehicles.enter(car); e.model.visible = false; P.mode = 'car'; P.car = car; cam.carYaw = car.h; cam.look = 0; P.prompt = null;
    }
    if (I.pressed('Tab')) {
      P.active = o; P.toast = 'NOW PLAYING: ' + o.def.name;
      cam.yaw = cam.yaw;
    }
    // camera target / boom
    cam.tx = CW.damp(cam.tx, e.x, 11, dt); cam.tz = CW.damp(cam.tz, e.z, 11, dt); cam.ty = CW.damp(cam.ty, 1.55, 6, dt);
    const dir = { x: Math.sin(cam.yaw) * Math.cos(cam.pitch), y: Math.sin(cam.pitch), z: Math.cos(cam.yaw) * Math.cos(cam.pitch) };
    const d = clampBoom(cam.tx, cam.ty, cam.tz, dir, cam.dist);
    cam.cd = cam.cd === undefined ? d : (d < cam.cd ? d : CW.damp(cam.cd, d, 5, dt));
    const c = CW.camera;
    c.position.set(cam.tx + dir.x * cam.cd, Math.max(0.5, cam.ty + dir.y * cam.cd), cam.tz + dir.z * cam.cd);
    c.lookAt(cam.tx, cam.ty + 0.1, cam.tz);
    cam.fov = CW.damp(cam.fov, 62, 4, dt); c.fov = cam.fov; c.updateProjectionMatrix();
  }

  function inCar(dt) {
    const car = P.car, I = CW.input, e = P.active;
    P.prompt = car.speed < 6 ? 'E  EXIT' : null;
    if (I.mdx || I.mdy) { cam.look -= I.mdx * 0.004; cam.lookIdle = 0; } else cam.lookIdle += dt;
    if (cam.lookIdle > 1.6) cam.look = CW.damp(cam.look, 0, 3, dt);
    cam.look = CW.clamp(cam.look, -2.6, 2.6);
    let hd = car.h;
    if (car.fs > 3) hd = car.h + CW.clamp(CW.angleDiff(car.h, Math.atan2(car.vx, car.vz)), -0.7, 0.7) * 0.55;
    cam.carYaw = CW.dampAngle(cam.carYaw, hd, 4.2, dt);
    const yaw = cam.carYaw + cam.look;
    const sp = car.speed, dist = 8 + sp * 0.07 + (car.type.id === 'van' || car.type.id === 'suv' ? 1.2 : 0);
    const c = CW.camera, hgt = 3.3 + sp * 0.015;
    const px = car.x - Math.sin(yaw) * dist, pz = car.z - Math.cos(yaw) * dist;
    const r = CW.world.resolve(px, pz, 0.5);
    cam.x = r.hit ? CW.damp(cam.x, r.x, 20, dt) : px; cam.z = r.hit ? CW.damp(cam.z, r.z, 20, dt) : pz;
    cam.y = CW.damp(cam.y, hgt, 5, dt);
    c.position.set(cam.x, cam.y, cam.z);
    cam.tx = car.x + Math.sin(yaw) * 3; cam.tz = car.z + Math.cos(yaw) * 3;
    c.lookAt(cam.tx, 1.2, cam.tz);
    cam.fov = CW.damp(cam.fov, 62 + Math.min(sp, 50) * 0.32, 3, dt); c.fov = cam.fov; c.updateProjectionMatrix();
    cam.yaw = yaw + Math.PI;
    e.x = car.x; e.z = car.z; e.h = car.h;
    if (I.pressed('KeyE') && sp < 8) {
      const p = CW.vehicles.exit();
      e.model.visible = true; e.x = p.x; e.z = p.z; e.vx = e.vz = 0; e.h = car.h;
      e.model.position.set(e.x, 0, e.z);
      cam.yaw = car.h + Math.PI; cam.tx = car.x; cam.tz = car.z; cam.cd = undefined; cam.pitch = 0.3;
      P.mode = 'foot'; P.car = null;
    } else if (I.pressed('Tab')) P.toast = 'GET OUT OF THE CAR FIRST (E)';
    P.other().model.userData.update(dt, 0);
  }

  P.other = () => (P.active === P.crew.ray ? P.crew.luna : P.crew.ray);

  P.update = function (dt) { if (P.mode === 'car') inCar(dt); else onFoot(dt); };

  // focus for sky/shadow follow
  P.focus = () => (P.mode === 'car' && P.car ? { x: P.car.x, z: P.car.z } : { x: P.active.x, z: P.active.z });
})();
