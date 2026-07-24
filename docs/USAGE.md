# Siimit 使用指南

## 登录与凭证

先直接执行只读查询：

```bash
siimit projects --wide
```

如果查询成功，当前机器已有可复用的 Session 或登录凭证。如果命令提示缺少认证信息，再执行：

```bash
siimit login
```

Session 过期后，Siimit 会尝试使用保存在 `~/.config/siimit` 中的用户名和密码自动登录。配置目录权限为当前用户私有，凭证文件权限为 `0600`。

清除 Session：

```bash
siimit logout
```

同时删除 Session、用户名和密码：

```bash
siimit logout --forget
```

## 查询资源

### 项目

```bash
siimit projects --wide
```

输出包括项目名称、可用优先级和点券余额。提交时可以使用完整项目名称或 `project-...` ID。

- `low` 对应平台值 `1`
- `high` 对应平台值 `4`

如果项目最高优先级小于 4，只允许 `low`；否则允许 `low` 和 `high`。

### GPU 分区

```bash
siimit groups --project PROJECT --wide
```

指定项目后会显示每个分区允许申请的单节点 GPU 数，例如 `1,2,4,8` 或仅 `8`。

资源列：

- `FREE`：当前未使用的 GPU
- `OVERCOMMITTED`：已使用量超过平台报告总量的部分
- `LOW PRI USED`：当前被低优先级任务占用的 GPU
- `USED` / `TOTAL`：平台报告的使用量和总量

### 个人镜像

```bash
siimit images --wide
```

`IMAGE` 列是可以直接传给 `--image` 的 `NAME:VERSION`。也可以使用完整 `ADDRESS`。Siimit 只从当前用户可见的个人镜像目录中解析镜像。

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

确认项目、分区、镜像、GPU、CPU、内存、优先级和最长运行时间后，移除 `--dry-run` 正式提交。交互终端会再次询问；自动化或非交互环境必须增加 `--yes`。

必填参数：

- `--name`：任务名称
- `--command` 或 `--command-file`：启动命令
- `--project`：完整项目名称或 ID
- `--group`：完整 GPU 分区名称或 ID
- `--gpus`：每个节点的 GPU 数
- `--image`：个人镜像名称与版本或完整地址
- `--max-time`：最长运行小时数，必须大于 0

常用可选参数：

- `--priority low|high`：省略时使用项目允许的最高档位
- `--nodes NUMBER`：节点数，默认读取配置中的 `nodes`
- `--shm-size GIB`：每个节点的共享内存
- `--exclude-node NAME`：排除节点，可以重复指定
- `--json`：输出结构化结果；配合 `--dry-run` 时包含完整平台 payload
- `--yes`：跳过正式提交前的交互确认

单节点总 GPU 数等于 `--gpus`；多节点总 GPU 数等于 `--gpus × --nodes`。

训练脚本或复杂 Shell 命令可以使用共享文件系统中的绝对路径：

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

这些命令默认输出便于阅读的文本。自动化调用 `submit`、`cancel` 或 `remove` 时增加 `--json` 获取稳定的结构化结果。

查询选项：

- `--wide`：不截断名称和 ID
- `--json`：输出结构化 JSON
- `get --raw`：输出完整平台响应，仅建议排障时使用

日志选项：

- `--limit NUMBER`：指定数量，默认 200
- `--all`：自动分页读取全部日志
- `--order asc|desc`：指定顺序
- `--events`：查看调度、镜像拉取和容器生命周期事件
- `--scope instance|job|all`：选择实例级、任务级或全部事件，默认只显示实例事件
- `--system`：显示完整平台日志和事件，包括等待心跳与正常退出记账事件
- `--json`：输出完整、未过滤的结构化日志

当前不支持 `--follow`。`remove` 是幂等操作，重复删除已不存在的任务不会让自动化脚本失败。

## 配置

```bash
siimit config
siimit config path
```

默认配置位于 `~/.config/siimit/config.json`：

```json
{
  "workspace": "分布式训练空间",
  "nodes": 1,
  "framework": "pytorch"
}
```

支持以下环境变量：

- `INSPIRE_USERNAME`
- `INSPIRE_PASSWORD`
- `INSPIRE_BASE_URL`
- `SIIMIT_CONFIG_DIR`

Siimit 遵循当前代理环境变量，不会主动关闭或改写代理。

## 获取帮助

```bash
siimit --help
siimit help getting-started
siimit submit --help
siimit logs --help
```
