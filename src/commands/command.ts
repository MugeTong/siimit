export interface Command {
  name: string;
  short: string;
  description: string;
  usage?: string;
  details?: string;
  valueOptions?: readonly string[];
  flagOptions?: readonly string[];
  maxPositionals?: number;
  run(args: string[]): void | Promise<void>;
}

export function commandHelp(command: Command): string {
  return [
    `Usage: ${command.usage ?? `siimit ${command.name}`}`,
    "",
    command.description,
    command.details ? `\n${command.details}` : "",
  ].join("\n").trimEnd();
}

export function execute(command: Command, args: string[]): void | Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(commandHelp(command));
    return;
  }
  validateArguments(command, args);
  return command.run(args);
}

function validateArguments(command: Command, args: string[]): void {
  let positionals = 0;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (command.valueOptions?.includes(argument)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;
      continue;
    }
    if (command.flagOptions?.includes(argument)) continue;
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option for ${command.name}: ${argument}. Run 'siimit ${command.name} --help' for usage.`);
    }
    positionals += 1;
  }
  if (command.maxPositionals !== undefined && positionals > command.maxPositionals) {
    throw new Error(`Too many arguments for ${command.name}. Run 'siimit ${command.name} --help' for usage.`);
  }
}
