// 注入到页面主世界的脚本 - 拦截 Fetch 和 XHR 请求，支持Mock响应

(function() {
  'use strict';

  // 防止重复注入
  if (window.__API_MONITOR_INJECTED__) return;
  window.__API_MONITOR_INJECTED__ = true;

  console.log('[API Monitor] Injecting request interceptors...');

  // Mock规则存储
  let mockRules = {};

  // 监听Mock规则更新
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === '__API_MONITOR_MOCK_RULES__') {
      mockRules = event.data.rules || {};
      console.log('[API Monitor] Mock rules updated:', Object.keys(mockRules).length, 'rules');
    }
  });

  // URL匹配函数
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
          // 将通配符转换为正则表达式
          const wildcardRegex = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
            .replace(/\*/g, '.*') // * 转换为 .*
            .replace(/\?/g, '.'); // ? 转换为 .
          return new RegExp('^' + wildcardRegex + '$').test(url);
        case 'regex':
          return new RegExp(pattern).test(url);
        default:
          return false;
      }
    } catch (e) {
      console.error('[API Monitor] URL match error:', e);
      return false;
    }
  }

  // 查找匹配的Mock规则
  function findMockRule(method, url) {
    for (const ruleId in mockRules) {
      const rule = mockRules[ruleId];
      if (!rule.enabled) continue;
      
      // 检查方法匹配
      if (rule.method !== '*' && rule.method !== method) continue;
      
      // 检查URL匹配
      if (testUrlMatch(rule.pattern, rule.matchType, url)) {
        return rule;
      }
    }
    return null;
  }

  // 生成唯一ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 发送请求数据到content script
  function sendRequestData(data) {
    window.postMessage({
      type: '__API_MONITOR_DATA__',
      data: data
    }, '*');
  }

  // 安全地克隆响应并读取内容
  async function readResponseBody(response) {
    try {
      const clone = response.clone();
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const json = await clone.json();
          return JSON.stringify(json);
        } catch (e) {
          return await clone.text();
        }
      } else if (contentType.includes('text/') || 
                 contentType.includes('application/javascript') || 
                 contentType.includes('application/xml') ||
                 contentType.includes('application/x-www-form-urlencoded')) {
        return await clone.text();
      } else {
        const blob = await clone.blob();
        if (blob.size < 1024 * 100) {
          try {
            return await blob.text();
          } catch (e) {
            return `[Binary: ${blob.size} bytes, type: ${blob.type || 'unknown'}]`;
          }
        }
        return `[Binary: ${blob.size} bytes, type: ${blob.type || 'unknown'}]`;
      }
    } catch (e) {
      return `[Error reading response: ${e.message}]`;
    }
  }

  // 处理请求体
  function processRequestBody(body) {
    if (!body) return null;
    
    if (typeof body === 'string') {
      return body;
    } else if (body instanceof FormData) {
      const obj = {};
      body.forEach((value, key) => {
        obj[key] = value instanceof File ? `[File: ${value.name}]` : value;
      });
      return JSON.stringify(obj);
    } else if (body instanceof URLSearchParams) {
      return body.toString();
    } else if (body instanceof Blob) {
      return `[Blob: ${body.size} bytes]`;
    } else if (body instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${body.byteLength} bytes]`;
    } else if (ArrayBuffer.isView(body)) {
      return `[TypedArray: ${body.byteLength} bytes]`;
    } else {
      try {
        return JSON.stringify(body);
      } catch (e) {
        return '[Unable to serialize body]';
      }
    }
  }

  // 转换Headers对象为普通对象
  function headersToObject(headers) {
    if (!headers) return {};
    if (headers instanceof Headers) {
      const obj = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    if (typeof headers === 'object') {
      return { ...headers };
    }
    return {};
  }

  // 创建Mock响应
  function createMockResponse(mockRule) {
    const body = mockRule.body || '';
    const status = mockRule.status || 200;
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Mock-Response': 'true'
    });
    
    return new Response(body, {
      status: status,
      statusText: status === 200 ? 'OK' : 'Mock Response',
      headers: headers
    });
  }

  // 延迟函数
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== 拦截 Fetch API ====================
  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    const requestId = generateId();
    const startTime = Date.now();
    
    // 解析请求信息
    let url = '';
    let method = 'GET';
    let requestHeaders = {};
    let requestBody = null;
    
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
      method = input.method;
      requestHeaders = headersToObject(input.headers);
    }
    
    if (init) {
      method = init.method || method;
      requestHeaders = { ...requestHeaders, ...headersToObject(init.headers) };
      requestBody = processRequestBody(init.body);
    }

    method = method.toUpperCase();
    
    // 检查是否有Mock规则
    const mockRule = findMockRule(method, url);
    
    // 发送请求开始事件
    sendRequestData({
      id: requestId,
      type: 'fetch',
      method: method,
      url: url,
      requestHeaders: requestHeaders,
      requestBody: requestBody,
      status: 'pending',
      timestamp: startTime
    });
    
    // 如果有Mock规则，返回Mock响应
    if (mockRule) {
      console.log('[API Monitor] Mock response for:', method, url, '(rule:', mockRule.name || mockRule.id, ')');
      
      // 模拟延迟
      if (mockRule.delay > 0) {
        await delay(mockRule.delay);
      }
      
      const mockResponse = createMockResponse(mockRule);
      const endTime = Date.now();
      
      // 发送Mock响应数据
      sendRequestData({
        id: requestId,
        type: 'fetch',
        method: method,
        url: url,
        requestHeaders: requestHeaders,
        requestBody: requestBody,
        status: mockRule.status || 200,
        statusText: 'Mock Response',
        responseHeaders: { 'content-type': 'application/json', 'x-mock-response': 'true' },
        responseBody: mockRule.body || '',
        duration: endTime - startTime,
        timestamp: startTime,
        isMocked: true,
        mockRuleId: mockRule.id,
        mockRuleName: mockRule.name || mockRule.id
      });
      
      return mockResponse;
    }
    
    // 正常请求
    try {
      const response = await originalFetch.apply(this, arguments);
      const endTime = Date.now();
      
      const responseHeaders = headersToObject(response.headers);
      const responseBody = await readResponseBody(response);
      
      sendRequestData({
        id: requestId,
        type: 'fetch',
        method: method,
        url: url,
        requestHeaders: requestHeaders,
        requestBody: requestBody,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: responseHeaders,
        responseBody: responseBody,
        duration: endTime - startTime,
        timestamp: startTime
      });
      
      return response;
    } catch (error) {
      const endTime = Date.now();
      
      sendRequestData({
        id: requestId,
        type: 'fetch',
        method: method,
        url: url,
        requestHeaders: requestHeaders,
        requestBody: requestBody,
        status: 'error',
        statusText: error.message,
        responseBody: error.stack || error.message,
        duration: endTime - startTime,
        timestamp: startTime
      });
      
      throw error;
    }
  };

  // ==================== 拦截 XMLHttpRequest ====================
  const XHR = XMLHttpRequest.prototype;
  const originalOpen = XHR.open;
  const originalSend = XHR.send;
  const originalSetRequestHeader = XHR.setRequestHeader;

  XHR.open = function(method, url, async, user, password) {
    this._apiMonitor = {
      id: generateId(),
      method: (method || 'GET').toUpperCase(),
      url: url,
      requestHeaders: {},
      async: async !== false
    };
    return originalOpen.apply(this, arguments);
  };

  XHR.setRequestHeader = function(name, value) {
    if (this._apiMonitor) {
      this._apiMonitor.requestHeaders[name] = value;
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  XHR.send = function(body) {
    const xhr = this;
    const monitor = xhr._apiMonitor;
    
    if (monitor) {
      monitor.startTime = Date.now();
      monitor.requestBody = processRequestBody(body);
      
      // 检查是否有Mock规则
      const mockRule = findMockRule(monitor.method, monitor.url);
      
      // 发送请求开始事件
      sendRequestData({
        id: monitor.id,
        type: 'xhr',
        method: monitor.method,
        url: monitor.url,
        requestHeaders: monitor.requestHeaders,
        requestBody: monitor.requestBody,
        status: 'pending',
        timestamp: monitor.startTime
      });
      
      // 如果有Mock规则，模拟响应
      if (mockRule) {
        console.log('[API Monitor] Mock XHR response for:', monitor.method, monitor.url, '(rule:', mockRule.name || mockRule.id, ')');
        
        const mockDelay = mockRule.delay || 0;
        
        setTimeout(() => {
          const endTime = Date.now();
          
          // 修改XHR对象的属性
          Object.defineProperty(xhr, 'readyState', { value: 4, writable: false });
          Object.defineProperty(xhr, 'status', { value: mockRule.status || 200, writable: false });
          Object.defineProperty(xhr, 'statusText', { value: 'Mock Response', writable: false });
          Object.defineProperty(xhr, 'responseText', { value: mockRule.body || '', writable: false });
          Object.defineProperty(xhr, 'response', { value: mockRule.body || '', writable: false });
          
          sendRequestData({
            id: monitor.id,
            type: 'xhr',
            method: monitor.method,
            url: monitor.url,
            requestHeaders: monitor.requestHeaders,
            requestBody: monitor.requestBody,
            status: mockRule.status || 200,
            statusText: 'Mock Response',
            responseHeaders: { 'content-type': 'application/json', 'x-mock-response': 'true' },
            responseBody: mockRule.body || '',
            duration: endTime - monitor.startTime,
            timestamp: monitor.startTime,
            isMocked: true,
            mockRuleId: mockRule.id,
            mockRuleName: mockRule.name || mockRule.id
          });
          
          if (xhr.onreadystatechange) {
            xhr.onreadystatechange();
          }
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new Event('load'));
          xhr.dispatchEvent(new Event('loadend'));
        }, mockDelay);
        
        return;
      }
      
      // 正常请求
      const originalOnReadyStateChange = xhr.onreadystatechange;
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          const endTime = Date.now();
          
          const responseHeaders = {};
          try {
            const headerStr = xhr.getAllResponseHeaders();
            if (headerStr) {
              headerStr.trim().split(/[\r\n]+/).forEach(line => {
                const parts = line.split(': ');
                const key = parts.shift();
                const value = parts.join(': ');
                if (key) {
                  responseHeaders[key.toLowerCase()] = value;
                }
              });
            }
          } catch (e) {}
          
          let responseBody = '';
          try {
            if (xhr.responseType === '' || xhr.responseType === 'text') {
              responseBody = xhr.responseText;
            } else if (xhr.responseType === 'json') {
              responseBody = JSON.stringify(xhr.response);
            } else if (xhr.responseType === 'document') {
              responseBody = xhr.responseXML ? xhr.responseXML.documentElement.outerHTML : '';
            } else if (xhr.responseType === 'blob') {
              responseBody = `[Blob: ${xhr.response ? xhr.response.size : 0} bytes]`;
            } else if (xhr.responseType === 'arraybuffer') {
              responseBody = `[ArrayBuffer: ${xhr.response ? xhr.response.byteLength : 0} bytes]`;
            }
          } catch (e) {
            responseBody = `[Error reading response: ${e.message}]`;
          }
          
          sendRequestData({
            id: monitor.id,
            type: 'xhr',
            method: monitor.method,
            url: monitor.url,
            requestHeaders: monitor.requestHeaders,
            requestBody: monitor.requestBody,
            status: xhr.status,
            statusText: xhr.statusText,
            responseHeaders: responseHeaders,
            responseBody: responseBody,
            duration: endTime - monitor.startTime,
            timestamp: monitor.startTime
          });
        }
        
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.apply(this, arguments);
        }
      };
      
      xhr.addEventListener('error', function() {
        const endTime = Date.now();
        sendRequestData({
          id: monitor.id,
          type: 'xhr',
          method: monitor.method,
          url: monitor.url,
          requestHeaders: monitor.requestHeaders,
          requestBody: monitor.requestBody,
          status: 'error',
          statusText: 'Network Error',
          responseBody: 'Network request failed',
          duration: endTime - monitor.startTime,
          timestamp: monitor.startTime
        });
      });
    }
    
    return originalSend.apply(this, arguments);
  };

  console.log('[API Monitor] Request interceptors installed successfully!');
})();
