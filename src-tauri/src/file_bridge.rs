use std::fs;
use std::path::{Path, PathBuf};
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

/// 桥操作返回结构，序列化给前端，前端再封进 file_result 帧。
#[derive(Serialize)]
pub struct BridgeResult {
    pub ok: bool,
    pub content: Option<String>,
    pub error: Option<String>,
}

impl BridgeResult {
    fn ok(content: Option<String>) -> Self {
        Self { ok: true, content, error: None }
    }
    fn err(msg: impl Into<String>) -> Self {
        Self { ok: false, content: None, error: Some(msg.into()) }
    }
}

/// 安全核心：把相对路径 `rel` 解析到授权根 `root` 内，拒绝任何逃逸。
/// - 拒绝绝对路径。
/// - 已存在的路径：完整 canonicalize（解析 symlink/`..`）。
/// - 尚不存在的文件（写入新文件）：canonicalize 父目录后再拼文件名。
/// 最终断言解析结果仍以 `root` 的真实路径为前缀。
fn resolve_within(root: &str, rel: &str) -> Result<PathBuf, String> {
    let root_canon = fs::canonicalize(root)
        .map_err(|e| format!("授权根目录无效: {e}"))?;

    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err("不允许绝对路径".into());
    }

    let joined = root_canon.join(rel_path);
    let canon = match fs::canonicalize(&joined) {
        Ok(p) => p,
        Err(_) => {
            // 新文件：解析父目录，父目录必须已存在且在根内。
            let parent = joined.parent().ok_or("路径无父目录")?;
            let file = joined.file_name().ok_or("路径无文件名")?;
            let parent_canon = fs::canonicalize(parent)
                .map_err(|e| format!("父目录无效: {e}"))?;
            parent_canon.join(file)
        }
    };

    if !canon.starts_with(&root_canon) {
        return Err("路径越权（逃逸授权目录）".into());
    }
    Ok(canon)
}

/// 列出授权目录下某子目录的条目（目录名带尾随 `/`）。
#[tauri::command]
pub fn local_list(root: String, path: String) -> BridgeResult {
    let rel = if path.is_empty() { "." } else { path.as_str() };
    let dir = match resolve_within(&root, rel) {
        Ok(p) => p,
        Err(e) => return BridgeResult::err(e),
    };
    match fs::read_dir(&dir) {
        Ok(entries) => {
            let mut names: Vec<String> = Vec::new();
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let is_dir = entry.path().is_dir();
                names.push(if is_dir { format!("{name}/") } else { name });
            }
            names.sort();
            BridgeResult::ok(Some(names.join("\n")))
        }
        Err(e) => BridgeResult::err(format!("列目录失败: {e}")),
    }
}

/// 读取授权目录下某文件的文本内容。
#[tauri::command]
pub fn local_read(root: String, path: String) -> BridgeResult {
    if path.trim().is_empty() {
        return BridgeResult::err("缺少文件路径");
    }
    let file = match resolve_within(&root, &path) {
        Ok(p) => p,
        Err(e) => return BridgeResult::err(e),
    };
    match fs::read_to_string(&file) {
        Ok(s) => BridgeResult::ok(Some(s)),
        Err(e) => BridgeResult::err(format!("读文件失败: {e}")),
    }
}

/// 按字节读取授权目录下某文件并 base64 编码返回。
/// 用于二进制办公格式（xlsx/pdf/pptx/docx）——文本通道（read_to_string）会乱码/报错，
/// 这里返回原始字节的 base64，由云端解码 + 解析成文本。安全边界同 local_read。
#[tauri::command]
pub fn local_read_b64(root: String, path: String) -> BridgeResult {
    if path.trim().is_empty() {
        return BridgeResult::err("缺少文件路径");
    }
    let file = match resolve_within(&root, &path) {
        Ok(p) => p,
        Err(e) => return BridgeResult::err(e),
    };
    match fs::read(&file) {
        Ok(bytes) => {
            // 体积上限 25MB，防超大文件撑爆 WS/内存。
            if bytes.len() > 25 * 1024 * 1024 {
                return BridgeResult::err("文件过大（>25MB），无法读取");
            }
            BridgeResult::ok(Some(b64_encode(&bytes)))
        }
        Err(e) => BridgeResult::err(format!("读文件失败: {e}")),
    }
}

/// 标准 base64 编码（无外部依赖，避免引入新 crate）。
fn b64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 { T[((n >> 6) & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[(n & 63) as usize] as char } else { '=' });
    }
    out
}

/// 写文本到授权目录下某文件——写入前弹确认框，用户拒绝则不写。
/// async 命令：不在主线程跑，用回调式对话框（blocking_* 在 macOS 主线程会卡死/不弹）。
#[tauri::command]
pub async fn local_write(app: AppHandle, root: String, path: String, content: String) -> BridgeResult {
    if path.trim().is_empty() {
        return BridgeResult::err("缺少文件路径");
    }
    let file = match resolve_within(&root, &path) {
        Ok(p) => p,
        Err(e) => return BridgeResult::err(e),
    };

    // 破坏性操作必须用户当面确认。回调式对话框 + channel 桥回结果。
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .message(format!("允许 Coral Agent 写入本地文件？\n\n{}", file.display()))
        .title("确认写入")
        .buttons(MessageDialogButtons::OkCancel)
        .show(move |approved| {
            let _ = tx.send(approved);
        });
    let approved = rx.recv().unwrap_or(false);
    if !approved {
        return BridgeResult::err("用户拒绝写入");
    }

    match fs::write(&file, content) {
        Ok(_) => BridgeResult::ok(None),
        Err(e) => BridgeResult::err(format!("写文件失败: {e}")),
    }
}

/// 打开文件夹选择器，返回所选授权根目录的绝对路径（取消则 None）。
/// async 命令：不在主线程跑，用回调式选择器（blocking_pick_folder 在 macOS 主线程不弹窗）。
#[tauri::command]
pub async fn pick_root(app: AppHandle) -> Option<String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |fp| {
        let _ = tx.send(fp);
    });
    rx.recv()
        .ok()
        .flatten()
        .and_then(|fp| fp.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

/// 用系统默认程序打开授权目录下的文件（在用户屏幕上弹出，如 PDF→预览、xlsx→Excel）。
/// 这是壳相对纯网页的核心价值之一：云端大脑够不到 /Users，只能经此桥让本机打开文件。
/// 安全：路径必须解析在授权根内；打开前弹确认框（启动外部程序属可见副作用）。
/// async 命令：回调式对话框（blocking_* 在 macOS 主线程会卡死）。
#[tauri::command]
pub async fn local_open(app: AppHandle, root: String, path: String) -> BridgeResult {
    if path.trim().is_empty() {
        return BridgeResult::err("缺少文件路径");
    }
    let file = match resolve_within(&root, &path) {
        Ok(p) => p,
        Err(e) => return BridgeResult::err(e),
    };
    if !file.exists() {
        return BridgeResult::err("文件不存在");
    }

    // 启动外部程序属可见副作用，用户当面确认。
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .message(format!("允许 Coral Agent 用默认程序打开此文件？\n\n{}", file.display()))
        .title("确认打开文件")
        .buttons(MessageDialogButtons::OkCancel)
        .show(move |approved| {
            let _ = tx.send(approved);
        });
    if !rx.recv().unwrap_or(false) {
        return BridgeResult::err("用户拒绝打开");
    }

    // 跨平台用系统默认程序打开。不经 shell，参数为单一已解析路径，无注入面。
    let path_str = file.as_os_str();
    #[cfg(target_os = "macos")]
    let spawn = std::process::Command::new("open").arg(path_str).spawn();
    #[cfg(target_os = "windows")]
    let spawn = std::process::Command::new("cmd").args(["/C", "start", ""]).arg(path_str).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let spawn = std::process::Command::new("xdg-open").arg(path_str).spawn();

    match spawn {
        Ok(_) => BridgeResult::ok(Some(format!("已用默认程序打开 {}", file.display()))),
        Err(e) => BridgeResult::err(format!("打开失败: {e}")),
    }
}
