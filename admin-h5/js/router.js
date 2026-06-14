// admin-h5/js/router.js
// 后台菜单 + 页面注册

(function (global) {
  // 菜单结构
  const MENU = [
    {
      group: '概览',
      items: [
        { id: 'dashboard', icon: '📊', label: '仪表盘', url: '/pages/dashboard/dashboard.html' }
      ]
    },
    {
      group: '业务',
      items: [
        { id: 'orders', icon: '🧾', label: '订单管理', url: '/pages/orders/orders.html' },
        { id: 'goods', icon: '🎂', label: '商品管理', url: '/pages/goods/goods.html' },
        { id: 'employees', icon: '👥', label: '员工权限', url: '/pages/employees/employees.html' }
      ]
    },
    {
      group: '客服',
      items: [
        { id: 'chat-config', icon: '💬', label: '聊天配置', url: '/pages/chat/config.html' },
        { id: 'chat-history', icon: '📝', label: '聊天记录', url: '/pages/chat/history.html' }
      ]
    },
    {
      group: '运营',
      items: [
        { id: 'api-config', icon: '🔌', label: '接口配置', url: '/pages/config/api.html' },
        { id: 'behavior', icon: '👣', label: '行为回溯', url: '/pages/history/behavior.html' },
        { id: 'risk', icon: '🛡️', label: '风控中心', url: '/pages/risk/risk.html' }
      ]
    }
  ];

  function renderSidebar(activeId) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const collapsed = localStorage.getItem('__admin_sidebar_collapsed__') === '1';
    if (collapsed) sidebar.classList.add('collapsed');

    let html = `
      <div class="sidebar-header">
        <div class="logo">🎂</div>
        <span class="label title-text">甜心蛋糕 · 管理后台</span>
      </div>
      <div class="sidebar-menu">
    `;
    for (const g of MENU) {
      html += `<div class="menu-group">
        <div class="menu-group-title"><span class="icon">●</span><span class="label">${g.group}</span></div>`;
      for (const it of g.items) {
        const active = it.id === activeId ? ' active' : '';
        html += `<a class="menu-item${active}" href="${it.url}" data-id="${it.id}">
          <span class="icon">${it.icon}</span>
          <span class="label">${it.label}</span>
        </a>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    sidebar.innerHTML = html;

    // 折叠按钮
    const toggleBtn = document.querySelector('.toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('__admin_sidebar_collapsed__',
          sidebar.classList.contains('collapsed') ? '1' : '0');
      };
    }
  }

  function renderTopbar(breadcrumb) {
    const top = document.querySelector('.topbar');
    if (!top) return;
    const theme = App.getTheme();
    const themeBtns = ['sakura', 'blue', 'dark', 'plain']
      .map(t => `<button class="t-${t} ${t === theme ? 'active' : ''}" data-theme="${t}" title="${t}"></button>`)
      .join('');

    const breadcrumbHtml = (breadcrumb || [])
      .map((b, i) => {
        const sep = i > 0 ? '<span class="sep">/</span>' : '';
        const cls = i === breadcrumb.length - 1 ? 'item active' : 'item';
        return sep + `<span class="${cls}">${App.escape(b)}</span>`;
      }).join('');

    const username = localStorage.getItem('__admin_username__') || 'Admin';
    const initial = username.charAt(0).toUpperCase();

    top.innerHTML = `
      <button class="toggle-btn" title="折叠">☰</button>
      <div class="breadcrumb">${breadcrumbHtml || '首页'}</div>
      <div class="actions">
        <div class="theme-switcher">${themeBtns}</div>
        <button class="icon-btn" title="刷新" onclick="location.reload()">🔄</button>
        <button class="icon-btn" title="退出" onclick="App.logout()">⎋</button>
        <div class="user-info">
          <div class="user-avatar">${initial}</div>
          <span class="user-name">${App.escape(username)}</span>
        </div>
      </div>
    `;

    // 主题切换
    top.querySelectorAll('.theme-switcher button').forEach(btn => {
      btn.onclick = () => {
        App.setTheme(btn.dataset.theme);
        top.querySelectorAll('.theme-switcher button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });
  }

  function mountLayout({ active, breadcrumb }) {
    renderSidebar(active);
    renderTopbar(breadcrumb);
  }

  global.AdminMenu = { MENU, mountLayout };
})(window);
