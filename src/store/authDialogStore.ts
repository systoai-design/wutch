import { create } from 'zustand';

interface AuthDialogStore {
  isOpen: boolean;
  defaultTab: 'login' | 'signup';
  open: (tab?: 'login' | 'signup') => void;
  close: () => void;
}

export const useAuthDialog = create<AuthDialogStore>((set) => ({
  isOpen: false,
  defaultTab: 'login',
  open: (tab = 'login') => set({ isOpen: true, defaultTab: tab }),
  close: () => set({ isOpen: false }),
}));
