/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Client-side script.js', () => {
  let scriptContent;
  let scriptContext;

  beforeEach(() => {
    // Load the script file - this ensures Jest tracks it for coverage
    const scriptPath = path.join(__dirname, '../public/script.js');
    scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Create a mock fetch function
    global.fetch = jest.fn();

    // Set up the DOM with the HTML structure
    document.body.innerHTML = `
      <form id="url-form">
        <input type="url" id="url-input" placeholder="Enter URL" required>
        <button type="submit">Fetch & Replace</button>
      </form>
      <div id="loading" class="hidden">
        <div class="spinner"></div>
        <p>Fetching and processing content...</p>
      </div>
      <div id="error-message" class="hidden"></div>
      <div id="result-container" class="hidden">
        <div id="info-bar">
          <p>Original URL: <a id="original-url" target="_blank" rel="noopener noreferrer"></a></p>
          <p>Page Title: <span id="page-title"></span></p>
        </div>
        <div id="content-display"></div>
      </div>
    `;

    // Execute the script directly - Jest should track it if we reference the file
    // We need to make sure the script can access global objects
    const originalDocument = global.document;
    const originalWindow = global.window;
    
    // Execute the script - using Function constructor so it has access to globals
    const scriptFunction = new Function('document', 'window', 'Event', 'setTimeout', 'clearTimeout', scriptContent);
    scriptFunction(global.document, global.window, global.Event, global.setTimeout, global.clearTimeout);
    
    // Trigger DOMContentLoaded event since the script listens for it
    const event = new Event('DOMContentLoaded', { bubbles: true });
    document.dispatchEvent(event);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should initialize form elements', () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const loadingElement = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const resultContainer = document.getElementById('result-container');

    expect(urlForm).toBeTruthy();
    expect(urlInput).toBeTruthy();
    expect(loadingElement).toBeTruthy();
    expect(errorMessage).toBeTruthy();
    expect(resultContainer).toBeTruthy();
  });

  test('should show error when URL is empty', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const errorMessage = document.getElementById('error-message');

    urlInput.value = '';
    
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(errorMessage.textContent).toBe('Please enter a valid URL');
    expect(errorMessage.classList.contains('hidden')).toBe(false);
  });

  test('should show error when URL is only whitespace', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const errorMessage = document.getElementById('error-message');

    urlInput.value = '   ';
    
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(errorMessage.textContent).toBe('Please enter a valid URL');
    expect(errorMessage.classList.contains('hidden')).toBe(false);
  });

  test('should show loading indicator when form is submitted', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const loadingElement = document.getElementById('loading');
    const resultContainer = document.getElementById('result-container');
    const errorMessage = document.getElementById('error-message');

    urlInput.value = 'https://example.com';
    
    // Mock a successful fetch response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        content: '<html><body>Test</body></html>',
        title: 'Test Page',
        originalUrl: 'https://example.com'
      })
    });

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Check that loading is shown immediately
    expect(loadingElement.classList.contains('hidden')).toBe(false);
    expect(resultContainer.classList.contains('hidden')).toBe(true);
    expect(errorMessage.classList.contains('hidden')).toBe(true);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('should successfully fetch and display content', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const resultContainer = document.getElementById('result-container');
    const contentDisplay = document.getElementById('content-display');
    const originalUrlElement = document.getElementById('original-url');
    const pageTitleElement = document.getElementById('page-title');

    urlInput.value = 'https://example.com';
    
    const mockContent = '<html><head><title>Test Page</title></head><body><h1>Test</h1></body></html>';
    
    // Mock a successful fetch response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        content: mockContent,
        title: 'Test Page',
        originalUrl: 'https://example.com'
      })
    });

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(global.fetch).toHaveBeenCalledWith('/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: 'https://example.com' })
    });

    expect(resultContainer.classList.contains('hidden')).toBe(false);
    expect(originalUrlElement.textContent).toBe('https://example.com');
    // href might have trailing slash, so check if it contains the URL
    expect(originalUrlElement.href).toContain('https://example.com');
    expect(pageTitleElement.textContent).toBe('Test Page');
  });

  test('should handle fetch promise rejections', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const errorMessage = document.getElementById('error-message');

    urlInput.value = 'https://example.com';
    
    // Mock fetch to reject immediately
    global.fetch = jest.fn(() => {
      return Promise.reject(new Error('Network error'));
    });

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should show an error message
    expect(errorMessage.classList.contains('hidden')).toBe(false);
    expect(errorMessage.textContent.length).toBeGreaterThan(0);
  });

  test('should handle HTTP error responses', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const errorMessage = document.getElementById('error-message');

    urlInput.value = 'https://example.com';
    
    // Mock a failed HTTP response
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Failed to fetch content: 404 Not Found'
      })
    });

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(errorMessage.textContent).toBe('Failed to fetch content: 404 Not Found');
    expect(errorMessage.classList.contains('hidden')).toBe(false);
  });

  test('should hide loading indicator after request completes', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const loadingElement = document.getElementById('loading');

    urlInput.value = 'https://example.com';
    
    // Mock a successful fetch response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        content: '<html><body>Test</body></html>',
        title: 'Test Page',
        originalUrl: 'https://example.com'
      })
    });

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(loadingElement.classList.contains('hidden')).toBe(true);
  });

  test('should hide loading indicator even when request fails', async () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const loadingElement = document.getElementById('loading');

    urlInput.value = 'https://example.com';
    
    // Mock a failed fetch
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    urlForm.dispatchEvent(submitEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(loadingElement.classList.contains('hidden')).toBe(true);
  });
});

