export type CommandContext = {
    args: string[];
    flags: Record<string, string | boolean>;
}
export interface Command {
    name: string;
    hidden?: boolean;
    short?: string;
    description?: string;
    aliases?: Array<string>;
    positionalNames?: Array<string>;
    valueOptions?: Record<string, string>;
    flagOptions?: Record<string, string>;
    run(ctx: CommandContext): void | Promise<void>;
}
