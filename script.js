(() => {
  "use strict";

  // ══════════════════════════════════════════════════════════════
  // CONFIG & API 
  // ══════════════════════════════════════════════════════════════
  // 🔴 رابط Make.com: إذا شحنت الرصيد حطه هنا، وإذا تركت الخانة فاضية بيشتغل المحرك المحلي للهاكاثون كـ MVP.
  const AI_WEBHOOK_URL = "https://hook.eu1.make.com/YOUR_WEBHOOK_HERE"; 

  const MAX_SKILL_LEVEL = 5;
  const MIN_SKILL_LEVEL = 1;
  const CUSTOM_SKILL_PREFIX = "custom:";
  const STORAGE_KEY_PROFILE = "siraj_profile_v3";
  const STORAGE_KEY_REPORTS = "siraj_reports_v3";

  // ═══════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const round = (n) => Math.round(n);
  const nowISO = () => new Date().toISOString();
  const uid = () => "r_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  const RATE_LIMIT = {
    windowMs: 1500, last: 0,
    allow() { const t = Date.now(); if (t - this.last < this.windowMs) return false; this.last = t; return true; },
  };

  // ═══════════════════════════════════
  // i18n
  // ═══════════════════════════════════
  const STRINGS = {
    ar: { shareCopied: "تم النسخ", fillFirst: "يرجى إكمال التخصص والمهارات أولاً", pickRole: "اختر الوظيفة أولاً", autoPicked: "تم التحديد آلياً", profileSaved: "تم الحفظ", profileReset: "تم التصفير", slowDown: "الرجاء الانتظار", analysisError: "خطأ بالتحليل", pdfDone: "تم التحميل", evidence: "إثبات", addEvidence: "أضف إثبات" },
    en: { shareCopied: "Copied", fillFirst: "Fill profile first", pickRole: "Pick role first", autoPicked: "Auto-picked", profileSaved: "Saved", profileReset: "Reset", slowDown: "Wait", analysisError: "Error", pdfDone: "Downloaded", evidence: "Evidence", addEvidence: "Add evidence" },
  };
  const i18n = { lang: "ar", t(k) { return (STRINGS[this.lang] || STRINGS.ar)[k] || k; }, setLang(l) { this.lang = l === "en" ? "en" : "ar"; document.documentElement.lang = this.lang; document.documentElement.dir = this.lang === "ar" ? "rtl" : "ltr"; refreshAll(); } };

  // ═══════════════════════════════════
  // SKILLS & ROLES
  // ═══════════════════════════════════
  const SKILLS = {
    sql: { ar: "SQL", en: "SQL", cat: "technical" }, excel: { ar: "Excel", en: "Excel", cat: "technical" },
    powerbi: { ar: "Power BI", en: "Power BI", cat: "technical" }, python: { ar: "Python", en: "Python", cat: "technical" },
    statistics: { ar: "الإحصاء", en: "Statistics", cat: "technical" }, ml: { ar: "تعلم الآلة", en: "Machine Learning", cat: "technical" },
    data_viz: { ar: "تصوير البيانات", en: "Data Visualization", cat: "technical" }, data_modeling: { ar: "نمذجة البيانات", en: "Data Modeling", cat: "technical" },
    etl: { ar: "ETL", en: "ETL", cat: "technical" }, cloud: { ar: "الحوسبة السحابية", en: "Cloud", cat: "technical" },
    aws: { ar: "AWS", en: "AWS", cat: "technical" }, azure: { ar: "Azure", en: "Azure", cat: "technical" },
    gcp: { ar: "GCP", en: "GCP", cat: "technical" }, cybersecurity: { ar: "الأمن السيبراني", en: "Cybersecurity", cat: "technical" },
    networking: { ar: "الشبكات", en: "Networking", cat: "technical" }, linux: { ar: "Linux", en: "Linux", cat: "technical" },
    devops: { ar: "DevOps", en: "DevOps", cat: "technical" }, git: { ar: "Git", en: "Git", cat: "technical" },
    api: { ar: "واجهات API", en: "APIs", cat: "technical" }, requirements: { ar: "تحليل المتطلبات", en: "Requirements", cat: "domain" },
    process: { ar: "تحسين العمليات", en: "Process Improvement", cat: "domain" }, stakeholder: { ar: "إدارة أصحاب المصلحة", en: "Stakeholder Mgmt", cat: "soft" },
    communication: { ar: "التواصل", en: "Communication", cat: "soft" }, presentation: { ar: "العرض والتقديم", en: "Presentation", cat: "soft" },
    product: { ar: "إدارة المنتج", en: "Product Management", cat: "domain" }, ux: { ar: "تجربة المستخدم UX", en: "UX", cat: "domain" },
    erp: { ar: "ERP", en: "ERP", cat: "domain" }, sap: { ar: "SAP", en: "SAP", cat: "domain" },
    agile: { ar: "Agile/Scrum", en: "Agile/Scrum", cat: "domain" }, testing: { ar: "اختبار البرمجيات", en: "Testing", cat: "technical" },
    coding: { ar: "البرمجة", en: "Programming", cat: "technical" },
  };

  const ROLES = [
    { id: "data_analyst", ar: "محلل بيانات", en: "Data Analyst", descAr: "تحليل البيانات وبناء لوحات وقراءات تنفيذية.", tools: ["sql", "excel", "powerbi"], required: [{ skill: "sql", level: 4, weight: 10 }, { skill: "excel", level: 4, weight: 7 }, { skill: "powerbi", level: 4, weight: 9 }, { skill: "statistics", level: 3, weight: 6 }, { skill: "data_viz", level: 4, weight: 6 }, { skill: "communication", level: 3, weight: 5 }, { skill: "presentation", level: 3, weight: 4 }], optional: [{ skill: "python", level: 2, weight: 3 }, { skill: "data_modeling", level: 2, weight: 3 }] },
    { id: "data_scientist", ar: "عالم بيانات", en: "Data Scientist", descAr: "نمذجة تنبؤية وتحليلات متقدمة.", tools: ["python", "sql", "git"], required: [{ skill: "python", level: 4, weight: 10 }, { skill: "statistics", level: 4, weight: 9 }, { skill: "ml", level: 4, weight: 10 }, { skill: "sql", level: 3, weight: 6 }, { skill: "etl", level: 3, weight: 6 }, { skill: "git", level: 3, weight: 4 }, { skill: "communication", level: 3, weight: 5 }], optional: [{ skill: "cloud", level: 2, weight: 4 }, { skill: "api", level: 2, weight: 3 }] },
    { id: "business_analyst", ar: "محلل أعمال", en: "Business Analyst", descAr: "تحليل متطلبات وربط التقنية بالعمل.", tools: ["excel", "agile"], required: [{ skill: "requirements", level: 4, weight: 10 }, { skill: "process", level: 4, weight: 8 }, { skill: "stakeholder", level: 4, weight: 8 }, { skill: "communication", level: 4, weight: 8 }, { skill: "presentation", level: 3, weight: 5 }, { skill: "agile", level: 3, weight: 5 }, { skill: "excel", level: 3, weight: 4 }], optional: [{ skill: "sql", level: 2, weight: 3 }] },
    { id: "cyber_analyst", ar: "محلل أمن سيبراني", en: "Cyber Analyst", descAr: "مراقبة التهديدات، SOC، وتحليل الحوادث.", tools: ["linux", "networking"], required: [{ skill: "cybersecurity", level: 4, weight: 10 }, { skill: "networking", level: 4, weight: 8 }, { skill: "linux", level: 3, weight: 6 }, { skill: "communication", level: 3, weight: 5 }, { skill: "process", level: 3, weight: 4 }], optional: [{ skill: "cloud", level: 2, weight: 4 }] },
    { id: "cloud_engineer", ar: "مهندس سحابة", en: "Cloud Engineer", descAr: "بناء وتشغيل البنية السحابية والأمان.", tools: ["aws", "azure", "linux"], required: [{ skill: "cloud", level: 4, weight: 10 }, { skill: "linux", level: 3, weight: 6 }, { skill: "networking", level: 3, weight: 6 }, { skill: "devops", level: 3, weight: 6 }, { skill: "git", level: 3, weight: 4 }, { skill: "cybersecurity", level: 3, weight: 5 }], optional: [{ skill: "aws", level: 3, weight: 4 }, { skill: "azure", level: 3, weight: 4 }] },
    { id: "product_manager", ar: "مدير منتج", en: "Product Manager", descAr: "تعريف الرؤية والأولويات وقيادة التنفيذ.", tools: ["agile", "data_viz"], required: [{ skill: "product", level: 4, weight: 10 }, { skill: "stakeholder", level: 4, weight: 8 }, { skill: "communication", level: 4, weight: 8 }, { skill: "presentation", level: 4, weight: 7 }, { skill: "process", level: 3, weight: 5 }, { skill: "agile", level: 3, weight: 5 }], optional: [{ skill: "data_viz", level: 2, weight: 3 }] },
    { id: "ux_designer", ar: "مصمم UX", en: "UX Designer", descAr: "بحث مستخدم + تصميم تدفقات + نماذج.", tools: ["ux"], required: [{ skill: "ux", level: 4, weight: 10 }, { skill: "communication", level: 4, weight: 7 }, { skill: "presentation", level: 3, weight: 5 }, { skill: "process", level: 3, weight: 4 }], optional: [{ skill: "product", level: 2, weight: 3 }] },
    { id: "erp_consultant", ar: "استشاري ERP", en: "ERP Consultant", descAr: "تطبيق ERP وربط العمليات والمتطلبات.", tools: ["erp", "sap"], required: [{ skill: "erp", level: 4, weight: 10 }, { skill: "process", level: 4, weight: 8 }, { skill: "requirements", level: 4, weight: 8 }, { skill: "communication", level: 4, weight: 7 }, { skill: "stakeholder", level: 3, weight: 5 }], optional: [{ skill: "sap", level: 3, weight: 4 }] },
    { id: "devops_engineer", ar: "مهندس DevOps", en: "DevOps Engineer", descAr: "CI/CD، أتمتة، تشغيل، مراقبة.", tools: ["devops", "linux", "git"], required: [{ skill: "devops", level: 4, weight: 10 }, { skill: "linux", level: 4, weight: 7 }, { skill: "git", level: 4, weight: 6 }, { skill: "cloud", level: 3, weight: 6 }, { skill: "networking", level: 3, weight: 5 }, { skill: "cybersecurity", level: 3, weight: 4 }], optional: [{ skill: "api", level: 2, weight: 3 }] },
    { id: "software_engineer", ar: "مهندس برمجيات", en: "Software Engineer", descAr: "تطوير منتجات برمجية، هندسة، اختبار.", tools: ["git", "api", "testing"], required: [{ skill: "coding", level: 4, weight: 10 }, { skill: "git", level: 3, weight: 6 }, { skill: "api", level: 3, weight: 6 }, { skill: "testing", level: 3, weight: 6 }, { skill: "communication", level: 3, weight: 4 }], optional: [{ skill: "cloud", level: 2, weight: 3 }] }
  ];

  function normalizeSkillName(raw) {
    const s = String(raw || "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s\/.\-+]/gu, " ").replace(/\s+/g, " ").trim();
    if (!s) return null;
    for (const [k, m] of Object.entries(SKILLS)) { if (s === m.ar.toLowerCase() || s === m.en.toLowerCase()) return k; }
    return CUSTOM_SKILL_PREFIX + s.slice(0, 40);
  }
  function skillLabel(k) { if (k.startsWith(CUSTOM_SKILL_PREFIX)) return k.replace(CUSTOM_SKILL_PREFIX, ""); const m = SKILLS[k]; return m ? (i18n.lang === "ar" ? m.ar : m.en) : k; }

  const state = {
    tab: "profile", selectedRoleId: null, completedSteps: new Set(),
    profile: { major: "", eduLevel: "UNI", experienceYears: 0, prefs: "balanced", sector: "quasi", certs: [], tools: [], skills: [], evidence: {} },
    analysis: null, reportId: null,
  };

  const dom = {};
  function cacheDom() {
    dom.langBtn = $("langBtn"); dom.shareBtn = $("shareBtn"); dom.tabs = document.querySelectorAll(".tab"); dom.steps = document.querySelectorAll(".step");
    dom.views = { profile: $("viewProfile"), roles: $("viewRoles"), analysis: $("viewAnalysis"), report: $("viewReport") };
    dom.major = $("major"); dom.eduLevel = $("eduLevel"); dom.experienceYears = $("experienceYears"); dom.prefs = $("prefs"); dom.sector = $("sector"); dom.certs = $("certs"); dom.tools = $("tools");
    dom.skillName = $("skillName"); dom.skillLevel = $("skillLevel"); dom.skillsBody = $("skillsBody"); dom.skillTable = $("skillTable"); dom.skillsEmpty = $("skillsEmpty");
    dom.rolesGrid = $("rolesGrid"); dom.scoreValue = $("scoreValue"); dom.scoreBar = $("scoreBar"); dom.roleValue = $("roleValue"); dom.roleNote = $("roleNote");
    dom.confidenceValue = $("confidenceValue"); dom.confidenceBar = $("confidenceBar"); dom.confidenceNote = $("confidenceNote");
    dom.missingList = $("missingList"); dom.roadmap = $("roadmap"); dom.projects = $("projects"); dom.barChart = $("barChart"); dom.radarChart = $("radarChart");
    dom.reportSummary = $("reportSummary"); dom.reportJson = $("reportJson"); dom.dialog = $("dialog"); dom.chatInput = $("chatInput"); dom.toast = $("toast"); dom.toastText = $("toastText");
    dom.estimateBadge = $("estimateBadge"); dom.estimateText = $("estimateText"); dom.comparePanel = $("comparePanel"); dom.compareResult = $("compareResult"); dom.compare1 = $("compare1"); dom.compare2 = $("compare2");
  }

  let toastTimer;
  function toast(t) { dom.toastText.textContent = t; dom.toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 1800); }

  function setTab(tab) {
    state.tab = tab;
    dom.tabs.forEach((t) => { const isActive = t.dataset.tab === tab; t.classList.toggle("active", isActive); });
    Object.entries(dom.views).forEach(([k, el]) => { el.style.display = k === tab ? "block" : "none"; });
    const order = ["profile", "roles", "analysis", "report"]; const idx = order.indexOf(tab);
    dom.steps.forEach((s, i) => { s.classList.toggle("active", i === idx); s.classList.toggle("done", state.completedSteps.has(order[i]) && i !== idx); });
    if (tab === "analysis" && state.analysis) {
      requestAnimationFrame(() => { setTimeout(() => { drawBarChart(dom.barChart, state.analysis.res.charts); drawRadarChart(dom.radarChart, state.analysis.res.charts); }, 80); });
    }
  }

  function profileFromInputs() {
    state.profile.major = dom.major.value.trim(); state.profile.eduLevel = dom.eduLevel.value; state.profile.experienceYears = clamp(Number(dom.experienceYears.value || 0), 0, 50);
    state.profile.prefs = dom.prefs.value; state.profile.sector = dom.sector.value || "quasi";
    state.profile.certs = dom.certs.value.split(",").map((s) => s.trim()).filter(Boolean); state.profile.tools = dom.tools.value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  function loadProfileToInputs() {
    dom.major.value = state.profile.major || ""; dom.eduLevel.value = state.profile.eduLevel || "UNI"; dom.experienceYears.value = String(state.profile.experienceYears || 0);
    dom.prefs.value = state.profile.prefs || "balanced"; dom.sector.value = state.profile.sector || "quasi";
    dom.certs.value = (state.profile.certs || []).join(", "); dom.tools.value = (state.profile.tools || []).join(", ");
  }
  function validateProfile() {
    profileFromInputs(); let valid = true; const mf = $("fieldMajor");
    if (state.profile.major.length < 2) { mf.classList.add("has-error"); valid = false; } else { mf.classList.remove("has-error"); }
    if ((state.profile.skills || []).length === 0) valid = false; return valid;
  }
  function saveProfile() { profileFromInputs(); store.set(STORAGE_KEY_PROFILE, state.profile); state.completedSteps.add("profile"); toast(i18n.t("profileSaved")); }
  function loadProfile() { const p = store.get(STORAGE_KEY_PROFILE, null); if (p) state.profile = { ...state.profile, ...p, evidence: p.evidence || {} }; loadProfileToInputs(); renderSkillsTable(); }
  function resetProfile() { state.profile = { major: "", eduLevel: "UNI", experienceYears: 0, prefs: "balanced", sector: "quasi", certs: [], tools: [], skills: [], evidence: {} }; loadProfileToInputs(); renderSkillsTable(); store.set(STORAGE_KEY_PROFILE, state.profile); toast(i18n.t("profileReset")); }

  function addSkill(raw, level) {
    const key = normalizeSkillName(raw);
    if (!key || String(raw || "").trim().length < 2) { toast(i18n.t("invalidSkill")); return; }
    const lvl = clamp(Number(level || 3), MIN_SKILL_LEVEL, MAX_SKILL_LEVEL);
    const idx = state.profile.skills.findIndex((s) => s.key === key);
    if (idx >= 0) { state.profile.skills[idx].level = Math.max(state.profile.skills[idx].level, lvl); state.profile.skills[idx].raw = raw; } else { state.profile.skills.push({ raw: raw.trim(), key, level: lvl }); }
    renderSkillsTable(); store.set(STORAGE_KEY_PROFILE, state.profile);
  }
  function removeSkill(key) { state.profile.skills = state.profile.skills.filter((s) => s.key !== key); if (state.profile.evidence?.[key]) delete state.profile.evidence[key]; renderSkillsTable(); store.set(STORAGE_KEY_PROFILE, state.profile); }
  function setSkillLevel(key, level) { const s = state.profile.skills.find((x) => x.key === key); if (s) s.level = clamp(Number(level), MIN_SKILL_LEVEL, MAX_SKILL_LEVEL); renderSkillsTable(); store.set(STORAGE_KEY_PROFILE, state.profile); }

  function renderSkillsTable() {
    const tb = dom.skillsBody; tb.innerHTML = "";
    const sk = [...(state.profile.skills || [])].sort((a, b) => skillLabel(a.key).localeCompare(skillLabel(b.key)));
    dom.skillTable.style.display = sk.length ? "table" : "none"; dom.skillsEmpty.style.display = sk.length ? "none" : "block";
    for (const s of sk) {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td"); const pill = document.createElement("span"); pill.className = "pill"; pill.textContent = s.raw || skillLabel(s.key); tdName.appendChild(pill);
      const tdNorm = document.createElement("td"); tdNorm.style.cssText = "color:var(--muted);font-size:12px"; tdNorm.textContent = s.key.startsWith(CUSTOM_SKILL_PREFIX) ? "—" : skillLabel(s.key);
      const tdLevel = document.createElement("td"); const rangeInput = document.createElement("input"); rangeInput.type = "range"; rangeInput.min = String(MIN_SKILL_LEVEL); rangeInput.max = String(MAX_SKILL_LEVEL); rangeInput.value = String(s.level); rangeInput.addEventListener("input", () => setSkillLevel(s.key, rangeInput.value)); const levelSpan = document.createElement("span"); levelSpan.style.cssText = "font-weight:800;margin-inline-start:8px"; levelSpan.textContent = String(s.level); rangeInput.addEventListener("input", () => { levelSpan.textContent = rangeInput.value; }); tdLevel.appendChild(rangeInput); tdLevel.appendChild(levelSpan);
      const tdRemove = document.createElement("td"); const removeBtn = document.createElement("span"); removeBtn.className = "x"; removeBtn.textContent = "✕"; removeBtn.addEventListener("click", () => removeSkill(s.key)); tdRemove.appendChild(removeBtn);
      tr.append(tdName, tdNorm, tdLevel, tdRemove); tb.appendChild(tr);
    }
  }

  function renderRoles() {
    dom.rolesGrid.innerHTML = "";
    for (const r of ROLES) {
      const div = document.createElement("div");
      div.className = "role-card" + (state.selectedRoleId === r.id ? " active" : "");
      div.innerHTML = `<h3>${escHtml(i18n.lang === "ar" ? r.ar : r.en)}</h3><div class="desc">${escHtml(i18n.lang === "ar" ? r.descAr : r.descEn)}</div><div class="role-meta">${(r.tools || []).slice(0, 4).map((k) => `<span class="tag">${escHtml(skillLabel(k))}</span>`).join("")}</div>`;
      div.addEventListener("click", () => { state.selectedRoleId = r.id; renderRoles(); saySiraj("siraj", i18n.lang === "ar" ? `اخترت: ${r.ar}. اضغط "حلّل الجاهزية".` : `Selected: ${r.en}. Click "Analyze".`); });
      dom.rolesGrid.appendChild(div);
    }
    [dom.compare1, dom.compare2].forEach((sel, si) => { sel.innerHTML = ""; ROLES.forEach((r, i) => { const o = document.createElement("option"); o.value = r.id; o.textContent = i18n.lang === "ar" ? r.ar : r.en; if (si === 1 && i === 1) o.selected = true; sel.appendChild(o); }); });
  }

  function autoPickBestRole() { if (!validateProfile()) { toast(i18n.t("fillFirst")); return; } const scores = ROLES.map((r) => ({ id: r.id, score: analyzeFallback(state.profile, r).score })).sort((a, b) => b.score - a.score); state.selectedRoleId = scores[0]?.id || ROLES[0].id; renderRoles(); toast(i18n.t("autoPicked")); }

  // ═══════════════════════════════════
  // SCORING ENGINE (Fallback / Local AI)
  // ═══════════════════════════════════
  function sectorWeightMult(sector, roleId, skillKey) {
    let m = 1;
    if (sector === "gov" && ["requirements", "process", "stakeholder", "communication"].includes(skillKey)) m *= 1.25;
    if (sector === "private" && ["coding", "devops", "cloud", "api"].includes(skillKey)) m *= 1.2;
    if (sector === "quasi" && ["communication", "stakeholder", "process"].includes(skillKey)) m *= 1.1;
    return m;
  }

  function analyzeFallback(profile, role) {
    const map = new Map();
    for (const s of profile.skills || []) { const k = s.key; if (k) { map.set(k, Math.max(map.get(k) || 0, clamp(Number(s.level || 1), 1, 5))); } }
    
    const required = role.required || []; const optional = role.optional || [];
    const reqWeights = required.map((x) => (x.weight || 0) * sectorWeightMult(profile.sector || "quasi", role.id, x.skill));
    const totalReqWeight = reqWeights.reduce((a, x) => a + x, 0) || 1;

    let wSumReq = 0;
    const perSkill = required.map((req, idx) => {
      const uLvl = map.get(req.skill) || 0; const rLvl = clamp(req.level, 1, 5); const achieved = Math.min(1, uLvl / rLvl); const gap = Math.max(0, rLvl - uLvl); const w = reqWeights[idx] || 0; const impact = w * gap; wSumReq += w * achieved;
      return { skill: req.skill, reqLevel: rLvl, userLevel: Math.round(uLvl * 10) / 10, weight: w, achieved, gap, impact };
    });

    const score = round(100 * Math.min(1, wSumReq / totalReqWeight));
    const missing = perSkill.filter((x) => x.gap > 0 || x.achieved < 0.75).sort((a, b) => b.impact - a.impact).map((x) => ({ skill: x.skill, label: skillLabel(x.skill), reqLevel: x.reqLevel, userLevel: x.userLevel, impact: round(x.impact * 10) / 10, evidence: profile.evidence?.[x.skill] || null }));
    const topReq = [...perSkill].sort((a, b) => b.weight - a.weight).slice(0, 7).map((x) => ({ key: x.skill, label: skillLabel(x.skill), req: x.reqLevel, user: Math.min(x.userLevel, 5) }));
    
    // بناء المشاريع و الخريطة الافتراضية
    const roadmap = [
      {week: 1, phase: "تأسيس", focus: [missing[0]?.label || "المهارات"], tasks: [{title: "مراجعة أساسيات", resource: "منصة سطر"}], mini: "مهمة مصغرة", quiz: "تقييم"},
      {week: 2, phase: "تطبيق", focus: [missing[0]?.label || "المهارات"], tasks: [{title: "بناء مشروع مصغر", resource: "GitHub"}], mini: "مهمة مصغرة", quiz: "تقييم"}
    ];
    const projects = [{title: "تحليل بيانات القطاع الخاص", focusSkill: missing[0]?.label || "عام", objective: "تطبيق عملي سعودي", dataset: "بيانات مفتوحة", architecture: "تنظيف ثم تحليل", milestones: ["تجهيز", "تحليل"], deliverables: ["تقرير", "كود"], rubric: [{k: "الجودة", v: "0-5"}]}];

    return { score, perSkill, missing, roadmap, projects, charts: topReq, estWeeks: score >= 80 ? 0 : 4, confidence: {score: 75, note: "تحليل محلي معتمد"} };
  }

  // ═══════════════════════════════════
  // RENDER ANALYSIS
  // ═══════════════════════════════════
  function renderAnalysis(res, role) {
    dom.scoreValue.textContent = String(res.score); dom.scoreBar.style.width = res.score + "%";
    dom.roleValue.textContent = i18n.lang === "ar" ? role.ar : role.en; dom.roleNote.textContent = i18n.lang === "ar" ? role.descAr : role.descEn;
    dom.confidenceValue.textContent = String(res.confidence?.score || 85); dom.confidenceBar.style.width = (res.confidence?.score || 85) + "%"; dom.confidenceNote.textContent = res.confidence?.note || "تحليل مبني على محرك سراج";
    if (res.estWeeks > 0) { dom.estimateBadge.style.display = "inline-flex"; dom.estimateText.textContent = `~${res.estWeeks} ${i18n.t("weeksToTarget")}`; } else { dom.estimateBadge.style.display = "none"; }

    // 🌟 إضافة ختم رؤية 2030 الديناميكي 🌟
    const visionProgram = role.id === "data_analyst" || role.id === "data_scientist" ? "برنامج التحول الوطني (الرقمنة)" : role.id === "cyber_analyst" ? "الاستراتيجية الوطنية للأمن السيبراني" : "برنامج تنمية القدرات البشرية";
    const existingBadge = dom.roleValue.parentElement.querySelector('.vision-badge');
    if(existingBadge) existingBadge.remove();
    const badgeContainer = document.createElement('div'); badgeContainer.className = 'vision-badge';
    badgeContainer.innerHTML = `<div style="margin-top:8px; padding:6px 10px; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); border-radius:8px; display:inline-block;"><span style="color:#10B981; font-weight:800; font-size:11px;">🇸🇦 متوافق مع: ${visionProgram}</span></div>`;
    dom.roleValue.parentElement.appendChild(badgeContainer);

    dom.missingList.innerHTML = "";
    if (!res.missing.length) { dom.missingList.innerHTML = `<li><span class="warn">${i18n.lang === "ar" ? "جاهز جدًا — ركّز على مشاريع قوية!" : "Very ready — focus on strong projects!"}</span></li>`; } 
    else {
      for (const m of res.missing.slice(0, 12)) {
        const ev = state.profile.evidence?.[m.skill];
        dom.missingList.innerHTML += `<li style="margin-bottom:8px;"><div class="miss-row"><div class="miss-text">${m.label} — مطلوب ${m.reqLevel}/5, مستواك ${m.userLevel}/5 <div class="miss-ev">${ev?.url ? `<a class="evlink" href="${ev.url}" target="_blank">رابط الإثبات</a>` : `<span class="evnone">بدون إثبات</span>`}</div></div><div class="miss-actions"><button class="btn btn-ghost btn-xs" onclick="openEvidenceModal('${m.skill}')">${ev ? "تعديل إثبات" : "أضف إثبات"}</button></div></div></li>`;
      }
    }

    dom.roadmap.innerHTML = res.roadmap.map(w => `<div class="week"><div class="week-head"><div class="w">الأسبوع ${w.week} <span class="phase-tag">${w.phase}</span></div><div class="focus">${w.focus.join(" + ")}</div></div><ul>${w.tasks.map(t => `<li>${escHtml(t.title)} <span style="color:var(--muted)">— ${escHtml(t.resource)}</span></li>`).join("")}</ul></div>`).join("");
    dom.projects.innerHTML = res.projects.map(p => `<div class="project"><h5>${escHtml(p.title)}</h5><div class="small" style="margin-top:6px">${escHtml(p.objective)}</div></div>`).join("");

    try { drawBarChart(dom.barChart, res.charts); drawRadarChart(dom.radarChart, res.charts); } catch (e) { console.error(e); }
    state.completedSteps.add("analysis");
  }

  // ═══════════════════════════════════
  // CHARTS (Canvas)
  // ═══════════════════════════════════
  function setupCanvas(canvas) { const rect = canvas.parentElement.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; const w = Math.max(280, rect.width - 24); const h = 280; canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + "px"; canvas.style.height = h + "px"; const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr); return { ctx, W: w, H: h }; }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function drawBarChart(canvas, data) {
    if (!data || !data.length) return; const { ctx, W, H } = setupCanvas(canvas); ctx.clearRect(0, 0, W, H); const pad = { t: 50, b: 60, l: 50, r: 20 }; const cW = W - pad.l - pad.r; const cH = H - pad.t - pad.b; const n = data.length; const gW = cW / n; const bW = gW * 0.28;
    ctx.strokeStyle = "#2a3530"; ctx.lineWidth = 1; for (let i = 1; i <= MAX_SKILL_LEVEL; i++) { const y = pad.t + cH - cH * (i / MAX_SKILL_LEVEL); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.fillStyle = "#6b7c73"; ctx.font = "11px system-ui"; ctx.fillText(String(i), pad.l - 20, y + 4); }
    ctx.fillStyle = "#e8ede9"; ctx.font = "bold 14px system-ui"; ctx.fillText(i18n.lang === "ar" ? "مطابقة المهارات" : "Skill Match", pad.l, 30);
    for (let i = 0; i < n; i++) { const d = data[i]; const x0 = pad.l + i * gW + gW / 2; const uH = cH * (d.user / MAX_SKILL_LEVEL); const rH = cH * (d.req / MAX_SKILL_LEVEL); ctx.fillStyle = "rgba(59, 130, 246, 0.12)"; ctx.beginPath(); roundRect(ctx, x0 - bW - 4, pad.t + cH - rH, bW, rH, 4); ctx.fill(); const grad = ctx.createLinearGradient(0, pad.t + cH - uH, 0, pad.t + cH); grad.addColorStop(0, "#3B82F6"); grad.addColorStop(1, "#1D4ED8"); ctx.fillStyle = grad; ctx.beginPath(); roundRect(ctx, x0 + 4, pad.t + cH - uH, bW, uH, 4); ctx.fill(); ctx.fillStyle = "#a3b0a8"; ctx.font = "11px system-ui"; const lbl = d.label.length > 10 ? d.label.slice(0, 10) + "…" : d.label; ctx.save(); ctx.translate(x0, H - pad.b + 16); ctx.rotate(-0.4); ctx.fillText(lbl, -20, 0); ctx.restore(); }
    ctx.fillStyle = "#3B82F6"; roundRect(ctx, W - 160, 14, 12, 12, 3); ctx.fill(); ctx.fillStyle = "#a3b0a8"; ctx.font = "11px system-ui"; ctx.fillText(i18n.lang === "ar" ? "مستواك" : "You", W - 142, 24); ctx.fillStyle = "rgba(59, 130, 246, 0.15)"; roundRect(ctx, W - 90, 14, 12, 12, 3); ctx.fill(); ctx.fillStyle = "#a3b0a8"; ctx.fillText(i18n.lang === "ar" ? "المطلوب" : "Req", W - 72, 24);
  }
  function drawRadarChart(canvas, data) {
    if (!data || !data.length) return; const { ctx, W, H } = setupCanvas(canvas); ctx.clearRect(0, 0, W, H); const cx = W / 2; const cy = H / 2 + 16; const R = Math.min(W, H) * 0.32; const n = data.length;
    for (let r = 1; r <= MAX_SKILL_LEVEL; r++) { const rr = (R * r) / MAX_SKILL_LEVEL; ctx.strokeStyle = "#2a3530"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n - Math.PI / 2; const x = cx + Math.cos(a) * rr; const y = cy + Math.sin(a) * rr; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke(); }
    for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n - Math.PI / 2; ctx.strokeStyle = "#2a3530"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); const lx = cx + Math.cos(a) * (R + 16); const ly = cy + Math.sin(a) * (R + 16); ctx.fillStyle = "#a3b0a8"; ctx.font = "10px system-ui"; const lbl = data[i].label.length > 10 ? data[i].label.slice(0, 10) + "…" : data[i].label; ctx.fillText(lbl, lx - 20, ly + 4); }
    function poly(vals, fill, stroke) { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n - Math.PI / 2; const rr = R * (vals[i] / MAX_SKILL_LEVEL); const x = cx + Math.cos(a) * rr; const y = cy + Math.sin(a) * rr; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.fill(); ctx.stroke(); }
    poly(data.map((d) => d.req), "rgba(59, 130, 246, 0.06)", "#344038"); poly(data.map((d) => d.user), "rgba(59, 130, 246, 0.18)", "#3B82F6");
  }

  // ═══════════════════════════════════
  // EVIDENCE MODAL
  // ═══════════════════════════════════
  window.openEvidenceModal = function(skillKey) {
    const current = state.profile.evidence?.[skillKey] || {};
    const url = prompt("أدخل رابط الإثبات (GitHub/Drive):", current.url || "");
    if (url !== null) {
      if (!state.profile.evidence) state.profile.evidence = {};
      state.profile.evidence[skillKey] = { url: url.trim(), note: "", updatedAt: nowISO() };
      store.set(STORAGE_KEY_PROFILE, state.profile); toast(i18n.t("evidenceSaved"));
      if (state.analysis) renderAnalysis(state.analysis.res, state.analysis.role);
    }
  }

  // ═══════════════════════════════════
  // CHAT (تأثير الآلة الكاتبة)
  // ═══════════════════════════════════
  function saySiraj(sender, text) {
    const w = document.createElement("div");
    w.className = "msg " + (sender === "siraj" ? "msg-siraj" : "msg-user");
    const b = document.createElement("div");
    b.className = "bubble";
    w.appendChild(b);
    dom.dialog.appendChild(w);
    dom.dialog.scrollTop = dom.dialog.scrollHeight;

    if (sender === "user") { b.textContent = text; return; }

    let i = 0; b.textContent = "";
    function typeWriter() {
      if (i < text.length) {
        b.textContent += text.charAt(i); i++;
        dom.dialog.scrollTop = dom.dialog.scrollHeight;
        setTimeout(typeWriter, 20);
      }
    }
    typeWriter();
  }

  function handleChat(text) {
    const raw = (text || "").trim(); if (!raw) return;
    saySiraj("user", raw); const t = raw.toLowerCase(); const ar = i18n.lang === "ar";
    if (t.includes("ناقصني") || t.includes("وش ناقصني")) {
      if (!state.analysis) { saySiraj("siraj", ar ? "حلّل جاهزيتك أولاً ثم اسألني." : "Analyze first."); return; }
      saySiraj("siraj", ar ? `أهم الفجوات: ${state.analysis.res.missing.slice(0,2).map((m) => m.label).join("، ")}. ركّز عليها.` : "Focus on top gaps.");
      return;
    }
    if (t.includes("أفضل وظيفة")) { autoPickBestRole(); setTab("roles"); saySiraj("siraj", "تم اختيار أفضل وظيفة تناسب مهاراتك."); return; }
    saySiraj("siraj", "أقدر أساعدك في اختيار الوظيفة أو تحليل الفجوات، استخدم الأزرار السريعة.");
  }

  // ═══════════════════════════════════
  // PDF (التقرير التنفيذي الفاخر)
  // ═══════════════════════════════════
  function downloadPDF(rep) {
    if (typeof html2pdf === "undefined") { toast("مكتبة PDF غير متوفرة."); return; }
    toast("جاري تجهيز التقرير التنفيذي...");
    const printDiv = document.createElement("div");
    printDiv.style.cssText = "background:#fff;color:#000;padding:40px;font-family:sans-serif;width:800px;position:absolute;top:-9999px";
    printDiv.style.direction = rep.lang === "ar" ? "rtl" : "ltr";
    
    const sectorName = rep.profile.sector === "gov" ? "حكومي" : rep.profile.sector === "private" ? "خاص" : "شبه حكومي";
    let missingHtml = (rep.result.missing || []).map(m => `<li style="margin-bottom: 12px; background: #F9FAFB; padding: 10px 16px; border-radius: 8px; border: 1px solid #E5E7EB;"><b>${escHtml(m.label)}</b> (مطلوب: ${m.reqLevel} — مستواك: ${m.userLevel})</li>`).join("");

    printDiv.innerHTML = `
      <div style="border: 8px solid #0B1120; padding: 40px; border-radius: 16px; background: #fff; position: relative;">
        <div style="text-align:center; border-bottom: 3px solid #3B82F6; padding-bottom: 24px; margin-bottom: 30px;">
          <h1 style="color: #0B1120; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px;">سِراج <span style="color:#3B82F6">SIRAJ</span></h1>
          <h2 style="color: #3B82F6; margin: 8px 0 0 0; font-size: 20px;">التقرير الاستشاري للجاهزية المهنية</h2>
          <p style="color: #6B7280; margin-top: 12px; font-size: 12px; font-family: monospace;">
            REF: ${escHtml(rep.id).toUpperCase()} | DATE: ${new Date(rep.createdAt).toLocaleDateString("ar-SA")}
          </p>
        </div>
        <div style="background: #F3F4F6; padding: 24px; border-radius: 12px; border-right: 6px solid #3B82F6; margin-bottom: 30px;">
          <h3 style="margin:0 0 16px 0; color:#111; font-size:18px;">الملخص التنفيذي</h3>
          <table style="width: 100%; text-align: right; font-size: 15px;">
            <tr><td style="padding: 8px 0; border-bottom:1px solid #E5E7EB;"><b>الوظيفة المستهدفة:</b> ${escHtml(rep.role?.name || "")}</td><td style="padding: 8px 0; border-bottom:1px solid #E5E7EB;"><b>القطاع:</b> ${escHtml(sectorName)}</td></tr>
            <tr><td style="padding: 8px 0;"><b>مؤشر الجاهزية:</b> <span style="color:#10B981; font-weight:900; font-size: 18px;">${rep.result.score}%</span></td><td style="padding: 8px 0;"><b>الوقت للجاهزية:</b> <b>${rep.result.estWeeks || 0}</b> أسابيع</td></tr>
          </table>
        </div>
        <h3 style="color:#0B1120; font-size:20px; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 16px;">تحليل فجوة المهارات</h3>
        <ul style="font-size: 15px; line-height: 2; color: #374151; margin-bottom: 30px; list-style-type: none; padding:0;">${missingHtml}</ul>
        <div style="margin-top: 50px; text-align: center; color: #9CA3AF; font-size: 11px; border-top: 1px solid #E5E7EB; padding-top: 20px;">تم توليد هذا التقرير آلياً عبر محرك سِراج لتمكين المواهب الوطنية وفق متطلبات رؤية المملكة 2030.</div>
      </div>
    `;
    document.body.appendChild(printDiv);
    html2pdf().set({ margin: 0.5, filename: `Siraj_Executive_Report_${rep.id}.pdf`, jsPDF: { unit: "in", format: "a4", orientation: "portrait" } }).from(printDiv).save().then(() => { toast(i18n.t("pdfDone")); document.body.removeChild(printDiv); });
  }

  // ═══════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════
  function bindEvents() {
    dom.tabs.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    dom.steps.forEach((s) => s.addEventListener("click", () => setTab(s.dataset.step)));

    // 🌟 تفعيل زر صفحة الترحيب والانتقال للتطبيق 🌟
    const startBtn = $("startAppBtn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        $("landingPage").style.display = "none";
        $("appContent").style.display = "block";
        saySiraj("siraj", "مرحباً بك! أنا سِراج 🤖. لنبدأ بتسجيل تخصصك ومهاراتك الحالية لنبني خطتك المهنية وتكون جاهزاً لسوق العمل.");
      });
    }

    $("addSkillBtn").addEventListener("click", () => { addSkill(dom.skillName.value, dom.skillLevel.value); dom.skillName.value = ""; dom.skillName.focus(); });
    dom.skillName.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("addSkillBtn").click(); } });

    // تجهيز الديمو بضغطة زر
    $("loadSampleBtn").addEventListener("click", () => {
      state.profile.major = "نظم المعلومات"; state.profile.eduLevel = "UNI"; state.profile.experienceYears = 0; state.profile.sector = "quasi";
      state.profile.skills = [{ raw: "SQL", key: "sql", level: 3 }, { raw: "Power BI", key: "powerbi", level: 4 }, { raw: "تحليل المتطلبات", key: "requirements", level: 2 }];
      loadProfileToInputs(); renderSkillsTable(); state.selectedRoleId = "data_analyst"; renderRoles(); toast("تم تجهيز ملف طالب نظم معلومات");
    });

    $("saveProfileBtn").addEventListener("click", saveProfile); $("resetProfileBtn").addEventListener("click", resetProfile);
    $("autoPickBtn").addEventListener("click", autoPickBestRole);

    // 🌟 زر التحليل (مع الإضاءة و Make.com Fallback) 🌟
    $("analyzeBtn").addEventListener("click", () => {
      if (!validateProfile()) { toast(i18n.t("fillFirst")); setTab("profile"); return; }
      if (!state.selectedRoleId) { toast(i18n.t("pickRole")); setTab("roles"); return; }
      const role = ROLES.find((r) => r.id === state.selectedRoleId); if (!role) return;

      const btn = $("analyzeBtn"); const originalText = btn.innerHTML;
      btn.innerHTML = "💡 جاري إضاءة المنارة وتحليل البيانات بالذكاء الاصطناعي...";
      btn.disabled = true; btn.classList.add("tech-bulb-loading");

      setTimeout(async () => {
        try {
          // تجهيز الـ Fallback المحلي كـ Backup
          let res = analyzeFallback(state.profile, role);
          const payload = { profile: state.profile, roleId: role.id, roleName: role.ar, sector: state.profile.sector || "quasi" };
          
          // إذا تم ضبط رابط Make.com، حاول استدعائه
          if (AI_WEBHOOK_URL.includes("hook.")) {
            try {
              const aiResp = await fetch(AI_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
              if (aiResp.ok) { const aiData = await aiResp.json(); res = { ...res, score: aiData.score || res.score, missing: aiData.missing || res.missing, roadmap: aiData.roadmap || res.roadmap, projects: aiData.projects || res.projects, estWeeks: aiData.estWeeks !== undefined ? aiData.estWeeks : res.estWeeks }; }
            } catch (err) { console.warn("Make webhook failed, using local AI engine"); }
          }
          
          state.analysis = { role, res }; renderAnalysis(res, role); setTab("analysis");
          saySiraj("siraj", `اكتمل التحليل! نسبة جاهزيتك لـ "${role.ar}" هي ${res.score}/100.`);
        } catch (e) { toast(i18n.t("analysisError")); } 
        finally { btn.innerHTML = originalText; btn.disabled = false; btn.classList.remove("tech-bulb-loading"); }
      }, 2500); // 2.5 ثانية لعرض تأثير المنارة قبل ظهور النتيجة
    });

    $("saveReportBtn").addEventListener("click", () => {
      if (!state.analysis) return;
      const rep = { id: uid(), createdAt: nowISO(), lang: i18n.lang, profile: state.profile, role: { id: state.analysis.role.id, name: state.analysis.role.ar }, result: state.analysis.res };
      state.reportId = rep.id; store.get(STORAGE_KEY_REPORTS, {})[rep.id] = rep; toast("تم حفظ التقرير"); setTab("report");
    });

    $("downloadPdfBtn").addEventListener("click", () => {
      if (!state.analysis) return toast("يرجى تحليل الجاهزية أولاً");
      const rep = { id: state.reportId || uid(), createdAt: nowISO(), lang: i18n.lang, profile: state.profile, role: state.analysis.role, result: state.analysis.res };
      downloadPDF(rep);
    });

    $("chatSendBtn").addEventListener("click", () => { handleChat(dom.chatInput.value); dom.chatInput.value = ""; dom.chatInput.focus(); });
    dom.chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("chatSendBtn").click(); } });
    document.querySelectorAll(".quick-btn").forEach((b) => b.addEventListener("click", () => handleChat(b.dataset.q)));
  }

  function init() { cacheDom(); bindEvents(); loadProfile(); renderRoles(); setTab("profile"); }
  init();
})();