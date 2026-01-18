'use client';

import { useState, useRef, useEffect } from 'react';

interface InfoPopoverProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoPopover({ title, children }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <>
      <div className="relative inline-block">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setShowTooltip(!isOpen)}
          onMouseLeave={() => setShowTooltip(false)}
          className="w-5 h-5 rounded-full border border-indigo-400 text-indigo-400 flex items-center justify-center hover:bg-indigo-400 hover:text-slate-900 transition cursor-help text-xs font-bold"
          aria-label="How was this calculated?"
        >
          ?
        </button>

        {showTooltip && !isOpen && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded whitespace-nowrap border border-slate-700 pointer-events-none">
            How was this calculated?
          </div>
        )}

        {isOpen && (
          <div
            ref={popoverRef}
            className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 min-w-80 max-w-md max-h-96 flex flex-col"
          >
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-800 border-t border-l border-slate-600 rotate-45"></div>

            <div className="p-4 flex-shrink-0">
              <h3 className="font-semibold text-white mb-3 text-sm">{title}</h3>
            </div>
            <div className="text-slate-300 text-xs space-y-2 overflow-y-auto flex-1 px-4 pb-4 bg-slate-800">{children}</div>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 pointer-events-none" />
      )}
    </>
  );
}
