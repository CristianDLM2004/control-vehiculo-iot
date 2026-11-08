import { CONFIG } from './config.js';
const subs = { state: [], event: [] };
let ws, retry = 0, timer;

export const onState = fn => subs.state.push(fn);
export const onEvent = fn => subs.event.push(fn);
const emit = (k, v) => subs[k].forEach(fn => fn(v));

export function connect() {
  clearTimeout(timer);
  emit('state', retry ? 'reconnecting' : 'connecting');
  try { ws = new WebSocket(CONFIG.WS_URL); }
  catch { emit('state', 'offline'); timer = setTimeout(connect, 10000); return; }   // URL inválida o bloqueada: la interfaz sigue funcionando
  ws.onopen = () => { retry = 0; emit('state', 'online'); };
  ws.onmessage = e => { try { emit('event', JSON.parse(e.data)); } catch { /* mensaje no JSON: se ignora */ } };
  ws.onclose = () => {   // al caer, sale de "En línea" de inmediato y reintenta con espera creciente
    retry++; emit('state', retry > 3 ? 'offline' : 'reconnecting');
    timer = setTimeout(connect, Math.min(1000 * 2 ** retry, 10000));
  };
}
export const send = text => (ws && ws.readyState === WebSocket.OPEN) ? (ws.send(text), true) : false;