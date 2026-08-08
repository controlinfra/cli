import chalk from 'chalk';
import { brand } from './output.js';

const PURPLE = brand.hex.purple;
const CYAN = brand.hex.cyan;

/**
 * Render the "CONTROLINFRA" calligraphy-style banner
 * Matches the runner install script banner exactly.
 */
function gradientBanner() {
  const purple = chalk.hex(PURPLE);
  const cyan = chalk.hex(CYAN);
  const dim = chalk.dim;

  console.log();
  console.log(purple('  ██████╗ ██████╗ ███╗   ██╗████████╗██████╗  ██████╗ ██╗     ██╗███╗   ██╗███████╗██████╗  █████╗ '));
  console.log(purple(' ██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗██║     ██║████╗  ██║██╔════╝██╔══██╗██╔══██╗'));
  console.log(cyan('  ██║     ██║   ██║██╔██╗ ██║   ██║   ██████╔╝██║   ██║██║     ██║██╔██╗ ██║█████╗  ██████╔╝███████║'));
  console.log(cyan('  ██║     ██║   ██║██║╚██╗██║   ██║   ██╔══██╗██║   ██║██║     ██║██║╚██╗██║██╔══╝  ██╔══██╗██╔══██║'));
  console.log(purple(' ╚██████╗╚██████╔╝██║ ╚████║   ██║   ██║  ██║╚██████╔╝███████╗██║██║ ╚████║██║     ██║  ██║██║  ██║'));
  console.log(purple('  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝'));
  console.log(dim('  infrastructure control platform'));
  console.log();
}

export { gradientBanner };