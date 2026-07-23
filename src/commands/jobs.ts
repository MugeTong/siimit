import Command from "./command";

class SubmitCommand extends Command {
  name = "submit";
  short = "Submit a training job to the platform";
  description = "Submit a training job to the platform with the specified parameters and configuration.";

    async run(args: string[]): Promise<void> {
    }
}

class ListCommand extends Command {
  name = "list";
  short = "List all training jobs";
  description = "List all training jobs submitted by the user, along with their status and details.";

  async run(): Promise<void> {
    console.log("Listing jobs...");
  }
}

class CancelCommand extends Command {
  name = "cancel";
  short = "Cancel a training job";
  description = "Cancel a training job that is currently running or queued.";

  async run(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log("Usage: siimit jobs cancel <job-id>");
      return;
    }
    const jobId = args[0];
    console.log(`Canceling job ${jobId}...`);
  }
}

class RemoveCommand extends Command {
  name = "remove";
  short = "Remove a canceled or succeeded job";
  description = "Remove a training job that has been canceled or has completed successfully.";

  async run(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log("Usage: siimit jobs remove <job-id>");
      return;
    }
    const jobId = args[0];
    console.log(`Removing job ${jobId}...`);
  }
}

export { SubmitCommand, ListCommand, CancelCommand, RemoveCommand };
