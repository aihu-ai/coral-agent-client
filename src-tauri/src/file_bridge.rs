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

/// 写文本到授权目录下某文件——写入前弹确认框，用户拒绝则不写。
#[tauri::command]
pub fn local_write(app: AppHandle, root: String, path: String, content: String) -> BridgeResult {
    if path.trim().is_empty() {
        return BridgeResult::err("缺少文件路径");
    }
    let file = match resolve_within(&root, &path) {
        Ok(p) => p,
        Err(e) => return BridgeResult::err(e),
    };

    // 破坏性操作必须用户当面确认（阻塞式对话框）。
    let approved = app
        .dialog()
        .message(format!("允许 EvoAgent 写入本地文件？\n\n{}", file.display()))
        .title("确认写入")
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show();
    if !approved {
        return BridgeResult::err("用户拒绝写入");
    }

    match fs::write(&file, content) {
        Ok(_) => BridgeResult::ok(None),
        Err(e) => BridgeResult::err(format!("写文件失败: {e}")),
    }
}

/// 打开文件夹选择器，返回所选授权根目录的绝对路径（取消则 None）。
#[tauri::command]
pub fn pick_root(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|fp| fp.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}
