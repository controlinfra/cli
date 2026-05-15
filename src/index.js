const { Command } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');
const { isAuthenticated } = require('./config');
const api = require('./api');
const { brand } = require('./output');
const { gradientBanner } = require('./banner');

// Import registration modules
const registerAuth = require('./register/auth');
const registerRepos = require('./register/repos');
const registerScan = require('./register/scan');
const registerDrifts = require('./register/drifts');
const registerRunners = require('./register/runners');
const registerWorkspaces = require('./register/workspaces');
const registerIntegrations = require('./register/integrations');
const registerOrgs = require('./register/orgs');
const registerProjects = require('./register/projects');
const registerConfig = require('./register/config');

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

// --quiet honors itself: suppress non-essential output by swallowing
// console.log / console.info early. Errors (console.error, spinner.fail
// → stderr) still print. --json overrides --quiet so machine-readable
// output isn't silently lost. Detection runs at preAction time so
// every sub-command picks up the global flag without needing to read
// it individually (the helper existed in config.js but no command was
// wired to it, so the flag was effectively ignored).
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.quiet && !opts.json) {
    console.log = () => {};
    console.info = () => {};
    // createSpinner in output.js checks this env var so ora spinners
    // (which write to stderr and would survive console.log overrides)
    // are silenced too. Env var is the simplest cross-module signal.
    process.env.__CLI_QUIET = '1';
  }
});

// Register all command groups
registerAuth(program);
registerRepos(program);
registerScan(program);
registerDrifts(program);
registerRunners(program);
registerWorkspaces(program);
registerIntegrations(program);
registerOrgs(program);
registerProjects(program);
registerConfig(program);

// Default action (no command)
program.action(async () => {
  gradientBanner();
  console.log();
  console.log(brand.light('  Infrastructure Drift Detection CLI'));
  console.log(brand.cyan(`  Version ${version}\n`));

  if (isAuthenticated()) {
    try {
      const [userData, repoData, scanData, driftData] = await Promise.all([
        api.auth.getMe().catch(() => null),
        api.repos.list().catch(() => ({ configs: [] })),
        api.scans.list({ limit: 100 }).catch(() => ({ scans: [] })),
        api.drifts.list({ status: 'detected', limit: 100 }).catch(() => ({ drifts: [] })),
      ]);

      const user = userData?.user || userData;
      const repoList = repoData?.configs || repoData?.repositories || [];
      const scanList = scanData?.scans || [];
      const driftList = driftData?.drifts || [];

      const greeting = getGreeting();
      const userName = user?.name || user?.email?.split('@')[0] || 'there';
      console.log(`  ${brand.purple(greeting)}, ${chalk.bold(userName)}!\n`);

      const stats = [
        { label: 'Repositories', value: repoList.length, color: brand.cyan },
        { label: 'Active Drifts', value: driftList.length, color: driftList.length > 0 ? chalk.yellow : chalk.green },
        { label: 'Total Scans', value: scanList.length, color: brand.purple },
      ];

      if (user?.usage?.cloudScansRemaining !== undefined) {
        stats.push({
          label: 'Cloud Scans',
          value: `${user.usage.cloudScansRemaining} remaining`,
          color: brand.light,
        });
      }

      console.log('  ' + brand.purple('─'.repeat(56)));
      const statLine = stats.map(s => {
        const val = typeof s.value === 'number' ? s.color.bold(s.value) : s.color(s.value);
        return `${chalk.dim(s.label)}: ${val}`;
      }).join('   ');
      console.log(`  ${statLine}`);
      console.log('  ' + brand.cyan('─'.repeat(56)));
      console.log();

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
      showBasicHelp();
    }
  } else {
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function showBasicHelp() {
  console.log(`  ${brand.purpleBold('Quick Start:')}`);
  console.log(`    ${brand.cyan('controlinfra login')}        ${chalk.dim('Authenticate with your account')}`);
  console.log(`    ${brand.cyan('controlinfra repos add')}    ${chalk.dim('Add a repository to monitor')}`);
  console.log(`    ${brand.cyan('controlinfra scan run')}     ${chalk.dim('Trigger a drift scan')}`);
  console.log(`    ${brand.cyan('controlinfra --help')}       ${chalk.dim('View all commands')}`);
}

module.exports = { program };
