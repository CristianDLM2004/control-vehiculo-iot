// Control por gestos fijos con la cámara (MediaPipe Hand Landmarker: corre en el navegador, sin claves ni servidor).
//  ORUGAS (palanca izquierda): mano señalando con el índice o el pulgar -> ↑ avanzar · ↓ retroceder · → derecha · ← izquierda
//  CABINA/BRAZO (palanca derecha): palma abierta fuera del cuadro central -> ↑ subir brazo · ↓ bajar · → cabina der. · ← cabina izq.
//  Puño, mano fuera de cuadro o sin manos: se suelta y se manda DETENER. Se pueden usar las dos manos a la vez.
import { joy, stop, press, getAux } from './controls.js';
import { send } from './socket.js';

const $ = id => document.getElementById(id);
const BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision';
const MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const TRACKS = { up: 'AVANZAR', down: 'RETROCEDER', right: 'DERECHA', left: 'IZQUIERDA' };
const ARM = { up: 'SUBIR_BRAZO', down: 'BAJAR_BRAZO', right: 'GIRAR_DERECHA', left: 'GIRAR_IZQUIERDA' };
const GUIA = { SUBIR_BRAZO: '.g-up', BAJAR_BRAZO: '.g-down', GIRAR_IZQUIERDA: '.g-left', GIRAR_DERECHA: '.g-right' };
const ZONA = 0.2;                 // medio lado del cuadro neutral (proporción del encuadre)
const ACTIVAR = 3, SOLTAR = 8;    // cuadros seguidos para activar un gesto / para soltarlo (~0.1 s / ~0.25 s)
const COLORES = { point: '#f39c12', thumb: '#f39c12', open: '#2ecc71', victory: '#3498db', horns: '#9b59b6' };
const AUXG = { victory: 'LUZ', horns: 'SONIDO' };   // ✌ alterna la luz · 🤘 alterna el sonido
let landmarker = null, stream = null, raf = 0, running = false, lastT = -1, camId = '';
try { camId = localStorage.getItem('camId') || ''; } catch { /* sin almacenamiento */ }
const roles = { tracks: { side: 'left', active: null, cand: null, n: 0 }, arm: { side: 'right', active: null, cand: null, n: 0 } };

const say = (t, bad = false) => { $('gesSay').textContent = t; $('gesSay').className = `ia-say${bad ? ' bad' : ''}`; };
const nombre = c => (c ? c.replace(/_/g, ' ') : '—');
function pintar() {
  $('gesTracks').textContent = `Orugas: ${nombre(roles.tracks.active)}`; $('gesTracks').classList.toggle('on', !!roles.tracks.active);
  $('gesArm').textContent = `Cabina/brazo: ${nombre(roles.arm.active)}`; $('gesArm').classList.toggle('on', !!roles.arm.active);
  document.querySelectorAll('.cam-guide > span').forEach(s => s.classList.remove('on'));   // resalta la zona que estás usando
  const g = GUIA[roles.arm.active]; if (g) document.querySelector(`.cam-guide ${g}`).classList.add('on');
}

// ---- Reconocimiento de la pose y la dirección (coordenadas espejadas: lo que ves en pantalla) ----
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ext = (lm, tip, pip) => dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.1;   // dedo extendido
function pose(lm) {
  const i = ext(lm, 8, 6), m = ext(lm, 12, 10), r = ext(lm, 16, 14), p = ext(lm, 20, 18);
  const t = dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.1;
  if (i && m && r && p) return 'open';                        // palma abierta
  if (i && m && !r && !p) return 'victory';                  // ✌ luz
  if (i && p && !m && !r) return 'horns';                    // 🤘 sonido
  if (i && !m && !r && !p) return 'point';                    // índice señalando
  if (t && !i && !m && !r && !p) return 'thumb';              // pulgar señalando
  return null;                                                // puño u otro gesto: neutro
}
const dir4 = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
function dirDedo(lm, tipo) {
  const [a, b] = tipo === 'thumb' ? [2, 4] : [5, 8];
  const dx = -(lm[b].x - lm[a].x), dy = lm[b].y - lm[a].y;
  return Math.hypot(dx, dy) < 0.04 ? null : dir4(dx, dy);
}
function dirPalma(lm) {
  const dx = (1 - lm[9].x) - 0.5, dy = lm[9].y - 0.5;
  return Math.max(Math.abs(dx), Math.abs(dy)) < ZONA ? null : dir4(dx, dy);
}

// Luz y sonido: el gesto sostenido ~0.3 s da UN toque; hay que soltarlo para repetirlo
const auxG = { LUZ: { n: 0, miss: 0, fired: false }, SONIDO: { n: 0, miss: 0, fired: false } };
function feedAux(vistos) {
  Object.keys(auxG).forEach(nombre => {
    const a = auxG[nombre];
    if (vistos.has(nombre)) {
      a.miss = 0; a.n++;
      if (a.n >= 8 && !a.fired) { a.fired = true; press(nombre); say(`${nombre === 'LUZ' ? '✌ Luz' : '🤘 Sonido'} alternado.`); }
    } else if (++a.miss >= 6) { a.n = 0; a.fired = false; }
  });
}

// Un gesto debe mantenerse unos cuadros para activarse y desaparecer unos cuadros para soltarse (evita parpadeos)
function feed(rol, cmd) {
  const r = roles[rol];
  if (cmd === r.active) { r.cand = null; r.n = 0; return; }
  r.n = cmd === r.cand ? r.n + 1 : 1; r.cand = cmd;
  if (r.n >= (cmd ? ACTIVAR : SOLTAR)) { r.active = cmd; r.cand = null; r.n = 0; joy(r.side, cmd); pintar(); }   // misma lógica que las palancas
}

function dibujar(manos, poses) {   // solo puntos de la mano; la guía (cuadro y flechas) es HTML encima del video
  const c = $('camCanvas'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  manos.forEach((lm, i) => { g.fillStyle = COLORES[poses[i]] || '#888'; lm.forEach(p => { g.beginPath(); g.arc(p.x * W, p.y * H, 4, 0, 7); g.fill(); }); });
}

function procesar(res) {
  const manos = res.landmarks || [], poses = manos.map(pose);
  let tracks = null, arm = null;
  manos.forEach((lm, i) => {
    if (poses[i] === 'open' && arm === null) arm = dirPalma(lm);
    else if ((poses[i] === 'point' || poses[i] === 'thumb') && tracks === null) tracks = dirDedo(lm, poses[i]);
  });
  feed('tracks', tracks ? TRACKS[tracks] : null);
  feed('arm', arm ? ARM[arm] : null);
  feedAux(new Set(poses.map(p => AUXG[p]).filter(Boolean)));
  dibujar(manos, poses);
}

// ---- Modelo y cámara ----
async function cargarModelo() {
  if (landmarker) return;
  say('Cargando el modelo de manos…');
  const { FilesetResolver, HandLandmarker } = await import(`${BASE}/vision_bundle.mjs`);
  const vision = await FilesetResolver.forVisionTasks(`${BASE}@latest/wasm`);
  const opts = delegate => ({ baseOptions: { modelAssetPath: MODELO, delegate }, runningMode: 'VIDEO', numHands: 2 });
  try { landmarker = await HandLandmarker.createFromOptions(vision, opts('GPU')); }
  catch { landmarker = await HandLandmarker.createFromOptions(vision, opts('CPU')); }
}

async function listarCamaras() {   // los nombres solo están disponibles después de dar permiso a la cámara
  const sel = $('camSel');
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  if (!cams.length) return;
  const track = stream && stream.getVideoTracks()[0];
  const actual = track ? track.getSettings().deviceId : camId;
  sel.replaceChildren(...cams.map((d, i) => new Option(d.label || `Cámara ${i + 1}`, d.deviceId)));
  if (cams.some(d => d.deviceId === actual)) sel.value = actual;
}

async function abrirCamara() {   // abre (o cambia) la cámara elegida sin detener el reconocimiento
  if (stream) stream.getTracks().forEach(t => t.stop());
  const base = { width: { ideal: 640 }, height: { ideal: 480 } };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: camId ? { ...base, deviceId: { exact: camId } } : { ...base, facingMode: 'user' }, audio: false });
  } catch (e) {
    if (!camId || !['OverconstrainedError', 'NotFoundError'].includes(e.name)) throw e;
    camId = '';   // la cámara guardada ya no existe: se usa la predeterminada
    stream = await navigator.mediaDevices.getUserMedia({ video: { ...base, facingMode: 'user' }, audio: false });
  }
  const v = $('camVideo'); v.srcObject = stream; await v.play();
  $('camCanvas').width = v.videoWidth; $('camCanvas').height = v.videoHeight;
  $('camWrap').style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;   // la guía coincide exactamente con la imagen
  lastT = -1;
  await listarCamaras();
}

function bucle() {
  if (!running) return;
  const v = $('camVideo');
  if (v.readyState >= 2 && v.currentTime !== lastT) {
    lastT = v.currentTime;
    try { procesar(landmarker.detectForVideo(v, performance.now())); }
    catch (e) { say(`Error del reconocimiento: ${e.message}`, true); parar(); return; }
  }
  raf = requestAnimationFrame(bucle);
}

async function iniciar() {
  const btn = $('camBtn'); btn.disabled = true;
  try {
    await cargarModelo();
    $('camWrap').hidden = false;
    await abrirCamara();
    running = true; btn.textContent = 'Apagar cámara';
    say('Cámara activa: señala con el índice o el pulgar (orugas) y usa la palma abierta (cabina y brazo).');
    bucle();
  } catch (e) {
    say(e.name === 'NotAllowedError' ? 'Permite el acceso a la cámara.' : e.name === 'NotFoundError' ? 'No se encontró una cámara.' : `No se pudo iniciar: ${e.message}`, true);
    parar();
  } finally { btn.disabled = false; }
}

export function parar() {   // apaga la cámara, suelta todo y manda DETENER si había un gesto activo
  running = false; cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; $('camVideo').srcObject = null; $('camWrap').hidden = true; $('camBtn').textContent = 'Activar cámara';
  const habia = roles.tracks.active || roles.arm.active;
  Object.values(roles).forEach(r => { r.active = r.cand = null; r.n = 0; });
    Object.values(auxG).forEach(a => { a.n = a.miss = 0; a.fired = false; });
  if (habia) stop();
  pintar();
}

export const leave = parar;

export function init() {
    const pintarAux = a => {   // chips con el estado actual de luz y sonido
    $('gesLuz').textContent = `Luz ✌: ${a.LUZ ? 'ON' : 'OFF'}`; $('gesLuz').classList.toggle('on', a.LUZ);
    $('gesSonido').textContent = `Sonido 🤘: ${a.SONIDO ? 'ON' : 'OFF'}`; $('gesSonido').classList.toggle('on', a.SONIDO);
  };
  pintarAux(getAux()); document.addEventListener('aux', e => pintarAux(e.detail));
  const z = $('camZone');   // cuadro neutral con el mismo tamaño que usa el reconocimiento
  z.style.cssText = `left:${(0.5 - ZONA) * 100}%;top:${(0.5 - ZONA) * 100}%;width:${ZONA * 200}%;height:${ZONA * 200}%`;
  $('camSel').replaceChildren(new Option('Cámara predeterminada', ''));
  $('camSel').onchange = async e => {
    camId = e.target.value;
    try { localStorage.setItem('camId', camId); } catch { /* sin almacenamiento */ }
    if (running) { try { await abrirCamara(); } catch (err) { say(`No se pudo cambiar de cámara: ${err.message}`, true); } }
  };
  navigator.mediaDevices.addEventListener('devicechange', () => { if (running) listarCamaras(); });
  $('camBtn').onclick = () => (running ? parar() : iniciar());
  $('gesStop').onclick = () => { Object.values(roles).forEach(r => { r.active = r.cand = null; r.n = 0; }); pintar(); send('CANCELAR'); stop(); say('Detenido.'); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); });   // si la pestaña se oculta, se apaga todo
}