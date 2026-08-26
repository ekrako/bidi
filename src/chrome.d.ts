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
  tabs: {
    query(queryInfo: {
      active?: boolean;
      currentWindow?: boolean;
      url?: string | string[];
    }): Promise<Array<{ id?: number; url?: string }>>;
    get(tabId: number): Promise<{ id?: number; url?: string }>;
    create(createProperties: { url: string }): Promise<{ id?: number }>;
    onActivated: { addListener(cb: (info: { tabId: number }) => void): void };
    onUpdated: {
      addListener(
        cb: (
          tabId: number,
          changeInfo: { status?: string },
          tab: { id?: number; url?: string },
        ) => void,
      ): void;
    };
  };
  runtime: {
    getURL(path: string): string;
    getManifest(): { version: string; name: string };
    sendMessage(message: unknown): Promise<unknown>;
    onInstalled: { addListener(cb: () => void): void };
    onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => true | void,
      ): void;
    };
  };
  scripting: {
    executeScript<T>(injection: {
      target: { tabId: number };
      files?: string[];
      func?: () => T;
    }): Promise<Array<{ result: T }>>;
  };
  action: {
    setIcon(details: {
      tabId?: number;
      imageData?: Record<string, ImageData>;
    }): void;
    setBadgeText(details: { tabId?: number; text: string }): void;
  };
};
