import { CONFIG } from './config.js';
const V = `/vehiculos/${CONFIG.VEHICLE_ID}`;

export class ApiError extends Error {}

async function request(path, { method = 'GET', body, timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(CONFIG.API_BASE + path, {
      method, signal: ctrl.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(({ 409: 'Ya hay una DEMO o secuencia en curso', 429: 'Demasiadas solicitudes: espera unos segundos', 502: 'La IA no respondió' })[res.status] || `La API respondió ${res.status}`);
    try { return await res.json(); } catch { throw new ApiError('Respuesta no válida de la API'); }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Sin conexión con la API');
  } finally { clearTimeout(timer); }
}

export const api = {
  vehiculo: () => request(V),
  comandos: () => request(`${V}/comandos`),
  demos: () => request(`${V}/demos`),
  mover: id_comando => request(`${V}/movimientos`, { method: 'POST',
    body: { id_vehiculo: CONFIG.VEHICLE_ID, id_comando, conectado: true, origen: 'WEB_GUI' } }),
  iniciarDemo: id => request(`${V}/demos/${id}/iniciar`, { method: 'POST' }),
  iaComando: (texto, estado = {}) => request(`${V}/ia/comando`, { method: 'POST', body: { texto, ...estado }, timeout: 25000 }),  estado: () => request(`${V}/estado`),
  historial: () => request(`${V}/historial`),
};

// Comprobación simple de disponibilidad (true/false) con timeout
export async function check(url, timeout = 4000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout);
  try { return (await fetch(url, { cache: 'no-store', signal: ctrl.signal })).ok; }
  catch { return false; } finally { clearTimeout(t); }
}

// Devuelve el código HTTP, o 0 si no hubo respuesta (red caída o tiempo agotado)
export async function probe(url, timeout = 5000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout);
  try { return (await fetch(url, { cache: 'no-store', signal: ctrl.signal })).status; }
  catch { return 0; } finally { clearTimeout(t); }
}