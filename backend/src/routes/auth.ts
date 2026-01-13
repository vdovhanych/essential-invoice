import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/init.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const authRouter: ReturnType<typeof Router> = Router();

// Register
authRouter.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, companyName, companyIco, companyDic, companyAddress, bankAccount, bankCode } = req.body;

    try {
      // Check if user exists
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, name, company_name, company_ico, company_dic, company_address, bank_account, bank_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email, name`,
        [email, passwordHash, name, companyName, companyIco, companyDic, companyAddress, bankAccount, bankCode]
      );

      const user = result.rows[0];

      // Create default settings for user
      await query(
        `INSERT INTO settings (user_id) VALUES ($1)`,
        [user.id]
      );

      // Generate token
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

      res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// Login
authRouter.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await query(
        'SELECT id, email, name, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

      res.json({
        user: { id: user.id, email: user.email, name: user.name },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Get current user profile
authRouter.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, name, company_name, company_ico, company_dic, company_address, bank_account, bank_code, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.company_name,
      companyIco: user.company_ico,
      companyDic: user.company_dic,
      companyAddress: user.company_address,
      bankAccount: user.bank_account,
      bankCode: user.bank_code,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
authRouter.put('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { name, companyName, companyIco, companyDic, companyAddress, bankAccount, bankCode } = req.body;

  try {
    const result = await query(
      `UPDATE users SET
        name = COALESCE($1, name),
        company_name = $2,
        company_ico = $3,
        company_dic = $4,
        company_address = $5,
        bank_account = $6,
        bank_code = $7,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, email, name, company_name, company_ico, company_dic, company_address, bank_account, bank_code`,
      [name, companyName, companyIco, companyDic, companyAddress, bankAccount, bankCode, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.company_name,
      companyIco: user.company_ico,
      companyDic: user.company_dic,
      companyAddress: user.company_address,
      bankAccount: user.bank_account,
      bankCode: user.bank_code
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
authRouter.post('/change-password', authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    try {
      const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.userId]);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);
