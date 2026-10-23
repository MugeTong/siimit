import { Command, Ref } from "@/utils";
import { jobsApi } from "@/api";

const jobId = new Ref("");

const jsonFlag = new Ref<boolean>(false);

async function deleteHandler(self: Command): Promise<void> {
    await jobsApi.deleteJob(jobId.value);

    if (jsonFlag.value) {
        console.log(JSON.stringify({ job: jobId.value, result: "Job has been deleted." }));
    } else {
        console.log(`Job ${jobId.value} deleted successfully.`);
    }
}

const deleteCommand = new Command({
    name: "delete",
    short: "delete a job by ID",
    long: "Delete a job by its ID.",
    aliases: ["remove"],
    run: deleteHandler,
});

deleteCommand.setPos(jobId, {
    name: "job-id",
});

deleteCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});

export { deleteCommand };
