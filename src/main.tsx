import { StrictMode, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './index.css';
import { QUERY_STALE_TIME_MS } from './constants/config';
import App from './App.tsx';

// Create a client with default options
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: QUERY_STALE_TIME_MS,
            refetchOnWindowFocus: true,
            retry: 1,
        },
    },
});

class ErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        padding: '2rem',
                        fontFamily: 'system-ui, sans-serif',
                        maxWidth: '600px',
                        margin: '0 auto',
                    }}
                >
                    <h1 style={{ color: '#e11d48' }}>Something went wrong.</h1>
                    <p>Please report this error:</p>
                    <pre
                        style={{
                            background: '#f1f5f9',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            overflow: 'auto',
                        }}
                    >
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            background: '#0f172a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                        }}
                    >
                        Reload App
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Dev must never run under a (stale) production service worker: it serves
// old precached bundles and stalls fetches while it boots/updates. Unregister
// anything controlling this origin and drop its caches, then reload once so
// the page escapes the old controller.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    void (async () => {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length === 0) return;
            await Promise.all(registrations.map((r) => r.unregister()));
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys.filter((k) => k.startsWith('workbox-')).map((k) => caches.delete(k)),
            );
            if (navigator.serviceWorker.controller) {
                window.location.reload();
            }
        } catch (e) {
            console.warn('Dev service-worker cleanup failed:', e);
        }
    })();
}

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Catch general errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    </StrictMode>,
);
