import type { Command, CommandContext } from "./types";
import { jobsApi } from "@/api";

async function stopHandler(ctx: CommandContext): Promise<void> {
    const jobId: string = ctx.args[0]!;
    await jobsApi.stopJob(jobId);

    console.log(`Job ${jobId} stop request submitted successfully.`);
}

export const stopCommand: Command = {
    name: "stop",
    hidden: false,
    short: "stop a job by ID",
    description: "Stop a job by its ID.",
    aliases: ["cancel"],
    positionalNames: ["<job-id>"],
    valueOptions: {},
    flagOptions: {},
    run: stopHandler,
};
