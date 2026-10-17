import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT || '3000';
const port = Number(rawPort) || 3000;
const basePath = process.env.BASE_PATH || '/';


function localMemoryBoothApiPlugin() {
  return {
    name: 'local-memory-booth-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';

        // CORS and ngrok headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('ngrok-skip-browser-warning', 'true');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (url.startsWith('/api/memory/generate') && req.method === 'POST') {
          try {
            let rawData = '';
            for await (const chunk of req) {
              rawData += chunk;
            }
            const body = rawData ? JSON.parse(rawData) : {};

            const genModule = await import('../../api/memory/generate.mjs');
            const handler = genModule.default;

            const mockRes = {
              statusCode: 200,
              status(code: number) {
                this.statusCode = code;
                return this;
              },
              json(payload: any) {
                res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
              },
              setHeader(k: string, v: string) {
                res.setHeader(k, v);
              },
              end(data: any) {
                res.end(data);
              },
            };

            await handler({ ...req, body, method: req.method }, mockRes);
          } catch (err: any) {
            console.error('[Local API Route Error]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err && err.message ? err.message : String(err) }));
          }
        } else if (url.startsWith('/api/memory/upload') && req.method === 'POST') {
          try {
            let rawData = '';
            for await (const chunk of req) {
              rawData += chunk;
            }
            const body = rawData ? JSON.parse(rawData) : {};

            const uploadModule = await import('../../api/memory/upload.mjs');
            const handler = uploadModule.default;

            const mockRes = {
              statusCode: 200,
              status(code: number) {
                this.statusCode = code;
                return this;
              },
              json(payload: any) {
                res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
              },
              setHeader(k: string, v: string) {
                res.setHeader(k, v);
              },
              end(data: any) {
                res.end(data);
              },
            };

            await handler({ ...req, body, method: req.method }, mockRes);
          } catch (err: any) {
            console.error('[Upload API Error]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err && err.message ? err.message : String(err) }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    localMemoryBoothApiPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'https://talabat-mart-photo-booth.vercel.app',
        changeOrigin: true,
        secure: false
      }
    },
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
