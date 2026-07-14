import React, { useState, useEffect, useCallback } from 'react';
import {
    Bug,
    Brain,
    Play,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { supabase } from '../../../services/supabase';

type Tab = 'errors' | 'findings' | 'rules' | 'learnings';

interface ErrorLogRow {
    id: string;
    error_type?: string;
    step?: string;
    domain?: string;
    error_message?: string;
    created_at: string;
    input?: string;
    intent?: string;
    ai_provider?: string;
    ai_model?: string;
    error_stack?: string;
    context?: Record<string, unknown>;
}

interface FindingRow {
    id: string;
    severity?: string;
    type?: string;
    status?: string;
    data?: { summary?: string } & Record<string, unknown>;
    created_at: string;
}

interface RuleRow {
    id: string;
    pattern?: string;
    action?: string;
    domain?: string;
    confidence: number;
    source?: string;
    active: boolean;
}

interface LearningRow {
    id: string;
    type?: string;
    active?: boolean;
    content?: { finding_type?: string; source?: string } & Record<string, unknown>;
    created_at: string;
}

interface Props {
    userId: string;
}

const AssistantDevPanel: React.FC<Props> = ({ userId }) => {
    const [activeTab, setActiveTab] = useState<Tab>('errors');
    const [loading, setLoading] = useState(false);

    // Data
    const [errorLogs, setErrorLogs] = useState<ErrorLogRow[]>([]);
    const [findings, setFindings] = useState<FindingRow[]>([]);
    const [rules, setRules] = useState<RuleRow[]>([]);
    const [learnings, setLearnings] = useState<LearningRow[]>([]);

    // Expanded rows
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Agent trigger state
    const [hrRunning, setHrRunning] = useState(false);
    const [trainerRunning, setTrainerRunning] = useState(false);
    const [agentResult, setAgentResult] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [errRes, findRes, ruleRes, learnRes] = await Promise.all([
                supabase
                    .from('assistant_error_logs')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('assistant_findings')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('assistant_rules')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('assistant_learnings')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50),
            ]);

            setErrorLogs(errRes.data || []);
            setFindings(findRes.data || []);
            setRules(ruleRes.data || []);
            setLearnings(learnRes.data || []);
        } catch (err) {
            console.error('Failed to fetch dev panel data:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const runHrAgent = async () => {
        setHrRunning(true);
        setAgentResult(null);
        try {
            const { data, error } = await supabase.functions.invoke('hr-agent', {
                body: { days: 7, user_id: userId },
            });
            if (error) throw error;
            setAgentResult(
                `HR Agent: ${data?.findings || 0} findings, ${data?.users_analyzed || 0} users analyzed${data?.trainer_triggered ? ' → Trainer triggered' : ''}`,
            );
            fetchData();
        } catch (err) {
            setAgentResult(`HR Agent error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setHrRunning(false);
        }
    };

    const runTrainerAgent = async () => {
        setTrainerRunning(true);
        setAgentResult(null);
        try {
            const { data, error } = await supabase.functions.invoke('trainer-agent', {
                body: { user_id: userId },
            });
            if (error) throw error;
            setAgentResult(
                `Trainer: ${data?.findings_processed || 0} findings processed, ${data?.rules_created || 0} rules created`,
            );
            fetchData();
        } catch (err) {
            setAgentResult(`Trainer error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setTrainerRunning(false);
        }
    };

    const toggleRule = async (ruleId: string, currentActive: boolean) => {
        await supabase.from('assistant_rules').update({ active: !currentActive }).eq('id', ruleId);
        fetchData();
    };

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        return (
            d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
            ' ' +
            d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        );
    };

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'errors', label: 'Errors', count: errorLogs.length },
        { key: 'findings', label: 'Findings', count: findings.length },
        { key: 'rules', label: 'Rules', count: rules.length },
        { key: 'learnings', label: 'Learnings', count: learnings.length },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bug className="text-orange-500" size={20} />
                    <h2 className="font-bold text-slate-800">AI Debug Panel</h2>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Agent Trigger Buttons */}
            <div className="p-3 border-b border-slate-100 bg-orange-50/50">
                <div className="flex gap-2">
                    <button
                        onClick={runHrAgent}
                        disabled={hrRunning}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-xs font-medium disabled:opacity-50"
                    >
                        {hrRunning ? (
                            <RefreshCw size={12} className="animate-spin" />
                        ) : (
                            <Play size={12} />
                        )}
                        Run HR Agent
                    </button>
                    <button
                        onClick={runTrainerAgent}
                        disabled={trainerRunning}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs font-medium disabled:opacity-50"
                    >
                        {trainerRunning ? (
                            <RefreshCw size={12} className="animate-spin" />
                        ) : (
                            <Brain size={12} />
                        )}
                        Run Trainer
                    </button>
                </div>
                {agentResult && (
                    <p className="text-xs text-slate-600 mt-2 bg-white rounded px-2 py-1">
                        {agentResult}
                    </p>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                            activeTab === tab.key
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span
                                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                                    activeTab === tab.key
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
                {activeTab === 'errors' && (
                    <div className="divide-y divide-slate-50">
                        {errorLogs.length === 0 ? (
                            <p className="p-4 text-sm text-slate-400 text-center">No error logs</p>
                        ) : (
                            errorLogs.map((log) => (
                                <div key={log.id} className="text-xs">
                                    <button
                                        onClick={() =>
                                            setExpandedId(expandedId === log.id ? null : log.id)
                                        }
                                        className="w-full px-3 py-2 flex items-start gap-2 hover:bg-slate-50 text-left"
                                    >
                                        {expandedId === log.id ? (
                                            <ChevronDown size={12} className="mt-0.5 shrink-0" />
                                        ) : (
                                            <ChevronRight size={12} className="mt-0.5 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                        log.error_type === 'ai_error'
                                                            ? 'bg-purple-100 text-purple-700'
                                                            : log.error_type === 'execution_error'
                                                              ? 'bg-red-100 text-red-700'
                                                              : log.error_type === 'routing_error'
                                                                ? 'bg-orange-100 text-orange-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {log.error_type}
                                                </span>
                                                <span className="text-slate-400">{log.step}</span>
                                                {log.domain && (
                                                    <span className="text-slate-300">
                                                        | {log.domain}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-600 truncate mt-0.5">
                                                {log.error_message}
                                            </p>
                                        </div>
                                        <span className="text-slate-300 shrink-0">
                                            {formatTime(log.created_at)}
                                        </span>
                                    </button>
                                    {expandedId === log.id && (
                                        <div className="px-8 pb-3 space-y-1 text-slate-500">
                                            <p>
                                                <strong>Input:</strong> {log.input}
                                            </p>
                                            {log.intent && (
                                                <p>
                                                    <strong>Intent:</strong> {log.intent}
                                                </p>
                                            )}
                                            {log.ai_provider && (
                                                <p>
                                                    <strong>Provider:</strong> {log.ai_provider}{' '}
                                                    {log.ai_model && `/ ${log.ai_model}`}
                                                </p>
                                            )}
                                            {log.error_stack && (
                                                <pre className="mt-1 p-2 bg-slate-50 rounded text-[10px] overflow-x-auto whitespace-pre-wrap">
                                                    {log.error_stack}
                                                </pre>
                                            )}
                                            {log.context && Object.keys(log.context).length > 0 && (
                                                <pre className="mt-1 p-2 bg-slate-50 rounded text-[10px] overflow-x-auto">
                                                    {JSON.stringify(log.context, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'findings' && (
                    <div className="divide-y divide-slate-50">
                        {findings.length === 0 ? (
                            <p className="p-4 text-sm text-slate-400 text-center">
                                No findings yet. Run the HR Agent to analyze logs.
                            </p>
                        ) : (
                            findings.map((f) => (
                                <div key={f.id} className="text-xs">
                                    <button
                                        onClick={() =>
                                            setExpandedId(expandedId === f.id ? null : f.id)
                                        }
                                        className="w-full px-3 py-2 flex items-start gap-2 hover:bg-slate-50 text-left"
                                    >
                                        {expandedId === f.id ? (
                                            <ChevronDown size={12} className="mt-0.5 shrink-0" />
                                        ) : (
                                            <ChevronRight size={12} className="mt-0.5 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                        f.severity === 'critical'
                                                            ? 'bg-red-100 text-red-700'
                                                            : f.severity === 'warning'
                                                              ? 'bg-yellow-100 text-yellow-700'
                                                              : 'bg-blue-100 text-blue-700'
                                                    }`}
                                                >
                                                    {f.severity}
                                                </span>
                                                <span className="font-medium text-slate-700">
                                                    {f.type}
                                                </span>
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                        f.status === 'new'
                                                            ? 'bg-blue-50 text-blue-600'
                                                            : f.status === 'applied'
                                                              ? 'bg-green-50 text-green-600'
                                                              : 'bg-slate-50 text-slate-500'
                                                    }`}
                                                >
                                                    {f.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 truncate mt-0.5">
                                                {f.data?.summary || 'No summary'}
                                            </p>
                                        </div>
                                        <span className="text-slate-300 shrink-0">
                                            {formatTime(f.created_at)}
                                        </span>
                                    </button>
                                    {expandedId === f.id && (
                                        <div className="px-8 pb-3">
                                            <pre className="p-2 bg-slate-50 rounded text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(f.data, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="divide-y divide-slate-50">
                        {rules.length === 0 ? (
                            <p className="p-4 text-sm text-slate-400 text-center">
                                No dynamic rules yet. The Trainer creates these from findings.
                            </p>
                        ) : (
                            rules.map((r) => (
                                <div
                                    key={r.id}
                                    className="px-3 py-2 flex items-center gap-2 text-xs hover:bg-slate-50"
                                >
                                    <button
                                        onClick={() => toggleRule(r.id, r.active)}
                                        className="shrink-0"
                                        title={r.active ? 'Disable rule' : 'Enable rule'}
                                    >
                                        {r.active ? (
                                            <ToggleRight size={18} className="text-green-500" />
                                        ) : (
                                            <ToggleLeft size={18} className="text-slate-300" />
                                        )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <code className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">
                                                {r.pattern}
                                            </code>
                                            <span className="text-slate-400">→</span>
                                            <span className="font-medium text-slate-700">
                                                {r.action}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-slate-400">
                                            <span>{r.domain}</span>
                                            <span>conf: {(r.confidence * 100).toFixed(0)}%</span>
                                            <span>{r.source}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'learnings' && (
                    <div className="divide-y divide-slate-50">
                        {learnings.length === 0 ? (
                            <p className="p-4 text-sm text-slate-400 text-center">
                                No learnings yet.
                            </p>
                        ) : (
                            learnings.map((l) => (
                                <div key={l.id} className="text-xs">
                                    <button
                                        onClick={() =>
                                            setExpandedId(expandedId === l.id ? null : l.id)
                                        }
                                        className="w-full px-3 py-2 flex items-start gap-2 hover:bg-slate-50 text-left"
                                    >
                                        {expandedId === l.id ? (
                                            <ChevronDown size={12} className="mt-0.5 shrink-0" />
                                        ) : (
                                            <ChevronRight size={12} className="mt-0.5 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                        l.type === 'new_rule'
                                                            ? 'bg-green-100 text-green-700'
                                                            : l.type === 'correction'
                                                              ? 'bg-red-100 text-red-700'
                                                              : l.type === 'behavior'
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {l.type}
                                                </span>
                                                <span
                                                    className={`text-[10px] ${l.active ? 'text-green-500' : 'text-slate-300'}`}
                                                >
                                                    {l.active ? 'active' : 'inactive'}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 truncate mt-0.5">
                                                {l.content?.finding_type ||
                                                    l.content?.source ||
                                                    l.type}
                                            </p>
                                        </div>
                                        <span className="text-slate-300 shrink-0">
                                            {formatTime(l.created_at)}
                                        </span>
                                    </button>
                                    {expandedId === l.id && (
                                        <div className="px-8 pb-3">
                                            <pre className="p-2 bg-slate-50 rounded text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(l.content, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssistantDevPanel;
