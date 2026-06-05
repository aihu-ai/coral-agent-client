# EvoAgent 桌面客户端

EvoAgent 自进化 AI 助手的**桌面壳**。大脑在云端，本壳只负责：登录、对话、以及在你**授权的本地文件夹**内读写文件（每次写入都会弹确认框）。

> 本仓库不含任何核心 AI 逻辑——唯一的配置是云端地址 `CLOUD_API_BASE`（见 `src/config.js`）。所有对话、工具、数据都在云端处理。

## 功能

- 账号登录 / 注册（云端鉴权，token 本地保存）
- 实时流式对话（WebSocket）
- 本地文件桥：云端 AI 可在你选定的授权目录内 `列目录 / 读文件 / 写文件`
  - 路径在壳内经 `realpath` 校验，**绝不**逃逸授权目录
  - 每次写入都弹**确认框**，你拒绝就不写
  - 壳里**没有**任何代码执行能力（执行只在云端沙箱）

## 开发

需要 [Rust](https://rustup.rs/) 和 [Tauri 前置依赖](https://tauri.app/start/prerequisites/)。

```bash
# 安装 Tauri CLI（v2）
cargo install tauri-cli --version "^2"

# 开发模式（连真云端）
cargo tauri dev

# 打包当前平台
cargo tauri build
```

前端是纯 HTML/JS（`src/`，无构建步骤），Rust 文件桥在 `src-tauri/src/file_bridge.rs`。

### 改云端地址

编辑 `src/config.js` 里的 `CLOUD_API_BASE`。

## 发布

打 `v*` tag 触发 GitHub Actions，跨平台（macOS arm64/x64、Windows、Linux）构建并发布到 Releases（草稿）。

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 安装（未签名二进制提示）

首版二进制**未签名**，系统会拦截，请手动放行：

- **macOS**：右键点 App → 「打开」→ 再次「打开」；或在「系统设置 → 隐私与安全性」里点「仍要打开」。命令行可执行 `xattr -dr com.apple.quarantine /Applications/EvoAgent.app`。
- **Windows**：SmartScreen 弹窗点「更多信息」→「仍要运行」。
- **Linux**：给 `.AppImage` 加可执行权限 `chmod +x EvoAgent_*.AppImage` 后运行。

## 安全边界

- 壳只持有 `CLOUD_API_BASE`，永远看不到上游 relay 地址或 API key。
- 文件读写限定在你选择的授权目录内（Rust 侧 `canonicalize` + 前缀断言）。
- 没有 execute/shell 原语——壳无法在你机器上运行任意代码。
