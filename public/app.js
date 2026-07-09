'use strict';

// Escala Likert (etiquetas fijas 1-5).
const ESCALA = [
  { valor: 1, etiqueta: 'Totalmente en desacuerdo' },
  { valor: 2, etiqueta: 'En desacuerdo' },
  { valor: 3, etiqueta: 'Ni de acuerdo ni en desacuerdo' },
  { valor: 4, etiqueta: 'De acuerdo' },
  { valor: 5, etiqueta: 'Totalmente de acuerdo' }
];

let startTime = null; // se fija al entrar al cuestionario

// ---------------------------------------------------------------------------
// Consentimiento
// ---------------------------------------------------------------------------
const consentCheck = document.getElementById('consent-check');
const btnComenzar = document.getElementById('btn-comenzar');

consentCheck.addEventListener('change', () => {
  btnComenzar.disabled = !consentCheck.checked;
});

btnComenzar.addEventListener('click', async () => {
  if (!consentCheck.checked) return;
  await construirFormulario();
  document.getElementById('pantalla-consentimiento').classList.add('hidden');
  document.getElementById('pantalla-cuestionario').classList.remove('hidden');
  document.getElementById('progreso').classList.remove('hidden');
  startTime = Date.now(); // el reloj arranca al mostrarse el cuestionario
  mostrarPaso(0);
});

// Patrón "leer más" del texto informativo.
document.getElementById('btn-mas').addEventListener('click', (e) => {
  const extra = document.getElementById('info-extra');
  const abierto = !extra.classList.contains('hidden');
  extra.classList.toggle('hidden');
  e.target.setAttribute('aria-expanded', String(!abierto));
  e.target.textContent = abierto ? 'Ver información completa' : 'Ocultar información';
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.appendChild(c);
  return node;
}

// Baraja in situ (Fisher-Yates). Usada para aleatorizar el orden de presentación
// de los ítems Likert por participante, sin alterar su código guardado.
function barajar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Aleatoriza SOLO los tramos contiguos de ítems Likert dentro de un bloque.
function ordenarItemsBloque(items) {
  const resultado = [];
  let buffer = [];
  const volcar = () => { if (buffer.length) { resultado.push(...barajar(buffer)); buffer = []; } };
  for (const item of items) {
    if (item.type === 'likert') buffer.push(item);
    else { volcar(); resultado.push(item); }
  }
  volcar();
  return resultado;
}

// ---------------------------------------------------------------------------
// Construcción del formulario a partir del esquema del servidor
// ---------------------------------------------------------------------------
async function construirFormulario() {
  const res = await fetch('/api/schema');
  const { bloques } = await res.json();
  const cont = document.getElementById('bloques');
  cont.innerHTML = '';

  // Contador de presentación: el nº mostrado sigue el orden en que se ve cada
  // pregunta (tras aleatorizar), no el código interno. Los datos se guardan por código.
  let contador = 0;
  for (const bloque of bloques) {
    const fs = el('fieldset', { class: 'bloque hidden', 'data-bloque': String(bloque.n) });
    fs.appendChild(el('legend', { text: bloque.titulo }));
    if (bloque.descripcion) fs.appendChild(el('p', { class: 'bloque-desc', text: bloque.descripcion }));

    // Anclas de la escala Likert: se muestran UNA sola vez por bloque, no por ítem.
    if (bloque.items.some((it) => it.type === 'likert')) {
      const leyenda = el('div', { class: 'likert-leyenda' });
      leyenda.appendChild(el('span', { text: '1 · Totalmente en desacuerdo' }));
      leyenda.appendChild(el('span', { text: '5 · Totalmente de acuerdo' }));
      fs.appendChild(leyenda);
    }

    for (const item of ordenarItemsBloque(bloque.items)) {
      fs.appendChild(renderItem(item, ++contador));
    }
    cont.appendChild(fs);
  }
}

// ---------------------------------------------------------------------------
// Asistente por bloques (un bloque por pantalla) + barra de progreso
// ---------------------------------------------------------------------------
let pasoActual = 0;

function pasos() {
  return Array.from(document.querySelectorAll('#bloques .bloque'));
}

function actualizarProgreso() {
  const total = pasos().length;
  const actual = pasoActual + 1;
  const pct = total ? Math.round((actual / total) * 100) : 0;
  document.getElementById('progreso-label').textContent = `Bloque ${actual} de ${total}`;
  document.getElementById('progreso-pct').textContent = pct + '%';
  document.getElementById('progreso-fill').style.width = pct + '%';
  document.getElementById('progreso-track').setAttribute('aria-valuenow', String(pct));
}

function mostrarPaso(i) {
  const lista = pasos();
  if (!lista.length) return;
  pasoActual = Math.max(0, Math.min(i, lista.length - 1));
  lista.forEach((b, idx) => b.classList.toggle('hidden', idx !== pasoActual));

  const enPrimero = pasoActual === 0;
  const enUltimo = pasoActual === lista.length - 1;
  document.getElementById('btn-anterior').classList.toggle('hidden', enPrimero);
  document.getElementById('btn-siguiente').classList.toggle('hidden', enUltimo);
  document.getElementById('btn-enviar').classList.toggle('hidden', !enUltimo);
  document.getElementById('errores').classList.add('hidden');

  actualizarProgreso();
  window.scrollTo(0, 0);
  // Foco al título del bloque para lectores de pantalla y teclado.
  const legend = lista[pasoActual].querySelector('legend');
  if (legend) { legend.setAttribute('tabindex', '-1'); legend.focus({ preventScroll: true }); }
}

// Comprueba los ítems obligatorios de un bloque; devuelve los que faltan.
function validarBloque(bloqueEl) {
  const faltan = [];
  bloqueEl.querySelectorAll('.pregunta').forEach((p) => {
    p.classList.remove('error');
    if (p.querySelector('textarea')) return; // preguntas abiertas: opcionales
    let respondida;
    const checks = p.querySelectorAll('input[type="checkbox"]');
    if (checks.length) respondida = Array.from(checks).some((c) => c.checked);
    else respondida = !!p.querySelector('input[type="radio"]:checked');
    if (!respondida) { faltan.push(p); p.classList.add('error'); }
  });
  return faltan;
}

document.getElementById('btn-siguiente').addEventListener('click', () => {
  const aviso = document.getElementById('errores');
  const faltan = validarBloque(pasos()[pasoActual]);
  if (faltan.length) {
    aviso.textContent = `Antes de continuar, responde ${faltan.length} pregunta(s) de este bloque. Las hemos señalado más abajo.`;
    aviso.classList.remove('hidden');
    faltan[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarPaso(pasoActual + 1);
});

document.getElementById('btn-anterior').addEventListener('click', () => {
  mostrarPaso(pasoActual - 1);
});

function renderItem(item, numero) {
  const pregunta = el('div', { class: 'pregunta', 'data-code': item.code, id: 'p-' + item.code });
  const etiqueta = el('p', { class: 'pregunta-label' });
  etiqueta.innerHTML = `<span class="num">${numero}.</span> ${item.label}`;
  pregunta.appendChild(etiqueta);

  if (item.type === 'single') {
    pregunta.appendChild(opcionesRadio(item.code, item.options));
  } else if (item.type === 'multiple') {
    pregunta.appendChild(opcionesCheckbox(item.code, item.options));
  } else if (item.type === 'likert') {
    pregunta.appendChild(escalaLikert(item.code));
  } else if (item.type === 'nps') {
    pregunta.appendChild(escalaNps(item.code, item.min, item.max));
  } else if (item.type === 'open') {
    pregunta.appendChild(el('textarea', { name: item.code, rows: '3', class: 'abierta' }));
  }
  return pregunta;
}

function opcionesRadio(code, options) {
  const grupo = el('div', { class: 'opciones' });
  options.forEach((op, i) => {
    const id = `${code}_${i}`;
    const label = el('label', { class: 'opcion', for: id });
    label.appendChild(el('input', { type: 'radio', name: code, id, value: op }));
    label.appendChild(el('span', { text: op }));
    grupo.appendChild(label);
  });
  return grupo;
}

function opcionesCheckbox(code, options) {
  const grupo = el('div', { class: 'opciones' });
  options.forEach((op, i) => {
    const id = `${code}_${i}`;
    const label = el('label', { class: 'opcion', for: id });
    label.appendChild(el('input', { type: 'checkbox', name: code, id, value: op }));
    label.appendChild(el('span', { text: op }));
    grupo.appendChild(label);
  });
  return grupo;
}

function escalaLikert(code) {
  const grupo = el('div', { class: 'escala likert' });
  const fila = el('div', { class: 'escala-fila' });
  ESCALA.forEach(({ valor, etiqueta }) => {
    const id = `${code}_${valor}`;
    const label = el('label', { class: 'escala-opcion', for: id, title: etiqueta });
    const input = el('input', { type: 'radio', name: code, id, value: String(valor) });
    input.setAttribute('aria-label', `${valor} — ${etiqueta}`);
    label.appendChild(input);
    label.appendChild(el('span', { class: 'escala-num', text: String(valor) }));
    fila.appendChild(label);
  });
  grupo.appendChild(fila);
  // Las anclas se muestran una sola vez por bloque (ver construirFormulario), no por ítem.
  return grupo;
}

function escalaNps(code, min, max) {
  const grupo = el('div', { class: 'escala nps' });
  const fila = el('div', { class: 'escala-fila nps-fila' });
  for (let v = min; v <= max; v++) {
    const id = `${code}_${v}`;
    const label = el('label', { class: 'escala-opcion', for: id });
    label.appendChild(el('input', { type: 'radio', name: code, id, value: String(v) }));
    label.appendChild(el('span', { class: 'escala-num', text: String(v) }));
    fila.appendChild(label);
  }
  grupo.appendChild(fila);
  const anclas = el('div', { class: 'escala-anclas' });
  anclas.appendChild(el('span', { text: '0 · Nada probable' }));
  anclas.appendChild(el('span', { text: '10 · Muy probable' }));
  grupo.appendChild(anclas);
  return grupo;
}

// ---------------------------------------------------------------------------
// Recogida y validación en cliente
// ---------------------------------------------------------------------------
function recogerRespuestas() {
  const form = document.getElementById('form-cuestionario');
  const data = {};
  const preguntas = form.querySelectorAll('.pregunta');

  preguntas.forEach((p) => {
    const code = p.dataset.code;
    const textarea = p.querySelector('textarea');
    if (textarea) { data[code] = textarea.value.trim(); return; }

    const checks = p.querySelectorAll('input[type="checkbox"]');
    if (checks.length) {
      data[code] = Array.from(checks).filter((c) => c.checked).map((c) => c.value);
      return;
    }
    const radio = p.querySelector('input[type="radio"]:checked');
    data[code] = radio ? radio.value : null;
  });

  return data;
}

function validar(data) {
  const faltan = [];
  const form = document.getElementById('form-cuestionario');
  form.querySelectorAll('.pregunta').forEach((p) => p.classList.remove('error'));

  form.querySelectorAll('.pregunta').forEach((p) => {
    const code = p.dataset.code;
    const esAbierta = !!p.querySelector('textarea');
    if (esAbierta) return; // opcionales
    const v = data[code];
    const vacio = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (vacio) {
      faltan.push(p);
      p.classList.add('error');
    }
  });

  return faltan;
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------
document.getElementById('form-cuestionario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cajaErrores = document.getElementById('errores');
  const data = recogerRespuestas();
  const faltan = validar(data);

  if (faltan.length) {
    // Lleva al participante al primer bloque que tenga una respuesta pendiente.
    const bloqueEl = faltan[0].closest('.bloque');
    const idx = pasos().indexOf(bloqueEl);
    if (idx >= 0) mostrarPaso(idx);
    cajaErrores.textContent = `Faltan ${faltan.length} respuesta(s) obligatoria(s). Están señaladas más abajo.`;
    cajaErrores.classList.remove('hidden');
    faltan[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  cajaErrores.classList.add('hidden');

  data.duracion_segundos = Math.round((Date.now() - startTime) / 1000);

  const btn = document.getElementById('btn-enviar');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error((json.errores && json.errores.join(' ')) || json.error || 'Error desconocido.');
    }
    mostrarPantallaFinal(json.codigo_borrado, json.ticket);
  } catch (err) {
    cajaErrores.textContent = 'No se pudo enviar el cuestionario: ' + err.message;
    cajaErrores.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Enviar respuestas';
  }
});

// ---------------------------------------------------------------------------
// Pantalla final: código de borrado + sorteo
// ---------------------------------------------------------------------------
let ticketSorteo = null;

function mostrarPantallaFinal(codigoBorrado, ticket) {
  ticketSorteo = ticket;
  document.getElementById('codigo-borrado').textContent = codigoBorrado || '—';
  document.getElementById('pantalla-cuestionario').classList.add('hidden');
  document.getElementById('progreso').classList.add('hidden');
  document.getElementById('pantalla-gracias').classList.remove('hidden');
  window.scrollTo(0, 0);
}

// Copiar el código al portapapeles.
document.getElementById('btn-copiar').addEventListener('click', async () => {
  const codigo = document.getElementById('codigo-borrado').textContent;
  const btn = document.getElementById('btn-copiar');
  try {
    await navigator.clipboard.writeText(codigo);
    btn.textContent = '¡Copiado!';
    setTimeout(() => { btn.textContent = 'Copiar código'; }, 2000);
  } catch (_) {
    btn.textContent = 'Cópialo a mano';
  }
});

// Descargar el código como .txt con instrucciones.
document.getElementById('btn-descargar').addEventListener('click', () => {
  const codigo = document.getElementById('codigo-borrado').textContent;
  const texto =
    'Estudio IA-OPOSDEP (Universidad Pablo de Olavide, código 26/3-44)\n' +
    '================================================================\n\n' +
    'Tu código personal para borrar tus respuestas:\n\n' +
    '    ' + codigo + '\n\n' +
    'Guárdalo. Es la única forma de solicitar el borrado de tus respuestas,\n' +
    'ya que el cuestionario no guarda ningún dato que te identifique.\n\n' +
    'Para borrarlas: ve a la página de borrado de la aplicación (/borrar.html)\n' +
    'o escribe a rteva@upo.es indicando este código.\n';
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'codigo-borrado-IA-OPOSDEP.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Entrada al sorteo (opcional).
document.getElementById('form-sorteo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('sorteo-msg');
  const email = document.getElementById('sorteo-email').value.trim();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  msg.classList.add('hidden');

  try {
    const res = await fetch('/api/sorteo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ticket: ticketSorteo })
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo registrar.');
    // Sustituye el formulario por la confirmación.
    document.getElementById('form-sorteo').classList.add('hidden');
    msg.textContent = '¡Listo! Estás dentro del sorteo. Si resultas ganador/a te avisaremos por email.';
    msg.className = 'sorteo-msg ok';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'sorteo-msg error';
    btn.disabled = false;
    btn.textContent = 'Entrar en el sorteo';
  }
});
