// 对话：连云端 WebSocket，发 auth → chat，渲染流式帧。
// file_request 帧转交 bridge.js（本地文件桥）。

let _ws = null;
let _authorizedRoot = null;     // 用户选定的授权本地目录（绝对路径）
let _currentAgentMsg = null;    // 当前流式 agent 气泡 DOM
let _reqCounter = 0;

function _msgEl(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text || "";
  document.getElementById("messages").appendChild(el);
  _scrollBottom();
  return el;
}

function _scrollBottom() {
  const m = document.getElementById("messages");
  m.scrollTop = m.scrollHeight;
}

function _setConn(on) {
  const dot = document.getElementById("conn-dot");
  dot.className = "dot " + (on ? "on" : "off");
  dot.title = on ? "已连接" : "未连接";
}

function setAuthorizedRoot(path) {
  _authorizedRoot = path || null;
  const label = document.getElementById("root-label");
  label.textContent = path ? path : "";
  label.title = path || "";
}

function connectWS() {
  const token = getToken();
  if (!token) return;
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

  _ws = new WebSocket(`${window.CLOUD_WS_BASE}/api/ws/chat`);

  _ws.onopen = () => {
    _ws.send(JSON.stringify({ type: "auth", token, root: _authorizedRoot }));
  };

  _ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }
    _handleFrame(msg);
  };

  _ws.onclose = () => { _setConn(false); };
  _ws.onerror = () => { _setConn(false); };
}

function _handleFrame(msg) {
  switch (msg.type) {
    case "ready":
      _setConn(true);
      break;
    case "token":
    case "result":
    case "status":
    case "code":
    case "retry":
      // 流式过程帧：追加到当前 agent 气泡。
      if (!_currentAgentMsg) _currentAgentMsg = _msgEl("agent", "");
      _currentAgentMsg.textContent += (msg.content ?? "");
      _scrollBottom();
      break;
    case "done":
      // 最终回复：用完整 reply 覆盖流式累积（权威结果）。
      if (!_currentAgentMsg) _currentAgentMsg = _msgEl("agent", "");
      if (typeof msg.reply === "string" && msg.reply) {
        _currentAgentMsg.textContent = msg.reply;
      }
      _currentAgentMsg = null;
      _setSending(false);
      break;
    case "busy":
      _msgEl("system", "上一轮还在处理中，请稍候…");
      _setSending(false);
      break;
    case "file_request":
      handleFileRequest(_ws, msg, _authorizedRoot);
      break;
    case "error":
      _msgEl("system", `错误：${msg.error || "未知错误"}`);
      _currentAgentMsg = null;
      _setSending(false);
      break;
    case "pong":
      break;
    default:
      break;
  }
}

function _setSending(sending) {
  document.getElementById("btn-send").disabled = sending;
  document.getElementById("chat-input").disabled = sending;
}

function sendChat() {
  const input = document.getElementById("chat-input");
  const task = input.value.trim();
  if (!task) return;
  if (!_ws || _ws.readyState !== WebSocket.OPEN) {
    connectWS();
    _msgEl("system", "正在连接云端，请重试发送…");
    return;
  }
  _msgEl("user", task);
  input.value = "";
  input.style.height = "auto";
  _currentAgentMsg = null;
  _setSending(true);
  const request_id = `r${++_reqCounter}_${Date.now()}`;
  _ws.send(JSON.stringify({ type: "chat", task, request_id }));
}

function closeWS() {
  if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; }
  _setConn(false);
}
