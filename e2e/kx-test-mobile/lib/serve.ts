import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.map': 'application/json' };
/** Static server with single-page fallback for an Expo web export (private port, loopback only). */
export function serveStatic(root: string, port: number): Promise<http.Server> {
  const srv = http.createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    for (const f of [join(root, p), join(root, 'index.html')]) {
      try { const b = await readFile(f); res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); return res.end(b); } catch { /* next */ }
    }
    res.writeHead(404); res.end();
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok(srv)));
}

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
/** Folder of the exported web build of an app (`scripts/build-web.sh`). */
export const webDir = (app: 'kiorex' | 'kiorly') => join(dirname(fileURLToPath(import.meta.url)), '..', '.web', app);
