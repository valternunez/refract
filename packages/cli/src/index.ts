import { render } from '@getrefractjs/core';
import { cac } from 'cac';

// Thin wrapper over @getrefractjs/core. Keep this file <100 lines.
const cli = cac('refract');

interface Flags {
  viewports: string;
  out: string;
  selector?: string;
  waitFor?: string;
  waitForFunction?: string;
  waitForNetworkIdleMs?: string;
  freeze?: boolean;
  dpr?: string;
  concurrency?: string;
  storageState?: string;
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

cli
  .command('<url>', 'Render responsive screenshots of a URL')
  .option('--viewports <list>', 'Comma-separated presets or WxH', {
    default: 'mobile,tablet,desktop',
  })
  .option('--out <dir>', 'Output directory', { default: './refract-shots' })
  .option('--selector <css>', 'Clip to a single element')
  .option('--wait-for <css>', 'Wait for this selector before capturing')
  .option('--wait-for-function <js>', 'Wait until this JS expression is truthy before capturing')
  .option('--wait-for-network-idle-ms <n>', 'Cap (ms) for the network-idle wait')
  .option('--freeze', 'Disable animations and force eager image loading')
  .option('--dpr <n>', 'Override device scale factor (e.g. 1 for smaller files)')
  .option('--concurrency <n>', 'Max viewports rendered in parallel')
  .option('--storage-state <path>', 'Playwright storage-state JSON to render logged in')
  .action(async (url: string, flags: Flags) => {
    try {
      const viewports = flags.viewports
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const shots = await render({
        url,
        viewports,
        out: flags.out,
        selector: flags.selector,
        waitFor: flags.waitFor,
        waitForFunction: flags.waitForFunction,
        networkIdleMs: positiveNumber(flags.waitForNetworkIdleMs, '--wait-for-network-idle-ms'),
        freeze: flags.freeze,
        dpr: positiveNumber(flags.dpr, '--dpr'),
        concurrency: positiveNumber(flags.concurrency, '--concurrency'),
        storageState: flags.storageState,
      });

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
  });

cli.help();
cli.version('0.0.0');
cli.parse();
