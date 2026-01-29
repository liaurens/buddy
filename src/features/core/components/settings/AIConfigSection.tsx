import React, { useState, useEffect } from 'react';
import { Brain, Save, RefreshCw, Zap, AlertCircle } from 'lucide-react';
import { getSetting, setSetting } from '../../../../services/supabase';
import { initializeAIService, AIService } from '../../../planning/services/ai.service';
import { useToast } from '../../../../components/ui/Toast';
import { aiConfigSchema } from '../../../../lib/validation/schemas';

interface AIConfigSectionProps {
    userId?: string;
}

export const AIConfigSection: React.FC<AIConfigSectionProps> = ({ userId }) => {
    const toast = useToast();
    const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic' | 'gemini'>('gemini');
    const [aiApiKey, setAiApiKey] = useState('');
    const [aiModel, setAiModel] = useState('');
    const [isSavingAI, setIsSavingAI] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (userId) {
            Promise.all([
                getSetting(userId, 'ai_provider'),
                getSetting(userId, 'ai_api_key'),
                getSetting(userId, 'ai_model'),
            ]).then(([provider, key, model]) => {
                if (provider) setAiProvider(provider as 'openai' | 'anthropic' | 'gemini');
                if (key) setAiApiKey(key);
                if (model) setAiModel(model);
            });
        }
    }, [userId]);

    const handleSaveAIConfig = async () => {
        if (!userId) {
            toast.error('User not authenticated');
            return;
        }

        setIsSavingAI(true);
        setConnectionTestResult(null);

        try {
            // Validate AI configuration
            const validatedConfig = aiConfigSchema.parse({
                provider: aiProvider,
                apiKey: aiApiKey.trim(),
                model: aiModel.trim() || undefined,
            });

            await Promise.all([
                setSetting(userId, 'ai_provider', validatedConfig.provider),
                setSetting(userId, 'ai_api_key', validatedConfig.apiKey),
                validatedConfig.model ? setSetting(userId, 'ai_model', validatedConfig.model) : Promise.resolve(),
            ]);

            initializeAIService({
                provider: validatedConfig.provider,
                apiKey: validatedConfig.apiKey,
                model: validatedConfig.model,
            });

            toast.success('AI configuration saved successfully!');
        } catch (error: any) {
            if (error.name === 'ZodError') {
                const firstError = error.errors[0];
                toast.error(firstError.message);
            } else {
                console.error('Failed to save AI config:', error);
                toast.error('Failed to save AI configuration');
            }
        } finally {
            setIsSavingAI(false);
        }
    };

    const handleTestAIConnection = async () => {
        setIsTestingConnection(true);
        setConnectionTestResult(null);

        try {
            // Validate AI configuration before testing
            const validatedConfig = aiConfigSchema.parse({
                provider: aiProvider,
                apiKey: aiApiKey.trim(),
                model: aiModel.trim() || undefined,
            });

            const service = new AIService({
                provider: validatedConfig.provider,
                apiKey: validatedConfig.apiKey,
                model: validatedConfig.model,
            });

            const result = await service.testConnection();

            setConnectionTestResult({
                success: result.success,
                message: result.success
                    ? `Connection successful! Ready to use ${aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} for daily planning.`
                    : `Connection failed: ${result.error || 'Unknown error'}`,
            });
        } catch (error: any) {
            if (error.name === 'ZodError') {
                const firstError = error.errors[0];
                setConnectionTestResult({
                    success: false,
                    message: firstError.message,
                });
            } else {
                setConnectionTestResult({
                    success: false,
                    message: `Connection failed: ${error.message || 'Unknown error'}`,
                });
            }
        } finally {
            setIsTestingConnection(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
                <Brain className="text-indigo-600" size={24} />
                <h2 className="text-xl font-semibold text-slate-800">AI Configuration</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">
                Configure AI provider for daily planning assistance. Your API key is stored securely and never shared.
            </p>

            <div className="space-y-4">
                {/* Provider Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => setAiProvider('gemini')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                                aiProvider === 'gemini'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <div className="font-medium">Gemini</div>
                            <div className="text-xs text-slate-500">Free tier ✓</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiProvider('openai')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                                aiProvider === 'openai'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <div className="font-medium">OpenAI</div>
                            <div className="text-xs text-slate-500">GPT-4 models</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiProvider('anthropic')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                                aiProvider === 'anthropic'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <div className="font-medium">Anthropic</div>
                            <div className="text-xs text-slate-500">Claude models</div>
                        </button>
                    </div>
                </div>

                {/* API Key Input */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        API Key
                        <span className="text-xs text-slate-500 ml-2">
                            ({aiProvider === 'gemini' ? 'Get from aistudio.google.com' : aiProvider === 'openai' ? 'Get from platform.openai.com' : 'Get from console.anthropic.com'})
                        </span>
                    </label>
                    <input
                        type="password"
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                        placeholder={aiProvider === 'gemini' ? 'AI...' : aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                    />
                </div>

                {/* Model Selection (Optional) */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Model (Optional)
                        <span className="text-xs text-slate-500 ml-2">Leave empty for default</span>
                    </label>
                    <input
                        type="text"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder={aiProvider === 'gemini' ? 'gemini-2.0-flash-exp' : aiProvider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514'}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSaveAIConfig}
                        disabled={isSavingAI || !aiApiKey.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isSavingAI ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save Configuration
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleTestAIConnection}
                        disabled={isTestingConnection || !aiApiKey.trim()}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isTestingConnection ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Testing...
                            </>
                        ) : (
                            <>
                                <Zap size={16} />
                                Test
                            </>
                        )}
                    </button>
                </div>

                {/* Connection Test Result */}
                {connectionTestResult && (
                    <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                        connectionTestResult.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                    }`}>
                        <AlertCircle
                            size={16}
                            className={connectionTestResult.success ? 'text-green-600 mt-0.5' : 'text-red-600 mt-0.5'}
                        />
                        <p className={`text-sm ${
                            connectionTestResult.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                            {connectionTestResult.message}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
