'use client';

import React, { useState, useEffect } from 'react';

interface UserRecord {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  last_activity_at?: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State for Adding User
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operator' | 'viewer'>('operator');

  // Modal State for Editing User
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editPassword, setEditPassword] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.data) {
        setUsers(data.data);
      } else {
        setError(data.error || 'Failed to load user records');
      }
    } catch (err) {
      setError('Error connecting to user management API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim()) {
      setError('Please fill in all required user details');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          full_name: newFullName,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccess(`User "${newUsername}" created successfully!`);
      setShowAddModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('operator');
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          role: editingUser.role,
          is_active: editingUser.is_active,
          full_name: editingUser.full_name,
          password: editPassword.trim() !== '' ? editPassword : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setSuccess(`User "${editingUser.username}" updated successfully!`);
      setEditingUser(null);
      setEditPassword('');
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating user');
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>👥 User Management & Access Control</span>
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4, margin: 0 }}>
            Manage dashboard users, roles, 10-min idle JWT sessions, and default audit tracking.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          ➕ Add New User
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: '0.88rem', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: '0.88rem', fontWeight: 600 }}>
          ✅ {success}
        </div>
      )}

      {/* User Table Card */}
      <div className="card" style={{ background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 16px' }}>User Details</th>
              <th style={{ padding: '12px 16px' }}>Role</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Last Active</th>
              <th style={{ padding: '12px 16px' }}>Created By / Date</th>
              <th style={{ padding: '12px 16px' }}>Updated By / Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading user records...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No user records found.
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>@{u.username}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: u.role === 'admin' ? '#fef3c7' : (u.role === 'operator' ? '#e0f2fe' : '#f1f5f9'),
                        color: u.role === 'admin' ? '#b45309' : (u.role === 'operator' ? '#0369a1' : '#475569'),
                        textTransform: 'uppercase',
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: u.is_active ? '#d1fae5' : '#fee2e2',
                        color: u.is_active ? '#065f46' : '#991b1b',
                      }}
                    >
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {u.last_activity_at ? new Date(u.last_activity_at).toLocaleString('en-IN') : 'Never'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{u.created_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('en-IN')}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{u.updated_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{new Date(u.updated_at).toLocaleDateString('en-IN')}</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      style={{ fontSize: '0.75rem', fontWeight: 600 }}
                      onClick={() => setEditingUser(u)}
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>➕ Add New User</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setShowAddModal(false)}>✖</button>
            </div>

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Manoj Kumar"
                  className="form-input"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Username</label>
                <input
                  type="text"
                  placeholder="e.g. manoj_p01"
                  className="form-input"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Password</label>
                <input
                  type="password"
                  placeholder="Enter secure password..."
                  className="form-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Role Permission</label>
                <select
                  className="form-select"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="operator">Operator (Data Entry & Viewing)</option>
                  <option value="admin">Administrator (Full Access & User Management)</option>
                  <option value="viewer">Viewer (Read Only Reports)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>✏️ Edit User: {editingUser.username}</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setEditingUser(null)}>✖</button>
            </div>

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingUser.full_name}
                  onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Role Permission</label>
                <select
                  className="form-select"
                  value={editingUser.role}
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  style={{ width: '100%' }}
                >
                  <option value="operator">Operator (Data Entry & Viewing)</option>
                  <option value="admin">Administrator (Full Access & User Management)</option>
                  <option value="viewer">Viewer (Read Only Reports)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Account Status</label>
                <select
                  className="form-select"
                  value={editingUser.is_active ? 'active' : 'disabled'}
                  onChange={e => setEditingUser({ ...editingUser, is_active: e.target.value === 'active' })}
                  style={{ width: '100%' }}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Reset Password (leave blank to keep unchanged)</label>
                <input
                  type="password"
                  placeholder="Enter new password..."
                  className="form-input"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
