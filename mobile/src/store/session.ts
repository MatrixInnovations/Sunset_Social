import { create } from 'zustand';

import type { ScanResult } from '@/domain/types';

type SessionState = {
  savedIds: string[];
  vipJoined: boolean;
  lastDoor: ScanResult | null;
  toggleSaved: (id: string) => void;
  setVipJoined: (joined: boolean) => void;
  setLastDoor: (result: ScanResult | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  savedIds: [],
  vipJoined: false,
  lastDoor: null,
  toggleSaved: (id) =>
    set((state) => ({
      savedIds: state.savedIds.includes(id) ? state.savedIds.filter((item) => item !== id) : [...state.savedIds, id],
    })),
  setVipJoined: (vipJoined) => set({ vipJoined }),
  setLastDoor: (lastDoor) => set({ lastDoor }),
}));
