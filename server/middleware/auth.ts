import { Request, Response, NextFunction } from 'express';
import type { User } from '@shared/schema';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

interface AuthenticatedRequest extends Request {
  user?: User;
  isAuthenticated(): boolean;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};