import { render } from '@refract/core';
import { cac } from 'cac';

// Thin wrapper over @refract/core. Keep this file <100 lines.
const cli = cac('refract');

interface Flags {
  viewports: string;
  out: string;
  selector?: string;
  freeze?: boolean;
  dpr?: string;
  concurrency?: string;
}

cli
  .command('<url>', 'Render responsive screenshots of a URL')
  .option('--viewports <list>', 'Comma-separated presets or WxH', {
    default: 'mobile,tablet,desktop',
  })
  .option('--out <dir>', 'Output directory', { default: './refract-shots' })
  .option('--selector <css>', 'Clip to a single element')
  .option('--freeze', 'Disable animations and force eager image loading')
  .option('--dpr <n>', 'Override device scale factor (e.g. 1 for smaller files)')
  .option('--concurrency <n>', 'Max viewports rendered in parallel')
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
        freeze: flags.freeze,
        dpr: flags.dpr !== undefined ? Number(flags.dpr) : undefined,
        concurrency: flags.concurrency !== undefined ? Number(flags.concurrency) : undefined,
      });

      for (const s of shots) {
        console.log(`${s.preset.padEnd(20)} ${s.width}x${s.height}  ${s.savedPath}`);
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
