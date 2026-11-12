// Navegación CONTROL / MONITOREO dentro de la misma página (hash #control, #monitoreo). Una sola conexión WSS compartida.
const VIEWS = ['control', 'monitoreo', 'ia'];
const $ = id => document.getElementById(id);

export function initRouter({ onChange } = {}) {
  const show = () => {
    const h = location.hash.slice(1), v = VIEWS.includes(h) ? h : 'control';
    VIEWS.forEach(n => {
      $(`view-${n}`).hidden = n !== v;
      $(`tab-${n}`).classList.toggle('active', n === v);
      n === v ? $(`tab-${n}`).setAttribute('aria-current', 'page') : $(`tab-${n}`).removeAttribute('aria-current');
    });
    if (onChange) onChange(v);
  };
  addEventListener('hashchange', show);
  show();
}