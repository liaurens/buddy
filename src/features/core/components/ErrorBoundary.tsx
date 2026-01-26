import React, { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(_error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 text-white p-8">
                    <div className="max-w-4xl mx-auto">
                        <h1 className="text-3xl font-bold text-red-400 mb-4">Something went wrong</h1>
                        <div className="bg-slate-800 rounded-lg p-6 mb-4">
                            <h2 className="text-xl font-semibold mb-2">Error:</h2>
                            <pre className="text-red-300 overflow-auto">
                                {this.state.error?.toString()}
                            </pre>
                        </div>
                        {this.state.errorInfo && (
                            <div className="bg-slate-800 rounded-lg p-6 mb-4">
                                <h2 className="text-xl font-semibold mb-2">Stack Trace:</h2>
                                <pre className="text-slate-300 text-xs overflow-auto">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </div>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
