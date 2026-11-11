// MONITOREO: último movimiento + tabla de 10 registros persistidos. REST = carga/recuperación; WSS = dispara la actualización.
import { api } from './api.js';
import { CONFIG } from './config.js';
import { onState, onEvent } from './socket.js';
import { commandById } from './controls.js';
import { parseDate, fmtDate, fmtTime, zonaLocal } from './format.js';

const $ = id => document.getElementById(id);
const pretty = s => String(s ?? '—').replace(/_/g, ' ');
const ICONS = { AVANZAR: 'bi-arrow-up-circle-fill', RETROCEDER: 'bi-arrow-down-circle-fill', IZQUIERDA: 'bi-arrow-left-circle-fill',
  DERECHA: 'bi-arrow-right-circle-fill', GIRAR_IZQUIERDA: 'bi-arrow-counterclockwise', GIRAR_DERECHA: 'bi-arrow-clockwise',
  SUBIR_BRAZO: 'bi-chevron-double-up', BAJAR_BRAZO: 'bi-chevron-double-down', LUZ: 'bi-lightbulb-fill', SONIDO: 'bi-volume-up-fill', DETENER: 'bi-stop-circle-fill' };

let online = false, last = null, pendingLive = false, estadoTs = null, estadoCmd = null, seen = null, rows = [], timers = [];
const seq = { estado: 0, hist: 0 };   // contadores para descartar respuestas HTTP atrasadas

function renderLast() {
  const l = last;
  $('lastName').textContent = l ? pretty(l.nombre) : 'Sin movimientos';
  $('lastIcon').className = `bi ${l && Object.hasOwn(ICONS, l.nombre) ? ICONS[l.nombre] : 'bi-activity'}`;
  $('lastVeh').textContent = (l && l.vehiculo) || $('vehName').textContent;
  $('lastDate').textContent = l ? fmtDate(l.fecha) : '—';
  $('lastTime').textContent = l ? fmtTime(l.fecha) : '—';
  $('lastCode').textContent = l && l.codigo != null ? l.codigo : '—';
  const src = !l ? 'Sin datos' : {
    rest: 'Dato de RDS · consulta REST',
    confirmed: 'Confirmado en RDS tras el evento WSS',
    live: `Evento WSS recibido (${fmtTime(l.recibido)} en este navegador) · pendiente de confirmar en RDS`,
    demo: `Paso de DEMO por WSS (${fmtTime(l.recibido)} en este navegador) · no entra al historial individual`,
    unconfirmed: 'Evento WSS sin confirmar en RDS',
  }[l.fuente];
  $('lastSrc').textContent = src + (online || !l ? '' : ' · sin conexión en vivo: último valor conocido');
}

function setHist(text, err = false) { $('histState').textContent = text; $('histState').className = `hist-state${err ? ' err' : ''}`; }

function renderRows() {
  const fresh = seen ? new Set(rows.filter(r => !seen.has(r.id_historial)).map(r => r.id_historial)) : new Set();
  $('histBody').replaceChildren(...rows.map((r, i) => {
    const d = parseDate(r.fecha_hora), tr = document.createElement('tr');
    if (fresh.has(r.id_historial)) tr.className = 'new';
    [i + 1, pretty(r.comando), fmtDate(d), fmtTime(d)].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.append(td); });
    return tr;
  }));
  seen = new Set(rows.map(r => r.id_historial));
}

async function loadEstado() {
  const n = ++seq.estado;
  try {
    const e = await api.estado();
    if (n !== seq.estado) return;   // respuesta atrasada: se descarta
    if (!e) { if (!pendingLive) { last = null; renderLast(); } return; }
    const changed = e.fecha_actualizacion !== estadoTs || e.comando !== estadoCmd;
    estadoTs = e.fecha_actualizacion; estadoCmd = e.comando;
    if (pendingLive && !changed) return;   // aún no se persiste el evento: se conserva el dato en vivo
    last = { nombre: e.comando, codigo: e.codigo, fecha: parseDate(e.fecha_actualizacion), fuente: pendingLive ? 'confirmed' : 'rest', vehiculo: e.vehiculo };
    pendingLive = false; renderLast();
  } catch { if (n === seq.estado && !last) $('lastName').textContent = 'Sin datos actualizados'; }
}

async function loadHistorial() {
  const n = ++seq.hist;
  try {
    const data = await api.historial();
    if (n !== seq.hist) return;
    const list = (Array.isArray(data && data.historial) ? data.historial : []).filter(r => r.id_vehiculo == null || r.id_vehiculo === CONFIG.VEHICLE_ID);
    rows = [...new Map(list.map(r => [r.id_historial, r])).values()].sort((a, b) => b.id_historial - a.id_historial).slice(0, 10); // sin duplicados, 10 máx.
    renderRows(); setHist(rows.length ? '' : 'Sin movimientos registrados');
  } catch (e) { if (n === seq.hist) setHist(rows.length ? `Datos no actualizados: ${e.message}` : `Error: ${e.message}`, true); }
}

const syncAll = () => Promise.all([loadEstado(), loadHistorial()]);

// El backend publica el evento ANTES de guardar en RDS: se confirma con 3 consultas acotadas (no es polling continuo).
function scheduleSync() {
  timers.forEach(clearTimeout);
  timers = [400, 1500, 3500].map((ms, i, a) => setTimeout(async () => {
    await syncAll();
    if (i === a.length - 1 && pendingLive) { pendingLive = false; if (last) { last.fuente = 'unconfirmed'; renderLast(); } }
  }, ms));
}

export const enter = () => syncAll();   // al abrir o volver a MONITOREO

export function init() {
  $('tzNote').textContent = `Horas en tu zona local (${zonaLocal()}). La API entrega las fechas sin zona; se interpretan como ${CONFIG.DB_TIMEZONE === 'UTC' ? 'UTC' : 'hora local'}.`;
  onState(s => {
    const was = online; online = s === 'online';
    $('liveTag').className = `live${online ? ' on' : ''}`;
    $('liveTag').textContent = online ? 'En vivo · WSS' : s === 'offline' ? 'Sin conexión en vivo' : 'Reconectando…';
    if (online && !was) syncAll();   // al (re)conectar se recupera por REST lo que se haya perdido
    if (last) renderLast();
  });
  onEvent(ev => {
    if (ev.id_vehiculo != null && ev.id_vehiculo !== CONFIG.VEHICLE_ID) return;   // evento de otro vehículo
    if (ev.evento === 'MOV_INDIVIDUAL') {
      const c = commandById(ev.id_comando);
      last = { nombre: c ? c.nombre : `Comando ${ev.id_comando}`, codigo: c ? c.codigo : null, fecha: null, recibido: new Date(), fuente: 'live' };
      pendingLive = true; renderLast(); scheduleSync();
    } else if (ev.evento === 'MOV_DEMO') {
      last = { nombre: ev.comando, codigo: null, fecha: null, recibido: new Date(), fuente: 'demo' };
      pendingLive = false; renderLast();
    } else if (ev.evento === 'FIN_DEMO' || ev.evento === 'CANCELADO') scheduleSync();
  });
}