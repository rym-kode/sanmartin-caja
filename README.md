# Carga de caja – San Martín

Página web simple (HTML + JavaScript, sin servidor) que lee el PDF "Listado de Movimientos de la Caja",
suma los montos por tipo y por día, y los sube a un Google Sheet (un Sheet por año, una hoja por mes).

## Archivos
- `index.html` – la página (lee los PDF en el navegador con pdf.js; los PDF no se suben a ningún servidor).
- `parser.js` – lectura y suma de montos del PDF.
- `Code.gs` – Google Apps Script que escribe en el Sheet (se pega en Extensiones > Apps Script).
- `plantillas/` – Excel vacíos 2026–2035 (una hoja por mes, fechas precargadas) para subir al Drive y convertir a Google Sheets.

## Puesta en marcha
1. Subí las plantillas al Drive y convertilas a Google Sheets (Archivo > Guardar como Hoja de cálculo de Google).
2. En Apps Script pegá `Code.gs` y, en Configuración del proyecto > **Propiedades del script**, creá:
   `CODIGO` (la clave de acceso) y `hoja_2026`, `hoja_2027`, … (el ID de cada Sheet: el tramo largo de la URL entre `/d/` y `/edit`).
3. Implementar como aplicación web: ejecutar como "Yo", acceso "Cualquier usuario". Copiá la URL `/exec`.
4. Variables de entorno de la página: `SCRIPT_URL` (la URL `/exec`) y, opcional, `SHEET_URL`.
   - Local: copiá `.env.example` a `.env`, completalo y corré `node build.js` (genera `dist/`).
   - Host (Netlify, Vercel, etc.): cargalas como **secrets/variables de entorno**; comando de build `node build.js`, carpeta a publicar `dist`.
5. Compartí los Sheets como "Lector" (solo ver): solo el script escribe, y solo con la clave correcta.

## Seguridad
- `.env` está en `.gitignore`: la URL del script y los IDs no se suben al repo. La clave y los IDs viven en las propiedades del script.
- La clave de acceso la tipea cada usuario en la página; nunca va en el código.
- No subas PDFs de caja reales (`*.pdf` está ignorado).
- La URL `/exec` queda visible en la página publicada (cualquiera que la abra la ve); lo que protege la escritura es la clave.
