import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function Profile() {
  const navigate = useNavigate();
  const { user, checkAuth, logout } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canSave = useMemo(() => {
    return name.trim() !== '' && email.trim() !== '';
  }, [name, email]);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.put(`${API_URL}/api/users/me`, { name, email });
      await checkAuth();
      setSuccess('Profile updated');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, [name, email, canSave, checkAuth]);

  const handleDeleteAccount = useCallback(async () => {
    const ok = window.confirm('Delete your account and all your posts? This cannot be undone.');
    if (!ok) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.delete(`${API_URL}/api/users/me`);
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-4 border-black bg-white sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-brutalist flex items-center gap-2"
          >
            <ArrowLeft size={18} weight="bold" />
            BACK
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">PROFILE</h1>
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Manage your account</p>
          </div>
          <div className="w-[88px]" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 border-2 border-red-500 bg-red-50 text-red-700 font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 border-2 border-green-600 bg-green-50 text-green-800 font-medium">
            {success}
          </div>
        )}

        <div className="card-brutalist p-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Account</p>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white"
                required
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || !canSave}
                className="flex-1 btn-brutalist btn-brutalist-primary disabled:opacity-50"
              >
                {loading ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 btn-brutalist"
                disabled={loading}
              >
                CANCEL
              </button>
            </div>
          </form>
        </div>

        <div className="card-brutalist p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Danger Zone</p>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="btn-brutalist btn-brutalist-danger w-full flex items-center justify-center gap-2"
            disabled={loading}
          >
            <Trash size={18} weight="bold" />
            DELETE ACCOUNT
          </button>
        </div>
      </main>
    </div>
  );
}
