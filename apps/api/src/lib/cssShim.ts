/**
 * A teaching-grade computed-style resolver.
 *
 * jsdom/linkedom don't implement the cascade, and we don't want to ship a full
 * CSS engine just to grade an exercise. This does the parts that actually show
 * up in the curriculum:
 *
 *   · matches rules against the element with `el.matches(selector)`
 *   · respects source order (later rules win) and inline `style` (wins outright)
 *   · inherits custom properties (`--token`) up the ancestor chain, incl. :root
 *   · expands the shorthands learners actually write (padding, margin, border-*,
 *     gap, inset, flex, place-*)
 *   · resolves `var(--token, fallback)` recursively
 *
 * It is not a browser. It will not resolve `em` units or used grid track sizes —
 * assertions that need those should read the stylesheet text instead.
 */

type MinimalElement = {
  matches?: (sel: string) => boolean;
  getAttribute: (name: string) => string | null;
  parentElement?: MinimalElement | null;
};

type MinimalDocument = {
  querySelector: (sel: string) => unknown;
  querySelectorAll: (sel: string) => ArrayLike<unknown>;
  documentElement?: unknown;
};

interface Rule {
  selectors: string[];
  decls: Map<string, string>;
}

const SHORTHAND_SIDES = ['top', 'right', 'bottom', 'left'] as const;

function parseDecls(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of block.split(';')) {
    const i = part.indexOf(':');
    if (i === -1) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).trim();
    if (prop) map.set(prop, value);
  }
  return map;
}

/** `10px 20px` → { top: 10px, right: 20px, bottom: 10px, left: 20px } */
function expandBox(value: string): Record<string, string> {
  const parts = value.split(/\s+/).filter(Boolean);
  const [a, b = a, c = a, d = b] = parts;
  return { top: a, right: b, bottom: c, left: d };
}

/**
 * Brace-aware parser. At-rule blocks (@media, @supports, @keyframes) are skipped
 * wholesale — we cannot evaluate a media query without a viewport, and letting
 * their inner rules leak into the cascade would silently override the base rules
 * they are meant to conditionally replace. Assertions about responsive CSS should
 * read `styleText` directly.
 */
function parseRules(styleText: string): Rule[] {
  const src = styleText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  let i = 0;

  const skipBlock = (from: number): number => {
    let depth = 0;
    for (let j = from; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') {
        depth--;
        if (depth === 0) return j + 1;
      }
    }
    return src.length;
  };

  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    const prelude = src.slice(i, open).trim();

    if (prelude.startsWith('@')) {
      i = skipBlock(open);
      continue;
    }
    // A statement at-rule (@import …;) inside the prelude — drop it.
    const cleanPrelude = prelude.replace(/@[^;{]*;/g, '').trim();

    const close = src.indexOf('}', open);
    if (close === -1) break;
    const selectors = cleanPrelude
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (selectors.length) {
      rules.push({ selectors, decls: parseDecls(src.slice(open + 1, close)) });
    }
    i = close + 1;
  }
  return rules;
}

function safeMatches(el: MinimalElement, selector: string): boolean {
  if (typeof el.matches !== 'function') return false;
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

export function createCssShim(doc: MinimalDocument, styleText: string) {
  const rules = parseRules(styleText);

  /** All declarations that apply to `el`, in cascade order (later wins). */
  function declarationsFor(el: MinimalElement): Map<string, string> {
    const out = new Map<string, string>();
    for (const rule of rules) {
      if (!rule.selectors.some((s) => safeMatches(el, s))) continue;
      for (const [k, v] of rule.decls) out.set(k, v);
    }
    for (const [k, v] of parseDecls(el.getAttribute('style') ?? '')) out.set(k, v);
    return out;
  }

  /** Custom properties inherit, so walk up until we find the token. */
  function lookupCustomProperty(el: MinimalElement | null, name: string, depth = 0): string | null {
    if (!el || depth > 30) return null;
    const decls = declarationsFor(el);
    const own = decls.get(name);
    if (own !== undefined) return own;
    return lookupCustomProperty(el.parentElement ?? null, name, depth + 1);
  }

  function resolveVars(el: MinimalElement, value: string, depth = 0): string {
    if (depth > 10 || !value.includes('var(')) return value;
    const replaced = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_all, name, fallback) => {
      const found = lookupCustomProperty(el, name);
      if (found !== null) return found.trim();
      return (fallback ?? '').trim();
    });
    return resolveVars(el, replaced, depth + 1);
  }

  function readProp(el: MinimalElement, prop: string): string {
    const wanted = prop.trim().toLowerCase();
    const decls = declarationsFor(el);

    // Custom property — inheritable.
    if (wanted.startsWith('--')) {
      const v = lookupCustomProperty(el, wanted);
      return v === null ? '' : resolveVars(el, v).trim();
    }

    const direct = decls.get(wanted);
    if (direct !== undefined) return resolveVars(el, direct).trim();

    // Longhand from a shorthand: padding-top ← padding, margin-left ← margin …
    const boxMatch = /^(padding|margin|inset|border-width|border-color|border-style)-(top|right|bottom|left)$/.exec(
      wanted,
    );
    if (boxMatch) {
      const shorthand = decls.get(boxMatch[1]);
      if (shorthand !== undefined) {
        return expandBox(resolveVars(el, shorthand))[boxMatch[2]] ?? '';
      }
      // border-top-width ← border ("2px solid red")
      if (boxMatch[1].startsWith('border-')) {
        const border = decls.get('border');
        if (border !== undefined) {
          const resolved = resolveVars(el, border).split(/\s+/);
          const idx = { width: 0, style: 1, color: 2 }[boxMatch[1].split('-')[1] as 'width' | 'style' | 'color'];
          return resolved[idx] ?? '';
        }
      }
    }

    // border-<side>-<part> ← border
    const sideMatch = /^border-(top|right|bottom|left)-(width|style|color)$/.exec(wanted);
    if (sideMatch) {
      const specific = decls.get(`border-${sideMatch[1]}`) ?? decls.get('border');
      if (specific !== undefined) {
        const parts = resolveVars(el, specific).split(/\s+/);
        const idx = { width: 0, style: 1, color: 2 }[sideMatch[2] as 'width' | 'style' | 'color'];
        return parts[idx] ?? '';
      }
    }

    // gap → row-gap / column-gap
    if (wanted === 'row-gap' || wanted === 'column-gap') {
      const gap = decls.get('gap');
      if (gap !== undefined) {
        const parts = resolveVars(el, gap).split(/\s+/);
        return (wanted === 'row-gap' ? parts[0] : parts[1] ?? parts[0]) ?? '';
      }
    }
    if (wanted === 'gap') {
      const row = decls.get('row-gap');
      const col = decls.get('column-gap');
      if (row && col) return resolveVars(el, row === col ? row : `${row} ${col}`);
      if (row) return resolveVars(el, row);
    }

    // place-items / place-content → align-*/justify-*
    const placeMatch = /^(align|justify)-(items|content|self)$/.exec(wanted);
    if (placeMatch) {
      const place = decls.get(`place-${placeMatch[2]}`);
      if (place !== undefined) {
        const parts = resolveVars(el, place).split(/\s+/);
        return (placeMatch[1] === 'align' ? parts[0] : parts[1] ?? parts[0]) ?? '';
      }
    }

    // flex-grow / flex-shrink / flex-basis ← flex
    const flexMatch = /^flex-(grow|shrink|basis)$/.exec(wanted);
    if (flexMatch) {
      const flex = decls.get('flex');
      if (flex !== undefined) {
        const parts = resolveVars(el, flex).split(/\s+/);
        if (parts.length === 1 && /^\d/.test(parts[0])) {
          return { grow: parts[0], shrink: '1', basis: '0%' }[flexMatch[1] as 'grow' | 'shrink' | 'basis'];
        }
        const idx = { grow: 0, shrink: 1, basis: 2 }[flexMatch[1] as 'grow' | 'shrink' | 'basis'];
        return parts[idx] ?? '';
      }
    }

    // Inheritable text properties.
    const INHERITED = new Set([
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'text-align',
      'letter-spacing',
      'list-style-type',
      'visibility',
      'box-sizing', // not truly inherited, but universal resets are ubiquitous
    ]);
    if (INHERITED.has(wanted) && el.parentElement) {
      return readProp(el.parentElement, wanted);
    }

    return '';
  }

  return function css(selector: string, prop: string): string {
    const el = doc.querySelector(selector) as MinimalElement | null;
    if (!el) return '';
    return readProp(el, prop);
  };
}
