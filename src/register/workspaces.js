const workspaceCommands = require('../commands/workspaces');
const workspaceAccessCommands = require('../commands/workspaces-access');

function registerWorkspaces(program) {
  const ws = program.command('workspaces').description('Manage workspaces');

  ws
    .command('list')
    .alias('ls')
    .description('List all workspaces')
    .action(workspaceCommands.list);

  ws
    .command('add <name>')
    .description('Create a new workspace')
    .option('--cloud-provider <provider>', 'Cloud provider: aws, azure, gcp', 'aws')
    .option('--auth-method <method>', 'AWS auth method: credentials, instance_profile, assume_role', 'credentials')
    .option('--region <region>', 'AWS region', 'us-east-1')
    .option('--azure-auth-method <method>', 'Azure auth: service_principal, managed_identity', 'service_principal')
    .option('--subscription-id <id>', 'Azure Subscription ID')
    .option('--azure-environment <env>', 'Azure environment: public, usgovernment, german, china', 'public')
    .option('--gcp-auth-method <method>', 'GCP auth: service_account, workload_identity', 'service_account')
    .option('--gcp-project-id <id>', 'GCP Project ID')
    .option('--gcp-client-email <email>', 'GCP Service Account email')
    .option('--gcp-private-key <key>', 'GCP Service Account private key (PEM format)')
    .option('--gcp-json-file <path>', 'Path to GCP Service Account JSON key file')
    .action(workspaceCommands.add);

  ws
    .command('info <id>')
    .description('Show workspace details')
    .action(workspaceCommands.info);

  ws
    .command('update <id>')
    .description('Update workspace configuration')
    .option('--name <name>', 'New workspace name')
    .option('--cloud-provider <provider>', 'Cloud provider: aws, azure, gcp')
    .action(workspaceCommands.update);

  ws
    .command('remove <id>')
    .alias('rm')
    .description('Delete a workspace')
    .option('--force', 'Skip confirmation')
    .action(workspaceCommands.remove);

  ws
    .command('default <id>')
    .description('Set workspace as default')
    .action(workspaceCommands.setDefault);

  ws
    .command('access <id>')
    .description('List workspace access')
    .action(workspaceAccessCommands.access);

  ws
    .command('access-add <id> <userId>')
    .description('Grant user access to workspace')
    .option('--role <role>', 'Role: viewer, editor, admin', 'viewer')
    .action(workspaceAccessCommands.addAccess);

  ws
    .command('access-remove <id> <userId>')
    .description('Remove user access from workspace')
    .action(workspaceAccessCommands.removeAccess);

  ws
    .command('visibility <id> <visibility>')
    .description('Set workspace visibility (private, team)')
    .action(workspaceAccessCommands.setVisibility);
}

module.exports = registerWorkspaces;
