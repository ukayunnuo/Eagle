export interface Settings {
  defaultModel: string;
  defaultDevice: 'cuda' | 'cpu';
  defaultDtype: 'bfloat16' | 'float16' | 'float32';
  defaultMaxImageEdge: number;
  theme: 'dark' | 'light';
  language: 'zh' | 'en';
}

export interface SettingsStore extends Settings {
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}
