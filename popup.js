// Popup 逻辑

(function() {
  'use strict';

  // DOM 元素
  const elements = {
    ruleCount: document.getElementById('ruleCount'),
    enabledCount: document.getElementById('enabledCount'),
    openSidePanel: document.getElementById('openSidePanel'),
    openFloating: document.getElementById('openFloating'),
    openInTab: document.getElementById('openInTab'),
    modeOptions: document.querySelectorAll('input[name="defaultMode"]')
  };

  // 初始化
  async function init() {
    await loadStats();
    await loadSettings();
    setupEventListeners();
  }

  // 加载统计信息
  async function loadStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['mockRules'], (result) => {
        const rules = result.mockRules || {};
        const ruleList = Object.values(rules);
        const total = ruleList.length;
        const enabled = ruleList.filter(r => r.enabled !== false).length;
        
        elements.ruleCount.textContent = total;
        elements.enabledCount.textContent = enabled;
        resolve();
      });
    });
  }

  // 加载设置
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['displayMode'], (result) => {
        const mode = result.displayMode || 'sidepanel';
        elements.modeOptions.forEach(option => {
          option.checked = option.value === mode;
        });
        resolve();
      });
    });
  }

  // 保存设置
  async function saveSettings(mode) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ displayMode: mode }, () => {
        // 通知background更新设置
        chrome.runtime.sendMessage({ type: 'DISPLAY_MODE_CHANGED', mode: mode });
        resolve();
      });
    });
  }

  // 设置事件监听
  function setupEventListeners() {
    // 打开侧边栏
    elements.openSidePanel.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.sidePanel.open({ windowId: tab.windowId });
        window.close();
      }
    });

    // 悬浮窗口打开
    elements.openFloating.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.runtime.sendMessage({ type: 'OPEN_FLOATING_PANEL', tabId: tab.id });
        window.close();
      }
    });

    // 在新标签页打开
    elements.openInTab.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      window.close();
    });

    // 模式切换
    elements.modeOptions.forEach(option => {
      option.addEventListener('change', (e) => {
        if (e.target.checked) {
          saveSettings(e.target.value);
        }
      });
    });
  }

  // 启动
  init();
})();

