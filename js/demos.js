import { api } from './api.js';
import { send, onEvent } from './socket.js';
import { setDemoRunning } from './controls.js';

const $ = id => document.getElementById(id);
const msg = t => { $('msg').textContent = t; };
const SEGMENTS = 20;
let list = [], idx = 0, turns = 0, total = 0, step = 0, starting = false, tipTimer, wheelAcc = 0;

const locked = () => $('dial').parentElement.classList.contains('off');

// LED horizontal de progreso
function leds(p) {
  const on = Math.round(p / 100 * SEGMENTS);
  $('ledBar').querySelectorAll('i').forEach((l, i) => l.classList.toggle('on', i < on));
  $('ledBar').setAttribute('aria-valuenow', Math.round(p));
}

function ui(running) {
  setDemoRunning(running);
  $('demoRun').disabled = running || starting || !list.length;
  $('demoCancel').disabled = !running;
  $('dial').parentElement.classList.toggle('off', running);
}

function tip(text) {   // el nombre aparece un momento y se desvanece
  const t = $('dialTip'); t.textContent = text; t.classList.add('show');
  clearTimeout(tipTimer); tipTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function render(showTip) {
  const d = list[idx];
  $('dialNum').textContent = d ? d.id_demo : '–';
  $('dialRing').style.transform = `rotate(${turns * 30}deg)`;
  $('dial').setAttribute('aria-valuenow', d ? d.id_demo : 0);
  $('dial').setAttribute('aria-valuetext', d ? `DEMO ${d.id_demo}: ${d.nombre}` : 'Sin DEMO');
  if (showTip && d) tip(d.nombre);
}

function shift(n) {
  if (!list.length || locked()) return;
  idx = (idx + n + list.length) % list.length; turns += n; render(true);
}

async function run() {
  const d = list[idx];
  if (!d || starting) return;
  starting = true; ui(false); msg(`Solicitando DEMO ${d.id_demo}: ${d.nombre}…`);
  setTimeout(() => { if (starting) { starting = false; ui(false); msg('No llegó el evento de inicio por WebSocket'); } }, 8000);
  try { await api.iniciarDemo(d.id_demo); msg(`DEMO ${d.id_demo}: aceptada por la API · esperando evento…`); }
  catch (e) { starting = false; ui(false); msg(e.message); }
}

function setupDial() {
  const dial = $('dial');
  $('dialPrev').onclick = () => shift(-1);
  $('dialNext').onclick = () => shift(1);
  dial.addEventListener('wheel', e => {   // rueda del ratón
    e.preventDefault(); wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) >= 60) { shift(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
  }, { passive: false });
  let startY = null;   // arrastrar hacia arriba = siguiente (como desplazar una rueda)
  dial.addEventListener('pointerdown', e => { startY = e.clientY; dial.setPointerCapture(e.pointerId); });
  dial.addEventListener('pointermove', e => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) >= 26) { shift(dy < 0 ? 1 : -1); startY = e.clientY; }
  });
  ['pointerup', 'pointercancel'].forEach(t => dial.addEventListener(t, () => { startY = null; }));
  dial.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); shift(1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); shift(-1); }
  });
}

export async function initDemos() {
  $('ledBar').replaceChildren(...Array.from({ length: SEGMENTS }, () => document.createElement('i')));
  setupDial();
  $('demoRun').onclick = run;
  $('demoCancel').onclick = () => { if (!send('CANCELAR')) msg('Sin WebSocket: no se puede cancelar desde aquí'); };

  onEvent(ev => {
    switch (ev.evento) {
      case 'INICIO_DEMO': total = ev.total; step = 0; starting = false; leds(0); ui(true); msg(`DEMO iniciada · ${total} movimientos`); break;
      case 'MOV_DEMO': step++; leds(step / total * 100); msg(`Paso ${step}/${total}: ${ev.comando} · ${ev.duracion_ms} ms`); break;
      case 'FIN_DEMO': leds(100); ui(false); msg('DEMO finalizada'); break;
      case 'CANCELADO': leds(0); ui(false); msg('DEMO cancelada'); break;
    }
  });

  try {   // solo consulta: el CRUD de DEMO es de Administración
    list = (await api.demos()).filter(d => d.activo).sort((a, b) => a.id_demo - b.id_demo);
  } catch (e) { msg(e.message); }
  ui(false); render(true);
}