import { useState, useEffect } from 'react';
import { InspectorOverlay } from './InspectorOverlay';
import { ReportFormModal } from './ReportFormModal';
import { ReportListModal } from './ReportListModal';
import { Bug, X, FileText, List } from 'lucide-react';
import { getAllFeedback } from '../../services/supabase/operations/site-feedback';
import type { SiteFeedback } from '../../services/supabase/operations/site-feedback';

export function DevPortal() {
    const [isActive, setIsActive] = useState(false);
    const [isListOpen, setIsListOpen] = useState(false);
    const [selectedElementHtml, setSelectedElementHtml] = useState<string | null>(null);
    const [selectedSelector, setSelectedSelector] = useState<string | null>(null);

    const [feedbackData, setFeedbackData] = useState<SiteFeedback[]>([]);
    const [rects, setRects] = useState<Record<string, { top: number; left: number }>>({});

    // Fetch feedback when portal is activated
    useEffect(() => {
        if (isActive || isListOpen) {
            loadFeedback();
        } else {
            setFeedbackData([]);
            setRects({});
        }
    }, [isActive, isListOpen]);

    const loadFeedback = async () => {
        try {
            const data = await getAllFeedback();
            setFeedbackData(data);
            calculateNotePositions(data);
        } catch (e) {
            console.error(e);
        }
    };

    const calculateNotePositions = (data: SiteFeedback[]) => {
        const newRects: Record<string, { top: number; left: number }> = {};
        data.forEach((item) => {
            if (item.type === 'note' && item.selector) {
                try {
                    const el = document.querySelector(item.selector);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        newRects[item.id!] = {
                            top: rect.top + window.scrollY - 10,
                            left: rect.left + window.scrollX + rect.width - 20,
                        };
                    }
                } catch {
                    // Selector might be invalid if DOM changed significantly
                }
            }
        });
        setRects(newRects);
    };

    // Recalculate on window resize
    useEffect(() => {
        if (!isActive) return;
        const handleResize = () => calculateNotePositions(feedbackData);
        window.addEventListener('resize', handleResize);
        // Observe DOM mutations to catch elements loading asynchronously
        const observer = new MutationObserver(handleResize);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [isActive, feedbackData]);

    const handleElementSelect = (html: string, selector: string) => {
        setSelectedElementHtml(html);
        setSelectedSelector(selector);
    };

    const handleCloseModal = () => {
        setSelectedElementHtml(null);
        setSelectedSelector(null);
    };

    const handleSuccess = () => {
        // Reload feedback after submission to show the new note
        loadFeedback();
    };

    return (
        <>
            {/* Small, faded dev cluster, tucked bottom-left clear of the Capture FAB. */}
            <div className="fixed bottom-4 left-4 z-[9999] flex flex-col items-start gap-2 pointer-events-none">
                {isActive && (
                    <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg font-mono pointer-events-auto shadow-blue-500/20 border border-blue-500 animate-pulse">
                        Inspector Mode — click an element to report
                    </div>
                )}
                <div className="flex gap-2 pointer-events-auto">
                    <button
                        onClick={() => setIsListOpen(true)}
                        className="p-2 rounded-full shadow-lg text-white bg-slate-700/80 hover:bg-slate-800 opacity-60 hover:opacity-100 transition-all"
                        title="View reported feedback"
                    >
                        <List size={18} />
                    </button>
                    <button
                        onClick={() => setIsActive(!isActive)}
                        className={`p-2 rounded-full shadow-lg text-white transition-all ${
                            isActive
                                ? 'bg-red-500 hover:bg-red-600 opacity-100'
                                : 'bg-blue-600/80 hover:bg-blue-700 opacity-60 hover:opacity-100'
                        }`}
                        title="Toggle inspect & report mode"
                    >
                        {isActive ? <X size={18} /> : <Bug size={18} />}
                    </button>
                </div>
            </div>

            {isActive && <InspectorOverlay onSelect={handleElementSelect} />}

            {/* Render Spatial Sticky Notes */}
            {isActive &&
                feedbackData.map((item) => {
                    if (item.type !== 'note' || !rects[item.id!]) return null;
                    const pos = rects[item.id!];

                    return (
                        <div
                            key={item.id}
                            className="absolute z-[9997] dev-sticky-note pointer-events-auto group"
                            style={{ top: pos.top, left: pos.left }}
                        >
                            {/* The Sticky Note Icon */}
                            <div className="bg-yellow-300 w-8 h-8 rounded-bl-xl shadow-md rotate-3 flex items-center justify-center cursor-pointer hover:rotate-0 transition-transform">
                                <FileText size={16} className="text-yellow-800" />
                            </div>

                            {/* The Note Hover Content */}
                            <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-yellow-100 border border-yellow-200 shadow-xl rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto origin-top-right scale-95 group-hover:scale-100 text-slate-800 text-sm">
                                <p className="font-medium">{item.description}</p>
                                <div className="text-[10px] text-yellow-600 mt-2 flex justify-between">
                                    <span>{new Date(item.created_at!).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

            {selectedElementHtml && (
                <ReportFormModal
                    html={selectedElementHtml}
                    selector={selectedSelector}
                    onClose={handleCloseModal}
                    onSuccess={handleSuccess}
                />
            )}

            {isListOpen && (
                <ReportListModal
                    reports={feedbackData}
                    onClose={() => setIsListOpen(false)}
                    onRefresh={loadFeedback}
                />
            )}
        </>
    );
}
