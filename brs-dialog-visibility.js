/* Unity owns a fullscreen canvas; HTML clipboard dialogs are siblings of it. */
function brsKeepWebDialogsVisible() {
  let leaving = false;
  const reveal = () => {
    const dialog = document.getElementById('brs-clipboard-dialog');
    const fullscreen = document.fullscreenElement;
    if (!dialog || !fullscreen || fullscreen.contains(dialog) || leaving) return;
    leaving = true;
    document.exitFullscreen().then(() => {
      if (dialog.isConnected) dialog.querySelector('textarea, input, button')?.focus();
    }).catch(error => console.warn('[BRS] Não foi possível mostrar o convite fora da tela cheia.', error))
      .finally(() => { leaving = false; });
  };
  new MutationObserver(reveal).observe(document.body, {childList: true});
  document.addEventListener('fullscreenchange', reveal);
  reveal();
}
brsKeepWebDialogsVisible();
