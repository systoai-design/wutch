import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggle: () => void;
  toggleMobile: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebar = create<SidebarStore>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isMobileOpen: false,
      toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      toggleMobile: () => set((state) => ({ isMobileOpen: !state.isMobileOpen })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setMobileOpen: (open) => set({ isMobileOpen: open }),
    }),
    {
      name: 'sidebar-storage',
    }
  )
);
