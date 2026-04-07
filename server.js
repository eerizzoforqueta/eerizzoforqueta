const express = require('express');
const compression = require('compression');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

/**
 * Filtro de compressão:
 * - respeita header x-no-compression
 * - evita recomprimir alguns tipos que já costumam vir comprimidos
 */
function shouldCompress(req, res) {
  if (req.headers['x-no-compression']) {
    return false;
  }

  const contentType = String(res.getHeader('Content-Type') || '').toLowerCase();

  // Não vale a pena recomprimir formatos já compactados
  const alreadyCompressedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/',
    'audio/',
    'application/zip',
    'application/gzip',
    'application/x-gzip',
    'application/pdf',
    'font/',
  ];

  const isAlreadyCompressed = alreadyCompressedTypes.some((type) =>
    contentType.includes(type)
  );

  if (isAlreadyCompressed) {
    return false;
  }

  return compression.filter(req, res);
}

app.prepare().then(() => {
  const server = express();

  // Remove fingerprint básico
  server.disable('x-powered-by');

  // Healthcheck simples
  server.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // Cache agressivo para assets estáticos do Next
  server.use('/_next/static', (req, res, nextMiddleware) => {
    if (!dev) {
      res.setHeader(
        'Cache-Control',
        'public, max-age=31536000, immutable'
      );
    }
    nextMiddleware();
  });

  // Compressão otimizada
  server.use(
    compression({
      filter: shouldCompress,
      level: 6,          // bom equilíbrio entre CPU e taxa de compressão
      threshold: 1024,   // só comprime acima de 1KB
      memLevel: 8,
    })
  );

  // Evita proxies/CDNs alterarem o conteúdo comprimido
  server.use((req, res, nextMiddleware) => {
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', res.getHeader('Cache-Control') || 'no-transform');
    nextMiddleware();
  });

  server.all('*', (req, res) => handle(req, res));

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Pronto na porta ${port}`);
  });
});