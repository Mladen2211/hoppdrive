import { Admin } from '../../domain';

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export interface ITokenService {
  generateAccessToken(admin: Admin): string;
  generateRefreshToken(admin: Admin): string;
  verifyAccessToken(token: string): { adminId: string } | null;
  verifyRefreshToken(token: string): { adminId: string } | null;
}
