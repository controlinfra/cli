const chalk = require('chalk');
const api = require('../api');
const { brand } = require('../output');
const { createSpinner } = require('../output');
const { gradientBanner } = require('../banner');

/**
 * Show dashboard after login
 */
async function showDashboard(user) {
  gradientBanner();

  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const userName = user?.displayName || user?.name || user?.email?.split('@')[0] || 'there';
  console.log(`\n  ${brand.cyan(greeting)}, ${chalk.bold(userName)}!`);
  console.log(chalk.dim('  Welcome to Controlinfra CLI\n'));

  const spinner = createSpinner('Loading your dashboard...').start();

  try {
    const [repoData, scanData, driftData] = await Promise.all([
      api.repos.list().catch(() => ({ configs: [] })),
      api.scans.list({ limit: 100 }).catch(() => ({ scans: [] })),
      api.drifts.list({ status: 'detected', limit: 100 }).catch(() => ({ drifts: [] })),
    ]);

    spinner.stop();

    const repoList = repoData?.configs || repoData?.repositories || [];
    const scanList = scanData?.scans || [];
    const driftList = driftData?.drifts || [];

    console.log('  ' + chalk.dim('─'.repeat(56)));
    const stats = [
      `${chalk.dim('Repositories')}: ${brand.cyanBold(repoList.length)}`,
      `${chalk.dim('Active Drifts')}: ${driftList.length > 0 ? chalk.yellow.bold(driftList.length) : chalk.green.bold(0)}`,
      `${chalk.dim('Total Scans')}: ${chalk.blue.bold(scanList.length)}`,
    ];
    console.log(`  ${stats.join('   ')}`);
    console.log('  ' + chalk.dim('─'.repeat(56)));
    console.log();

    console.log(`  ${brand.purpleBold('Quick Actions:')}`);
    if (repoList.length === 0) {
      console.log(`    ${chalk.yellow('controlinfra repos add <owner/repo>')}  ${chalk.dim('Add your first repository')}`);
    } else {
      console.log(`    ${chalk.yellow('controlinfra scan run <repo>')}         ${chalk.dim('Run a drift scan')}`);
    }
    if (driftList.length > 0) {
      console.log(`    ${chalk.yellow('controlinfra drifts list')}             ${chalk.dim('View active drifts')}`);
    }
    console.log(`    ${chalk.yellow('controlinfra --help')}                  ${chalk.dim('View all commands')}`);
    console.log();
    console.log(`  ${chalk.dim('Documentation:')} ${brand.cyan('https://docs.controlinfra.com')}`);
    console.log();
  } catch (_error) {
    spinner.stop();
    console.log(`\n  ${brand.purpleBold('Get started:')}`);
    console.log(`    ${chalk.yellow('controlinfra --help')}  ${chalk.dim('View all available commands')}`);
    console.log();
  }
}

module.exports = { showDashboard };
