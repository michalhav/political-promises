/**
 * Extrakce textu z HTML.
 *
 * Deterministická a bez modelu, ze stejného důvodu jako u PDF: kdyby text
 * vytahoval jazykový model, přestala by být citace citací.
 *
 * Vzniklo to z nutnosti. Programy politických stran a tiskové zprávy měst
 * skoro nikdy nejsou PDF — jsou to webové stránky. Bez tohohle modulu končí
 * doložitelnost u dokumentů, které si někdo dal práci vysázet do PDF, což
 * není vlastnost důležitosti dokumentu, ale náhoda.
 *
 * **Stránka je jedna.** HTML nemá stránkování, takže kanonický dokument má
 * `pageNumber: 1` a posuny jsou od začátku textu. Vymýšlet umělé stránky by
 * znamenalo, že „s. 3" ukazuje na něco, co v dokumentu neexistuje.
 *
 * **Bílé znaky se slučují.** V HTML je posloupnost bílých znaků podle
 * specifikace vykreslena jako jediná mezera, takže zachovat odsazení zdrojáku
 * by znamenalo kanonický text, který se liší od toho, co kdy kdo na stránce
 * viděl. Citace se musí shodovat s tím, co čtenář četl. Uvnitř `<pre>` jsou
 * bílé znaky významové, a tam se proto neslučují.
 */
import { createHash } from "node:crypto";
import { parse, type HTMLElement, type Node } from "node-html-parser";

import type { CanonicalDocument, CanonicalPage } from "@/modules/ingestion/canonical";

/** Zvyš, když se změní způsob skládání textu. Jiná verze může dát jiné posuny. */
export const HTML_EXTRACTOR_VERSION = "html-1.0.0";

/**
 * Prvky, jejichž obsah není text dokumentu.
 *
 * Navigace ani patička tu schválně nejsou: vyhodit je je redakční úsudek
 * o tom, co je „hlavní obsah", a ten do deterministické extrakce nepatří.
 * Skript a styl jsou jiný případ — to není text, který by kdy někdo četl.
 */
const NON_CONTENT_TAGS = new Set(["script", "style", "noscript", "template", "svg", "canvas"]);

/**
 * Prvky, které v sazbě začínají na novém řádku.
 *
 * Konce řádků jsou jediná informace o rozvržení, která v čistém textu zbyla —
 * stejně jako u PDF, kde je nese `hasEOL`.
 */
const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export interface HtmlExtractionReport {
  document: CanonicalDocument;
  /** Obsah `<title>`. Podklad pro název dokumentu, ne jeho náhrada. */
  title: string | null;
  /**
   * Kódování deklarované ve stránce, když to není UTF-8.
   *
   * Bajty čteme jako UTF-8. Když stránka tvrdí něco jiného, text bude
   * pravděpodobně rozsypaný — a je lepší to **říct**, než vydat poškozený
   * kanonický text za doslovné znění dokumentu.
   */
  declaredCharset: string | null;
  /** Prázdný text znamená stránku vykreslovanou až v prohlížeči. */
  isEmpty: boolean;
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === ELEMENT_NODE;
}

function tagOf(node: HTMLElement): string {
  return (node.rawTagName ?? "").toLowerCase();
}

/**
 * Kódování deklarované v `<meta>`.
 *
 * Čte se z už rozebraného stromu, ne z bajtů — jde jen o hlášení, ne o změnu
 * dekódování. Skutečný převod z jiného kódování by byl další závislost a
 * zatím pro něj není doložená potřeba.
 */
function declaredCharsetOf(root: HTMLElement): string | null {
  for (const meta of root.querySelectorAll("meta")) {
    const charset =
      meta.getAttribute("charset") ??
      /charset=([\w-]+)/i.exec(meta.getAttribute("content") ?? "")?.[1] ??
      null;

    if (!charset) continue;

    const normalized = charset.trim().toLowerCase();
    return normalized === "utf-8" || normalized === "utf8" ? null : charset.trim();
  }

  return null;
}

/**
 * Kousek textu, nebo hranice bloku.
 *
 * Hranice se sbírá jako **značka**, ne jako hotový konec řádku. Vnořené bloky
 * (`<ul><li>`) jinak vyrobí dvojitý konec řádku a preformátovaný text by se
 * nedal odlišit od běžného při závěrečném úklidu.
 */
type Token =
  { kind: "text"; value: string } | { kind: "preformatted"; value: string } | { kind: "break" };

/** Sloučí bílé znaky do jedné mezery, jak to dělá vykreslování HTML. */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ");
}

/**
 * Deklarace typu dokumentu.
 *
 * Parser ji vrací jako **textový uzel** v kořeni. U stránky bez `<body>` — což
 * archivované stránky bývají — by se tak `<!DOCTYPE html>` dostalo do
 * kanonického textu jako první věta dokumentu.
 */
const DOCTYPE = /^\s*<!doctype\b/i;

function collectTokens(node: Node, tokens: Token[], insidePre: boolean): void {
  if (node.nodeType === TEXT_NODE) {
    if (DOCTYPE.test(node.text)) return;
    // `.text` dekóduje entity, `.rawText` ne — citovat se musí to, co čtenář viděl.
    tokens.push(
      insidePre
        ? { kind: "preformatted", value: node.text }
        : { kind: "text", value: collapse(node.text) },
    );
    return;
  }

  if (!isElement(node)) return;

  const tag = tagOf(node);
  if (NON_CONTENT_TAGS.has(tag)) return;

  const isBlock = BLOCK_TAGS.has(tag);
  if (isBlock) tokens.push({ kind: "break" });

  for (const child of node.childNodes) {
    collectTokens(child, tokens, insidePre || tag === "pre");
  }

  if (isBlock) tokens.push({ kind: "break" });
}

const TRAILING_SPACES = /[^\S\n]+$/;
const LEADING_SPACES = /^[^\S\n]+/;

/**
 * Složí kousky do kanonického textu.
 *
 * Souvislá řada hranic dá **jeden** konec řádku, ne tolik, kolik bylo vnořených
 * prvků — jinak by hloubka zanoření v HTML prosakovala do textu a citace by
 * závisela na tom, jak je stránka poskládaná.
 *
 * Preformátovaný text prochází beze změny; bílé znaky jsou v něm významové.
 */
function assemble(tokens: readonly Token[]): string {
  let out = "";

  for (const token of tokens) {
    if (token.kind === "break") {
      out = out.replace(TRAILING_SPACES, "");
      if (out.length > 0 && !out.endsWith("\n")) out += "\n";
      continue;
    }

    if (token.kind === "preformatted") {
      out += token.value;
      continue;
    }

    // Mezera hned za koncem řádku pochází z odsazení zdrojáku, ne z textu.
    const atLineStart = out.length === 0 || out.endsWith("\n");
    out += atLineStart ? token.value.replace(LEADING_SPACES, "") : token.value;
  }

  return out.replace(TRAILING_SPACES, "").replace(/\n+$/, "");
}

export function extractHtml(bytes: Uint8Array, sourceName: string): HtmlExtractionReport {
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const html = new TextDecoder("utf-8").decode(bytes);
  const root = parse(html, { comment: false });

  const declaredCharset = declaredCharsetOf(root);
  const title = root.querySelector("title")?.text.trim() || null;

  for (const element of root.querySelectorAll([...NON_CONTENT_TAGS].join(","))) {
    element.remove();
  }

  const tokens: Token[] = [];
  // Když stránka nemá <body>, bereme kořen — fragment je pořád dokument.
  collectTokens(root.querySelector("body") ?? root, tokens, false);

  const text = assemble(tokens);
  const page: CanonicalPage = { pageNumber: 1, text };

  return {
    document: {
      contentHash,
      extractorVersion: HTML_EXTRACTOR_VERSION,
      pageCount: 1,
      pages: [page],
      sourceName,
      extractedAt: new Date().toISOString(),
    },
    title,
    declaredCharset,
    isEmpty: text.length === 0,
  };
}
