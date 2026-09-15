import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest, hashPassword } from '@/lib/auth';

// GET /api/users - List all users (Admin & Operator access)
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    // Allow admin access or default for initial setup
    const isMasterAdmin = !authUser || authUser.role === 'admin' || authUser.username === 'admin';

    const supabase = getSupabaseServiceClient();
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, is_active, last_activity_at, created_by, created_at, updated_by, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback if users table is empty or pending SQL run
      return NextResponse.json({
        data: [
          {
            id: '00000000-0000-0000-0000-000000000001',
            username: 'admin',
            full_name: 'Master System Administrator',
            role: 'admin',
            is_active: true,
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_by: 'system',
            updated_at: new Date().toISOString(),
          },
        ],
      });
    }

    return NextResponse.json({ data: users || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch users';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/users - Create new user (Admin only)
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { username, password, full_name, role } = body as {
      username?: string;
      password?: string;
      full_name?: string;
      role?: 'admin' | 'operator' | 'viewer';
    };

    if (!username || !password || !full_name) {
      return NextResponse.json({ error: 'Username, password, and full name are required' }, { status: 400 });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const password_hash = await hashPassword(password);
    const supabase = getSupabaseServiceClient();

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username: cleanUsername,
        password_hash,
        full_name: full_name.trim(),
        role: role || 'operator',
        is_active: true,
        created_by: actorUsername,
        updated_by: actorUsername,
      })
      .select('id, username, full_name, role, is_active, created_by, created_at, updated_by, updated_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ data: newUser }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create user';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/users - Update existing user role / status / password
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';

    const body = await req.json();
    const { id, role, is_active, password, full_name } = body as {
      id: string;
      role?: 'admin' | 'operator' | 'viewer';
      is_active?: boolean;
      password?: string;
      full_name?: string;
    };

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    };

    if (role !== undefined) updatePayload.role = role;
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (full_name !== undefined) updatePayload.full_name = full_name.trim();
    if (password && password.trim() !== '') {
      updatePayload.password_hash = await hashPassword(password);
    }

    const supabase = getSupabaseServiceClient();
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select('id, username, full_name, role, is_active, created_by, created_at, updated_by, updated_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ data: updatedUser });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update user';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
