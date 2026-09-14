import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../lib/security';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Необходима авторизация' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.userId !== 'string' || !payload.userId) throw new Error('Invalid subject');
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Неверный токен' });
  }
}
