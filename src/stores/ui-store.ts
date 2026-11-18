"use client";

import { create } from "zustand";

interface UiState {
  drawerOpen: boolean;
  editingBrand: boolean;
  setEditingBrand: (editing: boolean) => void;
  brandingOpen: boolean;
  setBrandingOpen: (open: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: false,
  editingBrand: false,
  setEditingBrand: (editingBrand) => set({ editingBrand }),
  brandingOpen: false,
  setBrandingOpen: (brandingOpen) => set({ brandingOpen }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
}));
