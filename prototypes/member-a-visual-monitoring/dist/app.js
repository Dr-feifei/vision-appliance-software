import { api } from "./mock-api.js";

const clientKey = () => `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "webm", "mkv"];

const main = document.querySelector("#main-content");
const title = document.querySelector("#page-title");
const shell = document.querySelector("#app-shell");
const dialog = document.querySelector("#model-dialog");
const modelForm = document.querySelector("#model-form");
const evidenceDialog = document.querySelector("#evidence-dialog");
const evidenceContent = document.querySelector("#evidence-content");

const templateCatalog = [
  { id: "intrusion", name: "区域入侵", icon: "区", text: "人员或车辆进入指定区域时报警", requirement: "有人进入指定区域就报警", needsRegion: true, needsDuration: false },
  { id: "dwell", name: "区域滞留", icon: "时", text: "人员在区域内停留达到指定时间", requirement: "有人在指定区域停留超过30秒就报警", needsRegion: true, needsDuration: true },
  { id: "fire", name: "火焰检测", icon: "火", text: "火焰持续出现时生成报警和证据", requirement: "检测到画面中持续出现火焰就报警", needsRegion: false, needsDuration: false },
  { id: "absence", name: "岗位缺员", icon: "岗", text: "岗位区域持续无人时发出提示", requirement: "岗位区域连续60秒无人就报警", needsRegion: true, needsDuration: true }
];

const state = {
  route: "task",
  modelTab: "small",
  models: [], llms: [], sources: [], dashboard: null,
  task: {
    step: 1, mode: "natural", sourceId: "", source: null, regionPoints: [],
    requirementText: "", scene: "open", target: "", rule: "", durationSec: null,
    execution: null, templateId: null, templateName: null, modelId: null, modelName: null,
    parsed: null, evaluation: null, result: null, analysis: null,
    clipStart: 0, clipEnd: null, idempotencyKey: clientKey()
  }
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const fmtDate = (value) => new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const sceneName = (scene) => ({ intrusion: "区域入侵", dwell: "区域滞留", fire: "火焰检测", absence: "岗位缺员", closed_eyes: "持续闭眼", open: "开放视觉" }[scene] || scene);
const usageName = (usage) => ({ requirement_parse: "需求解析", multimodal_analysis: "多模态分析" }[usage] || usage);
const fmtDuration = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(value / 60); const secs = value % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};
const fmtBytes = (bytes) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

function toast(message, type = "success") {
  const el = document.createElement("div"); el.className = `toast ${type}`; el.textContent = message;
  document.querySelector("#toast-region").append(el); setTimeout(() => el.remove(), 3300);
}

function setRoute(route) {
  state.route = route; shell.classList.remove("menu-open");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.route === route));
  title.textContent = ({ overview: "工作概览", task: "任务创建", models: "模型管理" })[route];
  render();
}

async function loadData() {
  [state.models, state.llms, state.sources, state.dashboard] = await Promise.all([api.listModels(), api.listLLMs(), api.listSources(), api.getDashboard()]);
}

function pageHead(eyebrow, heading, copy, action = "") {
  return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${heading}</h1><p>${copy}</p></div>${action}</div>`;
}

function renderOverview() {
  const d = state.dashboard || { models: "–", availableModels: "–", sources: "–", agents: "–" };
  main.innerHTML = `${pageHead("OPERATIONS", "工作概览", "查看成员 A 模块的能力状态与任务创建路径。", '<button class="button primary" data-route="task">＋ 创建监测任务</button>')}
    <section class="metric-grid">
      ${[["模型管理项",d.models,"个","◇"],["可用能力",d.availableModels,"项通过校验","✓"],["视频源",d.sources,"路","▣"],["已创建任务",d.agents,"个","⌁"]].map(([label,value,unit,icon])=>`<article class="card metric"><div class="metric-label"><span>${label}</span><span class="metric-icon">${icon}</span></div><strong>${value}</strong><small>${unit}</small></article>`).join("")}
    </section>
    <section class="overview-grid">
      <article class="card card-body"><div class="card-title"><div><h2>创建任务的标准路径</h2><p>固定模板和自然语言最终生成统一配置</p></div></div><div class="quick-flow">
        ${[[1,"选择视频","指定来源与区域"],[2,"描述需求","模板或自然语言"],[3,"验证能力","匹配模型与限制"],[4,"确认启动","创建版本与运行"]].map(([n,a,b])=>`<div class="flow-step"><span class="step-number">${n}</span><strong>${a}</strong><p>${b}</p></div>`).join("")}
      </div></article>
      <article class="card card-body"><div class="card-title"><div><h2>公共服务状态</h2><p>用于当前模块的 Mock 联调状态</p></div></div><div class="service-list">
        ${[["需求解析服务","本地 Qwen3-8B"],["能力评估服务","规则 + 多模态评估"],["智能体服务","Mock API v1"],["运行服务","Mock Scheduler"]].map(([a,b])=>`<div class="service-row"><span class="status-dot online"></span><div><strong>${a}</strong><small>${b}</small></div><span class="service-value">正常</span></div>`).join("")}
      </div></article>
    </section>`;
}

function wizardSteps() {
  const labels = ["选择视频与区域", "描述监测需求", "能力匹配与验证", "确认并启动"];
  return `<div class="wizard-steps">${labels.map((label,index)=>{const n=index+1; const cls=n===state.task.step?"active":n<state.task.step?"done":""; return `<div class="wizard-step ${cls}"><span class="step-number">${n<state.task.step?"✓":n}</span><span>${label}</span></div>`;}).join("")}</div>`;
}

function sourceCards() {
  return `<div class="source-grid">${state.sources.filter((source)=>!source.uploaded).map((source)=>`<button class="source-card ${source.id===state.task.sourceId?"selected":""} ${source.status!=="online"?"offline":""}" data-source="${source.id}" ${source.status!=="online"?"disabled":""}><div class="source-card-head"><strong>${escapeHtml(source.name)}</strong><span class="source-type">${source.type}</span></div><p><span class="status-dot ${source.status}"></span> ${source.status==="online"?"可用":"断流"} · ${source.resolution}</p></button>`).join("")}</div>`;
}

function uploadZone() {
  const upload = state.task.source?.uploaded ? state.task.source : null;
  return `<label class="upload-zone ${upload?"has-file":""}" for="video-upload">
    <input id="video-upload" type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mkv" hidden>
    <span class="upload-icon">${upload?"✓":"⇧"}</span>
    <span><strong>${upload?escapeHtml(upload.name):"上传本地录像进行分析"}</strong><small>${upload?`${fmtBytes(upload.fileSize)} · ${upload.resolution} · ${fmtDuration(upload.duration)}`:"支持 MP4、MOV、AVI、WebM、MKV，单个文件不超过 2 GB"}</small></span>
    <span class="button ghost small">${upload?"重新选择":"选择录像"}</span>
  </label>`;
}

function regionPolygon() {
  const points = state.task.regionPoints.map((p) => `${p.x},${p.y}`).join(" ");
  return `<svg class="region-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="监测区域绘制层">${points?`<polygon points="${points}" fill="rgba(53,103,232,.22)" stroke="#6f91ff" stroke-width=".8" stroke-dasharray="2 1"/>`:""}${state.task.regionPoints.map((p)=>`<circle cx="${p.x}" cy="${p.y}" r="1.4" fill="#fff" stroke="#3567e8" stroke-width=".7"/>`).join("")}</svg>`;
}

function taskLeftStep1() {
  const source = state.task.source;
  const preview = source?.objectUrl ? `<video class="uploaded-video" src="${escapeHtml(source.objectUrl)}" muted preload="metadata"></video>` : `<div class="camera-scene"><div class="scene-door"></div><div class="scene-person"></div><div class="scene-ground"></div></div>`;
  return `<div class="panel-head"><h2>视频源与分析范围</h2><span class="tag ${source?"green":"gray"}">${source?"已选择":"未选择"}</span></div><div class="panel-content">${uploadZone()}<div class="source-divider"><span>或选择已有视频源</span></div>${sourceCards()}
    <div class="video-frame" id="video-frame">${preview}<div class="video-label">${source?escapeHtml(source.name):"请选择视频源"}</div>${regionPolygon()}<div class="video-hint">${source?"点击画面添加区域顶点，至少需要 3 个点":"上传录像或选择在线来源后可绘制区域"}</div></div>
    <div class="region-tools"><p>已添加 ${state.task.regionPoints.length} 个顶点，坐标按原始画面归一化保存。</p><button class="button ghost small" id="clear-region" ${!state.task.regionPoints.length?"disabled":""}>清除区域</button></div>
    ${source?.type==="录像"?`<div class="time-range"><label class="field"><span>分析开始位置（秒）</span><input id="clip-start" type="number" min="0" max="${source.duration}" value="${state.task.clipStart}"></label><label class="field"><span>分析结束位置（秒）</span><input id="clip-end" type="number" min="1" max="${source.duration}" value="${state.task.clipEnd??source.duration}"></label></div><div class="clip-summary"><span>将分析 ${fmtDuration(state.task.clipStart)} 至 ${fmtDuration(state.task.clipEnd??source.duration)}</span><strong>约 ${fmtDuration((state.task.clipEnd??source.duration)-state.task.clipStart)}</strong></div>`:""}</div>`;
}

function taskRightStep1() {
  const source = state.task.source;
  return `<div class="panel-head"><h2>当前选择</h2></div><div class="panel-content"><div class="summary-list">
    <div class="summary-row"><span>视频源</span><strong>${source?escapeHtml(source.name):"尚未选择"}</strong></div><div class="summary-row"><span>来源类型</span><strong>${source?.uploaded?"本地上传录像":source?.type||"–"}</strong></div><div class="summary-row"><span>画面规格</span><strong>${source?`${source.resolution} / ${source.fps||"待检测"}${source.fps?" FPS":""}`:"–"}</strong></div>${source?.type==="录像"?`<div class="summary-row"><span>录像时长</span><strong>${fmtDuration(source.duration)}</strong></div><div class="summary-row"><span>分析片段</span><strong>${fmtDuration(state.task.clipStart)} – ${fmtDuration(state.task.clipEnd??source.duration)}</strong></div>`:""}<div class="summary-row"><span>监测区域</span><strong>${state.task.regionPoints.length>=3?`已绘制 ${state.task.regionPoints.length} 点区域`:"稍后可补充"}</strong></div>
  </div><div class="verdict ${source?"success":"warning"}" style="margin-top:18px"><span class="verdict-icon">${source?"✓":"!"}</span><div><strong>${source?(source.uploaded?"录像读取成功":"视频源可用"):"等待选择视频源"}</strong><p>${source?(source.uploaded?"可以选择分析片段、绘制区域并继续配置报警条件。":"预览服务已连接，可以继续描述监测需求。"):"上传录像或选择状态正常的视频源。"}</p></div></div></div>`;
}

function taskLeftStep2() {
  return `<div class="panel-head"><h2>监测需求</h2><span class="tag blue">支持两种创建方式</span></div><div class="panel-content"><div class="mode-switch"><button class="mode-button ${state.task.mode==="template"?"active":""}" data-mode="template">固定模板</button><button class="mode-button ${state.task.mode==="natural"?"active":""}" data-mode="natural">自然语言</button></div>
    ${state.task.mode==="template"?`<div class="template-list">${templateCatalog.map((tpl)=>`<button class="template-option ${state.task.scene===tpl.id?"selected":""}" data-template="${tpl.id}"><span class="template-symbol">${tpl.icon}</span><div><strong>${tpl.name}</strong><p>${tpl.text}</p></div></button>`).join("")}</div>`:`<div class="form-stack"><label class="field"><span>用日常语言描述监测目标</span><textarea id="requirement-text" rows="6" placeholder="例如：有人在北门区域停留超过30秒就报警">${escapeHtml(state.task.requirementText)}</textarea><small class="field-help">系统会提取对象、行为、区域和时间，优先匹配已有模板；无法匹配时再评估多模态模型。</small></label><button class="button primary" id="parse-requirement" ${!state.task.requirementText.trim()?"disabled":""}>解析需求</button></div>`}
    ${state.task.parsed?`<div class="parsed-card"><h4>系统理解结果 <span class="tag ${state.task.execution==="template"?"green":"blue"}">${state.task.execution==="template"?"匹配固定模板":"多模态候选"}</span></h4><div class="parsed-grid"><div class="parsed-item"><small>目标</small><strong>${escapeHtml(state.task.target)}</strong></div><div class="parsed-item"><small>规则</small><strong>${escapeHtml(state.task.rule)}</strong></div><div class="parsed-item"><small>持续时间</small><strong>${state.task.durationSec?`${state.task.durationSec} 秒`:"未明确"}</strong></div><div class="parsed-item"><small>执行能力</small><strong>${escapeHtml(state.task.templateName||state.task.modelName||"待评估")}</strong></div></div></div>`:""}
  </div>`;
}

function taskRightStep2() {
  return `<div class="panel-head"><h2>必要条件</h2></div><div class="panel-content"><div class="summary-list"><div class="summary-row"><span>视频来源</span><strong>${escapeHtml(state.task.source?.name||"未选择")}</strong></div><div class="summary-row"><span>区域</span><strong>${state.task.regionPoints.length>=3?"已绘制":"未绘制"}</strong></div><div class="summary-row"><span>需求描述</span><strong>${state.task.requirementText?"已填写":"未填写"}</strong></div><div class="summary-row"><span>解析状态</span><strong>${state.task.parsed?"已解析":"等待解析"}</strong></div></div>
    <div class="verdict ${state.task.parsed?"success":"warning"}" style="margin-top:18px"><span class="verdict-icon">${state.task.parsed?"✓":"!"}</span><div><strong>${state.task.parsed?"理解结果可核对":"请先完成需求描述"}</strong><p>${state.task.parsed?"进入下一步后将检查区域、时长、模型状态和证据条件。":"自然语言模式下，点击“解析需求”后才能继续。"}</p></div></div></div>`;
}

function evaluationView() {
  const e = state.task.evaluation;
  if (!e) return `<div class="empty-state"><div class="model-badge" style="margin:auto">?</div><strong>尚未执行能力评估</strong><p>检查模型版本、条件完整性和证据限制后才能启动。</p><button class="button primary" id="evaluate-task">开始验证</button></div>`;
  const cls = e.verdict==="executable"?"success":e.verdict==="unsupported"?"error":"warning";
  const label = { executable:"可以执行", clarification_required:"需要补充条件", unsupported:"暂不支持", insufficient_evidence:"证据不足" }[e.verdict];
  const items = [...e.missingConditions,...e.unsupportedConditions,...e.evidenceLimitations];
  return `<div class="verdict ${cls}"><span class="verdict-icon">${e.verdict==="executable"?"✓":"!"}</span><div><strong>${label}</strong><p>${escapeHtml(e.message)}</p></div></div>${items.length?`<ul class="limit-list">${items.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>`:""}`;
}

function taskLeftStep3() {
  const isTemplate = state.task.execution === "template";
  return `<div class="panel-head"><h2>能力匹配结果</h2><span class="tag ${isTemplate?"green":"blue"}">${isTemplate?"模板优先":"多模态兜底"}</span></div><div class="panel-content"><div class="card" style="box-shadow:none"><div class="card-body"><div class="model-name"><span class="model-badge">${isTemplate?"M":"AI"}</span><div><strong>${escapeHtml(state.task.modelName||"本地多模态模型")}</strong><small>${isTemplate?escapeHtml(state.task.templateName||""):"开放视觉分析 · 连续多帧判断"}</small></div></div><div class="summary-list" style="margin-top:15px"><div class="summary-row"><span>执行方式</span><strong>${isTemplate?"固定模型 + 规则模板":"本地多模态模型"}</strong></div><div class="summary-row"><span>监测目标</span><strong>${escapeHtml(state.task.target||"待识别")}</strong></div><div class="summary-row"><span>业务规则</span><strong>${escapeHtml(state.task.rule||"开放判断")}</strong></div><div class="summary-row"><span>配置版本</span><strong>${isTemplate?"模型 1.2.0 / 模板当前版":"Qwen2.5-VL 2.5"}</strong></div></div></div></div><div style="margin-top:15px">${evaluationView()}</div></div>`;
}

function taskRightStep3() {
  return `<div class="panel-head"><h2>最终业务参数</h2></div><div class="panel-content"><div class="form-stack"><label class="field"><span>监测对象</span><input value="${escapeHtml(state.task.target)}" id="target-input"></label><label class="field"><span>持续时间（秒）</span><input type="number" min="1" id="duration-input" value="${state.task.durationSec||""}" placeholder="需要持续时间的场景必须填写"></label><label class="field"><span>触发后动作</span><select><option>页面报警并保存证据</option><option>仅保存事件记录</option></select></label><small class="field-help">任何字段变化都会使当前可执行性结论失效，需要重新验证。</small></div></div>`;
}

function recordingAnalysisView() {
  const analysis = state.task.analysis;
  if (!analysis) return "";
  if (analysis.status === "running") return `<div class="analysis-card"><div class="analysis-head"><div><span class="tag blue">录像分析中</span><h3>正在逐帧执行监测任务</h3><p>${fmtDuration(state.task.clipStart)} – ${fmtDuration(state.task.clipEnd??state.task.source.duration)} · ${escapeHtml(state.task.modelName||"本地分析模型")}</p></div><strong>${analysis.progress}%</strong></div><div class="progress-track"><span style="width:${analysis.progress}%"></span></div><div class="analysis-stages"><span class="done">✓ 读取录像</span><span class="${analysis.progress>28?"done":""}">目标分析</span><span class="${analysis.progress>65?"done":""}">规则判断</span><span>保存证据</span></div></div>`;
  if (analysis.status === "failed") return `<div class="verdict error"><span class="verdict-icon">!</span><div><strong>录像分析失败</strong><p>${escapeHtml(analysis.message)}</p></div></div>`;
  const event = analysis.event;
  return `<div class="analysis-card complete"><div class="analysis-head"><div><span class="tag green">分析完成</span><h3>录像分析已完成</h3><p>已完成所选片段的逐帧检测、时序判断和证据保存。</p></div><strong>100%</strong></div><div class="progress-track"><span style="width:100%"></span></div></div><div class="alarm-card"><div class="alarm-icon">!</div><div class="alarm-main"><div><span class="tag red">已触发报警</span><h3>${escapeHtml(event.eventType)}</h3></div><p>录像位置 ${fmtDuration(event.occurredAtSec)} · 置信度 ${Math.round(event.confidence*100)}% · ${event.severity}等级</p><div class="evidence-row"><span>✓ 报警截图已保存</span><span>✓ 事件片段已保存</span><span>✓ 已关联运行版本</span></div></div><button class="button danger small" id="view-evidence" type="button">查看事件证据</button></div>`;
}

function openEvidenceDialog() {
  const event = state.task.analysis?.event;
  const source = state.task.source;
  if (!event) return toast("事件证据尚未生成，请稍后再试", "error");

  const clipStart = Math.max(0, Number(state.task.clipStart) || 0);
  const clipEnd = Math.max(clipStart, Number(state.task.clipEnd ?? source?.duration ?? event.occurredAtSec));
  const evidenceStart = Math.max(clipStart, event.occurredAtSec - 5);
  const evidenceEnd = Math.min(clipEnd, event.occurredAtSec + 5);
  const range = Math.max(1, clipEnd - clipStart);
  const marker = Math.min(100, Math.max(0, ((event.occurredAtSec - clipStart) / range) * 100));
  const video = source?.objectUrl
    ? `<div class="evidence-video-wrap"><video id="evidence-video" controls playsinline preload="metadata" src="${escapeHtml(source.objectUrl)}">当前浏览器不支持视频播放。</video><span class="evidence-alert-chip">! ${escapeHtml(event.eventType)} · ${fmtDuration(event.occurredAtSec)}</span></div>`
    : `<div class="evidence-unavailable"><strong>当前会话中没有可播放的原始录像</strong><p>事件引用仍已保留。接入真实证据服务后，可通过片段编号读取归档视频。</p></div>`;

  evidenceContent.innerHTML = `${video}
    <div class="evidence-timeline" aria-label="报警位置时间轴"><div class="timeline-labels"><span>分析起点 ${fmtDuration(clipStart)}</span><strong>报警 ${fmtDuration(event.occurredAtSec)}</strong><span>分析终点 ${fmtDuration(clipEnd)}</span></div><div class="timeline-track"><span class="timeline-seen" style="width:${marker}%"></span><i style="left:${marker}%" title="报警位置"></i></div><p>证据片段范围：${fmtDuration(evidenceStart)} – ${fmtDuration(evidenceEnd)}（最多保留报警前后各 5 秒）</p></div>
    <div class="evidence-meta-grid">
      <div><span>事件类型</span><strong>${escapeHtml(event.eventType)}</strong></div>
      <div><span>风险等级</span><strong>${escapeHtml(event.severity)}等级</strong></div>
      <div><span>模型置信度</span><strong>${Math.round(event.confidence * 100)}%</strong></div>
      <div><span>报警状态</span><strong>${event.alarmStatus === "triggered" ? "已触发" : escapeHtml(event.alarmStatus || "已触发")}</strong></div>
      <div><span>截图引用</span><code>${escapeHtml(event.snapshotRef || "已保存")}</code></div>
      <div><span>片段引用</span><code>${escapeHtml(event.clipRef || "已保存")}</code></div>
    </div>`;
  evidenceDialog.showModal();

  const player = document.querySelector("#evidence-video");
  if (player) {
    const seekToAlarm = () => {
      player.currentTime = Math.min(Math.max(0, event.occurredAtSec), Math.max(0, player.duration || event.occurredAtSec));
      player.pause();
    };
    if (player.readyState >= 1) seekToAlarm(); else player.addEventListener("loadedmetadata", seekToAlarm, { once: true });
  }
}

function taskStep4() {
  if (state.task.result) return `<section class="card success-panel"><div class="success-mark">✓</div><h2>${state.task.source?.type==="录像"?"录像分析任务已启动":"监测任务已启动"}</h2><p>${state.task.source?.type==="录像"?"系统正在分析所选录像片段；命中监测条件后会生成报警和证据。":"系统已创建不可变配置版本，并向运行服务提交幂等启动请求。"}</p><div class="id-grid"><div class="id-item"><span>AGENT ID</span><code>${state.task.result.agentId}</code></div><div class="id-item"><span>REVISION ID</span><code>${state.task.result.revisionId}</code></div><div class="id-item"><span>RUN ID</span><code>${state.task.result.runId}</code></div></div>${recordingAnalysisView()}<div style="display:flex;gap:9px;justify-content:center;margin-top:22px"><button class="button ghost" data-route="overview">返回概览</button><button class="button primary" id="new-task">继续创建任务</button></div></section>`;
  return `<section class="task-layout"><article class="card panel"><div class="panel-head"><h2>任务配置快照</h2><span class="tag green">验证通过</span></div><div class="panel-content"><div class="summary-list"><div class="summary-row"><span>视频源</span><strong>${escapeHtml(state.task.source?.name)}</strong></div><div class="summary-row"><span>监测需求</span><strong>${escapeHtml(state.task.requirementText)}</strong></div><div class="summary-row"><span>区域顶点</span><strong>${state.task.regionPoints.length?`${state.task.regionPoints.length} 个归一化坐标点`:"全画面"}</strong></div><div class="summary-row"><span>目标与规则</span><strong>${escapeHtml(state.task.target)} / ${escapeHtml(state.task.rule)}</strong></div><div class="summary-row"><span>执行方式</span><strong>${state.task.execution==="template"?`固定模板：${escapeHtml(state.task.templateName)}`:`多模态：${escapeHtml(state.task.modelName)}`}</strong></div><div class="summary-row"><span>持续时间</span><strong>${state.task.durationSec?`${state.task.durationSec} 秒`:"即时判断"}</strong></div></div></div></article><aside class="card panel"><div class="panel-head"><h2>启动确认</h2></div><div class="panel-content"><div class="verdict success"><span class="verdict-icon">✓</span><div><strong>配置已通过验证</strong><p>启动后将固定当前模型、模板和业务条件版本。后续修改会创建新的 Revision。</p></div></div><ul class="limit-list">${state.task.evaluation.evidenceLimitations.map((x)=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><button class="button primary" id="start-task" style="width:100%;margin-top:20px">确认并启动任务</button></div></aside></section>`;
}

function renderTask() {
  const step = state.task.step;
  const canNext = step===1?!!state.task.sourceId:step===2?!!state.task.parsed:step===3?state.task.evaluation?.verdict==="executable":false;
  main.innerHTML = `${pageHead("CREATE TASK", "创建监测任务", "从视频来源和业务需求生成可执行、可追溯的监测配置。")}${wizardSteps()}${step===4?taskStep4():`<section class="task-layout"><article class="card panel">${step===1?taskLeftStep1():step===2?taskLeftStep2():taskLeftStep3()}</article><aside class="card panel">${step===1?taskRightStep1():step===2?taskRightStep2():taskRightStep3()}</aside></section><div class="wizard-actions"><span class="action-note">配置会保存为草稿；只有验证通过后才能启动。</span><div><button class="button ghost" id="prev-step" ${step===1?"disabled":""}>上一步</button><button class="button primary" id="next-step" ${!canNext?"disabled":""}>${step===3?"进入确认":"下一步"}</button></div></div>`}`;
}

function modelTable(models) {
  if (!models.length) return `<div class="empty-state"><strong>没有匹配的模型</strong><p>尝试修改搜索条件，或新增一个模型与模板。</p></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>模型</th><th>绑定模板</th><th>版本 / 接口</th><th>校验状态</th><th>任务引用</th><th>最近更新</th><th>操作</th></tr></thead><tbody>${models.map((m)=>`<tr><td><div class="model-name"><span class="model-badge">M</span><div><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.fileName)}</small></div></div></td><td><strong>${escapeHtml(m.templateName)}</strong><span class="cell-sub">${sceneName(m.scene)} · ${m.targets.join(" / ")}</span></td><td><strong>v${escapeHtml(m.version)}</strong><span class="cell-sub">${escapeHtml(m.runtimeType)}</span></td><td><span class="tag ${m.validation==="passed"?"green":"amber"}">${m.validation==="passed"?"✓ 已通过":"… 校验中"}</span></td><td>${m.references} 个任务</td><td>${fmtDate(m.updatedAt)}</td><td><div class="row-actions"><button class="button ghost small" data-edit-model="${m.id}">编辑</button><button class="button danger small" data-delete-model="${m.id}">删除</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function llmCards() {
  return `<div class="llm-grid">${state.llms.map((m)=>`<article class="card llm-card"><div class="llm-head"><div class="llm-logo">${m.type==="language"?"LLM":"VLM"}</div><span class="tag ${m.health==="healthy"?"green":"amber"}">${m.health==="healthy"?"服务正常":"性能降级"}</span></div><h3>${escapeHtml(m.name)}</h3><p>版本 ${m.version} · ${escapeHtml(m.location)}</p><div class="llm-meta"><div><span>模型类型</span><strong>${m.type==="language"?"语言模型":"多模态模型"}</strong></div><div><span>支持输入</span><strong>${m.inputs.join(" / ")}</strong></div></div><div class="usage-block"><small>当前用途</small><div class="usage-tags">${m.usages.length?m.usages.map((u)=>`<span class="tag blue">${usageName(u)}</span>`).join(""):'<span class="tag gray">备用模型</span>'}</div></div><div style="display:flex;gap:7px;margin-top:13px">${m.type==="language"?`<button class="button ghost small" data-select-llm="${m.id}" data-usage="requirement_parse" ${m.health!=="healthy"||m.usages.includes("requirement_parse")?"disabled":""}>设为需求解析</button>`:`<button class="button ghost small" data-select-llm="${m.id}" data-usage="multimodal_analysis" ${m.health!=="healthy"||m.usages.includes("multimodal_analysis")?"disabled":""}>设为多模态分析</button>`}</div></article>`).join("")}</div>`;
}

function renderModels(filter = "") {
  const models = state.models.filter((m)=>!filter || `${m.name}${m.templateName}${sceneName(m.scene)}`.toLowerCase().includes(filter.toLowerCase()));
  main.innerHTML = `${pageHead("MODEL CENTER", "模型管理", "维护小模型与模板的一一绑定，并选择本地大模型用途。", '<button class="button primary" id="add-model">＋ 新增模型与模板</button>')}<div class="tabs"><button class="tab ${state.modelTab==="small"?"active":""}" data-model-tab="small">小模型与模板</button><button class="tab ${state.modelTab==="llm"?"active":""}" data-model-tab="llm">本地大模型</button></div>${state.modelTab==="small"?`<section class="card"><div class="card-body"><div class="toolbar"><div class="toolbar-left"><label class="search-box"><input id="model-search" placeholder="搜索模型、模板或场景" value="${escapeHtml(filter)}"></label><select id="model-filter"><option>全部状态</option><option>校验通过</option><option>校验中</option></select></div><span class="tag gray">共 ${models.length} 项</span></div>${modelTable(models)}</div></section>`:`${llmCards()}<div class="verdict warning" style="margin-top:16px"><span class="verdict-icon">!</span><div><strong>切换仅影响后续请求</strong><p>正在执行的请求与运行任务继续使用其配置快照中记录的模型版本。</p></div></div>`}`;
  const search = document.querySelector("#model-search"); if (search) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
}

function render() {
  if (state.route === "overview") renderOverview();
  if (state.route === "task") renderTask();
  if (state.route === "models") renderModels();
}

function resetTask() {
  if (state.task.source?.uploaded && state.task.source.objectUrl) URL.revokeObjectURL(state.task.source.objectUrl);
  state.sources = state.sources.filter((source) => !source.uploaded);
  state.task = { step:1, mode:"natural", sourceId:"", source:null, regionPoints:[], requirementText:"", scene:"open", target:"", rule:"", durationSec:null, execution:null, templateId:null, templateName:null, modelId:null, modelName:null, parsed:null, evaluation:null, result:null, analysis:null, clipStart:0, clipEnd:null, idempotencyKey:clientKey() };
}

async function readUploadedVideo(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!VIDEO_EXTENSIONS.includes(extension || "")) throw new Error("不支持该录像格式，请选择 MP4、MOV、AVI、WebM 或 MKV");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("录像超过 2 GB，请截取片段后重新上传");
  if (!file.size) throw new Error("录像文件为空，无法读取");

  const objectUrl = URL.createObjectURL(file);
  const metadata = await new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const cleanup = () => { video.removeAttribute("src"); video.load(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("读取录像超时，请检查文件编码")); }, 8000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const value = { duration: Number.isFinite(video.duration) ? Math.round(video.duration) : 0, width: video.videoWidth, height: video.videoHeight };
      cleanup(); resolve(value);
    };
    video.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error("录像无法读取或编码不受浏览器支持")); };
    video.src = objectUrl;
  }).catch((error) => { URL.revokeObjectURL(objectUrl); throw error; });

  if (!metadata.duration) { URL.revokeObjectURL(objectUrl); throw new Error("无法获取录像时长，请检查文件是否完整"); }
  if (state.task.source?.uploaded && state.task.source.objectUrl) URL.revokeObjectURL(state.task.source.objectUrl);
  const source = {
    id: `upload_${Date.now().toString(36)}`, name: file.name, type: "录像", status: "online", uploaded: true,
    objectUrl, fileSize: file.size, resolution: metadata.width && metadata.height ? `${metadata.width} × ${metadata.height}` : "分辨率未知",
    fps: null, duration: metadata.duration
  };
  state.sources = [source, ...state.sources.filter((item) => !item.uploaded)];
  Object.assign(state.task, { sourceId: source.id, source, regionPoints: [], clipStart: 0, clipEnd: source.duration, evaluation: null, result: null, analysis: null });
  renderTask(); toast("录像读取成功，可以选择分析片段");
}

async function runRecordingAnalysis() {
  state.task.analysis = { status: "running", progress: 6 };
  renderTask();
  const timer = setInterval(() => {
    if (!state.task.analysis || state.task.analysis.status !== "running") return clearInterval(timer);
    state.task.analysis.progress = Math.min(92, state.task.analysis.progress + Math.ceil(Math.random() * 10));
    if (state.route === "task" && state.task.step === 4) renderTask();
  }, 360);
  try {
    const event = await api.analyzeRecording(state.task);
    clearInterval(timer); state.task.analysis = { status: "completed", progress: 100, event };
    toast(`录像分析完成：${event.eventType}，已触发报警`, "error"); renderTask();
  } catch (error) {
    clearInterval(timer); state.task.analysis = { status: "failed", progress: 0, message: error.message };
    toast(error.message, "error"); renderTask();
  }
}

function applyParsed(parsed) {
  Object.assign(state.task, parsed, { parsed, evaluation: null });
}

async function parseTask() {
  const button = document.querySelector("#parse-requirement"); if (button) { button.disabled = true; button.textContent = "正在理解…"; }
  try { applyParsed(await api.parseRequirement(state.task.requirementText)); toast(state.task.execution==="template"?"已匹配现有模板":"未匹配模板，已转入多模态能力评估"); renderTask(); }
  catch (error) { toast(error.message, "error"); renderTask(); }
}

function openModelDialog(model = null) {
  modelForm.reset(); document.querySelector("#dialog-title").textContent = model ? "编辑模型与模板" : "新增模型与模板";
  if (model) Object.entries({ id:model.id, name:model.name, version:model.version, runtimeType:model.runtimeType, fileName:model.fileName, templateName:model.templateName, scene:model.scene, targets:model.targets.join(", "), limitations:model.limitations }).forEach(([key,value])=>{ if(modelForm.elements[key]) modelForm.elements[key].value=value; });
  dialog.showModal();
}

main.addEventListener("input", (event) => {
  if (event.target.id === "requirement-text") { state.task.requirementText = event.target.value; state.task.parsed = null; state.task.evaluation = null; const button=document.querySelector("#parse-requirement"); if(button) button.disabled=!event.target.value.trim(); }
  if (event.target.id === "target-input") { state.task.target = event.target.value; state.task.evaluation = null; const next=document.querySelector("#next-step"); if(next) next.disabled=true; }
  if (event.target.id === "duration-input") { state.task.durationSec = Number(event.target.value)||null; state.task.evaluation = null; const next=document.querySelector("#next-step"); if(next) next.disabled=true; }
  if (event.target.id === "clip-start") { state.task.clipStart = Math.max(0, Number(event.target.value)||0); state.task.evaluation = null; }
  if (event.target.id === "clip-end") { state.task.clipEnd = Number(event.target.value)||null; state.task.evaluation = null; }
  if (event.target.id === "model-search") renderModels(event.target.value);
});

main.addEventListener("change", async (event) => {
  if (event.target.id === "video-upload") {
    const file = event.target.files?.[0]; if (!file) return;
    const zone = event.target.closest(".upload-zone"); zone?.classList.add("loading");
    try { await readUploadedVideo(file); }
    catch (error) { toast(error.message, "error"); renderTask(); }
  }
  if (event.target.id === "clip-start" || event.target.id === "clip-end") renderTask();
});

main.addEventListener("click", async (event) => {
  const route = event.target.closest("[data-route]")?.dataset.route; if (route) return setRoute(route);
  const sourceId = event.target.closest("[data-source]")?.dataset.source; if (sourceId) { const source=state.sources.find((s)=>s.id===sourceId); state.task.sourceId=sourceId; state.task.source=source; state.task.clipStart=0; state.task.clipEnd=source?.type==="录像"?source.duration:null; state.task.evaluation=null; return renderTask(); }
  const mode = event.target.closest("[data-mode]")?.dataset.mode; if (mode) { state.task.mode=mode; state.task.parsed=null; state.task.evaluation=null; return renderTask(); }
  const templateId = event.target.closest("[data-template]")?.dataset.template; if (templateId) { const tpl=templateCatalog.find((t)=>t.id===templateId); state.task.requirementText=tpl.requirement; state.task.scene=tpl.id; state.task.durationSec=tpl.needsDuration?(tpl.id==="absence"?60:30):null; applyParsed(await api.parseRequirement(tpl.requirement)); return renderTask(); }
  if (event.target.closest("#parse-requirement")) return parseTask();
  if (event.target.closest("#clear-region")) { state.task.regionPoints=[]; state.task.evaluation=null; return renderTask(); }
  if (event.target.closest("#video-frame") && state.task.source) { const frame=event.target.closest("#video-frame"); const rect=frame.getBoundingClientRect(); state.task.regionPoints.push({x:+(((event.clientX-rect.left)/rect.width)*100).toFixed(2),y:+(((event.clientY-rect.top)/rect.height)*100).toFixed(2)}); state.task.evaluation=null; return renderTask(); }
  if (event.target.closest("#prev-step")) { state.task.step=Math.max(1,state.task.step-1); return renderTask(); }
  if (event.target.closest("#next-step")) { if(state.task.step===3 && state.task.evaluation?.verdict!=="executable"){toast("配置已修改，请重新验证","error");return renderTask();} state.task.step=Math.min(4,state.task.step+1); return renderTask(); }
  if (event.target.closest("#evaluate-task")) { const button=event.target.closest("#evaluate-task"); button.disabled=true; button.textContent="正在验证…"; state.task.evaluation=await api.evaluateTask(state.task); renderTask(); return; }
  if (event.target.closest("#start-task")) { const button=event.target.closest("#start-task"); button.disabled=true; button.textContent=state.task.source?.type==="录像"?"正在提交录像分析…":"正在创建并启动…"; try { state.task.result=await api.createAndStart(state.task,state.task.idempotencyKey); state.dashboard=await api.getDashboard(); toast(state.task.source?.type==="录像"?"录像分析任务已提交":"任务已启动"); renderTask(); if(state.task.source?.type==="录像") runRecordingAnalysis(); } catch(error){ toast(error.message,"error"); renderTask(); } return; }
  if (event.target.closest("#view-evidence")) return openEvidenceDialog();
  if (event.target.closest("#new-task")) { resetTask(); return renderTask(); }
  if (event.target.closest("#add-model")) return openModelDialog();
  const tab=event.target.closest("[data-model-tab]")?.dataset.modelTab; if(tab){state.modelTab=tab;return renderModels();}
  const editId=event.target.closest("[data-edit-model]")?.dataset.editModel; if(editId) return openModelDialog(state.models.find((m)=>m.id===editId));
  const deleteId=event.target.closest("[data-delete-model]")?.dataset.deleteModel; if(deleteId){if(!confirm("确认删除该模型与绑定模板？历史任务记录不会被删除。"))return;try{await api.deleteModel(deleteId);state.models=await api.listModels();toast("模型与模板已删除");}catch(error){toast(error.message,"error");}return renderModels();}
  const select=event.target.closest("[data-select-llm]"); if(select){try{await api.selectLLM(select.dataset.selectLlm,select.dataset.usage);state.llms=await api.listLLMs();toast(`已切换${usageName(select.dataset.usage)}模型`);}catch(error){toast(error.message,"error");}return renderModels();}
});

document.querySelectorAll(".nav-item").forEach((item)=>item.addEventListener("click",()=>setRoute(item.dataset.route)));
document.querySelector("#mobile-menu").addEventListener("click",()=>shell.classList.toggle("menu-open"));
document.querySelector("#close-evidence").addEventListener("click",()=>evidenceDialog.close());
evidenceDialog.addEventListener("close",()=>{ const player=document.querySelector("#evidence-video"); if(player) player.pause(); });
evidenceDialog.addEventListener("click",(event)=>{ if(event.target===evidenceDialog) evidenceDialog.close(); });

modelForm.addEventListener("submit", async (event) => {
  const submitter=event.submitter; if(submitter?.value==="cancel") return;
  event.preventDefault(); const data=Object.fromEntries(new FormData(modelForm)); const input={...data,targets:data.targets.split(",").map((x)=>x.trim()).filter(Boolean),limitations:data.limitations||"暂无额外限制"};
  const save=document.querySelector("#save-model"); save.disabled=true; save.textContent="校验并保存中…";
  try { if(data.id) await api.updateModel(data.id,input); else await api.createModel(input); state.models=await api.listModels(); state.dashboard=await api.getDashboard(); dialog.close(); toast(data.id?"新版本已保存":"模型与模板已新增"); renderModels(); }
  catch(error){toast(error.message,"error"); save.disabled=false; save.textContent="保存并校验";}
});

main.innerHTML='<div class="skeleton"></div>';
loadData().then(render).catch((error)=>{main.innerHTML=`<div class="verdict error"><span class="verdict-icon">!</span><div><strong>工作台加载失败</strong><p>${escapeHtml(error.message)}</p></div></div>`;});
