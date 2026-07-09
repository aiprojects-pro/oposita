'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { BLOQUES, ITEMS, CSV_COLUMNS } = require('./schema');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const UMBRAL_RAPIDA = 300; // segundos: por debajo se marca flag_rapida

const DATA_DIR = path.join(__dirname, 'data');
const JSONL_PATH = path.join(DATA_DIR, 'respuestas.jsonl'); // SILO 1: respuestas (con hash de borrado)
const CSV_PATH = path.join(DATA_DIR, 'respuestas.csv');    // SILO 1: espejo CSV para análisis
const SORTEO_PATH = path.join(DATA_DIR, 'sorteo.jsonl');   // SILO 2: solo emails del sorteo
const TICKETS_PATH = path.join(DATA_DIR, 'tickets.jsonl'); // Tickets emitidos (hash), sin enlace a respuestas

// ---------------------------------------------------------------------------
// Preparación del almacenamiento
// ---------------------------------------------------------------------------
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JSONL_PATH)) fs.writeFileSync(JSONL_PATH, '', 'utf8');
  if (!fs.existsSync(SORTEO_PATH)) fs.writeFileSync(SORTEO_PATH, '', 'utf8');
  if (!fs.existsSync(TICKETS_PATH)) fs.writeFileSync(TICKETS_PATH, '', 'utf8');
  if (!fs.existsSync(CSV_PATH)) {
    // UTF-8 con BOM para que Excel muestre bien los acentos.
    fs.writeFileSync(CSV_PATH, '﻿' + csvRow(CSV_COLUMNS) + '\n', 'utf8');
  }
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  // Entrecomillamos siempre y duplicamos las comillas internas.
  return '"' + s.replace(/"/g, '""') + '"';
}

function csvRow(values) {
  return values.map(csvEscape).join(',');
}

function hash(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

// Código de borrado legible para el participante: OPOSDEP-XXXX-XXXX (sin caracteres ambiguos).
function generarCodigoBorrado() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const grupo = () => Array.from({ length: 4 }, () => abc[crypto.randomInt(abc.length)]).join('');
  return `OPOSDEP-${grupo()}-${grupo()}`;
}

// Ticket del sorteo: aleatorio, opaco, sin relación con las respuestas.
function generarTicket() {
  return crypto.randomBytes(16).toString('hex');
}

// ---------------------------------------------------------------------------
// Lock de escritura: serializa TODAS las operaciones de fichero para que no se
// entrelacen (append de respuestas, reescrituras por borrado, tickets, sorteo).
// ---------------------------------------------------------------------------
let chain = Promise.resolve();
function serial(fn) {
  const resultado = chain.then(fn, fn);
  chain = resultado.then(() => {}, () => {}); // el lock nunca se rompe por un error
  return resultado;
}

function filaCsv(record) {
  return csvRow(CSV_COLUMNS.map((col) => {
    const v = record[col];
    return Array.isArray(v) ? v.join('; ') : v;
  }));
}

function persistirRespuesta(record) {
  return serial(async () => {
    await fs.promises.appendFile(JSONL_PATH, JSON.stringify(record) + '\n', 'utf8');
    await fs.promises.appendFile(CSV_PATH, filaCsv(record) + '\n', 'utf8');
  });
}

// Reescribe por completo JSONL + CSV a partir de una lista de registros (tras un borrado).
function reescribirRespuestas(records) {
  return serial(async () => {
    const jsonl = records.map((r) => JSON.stringify(r)).join('\n');
    await fs.promises.writeFile(JSONL_PATH, records.length ? jsonl + '\n' : '', 'utf8');
    const filas = records.map(filaCsv);
    const csv = '﻿' + csvRow(CSV_COLUMNS) + '\n' + (filas.length ? filas.join('\n') + '\n' : '');
    await fs.promises.writeFile(CSV_PATH, csv, 'utf8');
  });
}

// ---------------------------------------------------------------------------
// Lectura de los distintos silos
// ---------------------------------------------------------------------------
function leerJsonl(ruta) {
  if (!fs.existsSync(ruta)) return [];
  const registros = [];
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const l = linea.trim();
    if (!l) continue;
    try { registros.push(JSON.parse(l)); } catch (_) { /* línea corrupta: se ignora */ }
  }
  return registros;
}

const leerRegistros = () => leerJsonl(JSONL_PATH);
const leerTickets = () => leerJsonl(TICKETS_PATH);
const leerSorteo = () => leerJsonl(SORTEO_PATH);

// ---------------------------------------------------------------------------
// Validación de una respuesta entrante
// ---------------------------------------------------------------------------
function validarRespuestas(body) {
  const errores = [];
  const answers = {};

  for (const item of ITEMS) {
    const raw = body[item.code];

    if (item.type === 'open') {
      answers[item.code] = typeof raw === 'string' ? raw.trim() : '';
      continue;
    }

    const vacio = raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0);
    if (vacio) {
      errores.push(`Falta la respuesta obligatoria: ${item.code} (ítem ${item.num}).`);
      continue;
    }

    if (item.type === 'single') {
      if (!item.options.includes(raw)) {
        errores.push(`Valor no válido en ${item.code} (ítem ${item.num}).`);
      } else {
        answers[item.code] = raw;
      }
    } else if (item.type === 'multiple') {
      const arr = Array.isArray(raw) ? raw : [raw];
      const invalidos = arr.filter((v) => !item.options.includes(v));
      if (invalidos.length) {
        errores.push(`Opción no válida en ${item.code} (ítem ${item.num}).`);
      } else {
        answers[item.code] = arr;
      }
    } else if (item.type === 'likert') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        errores.push(`Valor Likert no válido en ${item.code} (ítem ${item.num}).`);
      } else {
        answers[item.code] = n; // se guarda EN CRUDO (los invertidos también)
      }
    } else if (item.type === 'nps') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < item.min || n > item.max) {
        errores.push(`Valor NPS no válido en ${item.code} (ítem ${item.num}).`);
      } else {
        answers[item.code] = n;
      }
    }
  }

  return { errores, answers };
}

// ---------------------------------------------------------------------------
// Autenticación del panel de administración (token de sesión en memoria)
// ---------------------------------------------------------------------------
const sessions = new Set();

function passwordCorrecta(intento) {
  if (!ADMIN_PASSWORD) return false;
  const a = Buffer.from(String(intento));
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Panel de administración no configurado (falta ADMIN_PASSWORD).' });
  }
  const token = req.get('x-admin-token');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Agregados para el panel
// ---------------------------------------------------------------------------
function calcularStats() {
  const registros = leerRegistros();
  const total = registros.length;
  const rapidas = registros.filter((r) => r.flag_rapida === true).length;
  let ultima = null;
  for (const r of registros) {
    if (r.timestamp && (!ultima || r.timestamp > ultima)) ultima = r.timestamp;
  }

  const distribuciones = {};
  const likertMedias = {};
  for (const item of ITEMS) {
    if (item.type === 'single') {
      const conteo = {};
      for (const op of item.options) conteo[op] = 0;
      for (const r of registros) if (r[item.code] != null && conteo[r[item.code]] != null) conteo[r[item.code]]++;
      distribuciones[item.code] = { label: item.label, num: item.num, conteo };
    } else if (item.type === 'likert') {
      const valores = registros.map((r) => r[item.code]).filter((v) => typeof v === 'number');
      const media = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
      likertMedias[item.code] = { label: item.label, num: item.num, inverted: !!item.inverted, media, n: valores.length };
    }
  }

  const sorteo = { participantes: leerSorteo().length };

  return { total, rapidas, ultima, distribuciones, likertMedias, sorteo };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
ensureStorage();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Esquema para que el frontend pinte el formulario.
app.get('/api/schema', (req, res) => {
  res.json({ bloques: BLOQUES });
});

// Envío del cuestionario. Devuelve el CÓDIGO DE BORRADO y un TICKET para el sorteo.
app.post('/api/submit', async (req, res) => {
  const body = req.body || {};
  const { errores, answers } = validarRespuestas(body);
  if (errores.length) {
    return res.status(400).json({ ok: false, errores });
  }

  let duracion = Number(body.duracion_segundos);
  if (!Number.isFinite(duracion) || duracion < 0) duracion = null;

  // Código que conserva el participante para pedir el borrado de SUS respuestas.
  // En la respuesta guardamos solo su hash: el fichero de respuestas no contiene
  // datos identificativos, solo un valor opaco inútil sin la copia del participante.
  const codigoBorrado = generarCodigoBorrado();

  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    duracion_segundos: duracion,
    flag_rapida: duracion != null && duracion < UMBRAL_RAPIDA,
    borrado_hash: hash(codigoBorrado),
    ...answers
  };

  // Ticket del sorteo: se emite y se guarda su hash SIN ninguna referencia a la respuesta.
  const ticket = generarTicket();

  try {
    await persistirRespuesta(record);
    await serial(() => fs.promises.appendFile(TICKETS_PATH, JSON.stringify({ h: hash(ticket), usado: false }) + '\n', 'utf8'));
    res.json({ ok: true, codigo_borrado: codigoBorrado, ticket });
  } catch (err) {
    console.error('Error al guardar la respuesta:', err);
    res.status(500).json({ ok: false, error: 'No se pudo guardar la respuesta.' });
  }
});

// Entrada al sorteo: email + ticket. Guarda SOLO el email, en un fichero separado
// sin ninguna conexión con las respuestas del cuestionario.
app.post('/api/sorteo', async (req, res) => {
  const { email, ticket } = req.body || {};
  const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm) && emailNorm.length <= 254;
  if (!emailOk) {
    return res.status(400).json({ ok: false, error: 'Introduce un email válido.' });
  }
  if (typeof ticket !== 'string' || !ticket) {
    return res.status(400).json({ ok: false, error: 'Falta el ticket de participación.' });
  }

  try {
    const resultado = await serial(async () => {
      const tickets = leerTickets();
      const h = hash(ticket);
      const t = tickets.find((x) => x.h === h);
      if (!t) return { code: 400, error: 'Ticket no válido.' };
      if (t.usado) return { code: 409, error: 'Este ticket ya se ha usado para entrar en el sorteo.' };

      // Marca el ticket como usado (reescribe el fichero de tickets).
      t.usado = true;
      await fs.promises.writeFile(TICKETS_PATH, tickets.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');

      // Guarda solo el email (silo separado).
      await fs.promises.appendFile(SORTEO_PATH, JSON.stringify({ email: emailNorm, timestamp: new Date().toISOString() }) + '\n', 'utf8');
      return { code: 200 };
    });

    if (resultado.code !== 200) {
      return res.status(resultado.code).json({ ok: false, error: resultado.error });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en el sorteo:', err);
    res.status(500).json({ ok: false, error: 'No se pudo registrar la participación.' });
  }
});

// Borrado de las propias respuestas mediante el código del participante (RGPD, art. 17).
app.post('/api/borrar', async (req, res) => {
  const { codigo } = req.body || {};
  if (typeof codigo !== 'string' || !codigo.trim()) {
    return res.status(400).json({ ok: false, error: 'Introduce tu código de borrado.' });
  }
  const h = hash(codigo.trim().toUpperCase());

  try {
    const borrado = await serial(async () => {
      const registros = leerRegistros();
      const restantes = registros.filter((r) => r.borrado_hash !== h);
      if (restantes.length === registros.length) return false; // no había coincidencia

      const jsonl = restantes.map((r) => JSON.stringify(r)).join('\n');
      await fs.promises.writeFile(JSONL_PATH, restantes.length ? jsonl + '\n' : '', 'utf8');
      const filas = restantes.map(filaCsv);
      const csv = '﻿' + csvRow(CSV_COLUMNS) + '\n' + (filas.length ? filas.join('\n') + '\n' : '');
      await fs.promises.writeFile(CSV_PATH, csv, 'utf8');
      return true;
    });

    if (!borrado) {
      return res.status(404).json({ ok: false, error: 'No se ha encontrado ninguna respuesta con ese código.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al borrar:', err);
    res.status(500).json({ ok: false, error: 'No se pudo completar el borrado.' });
  }
});

// Login admin -> devuelve token de sesión.
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Panel de administración no configurado (falta ADMIN_PASSWORD).' });
  }
  const { password } = req.body || {};
  if (!passwordCorrecta(password)) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.add(token);
  res.json({ token });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  sessions.delete(req.get('x-admin-token'));
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json(calcularStats());
});

// Exportar CSV de respuestas (silo 1). Nunca incluye emails.
app.get('/api/admin/export', requireAdmin, (req, res) => {
  if (!fs.existsSync(CSV_PATH)) {
    return res.status(404).json({ error: 'Todavía no hay datos.' });
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="respuestas.csv"');
  fs.createReadStream(CSV_PATH).pipe(res);
});

// Exportar la lista de emails del sorteo (silo 2), para realizar el sorteo del cheque.
app.get('/api/admin/sorteo-export', requireAdmin, (req, res) => {
  const emails = leerSorteo().map((e) => e.email);
  const csv = '﻿"email"\n' + emails.map((e) => csvEscape(e)).join('\n') + (emails.length ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sorteo_emails.csv"');
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`IA-OPOSDEP escuchando en http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) {
    console.warn('AVISO: ADMIN_PASSWORD no definida; el panel de administración responderá 401.');
  }
});
