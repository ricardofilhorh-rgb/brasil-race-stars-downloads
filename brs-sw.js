/* Serve large Unity assets from immutable static segments without buffering whole files. */
importScripts('./brs-segments.js');
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function byteRange(header, size) {
  if (!header) return [0, size - 1, false];
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
    end = Math.min(end, size - 1);
  }
  return start > end || start >= size ? null : [start, end, true];
}

function segmentedResponse(request, file) {
  const range = byteRange(request.headers.get('range'), file.bytes);
  if (!range) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${file.bytes}`}});
  const [start, end, partial] = range;
  const headers = new Headers({'Content-Type': file.type, 'Content-Length': String(end - start + 1),
    'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'ETag': `"${file.sha256}"`});
  if (partial) headers.set('Content-Range', `bytes ${start}-${end}/${file.bytes}`);
  const status = partial ? 206 : 200;
  if (request.method === 'HEAD') return new Response(null, {status, headers});
  const abort = new AbortController();
  let index = 0, base = 0, consumed = 0, emitted = 0, reader = null;
  while (base + file.parts[index].bytes <= start) base += file.parts[index++].bytes;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          if (!reader) {
            const part = file.parts[index];
            const response = await fetch(new URL(part.path, self.registration.scope), {signal: abort.signal, cache: 'force-cache'});
            if (response.status !== 200 || !response.body) throw new Error('Falha ao baixar parte do jogo: ' + part.path);
            reader = response.body.getReader(); consumed = 0;
          }
          const result = await reader.read();
          if (result.done) {
            if (consumed !== file.parts[index].bytes) throw new Error('Parte do jogo incompleta.');
            base += consumed; index++; reader = null;
            if (index >= file.parts.length) throw new Error('Arquivo do jogo incompleto.');
            continue;
          }
          const value = result.value;
          const offset = base + consumed;
          consumed += value.byteLength;
          if (consumed > file.parts[index].bytes) throw new Error('Tamanho inesperado de parte do jogo.');
          const from = Math.max(0, start - offset), to = Math.min(value.byteLength, end + 1 - offset);
          if (to <= from) continue;
          controller.enqueue(value.subarray(from, to)); emitted += to - from;
          if (emitted === end - start + 1) { controller.close(); await reader.cancel(); abort.abort(); }
          return;
        }
      } catch (error) { controller.error(error); abort.abort(); }
    },
    cancel() { abort.abort(); return reader?.cancel(); }
  });
  return new Response(stream, {status, headers});
}

self.addEventListener('fetch', event => {
  if (!['GET', 'HEAD'].includes(event.request.method)) return;
  const scope = new URL(self.registration.scope), url = new URL(event.request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  let path;
  try { path = decodeURIComponent(url.pathname.slice(scope.pathname.length)); } catch { return; }
  const file = self.BRS_SEGMENTS[path];
  if (file) event.respondWith(deliveryResponse(event.request, file));
});

function deliveryResponse(request, file) {
  if (file.compression !== 'gzip' || typeof DecompressionStream === 'undefined')
    return segmentedResponse(request, file);
  // Decode as the compressed segments arrive. Unity's JS fallback retains both
  // complete buffers, which is costly for the full game's large data archive.
  // Ranges are intentionally ignored for compressed engine data (HTTP 200).
  // Video files remain byte-addressable through segmentedResponse above.
  const headers = new Headers({'Content-Type': file.type,
    'Content-Length': String(file.decodedBytes), 'Cache-Control': 'no-cache',
    'ETag': `"${file.sha256}-decoded"`});
  if (request.method === 'HEAD') return new Response(null, {status: 200, headers});
  const compressed = segmentedResponse({method:'GET', headers:new Headers()}, file);
  return new Response(compressed.body.pipeThrough(new DecompressionStream('gzip')),
    {status: 200, headers});
}
