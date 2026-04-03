import { test, expect, describe, beforeAll } from "bun:test";
import { GlobalWindow } from "happy-dom";

describe("Website Logic", () => {
  let validateLang: any;
  let validateTheme: any;
  let applyLanguage: any;

  beforeAll(async () => {
    const window = new GlobalWindow();
    global.window = window as any;
    global.document = window.document as any;
    global.localStorage = window.localStorage as any;
    global.navigator = window.navigator as any;
    global.Node = window.Node as any;
    global.HTMLElement = window.HTMLElement as any;
    global.matchMedia = window.matchMedia.bind(window) as any;

    // Load module after globals are set
    const main = await import("./main");
    validateLang = main.validateLang;
    validateTheme = main.validateTheme;
    applyLanguage = main.applyLanguage;
  });

  describe("validateLang", () => {
    test("returns 'en' for null", () => {
      expect(validateLang(null)).toBe("en");
    });

    test("returns 'en' for unsupported language", () => {
      expect(validateLang("fr")).toBe("en");
    });

    test("returns 'he' for 'he'", () => {
      expect(validateLang("he")).toBe("he");
    });

    test("returns 'en' for 'en'", () => {
      expect(validateLang("en")).toBe("en");
    });
  });

  describe("validateTheme", () => {
    test("returns 'dark' or 'light' based on system if null", () => {
      // Mock matchMedia for system theme
      global.matchMedia = (query: string) => ({
        matches: query === "(prefers-color-scheme: light)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      } as any);

      expect(validateTheme(null)).toBe("light");
    });

    test("returns 'dark' for 'dark'", () => {
      expect(validateTheme("dark")).toBe("dark");
    });

    test("returns 'light' for 'light'", () => {
      expect(validateTheme("light")).toBe("light");
    });
  });

  describe("applyLanguage", () => {
    test("updates html attributes", () => {
      applyLanguage("he");
      expect(document.documentElement.getAttribute("lang")).toBe("he");
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");

      applyLanguage("en");
      expect(document.documentElement.getAttribute("lang")).toBe("en");
      expect(document.documentElement.getAttribute("dir")).toBe("ltr");
    });

    test("translates elements with data-en/data-he", () => {
      document.body.innerHTML = `
        <div id="test" data-en="English" data-he="עברית"></div>
      `;
      
      applyLanguage("he");
      expect(document.getElementById("test")?.textContent).toBe("עברית");

      applyLanguage("en");
      expect(document.getElementById("test")?.textContent).toBe("English");
    });

    test("preserves markup when data-html is present", () => {
      document.body.innerHTML = `
        <div id="test" data-html data-en="<b>English</b>" data-he="<b>עברית</b>"></div>
      `;
      
      applyLanguage("he");
      expect(document.getElementById("test")?.innerHTML).toBe("<b>עברית</b>");

      applyLanguage("en");
      expect(document.getElementById("test")?.innerHTML).toBe("<b>English</b>");
    });

    test("skips non-leaf nodes without data-html", () => {
      document.body.innerHTML = `
        <div id="test" data-en="New English" data-he="עברית חדשה">
          <span>Child</span>
        </div>
      `;
      const originalHtml = document.getElementById("test")?.innerHTML;
      
      applyLanguage("he");
      expect(document.getElementById("test")?.innerHTML).toBe(originalHtml);
    });

    test("translates attributes with data-lang-attr pattern", () => {
      document.body.innerHTML = `
        <button id="test" data-en="" data-he="" data-en-aria-label="Eng Label" data-he-aria-label="Heb Label" aria-label="Eng Label"></button>
      `;
      
      applyLanguage("he");
      expect(document.getElementById("test")?.getAttribute("aria-label")).toBe("Heb Label");

      applyLanguage("en");
      expect(document.getElementById("test")?.getAttribute("aria-label")).toBe("Eng Label");
    });
  });

  describe("Toggles", () => {
    let initLanguageToggle: any;
    let initThemeToggle: any;

    beforeAll(async () => {
      const main = await import("./main");
      initLanguageToggle = main.initLanguageToggle;
      initThemeToggle = main.initThemeToggle;
    });

    test("initLanguageToggle setup and click", () => {
      localStorage.clear();
      document.body.innerHTML = `
        <button id="langToggle">
          <span class="lang-toggle__option" data-lang="en">EN</span>
          <span class="lang-toggle__option" data-lang="he">HE</span>
        </button>
      `;
      
      initLanguageToggle();
      const toggle = document.getElementById("langToggle");
      expect(toggle?.getAttribute("data-active")).toBe("en");

      // Click HE option
      const heOption = document.querySelector('[data-lang="he"]');
      heOption?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      
      expect(toggle?.getAttribute("data-active")).toBe("he");
      expect(localStorage.getItem("bidi-lang")).toBe("he");
    });

    test("initThemeToggle setup and click", () => {
      localStorage.clear();
      document.body.innerHTML = `
        <button id="themeToggle"></button>
      `;
      
      initThemeToggle();
      const toggle = document.getElementById("themeToggle");
      const initialTheme = document.documentElement.getAttribute("data-theme");
      expect(["light", "dark"]).toContain(initialTheme);

      toggle?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      const nextTheme = initialTheme === "dark" ? "light" : "dark";
      expect(document.documentElement.getAttribute("data-theme")).toBe(nextTheme);
      expect(localStorage.getItem("bidi-theme")).toBe(nextTheme);
    });
  });
});
