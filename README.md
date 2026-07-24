# Siimit

Siimit 是面向 Inspire 分布式训练空间的 GPU 任务提交工具，支持资源查询、任务提交、状态管理和容器日志。

## 安装

支持 Linux x86_64：

```bash
curl -fsSL https://raw.githubusercontent.com/MugeTong/siimit/main/scripts/install.sh | bash
```

安装完成后：

```bash
siimit version
siimit --help
```

## 快速开始

先查询可用项目。如果当前机器没有登录信息，Siimit 会提示运行 `siimit login`：

```bash
siimit projects --wide
siimit groups --project PROJECT --wide
siimit images --wide
```

先试运行，不会创建任务：

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

确认资源正确后移除 `--dry-run`，重新执行并确认提交。

查看任务：

```bash
siimit ls
siimit get JOB_ID
siimit logs JOB_ID
```

## 常用命令

```text
login       登录并保存自动续期凭证
logout      清除 Session；--forget 同时删除凭证
projects    查看项目、优先级和点券
groups      查看 GPU 分区、容量和允许的 GPU 数
images      查看个人镜像
submit      校验或提交 GPU 任务
ls          查看任务列表
get         查看单个任务
logs        查看容器输出或平台事件
cancel      停止任务
remove      删除任务记录
config      查看当前配置
```

完整说明：

- [使用指南](docs/USAGE.md)
- [开发者指南](docs/DEVELOPMENT.md)
- [代码架构](docs/ARCHITECTURE.md)
