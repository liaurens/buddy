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
            const { error } =
                mode === 'login' ? await signIn(email, password) : await signUp(email, password);

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
        <div className="min-h-screen bg-[#e9f4f9] flex items-center justify-center p-4">
            <div className="bg-white rounded-[22px] shadow-cove max-w-md w-full p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-cove-tint-blue rounded-full mb-4">
                        <Cloud className="w-8 h-8 text-cove-accent" />
                    </div>
                    <h1 className="text-[22px] font-black text-cove-ink">
                        Welcome to Life Tracker
                    </h1>
                    <p className="text-[13.5px] font-semibold text-cove-muted mt-2">
                        {mode === 'login'
                            ? 'Sign in to sync your data across all your devices'
                            : 'Create an account to get started'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-bold text-cove-ink mb-1"
                        >
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cove-soft" />
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full pl-10 pr-4 py-3 border border-cove-border rounded-[12px] font-semibold text-cove-ink placeholder:text-cove-faint focus:outline-none focus:ring-2 focus:ring-cove-accent focus:border-transparent"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-bold text-cove-ink mb-1"
                        >
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cove-soft" />
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={
                                    mode === 'signup'
                                        ? 'At least 6 characters'
                                        : 'Enter your password'
                                }
                                className="w-full pl-10 pr-4 py-3 border border-cove-border rounded-[12px] font-semibold text-cove-ink placeholder:text-cove-faint focus:outline-none focus:ring-2 focus:ring-cove-accent focus:border-transparent"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-cove-pink text-sm font-semibold bg-cove-tint-pink p-3 rounded-[12px]">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !email || !password}
                        className="w-full flex items-center justify-center gap-2 bg-cove-accent text-white py-3 rounded-[14px] font-extrabold shadow-cove-strong hover:bg-[#3a8dc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="text-cove-accent hover:text-[#3a8dc7] text-sm font-bold"
                    >
                        {mode === 'login'
                            ? "Don't have an account? Sign up"
                            : 'Already have an account? Sign in'}
                    </button>
                </div>

                <p className="text-center text-xs font-semibold text-cove-soft mt-6">
                    Your data is stored securely and synced across all your devices.
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;
