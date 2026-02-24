const chalk = require('chalk');
const inquirer = require('inquirer');
const { integrations } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox, brand } = require('../output');
const { setup } = require('./gcp-setup');

/**
 * Show GCP credentials status
 */
async function status(options) {
  requireAuth();

  const spinner = createSpinner('Fetching GCP status...').start();

  try {
    const data = await integrations.getGcpCredentials();
    spinner.stop();

    if (options?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    if (data.hasCredentials && data.credentials) {
      const lines = [
        `Status:          ${chalk.green('Configured')}`,
        `Auth Method:     ${data.credentials.authMethod || 'service_account'}`,
      ];

      if (data.credentials.projectId) {
        lines.push(`Project ID:      ${chalk.dim(data.credentials.projectId)}`);
      }
      if (data.credentials.clientEmail) {
        lines.push(`Service Account: ${chalk.dim(data.credentials.clientEmail)}`);
      }
      if (data.credentials.hasPrivateKey) {
        lines.push(`Private Key:     ${chalk.dim('        ')}`);
      }

      outputBox('GCP Credentials', lines.join('\n'));
    } else {
      console.log(chalk.yellow('GCP credentials not configured\n'));
      console.log(chalk.dim('Set up with:'), brand.cyan('controlinfra gcp setup\n'));
    }
  } catch (error) {
    spinner.fail('Failed to fetch GCP status');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Check if GCP credentials are configured
 */
async function test(_options) {
  requireAuth();

  const spinner = createSpinner('Checking GCP credentials...').start();

  try {
    const data = await integrations.getGcpCredentials();

    if (!data.hasCredentials) {
      spinner.fail('GCP credentials not configured');
      console.log(chalk.dim('\nSet up with:'), brand.cyan('controlinfra gcp setup\n'));
      process.exit(1);
    }

    spinner.succeed('GCP credentials are configured');
    console.log(chalk.dim('\nNote: This confirms credentials are stored. They will be'));
    console.log(chalk.dim('validated against GCP during the next scan.\n'));
  } catch (error) {
    spinner.fail('Failed to check GCP credentials');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove GCP credentials
 */
async function remove(_options) {
  requireAuth();

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to remove GCP credentials?',
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('Cancelled\n'));
    return;
  }

  const spinner = createSpinner('Removing GCP credentials...').start();

  try {
    await integrations.deleteGcpCredentials();
    spinner.succeed('GCP credentials removed');
  } catch (error) {
    spinner.fail('Failed to remove GCP credentials');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = {
  setup,
  status,
  test,
  remove,
};
