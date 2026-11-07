import { api } from './api.js';
import { send, onEvent } from './socket.js';
import { setDemoRunning } from './controls.js';

const $ = id => document.getElementById(id);
const msg = t => { $('demoMsg').textContent = t; };
let total = 0, step = 0, starting = false, list = [];
const bar = p => { $('demoBar').style.width = `${p}%`; };
const desc = () => { const d = list.find(x => String(x.id_demo) === $('demoSel').value); $('demoDesc').textContent = d ? (d.descripcion || '') : ''; };

function ui(running) {
  setDemoRunning(running);
  $('demoRun').disabled = running || starting;
  $('demoCancel').disabled = !running;
  $('demoSel').disabled = running;
}

async function run() {
  const id = $('demoSel').value;
  if (!id || starting) return;
  starting = true; ui(false); msg('Solicitando inicio…');
  setTimeout(() => { if (starting) { starting = false; ui(false); msg('No llegó el evento de inicio por WebSocket'); } }, 8000);
  try { await api.iniciarDemo(id); msg('Aceptada por la API · esperando evento…'); }
  catch (e) { starting = false; ui(false); msg(e.message); }
}

export async function initDemos() {
  const sel = $('demoSel');
  try {
    const demos = list = (await api.demos()).filter(d => d.activo);   // solo consulta: el CRUD de DEMO es de Administración
    sel.replaceChildren(...(demos.length ? demos.map(d => new Option(d.nombre, d.id_demo)) : [new Option('(sin DEMO disponibles)', '')]));
  } catch (e) { sel.replaceChildren(new Option('No se pudieron cargar', '')); msg(e.message); }

  $('demoSel').onchange = desc; desc();
  $('demoRun').onclick = run;
  $('demoCancel').onclick = () => { if (!send('CANCELAR')) msg('Sin WebSocket: no se puede cancelar desde aquí'); };

  onEvent(ev => {
    switch (ev.evento) {
      case 'INICIO_DEMO': total = ev.total; step = 0; starting = false; bar(0); ui(true); msg(`DEMO iniciada · ${total} movimientos`); break;
      case 'MOV_DEMO': step++; bar(Math.round(step / total * 100)); msg(`Paso ${step}/${total}: ${ev.comando} · ${ev.duracion_ms} ms (pausa ${ev.pausa_ms} ms)`); break;
      case 'FIN_DEMO': bar(100); ui(false); msg('DEMO finalizada'); break;
      case 'CANCELADO': bar(0); ui(false); msg('DEMO cancelada'); break;
    }
  });
}