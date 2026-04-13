import React, { useEffect, useState } from 'react';

interface InspectorOverlayProps {
  onSelect: (html: string) => void;
}

export function InspectorOverlay({ onSelect }: InspectorOverlayProps) {
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [selectedElements, setSelectedElements] = useState<HTMLElement[]>([]);

  useEffect(() => {
    // Inject styles for selected elements
    const styleId = 'dev-inspector-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .dev-selected-element {
          outline: 3px solid #16a34a !important;
          outline-offset: -3px;
          background-color: rgba(22, 163, 74, 0.15) !important;
          transition: all 0.15s ease;
        }
      `;
      document.head.appendChild(style);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        // Ignore the DevPortal UI itself
        if (target.closest('.fixed.bottom-4.right-4') || target.closest('.dev-submit-btn') || target.id === 'dev-inspector-overlay') {
          setHoverRect(null);
          return;
        }
        setHoverRect(target.getBoundingClientRect());
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        // Ignore our UI elements
        if (target.closest('.fixed.bottom-4.right-4') || target.closest('.dev-submit-btn') || target.id === 'dev-inspector-overlay') {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        
        setSelectedElements(prev => {
          const isSelected = prev.includes(target);
          if (isSelected) {
            target.classList.remove('dev-selected-element');
            return prev.filter(el => el !== target);
          } else {
            target.classList.add('dev-selected-element');
            return [...prev, target];
          }
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      // Clean up styles
      Array.from(document.querySelectorAll('.dev-selected-element')).forEach(el => {
        el.classList.remove('dev-selected-element');
      });
      const styleEl = document.getElementById(styleId);
      if (styleEl) styleEl.remove();
    };
  }, []);

  const handleReportSelected = () => {
    const fullHtml = selectedElements.map((el, index) => {
      // Clone element to clean it up before saving
      const clone = el.cloneNode(true) as HTMLElement;
      // Remove our highlight class from the submitted code layer
      clone.classList.remove('dev-selected-element');
      const html = clone.outerHTML || '';
      const trimmed = html.length > 1500 ? html.substring(0, 1500) + '... (truncated)' : html;
      return `<!-- Item ${index + 1} -->\n${trimmed}`;
    }).join('\n\n');
    
    // Clear the selections locally before unmounting
    selectedElements.forEach(el => el.classList.remove('dev-selected-element'));
    onSelect(fullHtml);
  };

  return (
    <>
      {hoverRect && (
        <div
          id="dev-inspector-overlay"
          className="fixed z-[9998] pointer-events-none bg-blue-500/20 border-2 border-blue-500 transition-all duration-75 ease-out"
          style={{
            left: hoverRect.left,
            top: hoverRect.top,
            width: hoverRect.width,
            height: hoverRect.height,
          }}
        />
      )}
      
      {selectedElements.length > 0 && (
        <div className="dev-submit-btn fixed bottom-20 right-4 z-[9999] pointer-events-auto">
          <button 
            type="button"
            onClick={handleReportSelected}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-full font-medium shadow-xl flex items-center gap-2 transform transition-all animate-in slide-in-from-bottom-2"
          >
            Review {selectedElements.length} {selectedElements.length === 1 ? 'Item' : 'Items'}
          </button>
        </div>
      )}
    </>
  );
}
