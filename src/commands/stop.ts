import { Command, Ref } from "@/utils";
import { jobsApi } from "@/api";

const jobId = new Ref("");

const jsonFlag = new Ref<boolean>(false);

async function stopHandler(self: Command): Promise<void> {
    await jobsApi.stopJob(jobId.value);

    if (jsonFlag.value) {
        console.log(JSON.stringify({ job: jobId.value, result: "Job stop request submitted." }));
    } else {
        console.log(`Job ${jobId.value} stop request submitted successfully.`);
    }
}

const stopCommand = new Command({
    name: "stop",
    short: "stop a job by ID",
    long: "Stop a job by its ID.",
    aliases: ["cancel"],
    run: stopHandler,
});

stopCommand.setPos(jobId, {
    name: "job-id",
});

stopCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});

export { stopCommand };
