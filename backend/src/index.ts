import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import authRouter from './routes/auth';
import inviteRouter from './routes/invites';
import uploadRouter from './routes/upload';
import paymentRouter from './routes/payment';
import rsvpRouter from './routes/rsvp';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/invites', inviteRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/rsvp', rsvpRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Wedding Constructor API running on http://localhost:${PORT}`);
});
