const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { integrations } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, outputBox, brand } = require('../output');

/**
 * Validate GCP Project ID format
 * Must be 6-30 chars, lowercase letters, digits, and hyphens
 */
function isValidProjectId(value) {
  const pattern = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
  return pattern.test(value);
}

/**
 * Validate GCP Service Account email format
 */
function isValidServiceAccountEmail(value) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/;
  return pattern.test(value);
}

/**
 * Validate private key PEM format
 */
function isValidPrivateKey(value) {
  return value.includes('-----BEGIN PRIVATE KEY-----') && value.includes('-----END PRIVATE KEY-----');
}

/**
 * Parse GCP service account JSON file
 */
function parseServiceAccountJson(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');

  try {
    const json = JSON.parse(content);

    // Validate required fields
    if (!json.project_id) {
      throw new Error('Missing project_id in JSON file');
    }
    if (!json.client_email) {
      throw new Error('Missing client_email in JSON file');
    }
    if (!json.private_key) {
      throw new Error('Missing private_key in JSON file');
    }

    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format in file');
    }
    throw error;
  }
}

/**
 * Setup GCP credentials
 */
async function setup(options) {
  requireAuth();

  let authMethod = options.workloadIdentity ? 'workload_identity' : 'service_account';
  let projectId = options.projectId;
  let clientEmail = options.clientEmail;
  let privateKey = options.privateKey;

  // If JSON file provided, parse it
  if (options.jsonFile) {
    console.log(chalk.dim('\n  Importing from JSON file...\n'));

    try {
      const parsed = parseServiceAccountJson(options.jsonFile);
      projectId = parsed.projectId;
      clientEmail = parsed.clientEmail;
      privateKey = parsed.privateKey;
      authMethod = 'service_account';

      console.log(chalk.green('  ✓'), 'Parsed project:', brand.cyan(projectId));
      console.log(chalk.green('  ✓'), 'Parsed service account:', brand.cyan(clientEmail));
      console.log(chalk.green('  ✓'), 'Private key found\n');
    } catch (error) {
      outputError(error.message);
      process.exit(1);
    }
  } else if (authMethod === 'workload_identity') {
    // Workload identity mode - minimal prompts
    console.log(chalk.bold('\n  GCP Workload Identity Setup\n'));
    console.log(chalk.dim('  Uses automatic credentials from GKE/Cloud Run environment.\n'));

    if (!projectId) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectId',
          message: 'GCP Project ID (optional):',
          validate: (input) => {
            if (!input) return true; // Optional
            return isValidProjectId(input) || 'Invalid Project ID format (6-30 lowercase chars, digits, hyphens)';
          },
        },
      ]);
      projectId = answers.projectId || undefined;
    }
  } else {
    // Service account mode - full prompts
    if (!projectId || !clientEmail || !privateKey) {
      console.log(chalk.bold('\n  GCP Service Account Setup\n'));
      console.log(chalk.dim('  These credentials are used to access your GCP account for drift detection.'));
      console.log(chalk.dim('  You can provide a service account JSON key file or enter details manually.\n'));
      console.log(chalk.dim('  Download JSON key from: GCP Console > IAM > Service Accounts > Keys\n'));

      // Ask if they want to import from file
      const { importChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'importChoice',
          message: 'How would you like to provide credentials?',
          choices: [
            { name: 'Import from JSON key file', value: 'json' },
            { name: 'Enter manually', value: 'manual' },
          ],
        },
      ]);

      if (importChoice === 'json') {
        const { filePath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filePath',
            message: 'Path to JSON key file:',
            validate: (input) => {
              const absolutePath = path.resolve(input);
              if (!fs.existsSync(absolutePath)) {
                return `File not found: ${absolutePath}`;
              }
              return true;
            },
          },
        ]);

        try {
          const parsed = parseServiceAccountJson(filePath);
          projectId = parsed.projectId;
          clientEmail = parsed.clientEmail;
          privateKey = parsed.privateKey;

          console.log(chalk.green('\n  ✓'), 'Parsed project:', brand.cyan(projectId));
          console.log(chalk.green('  ✓'), 'Parsed service account:', brand.cyan(clientEmail));
          console.log(chalk.green('  ✓'), 'Private key found\n');
        } catch (error) {
          outputError(error.message);
          process.exit(1);
        }
      } else {
        // Manual entry
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectId',
            message: 'GCP Project ID:',
            validate: (input) => isValidProjectId(input) || 'Invalid Project ID format (6-30 lowercase chars, digits, hyphens)',
            when: () => !projectId,
          },
          {
            type: 'input',
            name: 'clientEmail',
            message: 'Service Account Email:',
            validate: (input) => isValidServiceAccountEmail(input) || 'Must be a valid service account email (*@*.iam.gserviceaccount.com)',
            when: () => !clientEmail,
          },
          {
            type: 'editor',
            name: 'privateKey',
            message: 'Private Key (PEM format - opens editor):',
            validate: (input) => isValidPrivateKey(input) || 'Must be a valid PEM private key',
            when: () => !privateKey,
          },
        ]);

        projectId = projectId || answers.projectId;
        clientEmail = clientEmail || answers.clientEmail;
        privateKey = privateKey || answers.privateKey;
      }
    }
  }

  const spinner = createSpinner('Saving GCP credentials...').start();

  try {
    const credentials = { authMethod };

    if (projectId) credentials.projectId = projectId;
    if (clientEmail) credentials.clientEmail = clientEmail;
    if (privateKey) credentials.privateKey = privateKey;

    await integrations.saveGcpCredentials(credentials);
    spinner.succeed('GCP credentials saved');

    console.log(chalk.dim('\nTest credentials with:'), brand.cyan('controlinfra gcp test\n'));
  } catch (error) {
    spinner.fail('Failed to save GCP credentials');
    outputError(error.message);
    process.exit(1);
  }
}

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
        lines.push(`Private Key:     ${chalk.dim('••••••••')}`);
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
 * Note: This only verifies credentials are stored, not that they're valid for GCP API access.
 * Actual validation occurs during scans when Terraform authenticates with GCP.
 */
async function test(_options) {
  requireAuth();

  const spinner = createSpinner('Checking GCP credentials...').start();

  try {
    // Check if credentials are stored in the system
    const data = await integrations.getGcpCredentials();

    if (!data.hasCredentials) {
      spinner.fail('GCP credentials not configured');
      console.log(chalk.dim('\nSet up with:'), brand.cyan('controlinfra gcp setup\n'));
      process.exit(1);
    }

    // Credentials are stored - display what we have
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
