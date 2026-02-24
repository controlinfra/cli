const chalk = require('chalk');
const { setApiUrl, getApiUrl, getConfigPath, reset } = require('../config');
const { brand } = require('../output');
const authTokenCommands = require('../commands/auth-tokens');

function registerConfig(program) {
  const cfg = program.command('config').description('Manage CLI configuration');

  cfg
    .command('set <key> <value>')
    .description('Set a config value (e.g., apiUrl)')
    .action((key, value) => {
      if (key === 'apiUrl') {
        setApiUrl(value);
        console.log(brand.cyan(`  apiUrl set to ${value}`));
      } else {
        console.log(chalk.red(`  Unknown config key: ${key}`));
        console.log(chalk.dim('  Available keys: apiUrl'));
      }
    });

  cfg
    .command('get <key>')
    .description('Get a config value')
    .action((key) => {
      if (key === 'apiUrl') {
        console.log(getApiUrl());
      } else if (key === 'path') {
        console.log(getConfigPath());
      } else {
        console.log(chalk.red(`  Unknown config key: ${key}`));
        console.log(chalk.dim('  Available keys: apiUrl, path'));
      }
    });

  cfg
    .command('reset')
    .description('Reset all configuration')
    .action(() => {
      reset();
      console.log(brand.cyan('  Configuration reset to defaults'));
    });

  cfg
    .command('path')
    .description('Show config file path')
    .action(() => {
      console.log(getConfigPath());
    });

  // Token management
  const tokens = program.command('tokens').description('Manage CLI API tokens');

  tokens
    .command('list')
    .alias('ls')
    .description('List CLI tokens')
    .action(authTokenCommands.list);

  tokens
    .command('create <name>')
    .description('Create a new CLI token')
    .option('--scopes <scopes>', 'Comma-separated scopes')
    .option('--expires-in <days>', 'Token expiry in days')
    .action(authTokenCommands.create);

  tokens
    .command('revoke <id>')
    .description('Revoke a CLI token')
    .action(authTokenCommands.revoke);
}

module.exports = registerConfig;
