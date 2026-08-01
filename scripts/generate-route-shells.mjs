import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');
const routes = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)]
  .map(match => new URL(match[1]).pathname)
  .filter(route => route !== '/' && route !== '/admin' && !path.extname(route));

for (const route of new Set(routes)) {
  const routeDir = path.join(distDir, route.replace(/^\/+|\/+$/g, ''));
  await mkdir(routeDir, { recursive: true });
  await copyFile(path.join(distDir, 'index.html'), path.join(routeDir, 'index.html'));
}

console.log(`[routes] Wrote ${new Set(routes).size} direct-entry shells.`);
