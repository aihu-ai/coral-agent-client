// 鉴权：登录/注册经云端 REST，token 存 localStorage。
// 壳永不见 relay URL/key——只跟 CLOUD_API_BASE 说话。

const TOKEN_KEY = "coral_agent_token";
const USER_KEY = "coral_agent_user";

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() { return localStorage.getItem(USER_KEY); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

async function apiLogin(username, password) {
  const r = await fetch(`${window.CLOUD_API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    let detail = t("login_fail");
    try { detail = (await r.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  const body = await r.json();
  localStorage.setItem(TOKEN_KEY, body.token);
  localStorage.setItem(USER_KEY, body.username);
  return body;
}

async function apiSendCode(email) {
  const r = await fetch(`${window.CLOUD_API_BASE}/api/auth/send_code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!r.ok) {
    let detail = t("send_code_fail");
    try { detail = (await r.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return await r.json();
}

async function apiRegister(username, password, email, code) {
  const r = await fetch(`${window.CLOUD_API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email, code }),
  });
  if (!r.ok) {
    let detail = t("register_fail");
    try { detail = (await r.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return await r.json();
}

async function apiLogout() {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`${window.CLOUD_API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
  } catch (_) { /* best-effort */ }
}
