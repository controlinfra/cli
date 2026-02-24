const chalk = require('chalk');
const { workspaces } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  brand,
  formatRelativeTime,
} = require('../output');

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

/**
 * List workspace access
 */
async function access(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching workspace access...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    const data = await workspaces.getAccess(fullId);
    const members = data.members || data.access || data || [];
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(members, null, 2));
      return;
    }

    if (members.length === 0) {
      console.log(chalk.yellow('\nNo access entries found\n'));
      return;
    }

    console.log();
    outputTable(
      ['User', 'Role', 'Added'],
      members.map((m) => [
        brand.cyan(m.user?.email || m.userId || '-'),
        m.role || 'viewer',
        formatRelativeTime(m.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch workspace access');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Grant user access to workspace
 */
async function addAccess(id, userId, options) {
  requireAuth();

  const spinner = createSpinner('Granting access...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    await workspaces.addAccess(fullId, userId, options.role || 'viewer');
    spinner.succeed(`Access granted to ${brand.cyan(userId)}`);
  } catch (error) {
    spinner.fail('Failed to grant access');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove user access from workspace
 */
async function removeAccess(id, userId, _options) {
  requireAuth();

  const spinner = createSpinner('Removing access...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    await workspaces.removeAccess(fullId, userId);
    spinner.succeed(`Access removed for ${brand.cyan(userId)}`);
  } catch (error) {
    spinner.fail('Failed to remove access');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Set workspace visibility
 */
async function setVisibility(id, visibility, _options) {
  requireAuth();

  if (!['private', 'team'].includes(visibility)) {
    outputError('Invalid visibility. Must be: private or team');
    process.exit(1);
  }

  const spinner = createSpinner('Updating visibility...').start();

  try {
    const fullId = await resolveWorkspaceId(id);
    if (!fullId) {
      spinner.fail('Workspace not found');
      outputError(`No workspace found matching "${id}"`);
      process.exit(1);
    }

    await workspaces.setVisibility(fullId, visibility);
    spinner.succeed(`Workspace visibility set to ${brand.cyan(visibility)}`);
  } catch (error) {
    spinner.fail('Failed to update visibility');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { access, addAccess, removeAccess, setVisibility };
