// 视图编排 + 事件绑定。启动时按是否有 token 决定进登录还是对话。

function show(viewId) {
  for (const v of document.querySelectorAll(".view")) v.classList.add("hidden");
  document.getElementById(viewId).classList.remove("hidden");
}

function enterChat() {
  document.getElementById("chat-user").textContent = getUser() || "";
  show("view-chat");
  connectWS();
}

function enterLogin() {
  closeWS();
  show("view-login");
}

window.addEventListener("DOMContentLoaded", () => {
  // ---- 登录 ----
  document.getElementById("btn-login").addEventListener("click", async () => {
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value;
    const err = document.getElementById("login-error");
    err.textContent = "";
    if (!u || !p) { err.textContent = "请输入用户名和密码"; return; }
    try {
      await apiLogin(u, p);
      enterChat();
    } catch (e) {
      err.textContent = e.message || String(e);
    }
  });

  // ---- 切换到注册 ----
  document.getElementById("btn-show-register").addEventListener("click", () => show("view-register"));
  document.getElementById("btn-show-login").addEventListener("click", () => show("view-login"));

  // ---- 注册 ----
  document.getElementById("btn-register").addEventListener("click", async () => {
    const u = document.getElementById("reg-username").value.trim();
    const p = document.getElementById("reg-password").value;
    const err = document.getElementById("reg-error");
    err.textContent = "";
    if (!u || !p) { err.textContent = "请输入用户名和密码"; return; }
    try {
      await apiRegister(u, p);
      // 注册不自动登录，回登录页让用户登录。
      show("view-login");
      document.getElementById("login-username").value = u;
      document.getElementById("login-error").textContent = "注册成功，请登录";
    } catch (e) {
      err.textContent = e.message || String(e);
    }
  });

  // ---- 退出 ----
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await apiLogout();
    clearToken();
    enterLogin();
  });

  // ---- 选择授权文件夹 ----
  document.getElementById("btn-pick-root").addEventListener("click", async () => {
    const path = await pickRoot();
    if (path) {
      setAuthorizedRoot(path);
      // 重连以把新的 root 登记到云端（auth 帧带 root）。
      closeWS();
      connectWS();
    }
  });

  // ---- 发送 ----
  document.getElementById("btn-send").addEventListener("click", sendChat);
  const input = document.getElementById("chat-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  });

  // ---- 启动路由 ----
  if (getToken()) enterChat();
  else enterLogin();
});
