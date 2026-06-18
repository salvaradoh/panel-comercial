import type { ReactNode } from 'react';

interface DetailPanelProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function DetailPanel({ title, children, onClose }: DetailPanelProps) {
  return (
    <aside className="w-72 min-h-full bg-white border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          aria-label="Cerrar panel"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-600">
        {children}
      </div>
    </aside>
  );
}
