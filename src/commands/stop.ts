import { Command, Ref } from "@/utils";
import { jobsApi } from "@/api";

const jobId = new Ref("");

async function stopHandler(self: Command): Promise<void> {
    await jobsApi.stopJob(jobId.value);

    console.log(`Job ${jobId.value} stop request submitted successfully.`);
}

const stopCommand = new Command({
    name: "stop",
    short: "stop a job by ID",
    long: "Stop a job by its ID.",
    aliases: ["cancel"],
    run: stopHandler,
});

stopCommand.setPos(jobId, "job-id");

export { stopCommand };
