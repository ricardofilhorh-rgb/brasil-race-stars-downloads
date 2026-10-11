/* The browser shell remains usable while Unity downloads or fails to start. */
(() => {
  const container = document.getElementById('unity-container');
  const button = document.getElementById('unity-fullscreen-button');
  if (!container || !button) return;
  const current = () => document.fullscreenElement || document.webkitFullscreenElement;
  const update = () => {
    const active = current() === container;
    button.textContent = active ? 'Sair da tela cheia' : 'Tela cheia';
    button.setAttribute('aria-label', active ? 'Sair da tela cheia' : 'Jogar em tela cheia');
    button.setAttribute('aria-pressed', String(active));
  };
  button.addEventListener('click', async () => {
    try {
      if (current()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const enter = container.requestFullscreen || container.webkitRequestFullscreen;
        if (!enter) throw new Error('Este navegador não oferece tela cheia para esta página.');
        // Call synchronously in the user's click, before any await/network work.
        await enter.call(container);
      }
    } catch (error) {
      console.warn('[BRS fullscreen]', error);
      let status = document.getElementById('brs-fullscreen-status');
      if (!status) {
        status = document.createElement('span');
        status.id = 'brs-fullscreen-status';
        status.setAttribute('role', 'status');
        button.parentElement.insertBefore(status, button);
      }
      status.textContent = 'Não foi possível abrir a tela cheia. Tente novamente pelo botão ou use F11 no computador.';
    }
  });
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('webkitfullscreenchange', update);
  update();
})();
