import { copyFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { type RenderOptions, diffShots, render, writeDiffReport } from '@getrefractjs/core';
import { type Command, cac } from 'cac';

// Thin wrapper over @getrefractjs/core. Keep this file lean.
const cli = cac('refract');

interface Flags {
  viewports: string;
  out: string;
  selector?: string;
  waitFor?: string;
  waitForFunction?: string;
  waitForNetworkIdleMs?: string;
  freeze?: boolean;
  injectCss?: string;
  dpr?: string;
  concurrency?: string;
  storageState?: string;
  engine?: string;
}

interface DiffFlags extends Flags {
  baseline: string;
  update?: boolean;
  threshold?: string;
}

/** Parse an optional numeric flag, teaching the user when it isn't a positive number. */
function positiveNumber(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${flag} must be a positive number, got "${value}".`);
  }
  return n;
}

/** Parse an optional 0–1 fraction flag (pixelmatch threshold), teaching the valid range. */
function fraction(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`${flag} must be a number between 0 and 1, got "${value}".`);
  }
  return n;
}

/** Validate the optional --engine flag, teaching the user the valid choices. */
function parseEngine(value: string | undefined): 'chromium' | 'webkit' | undefined {
  if (value === undefined) return undefined;
  if (value !== 'chromium' && value !== 'webkit') {
    throw new Error(`--engine must be chromium or webkit, got "${value}".`);
  }
  return value;
}

/** Apply the render flags shared by the default command and `diff`. */
function addRenderFlags(cmd: Command): Command {
  return cmd
    .option('--viewports <list>', 'Comma-separated presets or WxH', {
      default: 'mobile,tablet,desktop',
    })
    .option('--out <dir>', 'Output directory', { default: './refract-shots' })
    .option('--selector <css>', 'Clip to a single element')
    .option('--wait-for <css>', 'Wait for this selector before capturing')
    .option('--wait-for-function <js>', 'Wait until this JS expression is truthy before capturing')
    .option('--wait-for-network-idle-ms <n>', 'Cap (ms) for the network-idle wait')
    .option('--freeze', 'Disable animations and force eager image loading')
    .option('--inject-css <css>', 'Inject CSS before capture (e.g. hide flaky elements)')
    .option('--dpr <n>', 'Override device scale factor (e.g. 1 for smaller files)')
    .option('--concurrency <n>', 'Max viewports rendered in parallel')
    .option('--storage-state <path>', 'Playwright storage-state JSON to render logged in')
    .option('--engine <name>', 'Rendering engine: chromium (default) or webkit (Safari)');
}

/** Build the shared {@link RenderOptions} from parsed flags. */
function renderOptions(url: string, flags: Flags): RenderOptions {
  return {
    url,
    viewports: flags.viewports
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    out: flags.out,
    selector: flags.selector,
    waitFor: flags.waitFor,
    waitForFunction: flags.waitForFunction,
    networkIdleMs: positiveNumber(flags.waitForNetworkIdleMs, '--wait-for-network-idle-ms'),
    freeze: flags.freeze,
    injectCss: flags.injectCss,
    dpr: positiveNumber(flags.dpr, '--dpr'),
    concurrency: positiveNumber(flags.concurrency, '--concurrency'),
    storageState: flags.storageState,
    engine: parseEngine(flags.engine),
  };
}

addRenderFlags(cli.command('<url>', 'Render responsive screenshots of a URL')).action(
  async (url: string, flags: Flags) => {
    try {
      const shots = await render(renderOptions(url, flags));
      for (const s of shots) {
        console.log(`${s.preset.padEnd(20)} ${s.width}x${s.height}  ${s.savedPath}`);
        if (s.aliases?.length) {
          console.log(`  also: ${s.aliases.join(', ')}`);
        }
        if (s.findings.length === 0) {
          console.log('  no findings');
          continue;
        }
        for (const f of s.findings) {
          const tag = f.severity === 'error' ? '[error]' : '[warn] ';
          const extra = [f.selector, f.size].filter(Boolean).join('  ');
          console.log(`  ${tag} ${f.type}  ${f.detail}${extra ? `  ${extra}` : ''}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`refract: ${msg}`);
      process.exitCode = 1;
    }
  },
);

addRenderFlags(cli.command('diff <url>', 'Compare a render against a baseline'))
  .option('--baseline <dir>', 'Baseline directory', { default: './refract-baseline' })
  .option('--update', 'Write current renders as the new baseline')
  .option('--threshold <n>', 'pixelmatch sensitivity 0-1 (default 0.1)')
  .action(async (url: string, flags: DiffFlags) => {
    try {
      // Validate up front so a bad --threshold fails before the (slow) render.
      const threshold = fraction(flags.threshold, '--threshold');
      const shots = await render(renderOptions(url, flags));
      const baselineDir = resolve(flags.baseline);
      const outDir = resolve(flags.out);

      if (flags.update) {
        await mkdir(baselineDir, { recursive: true });
        for (const s of shots) {
          await copyFile(s.savedPath, join(baselineDir, `${s.preset}.png`));
        }
        console.log(`updated ${shots.length} baseline(s) in ${baselineDir}`);
        return;
      }

      const results = await diffShots(shots, { baselineDir, outDir, threshold });

      let regressions = 0;
      for (const r of results) {
        if (r.status === 'unchanged') {
          console.log(`${r.preset.padEnd(20)} unchanged`);
          continue;
        }
        regressions++;
        if (r.status === 'changed') {
          const pct = ((r.diffRatio ?? 0) * 100).toFixed(2);
          const rel = relative(process.cwd(), r.diffPath ?? '')
            .split('\\')
            .join('/');
          console.log(`${r.preset.padEnd(20)} changed    ${pct}% (${r.diffPixels} px)  → ${rel}`);
        } else if (r.status === 'size_changed') {
          console.log(
            `${r.preset.padEnd(20)} size_changed  ${r.baselineWidth}x${r.baselineHeight} → ${r.width}x${r.height}`,
          );
        } else {
          console.log(
            `${r.preset.padEnd(20)} no_baseline  run \`refract diff ${url} --update\` to create it`,
          );
        }
      }

      const reportPath = await writeDiffReport(results, outDir);
      console.log(`\nreport: ${reportPath}`);
      if (regressions > 0) process.exitCode = 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`refract: ${msg}`);
      process.exitCode = 1;
    }
  });

cli.help();
cli.version('0.0.0');
cli.parse();
