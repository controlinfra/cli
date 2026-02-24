const chalk = require('chalk');
const inquirer = require('inquirer');
const { integrations } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox, brand } = require('../output');

/**
 * Setup AWS credentials
 */
async function setup(options) {
  requireAuth();

  let accessKey = options.accessKey;
  let secretKey = options.secretKey;
  let region = options.region || 'us-east-1';

  // Interactive prompt if credentials not provided
  if (!accessKey || !secretKey) {
    console.log(chalk.bold('\n  AWS Credentials Setup\n'));
    console.log(chalk.dim('  These credentials are used to access your AWS account for drift detection.\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'accessKey',
        message: 'AWS Access Key ID:',
        validate: (input) => input.length >= 16 || 'Invalid Access Key ID',
        when: () => !accessKey,
      },
      {
        type: 'password',
        name: 'secretKey',
        message: 'AWS Secret Access Key:',
        mask: '*',
        validate: (input) => input.length >= 30 || 'Invalid Secret Access Key',
        when: () => !secretKey,
      },
      {
        type: 'input',
        name: 'region',
        message: 'Default AWS Region:',
        default: 'us-east-1',
        when: () => !options.region,
      },
    ]);

    accessKey = accessKey || answers.accessKey;
    secretKey = secretKey || answers.secretKey;
    region = answers.region || region;
  }

  const spinner = createSpinner('Saving AWS credentials...').start();

  try {
    await integrations.saveAwsCredentials({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region,
    });
    spinner.succeed('AWS credentials saved');

    console.log(chalk.dim('\nTest credentials with:'), brand.cyan('controlinfra aws test\n'));
  } catch (error) {
    spinner.fail('Failed to save AWS credentials');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show AWS credentials status
 */
async function status(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching AWS status...').start();

  try {
    const data = await integrations.getAwsCredentials();
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    if (data.configured || data.accessKeyId) {
      outputBox('AWS Credentials', [
        `Status:      ${chalk.green('Configured')}`,
        `Access Key:  ${chalk.dim(maskAccessKey(data.accessKeyId))}`,
        `Region:      ${data.region || 'us-east-1'}`,
      ].join('\n'));
    } else {
      console.log(chalk.yellow('AWS credentials not configured\n'));
      console.log(chalk.dim('Set up with:'), brand.cyan('controlinfra aws setup\n'));
    }
  } catch (error) {
    spinner.fail('Failed to fetch AWS status');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Test AWS credentials
 */
async function test(_options) {
  requireAuth();

  const spinner = createSpinner('Validating AWS credentials...').start();

  try {
    // Try to get full credentials and validate
    const data = await integrations.getAwsCredentials();

    if (!data.configured && !data.accessKeyId) {
      spinner.fail('AWS credentials not configured');
      console.log(chalk.dim('\nSet up with:'), brand.cyan('controlinfra aws setup\n'));
      process.exit(1);
    }

    // If we can fetch them, they're at least stored correctly
    // The actual AWS validation happens during scans
    spinner.succeed('AWS credentials are configured');
    console.log(chalk.dim('\nCredentials will be validated during the next scan.\n'));
  } catch (error) {
    spinner.fail('Failed to validate AWS credentials');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove AWS credentials
 */
async function remove(_options) {
  requireAuth();

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to remove AWS credentials?',
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim('Cancelled\n'));
    return;
  }

  const spinner = createSpinner('Removing AWS credentials...').start();

  try {
    await integrations.deleteAwsCredentials();
    spinner.succeed('AWS credentials removed');
  } catch (error) {
    spinner.fail('Failed to remove AWS credentials');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Mask access key for display
 */
function maskAccessKey(key) {
  if (!key) return '-';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

module.exports = {
  setup,
  status,
  test,
  remove,
};
