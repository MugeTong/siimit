import { Table } from "console-table-printer";

export function prettyPrint<T extends object>(
  data: T[] | T,
  asJson: boolean,
  tableKeys: readonly (keyof NoInfer<T> & string)[],
): void {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const rows = Array.isArray(data) ? data : [data];

  const table = new Table({
    columns: tableKeys.map((key) => ({ name: key, title: key })),
  });

  rows.forEach((item) => {
    const row: Record<string, string> = {};
    tableKeys.forEach((key) => {
      row[key] = String(item[key] ?? "-");
    });
    table.addRow(row);
  });

  table.printTable();
}
