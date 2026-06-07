// 成长档案（自进化只读展示）+ 数据导出。
// 都走云端 token 鉴权端点；壳只渲染云端返回的脱敏摘要，不持有任何核心数据。

async function apiGetEvolution() {
  const token = getToken();
  const r = await fetch(`${window.CLOUD_API_BASE}/api/evolution`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!r.ok) {
    let detail = t("growth_fail");
    try { detail = (await r.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return await r.json();
}

function _esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s == null ? "" : s);
  return d.innerHTML;
}

function _renderGrowth(data) {
  const parts = [];
  // 概览统计
  parts.push('<div class="growth-stats">');
  parts.push(`<div class="stat"><span class="stat-num">${data.lesson_count || 0}</span><span class="stat-label">${_esc(t("growth_lessons"))}</span></div>`);
  parts.push(`<div class="stat"><span class="stat-num">${data.knowledge_count || 0}</span><span class="stat-label">${_esc(t("growth_knowledge"))}</span></div>`);
  parts.push(`<div class="stat"><span class="stat-num">${data.evolution_rounds || 0}</span><span class="stat-label">${_esc(t("growth_rounds"))}</span></div>`);
  parts.push('</div>');

  // 总目标
  if (data.goal) {
    parts.push(`<h3 class="growth-h">${_esc(t("growth_goal"))}</h3>`);
    parts.push(`<p class="growth-goal">${_esc(data.goal)}</p>`);
  }

  // 能力领域
  const domains = data.capability_domains || [];
  if (domains.length) {
    parts.push(`<h3 class="growth-h">${_esc(t("growth_domains"))}</h3>`);
    parts.push('<div class="growth-chips">');
    for (const d of domains) parts.push(`<span class="chip">${_esc(d)}</span>`);
    parts.push('</div>');
  }

  // 最近的反思（下次怎么做）
  const lessons = data.recent_lessons || [];
  if (lessons.length) {
    parts.push(`<h3 class="growth-h">${_esc(t("growth_recent"))}</h3>`);
    for (const l of lessons) {
      parts.push('<div class="growth-card">');
      if (l.title) parts.push(`<div class="growth-card-title">${_esc(l.title)}</div>`);
      if (l.next) parts.push(`<div class="growth-card-next">${_esc(l.next)}</div>`);
      parts.push('</div>');
    }
  }

  // 进化时间线
  const timeline = data.timeline || [];
  if (timeline.length) {
    parts.push(`<h3 class="growth-h">${_esc(t("growth_timeline"))}</h3>`);
    parts.push('<ul class="growth-timeline">');
    for (const e of timeline) {
      const icon = e.success ? "✅" : "🔄";
      const ts = _esc(e.timestamp || "");
      const tr = _esc(e.trigger || "");
      const text = _esc(e.summary || e.task || "");
      parts.push(`<li><span class="tl-icon">${icon}</span><span class="tl-ts">${ts}</span><span class="tl-text">${tr ? "[" + tr + "] " : ""}${text}</span></li>`);
    }
    parts.push('</ul>');
  }

  if (parts.length <= 4 && !data.goal && !domains.length && !lessons.length && !timeline.length) {
    return `<p class="sub">${_esc(t("growth_empty"))}</p>`;
  }
  return parts.join("");
}

async function openGrowth() {
  const body = document.getElementById("growth-body");
  body.innerHTML = `<p class="sub">${_esc(t("growth_loading"))}</p>`;
  show("view-growth");
  try {
    const data = await apiGetEvolution();
    body.innerHTML = _renderGrowth(data);
  } catch (e) {
    body.innerHTML = `<p class="error">${_esc(e.message || String(e))}</p>`;
  }
}

function closeGrowth() {
  show("view-chat");
}

async function exportData() {
  const btn = document.getElementById("btn-export");
  const token = getToken();
  const orig = btn.textContent;
  btn.disabled = true;
  try {
    const r = await fetch(`${window.CLOUD_API_BASE}/api/export`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!r.ok) {
      if (r.status === 401) { alert(t("session_expired")); return; }
      throw new Error(t("export_fail"));
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coral_agent_export_${getUser() || "me"}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}
