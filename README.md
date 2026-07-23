# Siimit

Siimit 是面向 Inspire 分布式训练空间的 GPU 任务提交命令行工具。它负责登录、查询项目与 GPU 分区、解析个人镜像、校验资源，并提交训练任务。

Siimit 是一次性命令行程序，不是常驻服务。`bun dev` 只会运行一条命令并退出；不带参数时显示帮助后正常结束。

## 安装

首个 GitHub Release 发布后，可以直接安装预编译的 Linux x86_64 二进制文件：

```bash
curl -fsSL https://raw.githubusercontent.com/MugeTong/siimit/refs/heads/main/scripts/install.sh | bash
```

安装脚本会下载最新 Release，校验 SHA-256 后安装到 `~/.local/bin/siimit`。

从源码开发或在首次发布前安装，需要先准备 Bun：

```bash
bun install
bun test
bun run typecheck
```

构建并安装到 `~/.local/bin/siimit`：

```bash
bun run install-local
```

该命令会自动构建、打包并安装，无需提前运行 `build` 或 `package`。如果只需要构建发布包，可以执行：

```bash
bun run build
bun run package
```

确认安装：

```bash
siimit version
siimit --help
```

## 第一次使用

### 1. 检查现有登录状态

机器上可能已经保存了可用的 Siimit Session 或登录凭证。先直接执行只读查询：

```bash
siimit projects --wide
```

如果查询成功，不需要再次登录。Siimit 会复用 `~/.config/siimit` 中已有的 Session；Session 过期时也会尝试使用已保存凭证自动续期。

只有命令提示没有 Session 或保存凭证时，才执行：

```bash
siimit login
```

登录完成后重新运行 `siimit projects --wide`。用户名和密码会保存在 `~/.config/siimit`，文件权限限制为当前用户可读写。

清除 Session：

```bash
siimit logout
```

同时删除保存的用户名和密码：

```bash
siimit logout --forget
```

### 2. 查询项目

```bash
siimit projects --wide
```

输出包括项目名称、可用优先级和点券余额。提交时可以使用完整项目名称或 `project-...` ID。

优先级有两档：

- `low` 对应平台值 `1`
- `high` 对应平台值 `4`

如果项目最高优先级小于 4，只允许 `low`；否则允许 `low` 和 `high`。

### 3. 查询 GPU 分区

```bash
siimit groups --project PROJECT --wide
```

指定项目后会额外显示该项目在每个分区允许申请的单节点 GPU 数量，例如 `1,2,4,8` 或仅 `8`。

资源列含义：

- `FREE`：当前未使用的 GPU
- `OVERCOMMITTED`：已使用量超过平台报告总量的部分
- `PREEMPTIBLE`：低优先级任务占用、可能被抢占的 GPU
- `HIGH PRI`：高优先级任务可能获得的容量
- `USED` / `TOTAL`：平台报告的使用量和总量

### 4. 查询个人镜像

```bash
siimit images --wide
```

提交时可以向 `--image` 传入 `NAME:VERSION` 或完整镜像地址。Siimit 只从当前用户可见的个人镜像目录中解析镜像。

## 提交任务

建议先执行 dry-run：

```bash
siimit submit \
  --name hello \
  --command 'nvidia-smi' \
  --project PROJECT \
  --group GROUP \
  --gpus 1 \
  --image IMAGE \
  --max-time 1 \
  --dry-run
```

确认输出中的项目、分区、镜像、GPU、CPU、内存、优先级和最长运行时间后，移除 `--dry-run` 正式提交。

交互终端会在正式提交前再次询问。自动化或非交互环境必须显式增加 `--yes`：

```bash
siimit submit ... --yes
```

### 必填参数

- `--name`：任务名称
- `--command` 或 `--command-file`：启动命令
- `--project`：完整项目名称或 ID
- `--group`：完整 GPU 分区名称或 ID
- `--gpus`：每个节点的 GPU 数
- `--image`：个人镜像名称与版本或完整地址
- `--max-time`：最长运行小时数，必须大于 0

### 常用可选参数

- `--priority low|high`：省略时使用项目允许的最高档位
- `--nodes NUMBER`：节点数，默认读取配置中的 `nodes`
- `--shm-size GIB`：每个节点的共享内存
- `--exclude-node NAME`：排除节点，可以重复指定
- `--json`：配合 `--dry-run` 输出完整平台 payload
- `--yes`：跳过正式提交前的交互确认，供自动化使用

单节点总 GPU 数等于 `--gpus`；多节点总 GPU 数等于 `--gpus × --nodes`。

短命令适合使用 `--command`。训练脚本或包含复杂 Shell 引号的命令应使用共享文件系统中的绝对路径：

```bash
siimit submit \
  --command-file /shared/project/train.sh \
  ...
```

## 查看和管理任务

```bash
siimit ls
siimit get JOB_ID
siimit logs JOB_ID
siimit logs JOB_ID --all
siimit logs JOB_ID --events
siimit cancel JOB_ID
siimit remove JOB_ID
```

查询命令默认输出终端表格：

- `--wide`：不截断名称和 ID
- `--json`：输出结构化 JSON
- `get --raw`：输出完整平台原始响应，仅建议排障时使用

`logs` 默认按时间正序展示前 200 条容器 stdout/stderr，并隐藏平台重复的等待心跳；使用 `--system` 可显示完整原始文本。使用 `--all` 可自动读取全部内容，也可用 `--limit NUMBER` 指定数量。增加 `--events` 可查看调度、镜像拉取和容器生命周期事件，也可以通过 `--order asc|desc` 指定顺序。`--json` 始终保留完整日志。当前不支持 `--follow`。

`remove` 是幂等操作；重复删除已不存在的任务不会让自动化脚本失败。

## 配置

查看配置路径：

```bash
siimit config path
```

查看解析后的配置：

```bash
siimit config
```

默认配置位于 `~/.config/siimit/config.json`：

```json
{
  "workspace": "分布式训练空间",
  "nodes": 1,
  "framework": "pytorch"
}
```

可以使用以下环境变量：

- `INSPIRE_USERNAME`
- `INSPIRE_PASSWORD`
- `INSPIRE_BASE_URL`
- `SIIMIT_CONFIG_DIR`

Siimit 遵循用户当前的代理环境变量，不会主动关闭或改写代理。

## 获取帮助

```bash
siimit --help
siimit help submit
siimit submit --help
```

开发结构和模块边界见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。
