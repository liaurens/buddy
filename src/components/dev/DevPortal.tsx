import { useState } from 'react';
import { InspectorOverlay } from './InspectorOverlay';
import { ReportFormModal } from './ReportFormModal';
import { Bug, X } from 'lucide-react';

export function DevPortal() {
  const [isActive, setIsActive] = useState(false);
  const [selectedElementHtml, setSelectedElementHtml] = useState<string | null>(null);

  // If we are not in DEV mode, do not render anything
  if (!import.meta.env.DEV) {
    return null;
  }

  const handleElementSelect = (html: string) => {
    setSelectedElementHtml(html);
    setIsActive(false); // turn off inspector when selected
  };

  const handleCloseModal = () => {
    setSelectedElementHtml(null);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end space-y-2 pointer-events-none">
        {isActive && (
          <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg font-mono pointer-events-auto shadow-blue-500/20 mb-2 border border-blue-500 animate-pulse">
            Inspector Mode Active - Click any element
          </div>
        )}
        <button
          onClick={() => setIsActive(!isActive)}
          className={`p-3 rounded-full shadow-xl text-white pointer-events-auto transition-all ${
            isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title="Toggle Dev Reporter"
        >
          {isActive ? <X size={24} /> : <Bug size={24} />}
        </button>
      </div>

      {isActive && <InspectorOverlay onSelect={handleElementSelect} />}
      
      {selectedElementHtml && (
        <ReportFormModal 
          html={selectedElementHtml} 
          onClose={handleCloseModal} 
        />
      )}
    </>
  );
}
