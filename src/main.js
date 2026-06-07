// 视图编排 + 事件绑定。启动时按是否有 token 决定进登录还是对话。

function show(viewId) {
  for (const v of document.querySelectorAll(".view")) v.classList.add("hidden");
  document.getElementById(viewId).classList.remove("hidden");
}

function enterChat() {
  document.getElementById("chat-user").textContent = getUser() || "";
  show("view-chat");
  restoreAuthorizedRoot();  // 恢复上次选的授权文件夹（若有）
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
    if (!u || !p) { err.textContent = t("err_need_user_pass"); return; }
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

  // ---- 发送验证码 ----
  document.getElementById("btn-send-code").addEventListener("click", async () => {
    const email = document.getElementById("reg-email").value.trim();
    const err = document.getElementById("reg-error");
    const btn = document.getElementById("btn-send-code");
    err.textContent = "";
    if (!email) { err.textContent = t("err_need_email"); return; }
    btn.disabled = true;
    const orig = btn.textContent;
    try {
      const res = await apiSendCode(email);
      err.textContent = res.message || t("code_sent");
      // 60 秒倒计时，期间禁用按钮
      let left = 60;
      btn.textContent = `${left}s`;
      const timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          btn.textContent = orig;
        } else {
          btn.textContent = `${left}s`;
        }
      }, 1000);
    } catch (e) {
      err.textContent = e.message || String(e);
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  // ---- 注册 ----
  document.getElementById("btn-register").addEventListener("click", async () => {
    const u = document.getElementById("reg-username").value.trim();
    const p = document.getElementById("reg-password").value;
    const email = document.getElementById("reg-email").value.trim();
    const code = document.getElementById("reg-code").value.trim();
    const err = document.getElementById("reg-error");
    err.textContent = "";
    if (!u || !p) { err.textContent = t("err_need_user_pass"); return; }
    if (!email) { err.textContent = t("err_need_email"); return; }
    if (!code) { err.textContent = t("err_need_code"); return; }
    try {
      await apiRegister(u, p, email, code);
      // 注册不自动登录，回登录页让用户登录。
      show("view-login");
      document.getElementById("login-username").value = u;
      document.getElementById("login-error").textContent = t("register_success");
    } catch (e) {
      err.textContent = e.message || String(e);
    }
  });

  // ---- 退出 ----
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await apiLogout();
    clearToken();
    // 不清 localStorage 里的授权文件夹——同账户重新登录可恢复。
    // 只清内存变量 + label，让界面回到「未选择」状态。
    setAuthorizedRoot(null, /* persistClear */ false);
    enterLogin();
  });

  // ---- 设置 ----
  const menu = document.getElementById("topbar-menu");
  document.getElementById("btn-menu").addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click", () => menu.classList.add("hidden"));

  document.getElementById("btn-settings").addEventListener("click", () => { menu.classList.add("hidden"); openSettings(); });
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-close-settings").addEventListener("click", closeSettings);

  // ---- 成长档案 ----
  document.getElementById("btn-growth").addEventListener("click", () => { menu.classList.add("hidden"); openGrowth(); });
  document.getElementById("btn-close-growth").addEventListener("click", closeGrowth);

  // ---- 数据导出 ----
  document.getElementById("btn-export").addEventListener("click", exportData);

  // ---- 选择授权文件夹 ----
  document.getElementById("btn-pick-root").addEventListener("click", async () => {
    menu.classList.add("hidden");
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
