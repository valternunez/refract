import { cac } from 'cac';

// Scaffold stub. Wires up the bin and --help so the surface exists; the render
// action lands with v0.1. Keep this file <100 lines — it's a thin wrapper over @refract/core.
const cli = cac('refract');

cli
  .command('<url>', 'Render responsive screenshots of a URL')
  .option('--viewports <list>', 'Comma-separated presets or WxH', {
    default: 'mobile,tablet,desktop',
  })
  .option('--out <dir>', 'Output directory', { default: './refract-shots' })
  .option('--selector <css>', 'Clip to a single element')
  .option('--freeze', 'Disable animations and force eager image loading')
  .action((_url: string) => {
    console.error('refract: not implemented yet — scaffold stub. See CLAUDE.md V0.1.');
    process.exitCode = 1;
  });

cli.help();
cli.version('0.0.0');
cli.parse();
