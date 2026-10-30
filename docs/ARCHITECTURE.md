# 工具架构

## 项目结构

```Text
├── scripts  # 安装脚本
│   ├── install-local.sh  # 本地安装脚本，用于开发者自我构建
│   └── install.sh  # 通过Github下载最新的Release进行安装
└── src
    ├── api  # Inspire的API接口
    ├── commands  # 终端CLI的工具命令行配置和具体功能实现
    ├── storage  # 凭证、配置、接口信息持久化管理
    └── utils  # 通用工具函数
```

## 依赖情况
```text
api <-- storage, utils

commands <-- storage, api, utils

storage <-- api
```

## 核心工作流程

### 登录

`command.login`通过`api.auth`产生登录链接和设备码，得到凭证后通过`storage.auth`进行保存。

### 命令运行

`command.otherCommand`运行时，首先向`storage`中索取必要信息，然后将请求参数整理好格式后，提交给`api`中对应的函数进行请求，API将处理好的结果返回，并交给`command.otherCommand`进行打印。

### 持久化存储

所有`storage`类均在内部实现凭证更新，仅向外部暴露`load()`，`save()`，`clear()`接口。每次加载时，全局的`storage`实例进行临时缓存，减少磁盘读取。
