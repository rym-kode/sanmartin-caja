// Arma dist/ inyectando las variables de entorno en la página (sin dependencias).
// Local: leé .env (copiá .env.example). En el host (Netlify/Vercel/etc.): cargá las variables como secrets.
const fs = require('fs'), path = require('path');

const env = {};
try { // .env local (opcional): líneas CLAVE=valor
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  });
} catch (e) { /* sin .env: se usan las variables del entorno */ }
const get = k => process.env[k] || env[k] || '';

const SCRIPT_URL = get('SCRIPT_URL'), SHEET_URL = get('SHEET_URL');
if (!SCRIPT_URL) { console.error('Falta SCRIPT_URL (definila en .env o como variable de entorno del host).'); process.exit(1); }
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(SCRIPT_URL)) { console.error('SCRIPT_URL no parece la URL /exec de Apps Script.'); process.exit(1); }

const js = v => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
fs.rmSync('dist', { recursive: true, force: true }); fs.mkdirSync('dist');
fs.writeFileSync('dist/index.html', fs.readFileSync('index.html', 'utf8')
  .replace('__SCRIPT_URL__', () => js(SCRIPT_URL)).replace('__SHEET_URL__', () => js(SHEET_URL)));
fs.copyFileSync('parser.js', 'dist/parser.js');
console.log('OK: dist/ listo (SCRIPT_URL' + (SHEET_URL ? ' y SHEET_URL' : '') + ' inyectadas).');
