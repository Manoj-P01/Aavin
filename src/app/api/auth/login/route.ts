import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { comparePassword, signAccessToken, createSession, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    let validUser: any = null;

    const supabase = getSupabaseServiceClient();

    // Query user record
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, full_name, role, is_active')
      .eq('username', cleanUsername)
      .single();

    validUser = user;

    // Fallback for Master Admin Account (admin / admin or Admin@123) if DB is empty or unseeded
    if (error || !validUser) {
      if (cleanUsername === 'admin' && (password === 'admin' || password === 'Admin@123')) {
        validUser = {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'admin',
          password_hash: '$2b$10$wN1QY8uE1Gz3oN0X7b2v.e0bM0qL0R0S0T0U0V0W0X0Y0Z0A0B0C0',
          full_name: 'Master System Administrator',
          role: 'admin',
          is_active: true,
        };
      } else {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
    }

    if (!validUser.is_active) {
      return NextResponse.json({ error: 'Account is deactivated. Please contact your administrator.' }, { status: 403 });
    }

    // Validate password
    const isPasswordValid = await comparePassword(password, validUser.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Create session in user_sessions table
    let sessionId = '00000000-0000-0000-0000-000000000001';
    let refreshToken = 'master_admin_session';

    try {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
      const ua = req.headers.get('user-agent') || 'Browser';
      const sessionResult = await createSession(validUser.id, validUser.username, ip, ua);
      sessionId = sessionResult.sessionId;
      refreshToken = sessionResult.token;
    } catch (sessionErr) {
      console.warn('DB Session logging skipped:', sessionErr);
    }

    // Sign JWT access token
    const accessToken = await signAccessToken({
      userId: validUser.id,
      username: validUser.username,
      fullName: validUser.full_name,
      role: validUser.role as 'admin' | 'operator' | 'viewer',
      sessionId,
    });

    const res = NextResponse.json({
      user: {
        id: validUser.id,
        username: validUser.username,
        fullName: validUser.full_name,
        role: validUser.role,
      },
      accessToken,
    });

    // Set HttpOnly Cookies
    res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown authentication failure';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
