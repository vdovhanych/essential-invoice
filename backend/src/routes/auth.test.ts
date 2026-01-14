import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock the database module
vi.mock('../db/init.js', () => ({
  query: vi.fn()
}));

// Import after mocking
import { authRouter } from './auth.js';
import { query } from '../db/init.js';

const mockedQuery = vi.mocked(query);

describe('Auth Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should return 400 if email is invalid', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if password is too short', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if name is empty', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 if user already exists', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: '123' }] } as any);

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password123',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User with this email already exists');
    });

    it('should register user successfully', async () => {
      const userId = 'new-user-id';
      // Check if user exists
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
      // Create user
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: userId, email: 'new@example.com', name: 'New User' }]
      } as any);
      // Create default settings
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'new@example.com',
          password: 'password123',
          name: 'New User'
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('new@example.com');
      expect(response.body.token).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('should return 400 if email is invalid', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid',
          password: 'password123'
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if password is empty', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: ''
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 if user not found', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'notfound@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 if no token provided', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });

    it('should return user profile with valid token', async () => {
      const userId = 'test-user-id';
      const token = jwt.sign({ userId, email: 'test@example.com' }, 'test-secret');

      mockedQuery.mockResolvedValueOnce({
        rows: [{
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
          company_name: 'Test Company',
          company_ico: '12345678',
          company_dic: 'CZ12345678',
          company_address: 'Test Address',
          bank_account: '123456789',
          bank_code: '0100',
          created_at: new Date()
        }]
      } as any);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.name).toBe('Test User');
      expect(response.body.companyName).toBe('Test Company');
    });
  });

  describe('PUT /auth/me', () => {
    it('should update user profile', async () => {
      const userId = 'test-user-id';
      const token = jwt.sign({ userId, email: 'test@example.com' }, 'test-secret');

      mockedQuery.mockResolvedValueOnce({
        rows: [{
          id: userId,
          email: 'test@example.com',
          name: 'Updated Name',
          company_name: 'Updated Company',
          company_ico: '87654321',
          company_dic: 'CZ87654321',
          company_address: 'Updated Address',
          bank_account: '987654321',
          bank_code: '0800'
        }]
      } as any);

      const response = await request(app)
        .put('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          companyName: 'Updated Company'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });
  });

  describe('POST /auth/change-password', () => {
    it('should return 400 if new password is too short', async () => {
      const userId = 'test-user-id';
      const token = jwt.sign({ userId, email: 'test@example.com' }, 'test-secret');

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'short'
        });

      expect(response.status).toBe(400);
    });
  });
});
