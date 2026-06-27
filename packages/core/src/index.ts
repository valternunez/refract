/**
 * Refract core — the library behind the CLI and MCP server.
 *
 * Scaffold stub. The real {@link render} implementation lands with v0.1
 * (one screenshot → parallel contexts → freeze). See CLAUDE.md "V0.1".
 */

/** A target viewport: either a preset name (`"iphone-15"`, `"mobile"`) or `WxH` (`"375x667"`). */
export type Viewport = string;

/** Options for {@link render}. Everything optional except `url` — defaults must be right. */
export interface RenderOptions {
  /** The URL to render. The only required option. */
  url: string;
  /** Viewports to render. Defaults to `["mobile", "tablet", "desktop"]`. */
  viewports?: Viewport[];
  /** CSS selector to clip the screenshot to a single element. */
  selector?: string;
  /** Disable animations/transitions and force eager image loading for deterministic shots. */
  freeze?: boolean;
  /** Explicit gate: wait for this selector before capturing. */
  waitFor?: string;
}

/** One rendered viewport. `image` is a downscaled preview; `savedPath` is the absolute full-res path. */
export interface Shot {
  preset: string;
  width: number;
  height: number;
  image: Buffer;
  savedPath: string;
}

/**
 * Render `url` at each viewport and return one {@link Shot} per viewport.
 *
 * @example
 * const shots = await render({ url: 'http://localhost:3000' });
 *
 * @remarks Not implemented yet — this is the v0.1 scaffold stub.
 */
export function render(_options: RenderOptions): Promise<Shot[]> {
  throw new Error('render() is not implemented yet — scaffold stub. See CLAUDE.md V0.1.');
}
