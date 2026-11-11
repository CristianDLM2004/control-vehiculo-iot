// Lógica ÚNICA de envío de comandos (palancas y botones). DETENER tiene prioridad sobre todo.
import { api } from './api.js';
import { send as wsSend, onEvent } from './socket.js';

const $ = id => document.getElementById(id);
let byName = new Map(), byId = new Map();
const held = { left: null, right: null };   // comando mantenido por cada palanca
let gen = 0, chain = Promise.resolve(), demoRunning = false;

function mark(name, state) {   // refleja solicitado / aceptado / recibido / error en palancas y botones
  document.querySelectorAll('[data-cmd]').forEach(e => { if (e.dataset.cmd === name) e.dataset.state = state; });
}
function say(text, cls = '') { const m = $('msg'); m.textContent = text; m.className = `msg ${cls}`; }

export function setCatalog(list) {
  const act = list.filter(c => c.activo !== 0 && c.activo !== false);
  byName = new Map(act.map(c => [c.nombre, c])); byId = new Map(act.map(c => [c.id_comando, c]));
  document.querySelectorAll('[data-cmd]').forEach(e => {
    const ok = byName.has(e.dataset.cmd);
    e.classList.toggle('na', !ok);
    if (e.tagName === 'BUTTON') e.disabled = !ok;
  });
}

async function post(name, g) {
  const cmd = byName.get(name);
  if (!cmd) return say(`${name}: no existe en el catálogo del vehículo`, 'bad');
  mark(name, 'sending'); say(`${name}: solicitado…`);
  try {
    await api.mover(cmd.id_comando);
    if (g === gen) { mark(name, 'accepted'); say(`${name}: aceptado por la API · esperando evento…`); }
    else mark(name, 'idle');   // respuesta tardía de algo anterior a un DETENER: no se reactiva nada
  } catch (e) { mark(name, 'error'); say(`${name}: ${e.message}`, 'bad'); }
}

// Los comandos se envían en orden (cola); DETENER salta la cola y descarta lo pendiente.
const enqueue = name => { const g = gen; chain = chain.then(() => (g === gen ? post(name, g) : null)); };

export function setDemoRunning(v) { demoRunning = v; document.body.classList.toggle('demo-running', v); }

export async function stop() {
  gen++; held.left = held.right = null;
  if (demoRunning) wsSend('CANCELAR');
  await post('DETENER', gen);
}

export const press = name => { if (!demoRunning) enqueue(name); };   // LUZ, SONIDO

export function joy(side, name) {
  if (demoRunning) return;
  const other = side === 'left' ? 'right' : 'left';
  held[side] = name;
  if (name) return enqueue(name);          // nueva dirección: se envía el comando efectivo
  gen++;                                   // soltó o volvió al neutro: DETENER...
  const resume = held[other];
  post('DETENER', gen).then(() => { if (resume && held[other] === resume) enqueue(resume); }); // ...y retoma la otra palanca si sigue presionada
}

onEvent(ev => {
  if (ev.evento !== 'MOV_INDIVIDUAL') return;
  const c = byId.get(ev.id_comando); if (!c) return;
  mark(c.nombre, 'received'); say(`${c.nombre}: evento recibido por WebSocket`, 'ok');
  setTimeout(() => mark(c.nombre, 'idle'), 1200);
});

export const commandById = id => byId.get(id);   // lo usa MONITOREO para nombrar eventos