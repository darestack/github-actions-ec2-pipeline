const request = require('supertest');
const app = require('../src/app');

describe('Application Tests', () => {
  describe('Health Endpoint', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('API Endpoints', () => {
    test('GET /api should return a welcome message', async () => {
      const response = await request(app).get('/api').expect(200);

      expect(response.body.message).toBe('Welcome to the API');
    });

    test('GET /api/products should return a list of products', async () => {
      const response = await request(app).get('/api/products').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
    });
  });

  describe('Static Content', () => {
    test('GET / should serve homepage', async () => {
      await request(app).get('/').expect(200).expect('Content-Type', /html/);
    });

    test('GET /style.css should serve stylesheet', async () => {
      await request(app)
        .get('/style.css')
        .expect(200)
        .expect('Content-Type', /css/);
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app).get('/nonexistent').expect(404);

      expect(response.body.error).toBe('Route not found');
    });
  });
});
