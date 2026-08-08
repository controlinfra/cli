import chalk from 'chalk';
import inquirer from 'inquirer';
import { integrations } from '../api.js';
import { requireAuth } from '../config.js';
import { createSpinner, outputError, outputBox, brand } from '../output.js';

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
    // The endpoint shape was changed when CloudAccount support landed
    // (multi-account + assume_role auth). It now returns:
    //   { success, hasCredentials, credentials: { authMethod, region,
    //     accessKeyId?, roleArn?, accountId? }, source }
    // The CLI used to check data.configured / data.accessKeyId — both
    // are gone from the new shape, so this fell into the "not configured"
    // branch even when an assume_role account was wired up. Read the
    // real fields now.
    const creds = data.credentials || {};
    if (data.hasCredentials || data.configured || creds.accessKeyId || creds.roleArn) {
      const authMethod = creds.authMethod || 'credentials';
      const region = creds.region || data.region || 'us-east-1';
      const lines = [
        `Status:      ${chalk.green('Configured')}`,
        `Auth method: ${authMethod}`,
      ];
      if (authMethod === 'assume_role' && creds.roleArn) {
        // roleArn is encrypted on the wire; only display the suffix.
        lines.push(`Role ARN:    ${chalk.dim('(encrypted)')}`);
      } else if (creds.accessKeyId) {
        lines.push(`Access Key:  ${chalk.dim(maskAccessKey(creds.accessKeyId))}`);
      }
      if (creds.accountId) lines.push(`Account ID:  ${creds.accountId}`);
      if (creds.accountName) lines.push(`Account:     ${creds.accountName}`);
      lines.push(`Region:      ${region}`);
      outputBox('AWS Credentials', lines.join('\n'));
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
async function remove(options) {
  requireAuth();

  // --force skips the interactive confirm — matches `workspaces rm
  // --force`, `projects delete --force`, `orgs delete --force`,
  // `scan delete --force`, `repos remove --force`. Without it the
  // command can't be used in CI/CD where stdin is closed.
  if (!options?.force) {
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

export { setup, status, test, remove };