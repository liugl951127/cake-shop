// admin-h5/js/app.js
// 全局 App 工具(挂到 window.App)
//   - toast 提示
//   - modal 模态框
//   - confirm 确认框
//   - format* 格式化
//   - form 序列化
//   - 时间格式
//   - 主题切换

(function (global) {

  // ====== Toast ======
  const toast = (function () {
    function show(msg, type = 'info', duration = 2500) {
      const div = document.createElement('div');
      div.className = 'toast ' + type;
      const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ⓘ' };
      div.innerHTML = `<span style="font-weight:600">${icons[type] || ''}</span><span>${msg}</span>`;
      document.body.appendChild(div);
      setTimeout(() => {
        div.style.transition = 'all 0.2s';
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 200);
      }, duration);
    }
    return {
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error', 3500),
      warning: (m) => show(m, 'warning'),
      info: (m) => show(m, 'info')
    };
  })();

  // ====== Modal ======
  function modal({ title = '提示', body = '', footer = '', size = '', onClose }) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    let sizeClass = '';
    if (size === 'lg') sizeClass = ' modal-lg';
    else if (size === 'xl') sizeClass = ' modal-xl';
    mask.innerHTML = `
      <div class="modal${sizeClass}">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;
    document.body.appendChild(mask);
    const close = () => {
      mask.style.animation = 'fadeIn 0.15s reverse';
      setTimeout(() => {
        mask.remove();
        onClose && onClose();
      }, 150);
    };
    mask.querySelector('.modal-close').onclick = close;
    mask.onclick = (e) => { if (e.target === mask) close(); };
    return { el: mask, body: mask.querySelector('.modal-body'), close };
  }

  // ====== Confirm ======
  function confirm(msg, title = '确认') {
    return new Promise((resolve) => {
      const m = modal({
        title,
        body: `<p>${msg}</p>`,
        footer: `
          <button class="btn" data-act="no">取消</button>
          <button class="btn btn-primary" data-act="yes">确定</button>
        `
      });
      m.el.querySelector('[data-act="yes"]').onclick = () => { m.close(); resolve(true); };
      m.el.querySelector('[data-act="no"]').onclick = () => { m.close(); resolve(false); };
    });
  }

  // ====== Prompt ======
  function prompt(label, def = '') {
    return new Promise((resolve) => {
      const m = modal({
        title: label,
        body: `<div class="form-group">
          <label class="form-label">${label}</label>
          <input class="form-control" type="text" value="${def}" />
        </div>`,
        footer: `
          <button class="btn" data-act="no">取消</button>
          <button class="btn btn-primary" data-act="yes">确定</button>
        `
      });
      const input = m.el.querySelector('input');
      input.focus(); input.select();
      m.el.querySelector('[data-act="yes"]').onclick = () => {
        const v = input.value;
        m.close(); resolve(v);
      };
      m.el.querySelector('[data-act="no"]').onclick = () => { m.close(); resolve(null); };
    });
  }

  // ====== 格式化 ======
  function formatTime(ts, withSec = true) {
    if (!ts) return '-';
    const d = new Date(typeof ts === 'number' ? ts : Number(ts));
    if (isNaN(d.getTime())) return '-';
    const pad = (n) => String(n).padStart(2, '0');
    const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return withSec ? base + ':' + pad(d.getSeconds()) : base;
  }
  function formatDate(ts) { return formatTime(ts, false); }
  function formatMoney(n, fixed = 2) {
    const v = Number(n || 0);
    return '¥' + v.toFixed(fixed);
  }
  function formatNumber(n) {
    const v = Number(n || 0);
    if (v >= 10000) return (v / 10000).toFixed(1) + 'w';
    return String(v);
  }
  function escape(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }
  function json2str(v) {
    try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
  }

  // ====== 主题切换 ======
  const THEMES = ['sakura', 'blue', 'dark', 'plain'];
  function getTheme() {
    return localStorage.getItem('__admin_theme__') || 'sakura';
  }
  function setTheme(name) {
    if (!THEMES.includes(name)) return;
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('__admin_theme__', name);
  }
  setTheme(getTheme());

  // ====== 退出登录 ======
  function logout() {
    http.setToken('');
    location.href = '/pages/login/login.html';
  }

  // ====== 暴露 ======
  global.App = {
    toast, modal, confirm, prompt,
    formatTime, formatDate, formatMoney, formatNumber,
    escape, json2str,
    getTheme, setTheme, THEMES,
    logout
  };
})(window);
