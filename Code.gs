/**
 * San Martín – carga de caja a Google Sheets (Google Apps Script)
 *
 * INSTALACIÓN (una sola vez, con la cuenta dueña del Sheet):
 *  1. Abrí el Sheet > Extensiones > Apps Script. Pegá este archivo en Code.gs.
 *  2. Secretos como propiedades del script (no en el código): CODIGO (la clave de acceso) y hoja_2026, hoja_2027...
 *     (el ID de cada Google Sheet). Así:
 *     Configuración del proyecto (engranaje) > Propiedades del script > Agregar propiedad:
 *     nombre CODIGO, valor = la clave. Si existe, tiene prioridad sobre CONFIG.CODIGO de abajo.
 *     CONFIG.CODIGO es solo un valor de prueba: borralo o cambialo antes de uso real.
 *  3. Configuración del proyecto (engranaje) > Zona horaria: America/Argentina/Buenos_Aires.
 *  4. Implementar > Nueva implementación > tipo "Aplicación web":
 *       - Ejecutar como: Yo
 *       - Quién tiene acceso: Cualquier usuario
 *     Autorizá los permisos y copiá la URL (termina en /exec) en index.html (SCRIPT_URL).
 *  5. En el Sheet > Compartir: dejá al resto como "Lector" (solo ver). Nadie edita a mano:
 *     solo escribe este script, y solo si te llega el CODIGO correcto.
 *
 * Estructura: un Sheet por año, una hoja por mes, una fila por día (fechas precargadas).
 * Al subir un PDF se busca la fila de esa fecha y se completa. Si se vuelve a subir el
 * mismo día, se sobreescribe (no duplica).
 */
const CONFIG = {
  CODIGO: '', // vacío: la clave real va en Propiedades del script (nombre CODIGO)
  // Los IDs de los Sheets NO van acá: se cargan como propiedades del script llamadas hoja_2026, hoja_2027, etc.
  // (Configuración del proyecto > Propiedades del script). Si falta el año, se crea un Sheet nuevo solo.
  HOJAS: {}
};

const TZ = 'America/Argentina/Buenos_Aires';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const HEADERS = ['Fecha','Día','Cant. ventas','Efectivo','Tarjeta débito','Tarjeta crédito','Cheque','Transferencia',
  'Total del día','Factura A','Factura B','Orden de pedido','Otros','Inicio de caja','Salidas','Última carga'];
// Campos que se escriben (col 3 a 8 y 10 a 15). La col 9 es fórmula y la 16 es la hora de carga.
const CAMPOS = ['cantVentas','efectivo','tdebito','tcredito','cheque','transf', null,'facA','facB','orden','otros','inicio','salidas'];

// Clave esperada: propiedad del script CODIGO; si no está cargada, usa el valor de prueba de CONFIG
function codigo_() { return PropertiesService.getScriptProperties().getProperty('CODIGO') || CONFIG.CODIGO || '\u0000sin-clave-configurada'; }

function doGet() { return json_({ ok: true, mensaje: 'Servicio de carga activo' }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse(e.postData.contents);
    if (data.codigo !== codigo_()) return json_({ ok: false, error: 'Código de acceso incorrecto' });
    if (data.accion === 'cargados') return json_(cargados_(data.anio)); // consulta: qué fechas ya tienen datos
    if (!data.dias || !data.dias.length) return json_({ ok: false, error: 'No hay días para cargar' });

    const resultado = data.dias.map(function (d) {
      const p = d.fecha.split('-').map(Number);          // yyyy-mm-dd
      const ss = spreadsheet_(p[0]);
      const sh = hoja_(ss, p[0], p[1]);
      const fila = filaDe_(sh, ss, p[0], p[1], p[2]);
      const vals = CAMPOS.map(function (c) { return c ? Number(d[c]) || 0 : null; });
      // Escribe todo menos la fórmula de total (col 9) y la fecha de carga (col 16)
      sh.getRange(fila, 3, 1, 6).setValues([vals.slice(0, 6)]);
      sh.getRange(fila, 10, 1, 6).setValues([vals.slice(7, 13)]);
      sh.getRange(fila, 16).setValue(new Date());
      return { fecha: d.fecha, hoja: sh.getName(), fila: fila, url: ss.getUrl() + '#gid=' + sh.getSheetId() };
    });
    return json_({ ok: true, resultado: resultado });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function spreadsheet_(anio) {
  const props = PropertiesService.getScriptProperties();
  let id = CONFIG.HOJAS[String(anio)] || props.getProperty('hoja_' + anio);
  if (id) { const x = SpreadsheetApp.openById(id); if (x.getSpreadsheetTimeZone() !== TZ) x.setSpreadsheetTimeZone(TZ); return x; }
  const ss = SpreadsheetApp.create('Caja San Martín ' + anio);
  ss.setSpreadsheetTimeZone(TZ);
  props.setProperty('hoja_' + anio, ss.getId());
  return ss;
}

function hoja_(ss, anio, mes) {
  const nombre = MESES[mes - 1];
  let sh = ss.getSheetByName(nombre);
  if (sh) return sh;
  sh = ss.insertSheet(nombre);
  const n = new Date(anio, mes, 0).getDate();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#eeeeee');
  const filas = [];
  for (let d = 1; d <= n; d++) {
    const f = new Date(anio, mes - 1, d);
    const r = d + 1;
    filas.push([f, DIAS[f.getDay()], '', '', '', '', '', '', '=SUM(D' + r + ':H' + r + ')', '', '', '', '', '', '', '']);
  }
  sh.getRange(2, 1, n, HEADERS.length).setValues(filas);
  const t = n + 2;
  const fila = ['TOTAL ' + nombre.toUpperCase(), ''];
  for (let c = 3; c <= 15; c++) {
    const L = columna_(c);
    fila.push('=SUM(' + L + '2:' + L + (n + 1) + ')');
  }
  fila.push('');
  sh.getRange(t, 1, 1, HEADERS.length).setValues([fila]).setFontWeight('bold').setBackground('#eeeeee');
  sh.getRange(2, 1, n, 1).setNumberFormat('dd/mm/yy');
  sh.getRange(2, 4, n + 1, 12).setNumberFormat('$ #,##0.00');
  sh.getRange(2, 3, n + 1, 1).setNumberFormat('0');
  sh.getRange(2, 16, n, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, HEADERS.length);
  // Si el Sheet recién creado/existente tenía solo la hoja vacía por defecto, se saca
  ss.getSheets().forEach(function (s) {
    if (s.getSheetId() !== sh.getSheetId() && s.getLastRow() === 0 && ss.getSheets().length > 1 &&
        /^(Hoja 1|Sheet1)$/.test(s.getName())) ss.deleteSheet(s);
  });
  return sh;
}

function filaDe_(sh, ss, anio, mes, dia) {
  // Sin depender de zonas horarias: las filas van en orden (día 1 en la fila 2),
  // y se confirma leyendo el texto que se ve en la celda (dd/mm/yy).
  const p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  const esperado = p2(dia) + '/' + p2(mes) + '/' + String(anio).slice(-2);
  const n = new Date(anio, mes, 0).getDate();
  const textos = sh.getRange(2, 1, n, 1).getDisplayValues();
  if (textos[dia - 1] && textos[dia - 1][0] === esperado) return dia + 1;
  for (let i = 0; i < textos.length; i++) if (textos[i][0] === esperado) return i + 2;
  throw new Error('No encontré la fila del ' + esperado + ' en la hoja ' + sh.getName());
}

// Devuelve las fechas del año que ya tienen datos (Cant. ventas o "Última carga" completos). No crea nada.
function cargados_(anio) {
  anio = Number(anio);
  const id = CONFIG.HOJAS[String(anio)] || PropertiesService.getScriptProperties().getProperty('hoja_' + anio);
  if (!id) return { ok: true, anio: anio, fechas: [] };
  const ss = SpreadsheetApp.openById(id), fechas = [];
  MESES.forEach(function (nombre, i) {
    const sh = ss.getSheetByName(nombre);
    if (!sh) return;
    const n = new Date(anio, i + 1, 0).getDate();
    const textos = sh.getRange(2, 1, n, 1).getDisplayValues();   // fechas como se ven: dd/mm/yy
    const datos = sh.getRange(2, 3, n, 14).getValues();           // columnas C a P
    for (let d = 0; d < n; d++) {
      if (datos[d][0] === '' && datos[d][13] === '') continue;    // C (cant. ventas) y P (última carga) vacías
      const m = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(textos[d][0]);
      fechas.push(m ? '20' + m[3] + '-' + m[2] + '-' + m[1] : anio + '-' + ('0' + (i + 1)).slice(-2) + '-' + ('0' + (d + 1)).slice(-2));
    }
  });
  return { ok: true, anio: anio, fechas: fechas };
}

function columna_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
