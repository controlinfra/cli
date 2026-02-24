const authCommands = require('../commands/auth');

function registerAuth(program) {
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
}

module.exports = registerAuth;
