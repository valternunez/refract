import type { Page } from 'playwright';

/** A single responsive/accessibility issue found on a rendered page. Stable keys — outputs are inputs. */
export interface Finding {
  type:
    | 'horizontal_overflow'
    | 'element_clipped'
    | 'text_overflow'
    | 'tap_target_small'
    | 'image_no_alt';
  severity: 'error' | 'warn';
  /** Agent/human-readable explanation, e.g. "scrollWidth=480 viewport=402". */
  detail: string;
  /** Short CSS-ish path to the culprit, e.g. "button#tiny-btn". */
  selector?: string;
  /** Element size for tap targets, e.g. "28x24". */
  size?: string;
}

/**
 * Run heuristic responsive/accessibility checks against the current page state and
 * return structured {@link Finding}s. Agents act on these instead of eyeballing pixels.
 *
 * @param isMobile whether this viewport is a mobile device (gates the tap-target check).
 */
export function collectFindings(page: Page, isMobile: boolean): Promise<Finding[]> {
  return page.evaluate<Finding[], { isMobile: boolean }>(runChecks, { isMobile });
}

// Runs in the browser (serialized by Playwright). Must reference only its arg and DOM globals.
function runChecks({ isMobile }: { isMobile: boolean }): Finding[] {
  const CAP = 20;
  const findings: Finding[] = [];
  // The viewport (layout) width. NOT window.innerWidth: under Playwright mobile
  // emulation innerWidth balloons to the content width, which hides real overflow.
  // clientWidth is the device width and matches what the screenshot captures.
  const vw = document.documentElement.clientWidth;

  const cssPath = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    // Tailwind-style tokens (md:flex, w-1/2) are invalid raw; CSS.escape makes them selectable.
    if (el.id) return `${tag}#${CSS.escape(el.id)}`;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    let sel = tag + (cls.length ? `.${cls.map((c) => CSS.escape(c)).join('.')}` : '');
    const parent = el.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(el) + 1})`;
    }
    return sel;
  };
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.opacity !== '0';
  };
  // True if any ancestor clips/scrolls horizontally — such an element overflowing
  // its own container doesn't break the page (carousels, overflow:auto scrollers).
  const inClipContainer = (el: Element): boolean => {
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const s = getComputedStyle(p);
      const ox = s.overflowX === 'visible' ? s.overflow : s.overflowX;
      if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };
  const addCapped = (type: Finding['type'], items: Finding[]): void => {
    if (items.length <= CAP) {
      findings.push(...items);
    } else {
      findings.push(...items.slice(0, CAP));
      findings.push({
        type,
        severity: 'warn',
        detail: `…and ${items.length - CAP} more (truncated)`,
      });
    }
  };

  const de = document.documentElement;
  const all = Array.from(document.body.querySelectorAll('*'));

  // Real, visible, rightward overflow offenders not contained by a clip/scroll
  // ancestor. Computed first because both the page-level and per-element checks
  // need them — a wide visibility:hidden element must not trip either check.
  const offenders = all.filter((el) => {
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1) return false;
    return !inClipContainer(el);
  });

  // 1. Page-level horizontal overflow — only with a genuine visible culprit.
  if (de.scrollWidth > vw && offenders.length > 0) {
    findings.push({
      type: 'horizontal_overflow',
      severity: 'error',
      detail: `scrollWidth=${de.scrollWidth} viewport=${vw}`,
    });
  }

  // 2. Elements sticking out past the viewport — outermost offenders only.
  const offenderSet = new Set(offenders);
  const outermost = offenders.filter((el) => {
    let p = el.parentElement;
    while (p) {
      if (offenderSet.has(p)) return false;
      p = p.parentElement;
    }
    return true;
  });
  addCapped(
    'element_clipped',
    outermost.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        type: 'element_clipped' as const,
        severity: 'warn' as const,
        detail: `right=${Math.round(r.right)} viewport=${vw}`,
        selector: cssPath(el),
      };
    }),
  );

  // 3. Clipped / truncated text.
  const clipped = all.filter((el) => {
    if (el.scrollWidth <= el.clientWidth + 1) return false;
    if (!visible(el)) return false;
    const cs = getComputedStyle(el);
    // Only hidden/clip actually truncate; visible/auto/scroll show or scroll the text.
    if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') return false;
    // An ellipsis affordance (e.g. the `.truncate` utility) is intentional, designed
    // truncation — not a bug. Only hard clipping with no ellipsis is worth flagging.
    if (cs.textOverflow.includes('ellipsis')) return false;
    return Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0,
    );
  });
  addCapped(
    'text_overflow',
    clipped.map((el) => ({
      type: 'text_overflow' as const,
      severity: 'warn' as const,
      detail: `scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth}`,
      selector: cssPath(el),
    })),
  );

  // 4. Tap targets under 44×44 — mobile only.
  if (isMobile) {
    const interactive = Array.from(
      document.body.querySelectorAll(
        'a, button, input[type="button"], input[type="submit"], [role="button"], select',
      ),
    );
    const small = interactive.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
    });
    addCapped(
      'tap_target_small',
      small.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          type: 'tap_target_small' as const,
          severity: 'warn' as const,
          detail: 'below 44x44 minimum',
          selector: cssPath(el),
          size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        };
      }),
    );
  }

  // 5. Images missing alt (empty alt="" is valid/decorative — not flagged).
  const noalt = Array.from(document.body.querySelectorAll('img')).filter(
    (img) => !img.hasAttribute('alt'),
  );
  addCapped(
    'image_no_alt',
    noalt.map((img) => {
      // For a real URL the src locates the image; a data: URI is just noise (the selector already does).
      const src = img.getAttribute('src') || '';
      return {
        type: 'image_no_alt' as const,
        severity: 'warn' as const,
        detail: src.startsWith('data:') ? 'inline data-URI image' : src.slice(0, 80),
        selector: cssPath(img),
      };
    }),
  );

  return findings;
}
