// Content Script - 注入拦截脚本并转发数据

(function() {
  'use strict';

  // 注入脚本到页面主世界
  function injectScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = function() {
        this.remove();
        console.log('[API Monitor] Injected script loaded');
        // 注入完成后，发送当前的Mock规则
        loadAndSendMockRules();
      };
      script.onerror = function() {
        console.error('[API Monitor] Failed to load injected script');
      };
      
      // 尽早注入
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[API Monitor] Injection error:', e);
    }
  }

  // 加载并发送Mock规则到页面
  function loadAndSendMockRules() {
    chrome.runtime.sendMessage({ type: 'GET_MOCK_RULES' }, (response) => {
      if (response?.rules) {
        sendMockRulesToPage(response.rules);
      }
    });
  }

  // 发送Mock规则到页面
  function sendMockRulesToPage(rules) {
    window.postMessage({
      type: '__API_MONITOR_MOCK_RULES__',
      rules: rules
    }, '*');
  }

  // 监听来自注入脚本的消息
  window.addEventListener('message', function(event) {
    // 只处理来自当前窗口的消息
    if (event.source !== window) return;
    
    // 检查消息类型 - 请求数据
    if (event.data && event.data.type === '__API_MONITOR_DATA__') {
      const requestData = event.data.data;
      
      // 转发到background script
      try {
        chrome.runtime.sendMessage({
          type: 'API_REQUEST',
          data: requestData,
          tabUrl: window.location.href,
          tabTitle: document.title
        }).catch(() => {
          // 扩展上下文可能已失效，忽略
        });
      } catch (e) {
        // 忽略错误
      }
    }
  });

  // 监听来自background的Mock规则更新
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_MOCK_RULES') {
      sendMockRulesToPage(message.rules);
    }
  });

  // 立即注入脚本
  injectScript();

  console.log('[API Monitor] Content script initialized');
})();
