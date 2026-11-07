// Palanca tipo "+": cada gesto elige UN eje; para cambiar de eje hay que volver al centro.
// onChange recibe el nombre del comando efectivo, o null en neutro.
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

export function createJoystick(root, { title, dirs, onChange }) {
  root.innerHTML = `<div class="joy-title">${title}</div><div class="joy-area">` +
    Object.entries(dirs).map(([d, [cmd, label, icon]]) =>
      `<div class="hint ${d}" data-cmd="${cmd}"><i class="bi ${icon}"></i><span>${label}</span></div>`).join('') +
    `<div class="joy-base"><div class="joy-stick" tabindex="0" role="application" aria-label="Palanca ${title}; usa las flechas del teclado"></div></div></div>`;
  const base = root.querySelector('.joy-base'), stick = root.querySelector('.joy-stick');
  let dragging = false, axis = null, dir = null;

  const lights = d => root.querySelectorAll('.hint').forEach(h => h.classList.toggle('on', !!d && h.dataset.cmd === dirs[d][0]));
  const set = d => { if (d === dir) return; dir = d; lights(d); onChange(d ? dirs[d][0] : null); };

  const move = e => {
    if (!dragging) return;
    const r = base.getBoundingClientRect(), MAX = r.width * 0.22, ON = MAX * 0.5, OFF = MAX * 0.3;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (!axis) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) >= ON && Math.max(ax, ay) > 1.4 * Math.min(ax, ay)) axis = ax > ay ? 'h' : 'v';
    }
    if (axis === 'h') dy = 0; else if (axis === 'v') dx = 0;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX) { dx *= MAX / dist; dy *= MAX / dist; }
    stick.style.transform = `translate(${dx}px,${dy}px)`;
    let d = null;
    if (axis) {
      const v = axis === 'h' ? dx : dy, a = Math.abs(v);
      if (a >= ON || (dir && a >= OFF)) d = axis === 'h' ? (v > 0 ? 'right' : 'left') : (v > 0 ? 'down' : 'up');
      else axis = null;
    }
    set(d);
  };
  // silent=true: reinicia la palanca sin avisar (lo usa el botón DETENER, que ya manda su propia orden)
  const release = (silent = false) => {
    dragging = false; axis = null; stick.classList.remove('drag'); stick.style.transform = '';
    if (silent) { dir = null; lights(null); } else set(null);
  };

  stick.addEventListener('pointerdown', e => { dragging = true; stick.setPointerCapture(e.pointerId); stick.classList.add('drag'); move(e); });
  stick.addEventListener('pointermove', move);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => stick.addEventListener(t, () => release()));
  stick.addEventListener('keydown', e => { const d = KEYS[e.key]; if (d) { e.preventDefault(); set(d); } });
  stick.addEventListener('keyup', e => { if (KEYS[e.key]) set(null); });
  stick.addEventListener('blur', () => release());
  return { release };
}