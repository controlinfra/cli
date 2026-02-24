const { Command } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const { isAuthenticated } = require('./config');
const api = require('./api');
const { brand } = require('./output');
const { gradientBanner } = require('./banner');

// Import command modules
const authCommands = require('./commands/auth');
const repoCommands = require('./commands/repos');
const scanCommands = require('./commands/scan');
const driftCommands = require('./commands/drifts');
const runnerCommands = require('./commands/runners');
const slackCommands = require('./commands/slack');
const awsCommands = require('./commands/aws');
const azureCommands = require('./commands/azure');
const gcpCommands = require('./commands/gcp');
const aiCommands = require('./commands/ai');
const workspaceCommands = require('./commands/workspaces');

const program = new Command();

// CLI metadata
program
  .name('controlinfra')
  .description('Infrastructure Drift Detection CLI')
  .version(version, '-v, --version', 'Output the current version')
  .option('--json', 'Output results as JSON')
  .option('--quiet', 'Suppress non-essential output')
  .option('--no-color', 'Disable colored output');

// Global error handler
program.configureOutput({
  outputError: (str, write) => {
    write(chalk.red(str));
  },
});

// ─────────────────────────────────────────────────────────
// Auth Commands
// ─────────────────────────────────────────────────────────
program
  .command('login')
  .description('Authenticate with Controlinfra')
  .option('--token <token>', 'Use API token instead of browser auth')
  .action(authCommands.login);

program
  .command('logout')
  .description('Log out and clear stored credentials')
  .action(authCommands.logout);

program
  .command('whoami')
  .description('Display current authenticated user')
  .action(authCommands.whoami);

// ─────────────────────────────────────────────────────────
// Repository Commands
// ─────────────────────────────────────────────────────────
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
  // AWS options
  .option('--auth-method <method>', 'AWS auth method: credentials, instance_profile, assume_role', 'credentials')
  .option('--region <region>', 'AWS region', 'us-east-1')
  .option('--access-key <key>', 'AWS Access Key ID (for credentials auth)')
  .option('--secret-key <key>', 'AWS Secret Access Key (for credentials auth)')
  .option('--role-arn <arn>', 'Role ARN (for assume_role auth)')
  .option('--external-id <id>', 'External ID (for assume_role auth)')
  // Azure options
  .option('--azure-auth-method <method>', 'Azure auth: service_principal, managed_identity', 'service_principal')
  .option('--subscription-id <id>', 'Azure Subscription ID')
  .option('--tenant-id <id>', 'Azure Tenant ID')
  .option('--client-id <id>', 'Azure Client ID (Application ID)')
  .option('--client-secret <secret>', 'Azure Client Secret')
  .option('--azure-environment <env>', 'Azure environment: public, usgovernment, german, china', 'public')
  // GCP options
  .option('--gcp-auth-method <method>', 'GCP auth: service_account, workload_identity', 'service_account')
  .option('--gcp-project-id <id>', 'GCP Project ID')
  .option('--gcp-client-email <email>', 'GCP Service Account email')
  .option('--gcp-private-key <key>', 'GCP Service Account private key (PEM format)')
  .option('--gcp-json-file <path>', 'Path to GCP Service Account JSON key file')
  // Runner options
  .option('--runner-type <type>', 'Runner type: cloud, self-hosted', 'cloud')
  .option('--runner-id <id>', 'Runner ID (for self-hosted)')
  .action(repoCommands.add);

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

// ─────────────────────────────────────────────────────────
// Scan Commands
// ─────────────────────────────────────────────────────────
const scan = program.command('scan').description('Manage drift scans');

scan
  .command('run <repository>')
  .description('Trigger a drift scan')
  .option('-d, --directory <path>', 'Terraform directory to scan (when repo has multiple workspaces)')
  .option('--runner <id>', 'Use specific runner')
  .option('--wait', 'Wait for scan to complete')
  .option('--timeout <seconds>', 'Timeout for --wait', '600')
  .option('--fail-on-drift', 'Exit with code 1 if any drift is detected')
  .option('--fail-on-severity <level>', 'Exit with code 1 if drift severity >= level (critical|high|medium|low)')
  .option('--fail-on-new-only', 'Only fail on new drifts, ignore recurring')
  .action(scanCommands.run);

scan
  .command('status <scan-id>')
  .description('Check scan status')
  .action(scanCommands.status);

scan
  .command('wait <scan-id>')
  .description('Wait for scan to complete')
  .option('--timeout <seconds>', 'Maximum wait time', '600')
  .option('--fail-on-drift', 'Exit with code 1 if any drift is detected')
  .option('--fail-on-severity <level>', 'Exit with code 1 if drift severity >= level (critical|high|medium|low)')
  .option('--fail-on-new-only', 'Only fail on new drifts, ignore recurring')
  .action(scanCommands.wait);

scan
  .command('list')
  .alias('ls')
  .description('List recent scans')
  .option('--repo <id>', 'Filter by repository')
  .option('--status <status>', 'Filter by status (running, completed, failed)')
  .option('--limit <n>', 'Number of scans to show', '20')
  .action(scanCommands.list);

scan
  .command('cancel <scan-id>')
  .description('Cancel a running scan')
  .action(scanCommands.cancel);

scan
  .command('logs <scan-id>')
  .description('Show scan logs/output')
  .action(scanCommands.logs);

// ─────────────────────────────────────────────────────────
// Drift Commands
// ─────────────────────────────────────────────────────────
const drifts = program.command('drifts').description('Manage detected drifts');

drifts
  .command('list')
  .alias('ls')
  .description('List drifts')
  .option('--scan <id>', 'Filter by scan')
  .option('--repo <id>', 'Filter by repository')
  .option('--severity <level>', 'Filter by severity (critical, high, medium, low)')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Number of drifts to show', '50')
  .action(driftCommands.list);

drifts
  .command('show <drift-id>')
  .description('Show drift details')
  .action(driftCommands.show);

drifts
  .command('fix <drift-id>')
  .description('Generate AI fix for drift')
  .option('--provider <name>', 'AI provider (anthropic, openai)')
  .action(driftCommands.fix);

drifts
  .command('pr <drift-id>')
  .description('Create pull request with fix')
  .option('--auto-merge', 'Enable auto-merge on PR')
  .action(driftCommands.createPR);

drifts
  .command('ignore <drift-id>')
  .description('Mark drift as ignored')
  .action(driftCommands.ignore);

drifts
  .command('resolve <drift-id>')
  .description('Mark drift as resolved')
  .action(driftCommands.resolve);

drifts
  .command('stats')
  .description('Show drift statistics')
  .option('--repo <id>', 'Filter by repository')
  .action(driftCommands.stats);

// ─────────────────────────────────────────────────────────
// Runner Commands (Self-Hosted)
// ─────────────────────────────────────────────────────────
const runners = program.command('runners').description('Manage self-hosted runners');

runners
  .command('list')
  .alias('ls')
  .description('List all runners')
  .action(runnerCommands.list);

runners
  .command('add [name]')
  .description('Create a new runner')
  .option('--labels <labels>', 'Comma-separated labels')
  .action(runnerCommands.add);

runners
  .command('setup <runner-id>')
  .description('Get runner installation script')
  .option('--os <os>', 'Target OS (linux, macos, windows)', 'linux')
  .action(runnerCommands.setup);

runners
  .command('status <runner-id>')
  .description('Check runner status')
  .action(runnerCommands.status);

runners
  .command('remove <runner-id>')
  .alias('rm')
  .description('Delete a runner')
  .option('--force', 'Skip confirmation')
  .action(runnerCommands.remove);

runners
  .command('token <runner-id>')
  .description('Regenerate runner authentication token')
  .action(runnerCommands.regenerateToken);

// ─────────────────────────────────────────────────────────
// Workspace Commands
// ─────────────────────────────────────────────────────────
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
  // AWS options
  .option('--auth-method <method>', 'AWS auth method: credentials, instance_profile, assume_role', 'credentials')
  .option('--region <region>', 'AWS region', 'us-east-1')
  // Azure options
  .option('--azure-auth-method <method>', 'Azure auth: service_principal, managed_identity', 'service_principal')
  .option('--subscription-id <id>', 'Azure Subscription ID')
  .option('--azure-environment <env>', 'Azure environment: public, usgovernment, german, china', 'public')
  // GCP options
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
  .command('remove <id>')
  .alias('rm')
  .description('Delete a workspace')
  .option('--force', 'Skip confirmation')
  .action(workspaceCommands.remove);

ws
  .command('default <id>')
  .description('Set workspace as default')
  .action(workspaceCommands.setDefault);

// ─────────────────────────────────────────────────────────
// Slack Integration
// ─────────────────────────────────────────────────────────
const slack = program.command('slack').description('Slack integration');

slack
  .command('setup')
  .description('Configure Slack webhook')
  .option('--webhook <url>', 'Slack webhook URL')
  .action(slackCommands.setup);

slack
  .command('test')
  .description('Send test message to Slack')
  .option('--message <text>', 'Custom test message')
  .action(slackCommands.test);

slack
  .command('status')
  .description('Show Slack integration status')
  .action(slackCommands.status);

slack
  .command('remove')
  .description('Remove Slack integration')
  .action(slackCommands.remove);

// ─────────────────────────────────────────────────────────
// AWS Credentials
// ─────────────────────────────────────────────────────────
const aws = program.command('aws').description('AWS credentials management');

aws
  .command('setup')
  .description('Configure AWS credentials')
  .option('--access-key <key>', 'AWS Access Key ID')
  .option('--secret-key <key>', 'AWS Secret Access Key')
  .option('--region <region>', 'AWS Region', 'us-east-1')
  .action(awsCommands.setup);

aws
  .command('status')
  .description('Show AWS credentials status')
  .action(awsCommands.status);

aws
  .command('test')
  .description('Validate AWS credentials')
  .action(awsCommands.test);

aws
  .command('remove')
  .description('Remove AWS credentials')
  .action(awsCommands.remove);

// ─────────────────────────────────────────────────────────
// Azure Credentials
// ─────────────────────────────────────────────────────────
const azure = program.command('azure').description('Azure credentials management');

azure
  .command('setup')
  .description('Configure Azure credentials')
  .option('--subscription-id <id>', 'Azure Subscription ID')
  .option('--tenant-id <id>', 'Azure Tenant ID')
  .option('--client-id <id>', 'Azure Client ID (Application ID)')
  .option('--client-secret <secret>', 'Azure Client Secret')
  .option('--environment <env>', 'Azure Environment (public, usgovernment, german, china)', 'public')
  .action(azureCommands.setup);

azure
  .command('status')
  .description('Show Azure credentials status')
  .action(azureCommands.status);

azure
  .command('test')
  .description('Check if Azure credentials are configured')
  .action(azureCommands.test);

azure
  .command('remove')
  .description('Remove Azure credentials')
  .action(azureCommands.remove);

// ─────────────────────────────────────────────────────────
// GCP Credentials
// ─────────────────────────────────────────────────────────
const gcp = program.command('gcp').description('GCP credentials management');

gcp
  .command('setup')
  .description('Configure GCP credentials')
  .option('--json-file <path>', 'Path to service account JSON key file')
  .option('--project-id <id>', 'GCP Project ID')
  .option('--client-email <email>', 'Service Account email')
  .option('--private-key <key>', 'Private key (PEM format)')
  .option('--workload-identity', 'Use Workload Identity (GKE/Cloud Run)')
  .action(gcpCommands.setup);

gcp
  .command('status')
  .description('Show GCP credentials status')
  .action(gcpCommands.status);

gcp
  .command('test')
  .description('Check if GCP credentials are configured')
  .action(gcpCommands.test);

gcp
  .command('remove')
  .description('Remove GCP credentials')
  .action(gcpCommands.remove);

// ─────────────────────────────────────────────────────────
// AI Provider (BYOK)
// ─────────────────────────────────────────────────────────
const ai = program.command('ai').description('AI provider configuration');

ai
  .command('status')
  .description('Show current AI provider')
  .action(aiCommands.status);

ai
  .command('use <provider>')
  .description('Set AI provider (anthropic, openai)')
  .option('--key <api-key>', 'API key for the provider')
  .action(aiCommands.use);

ai
  .command('verify')
  .description('Verify AI provider API key')
  .action(aiCommands.verify);

ai
  .command('remove')
  .description('Remove custom AI key (use default)')
  .action(aiCommands.remove);

// ─────────────────────────────────────────────────────────
// Default action (no command)
// ─────────────────────────────────────────────────────────
program.action(async () => {
  gradientBanner();
  console.log();
  console.log(brand.light('  Infrastructure Drift Detection CLI'));
  console.log(brand.cyan(`  Version ${version}\n`));

  // Check if user is authenticated and show personalized dashboard
  if (isAuthenticated()) {
    try {
      // Fetch user data and stats in parallel
      const [userData, repoData, scanData, driftData] = await Promise.all([
        api.users.me().catch(() => null),
        api.repos.list().catch(() => ({ configs: [] })),
        api.scans.list({ limit: 100 }).catch(() => ({ scans: [] })),
        api.drifts.list({ status: 'detected', limit: 100 }).catch(() => ({ drifts: [] })),
      ]);

      const user = userData?.user || userData;
      const repoList = repoData?.configs || repoData?.repositories || [];
      const scanList = scanData?.scans || [];
      const driftList = driftData?.drifts || [];

      // Greeting
      const greeting = getGreeting();
      const userName = user?.name || user?.email?.split('@')[0] || 'there';
      console.log(`  ${brand.purple(greeting)}, ${chalk.bold(userName)}!\n`);

      // Stats boxes
      const stats = [
        { label: 'Repositories', value: repoList.length, color: brand.cyan },
        { label: 'Active Drifts', value: driftList.length, color: driftList.length > 0 ? chalk.yellow : chalk.green },
        { label: 'Total Scans', value: scanList.length, color: brand.purple },
      ];

      // Add cloud scans remaining if available
      if (user?.usage?.cloudScansRemaining !== undefined) {
        stats.push({
          label: 'Cloud Scans',
          value: `${user.usage.cloudScansRemaining} remaining`,
          color: brand.light,
        });
      }

      // Display stats in a row
      console.log('  ' + brand.purple('─'.repeat(56)));
      const statLine = stats.map(s => {
        const val = typeof s.value === 'number' ? s.color.bold(s.value) : s.color(s.value);
        return `${chalk.dim(s.label)}: ${val}`;
      }).join('   ');
      console.log(`  ${statLine}`);
      console.log('  ' + brand.cyan('─'.repeat(56)));
      console.log();

      // Quick actions based on state
      console.log(`  ${brand.purpleBold('Quick Actions:')}`);
      if (repoList.length === 0) {
        console.log(`    ${brand.cyan('controlinfra repos add <owner/repo>')}  ${chalk.dim('Add your first repository')}`);
      } else {
        console.log(`    ${brand.cyan('controlinfra scan run <repo>')}         ${chalk.dim('Run a drift scan')}`);
      }
      if (driftList.length > 0) {
        console.log(`    ${brand.cyan('controlinfra drifts list')}             ${chalk.dim('View active drifts')}`);
      }
      console.log(`    ${brand.cyan('controlinfra --help')}                  ${chalk.dim('View all commands')}`);
    } catch (_error) {
      // Fallback to basic view if API calls fail
      showBasicHelp();
    }
  } else {
    // Not authenticated - show login prompt
    console.log(`  ${chalk.yellow('Not logged in')}\n`);
    console.log(`  ${brand.purpleBold('Get Started:')}`);
    console.log(`    ${brand.cyan('controlinfra login')}        ${chalk.dim('Authenticate with your account')}`);
    console.log();
    console.log(`  ${chalk.dim('Don\'t have an account?')} ${brand.cyan('https://controlinfra.com')}`);
  }

  console.log();
  console.log(`  ${chalk.dim('Documentation:')} ${brand.cyan('https://docs.controlinfra.com')}`);
  console.log();
});

// Helper: Get time-based greeting
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Helper: Show basic help without auth
function showBasicHelp() {
  console.log(`  ${brand.purpleBold('Quick Start:')}`);
  console.log(`    ${brand.cyan('controlinfra login')}        ${chalk.dim('Authenticate with your account')}`);
  console.log(`    ${brand.cyan('controlinfra repos add')}    ${chalk.dim('Add a repository to monitor')}`);
  console.log(`    ${brand.cyan('controlinfra scan run')}     ${chalk.dim('Trigger a drift scan')}`);
  console.log(`    ${brand.cyan('controlinfra --help')}       ${chalk.dim('View all commands')}`);
}

module.exports = { program };
