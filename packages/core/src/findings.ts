import type { Page } from 'playwright';

/** A single responsive/accessibility issue found on a rendered page. Stable keys — outputs are inputs. */
export interface Finding {
  type:
    | 'horizontal_overflow'
    | 'element_clipped'
    | 'text_overflow'
    | 'tap_target_small'
    | 'text_too_small'
    | 'viewport_meta_missing'
    | 'image_no_alt';
  severity: 'error' | 'warn';
  /** Agent/human-readable explanation, e.g. "scrollWidth=480 viewport=402". */
  detail: string;
  /** Short CSS-ish path to the culprit, e.g. "button#tiny-btn". */
  selector?: string;
  /** Element size for tap targets, e.g. "28x24". */
  size?: string;
  /**
   * The culprit element's box in **document** coordinates (CSS px, rounded) — scroll-stable,
   * so it survives a full-page screenshot. Useful to zoom to, or annotate, exactly what broke.
   * Omitted for page-level findings (e.g. `viewport_meta_missing`) that have no single element.
   */
  rect?: { x: number; y: number; width: number; height: number };
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
  // The culprit box in document coordinates (rounded), so it stays correct on a full-page
  // screenshot regardless of scroll — agents can zoom to it or we can annotate it.
  const sx = window.scrollX;
  const sy = window.scrollY;
  const rectOf = (el: Element): Finding['rect'] => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left + sx),
      y: Math.round(r.top + sy),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  };
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    // Near-zero opacity is effectively invisible (e.g. an element mid fade-in) — don't flag it.
    return s.visibility !== 'hidden' && Number(s.opacity) > 0.01;
  };
  // True if any ancestor clips/scrolls horizontally — such an element overflowing
  // its own container doesn't break the page (carousels, overflow:auto scrollers,
  // and CSS containment that clips paint).
  const inClipContainer = (el: Element): boolean => {
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const s = getComputedStyle(p);
      const ox = s.overflowX === 'visible' ? s.overflow : s.overflowX;
      if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') return true;
      // `contain: paint | strict | content` clips overflow to the box, like overflow:clip.
      const c = s.contain;
      if (c.includes('paint') || c.includes('strict') || c.includes('content')) return true;
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

  // 1. Page-level horizontal overflow — only with a genuine visible culprit, and name
  //    the worst offender (furthest past the edge) so an agent knows what to fix.
  if (de.scrollWidth > vw && offenders.length > 0) {
    const culprit = offenders.reduce((a, b) =>
      b.getBoundingClientRect().right > a.getBoundingClientRect().right ? b : a,
    );
    findings.push({
      type: 'horizontal_overflow',
      severity: 'error',
      detail: `scrollWidth=${de.scrollWidth} viewport=${vw}`,
      selector: cssPath(culprit),
      rect: rectOf(culprit),
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
        rect: rectOf(el),
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
      rect: rectOf(el),
    })),
  );

  // 4. Tap targets genuinely small in BOTH dimensions — mobile only. (A wide-but-short link,
  //    e.g. 354×40, is comfortably tappable; inline text links are WCAG-exempt — see below.)
  if (isMobile) {
    const interactive = Array.from(
      document.body.querySelectorAll(
        'a, button, input[type="button"], input[type="submit"], [role="button"], select',
      ),
    );
    // Effective tap area = the control's own box unioned with any (visible) replaced children, plus
    // whether it has one. An inline <a> wrapping an icon/logo/image measures its line-box height
    // (e.g. 120×21 around a 120×120 image), not the image you actually tap — union fixes that.
    const hitBox = (el: Element) => {
      let { left, top, right, bottom } = el.getBoundingClientRect();
      let replaced = false;
      for (const c of el.querySelectorAll('img,svg,picture,canvas,video')) {
        const r = c.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        replaced = true;
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      }
      const rect: NonNullable<Finding['rect']> = {
        x: Math.round(left + sx),
        y: Math.round(top + sy),
        width: Math.round(right - left),
        height: Math.round(bottom - top),
      };
      return { rect, replaced };
    };
    addCapped(
      'tap_target_small',
      interactive
        .map((el) => ({ el, ...hitBox(el) }))
        .filter(({ el, rect, replaced }) => {
          if (rect.width <= 0 || rect.height <= 0) return false;
          // WCAG 2.5.8 inline exception: a link flowing in a sentence is constrained by the
          // line-height of its text, not a tap-target failure. An inline link wrapping an
          // icon/image is NOT exempt — its hitBox already reflects the real (image) tap area.
          if (!replaced && getComputedStyle(el).display === 'inline') return false;
          // Small in BOTH dimensions. A wide-but-short link (354×40) is tappable; only a
          // genuinely tiny target is flagged. (A rare thin/skinny control may slip through.)
          return rect.width < 44 && rect.height < 44;
        })
        .map(({ el, rect }) => ({
          type: 'tap_target_small' as const,
          severity: 'warn' as const,
          detail: 'below 44x44 minimum',
          selector: cssPath(el),
          size: `${rect.width}x${rect.height}`,
          rect,
        })),
    );

    // 5. Text too small to read comfortably on a phone — mobile only. Gated on a real
    //    sentence (≥12 chars) so legitimately-small short labels/badges/headers don't trip it.
    const tiny = all.filter((el) => {
      if (!visible(el)) return false;
      const px = Number.parseFloat(getComputedStyle(el).fontSize);
      if (!(px < 12)) return false;
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent || '')
        .join('')
        .trim();
      return text.length >= 12;
    });
    addCapped(
      'text_too_small',
      tiny.map((el) => ({
        type: 'text_too_small' as const,
        severity: 'warn' as const,
        detail: `font-size=${Math.round(Number.parseFloat(getComputedStyle(el).fontSize))}px`,
        selector: cssPath(el),
        rect: rectOf(el),
      })),
    );

    // 6. No <meta name="viewport"> — a mobile browser renders at a desktop width and
    //    scales the whole page down. Page-level; reported on mobile where it bites.
    if (!document.querySelector('meta[name="viewport"]')) {
      findings.push({
        type: 'viewport_meta_missing',
        severity: 'error',
        detail:
          'no <meta name="viewport"> — mobile browsers render at a desktop width and scale down',
      });
    }
  }

  // 7. Images missing alt (empty alt="" is valid/decorative — not flagged).
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
        rect: rectOf(img),
      };
    }),
  );

  return findings;
}
