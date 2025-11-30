// 悬浮面板脚本

(function() {
  'use strict';

  // 防止重复注入
  if (document.getElementById('api-monitor-floating-container')) {
    // 如果已存在，切换显示状态
    const panel = document.getElementById('api-monitor-floating-panel');
    if (panel.classList.contains('minimized')) {
      panel.classList.remove('minimized');
    }
    return;
  }

  // 创建容器
  const container = document.createElement('div');
  container.id = 'api-monitor-floating-container';

  // 创建面板
  const panel = document.createElement('div');
  panel.id = 'api-monitor-floating-panel';

  // 面板HTML
  panel.innerHTML = `
    <div id="api-monitor-panel-header">
      <div id="api-monitor-panel-title">
        <span class="icon">📡</span>
        <span>API Monitor</span>
      </div>
      <div id="api-monitor-panel-actions">
        <button class="api-monitor-panel-btn" id="api-monitor-btn-minimize" title="最小化">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="api-monitor-panel-btn" id="api-monitor-btn-newtab" title="在新标签页打开">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        <button class="api-monitor-panel-btn close" id="api-monitor-btn-close" title="关闭">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <div id="api-monitor-badge">
      <span>📡</span>
      <span>API Monitor</span>
    </div>
    <div id="api-monitor-panel-content">
      <iframe id="api-monitor-iframe"></iframe>
    </div>
  `;

  container.appendChild(panel);
  document.body.appendChild(container);

  // 注入CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('floating-panel.css');
  document.head.appendChild(link);

  // 设置iframe源
  const iframe = document.getElementById('api-monitor-iframe');
  iframe.src = chrome.runtime.getURL('sidepanel.html?floating=true');

  // 拖动功能
  const header = document.getElementById('api-monitor-panel-header');
  let isDragging = false;
  let startX, startY, startLeft, startBottom;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.api-monitor-panel-btn')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = container.getBoundingClientRect();
    startLeft = rect.left;
    startBottom = window.innerHeight - rect.bottom;
    
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newLeft = startLeft + deltaX;
    let newBottom = startBottom - deltaY;
    
    // 边界限制
    const panelRect = panel.getBoundingClientRect();
    const maxLeft = window.innerWidth - panelRect.width - 10;
    const maxBottom = window.innerHeight - panelRect.height - 10;
    
    newLeft = Math.max(10, Math.min(newLeft, maxLeft));
    newBottom = Math.max(10, Math.min(newBottom, maxBottom));
    
    container.style.left = newLeft + 'px';
    container.style.right = 'auto';
    container.style.bottom = newBottom + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  // 最小化
  document.getElementById('api-monitor-btn-minimize').addEventListener('click', () => {
    panel.classList.add('minimized');
  });

  // 点击徽章恢复
  document.getElementById('api-monitor-badge').addEventListener('click', () => {
    panel.classList.remove('minimized');
  });

  // 在新标签页打开
  document.getElementById('api-monitor-btn-newtab').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_IN_NEW_TAB' });
  });

  // 关闭面板
  document.getElementById('api-monitor-btn-close').addEventListener('click', () => {
    container.remove();
    link.remove();
  });

  console.log('[API Monitor] Floating panel injected');
})();

