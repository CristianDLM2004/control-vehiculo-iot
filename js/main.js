import { CONFIG } from './config.js';
import { api } from './api.js';
import { connect } from './socket.js';
import { initStatus } from './status.js';
import { createJoystick } from './joystick.js';
import * as controls from './controls.js';
import { initDemos } from './demos.js';
import { initRouter } from './router.js';
import * as monitor from './monitor.js';
import * as ia from './ia.js';
import * as gestos from './gestos.js';

const $ = id => document.getElementById(id);
// [comando del catálogo, etiqueta, icono] por dirección
const LEFT = { up: ['AVANZAR', 'Avanzar', 'bi-caret-up-fill'], down: ['RETROCEDER', 'Retroceder', 'bi-caret-down-fill'],
               left: ['IZQUIERDA', 'Izq.', 'bi-caret-left-fill'], right: ['DERECHA', 'Der.', 'bi-caret-right-fill'] };
const RIGHT = { up: ['SUBIR_BRAZO', 'Subir brazo', 'bi-caret-up-fill'], down: ['BAJAR_BRAZO', 'Bajar brazo', 'bi-caret-down-fill'],
                left: ['GIRAR_IZQUIERDA', 'Cab. izq.', 'bi-caret-left-fill'], right: ['GIRAR_DERECHA', 'Cab. der.', 'bi-caret-right-fill'] };

$('credits').textContent = `Desarrollado por ${CONFIG.OWNER} · ${CONFIG.YEAR}`;
initStatus();
monitor.init();
ia.init();
gestos.init();
// Sub-apartados de IA: solo uno visible; al salir de "Voz" se apaga el micrófono y al salir de "Gestos" la cámara
const sub = v => {
  $('ia-voz').hidden = v !== 'voz'; $('ia-gestos').hidden = v !== 'gestos';
  ['voz', 'gestos'].forEach(n => { $(`sub-${n}`).classList.toggle('active', n === v); $(`sub-${n}`).setAttribute('aria-selected', n === v); });
  if (v !== 'voz') ia.leave();
  if (v !== 'gestos') gestos.leave();
};
$('sub-voz').onclick = () => sub('voz');
$('sub-gestos').onclick = () => sub('gestos');
connect();

const sticks = [
  createJoystick($('joyL'), { title: 'Orugas', dirs: LEFT, onChange: n => controls.joy('left', n) }),
  createJoystick($('joyR'), { title: 'Cabina y brazo', dirs: RIGHT, onChange: n => controls.joy('right', n) }),
];
initRouter({ onChange: v => { if (v !== 'control') sticks.forEach(s => s.release()); if (v === 'monitoreo') monitor.enter(); if (v !== 'ia') { ia.leave(); gestos.leave(); } } });$('btnLight').onclick = () => controls.press('LUZ');
$('btnSound').onclick = () => controls.press('SONIDO');
$('btnStop').onclick = () => { sticks.forEach(s => s.release(true)); controls.stop(); };
window.addEventListener('blur', () => sticks.forEach(s => s.release()));   // perder el foco suelta las palancas (DETENER)

(async () => {
  try {
    const [v, cmds] = await Promise.all([api.vehiculo(), api.comandos()]);
    $('vehName').textContent = (v && v.nombre) || `Vehículo ${CONFIG.VEHICLE_ID}`;
    controls.setCatalog(cmds);
  } catch (e) { $('vehName').textContent = `Vehículo ${CONFIG.VEHICLE_ID}`; $('msg').textContent = e.message; }
  initDemos();
})();