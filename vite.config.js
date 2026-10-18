import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function gta5ModsApiPlugin() {
  return {
    name: 'gta5mods-live-extractor-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        if (req.url.startsWith('/api/fetch-gta5mods-car')) {
          try {
            const parsedUrl = new URL(req.url, 'http://localhost:5175');
            const target = parsedUrl.searchParams.get('url') || '';
            const { fetchAndExtractGta5ModsCar } = require('./server/gta5ModsExtractor.cjs');
            const result = await fetchAndExtractGta5ModsCar(target);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: true,
                ...result,
                yftUrl: `/api/gta5mods-asset/${encodeURIComponent(result.slug)}/model.yft`,
                ytdUrl: result.ytdPath
                  ? `/api/gta5mods-asset/${encodeURIComponent(result.slug)}/textures.ytd`
                  : null
              })
            );
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
          }
          return;
        }

        if (req.url.startsWith('/api/gta5mods-asset/')) {
          try {
            const parts = req.url.split('?')[0].split('/').filter(Boolean);
            // parts: ['api', 'gta5mods-asset', slug, fileName]
            const slug = decodeURIComponent(parts[2] || '').replace(/[^a-z0-9_-]/gi, '_');
            const fileName = parts[3] === 'textures.ytd' ? 'textures.ytd' : 'model.yft';
            const { CACHE_ROOT } = require('./server/gta5ModsExtractor.cjs');
            const fullPath = path.join(CACHE_ROOT, slug, fileName);

            if (!fs.existsSync(fullPath)) {
              res.statusCode = 404;
              res.end('Not found');
              return;
            }
            const stat = fs.statSync(fullPath);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', stat.size);
            fs.createReadStream(fullPath).pipe(res);
          } catch (err) {
            res.statusCode = 500;
            res.end(err.message);
          }
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), gta5ModsApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5175
  }
});
