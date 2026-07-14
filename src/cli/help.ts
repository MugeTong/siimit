import { DEFAULT_BASE_URL } from "../config";

export function printHelp(version: string): void {
  console.log(`siimit ${version}\n\nUsage:\n  siimit version\n  siimit login [--username ID] [--base-url URL]\n  siimit logout [--forget]\n  siimit groups [--json]\n  siimit projects [--json]\n  siimit images [--json]\n  siimit ls [OPTIONS]\n  siimit get <job-id> [--json | --raw]\n  siimit submit [OPTIONS]\n  siimit cancel <job-id>\n  siimit remove <job-id>\n\nRun a command with --help for details.\n\nEnvironment:\n  INSPIRE_USERNAME  Platform login ID\n  INSPIRE_PASSWORD  Platform password\n  INSPIRE_BASE_URL  Platform URL (default: ${DEFAULT_BASE_URL})\n  SIIMIT_CONFIG_DIR Override ~/.config/siimit`);
}

export function printGroupsHelp(): void {
  console.log(`Usage: siimit groups [--project PROJECT] [--json]\n\nShow GPU compute groups and live capacity for 分布式训练空间 only.\nUse --project (or -p) to show GPU sizes allowed for that project at its maximum priority.\n\nColumns:\n  GPU SIZES      Per-node GPU counts allowed for the selected project\n  FREE           Unused GPUs (never negative)\n  OVERCOMMITTED  Usage beyond reported total\n  PREEMPTIBLE    GPUs occupied by low-priority jobs\n  HIGH PRI       Capacity potentially available to high-priority jobs after preemption\n  USED           Currently used GPUs\n  TOTAL          Total GPUs reported by the platform`);
}

export function printProjectsHelp(): void {
  console.log("Usage: siimit projects [--json]\n\nList projects visible to the current user, including maximum priority and available point-balance fields reported by the platform.");
}

export function printListHelp(): void {
  console.log(`Usage: siimit ls [OPTIONS]\n\nList the current user's training jobs across accessible workspaces.\n\nOptions:\n  --workspace NAME    Exact workspace name or ws-... ID\n  --status STATUS     RUNNING, QUEUING, SUCCEEDED, FAILED, CANCELLED, or API value\n  --keyword TEXT      Server-side keyword filter\n  --limit NUMBER      Maximum rows after merging workspaces (default: 20)\n  --json              Print structured JSON\n  -h, --help          Show this help`);
}

export function printSubmitHelp(): void {
  console.log(`Usage: siimit submit [OPTIONS]\n\nRequired:\n  -n, --name NAME              Job name\n  -c, --command COMMAND        Inline start command\n      --command-file PATH      Absolute shared script path (instead of --command)\n  -p, --project PROJECT        Exact participating project name or project-... ID\n      --group GROUP            Exact GPU compute group name or lcg-... ID\n      --gpus NUMBER            GPUs per node\n      --image IMAGE            Private image name:version or full address\n\nOptional:\n      --nodes NUMBER           Number of nodes (default from config: 1)\n      --max-time HOURS         Maximum runtime\n      --shm-size GIB           Shared memory per instance\n      --log-file PATH          Absolute shared log path; supports {name}, {timestamp}, {node}, {rank}\n      --append-log             Append instead of overwriting the log file\n      --exclude-node NAME      Exclude a node; repeat as needed\n      --dry-run                Resolve and print payload without submitting\n\nLogging creates a wrapper script beside the log under .siimit/wrappers/.\nMulti-node logging requires {node} or {rank}. Total GPUs = --gpus × --nodes.`);
}
