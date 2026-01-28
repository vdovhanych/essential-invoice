import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cors from 'cors';
import request from 'supertest';

describe('CORS Configuration', () => {
  let app: express.Application;
  let server: any;

  beforeEach(() => {
    app = express();
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  it('should allow single origin', async () => {
    const allowedOrigins = ['http://localhost:5173'];
    
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }));

    app.get('/test', (req, res) => {
      res.json({ success: true });
    });

    const response = await request(app)
      .get('/test')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.status).toBe(200);
  });

  it('should allow multiple origins', async () => {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:8080'];
    
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }));

    app.get('/test', (req, res) => {
      res.json({ success: true });
    });

    // Test first origin
    const response1 = await request(app)
      .get('/test')
      .set('Origin', 'http://localhost:5173');

    expect(response1.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response1.status).toBe(200);

    // Test second origin
    const response2 = await request(app)
      .get('/test')
      .set('Origin', 'http://localhost:8080');

    expect(response2.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    expect(response2.status).toBe(200);
  });

  it('should reject disallowed origin', async () => {
    const allowedOrigins = ['http://localhost:5173'];
    
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }));

    app.get('/test', (req, res) => {
      res.json({ success: true });
    });

    // Disallowed origin should not have CORS headers
    const response = await request(app)
      .get('/test')
      .set('Origin', 'http://evil.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow requests with no origin', async () => {
    const allowedOrigins = ['http://localhost:5173'];
    
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }));

    app.get('/test', (req, res) => {
      res.json({ success: true });
    });

    // Request without origin (like curl or mobile apps)
    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should parse comma-separated origins correctly', () => {
    const corsOrigin = 'http://localhost:5173,http://localhost:8080,http://example.com';
    const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());

    expect(allowedOrigins).toHaveLength(3);
    expect(allowedOrigins).toContain('http://localhost:5173');
    expect(allowedOrigins).toContain('http://localhost:8080');
    expect(allowedOrigins).toContain('http://example.com');
  });

  it('should handle origins with spaces in comma-separated list', () => {
    const corsOrigin = 'http://localhost:5173, http://localhost:8080 , http://example.com';
    const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());

    expect(allowedOrigins).toHaveLength(3);
    expect(allowedOrigins).toContain('http://localhost:5173');
    expect(allowedOrigins).toContain('http://localhost:8080');
    expect(allowedOrigins).toContain('http://example.com');
  });
});
