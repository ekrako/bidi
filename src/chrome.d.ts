// Minimal declaration so TypeScript knows about the global `chrome` object.
// This assumes you are running in a browser extension environment.
declare const chrome: {
  storage: {
    sync: {
      get(
        keys?: string | string[] | object,
      ): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
    onChanged: {
      addListener(
        callback: (
          changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
          areaName: string,
        ) => void,
      ): void;
    };
  };
};
