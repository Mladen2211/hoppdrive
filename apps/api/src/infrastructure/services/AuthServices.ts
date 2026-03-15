import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Admin } from '../../domain';
import type { IPasswordHasher, ITokenService } from '../../application/interfaces/IAuthService';

const SALT_ROUNDS = 12;

export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export class JwtTokenService implements ITokenService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
  ) {}

  generateAccessToken(admin: Admin): string {
    return jwt.sign({ adminId: admin.id }, this.jwtSecret, {
      expiresIn: '15m',
    });
  }

  generateRefreshToken(admin: Admin): string {
    return jwt.sign({ adminId: admin.id }, this.jwtRefreshSecret, {
      expiresIn: '7d',
    });
  }

  verifyAccessToken(token: string): { adminId: string } | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { adminId: string };
      return { adminId: payload.adminId };
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): { adminId: string } | null {
    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret) as { adminId: string };
      return { adminId: payload.adminId };
    } catch {
      return null;
    }
  }
}
