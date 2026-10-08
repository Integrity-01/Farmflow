import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'info' | 'warning' | 'danger';

export interface ToastInput {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastItem extends ToastInput {
  id: string;
  title: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  add: (input: ToastInput) => void;
  remove: (id: string) => void;
  dismissAll: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (input) => {
    toastCounter += 1;
    const item: ToastItem = {
      id: `toast-${Date.now()}-${toastCounter}`,
      title: input.title ?? '',
      description: input.description,
      variant: input.variant ?? 'default',
      duration: input.duration ?? 5000,
    };
    set((state) => ({ toasts: [...state.toasts, item] }));
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  dismissAll: () => set({ toasts: [] }),
}));

export function useToast() {
  const add = useToastStore((state) => state.add);
  return {
    toast: (input: ToastInput) => add(input),
  };
}