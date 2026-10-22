import { Command, Ref, timestamp2date } from "@/utils";
import { jobsApi } from "@/api";

const jobId = new Ref("");

const typeOption = new Ref<LogType>("all");
const orderOption = new Ref<LogOrder>("descend");
const limitOption = new Ref(-1);

const jsonFlag = new Ref(false);

const validTypes = ["job", "event", "all"] as const;
const validOrders = ["ascend", "descend"] as const;

type LogType = (typeof validTypes)[number];
type LogOrder = (typeof validOrders)[number];

async function logsHandler(self: Command): Promise<void> {
    if (!["all", "job", "event"].includes(typeOption.value)) {
        throw new Error(
            `Invalid log type: '${typeOption.value}'. Valid types are: ${validTypes.join(", ")}`,
        );
    }

    if (!Number.isInteger(limitOption.value) || limitOption.value < 1) {
        throw new Error("Log limit must be a positive integer");
    }

    if (!validOrders.includes(orderOption.value)) {
        throw new Error("Log order must be either 'ascend' or 'descend'");
    }

    const params = {
        jobId: jobId.value,
        order: orderOption.value,
        limit: limitOption.value,
    };
    const fetchMap = {
        job: jobsApi.getJobLogs,
        event: jobsApi.listJobEvents,
    };

    const fetchers =
        typeOption.value === "all" ? Object.values(fetchMap) : [fetchMap[typeOption.value]];

    const logs = (await Promise.all(fetchers.map((fetcher) => fetcher(params)))).flat();
    const direction = orderOption.value === "descend" ? -1 : 1;
    logs.sort((a, b) => direction * (a.timestamp - b.timestamp));

    // Trancate logs if limit is set
    if (limitOption.value > 0) {
        logs.splice(limitOption.value);
    }

    if (logs.length === 0) {
        logs.push({
            message: "No logs found for the specified job ID and filters.",
            timestamp: Date.now(),
        });
    }

    // Handle the logs for bvetter display
    const results = logs.map((log) => ({
        ...log,
        timestamp: timestamp2date(log.timestamp, true),
    }));

    if (jsonFlag.value) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        results.forEach((log) => {
            console.log(`[${log.timestamp}] ${log.message}`);
        });
    }
}

const logsCommand = new Command({
    name: "logs",
    short: "get job logs by ID",
    long: "Get job logs by its ID.",
    aliases: ["log"],
    run: logsHandler,
});

logsCommand.setPos(jobId, {
    name: "job-id",
});

logsCommand.setOption(typeOption, {
    name: "type",
    required: false,
    valueName: "type",
    defaultValue: "all",
    description: "log category: all, job, event",
});

logsCommand.setOption(orderOption, {
    name: "order",
    required: false,
    valueName: "order",
    defaultValue: "descend",
    description: "log order: ascend, descend",
});

logsCommand.setOption(limitOption, {
    name: "limit",
    required: false,
    valueName: "limit",
    defaultValue: 20,
    description: "limit the number of logs to display",
});

logsCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output logs in JSON format",
});

export { logsCommand };
