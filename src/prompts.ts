import { createInterface } from "node:readline/promises";

export async function ask(prompt: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try { return await readline.question(`${prompt}: `); } finally { readline.close(); }
}

export async function askHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) return ask(prompt);
  process.stdout.write(`${prompt}: `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk: string) => {
      if (chunk === "\r" || chunk === "\n") return finish();
      if (chunk === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdin.off("data", onData);
        reject(new Error("Interrupted"));
        return;
      }
      if (chunk === "\u007f") value = value.slice(0, -1);
      else value += chunk;
    };
    process.stdin.on("data", onData);
  });
}
