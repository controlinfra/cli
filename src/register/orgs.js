const orgCommands = require('../commands/orgs');
const orgMemberCommands = require('../commands/orgs-members');

function registerOrgs(program) {
  const orgs = program.command('orgs').description('Manage organizations / teams');

  orgs
    .command('list')
    .alias('ls')
    .description('List your organizations')
    .action(orgCommands.list);

  orgs
    .command('create <name>')
    .description('Create a new organization')
    .action(orgCommands.create);

  orgs
    .command('info <id>')
    .description('Show organization details')
    .action(orgCommands.info);

  orgs
    .command('update <id>')
    .description('Update organization')
    .option('--name <name>', 'New organization name')
    .action(orgCommands.update);

  orgs
    .command('delete <id>')
    .description('Delete an organization')
    .option('--force', 'Skip confirmation')
    .action(orgCommands.deleteOrg);

  orgs
    .command('members <orgId>')
    .description('List organization members')
    .action(orgMemberCommands.members);

  orgs
    .command('invite <orgId> <email>')
    .description('Invite a user to the organization')
    .option('--role <role>', 'Role: member, admin', 'member')
    .action(orgMemberCommands.invite);

  orgs
    .command('invite-link <orgId>')
    .description('Generate an invitation link')
    .action(orgMemberCommands.inviteLink);

  orgs
    .command('invitations <orgId>')
    .description('List pending invitations')
    .action(orgMemberCommands.invitations);

  orgs
    .command('revoke <orgId> <inviteId>')
    .description('Revoke a pending invitation')
    .action(orgMemberCommands.revoke);

  orgs
    .command('remove-member <orgId> <userId>')
    .description('Remove a member from the organization')
    .action(orgMemberCommands.removeMember);

  orgs
    .command('update-role <orgId> <userId> <role>')
    .description("Update a member's role")
    .action(orgMemberCommands.updateRole);

  orgs
    .command('leave <orgId>')
    .description('Leave an organization')
    .action(orgMemberCommands.leave);

  orgs
    .command('transfer <orgId> <userId>')
    .description('Transfer organization ownership')
    .action(orgMemberCommands.transfer);

  orgs
    .command('accept <token>')
    .description('Accept an organization invitation')
    .action(orgMemberCommands.accept);
}

module.exports = registerOrgs;
