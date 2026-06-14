// utils/toast.js - 增强 Toast
let _activeToasts = [];

function show(opts) {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  if (!page || !page.setData) return;

  const id = Date.now() + Math.random();
  const data = { id, ...opts, _visible: true };
  const list = [...(_activeToasts || []), data];
  _activeToasts = list;
  page.setData({ toasts: list });

  setTimeout(() => {
    _activeToasts = list.filter(t => t.id !== id);
    page.setData({ toasts: _activeToasts });
  }, opts.duration || 2000);
}

module.exports = {
  success: (title, duration) => show({ type: 'success', title, icon: '✓', duration }),
  error: (title, duration) => show({ type: 'error', title, icon: '✕', duration: duration || 2500 }),
  warning: (title, duration) => show({ type: 'warning', title, icon: '⚠', duration }),
  info: (title, duration) => show({ type: 'info', title, icon: 'ℹ', duration }),
  show
};
