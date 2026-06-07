// 壳 UI 多语言。默认英文，可切中文。
// 静态文本用 data-i18n / data-i18n-ph(placeholder) / data-i18n-title(title) 属性；
// JS 动态串走 t(key)。语言存 localStorage，启动时 applyI18n() 一次性替换。

const UI_LANG_KEY = "coral_agent_ui_lang";

const I18N = {
  en: {
    login_sub: "Self-evolving AI assistant · Desktop client",
    ph_username: "Username",
    ph_password: "Password",
    btn_login: "Log in",
    btn_show_register: "No account? Sign up",
    title_register: "Sign up",
    ph_password_min: "Password (min 6 chars)",
    ph_email: "Email",
    ph_code: "Email verification code",
    btn_send_code: "Send code",
    btn_register: "Sign up",
    btn_show_login: "Have an account? Log in",
    btn_pick_root: "📁 Authorize folder",
    title_pick_root: "Grant AI access to a local folder for reading/writing files",
    title_settings: "Configure your model API",
    btn_settings: "⚙️ Settings",
    btn_growth: "🌱 Growth",
    title_growth: "View your agent's self-evolution archive",
    btn_export: "⬇️ Export",
    title_export: "Export your data as a zip",
    btn_logout: "Log out",
    ph_chat: "Type a message, Enter to send…",
    btn_send: "Send",
    title_settings_full: "⚙️ Settings",
    settings_sub: "Configure your model API (base_url + key + model). Your key is stored only in your cloud account, never in the shell.",
    label_base_url: "API Base URL",
    label_api_key: "API Key",
    label_model: "Model",
    label_lang: "Reply language",
    embed_summary: "Embedding API (optional · for vector search)",
    embed_hint: "Optional. Configure a separate embedding endpoint to enable semantic vector search over your memory. Leave blank to skip.",
    label_embed_base_url: "Embedding Base URL",
    label_embed_api_key: "Embedding API Key",
    label_embed_model: "Embedding Model",
    btn_save: "Save",
    btn_back_chat: "Back to chat",
    err_need_user_pass: "Please enter username and password",
    err_need_email: "Please enter your email",
    err_need_code: "Please enter the verification code",
    register_success: "Registration successful, please log in",
    code_sent: "Verification code sent, please check your email",
    no_api_key_hint: "⚙️ No API key configured yet. Open the gear menu → Settings, fill in your API Base URL and Key, then save.",
    conn_on: "Connected",
    conn_off: "Disconnected",
    busy: "Still processing the previous turn, please wait…",
    connecting_retry: "Connecting to cloud, please resend…",
    error_prefix: "Error: ",
    unknown_error: "Unknown error",
    settings_read_fail: "Failed to read config",
    settings_save_fail: "Failed to save",
    key_configured: "Configured (leave blank to keep current key)",
    err_need_base_url: "Please enter the API Base URL",
    err_need_api_key: "Please enter the API Key",
    settings_saved: "Saved. You can chat now.",
    login_fail: "Login failed",
    register_fail: "Registration failed",
    send_code_fail: "Failed to send code",
    working: "Working…",
    worked_done: "Done · view steps",
    act_code: "Running code",
    act_result: "Result",
    act_status: "Status",
    act_retry: "Adjusting",
    act_file_list: "List folder",
    act_file_read: "Read file",
    act_file_write: "Write file",
    act_file_open: "Open file",
    act_file_ok: "done",
    session_expired: "Session expired, please log in again.",
    title_growth_full: "🌱 Growth archive",
    growth_loading: "Loading…",
    growth_fail: "Failed to load growth archive",
    growth_empty: "No evolution data yet. As your agent works and learns, its growth will show up here.",
    growth_lessons: "Lessons",
    growth_knowledge: "Knowledge notes",
    growth_rounds: "Evolution rounds",
    growth_goal: "Overall goal",
    growth_domains: "Capability domains",
    growth_recent: "Recent reflections",
    growth_timeline: "Evolution timeline",
    export_fail: "Export failed",
  },
  zh: {
    login_sub: "自进化 AI 助手 · 桌面客户端",
    ph_username: "用户名",
    ph_password: "密码",
    btn_login: "登录",
    btn_show_register: "没有账号？注册",
    title_register: "注册",
    ph_password_min: "密码（至少 6 位）",
    ph_email: "邮箱",
    ph_code: "邮箱验证码",
    btn_send_code: "发送验证码",
    btn_register: "注册",
    btn_show_login: "已有账号？返回登录",
    btn_pick_root: "📁 授权文件夹",
    title_pick_root: "授权 AI 访问本地文件夹，用于读写文件",
    title_settings: "配置你的模型 API",
    btn_settings: "⚙️ 设置",
    btn_growth: "🌱 成长",
    title_growth: "查看你的 AI 的自进化成长档案",
    btn_export: "⬇️ 导出",
    title_export: "把你的数据导出为 zip",
    btn_logout: "退出",
    ph_chat: "输入消息，回车发送…",
    btn_send: "发送",
    title_settings_full: "⚙️ 设置",
    settings_sub: "配置你的模型 API（base_url + 密钥 + 模型）。密钥只存在云端你的账户下，壳里不保留。",
    label_base_url: "API Base URL",
    label_api_key: "API Key",
    label_model: "模型",
    label_lang: "回复语言",
    embed_summary: "Embedding API（可选 · 用于向量检索）",
    embed_hint: "可选。配置独立的 embedding 端点可启用对记忆的语义向量检索。留空则跳过。",
    label_embed_base_url: "Embedding Base URL",
    label_embed_api_key: "Embedding API Key",
    label_embed_model: "Embedding 模型",
    btn_save: "保存",
    btn_back_chat: "返回对话",
    err_need_user_pass: "请输入用户名和密码",
    err_need_email: "请输入邮箱",
    err_need_code: "请输入邮箱验证码",
    register_success: "注册成功，请登录",
    code_sent: "验证码已发送，请查收邮件",
    no_api_key_hint: "⚙️ 还没配置 API Key。点右上角齿轮 → 设置，填入 API Base URL 和 Key 后保存即可对话。",
    conn_on: "已连接",
    conn_off: "未连接",
    busy: "上一轮还在处理中，请稍候…",
    connecting_retry: "正在连接云端，请重试发送…",
    error_prefix: "错误：",
    unknown_error: "未知错误",
    settings_read_fail: "读取配置失败",
    settings_save_fail: "保存失败",
    key_configured: "已配置（留空则不修改密钥）",
    err_need_base_url: "请填写 API Base URL",
    err_need_api_key: "请填写 API Key",
    settings_saved: "已保存，现在可以正常对话了。",
    login_fail: "登录失败",
    register_fail: "注册失败",
    send_code_fail: "验证码发送失败",
    working: "正在处理…",
    worked_done: "已完成 · 查看步骤",
    act_code: "执行代码",
    act_result: "结果",
    act_status: "状态",
    act_retry: "调整中",
    act_file_list: "列出目录",
    act_file_read: "读取文件",
    act_file_write: "写入文件",
    act_file_open: "打开文件",
    act_file_ok: "完成",
    session_expired: "登录已过期，请重新登录。",
    title_growth_full: "🌱 成长档案",
    growth_loading: "加载中…",
    growth_fail: "成长档案加载失败",
    growth_empty: "还没有进化数据。随着你的 AI 不断工作和学习，它的成长会展示在这里。",
    growth_lessons: "经验教训",
    growth_knowledge: "知识笔记",
    growth_rounds: "进化轮次",
    growth_goal: "总目标",
    growth_domains: "能力领域",
    growth_recent: "最近的反思",
    growth_timeline: "进化时间线",
    export_fail: "导出失败",
  },
};

function getUiLang() {
  let l = null;
  try { l = localStorage.getItem(UI_LANG_KEY); } catch (_) {}
  return (l && I18N[l]) ? l : "en";
}

function setUiLang(l) {
  if (!I18N[l]) l = "en";
  try { localStorage.setItem(UI_LANG_KEY, l); } catch (_) {}
  applyI18n();
}

function t(key) {
  const lang = getUiLang();
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

function applyI18n() {
  const lang = getUiLang();
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]"))
    el.textContent = t(el.getAttribute("data-i18n"));
  for (const el of document.querySelectorAll("[data-i18n-ph]"))
    el.placeholder = t(el.getAttribute("data-i18n-ph"));
  for (const el of document.querySelectorAll("[data-i18n-title]"))
    el.title = t(el.getAttribute("data-i18n-title"));
  for (const sel of document.querySelectorAll(".lang-select")) sel.value = lang;
}

window.addEventListener("DOMContentLoaded", () => {
  for (const sel of document.querySelectorAll(".lang-select"))
    sel.addEventListener("change", (e) => setUiLang(e.target.value));
  applyI18n();
});
