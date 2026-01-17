import React, { useState } from 'react';
import { db } from '../services/db';
import { Cloud, LogIn, Mail, Loader2 } from 'lucide-react';

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setError('');

        try {
            await db.cloud.login({ email });
            setEmailSent(true);
        } catch (err) {
            console.error('Login failed:', err);
            setError('Failed to send login email. Please try again.');
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
                        Sign in to sync your data across all your devices
                    </p>
                </div>

                {!emailSent ? (
                    <form onSubmit={handleLogin} className="space-y-4">
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

                        {error && (
                            <p className="text-red-500 text-sm">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !email}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Continue with Email
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                            <Mail className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900">Check your email!</h2>
                        <p className="text-slate-500">
                            We sent a login link to <strong>{email}</strong>
                        </p>
                        <p className="text-sm text-slate-400">
                            Click the link in the email to sign in. You can close this tab.
                        </p>
                        <button
                            onClick={() => {
                                setEmailSent(false);
                                setEmail('');
                            }}
                            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                            Use a different email
                        </button>
                    </div>
                )}

                <p className="text-center text-xs text-slate-400 mt-6">
                    Your data is stored securely and synced across all your devices.
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;
