// 本地文件桥（壳侧）：云端大脑经 WS 发 file_request，壳调 Rust 命令做真正的读写，
// 回 file_result。安全边界在 Rust（file_bridge.rs）：每个路径 realpath 校验在授权根目录内，
// 写入前弹确认框。壳里没有 execute 原语——只能 list/read/write。

async function handleFileRequest(ws, msg, root) {
  const { request_id, op, path, content } = msg;

  // 没选授权目录→自动弹文件夹选择器，选完后继续；用户取消则拒绝。
  if (!root) {
    const picked = await pickRoot();
    if (!picked) {
      const denied = { ok: false, content: null, error: "未选择授权文件夹" };
      ws.send(JSON.stringify({ type: "file_result", request_id, ...denied }));
      return denied;
    }
    setAuthorizedRoot(picked);
    root = picked;
  }

  const invoke = window.__TAURI__.core.invoke;
  let res;
  try {
    // op 严格对应 Rust 命令名：local_list / local_read / local_write。
    res = await invoke(op, { root, path: path || "", content: content || "" });
  } catch (e) {
    res = { ok: false, content: null, error: String(e) };
  }

  const out = {
    ok: !!res.ok,
    content: res.content ?? null,
    error: res.error ?? null,
  };
  ws.send(JSON.stringify({ type: "file_result", request_id, ...out }));
  return out;
}

// 调 Rust 打开文件夹选择器，返回所选绝对路径（取消则 null）。
async function pickRoot() {
  try {
    return await window.__TAURI__.core.invoke("pick_root");
  } catch (_) {
    return null;
  }
}
