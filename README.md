# Coral Agent — Desktop Client

[![Release](https://img.shields.io/github/v/release/aihu-ai/coral-agent-client?color=11b3a3&label=download&logo=github)](https://github.com/aihu-ai/coral-agent-client/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/aihu-ai/coral-agent-client/total?color=11b3a3&label=total%20downloads)](https://github.com/aihu-ai/coral-agent-client/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-555)](https://github.com/aihu-ai/coral-agent-client/releases/latest)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-24C8DB?logo=tauri)](https://tauri.app)

**Coral Agent** is a *self-evolving* AI assistant. It learns from how you work, refines its own skills over time, and gets more useful the more you use it.

This repository is the **open-source desktop client** — a thin shell. The brain lives in the cloud; this app only handles three things:

1. **Sign in** to your Coral Agent account
2. **Chat** with your agent in real time
3. **Read and write files** inside a folder *you* authorize on your computer — with a confirmation dialog on every write

> 🪸 **Try it:** download a build below, sign in, and say hello. We'd genuinely love your feedback — what works, what's clunky, what you wish it could do. Email **406569772@qq.com** with ideas, bugs, or just to say hi. Every suggestion is read.

---

## ⬇️ Download

Grab the latest build for your platform — no account needed to download, just to sign in.

| Platform | Download |
|----------|----------|
| 🍎 **macOS** (Apple Silicon) | [`.dmg` — arm64](https://github.com/aihu-ai/coral-agent-client/releases/latest) |
| 🍎 **macOS** (Intel) | [`.dmg` — x64](https://github.com/aihu-ai/coral-agent-client/releases/latest) |
| 🪟 **Windows** | [`.exe` installer](https://github.com/aihu-ai/coral-agent-client/releases/latest) · [`.msi`](https://github.com/aihu-ai/coral-agent-client/releases/latest) |
| 🐧 **Linux** | [`.AppImage`](https://github.com/aihu-ai/coral-agent-client/releases/latest) · [`.deb`](https://github.com/aihu-ai/coral-agent-client/releases/latest) · [`.rpm`](https://github.com/aihu-ai/coral-agent-client/releases/latest) |

**[→ See all downloads on the Releases page](https://github.com/aihu-ai/coral-agent-client/releases/latest)**

> First builds are **unsigned** — see [Install notes](#install-unsigned-binary-notice) below to bypass the OS warning.

---

## Why a desktop app instead of a website?

A browser tab can't safely touch your local files. The desktop client can — within a folder you explicitly pick — so your agent can actually read your project, draft a document into it, or organize notes for you, instead of just talking about it.

All the intelligence stays in the cloud. **This shell contains zero core AI logic.** Its only configuration is the cloud address `CLOUD_API_BASE` (see `src/config.js`). If you reverse-engineer this app, all you'll find is "it sends requests to a server."

## Features

- **Account login / registration** — cloud authentication, token stored locally
- **Real-time streaming chat** over WebSocket
- **Local file bridge** — your cloud agent can `list / read / write` files inside the folder you authorize:
  - Paths are validated in the shell with `realpath` (canonicalization) — it **cannot** escape your chosen folder, even via `..` or symlinks
  - **Every write pops a confirmation dialog** — if you decline, nothing is written
  - The shell has **no code-execution capability** at all (code only ever runs in the cloud sandbox, never on your machine)

## Install (unsigned-binary notice)

The first builds are **unsigned**, so your OS will warn you. To allow it:

- **macOS:** right-click the app → **Open** → **Open** again; or go to **System Settings → Privacy & Security** and click **Open Anyway**. From the terminal: `xattr -dr com.apple.quarantine /Applications/Coral\ Agent.app`
- **Windows:** on the SmartScreen prompt, click **More info → Run anyway**.
- **Linux:** make the `.AppImage` executable with `chmod +x Coral-Agent_*.AppImage`, then run it.

## Privacy & security boundaries

- The shell only knows `CLOUD_API_BASE`. It **never** sees the upstream relay URL or any API key.
- File reads/writes are confined to the folder you select (Rust-side `canonicalize` + prefix assertion; absolute paths, `..` traversal, and symlink escapes are all rejected).
- **No execute/shell primitive** — the app cannot run arbitrary code on your computer.

## Build from source

You'll need [Rust](https://rustup.rs/) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
# install the Tauri CLI (v2)
cargo install tauri-cli --version "^2"

# run in dev mode (connects to the live cloud)
cargo tauri dev

# build for your current platform
cargo tauri build
```

The frontend is plain HTML/JS (`src/`, no build step). The file bridge is in `src-tauri/src/file_bridge.rs`. To point the app at a different backend, edit `CLOUD_API_BASE` in `src/config.js`.

## Releases

Pushing a `v*` tag triggers GitHub Actions to build for macOS (arm64/x64), Windows, and Linux, and publishes a draft Release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Feedback & contact

This is early and built in the open. If you try it, please tell us how it went — open an issue, or email **406569772@qq.com**. Suggestions shape what gets built next. 🪸
