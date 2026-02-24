const driftCommands = require('../commands/drifts');
const driftActionCommands = require('../commands/drifts-actions');

function registerDrifts(program) {
  const drifts = program.command('drifts').description('Manage detected drifts');

  drifts
    .command('list')
    .alias('ls')
    .description('List drifts')
    .option('--scan <id>', 'Filter by scan')
    .option('--repo <id>', 'Filter by repository')
    .option('--severity <level>', 'Filter by severity (critical, high, medium, low)')
    .option('--status <status>', 'Filter by status')
    .option('--limit <n>', 'Number of drifts to show', '50')
    .action(driftCommands.list);

  drifts
    .command('show <drift-id>')
    .description('Show drift details')
    .action(driftCommands.show);

  drifts
    .command('fix <drift-id>')
    .description('Generate AI fix for drift')
    .option('--provider <name>', 'AI provider (anthropic, openai)')
    .action(driftCommands.fix);

  drifts
    .command('pr <drift-id>')
    .description('Create pull request with fix')
    .option('--auto-merge', 'Enable auto-merge on PR')
    .action(driftCommands.createPR);

  drifts
    .command('ignore <drift-id>')
    .description('Mark drift as ignored')
    .action(driftCommands.ignore);

  drifts
    .command('resolve <drift-id>')
    .description('Mark drift as resolved')
    .action(driftCommands.resolve);

  drifts
    .command('stats')
    .description('Show drift statistics')
    .option('--repo <id>', 'Filter by repository')
    .action(driftActionCommands.stats);

  drifts
    .command('reanalyze <drift-id>')
    .description('Reanalyze a drift with AI')
    .action(driftActionCommands.reanalyze);

  drifts
    .command('export')
    .description('Export drifts to JSON')
    .option('--repo <id>', 'Filter by repository')
    .option('--status <status>', 'Filter by status')
    .option('--output <path>', 'Output file path')
    .action(driftActionCommands.exportDrifts);
}

module.exports = registerDrifts;
