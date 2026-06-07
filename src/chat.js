// 对话：连云端 WebSocket，发 auth → chat，渲染流式帧。
// file_request 帧转交 bridge.js（本地文件桥）。

let _ws = null;
let _authorizedRoot = null;     // 用户选定的授权本地目录（绝对路径）
let _currentAgentMsg = null;    // 当前流式 agent 回复气泡 DOM（只装 token）
let _activity = null;           // 当前轮的「进度活动区」DOM（装 code/result/status）
let _reqCounter = 0;
let _sendQueue = [];            // 待发送任务队列（前一轮没出 done 前，新消息排队）
let _inFlight = false;          // 是否有一轮正在云端处理中
let _inFlightTask = null;       // 当前在途任务文本（busy 时重新入队用）

function _msgEl(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text || "";
  document.getElementById("messages").appendChild(el);
  _scrollBottom();
  return el;
}

// 进度活动区：像 Claude Code 那样实时显示 agent 在干什么（执行代码 / 拿到结果 /
// 状态提示）。每轮一个容器，顶部带「处理中」脉冲条；done 时收起为已完成态。
function _ensureActivity() {
  if (_activity) return _activity;
  const wrap = document.createElement("div");
  wrap.className = "activity running";
  const head = document.createElement("div");
  head.className = "activity-head";
  head.innerHTML = `<span class="spinner"></span><span class="activity-title">${t("working")}</span>`;
  const body = document.createElement("div");
  body.className = "activity-body";
  wrap.appendChild(head);
  wrap.appendChild(body);
  document.getElementById("messages").appendChild(wrap);
  _activity = wrap;
  _scrollBottom();
  return wrap;
}

// 往活动区追加一个步骤行。kind 决定图标/样式；code 类用等宽块。
function _activityStep(kind, text) {
  const wrap = _ensureActivity();
  const body = wrap.querySelector(".activity-body");
  const icons = { code: "🔧", result: "📤", status: "⏳", retry: "↻" };
  const labels = {
    code: t("act_code"), result: t("act_result"),
    status: t("act_status"), retry: t("act_retry"),
  };
  const step = document.createElement("div");
  step.className = `act-step act-${kind}`;
  const head = document.createElement("div");
  head.className = "act-step-head";
  head.textContent = `${icons[kind] || "•"} ${labels[kind] || kind}`;
  step.appendChild(head);
  const pre = document.createElement("pre");
  pre.className = "act-step-body";
  pre.textContent = (text ?? "").toString();
  step.appendChild(pre);
  body.appendChild(step);
  _scrollBottom();
}

// 文件桥步骤行：agent 在读/列/写你本地文件时，往活动区插一条带操作图标+文件名的行，
// 让这件事可见（否则文件桥往返屏幕零反馈）。返回该行 DOM，供 file_result 回来时
// 就地更新成 ✓/✗——「正在写入 → 已写入 CRM.html」是同一行的状态变化，不刷屏。
function _bridgeStep(op, path) {
  const wrap = _ensureActivity();
  const body = wrap.querySelector(".activity-body");
  const icons = { local_list: "📂", local_read: "📄", local_write: "💾", local_open: "📂" };
  const labels = {
    local_list: t("act_file_list"), local_read: t("act_file_read"),
    local_write: t("act_file_write"), local_open: t("act_file_open"),
  };
  const name = _basename(path) || (path || "");
  const step = document.createElement("div");
  step.className = "act-step act-bridge";
  const head = document.createElement("div");
  head.className = "act-step-head";
  head.textContent = `${icons[op] || "📁"} ${labels[op] || op} · ${name}`;
  step.appendChild(head);
  body.appendChild(step);
  _scrollBottom();
  return step;
}

// file_result 回来后更新桥步骤行：成功打 ✓，失败把错误显示出来（红色）。
function _bridgeStepDone(step, ok, error) {
  if (!step) return;
  const head = step.querySelector(".act-step-head");
  if (!head) return;
  if (ok) {
    head.textContent += `  ✓ ${t("act_file_ok")}`;
  } else {
    step.classList.add("act-bridge-err");
    head.textContent += `  ✗ ${error || ""}`;
  }
  _scrollBottom();
}

// 取路径 basename（兼容 / 和 \），避免长绝对路径撑爆活动区。
function _basename(p) {
  if (!p) return "";
  const s = String(p).replace(/[\\/]+$/, "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i >= 0 ? s.slice(i + 1) : s;
}

// 一轮结束：把活动区从「处理中」切到「已完成」（停脉冲、收起细节可点开）。
function _activityDone() {
  if (!_activity) return;
  _activity.classList.remove("running");
  _activity.classList.add("done");
  const title = _activity.querySelector(".activity-title");
  if (title) title.textContent = t("worked_done");
  const head = _activity.querySelector(".activity-head");
  if (head) {
    head.classList.add("clickable");
    head.onclick = () => _activity && _activity.classList.toggle("collapsed");
  }
  _activity.classList.add("collapsed");  // 默认收起，保留可展开
  _activity = null;
}

function _scrollBottom() {
  const m = document.getElementById("messages");
  m.scrollTop = m.scrollHeight;
}

function _setConn(on) {
  const dot = document.getElementById("conn-dot");
  dot.className = "dot " + (on ? "on" : "off");
  dot.title = on ? t("conn_on") : t("conn_off");
}

// 授权文件夹按账户存：key 带 username 后缀 → 重新登录同账户能恢复，
// 且绝不跨账户泄露。退出登录不清除（同账户再登可继续用）。
function _rootKey() {
  const u = (typeof getUser === "function" && getUser()) || "";
  return u ? `coral_agent_root::${u}` : "coral_agent_root";
}

function setAuthorizedRoot(path, persistClear = true) {
  _authorizedRoot = path || null;
  // 记住该账户上次选的文件夹，下次登录自动恢复（用户无需每次重选）。
  // persistClear=false 时只清内存/UI，不动 localStorage（退出登录时用）。
  try {
    if (path) localStorage.setItem(_rootKey(), path);
    else if (persistClear) localStorage.removeItem(_rootKey());
  } catch (_) {}
  const label = document.getElementById("root-label");
  label.textContent = path ? path : "";
  label.title = path || "";
}

function restoreAuthorizedRoot() {
  let path = null;
  try { path = localStorage.getItem(_rootKey()); } catch (_) {}
  if (path) {
    _authorizedRoot = path;
    const label = document.getElementById("root-label");
    label.textContent = path;
    label.title = path;
  } else {
    _authorizedRoot = null;
    const label = document.getElementById("root-label");
    if (label) { label.textContent = ""; label.title = ""; }
  }
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

  _ws.onclose = (ev) => {
    _setConn(false);
    // 4401 = 云端拒绝鉴权（token 失效/过期）→ 清 token 跳回登录页，别空转重连。
    if (ev && ev.code === 4401) {
      try { clearToken(); } catch (_) {}
      _msgEl("system", t("session_expired"));
      if (typeof enterLogin === "function") enterLogin();
      return;
    }
    // 其它意外断开（网络抖动/服务重启）→ 退避自动重连，连点会自己变绿。
    // 如果断连时有在途任务，重新入队——重连后 ready 帧会触发 _drainQueue 自动重发。
    if (_inFlight && _inFlightTask) {
      _sendQueue.unshift(_inFlightTask);
      _activityDone();
      _inFlight = false;
      _inFlightTask = null;
      _setSending(false);
    }
    if (getToken()) _scheduleReconnect();
  };
  _ws.onerror = () => { _setConn(false); };
}

let _reconnectTimer = null;
let _reconnectDelay = 1000;   // 退避起点 1s，封顶 15s
function _scheduleReconnect() {
  if (_reconnectTimer) return;
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    _reconnectDelay = Math.min(_reconnectDelay * 2, 15000);
    connectWS();
  }, _reconnectDelay);
}

function _handleFrame(msg) {
  switch (msg.type) {
    case "ready":
      _setConn(true);
      _reconnectDelay = 1000;  // 连上 → 重置退避
      if (msg.has_key === false) {
        _msgEl("system", t("no_api_key_hint") || "⚙️ No API key configured. Open the gear menu → Settings to add your key.");
      }
      _drainQueue();  // 连接就绪 → 若有排队任务立即开跑
      break;
    case "token":
      // 真正的回复文本：流式累积到 agent 气泡（与进度活动区分离）。
      if (!_currentAgentMsg) _currentAgentMsg = _msgEl("agent", "");
      _currentAgentMsg.textContent += (msg.content ?? "");
      _scrollBottom();
      break;
    case "code":
    case "result":
    case "status":
    case "retry":
      // 过程帧：进度活动区独立成行展示（不污染回复气泡），让用户看到 agent 在干活。
      _activityStep(msg.type, msg.content ?? "");
      break;
    case "done":
      // 最终回复：用完整 reply 覆盖流式累积（权威结果）。
      if (typeof msg.reply === "string" && msg.reply) {
        if (!_currentAgentMsg) _currentAgentMsg = _msgEl("agent", "");
        _currentAgentMsg.textContent = msg.reply;
      }
      _activityDone();
      _currentAgentMsg = null;
      _turnDone();
      break;
    case "busy":
      // 服务端锁被占：把当前任务重新推回队列头，2 秒后自动重试（等锁释放）。
      // 这样用户不需要手动重发，断连重连后自愈。
      if (_inFlightTask) _sendQueue.unshift(_inFlightTask);
      _activityDone();
      _inFlight = false;
      _inFlightTask = null;
      _setSending(false);
      setTimeout(_drainQueue, 2000);
      break;
    case "file_request": {
      // 文件桥：先在活动区插一条可见步骤行，再做真正的本地读写，
      // 完成后就地更新该行为 ✓/✗，让用户看到 agent 在碰哪些本地文件。
      const step = _bridgeStep(msg.op, msg.path);
      handleFileRequest(_ws, msg, _authorizedRoot).then((r) => {
        _bridgeStepDone(step, r && r.ok, r && r.error);
      });
      break;
    }
    case "error":
      _msgEl("system", `${t("error_prefix")}${msg.error || t("unknown_error")}`);
      _activityDone();
      _currentAgentMsg = null;
      _turnDone();
      break;
    case "pong":
      break;
    default:
      break;
  }
}

function _setSending(sending) {
  // 队列模式：Send 始终可用（用户可连发，消息排队）。这里只更新连接点的
  // 处理中视觉提示，不再禁用任何控件——避免「点不动」的困惑。
  const dot = document.getElementById("conn-dot");
  if (dot) dot.classList.toggle("busy", !!sending);
}

function sendChat() {
  const input = document.getElementById("chat-input");
  const task = input.value.trim();
  if (!task) return;
  if (!_ws || _ws.readyState !== WebSocket.OPEN) {
    connectWS();
    _msgEl("system", t("connecting_retry"));
    return;
  }
  // 立即上屏用户气泡 + 清空输入框（可连发）。任务进队列，逐条处理。
  _msgEl("user", task);
  input.value = "";
  input.style.height = "auto";
  _sendQueue.push(task);
  _drainQueue();
}

// 若当前无在途轮次，从队列取下一条真正发给云端；否则等 done/error 再发。
function _drainQueue() {
  if (_inFlight) return;
  if (!_sendQueue.length) return;
  if (!_ws || _ws.readyState !== WebSocket.OPEN) return;
  const task = _sendQueue.shift();
  _inFlight = true;
  _inFlightTask = task;
  _currentAgentMsg = null;
  _activity = null;
  _setSending(true);
  const request_id = `r${++_reqCounter}_${Date.now()}`;
  _ws.send(JSON.stringify({ type: "chat", task, request_id }));
}

function _turnDone() {
  _inFlight = false;
  _setSending(false);
  _drainQueue();  // 上一轮结束 → 自动发队列里的下一条
}

function closeWS() {
  if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; }
  _setConn(false);
}
