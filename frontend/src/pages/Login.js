import React, { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeSlash, ArrowRight } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

function formatApiErrorDetail(detail) {
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const isFormValid = useMemo(() => {
    return email.trim() !== '' && password.trim() !== '';
  }, [email, password]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isFormValid) return;

      setError('');
      setLoading(true);
      try {
        await login(email, password);
        navigate('/dashboard');
      } catch (err) {
        if (!err.response) {
          setError(`Backend not reachable (${API_URL}). Start backend and try again.`);
        } else {
          setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, isFormValid, login, navigate]
  );

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-blue-900" />
        <div className="absolute inset-0 bg-black/40 flex items-end p-12">
          <div>
            <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">TASK MANAGER</h1>
            <p className="text-white/80 text-lg font-medium">Manage your posts with full CRUD functionality</p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h2 className="text-4xl font-black uppercase tracking-tight mb-2">LOGIN</h2>
            <p className="text-gray-600">Enter your credentials to access the dashboard</p>
          </div>

          {error && (
            <div
              data-testid="login-error-message"
              className="mb-6 p-4 border-2 border-red-500 bg-red-50 text-red-700 font-medium"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-white text-black placeholder:text-gray-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full px-4 py-3 bg-white text-black placeholder:text-gray-400 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                >
                  {showPassword ? <EyeSlash size={20} weight="bold" /> : <Eye size={20} weight="bold" />}
                </button>
              </div>
            </div>

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full btn-brutalist btn-brutalist-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="loading-brutalist">PROCESSING...</span>
              ) : (
                <>
                  LOGIN <ArrowRight size={20} weight="bold" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t-2 border-black text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link data-testid="register-link" to="/register" className="font-bold text-blue-600 hover:text-blue-800 underline">
                REGISTER
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
