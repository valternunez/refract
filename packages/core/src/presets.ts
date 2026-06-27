import presetsData from './presets.json';

export interface ResolvedViewport {
  /** The input token, used for the deterministic filename ({name}.png). */
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent?: string;
  hasTouch: boolean;
  isMobile: boolean;
}

const groups = presetsData.groups as Record<string, string>;
const presets = presetsData.presets as Record<string, Omit<ResolvedViewport, 'name'>>;

/** All valid tokens for resolveViewport: group names + preset keys, sorted. */
export function listPresetNames(): string[] {
  return [...Object.keys(groups), ...Object.keys(presets)].sort();
}

/**
 * Resolve a viewport token to emulation params. Accepts `WxH` (e.g. "375x667"),
 * a group name ("mobile"), or a preset key ("iphone-17-pro-max").
 *
 * @example
 * resolveViewport('375x667'); // { name: '375x667', width: 375, height: 667, deviceScaleFactor: 1, ... }
 *
 * @throws if the token is unknown — the message lists every valid name.
 */
export function resolveViewport(token: string): ResolvedViewport {
  const wh = /^(\d+)x(\d+)$/.exec(token);
  if (wh) {
    return {
      name: token,
      width: Number(wh[1]),
      height: Number(wh[2]),
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    };
  }

  // A group name points at a preset key; a preset key points at itself.
  const entry = presets[groups[token] ?? token];
  if (!entry) {
    throw new Error(
      `Unknown viewport "${token}". Valid names: ${listPresetNames().join(', ')}. Or use WxH like "375x667".`,
    );
  }
  return { ...entry, name: token };
}
