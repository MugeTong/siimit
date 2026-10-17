# siimit architecture

The CLI is organized around explicit dependency directions:

```text
index.ts
  -> commands
      -> domain services (submission, jobs, projects, groups, images)
          -> platform APIs (train, catalog)
              -> platform client (official qz transport)
      -> local infrastructure (config)
```

## Module boundaries

- `src/index.ts`: command routing only.
- `src/commands/`: command metadata, dispatch helpers, argument parsing, and orchestration.
- `src/shared/`: data-shape helpers with no platform or CLI dependencies.
- `src/domain/`: business operations, normalization, and terminal rendering for submissions, jobs, logs, projects, groups, and images.
- `src/platform/train.ts`: training actions, v2 response envelopes, and typed platform errors.
- `src/platform/catalog/`: focused platform lookups for workspaces, projects, quotas, and private images.
- `src/platform/client.ts`: a narrow transport adapter over the official `qz` client. `qz` owns device login, token refresh, Discovery and ETag caching.
- `src/config.ts`: non-secret application configuration persistence and legacy credential cleanup.

## Extension rules

1. A new CLI command is a plain `Command` object registered in `src/commands/index.ts`.
2. Endpoint paths and platform response envelopes stay in `src/platform/`; command and domain modules do not call platform endpoints directly.
3. Platform modules unwrap API responses; domain modules normalize them into stable CLI data.
4. Siimit persists only its business configuration. Authentication state belongs to the official `qz` client.
5. Shared helpers must not import CLI, storage, or platform modules.
