import type { Command, CommandContext } from "./types";
import { loginCommand } from "./login";
import { logoutCommand } from "./logout";
import { projectsCommand } from "./projects";
import { listCommand } from "./list";
import { cancelCommand } from "./cancel";

type FlagRow = [flag: string, description: string];

const packageJson = await Bun.file("package.json").json();

const helpCommand: Command = {
    name: "help",
    hidden: true,
    description: "Show help information.",
    run: async (ctx: CommandContext) => {
        console.log(`${packageJson.description}`);
        console.log(`\nUsage:`);
        console.log(`  ${packageJson.name} [flags]`);
        console.log(`  ${packageJson.name} [command]`);
        console.log(`\nAvailable Commands:`);
        commandList.forEach(command => {
            if (command.hidden) return;
            console.log(`  ${command.name}\t\t${command.description}`);
        });
        console.log(`\nFlags:`);
        console.log(`  -h, --help     show help information`);
        console.log(`  -v, --version  show version information`);
        console.log(`\nUse "${packageJson.name} [command] --help" for more information about a command.`);
    },
}

const versionCommand: Command = {
    name: "version",
    hidden: true,
    description: "Show version information.",
    run: async (ctx: CommandContext) => {
        console.log(`${packageJson.name} version ${packageJson.version}`);
    },
}

const commandList: Command[] = [
    loginCommand,
    logoutCommand,
    listCommand,
    projectsCommand,
    cancelCommand,
    helpCommand,
    versionCommand,
]

function createCommandList(commands: Command[]): Record<string, Command> {
    return commands.reduce((acc, command) => {
        acc[command.name] = command;
        if (command.aliases) {
            command.aliases.forEach(alias => {
                acc[alias] = command;
            });
        }
        return acc;
    }, {} as Record<string, Command>);
}

export const commands = createCommandList(commandList);


export async function executeCommand(command: Command, argv: string[]): Promise<void> {
    // Handle the case where -h or --help is passed after a command
    if (argv.length > 0 && (argv[0] === "--help" || argv[0] === "-h")) {
        const packageJson = await Bun.file("package.json").json();

        console.log(`${command.description || "No description available."}`);

        console.log(`\nUsage:`);
        if (command.positionalNames && command.positionalNames.length > 0) {
            console.log(`  ${packageJson.name} ${command.name} ${command.positionalNames.join(" ")} [flags]`);
        } else {
            console.log(`  ${packageJson.name} ${command.name} [flags]`);
        }

        if (command.aliases && command.aliases.length > 0) {
            console.log(`\nAliases:`);
            console.log(`  ${command.name}, ${command.aliases.join(", ")}`);
        }

        console.log(`\nFlags:`);
        const flagRows: Array<FlagRow> = [
            ...Object.entries(command.valueOptions ?? {}).map(([flag, description]): FlagRow => [`${flag} <value>`, description]),
            ...Object.entries(command.flagOptions ?? {}).map(([flag, description]): FlagRow => [flag, description]),
            ["-h, --help", "show help information"],
        ]
        const usageWidth = Math.max(...flagRows.map(([flag]) => flag.length));
        for (const [flag, description] of flagRows) {
            console.log(`  ${flag.padEnd(usageWidth + 2)}${description}`);
        }
        process.exit(0);
    }

    // Parse params from the rest of the arguments
    const args: string[] = [];
    const params: Record<string, string> = {};
    const flags: Set<string> = new Set();

    let positinals = 0;
    for (let i = 0; i < argv.length; i++) {
        const argument = argv[i]!;
        if (!argument.startsWith("-")) {
            args.push(argument);
            positinals++;
            continue;
        } else {
            if (i + 1 < argv.length) {
                const nextArg = argv[i + 1]!;
                if (!nextArg.startsWith("-")) {
                    // This is a value option
                    params[argument] = nextArg;
                    i++; // Skip the next argument since it's a value
                } else {
                    // This is a flag
                    flags.add(argument);
                }
            } else {
                // This is a flag
                flags.add(argument);
            }
        }
    }
    // Validation for positional arguments
    if (command.positionalNames) {
        if (args.length < command.positionalNames.length) {
            console.error(`Error: Missing required positional arguments. Expected ${command.positionalNames.length}, but got ${args.length}.`);
            console.error(`Usage: ${packageJson.name} ${command.name} ${command.positionalNames.join(" ")} [flags]`);
            process.exit(1);
        }
        if (args.length > command.positionalNames.length) {
            console.error(`Error: Too many positional arguments. Expected ${command.positionalNames.length}, but got ${args.length}.`);
            console.error(`Usage: ${packageJson.name} ${command.name} ${command.positionalNames.join(" ")} [flags]`);
            process.exit(1);
        }
    } else if (args.length > 0) {
        console.error(`Error: Command "${command.name}" does not accept positional arguments, but got ${args.length}.`);
        console.error(`Usage: ${packageJson.name} ${command.name} [flags]`);
        process.exit(1);
    }

    // Validation for value options
    if (command.valueOptions && Object.keys(command.valueOptions).length > 0) {
        for (const [option, value] of Object.entries(params)) {
            if (!(option in command.valueOptions)) {
                console.error(`Error: Unknown value option "${option}".`);
                console.log(`\nUse "${packageJson.name} ${command.name} --help" for more information.`);
                process.exit(1);
            }
        }
    } else if (Object.keys(params).length > 0) {
        console.error(`Error: Command "${command.name}" does not accept value options, but got ${Object.keys(params).length}.`);
        console.log(`\nUse "${packageJson.name} ${command.name} --help" for more information.`);
        process.exit(1);
    }


    // Validation for flag options
    if (command.flagOptions && Object.keys(command.flagOptions).length > 0) {
        for (const flag of flags) {
            if (flag === "-h" || flag === "--help") continue;
            if (!(flag in command.flagOptions)) {
                console.error(`Error: Unknown flag "${flag}".`);
                console.log(`\nUse "${packageJson.name} ${command.name} --help" for more information.`);
                process.exit(1);
            }
        }
    } else if (flags.size > 0) {
        flags.forEach(flag => {
            if (flag !== "-h" && flag !== "--help") {
                console.error(`Error: Unknown flag "${flag}".`);
                console.log(`\nUse "${packageJson.name} ${command.name} --help" for more information.`);
                process.exit(1);
            }
        });
    }
    const ctx = { args, params, flags };
    await command.run(ctx);
}
