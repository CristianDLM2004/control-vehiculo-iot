// Único punto de configuración. Al tener HTTPS en la API, cambia SOLO SERVER a https://...
// (el WebSocket pasa solo de ws:// a wss://). Desde GitHub Pages (HTTPS) un SERVER http:// será bloqueado.
const SERVER = 'https://controlcristian.duckdns.org';
const VEHICLE_ID = 1;

export const CONFIG = {
  VEHICLE_ID,
  API_BASE: `${SERVER}/api`,
  WS_URL: `${SERVER.replace(/^http/, 'ws')}/api/vehiculos/${VEHICLE_ID}/ws`,
  HEALTH_URL: `${SERVER}/openapi.json`, // ruta que FastAPI ya expone; no consulta la BD
  DB_READY_URL: null,                   // sin diagnóstico seguro de RDS autorizado → "Sin verificar"
  HEALTH_EVERY_MS: 15000,
  OWNER: 'Cristian David López Martínez',
  YEAR: 2026,
};