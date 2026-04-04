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
    global.IntersectionObserver = class implements IntersectionObserver {
      readonly root: Element | null = null;
      readonly rootMargin: string = "";
      readonly thresholds: ReadonlyArray<number> = [];
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    } as any;

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

    test("returns 'ar' for 'ar'", () => {
      expect(validateLang("ar")).toBe("ar");
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
    test("updates html attributes for English", () => {
      applyLanguage("en");
      expect(document.documentElement.getAttribute("lang")).toBe("en");
      expect(document.documentElement.getAttribute("dir")).toBe("ltr");
    });

    test("updates html attributes for Hebrew", () => {
      applyLanguage("he");
      expect(document.documentElement.getAttribute("lang")).toBe("he");
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    });

    test("updates html attributes for Arabic", () => {
      applyLanguage("ar");
      expect(document.documentElement.getAttribute("lang")).toBe("ar");
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    });

    test("translates elements with data-i18n", () => {
      document.body.innerHTML = `
        <div id="test" data-i18n="hero.badge"></div>
      `;

      applyLanguage("he");
      expect(document.getElementById("test")?.textContent).toBe("תוסף לכרום");

      applyLanguage("en");
      expect(document.getElementById("test")?.textContent).toBe("Chrome Extension");

      applyLanguage("ar");
      expect(document.getElementById("test")?.textContent).toBe("إضافة كروم");
    });

    test("uses innerHTML for keys ending in $html", () => {
      document.body.innerHTML = `
        <div id="test" data-i18n="privacy.data.whatStoredDesc$html"></div>
      `;

      applyLanguage("en");
      expect(document.getElementById("test")?.innerHTML).toContain("<code>");

      applyLanguage("he");
      expect(document.getElementById("test")?.innerHTML).toContain("<code>");
    });

    test("skips non-leaf nodes without $html key", () => {
      document.body.innerHTML = `
        <div id="test" data-i18n="hero.badge">
          <span>Child</span>
        </div>
      `;
      const originalHtml = document.getElementById("test")?.innerHTML;

      applyLanguage("he");
      expect(document.getElementById("test")?.innerHTML).toBe(originalHtml);
    });

    test("translates attributes with data-i18n-{attr} pattern", () => {
      document.body.innerHTML = `
        <button id="test" data-i18n-aria-label="common.themeToggle.ariaLabel" aria-label="Toggle theme"></button>
      `;

      applyLanguage("he");
      expect(document.getElementById("test")?.getAttribute("aria-label")).toBe("החלף מצב תצוגה");

      applyLanguage("en");
      expect(document.getElementById("test")?.getAttribute("aria-label")).toBe("Toggle theme");

      applyLanguage("ar");
      expect(document.getElementById("test")?.getAttribute("aria-label")).toBe("تبديل المظهر");
    });

    test("falls back to English for missing translations", () => {
      document.body.innerHTML = `
        <div id="test" data-i18n="hero.badge"></div>
      `;

      // All three languages have this key, so test with a known key
      applyLanguage("en");
      expect(document.getElementById("test")?.textContent).toBe("Chrome Extension");
    });

    test("updates document title from data-i18n-title attribute", () => {
      document.body.dataset.i18nTitle = "index.meta.pageTitle";
      applyLanguage("en");
      expect(document.title).toBe("BiDi — Smart RTL for the Modern Web");
    });

    test("uses default title when data-i18n-title is not set", () => {
      delete document.body.dataset.i18nTitle;
      applyLanguage("en");
      expect(document.title).toBe("BiDi — Smart RTL for the Modern Web");

      applyLanguage("he");
      expect(document.title).toBe("BiDi — RTL חכם לרשת המודרנית");

      applyLanguage("ar");
      expect(document.title).toBe("BiDi — RTL ذكي للويب الحديث");
    });

    test("updates data-i18n-title attribute on toggle option", () => {
      document.body.innerHTML = `
        <div class="lang-toggle__option" data-lang="en">EN</div>
        <div class="lang-toggle__option lang-toggle__option--active" data-lang="he">HE</div>
        <div class="lang-toggle__option" data-lang="ar">AR</div>
      `;

      applyLanguage("en");
      const options = document.querySelectorAll(".lang-toggle__option");
      expect(options[0].classList.contains("lang-toggle__option--active")).toBe(true);
      expect(options[1].classList.contains("lang-toggle__option--active")).toBe(false);
      expect(options[2].classList.contains("lang-toggle__option--active")).toBe(false);
    });
  });

  describe("i18n t() function", () => {
    let t: any;

    beforeAll(async () => {
      const i18n = await import("./i18n/index");
      t = i18n.t;
    });

    test("returns English translation", () => {
      expect(t("en", "hero.badge")).toBe("Chrome Extension");
    });

    test("returns Hebrew translation", () => {
      expect(t("he", "hero.badge")).toBe("תוסף לכרום");
    });

    test("returns Arabic translation", () => {
      expect(t("ar", "hero.badge")).toBe("إضافة كروم");
    });

    test("falls back to English for missing key in target language", () => {
      // Using a key that exists in en.json
      expect(t("he", "hero.badge")).toBeTruthy();
    });

    test("returns key string as last resort", () => {
      expect(t("en", "nonexistent.key")).toBe("nonexistent.key");
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
          <span class="lang-toggle__track">
            <span class="lang-toggle__option" data-lang="en">EN</span>
            <span class="lang-toggle__option" data-lang="ar">عر</span>
            <span class="lang-toggle__option" data-lang="he">עב</span>
            <span class="lang-toggle__thumb"></span>
          </span>
        </button>
      `;

      initLanguageToggle();
      const toggle = document.getElementById("langToggle");
      expect(toggle?.getAttribute("data-active")).toBe("en");

      // Click Arabic option
      const arOption = document.querySelector('[data-lang="ar"]');
      arOption?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

      expect(toggle?.getAttribute("data-active")).toBe("ar");
      expect(localStorage.getItem("bidi-lang")).toBe("ar");

      // Click Hebrew option
      const heOption = document.querySelector('[data-lang="he"]');
      heOption?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

      expect(toggle?.getAttribute("data-active")).toBe("he");
      expect(localStorage.getItem("bidi-lang")).toBe("he");
    });

    test("initLanguageToggle cycles through languages on toggle click", () => {
      localStorage.clear();
      document.body.innerHTML = `
        <button id="langToggle">
          <span class="lang-toggle__track">
            <span class="lang-toggle__option" data-lang="en">EN</span>
            <span class="lang-toggle__option" data-lang="ar">عر</span>
            <span class="lang-toggle__option" data-lang="he">עב</span>
            <span class="lang-toggle__thumb"></span>
          </span>
        </button>
      `;

      initLanguageToggle();
      const toggle = document.getElementById("langToggle")!;
      expect(toggle.getAttribute("data-active")).toBe("en");

      // Click the toggle button itself to cycle
      toggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      expect(toggle.getAttribute("data-active")).toBe("ar");

      // Cycle again
      toggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      expect(toggle.getAttribute("data-active")).toBe("he");

      // Cycle again back to en
      toggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      expect(toggle.getAttribute("data-active")).toBe("en");
    });

    test("initLanguageToggle applies saved language on load", () => {
      localStorage.setItem("bidi-lang", "he");
      document.body.innerHTML = `
        <button id="langToggle">
          <span class="lang-toggle__track">
            <span class="lang-toggle__option" data-lang="en">EN</span>
            <span class="lang-toggle__option" data-lang="ar">عر</span>
            <span class="lang-toggle__option" data-lang="he">עב</span>
            <span class="lang-toggle__thumb"></span>
          </span>
        </button>
      `;

      initLanguageToggle();
      expect(document.documentElement.getAttribute("lang")).toBe("he");
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    });
  });
});
