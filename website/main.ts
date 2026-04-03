// BiDi Website — Language toggle, scroll reveals, smooth interactions

type Lang = "en" | "he";
const SUPPORTED_LANGS: Lang[] = ["en", "he"];

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
  toggle.setAttribute("aria-pressed", currentLang === "he" ? "true" : "false");

  toggle.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const option = target.closest(".lang-toggle__option") as HTMLElement;

    if (option) {
      const selectedLang = validateLang(option.getAttribute("data-lang"));
      if (selectedLang === currentLang) return;
      currentLang = selectedLang;
    } else {
      // Toggle if clicked on the track or thumb
      currentLang = currentLang === "en" ? "he" : "en";
    }

    localStorage.setItem("bidi-lang", currentLang);
    applyLanguage(currentLang);
    toggle.setAttribute("data-active", currentLang);
    toggle.setAttribute("aria-pressed", currentLang === "he" ? "true" : "false");
  });
}

/**
 * Applies the specified language to the document, updating direction, translatable elements, and the page title.
 * @param lang - The language to apply ('en' or 'he').
 */
export function applyLanguage(lang: Lang) {
  const html = document.documentElement;

  // Set document direction and language
  html.setAttribute("lang", lang);
  html.setAttribute("dir", lang === "he" ? "rtl" : "ltr");

  // Update language toggle visual state
  const options = document.querySelectorAll(".lang-toggle__option");
  for (const opt of options) {
    if (opt.getAttribute("data-lang") === lang) {
      opt.classList.add("lang-toggle__option--active");
    } else {
      opt.classList.remove("lang-toggle__option--active");
    }
  }

  // Update all translatable elements (content and attributes)
  const translatables = document.querySelectorAll<HTMLElement>("[data-en], [data-he]");
  for (const el of translatables) {
    // 1. Handle content
    const text = el.getAttribute(`data-${lang}`);
    if (text !== null) {
      if (el.hasAttribute("data-html")) {
        el.innerHTML = text;
      } else if (el.children.length === 0) {
        el.textContent = text;
      }
    }

    // 2. Handle attributes (e.g., data-he-aria-label -> aria-label)
    for (const attr of el.attributes) {
      if (attr.name.startsWith(`data-${lang}-`)) {
        const targetAttr = attr.name.slice(`data-${lang}-`.length);
        el.setAttribute(targetAttr, attr.value);
      }
    }
  }

  // Update page title (use body data attributes if present, otherwise default)
  const titleEn = document.body.getAttribute("data-page-title-en");
  const titleHe = document.body.getAttribute("data-page-title-he");
  if (titleEn && titleHe) {
    document.title = lang === "he" ? titleHe : titleEn;
  } else {
    document.title =
      lang === "he"
        ? "BiDi — RTL חכם לרשת המודרנית"
        : "BiDi — Smart RTL for the Modern Web";
  }
}

/**
 * Initializes the scroll reveal animations for sections and grid elements.
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll<HTMLElement>(
    ".demo, .features, .modes, .install, .cta-section"
  );

  // Add reveal class to sections
  for (const el of revealElements) {
    el.classList.add("reveal");
  }

  // Add stagger class to grids
  const staggerGrids = document.querySelectorAll<HTMLElement>(
    ".features__grid, .modes__grid, .install__steps"
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
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
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
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  for (const anchor of anchors) {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion.matches ? "auto" : "smooth",
        block: "start"
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
  return SUPPORTED_THEMES.includes(theme as Theme) ? (theme as Theme) : getSystemTheme();
}

/**
 * Detects the system color scheme preference.
 * @returns The preferred theme ('light' or 'dark').
 */
function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
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
      (document.documentElement.getAttribute("data-theme") as Theme) || getSystemTheme();
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bidi-theme", next);
    toggle.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
  });
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initLanguageToggle();
  initScrollReveal();
  initSmoothAnchors();
});
