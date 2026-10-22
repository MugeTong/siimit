import { Command, Ref } from "@/utils";
import { jobsApi } from "@/api";
import { prettyPrint, timestamp2date } from "@/utils";
import { isJobStatus, JOB_STATUSES } from "@/types";

const limitOption = new Ref(-1);
const keywordOption = new Ref("");
const statusOption = new Ref("");
const jsonFlag = new Ref(false);

async function listHandler(self: Command): Promise<void> {
    // Parameter validation
    let limit;
    if (!Number.isInteger(limitOption.value) || limitOption.value < 1 || limitOption.value > 5000) {
        throw new Error("Job limit must be an integer between 1 and 5000");
    } else {
        limit = limitOption.value;
    }

    let status;
    if (statusOption.value !== "" && !isJobStatus(statusOption.value)) {
        throw new Error(`Invalid job status for filtering: '${statusOption.value}'`);
    } else {
        status = statusOption.value;
    }

    // Fetch the job list from the API
    const data = await jobsApi.listJobs({
        keyword: keywordOption.value === "" ? undefined : keywordOption.value,
        status: statusOption.value === "" ? undefined : statusOption.value,
        limit: limit,
    });

    // Handle the results for better display
    const results = data.map((job) => ({
        ...job,
        status: job.status.toUpperCase(),
        createdAt: timestamp2date(job.createdAt),
    }));

    // Output the results
    prettyPrint(results, jsonFlag.value, [
        "jobId",
        "name",
        "status",
        "priority",
        "groupName",
        "createdAt",
    ]);
}

const listCommand = new Command({
    name: "list",
    short: "list job queues",
    long: "List all job queues and their statuses.",
    aliases: ["ls"],
    run: listHandler,
});

listCommand.setOption(limitOption, {
    name: "limit",
    required: false,
    defaultValue: 10,
    description: "number of jobs displayed",
});
listCommand.setOption(keywordOption, {
    name: "keyword",
    required: false,
    description: "filter by a keyword in name or job ID",
});
listCommand.setOption(statusOption, {
    name: "status",
    required: false,
    description: `filter by status: ${JOB_STATUSES.join(", ")}`,
});

listCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});

export { listCommand };
