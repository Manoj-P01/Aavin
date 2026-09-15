import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, getAuthUserFromRequest, revokeSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (user?.sessionId) {
      await revokeSession(user.sessionId, user.username).catch(() => {});
    }

    const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
    res.cookies.delete(ACCESS_TOKEN_COOKIE);
    res.cookies.delete(REFRESH_TOKEN_COOKIE);
    return res;
  } catch (err) {
    const res = NextResponse.json({ success: true });
    res.cookies.delete(ACCESS_TOKEN_COOKIE);
    res.cookies.delete(REFRESH_TOKEN_COOKIE);
    return res;
  }
}
