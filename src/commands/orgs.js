const chalk = require('chalk');
const inquirer = require('inquirer');
const { orgs } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  brand,
  formatRelativeTime,
} = require('../output');

/**
 * List organizations
 */
async function list(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching organizations...').start();

  try {
    const data = await orgs.list();
    const orgList = data.organizations || data.orgs || data || [];
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(orgList, null, 2));
      return;
    }

    if (orgList.length === 0) {
      console.log(chalk.yellow('\nNo organizations found\n'));
      console.log(chalk.dim('Create one with'), brand.cyan('controlinfra orgs create <name>\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Name', 'Role', 'Members', 'Created'],
      orgList.map((org) => [
        chalk.dim((org.id || org._id)?.slice(-8) || '-'),
        brand.cyan(org.name || '-'),
        org.role || org.userRole || '-',
        org.memberCount || '-',
        formatRelativeTime(org.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch organizations');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Create a new organization
 */
async function create(name, options, command) {
  requireAuth();

  const spinner = createSpinner(`Creating organization "${name}"...`).start();

  try {
    const data = await orgs.create({ name });
    const org = data.organization || data.org || data;
    spinner.succeed(`Organization "${brand.cyan(name)}" created`);

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(org, null, 2));
      return;
    }

    console.log(chalk.dim(`\nOrganization ID: ${org.id || org._id}`));
    console.log(chalk.dim('Invite members with:'), brand.cyan(`controlinfra orgs invite ${org.id || org._id} <email>\n`));
  } catch (error) {
    spinner.fail('Failed to create organization');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show organization details
 */
async function info(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching organization info...').start();

  try {
    const fullId = await resolveOrgId(id);
    if (!fullId) {
      spinner.fail('Organization not found');
      outputError(`No organization found matching "${id}"`);
      process.exit(1);
    }
    const data = await orgs.get(fullId);
    const org = data.organization || data.org || data;
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(org, null, 2));
      return;
    }

    console.log();
    outputBox('Organization Details', [
      `ID:          ${chalk.dim(org.id || org._id)}`,
      `Name:        ${brand.cyan(org.name || '-')}`,
      `Owner:       ${org.owner?.email || org.ownerEmail || '-'}`,
      `Members:     ${org.memberCount || 0}`,
      `Created:     ${formatRelativeTime(org.createdAt)}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch organization info');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Update organization
 */
async function update(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Updating organization...').start();

  try {
    const fullId = await resolveOrgId(id);
    if (!fullId) {
      spinner.fail('Organization not found');
      outputError(`No organization found matching "${id}"`);
      process.exit(1);
    }

    const updates = {};
    if (options.name) updates.name = options.name;

    if (Object.keys(updates).length === 0) {
      spinner.warn('No updates specified');
      console.log(chalk.dim('\nUse --name to update the organization name\n'));
      return;
    }

    const data = await orgs.update(fullId, updates);
    const org = data.organization || data.org || data;
    spinner.succeed('Organization updated');

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(org, null, 2));
      return;
    }
    console.log(chalk.dim(`\nName: ${org.name}\n`));
  } catch (error) {
    spinner.fail('Failed to update organization');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Delete an organization
 */
async function deleteOrg(id, options) {
  requireAuth();

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete this organization? This cannot be undone.',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.dim('Cancelled\n'));
      return;
    }
  }

  const spinner = createSpinner('Deleting organization...').start();

  try {
    const fullId = await resolveOrgId(id);
    if (!fullId) {
      spinner.fail('Organization not found');
      outputError(`No organization found matching "${id}"`);
      process.exit(1);
    }
    await orgs.delete(fullId);
    spinner.succeed('Organization deleted');
  } catch (error) {
    spinner.fail('Failed to delete organization');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Resolve a partial ID or name to a full org ID
 */
async function resolveOrgId(partialId) {
  const data = await orgs.list();
  const orgList = data.organizations || data.orgs || data || [];

  const exactMatch = orgList.find((o) => (o.id || o._id) === partialId);
  if (exactMatch) return exactMatch.id || exactMatch._id;

  const partialMatch = orgList.find((o) => (o.id || o._id)?.endsWith(partialId));
  if (partialMatch) return partialMatch.id || partialMatch._id;

  const nameMatch = orgList.find(
    (o) => (o.name || '').toLowerCase().includes(partialId.toLowerCase()),
  );
  if (nameMatch) return nameMatch.id || nameMatch._id;

  return null;
}

module.exports = { list, create, info, update, deleteOrg, resolveOrgId };
