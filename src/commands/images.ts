import { Command, Ref } from "@/utils";
import { imagesApi } from "@/api";
import { prettyPrint } from "@/utils";

const jsonFlag = new Ref(false);

async function imagesHandler(self: Command): Promise<void> {
    // Fetch the image list from the API
    const data = await imagesApi.listImages();

    // Handle the results for better display
    const results = data.map((image) => ({
        ...image,
    }));

    prettyPrint(results, jsonFlag.value, ["name", "status"]);
}

const imagesCommand = new Command({
    name: "images",
    short: "list available images",
    long: "List all available images and their statuses.",
    aliases: [],
    run: imagesHandler,
});

imagesCommand.setFlag(jsonFlag, {
    name: "json",
    shortName: "j",
    description: "output in JSON format",
});

export { imagesCommand };
