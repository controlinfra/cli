const runnerCommands = require('../commands/runners');
const runnerSetupCommands = require('../commands/runners-setup');
const runnerActionCommands = require('../commands/runners-actions');

function registerRunners(program) {
  const runners = program.command('runners').description('Manage self-hosted runners');

  runners
    .command('list')
    .alias('ls')
    .description('List all runners')
    .action(runnerCommands.list);

  runners
    .command('add [name]')
    .description('Create a new runner')
    .option('--labels <labels>', 'Comma-separated labels')
    .action(runnerCommands.add);

  runners
    .command('setup <runner-id>')
    .description('Get runner installation script')
    .option('--os <os>', 'Target OS (linux, macos, windows)', 'linux')
    .action(runnerSetupCommands.setup);

  runners
    .command('status <runner-id>')
    .description('Check runner status')
    .action(runnerCommands.status);

  runners
    .command('remove <runner-id>')
    .alias('rm')
    .description('Delete a runner')
    .option('--force', 'Skip confirmation')
    .action(runnerCommands.remove);

  runners
    .command('token <runner-id>')
    .description('Regenerate runner authentication token')
    .action(runnerCommands.regenerateToken);

  runners
    .command('update <runner-id>')
    .description('Update runner configuration')
    .option('--name <name>', 'New runner name')
    .option('--description <desc>', 'Runner description')
    .option('--labels <labels>', 'Comma-separated labels')
    .action(runnerActionCommands.update);

  runners
    .command('offline <runner-id>')
    .description('Mark a runner as offline')
    .action(runnerActionCommands.markOffline);
}

module.exports = registerRunners;
