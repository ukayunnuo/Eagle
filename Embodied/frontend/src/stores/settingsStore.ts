import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings, SettingsStore } from '@/types/settings';

const defaultSettings: Settings = {
  defaultModel: 'nvidia/LocateAnything-3B',
  defaultDevice: 'cuda',
  defaultDtype: 'bfloat16',
  defaultMaxImageEdge: 768,
  theme: 'dark',
  language: 'zh',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateSettings: (newSettings: Partial<Settings>) => {
        set((state) => ({ ...state, ...newSettings }));
      },

      resetSettings: () => {
        set(defaultSettings);
      },
    }),
    {
      name: 'locateanything-settings',
    }
  )
);
