// BiDi Website — Language toggle, scroll reveals, smooth interactions

type Lang = "en" | "he";

function initLanguageToggle() {
  const toggle = document.getElementById("langToggle") as HTMLButtonElement;
  if (!toggle) return;

  let currentLang: Lang = (localStorage.getItem("bidi-lang") as Lang) || "en";

  // Apply saved language on load
  if (currentLang !== "en") {
    applyLanguage(currentLang);
  }
  toggle.setAttribute("data-active", currentLang);

  toggle.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "he" : "en";
    localStorage.setItem("bidi-lang", currentLang);
    applyLanguage(currentLang);
    toggle.setAttribute("data-active", currentLang);
  });
}

function applyLanguage(lang: Lang) {
  const html = document.documentElement;

  // Set document direction and language
  html.setAttribute("lang", lang);
  html.setAttribute("dir", lang === "he" ? "rtl" : "ltr");

  // Update all translatable elements
  const translatables = document.querySelectorAll<HTMLElement>("[data-en][data-he]");
  for (const el of translatables) {
    const text = el.getAttribute(`data-${lang}`);
    if (text !== null) {
      el.textContent = text;
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

function initSmoothAnchors() {
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
  for (const anchor of anchors) {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function initThemeToggle() {
  const toggle = document.getElementById("themeToggle") as HTMLButtonElement;
  if (!toggle) return;

  const saved = localStorage.getItem("bidi-theme") as Theme | null;
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  }

  toggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") || getSystemTheme();
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bidi-theme", next);
  });
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initLanguageToggle();
  initScrollReveal();
  initSmoothAnchors();
});
