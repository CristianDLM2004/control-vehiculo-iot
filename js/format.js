import { CONFIG } from './config.js';

// La API entrega fechas SIN zona (p. ej. "2026-11-10T20:59:39"). CONFIG.DB_TIMEZONE indica en qué zona están
// ('UTC' o 'local'); siempre se muestran en la zona horaria del navegador. Nunca se inventan fechas.
export function parseDate(s) {
  if (!s) return null;
  const iso = String(s).replace(' ', 'T');
  const conZona = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(conZona || CONFIG.DB_TIMEZONE !== 'UTC' ? iso : `${iso}Z`);
  return isNaN(d) ? null : d;
}
const dFmt = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
const tFmt = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
export const fmtDate = d => d ? dFmt.format(d) : '—';
export const fmtTime = d => d ? tFmt.format(d) : '—';
export const zonaLocal = () => Intl.DateTimeFormat().resolvedOptions().timeZone;