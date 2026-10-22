const STORAGE_KEY = "visionops-member-a-v1";

const seed = {
  models: [
    { id: "m_person", name: "人员检测模型", version: "1.2.0", runtimeType: "TensorRT", fileName: "person_yolo_v12.engine", validation: "passed", status: "available", templateId: "tpl_intrusion", templateName: "区域入侵与滞留", scene: "intrusion", targets: ["person", "vehicle"], rules: ["enter", "dwell"], limitations: "严重遮挡和极暗场景下效果下降", references: 4, updatedAt: "2026-10-18T08:30:00Z" },
    { id: "m_fire", name: "火焰检测模型", version: "2.0.1", runtimeType: "ONNX Runtime", fileName: "fire_v201.onnx", validation: "passed", status: "available", templateId: "tpl_fire", templateName: "火焰持续检测", scene: "fire", targets: ["fire"], rules: ["visible", "duration"], limitations: "反光和暖色灯源需要人工核查", references: 1, updatedAt: "2026-10-17T04:20:00Z" },
    { id: "m_post", name: "岗位人员检测", version: "0.9.3", runtimeType: "PyTorch", fileName: "post_guard.pt", validation: "pending", status: "disabled", templateId: "tpl_absence", templateName: "岗位缺员检测", scene: "absence", targets: ["person"], rules: ["minimum_count", "absence_duration"], limitations: "多人遮挡场景待验证", references: 0, updatedAt: "2026-10-20T02:12:00Z" }
  ],
  llms: [
    { id: "llm_qwen", name: "Qwen3-8B-Instruct", version: "3.0", type: "language", inputs: ["text"], location: "本机 GPU 0", health: "healthy", usages: ["requirement_parse"] },
    { id: "vlm_qwen", name: "Qwen2.5-VL-7B", version: "2.5", type: "multimodal", inputs: ["text", "image", "video frames"], location: "本机 GPU 1", health: "healthy", usages: ["multimodal_analysis"] },
    { id: "vlm_backup", name: "InternVL3-8B", version: "3.0", type: "multimodal", inputs: ["text", "image"], location: "本机 GPU 1", health: "degraded", usages: [] }
  ],
  sources: [
    { id: "src_gate", name: "北门摄像头", type: "RTSP", status: "online", resolution: "1920 × 1080", fps: 25, duration: null },
    { id: "src_warehouse", name: "仓库测试录像", type: "录像", status: "online", resolution: "2560 × 1440", fps: 30, duration: 428 },
    { id: "src_post", name: "三号岗位摄像头", type: "RTSP", status: "offline", resolution: "1920 × 1080", fps: 25, duration: null }
  ],
  agents: []
};

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function sleep(ms = 280) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function load() {
  try { return { ...copy(seed), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return copy(seed); }
}
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function id(prefix) { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

export const api = {
  async getDashboard() {
    await sleep(120);
    const db = load();
    return { models: db.models.length, availableModels: db.models.filter((m) => m.validation === "passed" && m.status === "available").length, sources: db.sources.length, agents: db.agents.length, services: 4 };
  },
  async listSources() { await sleep(120); return copy(load().sources); },
  async listModels() { await sleep(140); return copy(load().models); },
  async listLLMs() { await sleep(140); return copy(load().llms); },
  async createModel(input) {
    await sleep(450);
    const db = load();
    const model = { ...input, id: id("m"), templateId: id("tpl"), rules: input.scene === "fire" ? ["visible", "duration"] : ["enter", "dwell"], validation: "passed", status: "available", references: 0, updatedAt: new Date().toISOString() };
    db.models.unshift(model); save(db); return copy(model);
  },
  async updateModel(modelId, input) {
    await sleep(420);
    const db = load();
    const index = db.models.findIndex((m) => m.id === modelId);
    if (index < 0) throw new Error("模型不存在");
    db.models[index] = { ...db.models[index], ...input, version: input.version, validation: "passed", updatedAt: new Date().toISOString() };
    save(db); return copy(db.models[index]);
  },
  async deleteModel(modelId) {
    await sleep(300);
    const db = load();
    const model = db.models.find((m) => m.id === modelId);
    if (!model) throw new Error("模型不存在");
    if (model.references > 0) throw new Error(`该模型仍被 ${model.references} 个任务引用，请先停止相关任务`);
    db.models = db.models.filter((m) => m.id !== modelId); save(db); return { ok: true };
  },
  async selectLLM(modelId, usage) {
    await sleep(360);
    const db = load();
    const target = db.llms.find((m) => m.id === modelId);
    if (!target || target.health !== "healthy") throw new Error("该模型当前不可用于切换");
    db.llms.forEach((m) => { m.usages = m.usages.filter((item) => item !== usage); });
    target.usages.push(usage); save(db); return copy(target);
  },
  async parseRequirement(text) {
    await sleep(520);
    const normalized = text.trim();
    const durationMatch = normalized.match(/(\d+)\s*(秒|分钟|分)/);
    const durationSec = durationMatch ? Number(durationMatch[1]) * (durationMatch[2] === "秒" ? 1 : 60) : null;
    let intent = { scene: "open", target: "未明确", rule: "开放视觉判断", templateId: null, templateName: null, modelId: null, modelName: null, execution: "multimodal" };
    if (/火|火焰/.test(normalized)) intent = { scene: "fire", target: "火焰", rule: "持续出现", templateId: "tpl_fire", templateName: "火焰持续检测", modelId: "m_fire", modelName: "火焰检测模型", execution: "template" };
    else if (/进入|闯入|入侵/.test(normalized)) intent = { scene: "intrusion", target: /车/.test(normalized) ? "车辆" : "人员", rule: "进入区域", templateId: "tpl_intrusion", templateName: "区域入侵与滞留", modelId: "m_person", modelName: "人员检测模型", execution: "template" };
    else if (/停留|滞留/.test(normalized)) intent = { scene: "dwell", target: "人员", rule: "区域滞留", templateId: "tpl_intrusion", templateName: "区域入侵与滞留", modelId: "m_person", modelName: "人员检测模型", execution: "template" };
    else if (/缺员|无人|离岗/.test(normalized)) intent = { scene: "absence", target: "人员", rule: "岗位缺员", templateId: "tpl_absence", templateName: "岗位缺员检测", modelId: "m_post", modelName: "岗位人员检测", execution: "template" };
    else if (/手机|打电话|转头|闭眼/.test(normalized)) intent = { scene: "open", target: "人员", rule: normalized.includes("手机") ? "使用手机" : normalized.includes("闭眼") ? "持续闭眼" : "指定行为", templateId: null, templateName: null, modelId: "vlm_qwen", modelName: "Qwen2.5-VL-7B", execution: "multimodal" };
    return { ...intent, requirementText: normalized, durationSec, confidence: intent.execution === "template" ? 0.94 : 0.78 };
  },
  async evaluateTask(config) {
    await sleep(620);
    const missing = [];
    if (!config.sourceId) missing.push("请选择视频源");
    if (!config.requirementText) missing.push("请输入监测需求");
    if (["intrusion", "dwell", "absence"].includes(config.scene) && (!config.regionPoints || config.regionPoints.length < 3)) missing.push("请在画面中绘制监测区域");
    if (["dwell", "absence"].includes(config.scene) && !config.durationSec) missing.push("请设置持续时间");
    if (config.source?.type === "录像" && Number(config.clipStart) >= Number(config.clipEnd)) missing.push("录像分析的结束位置必须晚于开始位置");
    if (missing.length) return { verdict: "clarification_required", missingConditions: missing, unsupportedConditions: [], evidenceLimitations: [], message: "需要补充关键条件后才能启动" };
    if (/思想|恶意|可疑的人/.test(config.requirementText)) return { verdict: "unsupported", missingConditions: [], unsupportedConditions: ["主观意图无法仅凭视觉证据可靠判断"], evidenceLimitations: ["系统只能分析可观察行为"], message: "当前需求无法可靠执行" };
    const limitations = config.execution === "multimodal" ? ["开放视觉判断受画面清晰度和遮挡影响", "报警前需要连续多帧结果一致"] : ["严重遮挡可能造成目标短暂丢失"];
    return { verdict: "executable", missingConditions: [], unsupportedConditions: [], evidenceLimitations: limitations, message: config.execution === "template" ? "已匹配经过校验的固定模板" : "未匹配固定模板，将使用本地多模态模型执行" };
  },
  async createAndStart(config, idempotencyKey) {
    await sleep(760);
    const db = load();
    const existing = db.agents.find((a) => a.idempotencyKey === idempotencyKey);
    if (existing) return copy(existing);
    const safeSource = config.source ? { ...config.source } : null;
    if (safeSource) delete safeSource.objectUrl;
    const safeConfig = { ...config, source: safeSource, result: null, analysis: null };
    const result = { agentId: id("ag"), revisionId: id("rev"), runId: id("run"), status: config.source?.type === "录像" ? "analyzing" : "running", idempotencyKey, createdAt: new Date().toISOString(), config: safeConfig };
    db.agents.push(result); save(db); return copy(result);
  },
  async analyzeRecording(config) {
    await sleep(3800);
    const start = Number(config.clipStart) || 0;
    const end = Number(config.clipEnd) || config.source?.duration || start + 60;
    const occurredAtSec = Math.min(end, Math.max(start + 3, start + Math.round((end - start) * 0.42)));
    const labels = {
      intrusion: "区域入侵",
      dwell: "人员滞留",
      fire: "检测到火焰",
      absence: "岗位持续缺员",
      open: "开放视觉事件"
    };
    return {
      id: id("evt"),
      eventType: labels[config.scene] || "监测事件",
      severity: config.scene === "fire" ? "高" : "中",
      occurredAtSec,
      evidenceStatus: "available",
      confidence: config.execution === "template" ? 0.93 : 0.81,
      alarmStatus: "triggered",
      snapshotRef: `evidence/${id("shot")}.jpg`,
      clipRef: `evidence/${id("clip")}.mp4`
    };
  },
  resetDemo() { localStorage.removeItem(STORAGE_KEY); }
};
