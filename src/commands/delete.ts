import { Command, Ref } from "@/utils";
import { jobsApi } from "@/api";

const jobId = new Ref("");

async function deleteHandler(self: Command): Promise<void> {
    await jobsApi.deleteJob(jobId.value);

    console.log(`Job ${jobId.value} deleted successfully.`);
}

const deleteCommand = new Command({
    name: "delete",
    short: "delete a job by ID",
    long: "Delete a job by its ID.",
    aliases: ["remove"],
    run: deleteHandler,
});

deleteCommand.setPos(jobId, "job-id");

export { deleteCommand };
