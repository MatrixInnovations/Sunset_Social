import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/screenshots');
const artifactDir = '/opt/cursor/artifacts';
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = clean.replace(/^\/+/, '');
  const candidates = [rel, `${rel}.html`, path.join(rel, 'index.html')];
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    if (candidate && fs.existsSync(full) && fs.statSync(full).isFile()) {
      return full;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const file = fileFor(req.url ?? '/');
  if (!file) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));

const shots = [
  { route: '/', file: '01-discover', text: 'Good evening' },
  { route: '/event/sunset-social', file: '02-event', text: 'RESERVE YOUR PLACE' },
  { route: '/checkout/sunset-social', file: '03-checkout', text: 'SAMPLE ORDER' },
  { route: '/tickets', file: '04-wallet', text: 'Golden' },
  { route: '/guests', file: '05-guest-list', text: 'guest list' },
  { route: '/door', file: '06-door', text: 'DOOR MODE' },
  { route: '/profile', file: '07-profile', text: 'Your Name' },
];

const browser = await launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });

for (const shot of shots) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:4173${shot.route}`, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 20000 }, shot.text);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const target = path.join(outDir, `${shot.file}.png`);
  await page.screenshot({ path: target });
  fs.copyFileSync(target, path.join(artifactDir, `sunset-${shot.file}.png`));
  if (errors.length) {
    console.log(shot.file, errors.slice(0, 3).join(' | '));
  } else {
    console.log('saved', shot.file);
  }
}

await page.evaluate(() => {
  const scrollers = [...document.querySelectorAll('div')].filter((el) => el.scrollHeight > el.clientHeight + 40);
  const target = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  if (target) target.scrollTop = target.scrollHeight;
});
await new Promise((resolve) => setTimeout(resolve, 300));
const footer = path.join(outDir, '07-profile-footer.png');
await page.screenshot({ path: footer });
fs.copyFileSync(footer, path.join(artifactDir, 'sunset-07-profile-footer.png'));
console.log('saved footer');

await browser.close();
server.close();
