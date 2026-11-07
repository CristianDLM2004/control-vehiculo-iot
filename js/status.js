import { CONFIG } from './config.js';
import { check } from './api.js';
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
  let first = true;
  const poll = async () => {
    if (first) { show('api', 'checking'); first = false; }
    const up = await check(CONFIG.HEALTH_URL);
    show('api', up ? 'ok' : 'down');
    // RDS solo se marca con un diagnóstico real del backend; si la API no responde, no se atribuye la caída a RDS
    if (CONFIG.DB_READY_URL) show('db', !up ? 'unknown' : (await check(CONFIG.DB_READY_URL)) ? 'ok' : 'down');
  };
  poll(); setInterval(poll, CONFIG.HEALTH_EVERY_MS);
}