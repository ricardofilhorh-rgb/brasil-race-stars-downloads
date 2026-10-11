async function brsPrepareDelivery(buildKey = '') {
  if (!('serviceWorker' in navigator)) throw new Error('Este navegador não oferece o recurso necessário para carregar o jogo. Abra em uma versão atual do Chrome, Edge, Firefox ou Safari.');
  const registration = await navigator.serviceWorker.register('./brs-sw.js?build=' + encodeURIComponent(buildKey), {scope: './', updateViaCache: 'none'});
  // Register may return an existing active worker before checking changed imports.
  // A build-specific script URL plus an explicit update prevents using its old map.
  await registration.update();
  // An existing controller may still serve the previous build's segment map.
  // Wait for THIS registration's newest worker to activate and control the page.
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('Não foi possível preparar os arquivos do jogo. Recarregue esta página.');
  await new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', check);
      navigator.serviceWorker.removeEventListener('controllerchange', check);
      error ? reject(error) : resolve();
    };
    const check = () => {
      if (worker.state === 'redundant') return finish(new Error('A atualização do jogo falhou. Recarregue esta página.'));
      if (worker.state === 'activated' && navigator.serviceWorker.controller === worker) finish();
    };
    const timeout = setTimeout(() => finish(new Error('Não foi possível preparar o carregamento. Recarregue esta página.')), 20000);
    worker.addEventListener('statechange', check);
    navigator.serviceWorker.addEventListener('controllerchange', check);
    check();
  });
}
