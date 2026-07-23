# Siimit 开发者指南

项目使用 Bun。安装依赖并运行检查：

```bash
bun install --frozen-lockfile
bun test
bun run typecheck
```

构建 Linux x86_64 二进制：

```bash
bun run build
```

生成压缩包和 SHA-256 文件：

```bash
bun run package
```

从当前源码构建并安装到 `~/.local/bin/siimit`：

```bash
bun run install-local
```

开发时可以直接执行：

```bash
bun dev --help
bun dev projects --wide
```

`bun dev` 每次只运行一条 CLI 命令，不会启动后台服务。

代码结构、依赖方向和扩展规则见 [ARCHITECTURE.md](ARCHITECTURE.md)。
