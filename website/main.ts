// BiDi Website — Language toggle, scroll reveals, smooth interactions

import { type Lang, SUPPORTED_LANGS, t } from "./i18n/index";

/**
 * Validates and returns a supported language.
 */
export function validateLang(lang: string | null): Lang {
  return SUPPORTED_LANGS.includes(lang as Lang) ? (lang as Lang) : "en";
}

/**
 * Initializes the language toggle button, applying the saved language preference or defaulting to English.
 */
export function initLanguageToggle() {
  const toggle = document.getElementById("langToggle") as HTMLButtonElement;
  if (!toggle) return;

  const rawLang = localStorage.getItem("bidi-lang");
  let currentLang: Lang = validateLang(rawLang);

  // Apply saved language on load
  if (currentLang !== "en") {
    applyLanguage(currentLang);
  }
  toggle.setAttribute("data-active", currentLang);

  toggle.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest(".lang-toggle__option") as HTMLElement;

    if (option) {
      const selectedLang = validateLang(option.getAttribute("data-lang"));
      if (selectedLang === currentLang) return;
      currentLang = selectedLang;
    } else {
      // Cycle through languages: en → ar → he → en
      const langIndex = SUPPORTED_LANGS.indexOf(currentLang);
      currentLang = SUPPORTED_LANGS[(langIndex + 1) % SUPPORTED_LANGS.length]!;
    }

    localStorage.setItem("bidi-lang", currentLang);
    applyLanguage(currentLang);
    toggle.setAttribute("data-active", currentLang);
  });
}

/**
 * Applies the specified language to the document, updating direction, translatable elements, and the page title.
 */
export function applyLanguage(lang: Lang) {
  const html = document.documentElement;

  // Set document direction and language
  html.setAttribute("lang", lang);
  html.setAttribute("dir", lang === "en" ? "ltr" : "rtl");

  // Update language toggle visual state
  const options = document.querySelectorAll(".lang-toggle__option");
  for (const opt of options) {
    if (opt.getAttribute("data-lang") === lang) {
      opt.classList.add("lang-toggle__option--active");
    } else {
      opt.classList.remove("lang-toggle__option--active");
    }
  }

  // Update all translatable elements
  const translatables = document.querySelectorAll<HTMLElement>(
    "[data-i18n], [data-i18n-aria-label]",
  );
  for (const el of translatables) {
    // Handle text content
    const key = el.getAttribute("data-i18n");
    if (key) {
      const value = t(lang, key);
      if (key.endsWith("$html")) {
        // SECURITY: innerHTML is safe because translations are bundled at build
        // time via t(lang, key) — never user input. Any translations using the
        // "$html" suffix must be reviewed by maintainers to avoid XSS.
        el.innerHTML = value;
      } else if (el.children.length === 0) {
        el.textContent = value;
      }
    }

    // Handle attribute translations (data-i18n-{attr} → {attr})
    for (const attr of el.attributes) {
      if (attr.name.startsWith("data-i18n-") && attr.name !== "data-i18n") {
        const targetAttr = attr.name.slice("data-i18n-".length);
        el.setAttribute(targetAttr, t(lang, attr.value));
      }
    }
  }

  // Update page title
  const titleKey = document.body.dataset.i18nTitle;
  document.title = t(lang, titleKey || "index.meta.pageTitle");
}

/**
 * Initializes the scroll reveal animations for sections and grid elements.
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll<HTMLElement>(
    ".demo, .features, .modes, .install, .cta-section",
  );

  // Add reveal class to sections
  for (const el of revealElements) {
    el.classList.add("reveal");
  }

  // Add stagger class to grids
  const staggerGrids = document.querySelectorAll<HTMLElement>(
    ".features__grid, .modes__grid, .install__steps",
  );
  for (const grid of staggerGrids) {
    grid.classList.add("reveal-stagger");
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal--visible");
          // Also trigger stagger for child grids
          const staggerChild = entry.target.querySelector(".reveal-stagger");
          if (staggerChild) {
            staggerChild.classList.add("reveal-stagger--visible");
          }
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
  );

  for (const el of revealElements) {
    observer.observe(el);
  }
}

/**
 * Initializes smooth scrolling for all internal anchor links.
 */
function initSmoothAnchors() {
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  for (const anchor of anchors) {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion.matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }
}

type Theme = "light" | "dark";
const SUPPORTED_THEMES: Theme[] = ["light", "dark"];

/**
 * Validates and returns a supported theme.
 */
export function validateTheme(theme: string | null): Theme {
  return SUPPORTED_THEMES.includes(theme as Theme)
    ? (theme as Theme)
    : getSystemTheme();
}

/**
 * Detects the system color scheme preference.
 * @returns The preferred theme ('light' or 'dark').
 */
function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * Initializes the theme toggle button, applying the saved theme preference or defaulting to the system theme.
 */
export function initThemeToggle() {
  const toggle = document.getElementById("themeToggle") as HTMLButtonElement;
  if (!toggle) return;

  const rawTheme = localStorage.getItem("bidi-theme");
  const saved = validateTheme(rawTheme);
  document.documentElement.setAttribute("data-theme", saved);
  toggle.setAttribute("aria-pressed", saved === "dark" ? "true" : "false");

  toggle.addEventListener("click", () => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme) ||
      getSystemTheme();
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bidi-theme", next);
    toggle.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
  });
}

/**
 * Initializes all site features in sequence, handling errors gracefully.
 */
function boot() {
  try {
    initThemeToggle();
  } catch (e) {
    console.error("initThemeToggle failed", e);
  }
  try {
    initLanguageToggle();
  } catch (e) {
    console.error("initLanguageToggle failed", e);
  }
  try {
    initScrollReveal();
  } catch (e) {
    console.error("initScrollReveal failed", e);
  }
  try {
    initSmoothAnchors();
  } catch (e) {
    console.error("initSmoothAnchors failed", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
