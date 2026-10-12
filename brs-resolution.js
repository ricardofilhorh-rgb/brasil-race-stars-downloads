/* Keep menus at least 720p and render larger displays at up to full HD.
 * Unity's matchWebGLToCanvasSize stays false: this owns the drawing buffer. */
(() => {
  const canvas = document.getElementById('unity-canvas');
  if (!canvas) return;
  let scheduled = false;
  function resize() {
    scheduled = false;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ratio = rect.width / rect.height;
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const height = Math.round(Math.max(720, Math.min(1080,
      Math.sqrt(1920 * 1080 / ratio), rect.height * pixelRatio)));
    const width = Math.round(height * ratio);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    console.info('[BRS display]', width + 'x' + height);
  }
  function queueResize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(resize);
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(queueResize).observe(canvas);
  window.addEventListener('resize', queueResize);
  document.addEventListener('fullscreenchange', queueResize);
  document.addEventListener('webkitfullscreenchange', queueResize);
  resize();
})();
