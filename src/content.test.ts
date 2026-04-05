import { test, expect, beforeEach, afterAll, describe } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Register DOM globals (document, HTMLElement, Node, etc.)
GlobalRegistrator.register({ url: "https://test.example.com" });

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

// Mock chrome APIs (onChanged listener receives (changes, area) — content.ts filters by area === "sync")
(globalThis as Record<string, unknown>).chrome = {
  storage: {
    sync: {
      get: async () => ({ sites: {}, autoByDefault: false }),
      set: async () => {},
    },
    onChanged: {
      addListener: () => {},
    },
  },
};

const {
  MARKER,
  getInlineText,
  applyRtlToElement,
  scanForRtl,
  clearAutoDirection,
} = await import("./content");

function html(tag: string, children: (string | HTMLElement)[] = []): HTMLElement {
  const el = document.createElement(tag);
  for (const child of children) {
    if (typeof child === "string") {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

// ---------- getInlineText ----------

describe("getInlineText", () => {
  test("returns direct text nodes", () => {
    const div = html("div", ["שלום עולם"]);
    expect(getInlineText(div)).toBe("שלום עולם");
  });

  test("includes text from inline children (span, em, b)", () => {
    const div = html("div", [
      html("span", ["שלום"]),
      " ",
      html("em", ["עולם"]),
    ]);
    expect(getInlineText(div)).toBe("שלום עולם");
  });

  test("ignores text from block children (div, p)", () => {
    const outer = html("div", [
      html("div", ["שלום עולם"]),
    ]);
    expect(getInlineText(outer).trim()).toBe("");
  });

  test("ignores custom element children", () => {
    const custom = document.createElement("my-component");
    custom.textContent = "שלום עולם";
    const outer = html("div", [custom]);
    expect(getInlineText(outer).trim()).toBe("");
  });

  test("collects from mixed inline and text nodes", () => {
    const div = html("div", [
      "Hello ",
      html("b", ["עולם"]),
      " world",
    ]);
    expect(getInlineText(div)).toBe("Hello עולם world");
  });
});

// ---------- applyRtlToElement: block elements ----------

describe("applyRtlToElement — block elements", () => {
  test("sets direction: rtl on block with predominantly RTL text", () => {
    const div = html("div", ["שלום עולם כיתוב בעברית"]);
    document.body.appendChild(div);
    applyRtlToElement(div);

    expect(div.style.direction).toBe("rtl");
    expect(div.hasAttribute(MARKER)).toBe(true);
  });

  test("does not set direction on block with predominantly LTR text", () => {
    const div = html("div", ["Hello world, this is English"]);
    document.body.appendChild(div);
    applyRtlToElement(div);

    expect(div.style.direction).toBe("");
    expect(div.hasAttribute(MARKER)).toBe(false);
  });

  test("sets direction: rtl on block with RTL inline children (NotebookLM pattern)", () => {
    // Simulates NotebookLM: <div class="paragraph"><span>Hebrew</span><span>more Hebrew</span></div>
    const div = html("div", [
      html("span", ["כדי לתכנת חכם ויעיל יותר"]),
      html("span", [", המקורות מציעים מספר עקרונות"]),
    ]);
    document.body.appendChild(div);
    applyRtlToElement(div);

    expect(div.style.direction).toBe("rtl");
    expect(div.hasAttribute(MARKER)).toBe(true);
  });

  test("skips wrapper block that has only block children", () => {
    const wrapper = html("div", [
      html("div", ["שלום עולם"]),
      html("div", ["עוד טקסט"]),
    ]);
    document.body.appendChild(wrapper);
    applyRtlToElement(wrapper);

    // wrapper has no inline content, so getInlineText returns empty
    expect(wrapper.style.direction).toBe("");
    expect(wrapper.hasAttribute(MARKER)).toBe(false);
  });

  test("sets direction: rtl on li with bold and span children", () => {
    const li = html("li", [
      html("b", ["להתחיל מבעיות שאתם כבר יודעים:"]),
      html("span", [" כך תוכלו לבחון את היכולות של המודל"]),
    ]);
    document.body.appendChild(li);
    applyRtlToElement(li);

    expect(li.style.direction).toBe("rtl");
  });

  test("removes direction when text changes from RTL to LTR", () => {
    const div = html("div", ["שלום עולם"]);
    document.body.appendChild(div);
    applyRtlToElement(div);
    expect(div.style.direction).toBe("rtl");

    // Simulate text change to English
    div.textContent = "Hello world";
    applyRtlToElement(div);

    expect(div.style.direction).toBe("");
    expect(div.hasAttribute(MARKER)).toBe(false);
  });

  test("clears stale RTL state when inline children are removed", () => {
    const div = html("div", [
      html("span", ["שלום עולם כיתוב בעברית"]),
    ]);
    document.body.appendChild(div);
    applyRtlToElement(div);
    expect(div.style.direction).toBe("rtl");
    expect(div.hasAttribute(MARKER)).toBe(true);

    // Remove all inline children, leaving only a block child
    div.innerHTML = "";
    div.appendChild(html("div", ["nested block"]));
    applyRtlToElement(div);

    expect(div.style.direction).toBe("");
    expect(div.hasAttribute(MARKER)).toBe(false);
  });

  test("does not modify block with empty text", () => {
    const div = html("div", ["   "]);
    document.body.appendChild(div);
    applyRtlToElement(div);

    expect(div.style.direction).toBe("");
    expect(div.hasAttribute(MARKER)).toBe(false);
  });

  test("handles mixed RTL/LTR — English dominant stays LTR", () => {
    // Claude.ai pattern: English paragraph with a few Hebrew words
    const p = html("p", [
      html("em", ["\"מה את מחפשת?\""]),
      " the old vendor asked — ",
      html("em", ["what are you looking for?"]),
      " She smiled.",
    ]);
    document.body.appendChild(p);
    applyRtlToElement(p);

    expect(p.style.direction).toBe("");
    expect(p.hasAttribute(MARKER)).toBe(false);
  });
});

// ---------- applyRtlToElement: inline elements ----------

describe("applyRtlToElement — inline elements in LTR context", () => {
  test("sets unicode-bidi: plaintext on inline element with RTL text", () => {
    const p = html("p");
    const em = html("em", ["שלום עולם"]);
    p.appendChild(em);
    document.body.appendChild(p);

    applyRtlToElement(em);

    expect(em.style.unicodeBidi).toBe("plaintext");
    expect(em.hasAttribute(MARKER)).toBe(true);
  });

  test("does not mark wrapper span when RTL is only in nested child", () => {
    // <span><b>שלום</b> hello</span> — only <b> should be marked, not outer span
    const span = html("span", [html("b", ["שלום"]), " hello"]);
    const p = html("p");
    p.appendChild(span);
    document.body.appendChild(p);

    scanForRtl(p);

    const b = span.querySelector("b") as HTMLElement;
    expect(b.style.unicodeBidi).toBe("plaintext");
    expect(b.hasAttribute(MARKER)).toBe(true);
    expect(span.style.unicodeBidi).toBe("");
    expect(span.hasAttribute(MARKER)).toBe(false);
  });

  test("marks inline element with direct RTL text even if it has children", () => {
    // <span>שלום <b>world</b></span> — span has direct RTL text, should be marked
    const span = html("span", ["שלום ", html("b", ["world"])]);
    const p = html("p");
    p.appendChild(span);
    document.body.appendChild(p);

    applyRtlToElement(span);

    expect(span.style.unicodeBidi).toBe("plaintext");
    expect(span.hasAttribute(MARKER)).toBe(true);
  });

  test("does not modify inline element with only LTR text", () => {
    const p = html("p");
    const em = html("em", ["Hello world"]);
    p.appendChild(em);
    document.body.appendChild(p);

    applyRtlToElement(em);

    expect(em.style.unicodeBidi).toBe("");
    expect(em.hasAttribute(MARKER)).toBe(false);
  });

  test("applies to span with RTL text in LTR context", () => {
    const div = html("div");
    const span = html("span", ["תבלינים"]);
    div.appendChild(span);
    document.body.appendChild(div);

    applyRtlToElement(span);

    expect(span.style.unicodeBidi).toBe("plaintext");
  });

  test.each(["b", "strong", "code"])("applies to <%s> with RTL text in LTR context", (tag) => {
    const div = html("div");
    const el = html(tag, ["עברית"]);
    div.appendChild(el);
    document.body.appendChild(div);

    applyRtlToElement(el);
    expect(el.style.unicodeBidi).toBe("plaintext");
  });
});

describe("applyRtlToElement — inline elements in RTL context", () => {
  test("skips inline element when parent block has data-bidi marker", () => {
    // Simulates NotebookLM: block has direction: rtl, child span should NOT get unicode-bidi
    const div = html("div", [
      html("span", ["כדי לתכנת חכם"]),
    ]);
    div.setAttribute(MARKER, "");
    div.style.direction = "rtl";
    document.body.appendChild(div);

    const span = div.querySelector("span") as HTMLElement;
    applyRtlToElement(span);

    expect(span.style.unicodeBidi).toBe("");
    expect(span.hasAttribute(MARKER)).toBe(false);
  });

  test("skips inline element when ancestor (not direct parent) has data-bidi", () => {
    const outer = html("div");
    outer.setAttribute(MARKER, "");
    const inner = html("div");
    const span = html("span", ["שלום"]);
    inner.appendChild(span);
    outer.appendChild(inner);
    document.body.appendChild(outer);

    applyRtlToElement(span);

    expect(span.style.unicodeBidi).toBe("");
    expect(span.hasAttribute(MARKER)).toBe(false);
  });

  test("removes unicode-bidi from inline when parent gains data-bidi", () => {
    const div = html("div");
    const em = html("em", ["שלום עולם"]);
    div.appendChild(em);
    document.body.appendChild(div);

    // First: LTR context → em gets unicode-bidi
    applyRtlToElement(em);
    expect(em.style.unicodeBidi).toBe("plaintext");
    expect(em.hasAttribute(MARKER)).toBe(true);

    // Now parent becomes RTL context
    div.setAttribute(MARKER, "");
    div.style.direction = "rtl";

    // Re-apply → em should be cleaned up
    applyRtlToElement(em);
    expect(em.style.unicodeBidi).toBe("");
    expect(em.hasAttribute(MARKER)).toBe(false);
  });
});

// ---------- scanForRtl ----------

describe("scanForRtl", () => {
  test("processes all elements in subtree", () => {
    const root = html("div", [
      html("div", [
        html("span", ["שלום"]),
        " עולם כיתוב בעברית",
      ]),
      html("p", ["Hello world in English"]),
    ]);
    document.body.appendChild(root);

    scanForRtl(root);

    const rtlDiv = root.querySelector("div") as HTMLElement;
    expect(rtlDiv.style.direction).toBe("rtl");

    const ltrP = root.querySelector("p") as HTMLElement;
    expect(ltrP.style.direction).toBe("");
  });

  test("inline elements in RTL block are skipped (NotebookLM pattern)", () => {
    // Tree walker is preorder: block processed before its inline children
    const paragraph = html("div", [
      html("span", ["כדי לתכנת חכם ויעיל יותר"]),
      html("span", [", המקורות מציעים עקרונות"]),
    ]);
    document.body.appendChild(paragraph);

    scanForRtl(paragraph);

    // Block gets direction: rtl
    expect(paragraph.style.direction).toBe("rtl");
    expect(paragraph.hasAttribute(MARKER)).toBe(true);

    // Inline children should NOT get unicode-bidi (parent has data-bidi)
    const spans = paragraph.querySelectorAll("span");
    for (const span of spans) {
      expect((span as HTMLElement).style.unicodeBidi).toBe("");
    }
  });

  test("inline elements in LTR block get unicode-bidi (Claude.ai pattern)", () => {
    const paragraph = html("p", [
      html("em", ["\"שלום\""]),
      " she said, then walked away into the evening light.",
    ]);
    document.body.appendChild(paragraph);

    scanForRtl(paragraph);

    // Block stays LTR (English dominant)
    expect(paragraph.style.direction).toBe("");
    expect(paragraph.hasAttribute(MARKER)).toBe(false);

    // Inline em with Hebrew gets unicode-bidi: plaintext
    const em = paragraph.querySelector("em") as HTMLElement;
    expect(em.style.unicodeBidi).toBe("plaintext");
    expect(em.hasAttribute(MARKER)).toBe(true);
  });

  test("handles deeply nested structure", () => {
    // wrapper > custom-element > div.paragraph > span
    const span = html("span", ["עברית רבה מאוד כאן"]);
    const paragraph = html("div", [span]);
    const custom = document.createElement("my-element");
    custom.appendChild(paragraph);
    const wrapper = html("div", [custom]);
    document.body.appendChild(wrapper);

    scanForRtl(wrapper);

    // paragraph (has inline child span) → direction: rtl
    expect(paragraph.style.direction).toBe("rtl");
    // span inside RTL block → no unicode-bidi
    expect(span.style.unicodeBidi).toBe("");
    // wrapper (no inline content) → untouched
    expect(wrapper.style.direction).toBe("");
  });
});

// ---------- block direction flip: inline descendants must be rescanned ----------

describe("scanForRtl — block direction flip rescans inline descendants", () => {
  test("inline loses unicode-bidi when block flips from LTR to RTL", () => {
    // Start with English-dominant paragraph containing a Hebrew em
    const paragraph = html("p", [
      html("em", ["\"שלום\""]),
      " she said, walking through the evening light and the city.",
    ]);
    document.body.appendChild(paragraph);

    scanForRtl(paragraph);

    // Block is LTR → em has unicode-bidi: plaintext
    expect(paragraph.style.direction).toBe("");
    const em = paragraph.querySelector("em") as HTMLElement;
    expect(em.style.unicodeBidi).toBe("plaintext");
    expect(em.hasAttribute(MARKER)).toBe(true);

    // Now the paragraph becomes Hebrew-dominant (simulates streaming/edit)
    paragraph.textContent = "";
    paragraph.appendChild(html("em", ["שלום עולם כיתוב בעברית ארוך מאוד"]));
    paragraph.appendChild(document.createTextNode(" hi"));

    scanForRtl(paragraph);

    // Block flips to RTL
    expect(paragraph.style.direction).toBe("rtl");
    expect(paragraph.hasAttribute(MARKER)).toBe(true);

    // Inline em should NOT have unicode-bidi (parent is now RTL context)
    const newEm = paragraph.querySelector("em") as HTMLElement;
    expect(newEm.style.unicodeBidi).toBe("");
  });

  test("inline gains unicode-bidi when block flips from RTL to LTR", () => {
    // Start with Hebrew-dominant paragraph
    const paragraph = html("div", [
      html("span", ["כדי לתכנת חכם ויעיל יותר עם כלי בינה"]),
    ]);
    document.body.appendChild(paragraph);

    scanForRtl(paragraph);

    // Block is RTL → span has no unicode-bidi
    expect(paragraph.style.direction).toBe("rtl");
    const span = paragraph.querySelector("span") as HTMLElement;
    expect(span.style.unicodeBidi).toBe("");

    // Now the paragraph becomes English-dominant with a Hebrew phrase
    paragraph.textContent = "";
    const hebrewSpan = html("span", ["שלום"]);
    paragraph.appendChild(document.createTextNode("Hello world, she said "));
    paragraph.appendChild(hebrewSpan);
    paragraph.appendChild(document.createTextNode(" and walked away into the night."));

    scanForRtl(paragraph);

    // Block flips to LTR
    expect(paragraph.style.direction).toBe("");
    expect(paragraph.hasAttribute(MARKER)).toBe(false);

    // Inline span with Hebrew should now have unicode-bidi: plaintext
    expect(hebrewSpan.style.unicodeBidi).toBe("plaintext");
    expect(hebrewSpan.hasAttribute(MARKER)).toBe(true);
  });

  test("multiple inline descendants update when block flips direction", () => {
    const paragraph = html("div", [
      html("b", ["כותרת בעברית:"]),
      html("span", [" טקסט נוסף בעברית ארוך"]),
    ]);
    document.body.appendChild(paragraph);

    scanForRtl(paragraph);

    // Block is RTL → both inlines have no unicode-bidi
    expect(paragraph.style.direction).toBe("rtl");
    const b = paragraph.querySelector("b") as HTMLElement;
    const span = paragraph.querySelector("span") as HTMLElement;
    expect(b.style.unicodeBidi).toBe("");
    expect(span.style.unicodeBidi).toBe("");

    // Replace content with English-dominant text containing Hebrew phrases
    paragraph.textContent = "";
    const em1 = html("em", ["שלום"]);
    const em2 = html("em", ["עולם"]);
    paragraph.appendChild(document.createTextNode("The words "));
    paragraph.appendChild(em1);
    paragraph.appendChild(document.createTextNode(" and "));
    paragraph.appendChild(em2);
    paragraph.appendChild(document.createTextNode(" mean hello world in Hebrew language."));

    scanForRtl(paragraph);

    // Block flips to LTR
    expect(paragraph.style.direction).toBe("");
    expect(paragraph.hasAttribute(MARKER)).toBe(false);

    // Both inline elements should now have unicode-bidi: plaintext
    expect(em1.style.unicodeBidi).toBe("plaintext");
    expect(em2.style.unicodeBidi).toBe("plaintext");
  });
});

// ---------- clearAutoDirection ----------

describe("clearAutoDirection", () => {
  test("removes all markers and styles from marked elements", () => {
    const div = html("div", ["שלום עולם כיתוב בעברית"]);
    div.style.direction = "rtl";
    div.setAttribute(MARKER, "");
    document.body.appendChild(div);

    const span = html("span", ["טקסט"]);
    span.style.unicodeBidi = "plaintext";
    span.setAttribute(MARKER, "");
    document.body.appendChild(span);

    clearAutoDirection();

    expect(div.style.direction).toBe("");
    expect(div.style.unicodeBidi).toBe("");
    expect(div.hasAttribute(MARKER)).toBe(false);

    expect(span.style.direction).toBe("");
    expect(span.style.unicodeBidi).toBe("");
    expect(span.hasAttribute(MARKER)).toBe(false);
  });

  test("does not affect unmarked elements", () => {
    const div = html("div", ["Hello"]);
    div.style.direction = "ltr";
    document.body.appendChild(div);

    clearAutoDirection();

    expect(div.style.direction).toBe("ltr");
  });
});
