import Table from "cli-table3";

type Keys = string[];

export function prettyPrint<T extends object>(data: T[], asJson: boolean, tableKeys: readonly (keyof NoInfer<T> & string)[]): void {
    if (asJson) {
        console.log(JSON.stringify(data, null, 2));
    } else {
        const table = new Table({
            head: [...tableKeys],
            colWidths: tableKeys.map(() => 20),
        });

        data.forEach(item => {
            const row = tableKeys.map((key) => String(item[key] ?? "-"));
            table.push(row);
        });

        console.log(table.toString());
    }
}
