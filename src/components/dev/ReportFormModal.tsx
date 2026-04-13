import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { saveFeedback } from '../../../services/supabase/operations/site-feedback';

interface ReportFormModalProps {
  html: string;
  selector: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportFormModal({ html, selector, onClose, onSuccess }: ReportFormModalProps) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'bug' | 'feature' | 'note'>('bug');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setStatus('submitting');
    try {
      await saveFeedback({
        type,
        description,
        html_snippet: html,
        selector: selector || '',
        pathname: window.location.pathname,
      });

      setStatus('success');
      setTimeout(() => {
        onSuccess && onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800">Add Feedback or Note</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={type === 'bug'} onChange={() => setType('bug')} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Bug</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={type === 'feature'} onChange={() => setType('feature')} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Change Request</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={type === 'note'} onChange={() => setType('note')} className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Spatial Sticky Note</span>
                </label>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Details / Note Content</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={type === 'note' ? "Write a sticky note to attach to this element..." : "What needs to be fixed or changed here?"}
                rows={4}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border resize-none outline-none focus:ring-2"
                required
                autoFocus
              />
            </div>

            {/* Code Snippet Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Selected Element</label>
              {selector && (
                <div className="mb-2 text-xs font-mono bg-blue-50 text-blue-800 p-2 rounded border border-blue-100">
                  Selector: {selector}
                </div>
              )}
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-gray-300 font-mono">
                  <code>{html}</code>
                </pre>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end gap-3 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'submitting' || status === 'success' || !description.trim()}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${type === 'note' ? 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
            >
              {status === 'submitting' ? 'Saving...' : status === 'success' ? <><Check size={16} /> Saved</> : (type === 'note' ? 'Stick Note' : 'Submit Report')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
