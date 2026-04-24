import { Command } from "commander";
import chalk from "chalk";
import { scanCommand } from "./commands/scan";

const program = new Command();

program
  .name("rn-bridge-to-turbo")
  .description("Migrate React Native Bridge → TurboModules")
  .version("1.0.0");

program
  .command("scan")
  .argument("<path>", "React Native project path")
  .option("--include-node-modules", "Include node_modules while scanning")
  .action((path, options: { includeNodeModules?: boolean }) => {
    scanCommand(path, { includeNodeModules: options.includeNodeModules });
  });

program.parse();