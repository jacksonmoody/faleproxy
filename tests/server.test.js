const { app, startServer } = require('../app');

describe('Server startup', () => {
  test('should export app without starting server when imported', () => {
    // When app.js is imported (not run directly), require.main !== module
    // So the server should not start
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
    
    // Verify the app has the expected routes
    const routes = app._router.stack
      .filter(r => r.route)
      .map(r => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));
    
    expect(routes).toContainEqual({ path: '/', methods: ['get'] });
    expect(routes).toContainEqual({ path: '/fetch', methods: ['post'] });
  });

  test('should have startServer function that can start the server', () => {
    expect(typeof startServer).toBe('function');
    
    // Mock console.log to verify it's called
    const originalLog = console.log;
    const logSpy = jest.fn();
    console.log = logSpy;
    
    // Create a mock server to avoid actually starting one
    const mockListen = jest.fn((port, callback) => {
      if (callback) callback();
      return { close: jest.fn() };
    });
    app.listen = mockListen;
    
    // Call startServer
    startServer();
    
    // Verify listen was called
    expect(mockListen).toHaveBeenCalled();
    
    // Restore
    console.log = originalLog;
    app.listen = require('express')().listen;
  });
});

