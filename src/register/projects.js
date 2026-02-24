const projectCommands = require('../commands/projects');

function registerProjects(program) {
  const projects = program.command('projects').description('Manage projects');

  projects
    .command('list')
    .alias('ls')
    .description('List all projects')
    .action(projectCommands.list);

  projects
    .command('create <name>')
    .description('Create a new project')
    .option('--description <desc>', 'Project description')
    .action(projectCommands.create);

  projects
    .command('info <id>')
    .description('Show project details')
    .action(projectCommands.info);

  projects
    .command('update <id>')
    .description('Update project')
    .option('--name <name>', 'New project name')
    .option('--description <desc>', 'New description')
    .action(projectCommands.update);

  projects
    .command('delete <id>')
    .description('Delete a project')
    .option('--force', 'Skip confirmation')
    .action(projectCommands.deleteProject);

  projects
    .command('default <id>')
    .description('Set project as default')
    .action(projectCommands.setDefault);
}

module.exports = registerProjects;
