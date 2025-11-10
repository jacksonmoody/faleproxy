const request = require('supertest');
const nock = require('nock');
const { app } = require('../app');
const { sampleHtmlWithYale } = require('./test-utils');

describe('API Endpoints', () => {
  beforeAll(() => {
    // Disable real HTTP requests during testing
    nock.disableNetConnect();
    // Allow localhost connections for supertest
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(() => {
    // Clean up nock
    nock.cleanAll();
    nock.enableNetConnect();
  });

  afterEach(() => {
    // Clear any lingering nock interceptors after each test
    nock.cleanAll();
  });

  test('GET / should serve the index.html file', async () => {
    const response = await request(app)
      .get('/')
      .expect(200)
      .expect('Content-Type', /html/);

    expect(response.text).toContain('<!DOCTYPE html>');
    expect(response.text).toContain('html');
    expect(response.text).toContain('Faleproxy');
    // Verify the file was actually sent by checking for specific content
    expect(response.text).toContain('url-form');
    expect(response.text).toContain('url-input');
  });

  test('GET / should call sendFile with correct path', async () => {
    const path = require('path');
    const fs = require('fs');
    
    // Verify the file exists
    const filePath = path.join(__dirname, '../public/index.html');
    expect(fs.existsSync(filePath)).toBe(true);
    
    // Make request and verify it serves the file
    const response = await request(app)
      .get('/')
      .expect(200);
    
    // Read the actual file to compare
    const fileContent = fs.readFileSync(filePath, 'utf8');
    expect(response.text).toBe(fileContent);
  });

  test('POST /fetch should return 400 if URL is missing', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });

  test('POST /fetch should return 400 if URL is empty string', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({ url: '' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });

  test('POST /fetch should return 400 if URL is null', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({ url: null });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });

  test('POST /fetch should fetch and replace Yale with Fale', async () => {
    // Mock the external URL
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.title).toBe('Fale University Test Page');
    expect(response.body.content).toContain('Welcome to Fale University');
    expect(response.body.content).toContain('https://www.yale.edu/about');  // URL should be unchanged
    expect(response.body.content).toContain('>About Fale<');  // Link text should be changed
    expect(response.body.originalUrl).toBe('https://example.com/');
  });

  test('POST /fetch should handle errors from external sites', async () => {
    // Mock a failing URL
    nock('https://error-site.com')
      .get('/')
      .replyWithError('Connection refused');

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://error-site.com/' });

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toContain('Failed to fetch content');
  });

  test('POST /fetch should handle HTTP errors', async () => {
    // Mock a 404 error
    nock('https://notfound.com')
      .get('/')
      .reply(404, 'Not Found');

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://notfound.com/' });

    // The app should still try to process it, but it might fail
    // Let's see what happens - axios will throw an error for 404
    expect(response.statusCode).toBe(500);
    expect(response.body.error).toContain('Failed to fetch content');
  });
});
