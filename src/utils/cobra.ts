// cobra.ts
// Copyright (c) 2026 MugeTong. All rights reserved.
// Licensed under the MIT License. See LICENSE in the project root for license information.

export class Command {
    private parent: Command | null = null;

    private poses: Array<[string, Ref<string>]> = [];
    private options: Record<
        string,
        {
            isShort: boolean;
            state: {
                variable: Ref<string | number>;
                valueSet: boolean;
                shortName?: string;
                defaultValue?: string | number;
                description?: string;
            };
        }
    > = {};
    private flags: Record<
        string,
        {
            isShort: boolean;
            state: {
                variable: Ref<boolean>;
                shortName?: string;
                description?: string;
            };
        }
    > = {};

    private get fullPath(): string {
        let path = this.conf.name;
        let current = this.parent;
        while (current) {
            path = `${current.conf.name} ${path}`;
            current = current.parent;
        }
        return path;
    }

    private get usageString(): string {
        const hasPoses = this.poses.length > 0;
        const hasOptions = Object.keys(this.options).length > 0;
        const hasFlags = Object.keys(this.flags).length > 0;

        return (
            `${this.fullPath} ` +
            `${hasPoses ? this.poses.map(([name]) => `<${name}>`).join(" ") + " " : ""}` +
            `${hasOptions ? "[options] " : ""}` +
            `${hasFlags ? "[flags]" : ""}`
        );
    }

    constructor(
        private readonly conf: {
            name: string;
            version?: string;
            aliases?: string[];
            short: string;
            long: string;
            commands?: Command[];
            run: (self: Command) => Promise<void>;
        },
    ) {
        this.setFlag(new Ref(true), "help", "h", "show help information");
        if (conf.version) {
            this.setFlag(new Ref(true), "version", "v", "show version information");
        }

        if (conf.commands) {
            for (const cmd of conf.commands) {
                cmd.parent = this;
            }
        }
    }

    setPos<T extends string>(variable: Ref<T>, name: string): Command {
        // Implementation for setting a positional argument
        this.poses.push([name, variable]);
        return this;
    }

    setOption<T extends string | number>(
        variable: Ref<T>,
        name: string,
        shortName?: string,
        defaultValue?: T,
        description?: string,
    ): Command {
        // Implementation for setting an option
        const sharedState = {
            variable,
            valueSet: false,
            shortName,
            defaultValue,
            description,
        };
        this.options[name] = {
            isShort: false,
            state: sharedState,
        };
        if (shortName) {
            this.options[shortName] = {
                isShort: true,
                state: sharedState,
            };
        }

        // Set the default value of the option if provided
        if (defaultValue !== undefined) {
            variable.value = defaultValue;
            sharedState.valueSet = true;
        }
        return this;
    }

    setFlag(
        variable: Ref<boolean>,
        name: string,
        shortName?: string,
        description?: string,
    ): Command {
        // Implementation for setting a flag
        const sharedState = {
            variable,
            shortName,
            description,
        };
        this.flags[name] = {
            isShort: false,
            state: sharedState,
        };
        if (shortName) {
            this.flags[shortName] = {
                isShort: true,
                state: sharedState,
            };
        }
        // Set the default value of the flag to false
        variable.value = false;

        return this;
    }

    help(): void {
        const hasAliases = this.conf.aliases && this.conf.aliases.length > 0;
        const hasCommands = this.conf.commands && this.conf.commands.length > 0;
        const hasOptions = Object.keys(this.options).length > 0;
        const hasFlags = Object.keys(this.flags).length > 0;

        // Implementation for displaying help information
        console.log(`${this.conf.long}`);

        console.log("\nUsage:");
        console.log(`  ${this.usageString}`);
        if (hasCommands) {
            console.log(`  ${this.fullPath} [command]`);
        }

        if (hasAliases) {
            console.log("\nAliases:");
            console.log(`  ${this.conf.aliases?.join(", ")}`);
        }

        if (hasCommands) {
            console.log("\nAvailable Commands:");
            const maxLen = Math.max(...this.conf.commands!.map((cmd) => cmd.conf.name.length));
            for (const cmd of this.conf.commands!) {
                console.log(`  ${cmd.conf.name.padEnd(maxLen)}  ${cmd.conf.short}`);
            }
        }

        if (hasOptions) {
            console.log("\nOptions:");
            // Display options
            const printObject: Array<[string, string]> = Object.entries(this.options)
                .filter(([, value]) => !value.isShort)
                .map(([key, value]) => {
                    const shortName = value.state.shortName ? `-${value.state.shortName}, ` : "    ";
                    const valueType = typeof value.state.variable.value === "number" ? " number" : " string";
                    const option = `${shortName}--${key}${valueType}`;

                    let description = value.state.description || "no description available";
                    if (value.state.defaultValue !== undefined) {
                        description += ` (default: ${value.state.defaultValue})`;
                    }
                    return [option, description];
                });
            const maxLen = Math.max(...printObject.map((item) => item[0].length));
            for (const [option, description] of printObject) {
                console.log(`  ${option.padEnd(maxLen)}  ${description}`);
            }
        }

        if (hasFlags) {
            console.log("\nFlags:");
            // Display flags
            const printObject: Array<[string, string]> = Object.entries(this.flags)
                .filter(([, value]) => !value.isShort)
                .map(([key, value]) => [
                    value.state.shortName ? `-${value.state.shortName}, --${key}` : `    --${key}`,
                    value.state.description || "no description available",
                ]);
            const maxLen = Math.max(...printObject.map((item) => item[0].length));
            for (const [flag, description] of printObject) {
                console.log(`  ${flag.padEnd(maxLen)}  ${description}`);
            }
        }

        if (hasCommands) {
            console.log(
                `\nUse "${this.fullPath} [command] --help" for more information about a command.`,
            );
        }
    }

    async execute(argv?: string[]): Promise<void> {
        // Implementation for executing the command
        const cmdArgs = argv ?? process.argv.slice(2);

        let index = 0;
        let poseIndex = 0;
        if (cmdArgs.length > 0) {
            // Parse the `-h` or `--help` flag if present
            if (cmdArgs[0] === "--help" || cmdArgs[0] === "-h") {
                this.help();
                return;
            }
            // Parse the `-v` or `--version` flag if present
            if ((cmdArgs[0] === "--version" || cmdArgs[0] === "-v") && this.conf.version) {
                console.log(`${this.fullPath} version ${this.conf.version}`);
                return;
            }

            // Parse subcommands if present
            if (this.conf.commands) {
                const subCommandName = cmdArgs[0]!;
                const subCommand = this.conf.commands.find(
                    (cmd) =>
                        cmd.conf.name === subCommandName ||
                        cmd.conf.aliases?.includes(subCommandName),
                );
                if (subCommand) {
                    return await subCommand.execute(cmdArgs.slice(1));
                }
            }

            // Handle positional arguments and options/flags
            while (index < cmdArgs.length) {
                const arg = cmdArgs[index]!;

                if (!arg.startsWith("-")) {
                    // Handle positional arguments
                    const pose = this.poses[poseIndex];
                    if (pose === undefined) {
                        throw new Error(
                            `Unexpected argument at position ${poseIndex + 1}: ${arg}\n\n` +
                                `Usage: ${this.usageString}`,
                        );
                    }
                    pose[1].value = arg;
                    poseIndex++;
                    index++;
                    continue;
                } else {
                    // Handle options and flags here
                    const name = arg.replace(/^-+/, "");
                    if (this.options[name]) {
                        // This is an option with a value
                        const value = cmdArgs[index + 1]!;
                        if (value === undefined) {
                            throw new Error(`Missing value for option ${arg}`);
                        }

                        const valueReplaced = value.replace(/^-+/, "");
                        const isKnownOptionOrFlag =
                            value.startsWith("-") &&
                            (this.options[valueReplaced] !== undefined ||
                                this.flags[valueReplaced] !== undefined);
                        if (isKnownOptionOrFlag) {
                            throw new Error(`Missing value for option ${arg}`);
                        }

                        this.options[name].state.valueSet = true;
                        if (typeof this.options[name].state.variable.value === "number") {
                            const numberValue = Number(value);
                            if (Number.isFinite(numberValue)) {
                                this.options[name].state.variable.value = numberValue;
                            } else {
                                throw new Error(`Invalid value for option ${arg}: ${value}`);
                            }
                        } else {
                            this.options[name].state.variable.value = value;
                        }

                        index += 2; // Skip the next argument since it's a value
                    } else if (this.flags[name]) {
                        // This is a flag
                        this.flags[name].state.variable.value = true;
                        index++;
                    } else {
                        throw new Error(
                            `Unknown option or flag: ${arg}\n\n` + `Usage: ${this.usageString}`,
                        );
                    }
                }
            }
        }

        // Check if all required options have been set
        for (const [name, option] of Object.entries(this.options)) {
            if (option.isShort) {
                // Skip short options, they are handled by their long counterparts
                continue;
            }
            if (!option.state.valueSet) {
                throw new Error(`Missing required option: --${name}`);
            }
        }

        // Check if all required positional arguments have been set
        if (poseIndex < this.poses.length) {
            const name = this.poses[poseIndex]![0];
            throw new Error(
                `Missing required positional argument: <${name}>\n\n` +
                    `Usage: ${this.usageString}`,
            );
        }

        // Execute the command's run function
        await this.conf.run(this);
    }
}

export class Ref<T extends string | number | boolean> {
    constructor(public value: T) {}
}
