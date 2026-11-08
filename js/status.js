import { CONFIG } from './config.js';
import { check, probe } from './api.js';
import { onState } from './socket.js';

const OK = ['ok', 'bi-check-circle-fill'], BAD = ['bad', 'bi-x-circle-fill'], WAIT = ['warn', 'bi-arrow-repeat'];
const VIEW = {
  ws:  { online: [...OK, 'En línea'], connecting: [...WAIT, 'Conectando…'], reconnecting: [...WAIT, 'Reconectando…'], offline: [...BAD, 'Desconectado'] },
  api: { ok: [...OK, 'Disponible'], checking: [...WAIT, 'Comprobando…'], down: [...BAD, 'No disponible'] },
  db:  { ok: [...OK, 'Disponible'], down: [...BAD, 'No disponible'], unknown: ['unk', 'bi-question-circle-fill', 'Sin verificar'] },
};

function show(key, state) {
  const [cls, icon, text] = VIEW[key][state];
  const el = document.getElementById(`st-${key}`);
  el.className = `chip ${cls}`;
  el.querySelector('i').className = `bi ${icon}`;
  el.querySelector('.txt').textContent = text;
}

export function initStatus() {
  onState(s => show('ws', s));
  show('db', 'unknown');
  document.getElementById('st-db').title = CONFIG.DB_READY_URL ? 'Diagnóstico de dependencias del backend'
    : 'Verificación indirecta: consulta de solo lectura que ejecuta un procedimiento almacenado en RDS';
  let first = true;
  const poll = async () => {
    if (first) { show('api', 'checking'); first = false; }
    const up = await check(CONFIG.HEALTH_URL);
    show('api', up ? 'ok' : 'down');
    // RDS se marca solo con evidencia real; si la API no responde, no se le atribuye la caída a RDS
    if (!up) return show('db', 'unknown');
    if (CONFIG.DB_READY_URL) return show('db', (await check(CONFIG.DB_READY_URL)) ? 'ok' : 'down');
    const code = await probe(CONFIG.DB_PROBE_URL);   // 2xx: RDS respondió · 5xx: la consulta a RDS falló · otro: sin evidencia
    show('db', code >= 200 && code < 300 ? 'ok' : code >= 500 ? 'down' : 'unknown');
  };
  poll(); setInterval(poll, CONFIG.HEALTH_EVERY_MS);
}