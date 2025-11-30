// Side Panel - 数据展示和交互逻辑

(function() {
  'use strict';

  // 状态
  let currentTabId = null;
  let requests = [];
  let selectedRequest = null;
  let mockRules = {}; // { ruleId: { ... } }
  let ruleStats = {}; // { ruleId: { hitCount: 0, successCount: 0, lastHitTime: null } }
  let editingRuleId = null;
  
  // 过滤器状态
  let filters = {
    url: '',
    method: 'all',
    status: 'all',
    type: 'all',
    response: '',
    mock: 'all'
  };

  // DOM元素
  const elements = {
    clearBtn: document.getElementById('clearBtn'),
    mockListBtn: document.getElementById('mockListBtn'),
    addRuleBtn: document.getElementById('addRuleBtn'),
    requestCount: document.getElementById('requestCount'),
    requestList: document.getElementById('requestList'),
    detailPanel: document.getElementById('detailPanel'),
    closeDetail: document.getElementById('closeDetail'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    detailMethod: document.getElementById('detailMethod'),
    detailUrl: document.getElementById('detailUrl'),
    infoUrl: document.getElementById('infoUrl'),
    infoMethod: document.getElementById('infoMethod'),
    infoStatus: document.getElementById('infoStatus'),
    infoType: document.getElementById('infoType'),
    infoDuration: document.getElementById('infoDuration'),
    infoTime: document.getElementById('infoTime'),
    requestHeaders: document.getElementById('requestHeaders'),
    requestBody: document.getElementById('requestBody'),
    responseHeaders: document.getElementById('responseHeaders'),
    responseBody: document.getElementById('responseBody'),
    copyResponseBtn: document.getElementById('copyResponseBtn'),
    formatJsonBtn: document.getElementById('formatJsonBtn'),
    editResponseBtn: document.getElementById('editResponseBtn'),
    mockListPanel: document.getElementById('mockListPanel'),
    closeMockList: document.getElementById('closeMockList'),
    mockRulesList: document.getElementById('mockRulesList'),
    mockModal: document.getElementById('mockModal'),
    mockModalTitle: document.getElementById('mockModalTitle'),
    closeMockModal: document.getElementById('closeMockModal'),
    mockName: document.getElementById('mockName'),
    mockMatchType: document.getElementById('mockMatchType'),
    mockUrl: document.getElementById('mockUrl'),
    mockMethod: document.getElementById('mockMethod'),
    mockStatus: document.getElementById('mockStatus'),
    mockDelay: document.getElementById('mockDelay'),
    mockResponseBody: document.getElementById('mockResponseBody'),
    mockEnabled: document.getElementById('mockEnabled'),
    matchTypeHint: document.getElementById('matchTypeHint'),
    saveMockBtn: document.getElementById('saveMockBtn'),
    deleteMockBtn: document.getElementById('deleteMockBtn'),
    testMockBtn: document.getElementById('testMockBtn'),
    testModal: document.getElementById('testModal'),
    closeTestModal: document.getElementById('closeTestModal'),
    testUrl: document.getElementById('testUrl'),
    testResult: document.getElementById('testResult'),
    runTestBtn: document.getElementById('runTestBtn'),
    // 导入导出
    importRulesBtn: document.getElementById('importRulesBtn'),
    exportRulesBtn: document.getElementById('exportRulesBtn'),
    importModal: document.getElementById('importModal'),
    closeImportModal: document.getElementById('closeImportModal'),
    importFileInput: document.getElementById('importFileInput'),
    selectedFileName: document.getElementById('selectedFileName'),
    importPreview: document.getElementById('importPreview'),
    importPreviewContent: document.getElementById('importPreviewContent'),
    confirmImportBtn: document.getElementById('confirmImportBtn'),
    // 设置
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    settingsModeOptions: document.querySelectorAll('input[name="settingsDisplayMode"]'),
    openInNewTab: document.getElementById('openInNewTab'),
    openFloatingPanel: document.getElementById('openFloatingPanel'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    // 过滤器
    filterToggleBtn: document.getElementById('filterToggleBtn'),
    filterPanel: document.getElementById('filterPanel'),
    filterUrl: document.getElementById('filterUrl'),
    filterMethod: document.getElementById('filterMethod'),
    filterStatus: document.getElementById('filterStatus'),
    filterType: document.getElementById('filterType'),
    filterResponse: document.getElementById('filterResponse'),
    filterMock: document.getElementById('filterMock'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),
    filterResultCount: document.getElementById('filterResultCount')
  };

  // 待导入的规则数据
  let pendingImportRules = null;
  // 当前显示模式
  let currentDisplayMode = 'sidepanel';

  const matchTypeHints = {
    exact: '完整URL必须完全一致',
    contains: 'URL包含此字符串即匹配',
    startsWith: 'URL以此字符串开头即匹配',
    endsWith: 'URL以此字符串结尾即匹配',
    wildcard: '使用 * 匹配任意字符，如：*/api/*/users',
    regex: '使用正则表达式匹配，如：/api/users/\\d+'
  };

  // 初始化
  async function init() {
    await getCurrentTab();
    await loadMockRules();
    await loadRuleStats();
    await loadDisplayMode();
    await loadRequests();
    setupEventListeners();
    setupMessageListener();
  }

  // 加载显示模式
  async function loadDisplayMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['displayMode'], (result) => {
        currentDisplayMode = result.displayMode || 'sidepanel';
        elements.settingsModeOptions.forEach(option => {
          option.checked = option.value === currentDisplayMode;
        });
        resolve();
      });
    });
  }

  // 保存显示模式
  async function saveDisplayMode(mode) {
    currentDisplayMode = mode;
    return new Promise((resolve) => {
      chrome.storage.local.set({ displayMode: mode }, () => {
        chrome.runtime.sendMessage({ type: 'DISPLAY_MODE_CHANGED', mode: mode });
        resolve();
      });
    });
  }

  async function getCurrentTab() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, (response) => {
        if (response?.tab) {
          currentTabId = response.tab.id;
        }
        resolve();
      });
    });
  }

  async function loadMockRules() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['mockRules'], (result) => {
        mockRules = result.mockRules || {};
        resolve();
      });
    });
  }

  async function loadRuleStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['ruleStats'], (result) => {
        ruleStats = result.ruleStats || {};
        resolve();
      });
    });
  }

  async function saveRuleStats() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ ruleStats }, resolve);
    });
  }

  async function saveMockRules() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ mockRules }, () => {
        chrome.runtime.sendMessage({ type: 'MOCK_RULES_UPDATED', rules: mockRules });
        resolve();
      });
    });
  }

  async function loadRequests() {
    if (!currentTabId) return;
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_REQUESTS', tabId: currentTabId }, (response) => {
        if (response?.requests) {
          requests = response.requests;
          renderRequestList();
        }
        resolve();
      });
    });
  }

  function setupEventListeners() {
    elements.clearBtn.addEventListener('click', clearRequests);
    elements.mockListBtn.addEventListener('click', toggleMockListPanel);
    elements.closeMockList.addEventListener('click', () => {
      elements.mockListPanel.classList.add('hidden');
    });
    elements.addRuleBtn.addEventListener('click', openNewRuleEditor);
    elements.closeDetail.addEventListener('click', closeDetailPanel);
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    elements.copyResponseBtn.addEventListener('click', copyResponse);
    elements.formatJsonBtn.addEventListener('click', formatJson);
    elements.editResponseBtn.addEventListener('click', openMockEditorForRequest);
    elements.closeMockModal.addEventListener('click', closeMockModal);
    elements.mockModal.querySelector('.modal-backdrop').addEventListener('click', closeMockModal);
    elements.saveMockBtn.addEventListener('click', saveMockRule);
    elements.deleteMockBtn.addEventListener('click', deleteMockRule);
    elements.testMockBtn.addEventListener('click', openTestModal);
    elements.mockMatchType.addEventListener('change', updateMatchTypeHint);
    elements.closeTestModal.addEventListener('click', closeTestModal);
    elements.testModal.querySelector('.modal-backdrop').addEventListener('click', closeTestModal);
    elements.runTestBtn.addEventListener('click', runUrlTest);
    elements.testUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') runUrlTest();
    });

    // 导入导出事件
    elements.importRulesBtn.addEventListener('click', openImportModal);
    elements.exportRulesBtn.addEventListener('click', exportRules);
    elements.closeImportModal.addEventListener('click', closeImportModal);
    elements.importModal.querySelector('.modal-backdrop').addEventListener('click', closeImportModal);
    elements.importFileInput.addEventListener('change', handleFileSelect);
    elements.confirmImportBtn.addEventListener('click', confirmImport);

    // 设置事件
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.closeSettingsModal.addEventListener('click', closeSettingsModal);
    elements.settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.openInNewTab.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    });
    elements.openFloatingPanel?.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.runtime.sendMessage({ type: 'OPEN_FLOATING_PANEL', tabId: tab.id });
      }
    });

    // 过滤器事件
    elements.filterToggleBtn.addEventListener('click', toggleFilterPanel);
    elements.filterUrl.addEventListener('input', debounce(applyFilters, 300));
    elements.filterMethod.addEventListener('change', applyFilters);
    elements.filterStatus.addEventListener('change', applyFilters);
    elements.filterType.addEventListener('change', applyFilters);
    elements.filterResponse.addEventListener('input', debounce(applyFilters, 300));
    elements.filterMock.addEventListener('change', applyFilters);
    elements.clearFiltersBtn.addEventListener('click', clearFilters);
  }

  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'NEW_REQUEST' && message.tabId === currentTabId) {
        handleNewRequest(message.request);
      }
    });

    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      currentTabId = activeInfo.tabId;
      await loadRequests();
      closeDetailPanel();
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.mockRules) {
        mockRules = changes.mockRules.newValue || {};
        renderRequestList();
        renderMockRulesList();
      }
      if (changes.ruleStats) {
        ruleStats = changes.ruleStats.newValue || {};
        renderMockRulesList();
      }
    });
  }

  // 更新规则统计
  function updateRuleStats(ruleId, success = true) {
    if (!ruleId) return;
    
    if (!ruleStats[ruleId]) {
      ruleStats[ruleId] = { hitCount: 0, successCount: 0, lastHitTime: null };
    }
    
    ruleStats[ruleId].hitCount++;
    if (success) {
      ruleStats[ruleId].successCount++;
    }
    ruleStats[ruleId].lastHitTime = Date.now();
    
    saveRuleStats();
  }

  function handleNewRequest(request) {
    const existingIndex = requests.findIndex(r => r.id === request.id);
    if (existingIndex !== -1) {
      requests[existingIndex] = { ...requests[existingIndex], ...request };
      updateRequestItem(request);
    } else {
      requests.push(request);
      addRequestItem(request);
    }
    updateRequestCount();
    
    // 如果是Mock响应，更新统计
    if (request.isMocked && request.status !== 'pending') {
      const ruleId = request.mockRuleId;
      if (ruleId && mockRules[ruleId]) {
        const success = request.status !== 'error';
        updateRuleStats(ruleId, success);
      }
    }
    
    if (selectedRequest?.id === request.id) {
      selectedRequest = request;
      renderRequestDetail();
    }
  }

  function generateRuleId() {
    return 'rule_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function testUrlMatch(pattern, matchType, url) {
    if (!pattern || !url) return false;
    
    try {
      switch (matchType) {
        case 'exact':
          return url === pattern;
        case 'contains':
          return url.includes(pattern);
        case 'startsWith':
          return url.startsWith(pattern);
        case 'endsWith':
          return url.endsWith(pattern);
        case 'wildcard':
          const wildcardRegex = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          return new RegExp('^' + wildcardRegex + '$').test(url);
        case 'regex':
          return new RegExp(pattern).test(url);
        default:
          return false;
      }
    } catch (e) {
      return false;
    }
  }

  function findMatchingRule(method, url) {
    for (const ruleId in mockRules) {
      const rule = mockRules[ruleId];
      if (!rule.enabled) continue;
      if (rule.method !== '*' && rule.method !== method) continue;
      if (testUrlMatch(rule.pattern, rule.matchType, url)) {
        return rule;
      }
    }
    return null;
  }

  function hasMockRule(method, url) {
    return findMatchingRule(method, url) !== null;
  }

  function renderRequestList() {
    const filteredRequests = filterRequests();
    const hasActiveFilter = filters.url || filters.method !== 'all' || 
                           filters.status !== 'all' || filters.type !== 'all' ||
                           filters.response || filters.mock !== 'all';
    
    if (filteredRequests.length === 0) {
      if (hasActiveFilter && requests.length > 0) {
        elements.requestList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-text">无匹配结果</div>
            <div class="empty-hint">尝试调整过滤条件</div>
          </div>
        `;
      } else {
        elements.requestList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📡</div>
            <div class="empty-text">等待请求...</div>
            <div class="empty-hint">刷新页面开始监控API请求</div>
          </div>
        `;
      }
    } else {
      elements.requestList.innerHTML = '';
      filteredRequests.forEach(request => {
        elements.requestList.appendChild(createRequestElement(request));
      });
    }
    
    updateRequestCount();
    updateFilterResultCount(filteredRequests.length, requests.length, hasActiveFilter);
  }

  // 更新过滤结果计数
  function updateFilterResultCount(filtered, total, hasFilter) {
    if (hasFilter) {
      elements.filterResultCount.textContent = `显示 ${filtered} / ${total} 条`;
      elements.filterResultCount.classList.add('has-filter');
    } else {
      elements.filterResultCount.textContent = '';
      elements.filterResultCount.classList.remove('has-filter');
    }
  }


  function createRequestElement(request) {
    const div = document.createElement('div');
    div.className = 'request-item' + (request.status === 'pending' ? ' pending' : '');
    div.dataset.id = request.id;
    
    if (selectedRequest?.id === request.id) {
      div.classList.add('selected');
    }
    
    const methodClass = `method-${request.method}`;
    const statusClass = getStatusClass(request.status);
    const statusText = request.status === 'pending' ? '...' : 
                       request.status === 'error' ? 'ERR' : request.status;
    
    const isMocked = request.isMocked || hasMockRule(request.method, request.url);
    const mockBadge = isMocked ? '<span class="mock-badge">Mock</span>' : '';
    
    let displayUrl = request.url;
    try {
      const url = new URL(request.url);
      displayUrl = url.pathname + url.search;
    } catch (e) {}
    
    // 高亮URL匹配文本
    let highlightedUrl = escapeHtml(displayUrl);
    if (filters.url) {
      highlightedUrl = highlightText(displayUrl, filters.url);
    }
    
    div.innerHTML = `
      <span class="method-badge ${methodClass}">${request.method}${mockBadge}</span>
      <span class="status-code ${statusClass}">${statusText}</span>
      <span class="request-url" title="${escapeHtml(request.url)}">${highlightedUrl}</span>
      <span class="request-time">${request.duration ? request.duration + 'ms' : '-'}</span>
    `;
    
    div.addEventListener('click', () => selectRequest(request));
    
    return div;
  }

  // 高亮文本中的匹配部分
  function highlightText(text, pattern) {
    if (!pattern) return escapeHtml(text);
    
    const escaped = escapeHtml(text);
    
    try {
      let regex;
      
      // 检查是否是正则表达式
      if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
        const regexPattern = pattern.slice(1, -1);
        regex = new RegExp(`(${regexPattern})`, 'gi');
      }
      // 检查是否包含通配符
      else if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        // 对于通配符，高亮整个匹配
        regex = new RegExp(`(${regexPattern})`, 'gi');
      }
      // 普通文本
      else {
        regex = new RegExp(`(${escapeRegExp(pattern)})`, 'gi');
      }
      
      return escaped.replace(regex, '<span class="highlight">$1</span>');
    } catch (e) {
      // 正则无效时使用普通匹配
      const simpleRegex = new RegExp(`(${escapeRegExp(pattern)})`, 'gi');
      return escaped.replace(simpleRegex, '<span class="highlight">$1</span>');
    }
  }

  // 转义正则表达式特殊字符
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function addRequestItem(request) {
    // 检查是否符合当前过滤条件
    const filteredRequests = filterRequests();
    if (!filteredRequests.find(r => r.id === request.id)) return;
    
    const emptyState = elements.requestList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    elements.requestList.appendChild(createRequestElement(request));
    elements.requestList.scrollTop = elements.requestList.scrollHeight;
  }

  function updateRequestItem(request) {
    const item = elements.requestList.querySelector(`[data-id="${request.id}"]`);
    if (item) {
      const newItem = createRequestElement(request);
      item.replaceWith(newItem);
    }
  }

  function selectRequest(request) {
    selectedRequest = request;
    
    elements.requestList.querySelectorAll('.request-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.id === request.id);
    });
    
    renderRequestDetail();
    elements.detailPanel.classList.remove('hidden');
    elements.mockListPanel.classList.add('hidden');
  }

  function renderRequestDetail() {
    if (!selectedRequest) return;
    
    const req = selectedRequest;
    
    elements.detailMethod.textContent = req.method;
    elements.detailMethod.className = `method-badge method-${req.method}`;
    elements.detailUrl.textContent = req.url;
    
    elements.infoUrl.textContent = req.url;
    elements.infoMethod.textContent = req.method;
    elements.infoStatus.textContent = req.status === 'pending' ? '等待中...' :
                                      req.status === 'error' ? `错误: ${req.statusText}` :
                                      `${req.status} ${req.statusText || ''}`;
    elements.infoStatus.className = 'info-value ' + getStatusClass(req.status);
    elements.infoType.textContent = req.type.toUpperCase();
    elements.infoDuration.textContent = req.duration ? `${req.duration}ms` : '-';
    elements.infoTime.textContent = formatTime(req.timestamp);
    
    elements.requestHeaders.textContent = formatHeaders(req.requestHeaders);
    elements.requestBody.textContent = formatBody(req.requestBody);
    elements.responseHeaders.textContent = formatHeaders(req.responseHeaders);
    elements.responseBody.innerHTML = escapeHtml(req.responseBody || '(空)');

    const matchingRule = findMatchingRule(req.method, req.url);
    elements.editResponseBtn.textContent = matchingRule ? '编辑Mock' : '添加Mock';
  }

  function closeDetailPanel() {
    elements.detailPanel.classList.add('hidden');
    selectedRequest = null;
    elements.requestList.querySelectorAll('.request-item').forEach(item => {
      item.classList.remove('selected');
    });
  }

  function switchTab(tabName) {
    elements.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab${capitalize(tabName)}`);
    });
  }

  async function clearRequests() {
    if (!currentTabId) return;
    
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS', tabId: currentTabId }, () => {
        requests = [];
        selectedRequest = null;
        renderRequestList();
        closeDetailPanel();
        resolve();
      });
    });
  }

  function copyResponse() {
    if (!selectedRequest?.responseBody) return;
    
    navigator.clipboard.writeText(selectedRequest.responseBody).then(() => {
      const originalText = elements.copyResponseBtn.textContent;
      elements.copyResponseBtn.textContent = '已复制!';
      setTimeout(() => {
        elements.copyResponseBtn.textContent = originalText;
      }, 1500);
    });
  }

  function formatJson() {
    if (!selectedRequest?.responseBody) return;
    
    try {
      const json = JSON.parse(selectedRequest.responseBody);
      const formatted = JSON.stringify(json, null, 2);
      elements.responseBody.innerHTML = syntaxHighlightJson(formatted);
    } catch (e) {
      elements.responseBody.textContent = selectedRequest.responseBody;
    }
  }

  function openNewRuleEditor() {
    editingRuleId = null;
    elements.mockModalTitle.textContent = '添加Mock规则';
    elements.mockName.value = '';
    elements.mockMatchType.value = 'contains';
    elements.mockUrl.value = '';
    elements.mockMethod.value = '*';
    elements.mockStatus.value = 200;
    elements.mockDelay.value = 0;
    elements.mockResponseBody.value = '{\n  "code": 0,\n  "message": "success",\n  "data": {}\n}';
    elements.mockEnabled.checked = true;
    elements.deleteMockBtn.style.display = 'none';
    updateMatchTypeHint();
    elements.mockModal.classList.remove('hidden');
  }

  function openMockEditorForRequest() {
    if (!selectedRequest) return;
    
    const req = selectedRequest;
    const matchingRule = findMatchingRule(req.method, req.url);
    
    if (matchingRule) {
      editingRuleId = matchingRule.id;
      elements.mockModalTitle.textContent = '编辑Mock规则';
      elements.mockName.value = matchingRule.name || '';
      elements.mockMatchType.value = matchingRule.matchType || 'exact';
      elements.mockUrl.value = matchingRule.pattern || '';
      elements.mockMethod.value = matchingRule.method || '*';
      elements.mockStatus.value = matchingRule.status || 200;
      elements.mockDelay.value = matchingRule.delay || 0;
      elements.mockResponseBody.value = matchingRule.body || '';
      elements.mockEnabled.checked = matchingRule.enabled !== false;
      elements.deleteMockBtn.style.display = 'block';
    } else {
      editingRuleId = null;
      elements.mockModalTitle.textContent = '添加Mock规则';
      elements.mockName.value = '';
      elements.mockMatchType.value = 'exact';
      elements.mockUrl.value = req.url;
      elements.mockMethod.value = req.method;
      elements.mockStatus.value = 200;
      elements.mockDelay.value = 0;
      elements.mockResponseBody.value = req.responseBody || '{\n  "code": 0,\n  "message": "success",\n  "data": {}\n}';
      elements.mockEnabled.checked = true;
      elements.deleteMockBtn.style.display = 'none';
    }
    
    updateMatchTypeHint();
    elements.mockModal.classList.remove('hidden');
  }

  function updateMatchTypeHint() {
    const matchType = elements.mockMatchType.value;
    elements.matchTypeHint.textContent = matchTypeHints[matchType] || '';
  }

  function closeMockModal() {
    elements.mockModal.classList.add('hidden');
    editingRuleId = null;
  }

  async function saveMockRule() {
    const pattern = elements.mockUrl.value.trim();
    if (!pattern) {
      showToast('请输入URL匹配规则', 'error');
      return;
    }

    if (elements.mockMatchType.value === 'regex') {
      try {
        new RegExp(pattern);
      } catch (e) {
        showToast('正则表达式语法错误: ' + e.message, 'error');
        return;
      }
    }

    const ruleId = editingRuleId || generateRuleId();
    
    mockRules[ruleId] = {
      id: ruleId,
      name: elements.mockName.value.trim() || pattern.substring(0, 30),
      matchType: elements.mockMatchType.value,
      pattern: pattern,
      method: elements.mockMethod.value,
      status: parseInt(elements.mockStatus.value) || 200,
      delay: parseInt(elements.mockDelay.value) || 0,
      body: elements.mockResponseBody.value,
      enabled: elements.mockEnabled.checked,
      createdAt: mockRules[ruleId]?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    await saveMockRules();
    closeMockModal();
    renderRequestList();
    if (selectedRequest) renderRequestDetail();
    
    showToast('Mock规则已保存');
  }

  async function deleteMockRule() {
    if (!editingRuleId) return;
    
    delete mockRules[editingRuleId];
    delete ruleStats[editingRuleId];
    
    await saveMockRules();
    await saveRuleStats();
    closeMockModal();
    renderRequestList();
    if (selectedRequest) renderRequestDetail();
    
    showToast('Mock规则已删除');
  }

  function openTestModal() {
    elements.testUrl.value = selectedRequest?.url || '';
    elements.testResult.classList.add('hidden');
    elements.testModal.classList.remove('hidden');
    elements.testUrl.focus();
  }

  function closeTestModal() {
    elements.testModal.classList.add('hidden');
  }

  function runUrlTest() {
    const testUrl = elements.testUrl.value.trim();
    if (!testUrl) {
      showToast('请输入测试URL', 'error');
      return;
    }

    const pattern = elements.mockUrl.value.trim();
    const matchType = elements.mockMatchType.value;
    
    const isMatch = testUrlMatch(pattern, matchType, testUrl);
    
    elements.testResult.classList.remove('hidden', 'success', 'fail');
    elements.testResult.classList.add(isMatch ? 'success' : 'fail');
    elements.testResult.querySelector('.test-result-text').textContent = 
      isMatch ? '匹配成功！此URL将被Mock拦截' : '不匹配，此URL不会被拦截';
  }

  function toggleMockListPanel() {
    const isHidden = elements.mockListPanel.classList.contains('hidden');
    if (isHidden) {
      elements.mockListPanel.classList.remove('hidden');
      elements.detailPanel.classList.add('hidden');
      renderMockRulesList();
    } else {
      elements.mockListPanel.classList.add('hidden');
    }
  }

  // 格式化相对时间
  function formatRelativeTime(timestamp) {
    if (!timestamp) return '从未';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return Math.floor(diff / 86400000) + '天前';
  }

  function renderMockRulesList() {
    const rules = Object.values(mockRules);
    
    if (rules.length === 0) {
      elements.mockRulesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-text">暂无Mock规则</div>
          <div class="empty-hint">点击"添加规则"或选择请求后点击"编辑Mock"</div>
        </div>
      `;
      return;
    }
    
    elements.mockRulesList.innerHTML = '';
    rules.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(rule => {
      const div = document.createElement('div');
      div.className = 'mock-rule-item' + (rule.enabled ? '' : ' disabled');
      
      const methodDisplay = rule.method === '*' ? 'ALL' : rule.method;
      const methodClass = rule.method === '*' ? 'method-OPTIONS' : `method-${rule.method}`;
      const matchTypeLabels = {
        exact: '精确',
        contains: '包含',
        startsWith: '前缀',
        endsWith: '后缀',
        wildcard: '通配',
        regex: '正则'
      };
      
      // 获取规则统计
      const stats = ruleStats[rule.id] || { hitCount: 0, successCount: 0, lastHitTime: null };
      const hasHit = stats.hitCount > 0;
      const allSuccess = stats.hitCount > 0 && stats.hitCount === stats.successCount;
      
      // 状态点颜色
      let statusDotClass = 'never-hit';
      if (hasHit && allSuccess) {
        statusDotClass = 'active';
      } else if (hasHit) {
        statusDotClass = 'inactive';
      }
      
      // 统计徽章
      let statsBadges = '';
      if (hasHit) {
        statsBadges = `
          <span class="stat-badge stat-badge-hit">
            <span class="stat-icon">↗</span>
            命中 ${stats.hitCount}
          </span>
          <span class="stat-badge stat-badge-success">
            <span class="stat-icon">✓</span>
            成功 ${stats.successCount}
          </span>
          <span class="last-hit-time">${formatRelativeTime(stats.lastHitTime)}</span>
        `;
      } else {
        statsBadges = `
          <span class="stat-badge stat-badge-none">
            <span class="stat-icon">○</span>
            未命中
          </span>
        `;
      }
      
      div.innerHTML = `
        <div class="mock-rule-info">
          <div class="mock-rule-name">
            <span class="rule-status-dot ${statusDotClass}"></span>
            <span class="method-badge ${methodClass}">${methodDisplay}</span>
            <span class="mock-rule-type">${matchTypeLabels[rule.matchType] || rule.matchType}</span>
            ${escapeHtml(rule.name || '未命名规则')}
          </div>
          <div class="mock-rule-pattern" title="${escapeHtml(rule.pattern)}">${escapeHtml(rule.pattern)}</div>
          <div class="mock-rule-stats">${statsBadges}</div>
        </div>
        <div class="mock-rule-actions">
          <button class="btn btn-small mock-rule-toggle">${rule.enabled ? '禁用' : '启用'}</button>
        </div>
      `;
      
      div.querySelector('.mock-rule-info').addEventListener('click', () => {
        editingRuleId = rule.id;
        elements.mockModalTitle.textContent = '编辑Mock规则';
        elements.mockName.value = rule.name || '';
        elements.mockMatchType.value = rule.matchType || 'exact';
        elements.mockUrl.value = rule.pattern || '';
        elements.mockMethod.value = rule.method || '*';
        elements.mockStatus.value = rule.status || 200;
        elements.mockDelay.value = rule.delay || 0;
        elements.mockResponseBody.value = rule.body || '';
        elements.mockEnabled.checked = rule.enabled !== false;
        elements.deleteMockBtn.style.display = 'block';
        updateMatchTypeHint();
        elements.mockModal.classList.remove('hidden');
      });
      
      div.querySelector('.mock-rule-toggle').addEventListener('click', async (e) => {
        e.stopPropagation();
        mockRules[rule.id].enabled = !mockRules[rule.id].enabled;
        await saveMockRules();
        renderMockRulesList();
        renderRequestList();
      });
      
      elements.mockRulesList.appendChild(div);
    });
  }

  // ==================== 过滤器功能 ====================

  // 切换过滤器面板
  function toggleFilterPanel() {
    const isHidden = elements.filterPanel.classList.contains('hidden');
    elements.filterPanel.classList.toggle('hidden');
    elements.filterToggleBtn.classList.toggle('filter-active', !isHidden === false);
    
    if (!isHidden) {
      // 关闭面板时检查是否有激活的过滤器
      updateFilterButtonState();
    }
  }

  // 更新过滤器按钮状态
  function updateFilterButtonState() {
    const hasActiveFilter = filters.url || filters.method !== 'all' || 
                           filters.status !== 'all' || filters.type !== 'all' ||
                           filters.response || filters.mock !== 'all';
    elements.filterToggleBtn.classList.toggle('filter-active', hasActiveFilter);
  }

  // 应用过滤器
  function applyFilters() {
    filters.url = elements.filterUrl.value.trim().toLowerCase();
    filters.method = elements.filterMethod.value;
    filters.status = elements.filterStatus.value;
    filters.type = elements.filterType.value;
    filters.response = elements.filterResponse.value.trim().toLowerCase();
    filters.mock = elements.filterMock.value;

    renderRequestList();
    updateFilterButtonState();
  }

  // 清除所有过滤器
  function clearFilters() {
    elements.filterUrl.value = '';
    elements.filterMethod.value = 'all';
    elements.filterStatus.value = 'all';
    elements.filterType.value = 'all';
    elements.filterResponse.value = '';
    elements.filterMock.value = 'all';

    filters = {
      url: '',
      method: 'all',
      status: 'all',
      type: 'all',
      response: '',
      mock: 'all'
    };

    renderRequestList();
    updateFilterButtonState();
    showToast('已清除所有过滤条件');
  }

  // URL匹配函数（支持通配符和正则）
  function matchUrl(url, pattern) {
    if (!pattern) return true;
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    // 检查是否是正则表达式（以 / 开头和结尾）
    if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
      try {
        const regexPattern = pattern.slice(1, -1);
        const regex = new RegExp(regexPattern, 'i');
        return regex.test(url);
      } catch (e) {
        // 正则表达式无效，当作普通文本处理
        return urlLower.includes(patternLower);
      }
    }
    
    // 检查是否包含通配符 *
    if (pattern.includes('*')) {
      // 将通配符模式转换为正则表达式
      const regexPattern = patternLower
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
        .replace(/\*/g, '.*'); // * 转换为 .*
      try {
        const regex = new RegExp(regexPattern, 'i');
        return regex.test(url);
      } catch (e) {
        return urlLower.includes(patternLower);
      }
    }
    
    // 普通文本匹配（包含）
    return urlLower.includes(patternLower);
  }

  // 过滤请求列表
  function filterRequests() {
    return requests.filter(request => {
      // URL过滤（支持通配符和正则）
      if (filters.url && !matchUrl(request.url, filters.url)) {
        return false;
      }

      // 方法过滤
      if (filters.method !== 'all' && request.method !== filters.method) {
        return false;
      }

      // 状态码过滤
      if (filters.status !== 'all') {
        const status = request.status;
        if (filters.status === 'success' && (status < 200 || status >= 300)) return false;
        if (filters.status === 'redirect' && (status < 300 || status >= 400)) return false;
        if (filters.status === 'client-error' && (status < 400 || status >= 500)) return false;
        if (filters.status === 'server-error' && status < 500) return false;
        if (filters.status === 'error' && status !== 'error') return false;
        if (filters.status === 'pending' && status !== 'pending') return false;
      }

      // 请求类型过滤
      if (filters.type !== 'all' && request.type !== filters.type) {
        return false;
      }

      // 响应内容过滤（支持通配符和正则）
      if (filters.response) {
        if (!request.responseBody || !matchUrl(request.responseBody, filters.response)) {
          return false;
        }
      }

      // Mock状态过滤
      if (filters.mock !== 'all') {
        const isMocked = request.isMocked || hasMockRule(request.method, request.url);
        if (filters.mock === 'mocked' && !isMocked) return false;
        if (filters.mock === 'real' && isMocked) return false;
      }

      return true;
    });
  }

  // ==================== 设置功能 ====================

  // 打开设置弹窗
  function openSettingsModal() {
    elements.settingsModeOptions.forEach(option => {
      option.checked = option.value === currentDisplayMode;
    });
    elements.settingsModal.classList.remove('hidden');
  }

  // 关闭设置弹窗
  function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
  }

  // 保存设置
  async function saveSettings() {
    const selectedMode = document.querySelector('input[name="settingsDisplayMode"]:checked');
    if (selectedMode) {
      await saveDisplayMode(selectedMode.value);
      showToast('设置已保存');
    }
    closeSettingsModal();
  }

  // ==================== 导入导出功能 ====================
  
  // 打开导入弹窗
  function openImportModal() {
    pendingImportRules = null;
    elements.importFileInput.value = '';
    elements.selectedFileName.textContent = '未选择文件';
    elements.importPreview.classList.add('hidden');
    elements.confirmImportBtn.disabled = true;
    elements.importModal.classList.remove('hidden');
  }

  // 关闭导入弹窗
  function closeImportModal() {
    elements.importModal.classList.add('hidden');
    pendingImportRules = null;
  }

  // 处理文件选择
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
      elements.selectedFileName.textContent = '未选择文件';
      elements.importPreview.classList.add('hidden');
      elements.confirmImportBtn.disabled = true;
      return;
    }

    elements.selectedFileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const data = JSON.parse(event.target.result);
        
        // 验证数据格式
        if (!data || typeof data !== 'object') {
          throw new Error('无效的JSON格式');
        }

        // 支持两种格式：直接的规则对象或包含rules字段的对象
        let rules = data;
        if (data.rules && typeof data.rules === 'object') {
          rules = data.rules;
        }

        // 验证规则格式
        const ruleCount = Object.keys(rules).length;
        if (ruleCount === 0) {
          throw new Error('文件中没有找到规则');
        }

        // 验证每条规则
        for (const id in rules) {
          const rule = rules[id];
          if (!rule.pattern || !rule.matchType) {
            throw new Error(`规则 ${id} 格式不正确`);
          }
        }

        pendingImportRules = rules;
        renderImportPreview(rules);
        elements.confirmImportBtn.disabled = false;

      } catch (err) {
        showToast('文件解析失败: ' + err.message, 'error');
        elements.importPreview.classList.add('hidden');
        elements.confirmImportBtn.disabled = true;
        pendingImportRules = null;
      }
    };

    reader.onerror = function() {
      showToast('文件读取失败', 'error');
    };

    reader.readAsText(file);
  }

  // 渲染导入预览
  function renderImportPreview(rules) {
    const ruleList = Object.values(rules);
    const enabledCount = ruleList.filter(r => r.enabled !== false).length;

    let html = `<div class="preview-count">共 ${ruleList.length} 条规则，${enabledCount} 条启用</div>`;
    
    ruleList.slice(0, 5).forEach(rule => {
      const methodDisplay = rule.method === '*' ? 'ALL' : rule.method;
      html += `
        <div class="preview-item">
          <span class="preview-method">${methodDisplay}</span>
          <span class="preview-pattern" title="${escapeHtml(rule.pattern)}">${escapeHtml(rule.name || rule.pattern)}</span>
        </div>
      `;
    });

    if (ruleList.length > 5) {
      html += `<div class="preview-item" style="color: var(--text-muted)">...还有 ${ruleList.length - 5} 条规则</div>`;
    }

    elements.importPreviewContent.innerHTML = html;
    elements.importPreview.classList.remove('hidden');
  }

  // 确认导入
  async function confirmImport() {
    if (!pendingImportRules) return;

    const importMode = document.querySelector('input[name="importMode"]:checked').value;

    if (importMode === 'replace') {
      // 替换模式：清空现有规则
      mockRules = {};
      ruleStats = {};
    }

    // 合并或添加规则
    let importedCount = 0;
    for (const id in pendingImportRules) {
      const rule = pendingImportRules[id];
      // 为导入的规则生成新ID（如果是合并模式且ID冲突）
      let newId = id;
      if (importMode === 'merge' && mockRules[id] && mockRules[id].pattern !== rule.pattern) {
        newId = generateRuleId();
      }
      
      mockRules[newId] = {
        ...rule,
        id: newId,
        importedAt: Date.now()
      };
      importedCount++;
    }

    await saveMockRules();
    await saveRuleStats();
    
    closeImportModal();
    renderMockRulesList();
    renderRequestList();

    showToast(`成功导入 ${importedCount} 条规则`);
  }

  // 导出规则
  function exportRules() {
    const ruleCount = Object.keys(mockRules).length;
    
    if (ruleCount === 0) {
      showToast('没有可导出的规则', 'error');
      return;
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      rulesCount: ruleCount,
      rules: mockRules,
      stats: ruleStats
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-monitor-rules-${formatDateForFilename(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`成功导出 ${ruleCount} 条规则`);
  }

  // 格式化日期用于文件名
  function formatDateForFilename(date) {
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  // ==================== 通用功能 ====================

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'var(--status-error)' : 'var(--accent-color)';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${bgColor};
      color: var(--bg-primary);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 2000;
      animation: fadeInOut 2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
      20% { opacity: 1; transform: translateX(-50%) translateY(0); }
      80% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
  `;
  document.head.appendChild(style);

  function updateRequestCount() {
    const filtered = filterRequests();
    elements.requestCount.textContent = `${filtered.length} 个请求`;
  }

  function getStatusClass(status) {
    if (status === 'pending') return 'status-pending';
    if (status === 'error') return 'status-error';
    const code = parseInt(status);
    if (code >= 200 && code < 300) return 'status-2xx';
    if (code >= 300 && code < 400) return 'status-3xx';
    if (code >= 400 && code < 500) return 'status-4xx';
    if (code >= 500) return 'status-5xx';
    return '';
  }

  function formatHeaders(headers) {
    if (!headers || Object.keys(headers).length === 0) return '(无)';
    return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\n');
  }

  function formatBody(body) {
    if (!body) return '(无)';
    try {
      const json = JSON.parse(body);
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return body;
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function syntaxHighlightJson(json) {
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-string';
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + escapeHtml(match) + '</span>';
    });
  }

  init();
})();
