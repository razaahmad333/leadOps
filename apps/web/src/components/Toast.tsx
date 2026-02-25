import React from 'react';
import { useToast, type ToastType } from '../context/ToastContext.tsx';

function bgClass(type: ToastType): string {
  if (type === 'success') return 'bg-green-600';
  if (type === 'error') return 'bg-red-600';
  return 'bg-brand-600';
}

export function Toast(): React.JSX.Element {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return <></>;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex min-w-[240px] items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${bgClass(t.type)}`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
