import { Command, Ref } from "@/utils";
import { groupsApi } from "@/api";
import { prettyPrint } from "@/utils";

const jsonFlag = new Ref(false);

async function groupsHandler(self: Command): Promise<void> {
    // Fetch the group list from the API
    const data = await groupsApi.listGroups();

    // Handle the results for better display
    const results = data.map((group) => ({
        ...group,
    }));

    prettyPrint(results, jsonFlag.value, ["groupId", "name", "free", "lowPriUsed", "gpuTotal"]);
}

const groupsCommand = new Command({
    name: "groups",
    short: "list computation groups",
    long: "List all available computation groups and their usage.",
    aliases: [],
    run: groupsHandler,
});

groupsCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});

export { groupsCommand };
