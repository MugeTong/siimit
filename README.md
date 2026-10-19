<div align="center">
<h1>Siimit</h1>

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)](https://bun.sh/)
[![license](https://img.shields.io/github/license/MugeTong/siimit)](LICENSE)
[![release](https://img.shields.io/github/v/release/MugeTong/siimit?color=green)](https://github.com/MugeTong/siimit/releases)
![downloads](https://img.shields.io/github/downloads/MugeTong/siimit/total)

</div>
Siimit 是面向 Inspire 分布式训练空间的 GPU 任务提交工具，支持资源查询、任务提交、状态管理和容器日志。

## 快速开始

从Releases中安装（目前只支持Linux amd64）:

```bash
curl -fsSL raw.githubusercontent.com/MugeTong/siimit/main/scripts/install.sh | bash
```

安装完成后，使用`siimit --help`查看更多功能。

## 常用命令

```bash
login       登陆并保存自动续期凭证
logout      清除登陆凭证
projects    查看项目、优先级、点券
images      查看个人镜像列表
groups      查看 GPU 计算分区及使用情况
submit      校验或提交 GPU 任务
list        查看任务列表
get         查看单个任务信息
stop        停止任务
delete      删除任务记录
```
