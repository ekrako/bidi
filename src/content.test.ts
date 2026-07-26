import {
  test,
  expect,
  beforeEach,
  afterAll,
  describe,
  spyOn,
} from "bun:test";
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

const { DEFAULT_BREAKER_CONFIG } = await import("./storage");

const {
  MARKER,
  getInlineText,
  applyRtlToElement,
  scanForRtl,
  clearAutoDirection,
  isInsideEditable,
  onMutations,
  startObserver,
  stopObserver,
  setBreakerConfig,
  resetBreaker,
  rearmBreaker,
  isObserving,
} = await import("./content");

const DEFAULT_TEST_BREAKER = { ...DEFAULT_BREAKER_CONFIG };

/** Minimal MutationRecord stand-ins for driving onMutations() directly. */
function childListRecord(target: Node, added: Node[] = []): MutationRecord {
  return {
    type: "childList",
    target,
    addedNodes: added as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
  } as unknown as MutationRecord;
}

function charDataRecord(target: Node): MutationRecord {
  return {
    type: "characterData",
    target,
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
  } as unknown as MutationRecord;
}

function attrRecord(target: Node, attributeName: string): MutationRecord {
  return {
    type: "attributes",
    target,
    attributeName,
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
  } as unknown as MutationRecord;
}

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

  test("excludes text of an inline contenteditable child", () => {
    const span = html("span", ["שלום עולם כיתוב בעברית ארוך"]);
    span.setAttribute("contenteditable", "true");
    const p = html("p", ["English text ", span]);
    expect(getInlineText(p)).toBe("English text ");
  });

  test("excludes a contenteditable nested under an inline wrapper", () => {
    const editor = html("span", ["שלום עולם כיתוב בעברית ארוך"]);
    editor.setAttribute("contenteditable", "true");
    const wrapper = html("span", ["mid ", editor]);
    const p = html("p", ["hi ", wrapper]);
    expect(getInlineText(p)).toBe("hi mid ");
  });
});

// ---------- applyRtlToElement: block elements ----------

describe("applyRtlToElement — block elements", () => {
  test("sets direction: rtl on block with predominantly RTL text", () => {
    const div = html("div", ["שלום עולם כיתוב בעברית"]);
    document.body.appendChild(div);
    applyRtlToElement(div);

    expect(div.style.direction).toBe("rtl");
    expect(div.style.textAlign).toBe("right");
    expect(div.hasAttribute(MARKER)).toBe(true);
  });

  test("does not set direction on block with predominantly LTR text", () => {
    const div = html("div", ["Hello world, this is English"]);
    document.body.appendChild(div);
    applyRtlToElement(div);

    expect(div.style.direction).toBe("");
    expect(div.style.textAlign).toBe("");
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
    expect(div.style.textAlign).toBe("");
    expect(div.hasAttribute(MARKER)).toBe(false);
  });

  test("forces text-align: right over a site's explicit text-align: left (OpenEvidence pattern)", () => {
    const p = html("p", ["כן, מומלץ לכסות נגעי אימפטיגו פעילים כדי להפחית"]);
    p.style.textAlign = "left";
    document.body.appendChild(p);
    applyRtlToElement(p);

    expect(p.style.direction).toBe("rtl");
    expect(p.style.textAlign).toBe("right");
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

// ---------- isInsideEditable ----------

describe("isInsideEditable", () => {
  test("true for element inside a contenteditable host", () => {
    const editor = html("div", [html("p", ["שלום"])]);
    editor.setAttribute("contenteditable", "");
    document.body.appendChild(editor);
    expect(isInsideEditable(editor.querySelector("p"))).toBe(true);
  });

  test("treats contenteditable='true' as editable", () => {
    const editor = html("div", [html("span", ["שלום"])]);
    editor.setAttribute("contenteditable", "true");
    document.body.appendChild(editor);
    expect(isInsideEditable(editor.querySelector("span"))).toBe(true);
  });

  test("false for element outside any editable region", () => {
    const div = html("div", ["שלום"]);
    document.body.appendChild(div);
    expect(isInsideEditable(div)).toBe(false);
  });

  test("standalone contenteditable='false' element is not editable", () => {
    const island = html("div", [html("span", ["שלום"])]);
    island.setAttribute("contenteditable", "false");
    document.body.appendChild(island);
    expect(isInsideEditable(island.querySelector("span"))).toBe(false);
  });

  test.each(["inherit", "foo", "FALSE"])(
    "contenteditable='%s' does not establish an editable host",
    (value) => {
      const el = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
      el.setAttribute("contenteditable", value);
      document.body.appendChild(el);
      expect(isInsideEditable(el)).toBe(false);
    },
  );

  test.each(["", "true", "plaintext-only", "TRUE"])(
    "contenteditable='%s' establishes an editable host",
    (value) => {
      const el = html("div", [html("span", ["שלום"])]);
      el.setAttribute("contenteditable", value);
      document.body.appendChild(el);
      expect(isInsideEditable(el.querySelector("span"))).toBe(true);
    },
  );

  test("contenteditable='false' island inside an editor is still skipped", () => {
    // Editor-managed DOM: skip everything under an editable host, so scans and
    // mutations stay consistent (no direction dependent on mutation timing).
    const editor = html("div", [html("div", ["שלום"])]);
    editor.setAttribute("contenteditable", "true");
    const island = editor.querySelector("div") as HTMLElement;
    island.setAttribute("contenteditable", "false");
    document.body.appendChild(editor);
    expect(isInsideEditable(island)).toBe(true);
  });

  test("falls back to isContentEditable for designMode-style editability", () => {
    // No element carries a contenteditable attribute (document.designMode="on"
    // makes the whole document editable). happy-dom doesn't reflect designMode
    // into isContentEditable, so we stub the flag to assert the fallback branch.
    const el = html("span", ["x"]);
    document.body.appendChild(el);
    expect(isInsideEditable(el)).toBe(false);
    Object.defineProperty(el, "isContentEditable", {
      value: true,
      configurable: true,
    });
    expect(isInsideEditable(el)).toBe(true);
  });
});

// ---------- Auto mode skips editable subtrees ----------

describe("editable-subtree skip", () => {
  test("applyRtlToElement no-ops inside contenteditable", () => {
    const editor = html("div", [html("div", ["שלום עולם כיתוב בעברית"])]);
    editor.setAttribute("contenteditable", "");
    document.body.appendChild(editor);

    const block = editor.querySelector("div") as HTMLElement;
    applyRtlToElement(block);

    expect(block.style.direction).toBe("");
    expect(block.hasAttribute(MARKER)).toBe(false);
  });

  test("scanForRtl marks outside blocks but skips the editable subtree", () => {
    const outside = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    const editor = html("div", [html("div", ["עוד טקסט עברי בתוך העורך"])]);
    editor.setAttribute("contenteditable", "");
    document.body.append(outside, editor);

    scanForRtl(document.body);

    expect(outside.style.direction).toBe("rtl");
    const inner = editor.querySelector("div") as HTMLElement;
    expect(inner.style.direction).toBe("");
    expect(inner.hasAttribute(MARKER)).toBe(false);
    expect(editor.hasAttribute(MARKER)).toBe(false);
  });

  test("observer ignores characterData mutations inside editable region", () => {
    const editor = html("div", [html("p", ["שלום עולם כיתוב בעברית"])]);
    editor.setAttribute("contenteditable", "");
    document.body.appendChild(editor);
    const p = editor.querySelector("p") as HTMLElement;

    onMutations([charDataRecord(p.firstChild as Node)]);

    expect(p.style.direction).toBe("");
    expect(p.hasAttribute(MARKER)).toBe(false);
  });

  test("clears stale markers when an element becomes editable", () => {
    const div = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    document.body.appendChild(div);
    applyRtlToElement(div);
    expect(div.style.direction).toBe("rtl");
    expect(div.hasAttribute(MARKER)).toBe(true);

    div.setAttribute("contenteditable", "");
    applyRtlToElement(div);

    expect(div.style.direction).toBe("");
    expect(div.hasAttribute(MARKER)).toBe(false);
  });

  test("clears marked descendants when an ancestor becomes editable", () => {
    // LTR-dominant block so the inline Hebrew span gets its own plaintext marker.
    const host = html("p", [
      "The vendor said ",
      html("em", ["שלום"]),
      " and walked away into the evening light of the old city.",
    ]);
    document.body.appendChild(host);
    scanForRtl(host);
    const em = host.querySelector("em") as HTMLElement;
    expect(em.hasAttribute(MARKER)).toBe(true);
    expect(em.style.unicodeBidi).toBe("plaintext");

    host.setAttribute("contenteditable", "");
    applyRtlToElement(host);

    expect(em.style.unicodeBidi).toBe("");
    expect(em.hasAttribute(MARKER)).toBe(false);
  });

  test("observer clears markers when a block gains contenteditable", () => {
    const block = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    document.body.appendChild(block);
    applyRtlToElement(block);
    expect(block.hasAttribute(MARKER)).toBe(true);

    block.setAttribute("contenteditable", "");
    onMutations([attrRecord(block, "contenteditable")]);

    expect(block.style.direction).toBe("");
    expect(block.hasAttribute(MARKER)).toBe(false);
  });

  test("observer scans an element that stops being editable", () => {
    const el = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    el.setAttribute("contenteditable", "true");
    document.body.appendChild(el);

    el.setAttribute("contenteditable", "false");
    onMutations([attrRecord(el, "contenteditable")]);

    expect(el.style.direction).toBe("rtl");
    expect(el.hasAttribute(MARKER)).toBe(true);
  });

  test("observer re-evaluates the block when an inline stops being editable", () => {
    const p = html("p", ["English words here "]);
    const span = html("span", ["שלום"]);
    span.setAttribute("contenteditable", "true");
    p.appendChild(span);
    document.body.appendChild(p);
    scanForRtl(document.body);
    expect(p.style.direction).toBe("");

    // Editing turned it RTL-majority, then it froze to static content.
    span.textContent = "שלום עולם כיתוב בעברית ארוך מאוד מאוד";
    span.setAttribute("contenteditable", "false");
    onMutations([attrRecord(span, "contenteditable")]);

    expect(p.style.direction).toBe("rtl");
  });

  test("editor's text does not drive its parent block's direction", () => {
    const span = html("span", ["שלום עולם כיתוב בעברית ארוך מאוד"]);
    span.setAttribute("contenteditable", "true");
    const p = html("p", ["Short en ", span]);
    document.body.appendChild(p);

    scanForRtl(document.body);

    // Parent stays LTR despite the editor holding RTL-majority text.
    expect(p.style.direction).toBe("");
    expect(p.hasAttribute(MARKER)).toBe(false);
  });

  test("parent block re-evaluates when an inline child becomes editable", () => {
    // Parent is RTL because it (wrongly) includes the child's Hebrew before the
    // child is marked editable; once editable, the parent must drop RTL.
    const span = html("span", ["שלום עולם כיתוב בעברית ארוך מאוד מאוד"]);
    const p = html("p", ["hi ", span]);
    document.body.appendChild(p);
    scanForRtl(document.body);
    expect(p.style.direction).toBe("rtl");

    span.setAttribute("contenteditable", "true");
    onMutations([attrRecord(span, "contenteditable")]);

    expect(p.style.direction).toBe("");
    expect(p.hasAttribute(MARKER)).toBe(false);
  });

  test("scanForRtl processes a standalone contenteditable='inherit' element", () => {
    const el = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    el.setAttribute("contenteditable", "inherit");
    document.body.appendChild(el);

    scanForRtl(document.body);

    expect(el.style.direction).toBe("rtl");
    expect(el.hasAttribute(MARKER)).toBe(true);
  });

  test("full scan clears stale markers left inside an existing editor", () => {
    // Simulates a prior content-script injection that marked content before the
    // element became editor-owned; a fresh scan must clean it up.
    const editor = html("div", [html("p", ["שלום עולם"])]);
    editor.setAttribute("contenteditable", "true");
    document.body.appendChild(editor);
    const p = editor.querySelector("p") as HTMLElement;
    p.style.direction = "rtl";
    p.setAttribute(MARKER, "");

    scanForRtl(document.body);

    expect(p.style.direction).toBe("");
    expect(p.hasAttribute(MARKER)).toBe(false);
  });

  test("scanForRtl clears stale markers on an editable root", () => {
    const marked = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    document.body.appendChild(marked);
    applyRtlToElement(marked);
    expect(marked.hasAttribute(MARKER)).toBe(true);

    // Becomes editor-owned, then gets scanned as an added subtree.
    marked.setAttribute("contenteditable", "true");
    scanForRtl(marked);

    expect(marked.style.direction).toBe("");
    expect(marked.hasAttribute(MARKER)).toBe(false);
  });

  test("observer strips markers from a node reparented into an editor", () => {
    const editor = html("div");
    editor.setAttribute("contenteditable", "");
    document.body.appendChild(editor);

    const marked = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    document.body.appendChild(marked);
    applyRtlToElement(marked);
    expect(marked.hasAttribute(MARKER)).toBe(true);

    // Moved into the editor; childList mutation targets the editor host.
    editor.appendChild(marked);
    onMutations([childListRecord(editor, [marked])]);

    expect(marked.style.direction).toBe("");
    expect(marked.hasAttribute(MARKER)).toBe(false);
  });

  test("observer ignores childList mutations inside editable region", () => {
    const editor = html("div");
    editor.setAttribute("contenteditable", "");
    const block = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    editor.appendChild(block);
    document.body.appendChild(editor);

    onMutations([childListRecord(block, [block.firstChild as Node])]);

    expect(block.style.direction).toBe("");
    expect(block.hasAttribute(MARKER)).toBe(false);
  });

  test("applyRtlToElement no-ops when the element itself is the editable host", () => {
    // Not just a descendant — the host element passed directly should also
    // be left untouched (and stripped if previously marked).
    const editor = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    document.body.appendChild(editor);
    applyRtlToElement(editor);
    expect(editor.style.direction).toBe("rtl");

    editor.setAttribute("contenteditable", "true");
    applyRtlToElement(editor);

    expect(editor.style.direction).toBe("");
    expect(editor.hasAttribute(MARKER)).toBe(false);
  });

  test("onMutations handles a characterData mutation on a detached text node", () => {
    const detached = document.createTextNode("שלום עולם");
    // No parentElement — must not throw and must have no effect.
    expect(() => onMutations([charDataRecord(detached)])).not.toThrow();
  });
});

// ---------- circuit breaker ----------

describe("circuit breaker", () => {
  beforeEach(() => {
    stopObserver();
    setBreakerConfig(DEFAULT_TEST_BREAKER);
    resetBreaker();
  });

  afterAll(() => {
    stopObserver();
    setBreakerConfig(DEFAULT_TEST_BREAKER);
    resetBreaker();
  });

  test("trips and disconnects after exceeding callback budget", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({ ...DEFAULT_TEST_BREAKER, maxCallbacks: 3, maxTrips: 1 });
    resetBreaker();
    startObserver();
    expect(isObserving()).toBe(true);

    for (let i = 0; i < 4; i++) onMutations([]);

    expect(isObserving()).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("stays disconnected permanently once maxTrips reached", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({ ...DEFAULT_TEST_BREAKER, maxCallbacks: 1, maxTrips: 1 });
    resetBreaker();
    startObserver();

    onMutations([]);
    onMutations([]);
    expect(isObserving()).toBe(false);

    // Reconnect attempts are refused after permanent disable.
    startObserver();
    expect(isObserving()).toBe(false);
    warn.mockRestore();
  });

  test("permanent disable survives a mode re-arm (cannot be toggled back on)", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({ ...DEFAULT_TEST_BREAKER, maxCallbacks: 1, maxTrips: 1 });
    resetBreaker();
    startObserver();

    onMutations([]);
    onMutations([]);
    expect(isObserving()).toBe(false);

    // Simulates auto→rtl→auto: applyMode re-arms rather than fully resetting, so
    // the per-page trip-out must persist and refuse to reconnect.
    rearmBreaker();
    startObserver();
    expect(isObserving()).toBe(false);
    warn.mockRestore();
  });

  test("reconnects after cooldown when trips remain", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({
      ...DEFAULT_TEST_BREAKER,
      maxCallbacks: 2,
      maxTrips: 5,
      cooldownMs: 20,
    });
    resetBreaker();
    startObserver();

    onMutations([]);
    onMutations([]);
    onMutations([]);
    expect(isObserving()).toBe(false);

    await new Promise((r) => setTimeout(r, 60));
    expect(isObserving()).toBe(true);

    stopObserver();
    warn.mockRestore();
  });

  test("rescans DOM added during cooldown on reconnect", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({
      ...DEFAULT_TEST_BREAKER,
      maxCallbacks: 1,
      maxTrips: 5,
      cooldownMs: 20,
    });
    resetBreaker();
    startObserver();

    onMutations([]);
    onMutations([]);
    expect(isObserving()).toBe(false);

    // Content appears while the observer is backed off; its mutation is lost.
    const late = html("div", ["שלום עולם כיתוב בעברית ארוך מאוד"]);
    document.body.appendChild(late);

    await new Promise((r) => setTimeout(r, 60));

    expect(isObserving()).toBe(true);
    expect(late.style.direction).toBe("rtl");

    stopObserver();
    warn.mockRestore();
  });

  test("DOM-fighting editor cannot cause a runaway; observer backs off", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({
      ...DEFAULT_TEST_BREAKER,
      maxCallbacks: 8,
      maxTrips: 1,
    });
    resetBreaker();

    // Non-editable block so Layer 1 (editable skip) does NOT apply — this
    // exercises the breaker itself. A fake editor reverts our marker and
    // re-renders (childList) whenever it sees BiDi touch its DOM, mirroring
    // ProseMirror's normalize-on-mutation behavior.
    const block = html("div", ["שלום עולם כיתוב בעברית ארוך מאוד"]);
    document.body.appendChild(block);

    let reRenders = 0;
    const fakeEditor = new MutationObserver(() => {
      if (!block.hasAttribute(MARKER) && !block.style.direction) return;
      reRenders++;
      block.removeAttribute(MARKER);
      block.style.direction = "";
      block.style.unicodeBidi = "";
      block.appendChild(document.createTextNode(""));
    });
    fakeEditor.observe(block, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });

    startObserver();
    block.appendChild(document.createTextNode(" עוד"));

    await new Promise((r) => setTimeout(r, 100));

    fakeEditor.disconnect();
    expect(isObserving()).toBe(false);
    expect(warn).toHaveBeenCalled();
    // Bounded: re-renders capped near the callback budget, not runaway.
    expect(reRenders).toBeLessThan(100);

    warn.mockRestore();
  });

  test("trips on a non-yielding burst regardless of elapsed wall-clock", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    // Synchronous back-to-back calls = no macrotask (yield timer) runs between
    // them, so the burst count accumulates and trips no matter the rate.
    setBreakerConfig({ ...DEFAULT_TEST_BREAKER, maxCallbacks: 5, maxTrips: 1 });
    resetBreaker();
    startObserver();

    for (let i = 0; i < 10 && isObserving(); i++) onMutations([]);

    expect(isObserving()).toBe(false);
    warn.mockRestore();
  });

  test("does not trip when the event loop yields between callbacks", async () => {
    // A legitimately busy page yields to the event loop between mutations. The
    // yield timer fires each time, resetting the burst, so it never trips even
    // across far more callbacks than maxCallbacks.
    setBreakerConfig({ ...DEFAULT_TEST_BREAKER, maxCallbacks: 3 });
    resetBreaker();
    startObserver();

    for (let i = 0; i < 12; i++) {
      onMutations([]);
      await new Promise((r) => setTimeout(r, 0));
    }

    expect(isObserving()).toBe(true);
    stopObserver();
  });

  test("processes under-budget mutations (positive path via onMutations)", () => {
    setBreakerConfig(DEFAULT_TEST_BREAKER);
    resetBreaker();
    const block = html("div", ["שלום עולם כיתוב בעברית ארוך"]);
    document.body.appendChild(block);

    onMutations([childListRecord(block, [block.firstChild as Node])]);

    expect(block.style.direction).toBe("rtl");
    expect(block.hasAttribute(MARKER)).toBe(true);
  });

  test("reconfiguring after permanent disable does not revive the observer", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({ ...DEFAULT_TEST_BREAKER, maxCallbacks: 1, maxTrips: 1 });
    resetBreaker();
    startObserver();

    onMutations([]);
    onMutations([]);
    expect(isObserving()).toBe(false);

    // A generous new config (e.g. from a storage sync update) must not
    // un-disable a page that already tripped out permanently.
    setBreakerConfig({ ...DEFAULT_TEST_BREAKER, maxCallbacks: 1000, maxTrips: 1000 });
    startObserver();

    expect(isObserving()).toBe(false);
    warn.mockRestore();
  });

  test("stopObserver cancels a pending reconnect (no resurrection after mode switch)", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    setBreakerConfig({
      ...DEFAULT_TEST_BREAKER,
      maxCallbacks: 1,
      maxTrips: 5,
      cooldownMs: 20,
    });
    resetBreaker();
    startObserver();

    onMutations([]);
    onMutations([]);
    expect(isObserving()).toBe(false);

    // Simulates the user switching the site away from Auto during cooldown.
    stopObserver();
    await new Promise((r) => setTimeout(r, 60));
    expect(isObserving()).toBe(false);

    warn.mockRestore();
  });
});
