const chalk = require('chalk');
const inquirer = require('inquirer');
const { integrations } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox, brand } = require('../output');

/**
 * Validate Azure UUID format
 */
function isValidUUID(value) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

/**
 * Setup Azure credentials
 */
async function setup(options) {
  requireAuth();

  let subscriptionId = options.subscriptionId;
  let tenantId = options.tenantId;
  let clientId = options.clientId;
  let clientSecret = options.clientSecret;
  let environment = options.environment || 'public';

  // Interactive prompt if credentials not provided
  if (!subscriptionId || !tenantId || !clientId || !clientSecret) {
    console.log(chalk.bold('\n  Azure Credentials Setup\n'));
    console.log(chalk.dim('  These credentials are used to access your Azure account for drift detection.'));
    console.log(chalk.dim('  You need an Azure Service Principal with appropriate permissions.\n'));
    console.log(chalk.dim('  Create one with: az ad sp create-for-rbac --name "controlinfra" --role Reader\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'subscriptionId',
        message: 'Azure Subscription ID:',
        validate: (input) => isValidUUID(input) || 'Invalid Subscription ID format (must be a UUID)',
        when: () => !subscriptionId,
      },
      {
        type: 'input',
        name: 'tenantId',
        message: 'Azure Tenant ID:',
        validate: (input) => isValidUUID(input) || 'Invalid Tenant ID format (must be a UUID)',
        when: () => !tenantId,
      },
      {
        type: 'input',
        name: 'clientId',
        message: 'Azure Client ID (Application ID):',
        validate: (input) => isValidUUID(input) || 'Invalid Client ID format (must be a UUID)',
        when: () => !clientId,
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Azure Client Secret:',
        mask: '*',
        validate: (input) => input.length >= 10 || 'Client Secret seems too short',
        when: () => !clientSecret,
      },
      {
        type: 'list',
        name: 'environment',
        message: 'Azure Environment:',
        choices: [
          { name: 'Public (default)', value: 'public' },
          { name: 'US Government', value: 'usgovernment' },
          { name: 'German', value: 'german' },
          { name: 'China', value: 'china' },
        ],
        default: 'public',
        when: () => !options.environment,
      },
    ]);

    subscriptionId = subscriptionId || answers.subscriptionId;
    tenantId = tenantId || answers.tenantId;
    clientId = clientId || answers.clientId;
    clientSecret = clientSecret || answers.clientSecret;
    environment = answers.environment || environment;
  }

  const spinner = createSpinner('Saving Azure credentials...').start();

  try {
    await integrations.saveAzureCredentials({
      authMethod: 'service_principal',
      subscriptionId,
      tenantId,
      clientId,
      clientSecret,
      environment,
    });
    spinner.succeed('Azure credentials saved');

    console.log(chalk.dim('\nTest credentials with:'), brand.cyan('controlinfra azure test\n'));
  } catch (error) {
    spinner.fail('Failed to save Azure credentials');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show Azure credentials status
 */
async function status(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching Azure status...').start();

  try {
    const data = await integrations.getAzureCredentials();
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    if (data.hasCredentials && data.credentials) {
      outputBox('Azure Credentials', [
        `Status:          ${chalk.green('Configured')}`,
        `Auth Method:     ${data.credentials.authMethod || 'service_principal'}`,
        `Subscription ID: ${chalk.dim(maskUUID(data.credentials.subscriptionId))}`,
        `Tenant ID:       ${chalk.dim(maskUUID(data.credentials.tenantId))}`,
        `Client ID:       ${chalk.dim(maskUUID(data.credentials.clientId))}`,
        `Environment:     ${data.credentials.environment || 'public'}`,
      ].join('\n'));
    } else {
      console.log(chalk.yellow('Azure credentials not configured\n'));
      console.log(chalk.dim('Set up with:'), brand.cyan('controlinfra azure setup\n'));
    }
  } catch (error) {
    spinner.fail('Failed to fetch Azure status');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Check if Azure credentials are configured
 * Note: This only verifies credentials are stored, not that they're valid for Azure API access.
 * Actual validation occurs during scans when Terraform authenticates with Azure.
 */
async function test(_options) {
  requireAuth();

  const spinner = createSpinner('Checking Azure credentials...').start();

  try {
    // Check if credentials are stored in the system
    const data = await integrations.getAzureCredentials();

    if (!data.hasCredentials) {
      spinner.fail('Azure credentials not configured');
      console.log(chalk.dim('\nSet up with:'), brand.cyan('controlinfra azure setup\n'));
      process.exit(1);
    }

    // Credentials are stored - display what we have
    spinner.succeed('Azure credentials are configured');
    console.log(chalk.dim('\nNote: This confirms credentials are stored. They will be'));
    console.log(chalk.dim('validated against Azure during the next scan.\n'));
  } catch (error) {
    spinner.fail('Failed to check Azure credentials');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove Azure credentials
 */
async function remove(_options) {
  requireAuth();

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to remove Azure credentials?',
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('Cancelled\n'));
    return;
  }

  const spinner = createSpinner('Removing Azure credentials...').start();

  try {
    await integrations.deleteAzureCredentials();
    spinner.succeed('Azure credentials removed');
  } catch (error) {
    spinner.fail('Failed to remove Azure credentials');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Mask UUID for display
 */
function maskUUID(uuid) {
  if (!uuid) return '-';
  if (uuid.length <= 12) return '****';
  return uuid.slice(0, 4) + '****' + uuid.slice(-4);
}

module.exports = {
  setup,
  status,
  test,
  remove,
};
