// Lee el "Listado de Movimientos de la Caja" (PDF) y agrupa montos por día y por tipo.
// pages: [[{str,x,y}, ...], ...]  (items de texto de pdf.js con su posición)
(function (root) {
  const DATE = /^(\d{2})\/(\d{2})\/(\d{2})$/;
  const AMOUNT = /^-?\d+\.\d{2}$/;

  function groupRows(items) {
    const rows = [];
    items.filter(i => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x).forEach(i => {
      const r = rows.find(r => Math.abs(r.y - i.y) <= 3);
      if (r) r.items.push(i); else rows.push({ y: i.y, items: [i] });
    });
    rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
    return rows;
  }

  function toISO(d) { return `20${d[3]}-${d[2]}-${d[1]}`; }

  function parseCaja(pages) {
    // 1) Posiciones de columnas desde el encabezado (página 1)
    let cols = null;
    for (const items of pages) {
      const hdr = groupRows(items).find(r => r.items.some(i => i.str === 'Transf.') && r.items.some(i => i.str === 'Cheque'));
      if (hdr) {
        const nums = hdr.items.filter(i => ['Efectivo', 'Tarjeta', 'Cheque', 'Transf.'].includes(i.str)).sort((a, b) => a.x - b.x);
        // orden: Tarjeta(desc), Efectivo, Tarjeta, Cheque, Transf., Efectivo, Tarjeta, Cheque, Transf.
        const sorted = nums.slice(1); // saca "Tarjeta" de la descripción
        const names = ['in_efectivo', 'in_tarjeta', 'in_cheque', 'in_transf', 'out_efectivo', 'out_tarjeta', 'out_cheque', 'out_transf'];
        cols = sorted.map((i, k) => ({ name: names[k], x: i.x }));
        break;
      }
    }
    if (!cols || cols.length < 8) throw new Error('No encontré el encabezado de columnas. ¿Es el "Listado de Movimientos de la Caja"?');
    const colOf = x => cols.reduce((b, c) => Math.abs(c.x - x) < Math.abs(b.x - x) ? c : b).name;

    const days = {};
    const day = f => (days[f] = days[f] || {
      fecha: f, cantVentas: 0, efectivo: 0, tdebito: 0, tcredito: 0, cheque: 0, transf: 0,
      facA: 0, facB: 0, orden: 0, otros: 0, inicio: 0, salidas: 0
    });
    const pending = []; // INICIO se asigna al día de las ventas
    const summary = { texto: [] };
    const sales = [];

    for (const items of pages) {
      for (const row of groupRows(items)) {
        const first = row.items[0];
        const m = first && first.x < 40 && DATE.exec(first.str);
        const timeIt = row.items.find(i => /^\d{2}:\d{2}$/.test(i.str));
        if (m && timeIt) {
          const fecha = toISO(m);
          const rest = row.items.filter(i => i !== first && i !== timeIt);
          const desc = rest.filter(i => !AMOUNT.test(i.str) && i.x > 100 && i.x < 190).map(i => i.str).join(' ').trim().toUpperCase();
          const card = rest.filter(i => !AMOUNT.test(i.str) && i.x >= 190 && i.x < 250).map(i => i.str).join(' ').trim().toUpperCase();
          const amts = rest.filter(i => AMOUNT.test(i.str)).map(i => ({ col: colOf(i.x), v: parseFloat(i.str) }));
          if (/^INICIO/.test(desc)) { pending.push(amts.reduce((s, a) => s + a.v, 0)); continue; }
          if (/CIERRE/.test(desc)) continue;
          sales.push({ fecha, desc, card, amts });
        } else {
          summary.texto.push(row.items.map(i => i.str).join(' '));
        }
      }
    }

    sales.forEach(s => {
      const d = day(s.fecha);
      let entrada = 0, esVenta = false;
      s.amts.forEach(a => {
        if (a.col.startsWith('out_')) { d.salidas += a.v; return; }
        esVenta = true; entrada += a.v;
        if (a.col === 'in_efectivo') d.efectivo += a.v;
        else if (a.col === 'in_tarjeta') (/DEB|^TD\b/.test(s.card) ? d.tdebito += a.v : d.tcredito += a.v);
        else if (a.col === 'in_cheque') d.cheque += a.v;
        else if (a.col === 'in_transf') d.transf += a.v;
      });
      if (!esVenta) return;
      d.cantVentas++;
      if (/FACTURA A/.test(s.desc)) d.facA += entrada;
      else if (/FACTURA B/.test(s.desc)) d.facB += entrada;
      else if (/ORDEN PED/.test(s.desc)) d.orden += entrada;
      else d.otros += entrada;
    });

    const list = Object.values(days).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (list.length && pending.length) list[0].inicio = pending.reduce((a, b) => a + b, 0);
    list.forEach(d => {
      for (const k of Object.keys(d)) if (typeof d[k] === 'number') d[k] = Math.round(d[k] * 100) / 100;
      d.total = Math.round((d.efectivo + d.tdebito + d.tcredito + d.cheque + d.transf) * 100) / 100;
    });

    // Resumen impreso al final del PDF, para chequear que cierra
    const txt = summary.texto.join('\n');
    const num = re => { const m = re.exec(txt); return m ? parseFloat(m[1]) : null; };
    const control = {
      ventasEfectivo: num(/Ventas Efectivo\s+(-?\d+\.\d{2})/),
      cantVentas: num(/Cantidad de Ventas\s+(\d+)/),
      tarjetas: num(/Diferecia Tarjetas:\s+(-?\d+\.\d{2})/)
    };
    return { dias: list, control };
  }

  root.parseCaja = parseCaja;
  if (typeof module !== 'undefined') module.exports = { parseCaja };
})(typeof window !== 'undefined' ? window : globalThis);
