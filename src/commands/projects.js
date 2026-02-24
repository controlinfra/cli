const chalk = require('chalk');
const inquirer = require('inquirer');
const { projects } = require('../api');
const { requireAuth } = require('../config');
const {
  createSpinner,
  outputTable,
  outputError,
  outputBox,
  brand,
  formatRelativeTime,
} = require('../output');

/**
 * List projects
 */
async function list(options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching projects...').start();

  try {
    const data = await projects.list();
    const projectList = data.projects || data || [];
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(projectList, null, 2));
      return;
    }

    if (projectList.length === 0) {
      console.log(chalk.yellow('\nNo projects found\n'));
      console.log(chalk.dim('Create one with'), brand.cyan('controlinfra projects create <name>\n'));
      return;
    }

    console.log();
    outputTable(
      ['ID', 'Name', 'Description', 'Default', 'Created'],
      projectList.map((p) => [
        chalk.dim((p.id || p._id)?.slice(-8) || '-'),
        brand.cyan(p.name || '-'),
        (p.description || '-').substring(0, 30),
        p.isDefault ? chalk.green('Yes') : chalk.dim('No'),
        formatRelativeTime(p.createdAt),
      ]),
      options,
    );
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch projects');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Create a new project
 */
async function create(name, options, command) {
  requireAuth();

  const spinner = createSpinner(`Creating project "${name}"...`).start();

  try {
    const payload = { name };
    if (options.description) payload.description = options.description;

    const data = await projects.create(payload);
    const project = data.project || data;
    spinner.succeed(`Project "${brand.cyan(name)}" created`);

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(project, null, 2));
      return;
    }

    console.log(chalk.dim(`\nProject ID: ${project.id || project._id}\n`));
  } catch (error) {
    spinner.fail('Failed to create project');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Show project details
 */
async function info(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Fetching project info...').start();

  try {
    const data = await projects.get(id);
    const project = data.project || data;
    spinner.stop();

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(project, null, 2));
      return;
    }

    console.log();
    outputBox('Project Details', [
      `ID:          ${chalk.dim(project.id || project._id)}`,
      `Name:        ${brand.cyan(project.name || '-')}`,
      `Description: ${project.description || '-'}`,
      `Default:     ${project.isDefault ? chalk.green('Yes') : 'No'}`,
      `Created:     ${formatRelativeTime(project.createdAt)}`,
      `Updated:     ${formatRelativeTime(project.updatedAt)}`,
    ].join('\n'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to fetch project info');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Update project
 */
async function update(id, options, command) {
  requireAuth();

  const spinner = createSpinner('Updating project...').start();

  try {
    const updates = {};
    if (options.name) updates.name = options.name;
    if (options.description) updates.description = options.description;

    if (Object.keys(updates).length === 0) {
      spinner.warn('No updates specified');
      console.log(chalk.dim('\nUse --name or --description to update\n'));
      return;
    }

    const data = await projects.update(id, updates);
    const project = data.project || data;
    spinner.succeed('Project updated');

    if (command?.parent?.parent?.opts()?.json) {
      console.log(JSON.stringify(project, null, 2));
    }
  } catch (error) {
    spinner.fail('Failed to update project');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Delete a project
 */
async function deleteProject(id, options) {
  requireAuth();

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete this project? This cannot be undone.',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.dim('Cancelled\n'));
      return;
    }
  }

  const spinner = createSpinner('Deleting project...').start();

  try {
    await projects.delete(id);
    spinner.succeed('Project deleted');
  } catch (error) {
    spinner.fail('Failed to delete project');
    outputError(error.message);
    process.exit(1);
  }
}

/**
 * Set project as default
 */
async function setDefault(id, _options) {
  requireAuth();

  const spinner = createSpinner('Setting default project...').start();

  try {
    await projects.setDefault(id);
    spinner.succeed('Default project updated');
  } catch (error) {
    spinner.fail('Failed to set default project');
    outputError(error.message);
    process.exit(1);
  }
}

module.exports = { list, create, info, update, deleteProject, setDefault };
