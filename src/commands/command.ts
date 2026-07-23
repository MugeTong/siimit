export default abstract class Command {
  /** Command name used for CLI dispatch, e.g. "login", "submit" */
  abstract name: string;
  /** One-line summary shown in help output */
  abstract short: string;
  /** Detailed description shown in help output */
  abstract description: string;

  /** Usage line, override to add options, e.g. "siimit submit <project> [--dry-run]" */
  get usage(): string {
    return `siimit ${this.name}`;
  }

  /** Help text, override for richer output */
  help(): string {
    return `Usage: ${this.usage}\n\n${this.description}\n`;
  }

  /** Core logic — implement in subclass */
  abstract run(args: string[]): void | Promise<void>;

  /** Entry point called by the dispatcher: handles --help/-h before delegating to run() */
  handle(args: string[]): void | Promise<void> {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(this.help());
      return;
    }
    return this.run(args);
  }
}
