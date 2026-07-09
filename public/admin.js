'use strict';

let token = null;

const loginSection = document.getElementById('login');
const panelSection = document.getElementById('panel');
const loginError = document.getElementById('login-error');

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No autorizado.');
    token = json.token;
    loginSection.classList.add('hidden');
    panelSection.classList.remove('hidden');
    await cargarStats();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await fetch('/api/admin/logout', { method: 'POST', headers: { 'x-admin-token': token } }); } catch (_) {}
  token = null;
  panelSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
  document.getElementById('password').value = '';
});

document.getElementById('btn-refresh').addEventListener('click', cargarStats);

async function descargar(ruta, nombre) {
  const res = await fetch(ruta, { headers: { 'x-admin-token': token } });
  if (!res.ok) { alert('No se pudo exportar (¿sesión caducada?).'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('btn-export').addEventListener('click', () =>
  descargar('/api/admin/export', 'respuestas.csv'));

document.getElementById('btn-export-sorteo').addEventListener('click', () =>
  descargar('/api/admin/sorteo-export', 'sorteo_emails.csv'));

async function cargarStats() {
  const res = await fetch('/api/admin/stats', { headers: { 'x-admin-token': token } });
  if (!res.ok) {
    token = null;
    panelSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    loginError.textContent = 'Sesión caducada, vuelve a entrar.';
    loginError.classList.remove('hidden');
    return;
  }
  const stats = await res.json();

  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-rapidas').textContent = stats.rapidas;
  document.getElementById('stat-sorteo').textContent = stats.sorteo ? stats.sorteo.participantes : '—';
  document.getElementById('stat-ultima').textContent = stats.ultima
    ? new Date(stats.ultima).toLocaleString('es-ES')
    : '—';

  pintarDistribuciones(stats.distribuciones, stats.total);
  pintarLikert(stats.likertMedias);
}

function pintarDistribuciones(dist, total) {
  const cont = document.getElementById('distribuciones');
  cont.innerHTML = '';
  const items = Object.values(dist).sort((a, b) => a.num - b.num);
  for (const item of items) {
    const bloque = document.createElement('div');
    bloque.className = 'dist-item';
    const h = document.createElement('h3');
    h.textContent = `${item.num}. ${item.label}`;
    bloque.appendChild(h);

    for (const [opcion, n] of Object.entries(item.conteo)) {
      const pct = total ? Math.round((n / total) * 100) : 0;
      const fila = document.createElement('div');
      fila.className = 'barra-fila';
      fila.innerHTML =
        `<span class="barra-label">${opcion}</span>` +
        `<span class="barra-track"><span class="barra-fill" style="width:${pct}%"></span></span>` +
        `<span class="barra-val">${n} (${pct}%)</span>`;
      bloque.appendChild(fila);
    }
    cont.appendChild(bloque);
  }
}

function pintarLikert(medias) {
  const cont = document.getElementById('likert');
  cont.innerHTML = '';
  const items = Object.entries(medias).sort((a, b) => a[1].num - b[1].num);
  for (const [code, info] of items) {
    const pct = info.media != null ? ((info.media - 1) / 4) * 100 : 0;
    const fila = document.createElement('div');
    fila.className = 'barra-fila';
    const etiqueta = `${info.num}. ${code}${info.inverted ? ' (INV)' : ''}`;
    fila.innerHTML =
      `<span class="barra-label" title="${info.label}">${etiqueta}</span>` +
      `<span class="barra-track"><span class="barra-fill" style="width:${pct}%"></span></span>` +
      `<span class="barra-val">${info.media != null ? info.media.toFixed(2) : '—'} · n=${info.n}</span>`;
    cont.appendChild(fila);
  }
}
