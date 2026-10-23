import { Command, Ref } from "@/utils";
import { jobsApi } from "@/api";
import { prettyPrint, timestamp2date } from "@/utils";

const jobId = new Ref("");
const jsonFlag = new Ref(false);

async function getHandler(self: Command): Promise<void> {
    const data = await jobsApi.getJob(jobId.value);

    // Handle the results for better display
    const result = {
        ...data,
        status: data.status.toUpperCase(),
        createdAt: timestamp2date(data.createdAt),
        finishedAt: data.finishedAt ? timestamp2date(data.finishedAt) : "N/A",
        runningSeconds: data.runningSeconds ?? "N/A"
    };

    // Output the results
    prettyPrint(result, jsonFlag.value, [
        "jobId",
        "name",
        "status",
        "priority",
        "groupName",
        "createdAt",
        "finishedAt",
    ]);
}

const getCommand = new Command({
    name: "get",
    short: "get job details by job ID",
    long: "Get job details by job ID.",
    aliases: [],
    run: getHandler,
});

getCommand.setPos(jobId, {
    name: "job-id",
});
getCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});

export { getCommand };
