import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { clientRouter } from './routes/clients.js';
import { invoiceRouter } from './routes/invoices.js';
import { dashboardRouter } from './routes/dashboard.js';
import { paymentRouter } from './routes/payments.js';
import { settingsRouter } from './routes/settings.js';
import { aresRouter } from './routes/ares.js';
import { aiRouter } from './routes/ai.js';
import { authenticateToken } from './middleware/auth.js';
import { startEmailPolling } from './services/emailPoller.js';
import { initializeDatabase } from './db/init.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/clients', authenticateToken, clientRouter);
app.use('/api/invoices', authenticateToken, invoiceRouter);
app.use('/api/dashboard', authenticateToken, dashboardRouter);
app.use('/api/payments', authenticateToken, paymentRouter);
app.use('/api/settings', authenticateToken, settingsRouter);
app.use('/api/ares', authenticateToken, aresRouter);
app.use('/api/ai', authenticateToken, aiRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Start email polling if configured
    if (process.env.IMAP_HOST && process.env.IMAP_USER) {
      startEmailPolling();
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
