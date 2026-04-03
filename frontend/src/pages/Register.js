import React, { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeSlash, ArrowRight } from '@phosphor-icons/react';

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const isFormValid = useMemo(() => {
    return name.trim() !== '' && 
           email.trim() !== '' && 
           password.trim() !== '' && 
           password === confirmPassword &&
           password.length >= 6;
  }, [name, email, password, confirmPassword]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      if (!err.response) {
        setError(`Backend not reachable (${process.env.REACT_APP_BACKEND_URL}). Start backend and try again.`);
      } else {
        setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [name, email, password, confirmPassword, isFormValid, register, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-emerald-900" />
        <div className="absolute inset-0 bg-black/40 flex items-end p-12">
          <div>
            <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">
              JOIN US
            </h1>
            <p className="text-white/80 text-lg font-medium">
              Create an account to start managing your posts
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h2 className="text-4xl font-black uppercase tracking-tight mb-2">REGISTER</h2>
            <p className="text-gray-600">Create your account to get started</p>
          </div>

          {error && (
            <div data-testid="register-error-message" className="mb-6 p-4 border-2 border-red-500 bg-red-50 text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">
                Full Name
              </label>
              <input
                data-testid="register-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-white text-black placeholder:text-gray-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                data-testid="register-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-white text-black placeholder:text-gray-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  data-testid="register-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-4 py-3 bg-white text-black placeholder:text-gray-400 pr-12"
                  required
                  minLength={6}
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <input
                data-testid="register-confirm-password-input"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-4 py-3 bg-white text-black placeholder:text-gray-400"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              data-testid="register-submit-button"
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full btn-brutalist btn-brutalist-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="loading-brutalist">PROCESSING...</span>
              ) : (
                <>
                  CREATE ACCOUNT <ArrowRight size={20} weight="bold" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t-2 border-black text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                data-testid="login-link"
                to="/login"
                className="font-bold text-blue-600 hover:text-blue-800 underline"
              >
                LOGIN
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
