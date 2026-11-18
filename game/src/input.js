// Keyboard + mouse state. Edge-triggered presses are read with CW.input.pressed(code) once per frame.
(function () {
  const CW = window.CW;
  const down = new Set();
  const edge = new Set();
  const input = (CW.input = {
    mdx: 0, mdy: 0, dragging: false, locked: false, wheel: 0, enabled: true, mouse: { x: 0, y: 0 },
    isDown: (c) => down.has(c),
    pressed(c) { return edge.has(c); },
    any(codes) { return codes.some((c) => down.has(c)); },
    endFrame() { edge.clear(); input.mdx = 0; input.mdy = 0; input.wheel = 0; },
    axis(neg, pos) { return (input.any(pos) ? 1 : 0) - (input.any(neg) ? 1 : 0); },
  });

  const BLOCK = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', (e) => {
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) edge.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  window.addEventListener('mousedown', (e) => { if (e.button === 0 || e.button === 2) input.dragging = true; edge.add('Mouse' + e.button); down.add('Mouse' + e.button); });
  window.addEventListener('mouseup', (e) => { input.dragging = false; down.delete('Mouse' + e.button); });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { input.wheel += Math.sign(e.deltaY); }, { passive: true });
  window.addEventListener('mousemove', (e) => {
    input.mouse.x = e.clientX; input.mouse.y = e.clientY;
    if (input.locked || input.dragging) { input.mdx += e.movementX || 0; input.mdy += e.movementY || 0; }
  });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement != null; });
})();
