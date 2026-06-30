const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { integrations } = require('../api');
const { requireAuth } = require('../config');
const { createSpinner, outputError, brand } = require('../output');

function isValidProjectId(value) {
  return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value);
}

function isValidServiceAccountEmail(value) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(value);
}

function isValidPrivateKey(value) {
  return value.includes('-----BEGIN PRIVATE KEY-----') && value.includes('-----END PRIVATE KEY-----');
}

function parseServiceAccountJson(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${absolutePath}`);

  const content = fs.readFileSync(absolutePath, 'utf8');
  try {
    const json = JSON.parse(content);
    if (!json.project_id) throw new Error('Missing project_id in JSON file');
    if (!json.client_email) throw new Error('Missing client_email in JSON file');
    if (!json.private_key) throw new Error('Missing private_key in JSON file');
    return { projectId: json.project_id, clientEmail: json.client_email, privateKey: json.private_key };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Invalid JSON format in file', { cause: error });
    throw error;
  }
}

/**
 * Setup GCP credentials
 */
function isValidWifAudience(value) {
  // GCP WIF audience canonical form. Validating client-side catches typos
  // (missing leading //, wrong path segment order) before the API rejects.
  return /^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[^/]+\/providers\/[^/]+$/.test(value);
}

async function setup(options) {
  requireAuth();

  // Precedence: explicit --workload-identity-federation > --workload-identity > service_account.
  // WIF takes priority because it's the more specific opt-in mode.
  let authMethod;
  if (options.workloadIdentityFederation) authMethod = 'workload_identity_federation';
  else if (options.workloadIdentity) authMethod = 'workload_identity';
  else authMethod = 'service_account';

  let projectId = options.projectId;
  let clientEmail = options.clientEmail;
  let privateKey = options.privateKey;
  let audience = options.audience;
  let serviceAccountEmail = options.serviceAccountEmail;

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
    console.log(chalk.bold('\n  GCP Workload Identity Setup\n'));
    console.log(chalk.dim('  Uses automatic credentials from GKE/Cloud Run environment.\n'));
    if (!projectId) {
      const answers = await inquirer.prompt([{
        type: 'input', name: 'projectId', message: 'GCP Project ID (optional):',
        validate: (input) => !input || isValidProjectId(input) || 'Invalid Project ID format',
      }]);
      projectId = answers.projectId || undefined;
    }
  } else if (authMethod === 'workload_identity_federation') {
    console.log(chalk.bold('\n  GCP Workload Identity Federation Setup\n'));
    console.log(chalk.dim('  Zero-credential auth: Controlinfra mints a signed OIDC token,'));
    console.log(chalk.dim('  GCP STS federates it, IAM impersonates your service account.\n'));
    const prompts = [];
    if (!projectId) {
      prompts.push({ type: 'input', name: 'projectId', message: 'GCP Project ID:',
        validate: (input) => isValidProjectId(input) || 'Invalid Project ID format' });
    }
    if (!audience) {
      prompts.push({ type: 'input', name: 'audience',
        message: 'WIF pool/provider audience (//iam.googleapis.com/projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider>):',
        validate: (input) => isValidWifAudience(input) || 'Invalid audience format' });
    }
    if (!serviceAccountEmail) {
      prompts.push({ type: 'input', name: 'serviceAccountEmail', message: 'Service Account to impersonate:',
        validate: (input) => isValidServiceAccountEmail(input) || 'Must be a valid service account email' });
    }
    if (prompts.length > 0) {
      const answers = await inquirer.prompt(prompts);
      projectId = projectId || answers.projectId;
      audience = audience || answers.audience;
      serviceAccountEmail = serviceAccountEmail || answers.serviceAccountEmail;
    }
    // Flag-only paths bypass the inquirer `validate` callbacks (those only run
    // when a prompt is shown). Re-check the three WIF fields here so bad values
    // passed via --project-id / --service-account-email don't reach the API.
    if (!isValidProjectId(projectId || '')) {
      outputError('Invalid Project ID format');
      process.exit(1);
    }
    if (!isValidWifAudience(audience)) {
      outputError('Invalid WIF audience format. Expected: //iam.googleapis.com/projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider>');
      process.exit(1);
    }
    if (!isValidServiceAccountEmail(serviceAccountEmail || '')) {
      outputError('Must be a valid service account email');
      process.exit(1);
    }
  } else if (!projectId || !clientEmail || !privateKey) {
    console.log(chalk.bold('\n  GCP Service Account Setup\n'));
    console.log(chalk.dim('  Download JSON key from: GCP Console > IAM > Service Accounts > Keys\n'));

    const { importChoice } = await inquirer.prompt([{
      type: 'list', name: 'importChoice', message: 'How would you like to provide credentials?',
      choices: [
        { name: 'Import from JSON key file', value: 'json' },
        { name: 'Enter manually', value: 'manual' },
      ],
    }]);

    if (importChoice === 'json') {
      const { filePath } = await inquirer.prompt([{
        type: 'input', name: 'filePath', message: 'Path to JSON key file:',
        validate: (input) => fs.existsSync(path.resolve(input)) || `File not found: ${path.resolve(input)}`,
      }]);
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
      const answers = await inquirer.prompt([
        { type: 'input', name: 'projectId', message: 'GCP Project ID:',
          validate: (input) => isValidProjectId(input) || 'Invalid Project ID format', when: () => !projectId },
        { type: 'input', name: 'clientEmail', message: 'Service Account Email:',
          validate: (input) => isValidServiceAccountEmail(input) || 'Must be a valid service account email', when: () => !clientEmail },
        { type: 'editor', name: 'privateKey', message: 'Private Key (PEM format - opens editor):',
          validate: (input) => isValidPrivateKey(input) || 'Must be a valid PEM private key', when: () => !privateKey },
      ]);
      projectId = projectId || answers.projectId;
      clientEmail = clientEmail || answers.clientEmail;
      privateKey = privateKey || answers.privateKey;
    }
  }

  const spinner = createSpinner('Saving GCP credentials...').start();
  try {
    const credentials = { authMethod };
    if (projectId) credentials.projectId = projectId;
    if (clientEmail) credentials.clientEmail = clientEmail;
    if (privateKey) credentials.privateKey = privateKey;
    if (audience) credentials.audience = audience;
    if (serviceAccountEmail) credentials.serviceAccountEmail = serviceAccountEmail;

    await integrations.saveGcpCredentials(credentials);
    spinner.succeed('GCP credentials saved');
    console.log(chalk.dim('\nTest credentials with:'), brand.cyan('controlinfra gcp test\n'));
  } catch (error) {
    spinner.fail('Failed to save GCP credentials');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { setup };
