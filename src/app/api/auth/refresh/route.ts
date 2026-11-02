import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAccessToken,
  signAccessToken,
  ACCESS_TOKEN_COOKIE,
  IDLE_TIMEOUT_MINUTES,
  checkAndTouchSession,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ||
                  req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      const res = NextResponse.json(
        { error: 'Unauthorized: Token expired or invalid' },
        { status: 401 }
      );
      res.cookies.delete(ACCESS_TOKEN_COOKIE);
      return res;
    }

    // Check session in database and ensure not idle > 10 minutes
    if (payload.sessionId) {
      const isValid = await checkAndTouchSession(payload.sessionId, payload.username);
      if (!isValid) {
        const res = NextResponse.json(
          { error: 'Unauthorized: Token expired or invalid' },
          { status: 401 }
        );
        res.cookies.delete(ACCESS_TOKEN_COOKIE);
        return res;
      }
    }

    // User is active and session is valid: generate refreshed access token
    const newAccessToken = await signAccessToken({
      userId: payload.userId,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      sessionId: payload.sessionId,
    });

    const res = NextResponse.json({
      success: true,
      message: 'Session refreshed',
      user: {
        userId: payload.userId,
        username: payload.username,
        fullName: payload.fullName,
        role: payload.role,
      },
      idleTimeoutMinutes: IDLE_TIMEOUT_MINUTES,
    });

    res.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours cookie lifetime
    });

    return res;
  } catch (err: unknown) {
    console.error('Token refresh error:', err);
    return NextResponse.json(
      { error: 'Unauthorized: Token expired or invalid' },
      { status: 401 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
