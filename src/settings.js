// 设置：配置自己的模型 API（base_url + key + model），经云端 token 鉴权端点保存。
// 密钥只存在云端用户账户下，壳本地不持久化。

async function apiGetProviders() {
  const token = getToken();
  const r = await fetch(`${window.CLOUD_API_BASE}/api/providers`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!r.ok) {
    let detail = t("settings_read_fail");
    try { detail = (await r.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return await r.json();
}

async function apiSaveProviders(baseUrl, apiKey, model, lang, embed) {
  const token = getToken();
  const body = { base_url: baseUrl, api_key: apiKey, model, lang };
  if (embed) {
    body.embed_base_url = embed.baseUrl;
    body.embed_api_key = embed.apiKey;
    body.embed_model = embed.model;
  }
  const r = await fetch(`${window.CLOUD_API_BASE}/api/providers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = t("settings_save_fail");
    try { detail = (await r.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return await r.json();
}

async function openSettings() {
  const msg = document.getElementById("settings-msg");
  msg.textContent = "";
  msg.className = "error";
  const baseInput = document.getElementById("set-base-url");
  const keyInput = document.getElementById("set-api-key");
  const modelSel = document.getElementById("set-model");
  const langSel = document.getElementById("set-lang");
  const embBase = document.getElementById("set-embed-base-url");
  const embKey = document.getElementById("set-embed-api-key");
  const embModel = document.getElementById("set-embed-model");
  baseInput.value = "";
  keyInput.value = "";
  modelSel.innerHTML = "";
  langSel.innerHTML = "";
  embBase.value = "";
  embKey.value = "";
  embModel.value = "";
  show("view-settings");
  try {
    const cfg = await apiGetProviders();
    // 填充模型下拉
    for (const m of (cfg.models || [])) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name}（${m.id}）`;
      modelSel.appendChild(opt);
    }
    // 填充语言下拉
    for (const l of (cfg.langs || [])) {
      const opt = document.createElement("option");
      opt.value = l.code;
      opt.textContent = l.name;
      langSel.appendChild(opt);
    }
    langSel.value = cfg.lang || "en";
    baseInput.value = cfg.base_url || cfg.default_base_url || "";
    modelSel.value = cfg.model || cfg.default_model || "";
    if (modelSel.value !== (cfg.model || cfg.default_model)) {
      // 当前 model 不在预设列表里，追加一个选项保留它
      const wanted = cfg.model || cfg.default_model;
      if (wanted) {
        const opt = document.createElement("option");
        opt.value = wanted; opt.textContent = wanted;
        modelSel.appendChild(opt);
        modelSel.value = wanted;
      }
    }
    if (cfg.has_key) {
      keyInput.placeholder = t("key_configured");
      window._settingsHasKey = true;
    } else {
      window._settingsHasKey = false;
    }
    // 填充可选 embedding 配置（key 不回传，只报是否已配置）
    embBase.value = cfg.embed_base_url || "";
    embModel.value = cfg.embed_model || "";
    if (cfg.embed_has_key) {
      embKey.placeholder = t("key_configured");
      window._settingsHasEmbedKey = true;
    } else {
      window._settingsHasEmbedKey = false;
    }
    // 已配置过 embedding 时默认展开，方便用户看到/修改
    const embSection = document.getElementById("embed-section");
    if (embSection) embSection.open = !!(cfg.embed_base_url || cfg.embed_model);
  } catch (e) {
    msg.textContent = e.message || String(e);
  }
}

function closeSettings() {
  show("view-chat");
}

async function saveSettings() {
  const msg = document.getElementById("settings-msg");
  msg.textContent = "";
  msg.className = "error";
  const baseUrl = document.getElementById("set-base-url").value.trim();
  const apiKey = document.getElementById("set-api-key").value.trim();
  const model = document.getElementById("set-model").value;
  const lang = document.getElementById("set-lang").value || "en";
  const embBaseUrl = document.getElementById("set-embed-base-url").value.trim();
  const embApiKey = document.getElementById("set-embed-api-key").value.trim();
  const embModel = document.getElementById("set-embed-model").value.trim();
  if (!baseUrl) { msg.textContent = t("err_need_base_url"); return; }
  // 已配置过 key 时，留空表示沿用旧 key（云端不修改）；只有从未配置过才必填。
  if (!apiKey && !window._settingsHasKey) { msg.textContent = t("err_need_api_key"); return; }
  const btn = document.getElementById("btn-save-settings");
  btn.disabled = true;
  try {
    await apiSaveProviders(baseUrl, apiKey, model, lang, {
      baseUrl: embBaseUrl, apiKey: embApiKey, model: embModel,
    });
    msg.className = "ok";
    msg.textContent = t("settings_saved");
    // 重连 WS，让云端用新 key 重建的 agent 接管。
    closeWS();
    connectWS();
    setTimeout(closeSettings, 800);
  } catch (e) {
    msg.textContent = e.message || String(e);
  } finally {
    btn.disabled = false;
  }
}
