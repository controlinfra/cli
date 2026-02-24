const chalk = require('chalk');
const { cliTokens } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  brand,
  formatRelativeTime,
} = require('../output');

/**
 * List CLI tokens
 */
async function list(options) {
  requireAuth();

  const spinner = createSpinner('Fetching tokens...').start();

  try {
    const data = await cliTokens.list();
    const tokenList = data.tokens || data || [];
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(tokenList, null, 2));
      return;
    }

    if (tokenList.length === 0) {
      console.log(chalk.yellow('\nNo CLI tokens found\n'));
      console.log(chalk.dim('Create a token with'), brand.cyan('controlinfra tokens create <name>\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Name', 'Scopes', 'Created', 'Last Used', 'Expires'],
      tokenList.map((token) => [
        chalk.dim((token.id || token._id)?.slice(-8) || '-'),
        brand.cyan(token.name || '-'),
        (token.scopes || []).join(', ') || 'all',
        formatRelativeTime(token.createdAt),
        formatRelativeTime(token.lastUsedAt),
        token.expiresAt ? formatRelativeTime(token.expiresAt) : 'never',
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch tokens');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Create a new CLI token
 */
async function create(name, options) {
  requireAuth();

  const spinner = createSpinner('Creating token...').start();

  try {
    const tokenOptions = {};
    if (options.scopes) {
      tokenOptions.scopes = options.scopes.split(',').map((s) => s.trim());
    }
    if (options.expiresIn) {
      tokenOptions.expiresInDays = parseInt(options.expiresIn, 10);
    }

    const data = await cliTokens.create(name, tokenOptions);
    const token = data.token || data;
    spinner.succeed(`Token "${brand.cyan(name)}" created`);

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    console.log(brand.purpleBold('Token:'), chalk.yellow(token.value || token.token || '[hidden]'));
    console.log();
    console.log(chalk.yellow('  Copy this token now. It will not be shown again.'));
    console.log(chalk.dim('  Use with: controlinfra login --token <token>\n'));
  } catch (error) {
    spinner.fail('Failed to create token');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Revoke a CLI token
 */
async function revoke(id, _options) {
  requireAuth();

  const spinner = createSpinner('Revoking token...').start();

  try {
    await cliTokens.revoke(id);
    spinner.succeed('Token revoked successfully');
  } catch (error) {
    spinner.fail('Failed to revoke token');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { list, create, revoke };
