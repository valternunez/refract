import { describe, expect, it } from 'vitest';
import { listPresetNames, resolveViewport } from './presets';

describe('resolveViewport', () => {
  it('parses WxH tokens with deviceScaleFactor 1', () => {
    const vp = resolveViewport('375x667');
    expect(vp).toMatchObject({
      name: '375x667',
      width: 375,
      height: 667,
      deviceScaleFactor: 1,
    });
  });

  it('resolves a group name, keeping the input token as the name', () => {
    const vp = resolveViewport('mobile');
    expect(vp.name).toBe('mobile');
    expect(vp.width).toBeGreaterThan(0);
    expect(vp.isMobile).toBe(true);
  });

  it('resolves a preset key directly', () => {
    const vp = resolveViewport('iphone-17-pro-max');
    expect(vp.name).toBe('iphone-17-pro-max');
    expect(vp.width).toBe(440);
    expect(vp.isMobile).toBe(true);
  });

  it('lists group names and preset keys', () => {
    expect(listPresetNames()).toContain('mobile');
    expect(listPresetNames()).toContain('iphone-17-pro-max');
  });

  it('throws a teaching error for unknown tokens', () => {
    expect(() => resolveViewport('nonsense')).toThrow(/Unknown viewport/);
  });
});
