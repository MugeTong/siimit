import { Command, Ref } from "@/utils";
import fs from "fs";
import { groupsApi, jobsApi } from "@/api";
import { PRIORITIES, type Priority, toPriorityNumber } from "@/types";
import { prettyPrint } from "@/utils";

const jobName = new Ref<string>("");
const projectIdOption = new Ref<string>("");
const imageNameOption = new Ref<string>("");
const groupIdOption = new Ref<string>("");
const priorityOption = new Ref<Priority>("low");
const commandOption = new Ref<string>("");
const commandFileOption = new Ref<string>("");
const gpusOption = new Ref<number>(1);
const maxTimeOption = new Ref<string>("");
const nodesOption = new Ref<number>(1);

const jsonFlag = new Ref<boolean>(false);
const yesFlag = new Ref<boolean>(false);

async function submitHandler(self: Command): Promise<void> {
    // Validation of parameters
    if (!PRIORITIES.includes(priorityOption.value)) {
        throw new Error("Invalid priority value.");
    }

    if (!commandOption.value && !commandFileOption.value) {
        throw new Error(
            "Missing required parameter: either --command or --command-file must be provided",
        );
    }
    if (commandOption.value && commandFileOption.value) {
        throw new Error("Invalid parameters: --command and --command-file cannot be used together");
    }
    if (commandFileOption.value && !fs.existsSync(commandFileOption.value)) {
        throw new Error("FileNotFoundError: The specified command file does not exist");
    }

    if (!Number.isInteger(gpusOption.value) || gpusOption.value <= 0 || gpusOption.value > 8) {
        throw new Error("Invalid number of GPUs: must be an integer between 1 and 8");
    }

    const factorMap: Record<string, number> = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
    };
    const timeUnit = maxTimeOption.value.slice(-1);
    const timeValue = maxTimeOption.value.slice(0, -1);
    if (!factorMap[timeUnit]) {
        throw new Error("Invalid unit for --max-time: must end with 's', 'm', 'h', or 'd'");
    }
    let time = parseFloat(timeValue);
    if (isNaN(time) || time <= 0) {
        throw new Error("Invalid value for --max-time: must be a positive number");
    }
    const maxTime = time * factorMap[timeUnit];

    if (!Number.isInteger(nodesOption.value) || nodesOption.value <= 0) {
        throw new Error("Invalid value for --nodes: must be a positive integer");
    }
    if (nodesOption.value > 1 && gpusOption.value !== 8) {
        throw new Error("Set --nodes > 1 is only allowed when --gpus=8");
    }

    const quotaMap: Record<number, string> = await groupsApi.getQuotaMap(
        groupIdOption.value,
        priorityOption.value,
    );
    if (!quotaMap[gpusOption.value]) {
        throw new Error(
            `Invalid number of GPUs: ${gpusOption.value}.  ` +
                `Available options for group ${groupIdOption.value} ` +
                `with priority ${priorityOption.value} are: ` +
                `${Object.keys(quotaMap).join(", ")}`,
        );
    }

    // Handle dry-run output if --yes flag is not set
    if (!yesFlag.value) {
        if (jsonFlag.value) {
            console.log(JSON.stringify({ validated: true, submitted: false }, null, 2));
        } else {
            console.log(
                "Parameters validated successfully. Use the --yes flag to confirm submission.",
            );
        }
        return;
    }

    // Submit the job using the API
    const data = await jobsApi.submitJob({
        name: jobName.value,
        projectId: projectIdOption.value,
        imageName: imageNameOption.value,
        groupId: groupIdOption.value,
        priority: toPriorityNumber(priorityOption.value),
        command: commandOption.value,
        commandFile: commandFileOption.value,
        quotaId: quotaMap[gpusOption.value]!,
        maxRunSeconds: maxTime,
        nodeCount: nodesOption.value,
    });

    // Handle the results for better display
    const results = {
        ...data,
        status: data.status.toUpperCase(),
    };

    // Output the results
    prettyPrint(results, jsonFlag.value, ["jobId", "name", "status", "priority"]);
}

const submitCommand = new Command({
    name: "submit",
    short: "submit a job",
    long: "Submit a job with the specified parameters.",
    aliases: ["create"],
    run: submitHandler,
});

submitCommand.setPos(jobName, {
    name: "job-name",
});

submitCommand.setOption(projectIdOption, {
    name: "project",
    required: true,
    description: "project Id",
});
submitCommand.setOption(imageNameOption, {
    name: "image",
    required: true,
    description: "name of the image to use",
});
submitCommand.setOption(groupIdOption, {
    name: "group",
    required: true,
    description: "computation group Id",
});
submitCommand.setOption(priorityOption, {
    name: "priority",
    required: true,
    description: "job priority level",
});
submitCommand.setOption(commandOption, {
    name: "command",
    required: false,
    description: "command to execute for the job",
});
submitCommand.setOption(commandFileOption, {
    name: "command-file",
    required: false,
    description: "path to a file to execute using bash",
});
submitCommand.setOption(gpusOption, {
    name: "gpus",
    required: true,
    description: "number of GPUs per node",
});
submitCommand.setOption(maxTimeOption, {
    name: "max-time",
    required: true,
    description: "maximum time to run (e.g. 60s, 10m, 2h, 1d)",
});
submitCommand.setOption(nodesOption, {
    name: "nodes",
    required: false,
    defaultValue: 1,
    description: "number of nodes used",
});

submitCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});
submitCommand.setFlag(yesFlag, {
    name: "yes",
    shortName: "y",
    description: "job will be submitted only when this flag is set",
});

export { submitCommand };
