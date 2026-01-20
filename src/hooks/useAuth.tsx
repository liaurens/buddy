import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, initializeUserData } from '../services/supabase';

export interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isLoggedIn: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuthProvider(): AuthState {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const initialized = useRef(false);

    useEffect(() => {
        // Prevent double initialization in StrictMode
        if (initialized.current) return;
        initialized.current = true;

        let mounted = true;

        // Get initial session
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Error getting session:', error);
                }

                if (mounted) {
                    setSession(session);
                    setUser(session?.user ?? null);

                    // Initialize user data if logged in
                    if (session?.user) {
                        initializeUserData(session.user.id).catch(err => {
                            // Ignore abort errors
                            if (err?.name !== 'AbortError') {
                                console.error('Init user data error:', err);
                            }
                        });
                    }

                    setIsLoading(false);
                }
            } catch (err: any) {
                // Ignore abort errors
                if (err?.name === 'AbortError') return;

                console.error('Auth initialization error:', err);
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (mounted) {
                    setSession(session);
                    setUser(session?.user ?? null);
                    setIsLoading(false);

                    // Initialize user data on sign in
                    if (event === 'SIGNED_IN' && session?.user) {
                        initializeUserData(session.user.id).catch(err => {
                            if (err?.name !== 'AbortError') {
                                console.error('Init user data error:', err);
                            }
                        });
                    }
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error: error as Error | null };
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        return { error: error as Error | null };
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    return {
        user,
        session,
        isLoading,
        isLoggedIn: !!user,
        signIn,
        signUp,
        signOut,
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const auth = useAuthProvider();

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
