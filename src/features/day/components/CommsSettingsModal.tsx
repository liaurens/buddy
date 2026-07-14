import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../hooks/useAuth';
import { getCategorySettings, updateCategorySettings } from '../../../services/settings';
import type { CommsItem } from '../../../services/settings/settings.types';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Props {
    onClose: () => void;
    onSaved: () => void;
}

const CommsSettingsModal: React.FC<Props> = ({ onClose, onSaved }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<CommsItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [newLabel, setNewLabel] = useState('');

    useEffect(() => {
        if (!user?.id) return;
        getCategorySettings(user.id, 'comms').then((s) => setItems(s.items));
    }, [user?.id]);

    const toggleDay = (itemId: string, day: number) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.id !== itemId) return item;
                if (item.daysOfWeek === null) {
                    // Switch from "every day" to "only this day"
                    return { ...item, daysOfWeek: [day] };
                }
                const has = item.daysOfWeek.includes(day);
                const next = has
                    ? item.daysOfWeek.filter((d) => d !== day)
                    : [...item.daysOfWeek, day].sort();
                // If all 7 selected → revert to null (every day)
                return {
                    ...item,
                    daysOfWeek: next.length === 7 || next.length === 0 ? null : next,
                };
            }),
        );
    };

    const addItem = () => {
        const label = newLabel.trim();
        if (!label) return;
        setItems((prev) => [...prev, { id: uuidv4(), label, daysOfWeek: null }]);
        setNewLabel('');
    };

    const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            await updateCategorySettings(user.id, 'comms', { items });
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900">Comms items</h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto p-5 space-y-4 flex-1">
                    <p className="text-sm text-slate-500">
                        Each item appears in your morning comms step. Set specific days to show it
                        only on those days.
                    </p>

                    <ul className="space-y-3">
                        {items.map((item) => (
                            <li key={item.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-800 flex-1">
                                        {item.label}
                                    </span>
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    {DAY_LABELS.map((label, day) => {
                                        const active =
                                            item.daysOfWeek === null ||
                                            item.daysOfWeek.includes(day);
                                        return (
                                            <button
                                                key={day}
                                                onClick={() => toggleDay(item.id, day)}
                                                className={`w-8 h-7 rounded-md text-xs font-medium transition-colors ${
                                                    active
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-400'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-slate-400">
                                    {item.daysOfWeek === null
                                        ? 'Every day'
                                        : item.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')}
                                </p>
                            </li>
                        ))}
                    </ul>

                    <div className="flex gap-2">
                        <input
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addItem()}
                            placeholder="Add item…"
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <button
                            onClick={addItem}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CommsSettingsModal;
