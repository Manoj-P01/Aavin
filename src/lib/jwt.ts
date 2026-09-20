import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'aavin_dairy_dashboard_jwt_secret_key_2026_super_secure_987654321'
);

export const ACCESS_TOKEN_COOKIE = 'aavin_access_token';
export const REFRESH_TOKEN_COOKIE = 'aavin_refresh_token';
export const IDLE_TIMEOUT_MINUTES = 10;

export interface AuthUserPayload {
  userId: string;
  username: string;
  fullName: string;
  role: 'admin' | 'operator' | 'viewer';
  sessionId?: string;
}

export async function signAccessToken(payload: AuthUserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AuthUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthUserPayload;
  } catch {
    return null;
  }
}
