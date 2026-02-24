const chalk = require('chalk');
const { orgs } = require('../api');
const { requireAuth } = require('../config');
const { resolveOrgId } = require('./orgs');
const {
  createSpinner,
  outputTable,
  outputError,
  brand,
  formatRelativeTime,
} = require('../output');

/**
 * List organization members
 */
async function members(orgId, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching members...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    const data = await orgs.getMembers(fullId);
    const memberList = data.members || data || [];
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(memberList, null, 2));
      return;
    }

    if (memberList.length === 0) {
      console.log(chalk.yellow('\nNo members found\n'));
      return;
    }

    console.log();
    outputTable(
      ['User', 'Email', 'Role', 'Joined'],
      memberList.map((m) => [
        brand.cyan(m.user?.displayName || m.displayName || '-'),
        m.user?.email || m.email || '-',
        m.role || 'member',
        formatRelativeTime(m.joinedAt || m.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch members');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Invite a user to the organization
 */
async function invite(orgId, email, options, command) {
  requireAuth();

  const spinner = createSpinner(`Inviting ${email}...`).start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    const data = await orgs.invite(fullId, email, options.role || 'member');
    spinner.succeed(`Invitation sent to ${brand.cyan(email)}`);

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    spinner.fail('Failed to send invitation');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Generate an invitation link
 */
async function inviteLink(orgId, options, command) {
  requireAuth();

  const spinner = createSpinner('Generating invite link...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    const data = await orgs.getInviteLink(fullId);
    spinner.succeed('Invite link generated');

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log();
    const inviteUrl = data.link || data.url || (data.token ? `https://console.controlinfra.com/invite?token=${data.token}` : undefined);
    console.log(brand.purpleBold('Invite Link:'), brand.cyan(inviteUrl || '-'));
    console.log(chalk.dim('\nShare this link with people you want to invite.\n'));
  } catch (error) {
    spinner.fail('Failed to generate invite link');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * List pending invitations
 */
async function invitations(orgId, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching invitations...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    const data = await orgs.getInvitations(fullId);
    const inviteList = data.invitations || data || [];
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(inviteList, null, 2));
      return;
    }

    if (inviteList.length === 0) {
      console.log(chalk.yellow('\nNo pending invitations\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Email', 'Role', 'Status', 'Sent'],
      inviteList.map((inv) => [
        chalk.dim((inv.id || inv._id)?.slice(-8) || '-'),
        brand.cyan(inv.email || '-'),
        inv.role || 'member',
        inv.status || 'pending',
        formatRelativeTime(inv.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch invitations');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Revoke a pending invitation
 */
async function revoke(orgId, inviteId, _options) {
  requireAuth();

  const spinner = createSpinner('Revoking invitation...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    await orgs.revokeInvitation(fullId, inviteId);
    spinner.succeed('Invitation revoked');
  } catch (error) {
    spinner.fail('Failed to revoke invitation');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Remove a member from the organization
 */
async function removeMember(orgId, userId, _options) {
  requireAuth();

  const spinner = createSpinner('Removing member...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    await orgs.removeMember(fullId, userId);
    spinner.succeed('Member removed');
  } catch (error) {
    spinner.fail('Failed to remove member');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Update a member's role
 */
async function updateRole(orgId, userId, role, _options) {
  requireAuth();

  const spinner = createSpinner('Updating role...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    await orgs.updateRole(fullId, userId, role);
    spinner.succeed(`Role updated to ${brand.cyan(role)}`);
  } catch (error) {
    spinner.fail('Failed to update role');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Leave an organization
 */
async function leave(orgId, _options) {
  requireAuth();

  const spinner = createSpinner('Leaving organization...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    await orgs.leave(fullId);
    spinner.succeed('Left organization');
  } catch (error) {
    spinner.fail('Failed to leave organization');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Transfer organization ownership
 */
async function transfer(orgId, userId, _options) {
  requireAuth();

  const spinner = createSpinner('Transferring ownership...').start();

  try {
    const fullId = await resolveOrgId(orgId);
    if (!fullId) { spinner.fail('Organization not found'); outputError(`No organization found matching "${orgId}"`); process.exit(1); }
    await orgs.transfer(fullId, userId);
    spinner.succeed('Ownership transferred');
  } catch (error) {
    spinner.fail('Failed to transfer ownership');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Accept an organization invitation
 */
async function accept(token, _options) {
  requireAuth();

  const spinner = createSpinner('Accepting invitation...').start();

  try {
    const data = await orgs.acceptInvite(token);
    const org = data.organization || data.org || data;
    spinner.succeed(`Joined organization "${brand.cyan(org.name || 'unknown')}"`);
  } catch (error) {
    spinner.fail('Failed to accept invitation');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = {
  members,
  invite,
  inviteLink,
  invitations,
  revoke,
  removeMember,
  updateRole,
  leave,
  transfer,
  accept,
};
