const chalk = require('chalk');
const inquirer = require('inquirer');
const { workspaces } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  formatRelativeTime,
  brand,
} = require('../output');

/**
 * List workspaces
 */
async function list(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching workspaces...').start();

  try {
    const data = await workspaces.list();
    const workspaceList = data.workspaces || data || [];
    spinner.stop();

    const isJson = command?.parent?.parent?.opts()?.json;
    if (isJson) {
      console.log(JSON.stringify(workspaceList, null, 2));
      return;
    }

    if (workspaceList.length === 0) {
      console.log(chalk.yellow('\nNo workspaces found\n'));
      console.log(chalk.dim('Create a workspace with'), brand.cyan('controlinfra workspaces add <name>\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Name', 'Cloud', 'Default', 'Created'],
      workspaceList.map((ws) => [
        chalk.dim(ws._id?.slice(-8) || '-'),
        brand.cyan(ws.name || '-'),
        ws.cloudProvider || '-',
        ws.isDefault ? chalk.green('Yes') : chalk.dim('No'),
        formatRelativeTime(ws.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch workspaces');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Create a new workspace
 */
async function add(name, options) {
  requireAuth();

  const cloudProvider = options.cloudProvider || 'aws';
  if (!['aws', 'azure', 'gcp'].includes(cloudProvider)) {
    outputError('Invalid cloud provider. Must be: aws, azure, or gcp');
    process.exit(1);
  }

  const spinner = createSpinner(`Creating workspace "${name}"...`).start();

  try {
    const payload = { name, cloudProvider };

    if (cloudProvider === 'aws') {
      payload.awsConfig = { authMethod: options.authMethod || 'credentials', region: options.region || 'us-east-1' };
    } else if (cloudProvider === 'azure') {
      payload.azureConfig = { authMethod: options.azureAuthMethod || 'service_principal', environment: options.azureEnvironment || 'public' };
      if (options.subscriptionId) payload.azureConfig.subscriptionId = options.subscriptionId;
    } else if (cloudProvider === 'gcp') {
      let projectId = options.gcpProjectId, clientEmail = options.gcpClientEmail, privateKey = options.gcpPrivateKey;
      if (options.gcpJsonFile) {
        try {
          const fs = require('fs');
          const sa = JSON.parse(fs.readFileSync(options.gcpJsonFile, 'utf8'));
          projectId = sa.project_id || projectId;
          clientEmail = sa.client_email || clientEmail;
          privateKey = sa.private_key || privateKey;
        } catch (err) {
          spinner.fail('Failed to read GCP JSON file');
          outputError(err.message);
          process.exit(1);
        }
      }
      payload.gcpConfig = { authMethod: options.gcpAuthMethod || 'service_account' };
      if (projectId) payload.gcpConfig.projectId = projectId;
      if (clientEmail) payload.gcpConfig.clientEmail = clientEmail;
      if (privateKey) payload.gcpConfig.privateKey = privateKey;
    }

    const result = await workspaces.create(payload);
    spinner.succeed(`Workspace "${brand.cyan(name)}" created successfully`);

    if (result.workspace?._id || result._id) {
      const wsId = result.workspace?._id || result._id;
      console.log(chalk.dim(`\nWorkspace ID: ${wsId}`));
      console.log(chalk.dim('Add a repository to this workspace with:'));
      console.log(brand.cyan(`  controlinfra repos add <owner/repo> --workspace ${wsId}\n`));
    }
  } catch (error) {
    spinner.fail('Failed to create workspace');
    const msg = error.response?.data?.error || error.response?.data?.message || error.message;
    outputError(msg);
    process.exit(1);
  }
}

/**
 * Get workspace details
 */
async function info(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching workspace info...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    const data = await workspaces.get(fullId);
    const ws = data.workspace || data;
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(ws, null, 2));
      return;
    }

    console.log();
    outputBox('Workspace Details', [
      `Name:         ${brand.cyan(ws.name || '-')}`,
      `Cloud:        ${ws.cloudProvider || '-'}`,
      `Default:      ${ws.isDefault ? chalk.green('Yes') : 'No'}`,
      `Created:      ${formatRelativeTime(ws.createdAt)}`,
      `Updated:      ${formatRelativeTime(ws.updatedAt)}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch workspace info');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Update a workspace
 */
async function update(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Updating workspace...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    const updates = {};
    if (options.name) updates.name = options.name;
    if (options.cloudProvider) updates.cloudProvider = options.cloudProvider;

    if (Object.keys(updates).length === 0) {
      spinner.warn('No updates specified');
      return;
    }

    const data = await workspaces.update(fullId, updates);
    const ws = data.workspace || data;
    spinner.succeed('Workspace updated');

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(ws, null, 2));
    }
  } catch (error) {
    spinner.fail('Failed to update workspace');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Delete a workspace
 */
async function remove(id, options) {
  requireAuth();

  if (!options.force) {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm', name: 'confirm',
      message: 'Are you sure you want to delete this workspace? This cannot be undone.',
      default: false,
    }]);
    if (!confirm) {
      console.log(chalk.dim('Cancelled\n'));
      return;
    }
  }

  const spinner = createSpinner('Deleting workspace...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    await workspaces.delete(fullId);
    spinner.succeed('Workspace deleted successfully');
  } catch (error) {
    spinner.fail('Failed to delete workspace');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Set a workspace as default
 */
async function setDefault(id) {
  requireAuth();

  const spinner = createSpinner('Setting default workspace...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    await workspaces.setDefault(fullId);
    spinner.succeed('Default workspace updated');
  } catch (error) {
    spinner.fail('Failed to set default workspace');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Resolve a partial ID or name to a full workspace ID
 */
async function resolveWorkspaceId(partialId) {
  const data = await workspaces.list();
  const workspaceList = data.workspaces || data || [];

  const exactMatch = workspaceList.find((ws) => ws._id === partialId);
  if (exactMatch) return exactMatch._id;

  const partialMatch = workspaceList.find((ws) => ws._id?.endsWith(partialId));
  if (partialMatch) return partialMatch._id;

  const nameMatch = workspaceList.find(
    (ws) => (ws.name || '').toLowerCase().includes(partialId.toLowerCase()),
  );
  if (nameMatch) return nameMatch._id;

  return null;
}

module.exports = {
  list,
  add,
  info,
  update,
  remove,
  setDefault,
};
