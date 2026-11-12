// Único punto de configuración. Al tener HTTPS en la API, cambia SOLO SERVER a https://...
// (el WebSocket pasa solo de ws:// a wss://). Desde GitHub Pages (HTTPS) un SERVER http:// será bloqueado.
// Pruebas locales: abre Live Server con  ?api=local  (solo funciona desde localhost) para usar tu API en http://127.0.0.1:8000
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('api') === 'local';
const SERVER = LOCAL ? 'http://127.0.0.1:8000' : 'https://controlcristian.duckdns.org';
const VEHICLE_ID = 1;

export const CONFIG = {
  VEHICLE_ID,
  API_BASE: `${SERVER}/api`,
  WS_URL: `${SERVER.replace(/^http/, 'ws')}/api/vehiculos/${VEHICLE_ID}/ws`,
  HEALTH_URL: `${SERVER}/openapi.json`, // ruta que FastAPI ya expone; no consulta la BD
  DB_PROBE_URL: `${SERVER}/api/vehiculos/${VEHICLE_ID}/estado`, // consulta de solo lectura que ejecuta un procedimiento en RDS
  DB_READY_URL: null,                   // sin diagnóstico seguro de RDS autorizado → "Sin verificar"
  HEALTH_EVERY_MS: 15000,
  DB_TIMEZONE: 'UTC',                   // zona en la que la BD entrega las fechas (verifícala comparando con tu reloj)
  OWNER: 'Cristian David López Martínez',
  YEAR: 2026,
};