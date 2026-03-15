import { Request, Response, NextFunction } from 'express';
import type { ITokenService } from '../../application/interfaces/IAuthService';

export interface AuthenticatedRequest extends Request {
  adminId?: string;
}

export function createAuthMiddleware(tokenService: ITokenService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = tokenService.verifyAccessToken(token);

    if (!payload) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.adminId = payload.adminId;
    next();
  };
}
