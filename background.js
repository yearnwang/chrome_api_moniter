// Background Service Worker - 数据中转和存储

// 存储所有请求记录，按tabId分组
const requestStore = new Map();

// 最大存储请求数量（每个tab）
const MAX_REQUESTS_PER_TAB = 500;

// 当前显示模式
let currentDisplayMode = 'sidepanel';

// 初始化
async function initialize() {
  // 加载显示模式设置
  const result = await chrome.storage.local.get(['displayMode']);
  currentDisplayMode = result.displayMode || 'sidepanel';
  
  // 根据模式设置popup行为
  await updatePopupBehavior();
}

// 更新popup行为
async function updatePopupBehavior() {
  if (currentDisplayMode === 'sidepanel') {
    // 侧边栏模式：点击图标直接打开侧边栏
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    await chrome.action.setPopup({ popup: '' });
  } else if (currentDisplayMode === 'floating') {
    // 悬浮窗口模式：点击图标打开悬浮窗口
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.action.setPopup({ popup: '' });
  } else if (currentDisplayMode === 'tab') {
    // 标签页模式：点击图标打开新标签页
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.action.setPopup({ popup: '' });
  } else {
    // popup模式：点击图标显示popup
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.action.setPopup({ popup: 'popup.html' });
  }
}

// 获取tab的请求列表
function getTabRequests(tabId) {
  if (!requestStore.has(tabId)) {
    requestStore.set(tabId, []);
  }
  return requestStore.get(tabId);
}

// 添加请求记录
function addRequest(tabId, request) {
  const requests = getTabRequests(tabId);
  
  const existingIndex = requests.findIndex(r => r.id === request.id);
  if (existingIndex !== -1) {
    requests[existingIndex] = { ...requests[existingIndex], ...request };
  } else {
    requests.push(request);
    
    if (requests.length > MAX_REQUESTS_PER_TAB) {
      requests.shift();
    }
  }
}

// 清空tab的请求记录
function clearTabRequests(tabId) {
  requestStore.set(tabId, []);
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    const tabId = sender.tab?.id;
    if (tabId) {
      const requestData = {
        ...message.data,
        tabUrl: message.tabUrl,
        tabTitle: message.tabTitle,
        tabId: tabId
      };
      
      addRequest(tabId, requestData);
      notifySidePanel(tabId, requestData);
    }
  } else if (message.type === 'GET_REQUESTS') {
    const tabId = message.tabId;
    const requests = getTabRequests(tabId);
    sendResponse({ requests });
    return true;
  } else if (message.type === 'CLEAR_REQUESTS') {
    const tabId = message.tabId;
    clearTabRequests(tabId);
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true;
  } else if (message.type === 'MOCK_RULES_UPDATED') {
    broadcastMockRules(message.rules);
  } else if (message.type === 'GET_MOCK_RULES') {
    chrome.storage.local.get(['mockRules'], (result) => {
      sendResponse({ rules: result.mockRules || {} });
    });
    return true;
  } else if (message.type === 'DISPLAY_MODE_CHANGED') {
    currentDisplayMode = message.mode;
    updatePopupBehavior();
  } else if (message.type === 'GET_DISPLAY_MODE') {
    sendResponse({ mode: currentDisplayMode });
    return true;
  } else if (message.type === 'OPEN_FLOATING_PANEL') {
    // 在当前页面注入悬浮面板
    openFloatingPanel(sender.tab?.id || message.tabId);
  } else if (message.type === 'OPEN_IN_NEW_TAB') {
    chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
  }
});

// 打开悬浮面板
async function openFloatingPanel(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }
  
  if (tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['floating-panel.js']
      });
    } catch (e) {
      console.error('[API Monitor] Failed to inject floating panel:', e);
    }
  }
}

// 广播Mock规则到所有标签页
async function broadcastMockRules(rules) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'UPDATE_MOCK_RULES',
        rules: rules
      });
    } catch (e) {
      // 标签页可能没有content script，忽略
    }
  }
}

// 通知侧边栏更新
async function notifySidePanel(tabId, request) {
  try {
    chrome.runtime.sendMessage({
      type: 'NEW_REQUEST',
      tabId: tabId,
      request: request
    }).catch(() => {});
  } catch (e) {}
}

// 当tab关闭时清理数据
chrome.tabs.onRemoved.addListener((tabId) => {
  requestStore.delete(tabId);
});

// 监听图标点击（用于非popup模式）
chrome.action.onClicked.addListener(async (tab) => {
  if (currentDisplayMode === 'sidepanel') {
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else if (currentDisplayMode === 'floating') {
    openFloatingPanel(tab.id);
  } else if (currentDisplayMode === 'tab') {
    chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
  }
  // popup模式由popup.html处理
});

// 初始化
initialize();

console.log('[API Monitor] Background service worker started');
