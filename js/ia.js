// Asistente IA: voz o texto -> API (la clave de OpenAI vive en el servidor) -> secuencia que se ejecuta como una DEMO temporal.
import { api } from './api.js';
import { stop } from './controls.js';
import { send, onEvent } from './socket.js';

const $ = id => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const SUGERENCIAS = ['Actúa de manera coqueta', 'Haz un baile', 'Saluda', 'Muévete en zigzag', 'Actúa como un robot enojado'];
let rec = null, escuchando = false, enviando = false, paso = -1, plan = [];

const say = (t, cls = '') => { $('iaSay').textContent = t; $('iaSay').className = `ia-say ${cls}`; };
const busy = v => { $('micBtn').disabled = v; $('iaText').disabled = v; $('iaForm').querySelector('button').disabled = v; $('iaChips').querySelectorAll('button').forEach(b => { b.disabled = v; }); };

function renderPasos() {
  $('iaSteps').replaceChildren(...plan.map((p, i) => {
    const li = document.createElement('li');
    li.textContent = `${String(p.comando).replace(/_/g, ' ')} · ${p.duracion_ms} ms`;
    if (i === paso) li.className = 'on';
    return li;
  }));
}

export async function enviar(texto) {
  texto = texto.trim();
  if (!texto || enviando) return;
  $('iaText').value = texto;
  if (/^(alto|para|detente|detener|stop|basta)\b/i.test(texto)) { send('CANCELAR'); stop(); say('Detenido.', 'ok'); return; }   // seguridad: sin IA ni espera
  enviando = true; busy(true); plan = []; paso = -1; renderPasos(); say('Pensando…');
  try {
    const r = await api.iaComando(texto);
    plan = r.pasos || []; renderPasos();
    say(r.mensaje || (plan.length ? 'Listo.' : 'No puedo hacer eso.'), plan.length ? 'ok' : '');
  } catch (e) { say(e.message, 'bad'); }
  finally { enviando = false; busy(false); }
}

function hablar() {
  if (!SR) return say('Tu navegador no admite reconocimiento de voz: usa Chrome o Edge, o escribe la orden.', 'bad');
  if (escuchando) return rec.stop();
  rec = new SR(); rec.lang = 'es-MX'; rec.interimResults = true; rec.maxAlternatives = 1;
  let final = '';
  rec.onstart = () => { escuchando = true; $('micBtn').setAttribute('aria-pressed', 'true'); say('Escuchando…'); };
  rec.onresult = e => {
    let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    $('iaText').value = t; if (e.results[e.results.length - 1].isFinal) final = t;
  };
  rec.onerror = e => say(e.error === 'not-allowed' ? 'Permite el micrófono para usar la voz.' : e.error === 'no-speech' ? 'No te escuché; inténtalo otra vez.' : `Error de voz: ${e.error}`, 'bad');
  rec.onend = () => { escuchando = false; $('micBtn').setAttribute('aria-pressed', 'false'); if (final) enviar(final); };
  rec.start();
}

export const leave = () => { if (rec && escuchando) rec.abort(); };   // al salir de la vista se apaga el micrófono

export function init() {
  $('iaChips').replaceChildren(...SUGERENCIAS.map(s => { const b = document.createElement('button'); b.type = 'button'; b.textContent = s; b.onclick = () => enviar(s); return b; }));
  $('iaForm').onsubmit = e => { e.preventDefault(); enviar($('iaText').value); };
  $('micBtn').onclick = hablar;
  $('iaStop').onclick = () => { leave(); send('CANCELAR'); stop(); say('Detenido.', 'ok'); };
  onEvent(ev => {   // resalta el paso en curso con los eventos reales de la secuencia
    if (!plan.length) return;
    if (ev.evento === 'INICIO_DEMO') paso = -1;
    else if (ev.evento === 'MOV_DEMO') paso++;
    else if (ev.evento === 'FIN_DEMO' || ev.evento === 'CANCELADO') { paso = -1; if (ev.evento === 'CANCELADO') say('Secuencia cancelada.'); }
    else return;
    renderPasos();
  });
}