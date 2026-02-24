const scanCommands = require('../commands/scan');
const scanWaitCommands = require('../commands/scan-wait');
const scanActionCommands = require('../commands/scan-actions');

function registerScan(program) {
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
    .action(scanWaitCommands.status);

  scan
    .command('wait <scan-id>')
    .description('Wait for scan to complete')
    .option('--timeout <seconds>', 'Maximum wait time', '600')
    .option('--fail-on-drift', 'Exit with code 1 if any drift is detected')
    .option('--fail-on-severity <level>', 'Exit with code 1 if drift severity >= level (critical|high|medium|low)')
    .option('--fail-on-new-only', 'Only fail on new drifts, ignore recurring')
    .action(scanWaitCommands.wait);

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

  scan
    .command('retry <scan-id>')
    .description('Retry a failed scan')
    .action(scanActionCommands.retry);

  scan
    .command('delete <scan-id>')
    .description('Delete a scan record')
    .option('--force', 'Skip confirmation')
    .action(scanActionCommands.deleteScan);
}

module.exports = registerScan;
