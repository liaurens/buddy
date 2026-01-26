import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Cloud, LogIn, Mail, Loader2, Lock, UserPlus } from 'lucide-react';

const LoginScreen: React.FC = () => {
    const { signIn, signUp } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'login' | 'signup'>('login');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setIsLoading(true);
        setError('');

        try {
            const { error } = mode === 'login'
                ? await signIn(email, password)
                : await signUp(email, password);

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    setError('Invalid email or password. Please try again.');
                } else if (error.message.includes('User already registered')) {
                    setError('An account with this email already exists. Please sign in.');
                    setMode('login');
                } else if (error.message.includes('Password should be at least')) {
                    setError('Password must be at least 6 characters long.');
                } else {
                    setError(error.message);
                }
            } else if (mode === 'signup') {
                // For Supabase with email confirmation disabled, user is auto-signed in
                // If email confirmation is enabled, show a message
                setError('');
            }
        } catch (err) {
            console.error('Auth failed:', err);
            setError('Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                        <Cloud className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Welcome to Life Tracker</h1>
                    <p className="text-slate-500 mt-2">
                        {mode === 'login'
                            ? 'Sign in to sync your data across all your devices'
                            : 'Create an account to get started'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !email || !password}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                            </>
                        ) : mode === 'login' ? (
                            <>
                                <LogIn className="w-5 h-5" />
                                Sign In
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Create Account
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setMode(mode === 'login' ? 'signup' : 'login');
                            setError('');
                        }}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                        {mode === 'login'
                            ? "Don't have an account? Sign up"
                            : 'Already have an account? Sign in'}
                    </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Your data is stored securely and synced across all your devices.
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;
