// Shared stats overlay: FPS (EMA), frame ms, draw calls, triangles.
export function createStats() {
  const el = document.getElementById('stats');
  let fps = 0;
  let timer = 0;
  return {
    /** Call every frame with dt in seconds and the renderer. */
    update(dt, renderer) {
      fps += (1 / Math.max(dt, 1e-4) - fps) * 0.06;
      timer += dt;
      if (timer > 0.25 && el) {
        timer = 0;
        const info = renderer.info;
        el.textContent =
          `FPS  ${fps.toFixed(0)}\n` +
          `ms   ${(dt * 1000).toFixed(1)}\n` +
          `calls ${info.render.calls}\n` +
          `tris  ${info.render.triangles.toLocaleString('en-US')}`;
      }
      return fps;
    },
  };
}
