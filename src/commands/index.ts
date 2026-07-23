import stringWidth from "string-width";
import Command from "./command";
import packageInfo from "../../package.json";

import { LoginCommand, LogoutCommand } from "./auth";
import { GroupsCommand, ImagesCommand, ProjectsCommand } from "./platform";
import { ListCommand, CancelCommand, RemoveCommand, SubmitCommand } from "./jobs";

class VersionCommand extends Command {
    name = "version";
    short = "show the version of Siimit";
    description = "Display the version number of Siimit.";

    get usage(): string {
        return "siimit version | -v | -V | --version";
    }

    async run(): Promise<void> {
        console.log(`siimit version ${packageInfo.version}`);
    }
}

class HelpCommand extends Command {
    name = "help";
    short = "show help for a command";
    description = "Display detailed help information for a specific command.";

    get usage(): string {
        return "siimit help <command>";
    }

    async run(args: string[]): Promise<void> {
        if (args.length === 0) {
            console.log("Siimit is a CLI for logging in and submitting training jobs.\n");
            console.log("Usage: siimit <command> [options]\n");
            console.log("Available commands:");
            const entries: [string, string][] = [];
            let maxWidth = 0;
            for (const Ctor of Object.values(commands)) {
                const cmd = new Ctor();
                const w = stringWidth(cmd.name);
                if (w > maxWidth) maxWidth = w;
                entries.push([cmd.name, cmd.short]);
            }
            for (const [name, desc] of entries) {
                const pad = " ".repeat(maxWidth - stringWidth(name) + 2);
                console.log(`  ${name}${pad}${desc}`);
            }
            console.log("\nUse 'siimit help <command>' or 'siimit <command> --help' for more information about that command.");
            return;
        }

        const commandName = args[0]!;
        const Ctor = commands[commandName];
        if (!Ctor) {
            console.error(`Unknown command: ${commandName}`);
            return;
        }
        console.log(new Ctor().help());
    }
}

const commands: Record<string, new () => Command> = {
    version: VersionCommand,
    help: HelpCommand,
    login: LoginCommand,
    logout: LogoutCommand,
    groups: GroupsCommand,
    images: ImagesCommand,
    projects: ProjectsCommand,
    list: ListCommand,
    cancel: CancelCommand,
    remove: RemoveCommand,
    submit: SubmitCommand,
};

export { commands };
