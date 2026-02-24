const repoCommands = require('../commands/repos');
const repoAddCommand = require('../commands/repos-add');
const repoUpdateCommand = require('../commands/repos-update');

function registerRepos(program) {
  const repos = program.command('repos').description('Manage repositories');

  repos
    .command('list')
    .alias('ls')
    .description('List configured repositories')
    .option('--workspace <id>', 'Filter by workspace')
    .action(repoCommands.list);

  repos
    .command('add <repository>')
    .description('Add a repository (e.g., owner/repo)')
    .option('--terraform-dir <path>', 'Terraform directory path', '.')
    .option('-b, --branch <branch>', 'Git branch to scan (defaults to repo default branch)')
    .option('--workspace <id>', 'Assign to workspace')
    .option('--cloud-provider <provider>', 'Cloud provider: aws, azure, gcp', 'aws')
    .option('--auth-method <method>', 'AWS auth method: credentials, instance_profile, assume_role', 'credentials')
    .option('--region <region>', 'AWS region', 'us-east-1')
    .option('--access-key <key>', 'AWS Access Key ID (for credentials auth)')
    .option('--secret-key <key>', 'AWS Secret Access Key (for credentials auth)')
    .option('--role-arn <arn>', 'Role ARN (for assume_role auth)')
    .option('--external-id <id>', 'External ID (for assume_role auth)')
    .option('--azure-auth-method <method>', 'Azure auth: service_principal, managed_identity', 'service_principal')
    .option('--subscription-id <id>', 'Azure Subscription ID')
    .option('--tenant-id <id>', 'Azure Tenant ID')
    .option('--client-id <id>', 'Azure Client ID (Application ID)')
    .option('--client-secret <secret>', 'Azure Client Secret')
    .option('--azure-environment <env>', 'Azure environment: public, usgovernment, german, china', 'public')
    .option('--gcp-auth-method <method>', 'GCP auth: service_account, workload_identity', 'service_account')
    .option('--gcp-project-id <id>', 'GCP Project ID')
    .option('--gcp-client-email <email>', 'GCP Service Account email')
    .option('--gcp-private-key <key>', 'GCP Service Account private key (PEM format)')
    .option('--gcp-json-file <path>', 'Path to GCP Service Account JSON key file')
    .option('--runner-type <type>', 'Runner type: cloud, self-hosted', 'cloud')
    .option('--runner-id <id>', 'Runner ID (for self-hosted)')
    .option('--schedule <schedule>', 'Scan schedule: manual, daily, weekly', 'manual')
    .option('--schedule-hour <hour>', 'Hour for scheduled scan (0-23)', '0')
    .option('--schedule-day <day>', 'Day for weekly scan (0-6, 0=Sunday)', '0')
    .option('--auto-create-pr', 'Auto-create PRs for detected drifts')
    .option('--auto-pr-threshold <level>', 'Min severity for auto-PR: critical, high, medium, low')
    .option('--tf-version <version>', 'Terraform version to use')
    .option('--tf-workspace <workspace>', 'Terraform workspace name')
    .option('--tf-var-files <files>', 'Comma-separated list of .tfvars files')
    .option('--tf-variables <vars>', 'Comma-separated KEY=VALUE Terraform variables')
    .action(repoAddCommand.add);

  repos
    .command('update <id>')
    .description('Update repository configuration')
    .option('--terraform-dir <path>', 'Terraform directory path')
    .option('-b, --branch <branch>', 'Git branch to scan')
    .option('--cloud-provider <provider>', 'Cloud provider: aws, azure, gcp')
    .option('--schedule <schedule>', 'Scan schedule: manual, daily, weekly')
    .option('--schedule-hour <hour>', 'Hour for scheduled scan (0-23)')
    .option('--schedule-day <day>', 'Day for weekly scan (0-6, 0=Sunday)')
    .option('--auto-create-pr <bool>', 'Auto-create PRs for detected drifts (true/false)')
    .option('--auto-pr-threshold <level>', 'Min severity for auto-PR: critical, high, medium, low')
    .option('--tf-version <version>', 'Terraform version to use')
    .option('--tf-workspace <workspace>', 'Terraform workspace name')
    .option('--tf-var-files <files>', 'Comma-separated list of .tfvars files')
    .option('--tf-variables <vars>', 'Comma-separated KEY=VALUE Terraform variables')
    .option('--auth-method <method>', 'AWS auth method')
    .option('--region <region>', 'AWS region')
    .option('--access-key <key>', 'AWS Access Key ID')
    .option('--secret-key <key>', 'AWS Secret Access Key')
    .option('--role-arn <arn>', 'Role ARN')
    .option('--external-id <id>', 'External ID')
    .option('--azure-auth-method <method>', 'Azure auth method')
    .option('--subscription-id <id>', 'Azure Subscription ID')
    .option('--tenant-id <id>', 'Azure Tenant ID')
    .option('--client-id <id>', 'Azure Client ID')
    .option('--client-secret <secret>', 'Azure Client Secret')
    .option('--gcp-auth-method <method>', 'GCP auth method')
    .option('--gcp-project-id <id>', 'GCP Project ID')
    .option('--gcp-client-email <email>', 'GCP Service Account email')
    .option('--gcp-private-key <key>', 'GCP private key')
    .option('--gcp-json-file <path>', 'GCP JSON key file')
    .option('--runner-type <type>', 'Runner type: cloud, self-hosted')
    .option('--runner-id <id>', 'Runner ID (for self-hosted)')
    .action(repoUpdateCommand.update);

  repos
    .command('remove <id>')
    .alias('rm')
    .description('Remove a repository configuration')
    .option('--force', 'Skip confirmation')
    .action(repoCommands.remove);

  repos
    .command('info <id>')
    .description('Show repository details')
    .action(repoCommands.info);

  repos
    .command('stats <id>')
    .description('Show repository statistics')
    .action(repoCommands.stats);
}

module.exports = registerRepos;
