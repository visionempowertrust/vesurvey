const CONFIG = window.VE_CONFIG || {};
const RATING_VALUES = { Nascent: 1, Emerging: 2, Ready: 3 };
const DOMAIN_ORDER = ["Resources", "Teacher Capacity", "AT / DL Readiness", "School System Readiness", "Science Readiness", "Maths Readiness"];
const DOMAIN_SHORT = {"Resources":"Resources","Teacher Capacity":"Teachers","AT / DL Readiness":"AT and digital","School System Readiness":"School system","Science Readiness":"Science","Maths Readiness":"Mathematics"};

const [rubrics, seedSchools] = await Promise.all([
  fetch("data/rubrics.json").then(r => r.json()),
  fetch("data/schools.json").then(r => r.json())
]);

const state = {
  view: "dashboard",
  schools: seedSchools,
  assessments: JSON.parse(localStorage.getItem("ve-assessments") || "[]"),
  draft: null,
  step: 0,
  selectedSchool: seedSchools[0]?.id,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setView(view) {
  state.view = view;
  $$(".view").forEach(el => el.classList.toggle("active", el.id === `${view}-view`));
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const titles = {dashboard:"School readiness overview",schools:"School portfolio",assessment:"School assessment",analysis:"Readiness analysis",method:"Assessment method"};
  $("#page-title").textContent = titles[view];
  $(".sidebar").classList.remove("open");
  if (view === "analysis") renderAnalysis();
  if (view === "assessment") renderAssessment();
  window.scrollTo({top:0,behavior:"smooth"});
}

function engagementClass(value) {
  const v = value.toLowerCase();
  if (v.includes("high")) return "high";
  if (v.includes("assisted")) return "assisted";
  if (v.includes("operational")) return "autonomy";
  return "full";
}

function renderDashboard() {
  const counts = state.schools.reduce((acc, s) => (acc[s.engagement] = (acc[s.engagement] || 0) + 1, acc), {});
  const domainValues = Object.fromEntries(DOMAIN_ORDER.map(d => [d,{Nascent:0,Emerging:0,Ready:0}]));
  state.schools.forEach(s => DOMAIN_ORDER.forEach(d => { const v = s.domains[d]; if (domainValues[d][v] !== undefined) domainValues[d][v]++; }));
  const emerging = state.schools.filter(s => Object.values(s.domains).includes("Emerging")).length;
  const high = state.schools.filter(s => s.engagement === "High dependency").length;
  const metrics = [
    [state.schools.length,"Schools profiled","Baseline portfolio"],
    [emerging,"Schools with emerging domains","Targeted strengthening"],
    [high,"High-dependency schools","Intensive support"],
    [state.assessments.length,"New assessments","Saved on this device"]
  ];
  $("#metric-grid").innerHTML = metrics.map(([v,l,n]) => `<article class="metric-card"><span class="metric-label">${l}</span><strong>${v}</strong><small>${n}</small><div class="metric-accent"></div></article>`).join("");
  const levels = ["High dependency","Assisted Competency","Operational Autonomy","Full sustainability"];
  const max = Math.max(...levels.map(l => counts[l] || 0),1);
  $("#engagement-chart").innerHTML = levels.map((l,i) => `<div class="bar-column"><span class="bar-value">${counts[l] || 0}</span><div class="bar level-${i+1}" style="height:${Math.max(4,((counts[l]||0)/max)*145)}px"></div><span class="bar-label">${l}</span></div>`).join("");
  $("#evidence-queue").innerHTML = [
    ["Teacher-to-student benchmark","Agree scoring threshold"],
    ["AI certification bands","Resolve missing score ranges"],
    ["AT usage evidence","Separate availability from use"]
  ].map((x,i)=>`<div class="queue-item"><span class="queue-number">${i+1}</span><div><strong>${x[0]}</strong><small>${x[1]}</small></div></div>`).join("");
  $("#domain-bars").innerHTML = DOMAIN_ORDER.map(d => {
    const values = domainValues[d], total = Object.values(values).reduce((a,b)=>a+b,0) || 1;
    return `<div class="domain-row"><label>${DOMAIN_SHORT[d]}</label><div class="stacked-bar" aria-label="${d}"><span class="segment-nascent" style="width:${values.Nascent/total*100}%"></span><span class="segment-emerging" style="width:${values.Emerging/total*100}%"></span><span class="segment-ready" style="width:${values.Ready/total*100}%"></span></div><output>${total}</output></div>`;
  }).join("");
}

function renderSchools() {
  const levels = [...new Set(state.schools.map(s => s.engagement))];
  $("#engagement-filter").innerHTML = `<option value="">All engagement levels</option>${levels.map(l=>`<option>${esc(l)}</option>`).join("")}`;
  const draw = () => {
    const query = $("#school-search").value.toLowerCase();
    const level = $("#engagement-filter").value;
    const rows = state.schools.filter(s => (!query || `${s.name} ${s.district}`.toLowerCase().includes(query)) && (!level || s.engagement === level));
    $("#school-table-body").innerHTML = rows.map(s => `<tr><td><strong>${esc(s.name)}</strong><small>${esc(s.district)} · ${s.id}</small></td><td>${esc(s.grades)}</td><td><div class="pills" aria-label="${esc(Object.values(s.domains).join(', '))}">${DOMAIN_ORDER.map(d=>`<i class="pill-dot ${slug(s.domains[d])}" title="${esc(d)}: ${esc(s.domains[d])}"></i>`).join("")}</div></td><td><span class="badge ${engagementClass(s.engagement)}">${esc(s.engagement)}</span></td><td><button class="row-button" data-open-school="${s.id}">Open</button></td></tr>`).join("") || `<tr><td colspan="5"><div class="empty-state">No schools match this filter.</div></td></tr>`;
  };
  $("#school-search").oninput = draw;
  $("#engagement-filter").onchange = draw;
  draw();
}

function gradeBand(grades) {
  if (/10/.test(grades)) return "1-10";
  if (/7|8/.test(grades)) return "1-8";
  return "1-5";
}

function newDraft(school = null) {
  const band = gradeBand(school?.grades || "1-10");
  return {
    id: crypto.randomUUID(), schoolId: school?.id || "", schoolName: school?.name || "", district: school?.district || "",
    grades: school?.grades || "1 to 10", band, assessor: "", date: new Date().toISOString().slice(0,10),
    currentEngagement: school?.engagement || "", responses: {}, notes: "", status: "draft"
  };
}

function startAssessment(schoolId = "") {
  const school = state.schools.find(s => s.id === schoolId);
  state.draft = newDraft(school);
  state.step = 0;
  setView("assessment");
}

function assessmentDomains() { return rubrics[state.draft.band] || rubrics["1-10"]; }
function completion() {
  const indicators = assessmentDomains().flatMap(d => d.indicators);
  const answered = indicators.filter(i => state.draft.responses[i.id]?.rating).length;
  return {answered,total:indicators.length,percent:Math.round(answered/Math.max(indicators.length,1)*100)};
}

function calculateAssessment() {
  const domains = assessmentDomains().map(domain => {
    const responses = domain.indicators.map(i => state.draft.responses[i.id]).filter(Boolean);
    const applicable = responses.filter(r => r.rating !== "Not applicable");
    const scored = applicable.filter(r => RATING_VALUES[r.rating]);
    const score = scored.length ? scored.reduce((a,r)=>a+RATING_VALUES[r.rating],0)/scored.length : null;
    const coverage = applicable.length ? scored.length/applicable.length : 0;
    const level = score == null ? "Not assessable" : score < 1.67 ? "Nascent" : score < 2.34 ? "Emerging" : "Ready";
    return {name:domain.name,score,coverage,level,scored:scored.length,applicable:applicable.length,total:domain.indicators.length};
  });
  const valid = domains.filter(d => d.score != null);
  const mean = valid.length === domains.length ? valid.reduce((a,d)=>a+d.score,0)/domains.length : null;
  const nascentCount = domains.filter(d=>d.level==="Nascent").length;
  let overall = "Not assessable";
  if (mean != null) {
    if (mean < 1.67 || nascentCount >= 3) overall = "Nascent";
    else if (mean >= 2.34 && nascentCount === 0 && domains.every(d=>d.coverage>=.75)) overall = "Ready";
    else overall = "Emerging";
  }
  let engagement = "High dependency";
  if (overall === "Ready") engagement = "Full sustainability";
  else if (overall === "Emerging" && mean >= 2.1 && nascentCount === 0) engagement = "Operational Autonomy";
  else if (overall === "Emerging") engagement = "Assisted Competency";
  return {domains,mean,overall,engagement,provisional:domains.some(d=>d.coverage<.75)};
}

function captureForm() {
  const form = $("#assessment-form");
  $$('[data-draft-field]',form).forEach(el => state.draft[el.dataset.draftField] = el.value);
  $$('[data-indicator]',form).forEach(card => {
    const id = card.dataset.indicator;
    const checked = $('input[type="radio"]:checked',card);
    if (!state.draft.responses[id]) state.draft.responses[id] = {};
    if (checked) state.draft.responses[id].rating = checked.value;
    const ev = $('[data-evidence]',card); if (ev) state.draft.responses[id].evidence = ev.value;
    const src = $('[data-source]',card); if (src) state.draft.responses[id].source = src.value;
  });
  const c = completion();
  $("#completion-percent").textContent = `${c.percent}%`;
}

function renderAssessment() {
  if (!state.draft) state.draft = newDraft();
  const domains = assessmentDomains();
  const steps = ["School profile",...domains.map(d=>DOMAIN_SHORT[d.name] || d.name),"Review and confirm"];
  $("#assessment-steps").innerHTML = steps.map((s,i)=>`<li class="step ${i===state.step?'active':''} ${i<state.step?'complete':''}"><span>${i<state.step?'✓':i+1}</span>${esc(s)}</li>`).join("");
  $("#completion-percent").textContent = `${completion().percent}%`;
  if (state.step === 0) renderProfileStep();
  else if (state.step <= domains.length) renderDomainStep(domains[state.step-1]);
  else renderReviewStep();
}

function actionButtons(back = true, final = false) {
  return `<div class="form-actions"><button class="button ghost" data-prev ${back?'':'disabled'}>Back</button><div><button class="button secondary" data-save-draft>Save draft</button> <button class="button primary" ${final?'data-submit-assessment':'data-next'}>${final?'Confirm assessment':'Continue'}</button></div></div>`;
}

function renderProfileStep() {
  const d = state.draft;
  $("#assessment-form").innerHTML = `<div class="form-head"><p class="eyebrow">Pause point 1</p><h2>Confirm the school</h2><p>Choose the grade band first. It determines which rubric appears in the evidence sections.</p></div><div class="field-grid">
    <div class="field full"><label for="school-select">School</label><select id="school-select" data-draft-field="schoolId"><option value="">New school</option>${state.schools.map(s=>`<option value="${s.id}" ${d.schoolId===s.id?'selected':''}>${esc(s.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="school-name">School name</label><input id="school-name" data-draft-field="schoolName" value="${esc(d.schoolName)}" required></div>
    <div class="field"><label for="district">District</label><input id="district" data-draft-field="district" value="${esc(d.district)}"></div>
    <div class="field"><label for="grades">Grades served</label><select id="grades" data-draft-field="grades"><option ${d.grades==='1 to 5'?'selected':''}>1 to 5</option><option ${/7|8/.test(d.grades)?'selected':''}>1 to 8</option><option ${/10/.test(d.grades)?'selected':''}>1 to 10</option></select></div>
    <div class="field"><label for="assessor">Assessor</label><input id="assessor" data-draft-field="assessor" value="${esc(d.assessor)}"></div>
    <div class="field"><label for="date">Assessment date</label><input id="date" type="date" data-draft-field="date" value="${d.date}"></div>
    <div class="field"><label for="current-engagement">Current VE engagement</label><select id="current-engagement" data-draft-field="currentEngagement"><option value="">Select level</option>${["High dependency","Assisted Competency","Operational Autonomy","Full sustainability"].map(x=>`<option ${d.currentEngagement===x?'selected':''}>${x}</option>`).join("")}</select></div>
  </div>${actionButtons(false)}`;
  $("#school-select").onchange = e => { const s = state.schools.find(x=>x.id===e.target.value); if(s){state.draft={...state.draft,schoolId:s.id,schoolName:s.name,district:s.district,grades:s.grades,band:gradeBand(s.grades),currentEngagement:s.engagement};renderAssessment();} };
}

function renderDomainStep(domain) {
  const cards = domain.indicators.map((indicator,idx) => {
    const r = state.draft.responses[indicator.id] || {};
    const ratings = ["Nascent","Emerging","Ready","Not assessable","Not applicable"];
    return `<article class="indicator-card" data-indicator="${indicator.id}"><div class="indicator-title"><h4>${idx+1}. ${esc(indicator.label)}</h4><span class="badge">${idx+1} of ${domain.indicators.length}</span></div><div class="rating-options">${ratings.map(x=>`<label><input type="radio" name="rating-${indicator.id}" value="${x}" ${r.rating===x?'checked':''}><span>${x}</span></label>`).join("")}</div><div class="criteria-panel" data-criteria>${r.rating && indicator.criteria[r.rating.toLowerCase()] ? esc(indicator.criteria[r.rating.toLowerCase()]) : esc(indicator.evidence_guidance)}</div><div class="evidence-row"><input data-evidence placeholder="Evidence or observation" value="${esc(r.evidence||'')}"><select data-source><option value="">Evidence source</option>${["Direct observation","School record","Staff interview","Student work","Photo or file","Other"].map(x=>`<option ${r.source===x?'selected':''}>${x}</option>`).join("")}</select></div></article>`;
  }).join("");
  $("#assessment-form").innerHTML = `<div class="form-head"><p class="eyebrow">Evidence collection</p><h2>${esc(domain.name)}</h2><p>Rate only what the available evidence supports. “Not assessable” is preferable to an inferred score.</p></div><div class="indicator-list">${cards}</div>${actionButtons(true)}`;
  $$('.indicator-card').forEach(card => card.addEventListener('change', e => { if(e.target.type==='radio'){ const indicator = domain.indicators.find(i=>i.id===card.dataset.indicator); const criteria = indicator.criteria[e.target.value.toLowerCase()] || indicator.evidence_guidance; $('[data-criteria]',card).textContent=criteria; captureForm(); }}));
  $$('[data-evidence],[data-source]').forEach(el=>el.addEventListener('input',captureForm));
}

function renderReviewStep() {
  const result = calculateAssessment();
  const incomplete = result.domains.filter(d=>d.coverage<.75);
  const missingEvidence = assessmentDomains().flatMap(d=>d.indicators).filter(i => { const r=state.draft.responses[i.id]; return r && RATING_VALUES[r.rating] && !r.evidence; });
  $("#assessment-form").innerHTML = `<div class="form-head"><p class="eyebrow">Final pause point</p><h2>Review before confirming</h2><p>Use this do-confirm check to catch missing evidence and discuss the recommended engagement level.</p></div>
    ${incomplete.length||missingEvidence.length?`<div class="pause-banner"><strong>Critical checks remain</strong><span>${incomplete.length} domain(s) are below 75% evidence coverage. ${missingEvidence.length} scored response(s) have no evidence note.</span></div>`:`<div class="pause-banner" style="border-color:var(--leaf);background:#edf5ef"><strong>Core checks complete</strong><span>Every domain has sufficient evidence coverage. Confirm the result with the school team.</span></div>`}
    <div class="review-grid"><div class="review-card"><strong>Overall readiness</strong><span>${result.overall}</span><small>${result.mean?result.mean.toFixed(2)+' / 3':'Insufficient evidence'}</small></div><div class="review-card"><strong>Recommended VE approach</strong><span style="font-size:17px">${result.engagement}</span><small>${result.provisional?'Provisional result':'Evidence threshold met'}</small></div><div class="review-card"><strong>Completion</strong><span>${completion().percent}%</span><small>${completion().answered} of ${completion().total} indicators</small></div></div>
    <div class="warning-list">${incomplete.map(d=>`<div class="warning-item"><strong>${esc(d.name)}:</strong> ${Math.round(d.coverage*100)}% evidence coverage</div>`).join('')}${missingEvidence.slice(0,6).map(i=>`<div class="warning-item">Add evidence for “${esc(i.label)}”</div>`).join('')}</div>
    <div class="field"><label for="assessment-notes">Review notes and agreed next steps</label><textarea id="assessment-notes" data-draft-field="notes">${esc(state.draft.notes)}</textarea></div>${actionButtons(true,true)}`;
}

async function saveDraft(final = false) {
  captureForm();
  state.draft.status = final ? "complete" : "draft";
  state.draft.result = calculateAssessment();
  state.draft.updatedAt = new Date().toISOString();
  const ix = state.assessments.findIndex(a=>a.id===state.draft.id);
  if(ix>=0) state.assessments[ix]=structuredClone(state.draft); else state.assessments.unshift(structuredClone(state.draft));
  localStorage.setItem("ve-assessments",JSON.stringify(state.assessments));
  if(CONFIG.supabaseAnonKey) {
    try { await supabaseUpsert(state.draft); notify(final?"Assessment confirmed and synced":"Draft saved and synced"); }
    catch(err){ console.error(err); notify("Saved locally; Supabase sync needs attention"); }
  } else notify(final?"Assessment confirmed on this device":"Draft saved on this device");
  renderDashboard();
  if(final){ state.selectedSchool=state.draft.schoolId||state.schools[0].id; setView("analysis"); }
}

async function supabaseUpsert(draft) {
  const response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/assessments?on_conflict=id`,{method:"POST",headers:{apikey:CONFIG.supabaseAnonKey,Authorization:`Bearer ${CONFIG.supabaseAnonKey}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},body:JSON.stringify({id:draft.id,school_id:draft.schoolId||null,school_name:draft.schoolName,district:draft.district,grade_band:draft.band,assessor_name:draft.assessor,assessment_date:draft.date,current_engagement:draft.currentEngagement,status:draft.status,responses:draft.responses,results:draft.result,notes:draft.notes})});
  if(!response.ok) throw new Error(await response.text());
}

function renderAnalysis() {
  const select = $("#analysis-school");
  select.innerHTML = state.schools.map(s=>`<option value="${s.id}" ${s.id===state.selectedSchool?'selected':''}>${esc(s.name)}</option>`).join("");
  select.onchange = e => {state.selectedSchool=e.target.value;renderAnalysis();};
  const school = state.schools.find(s=>s.id===state.selectedSchool) || state.schools[0];
  const latest = state.assessments.find(a=>a.schoolId===school.id && a.status==='complete');
  const domainRows = latest?.result?.domains || DOMAIN_ORDER.map(name=>({name,level:school.domains[name],score:RATING_VALUES[school.domains[name]],coverage:1}));
  const average = latest?.result?.mean || domainRows.reduce((a,d)=>a+(d.score||0),0)/domainRows.length;
  const overall = latest?.result?.overall || (average<1.67?'Nascent':average<2.34?'Emerging':'Ready');
  const engagement = latest?.result?.engagement || school.engagement;
  const weak = [...domainRows].filter(d=>d.score!=null).sort((a,b)=>a.score-b.score).slice(0,3);
  const suggestions = weak.map(d=>{
    const map={"Resources":"Prioritise accessible materials and confirm adequate coverage across grades.","Teacher Capacity":"Plan teacher practice support with observable classroom follow-through.","AT / DL Readiness":"Separate device availability, teacher skill, and regular student use in the action plan.","School System Readiness":"Agree leadership-owned actions for staffing, class organisation, and student support.","Science Readiness":"Strengthen accessible practical learning, tactile resources, and qualified teaching support.","Maths Readiness":"Build consistent written mathematics and Nemeth support with evidence of independent student work."};
    return `<div class="recommendation"><strong>${esc(d.name)}</strong><br>${map[d.name]||'Review priority evidence and agree a school-owned next step.'}</div>`;
  }).join('');
  $("#analysis-content").innerHTML = `<div class="analysis-grid"><section class="school-hero"><div><p class="eyebrow" style="color:#9fc4b1">${esc(school.id)} · ${esc(school.grades)}</p><h2>${esc(school.name)}</h2><p>${esc(school.district)} · ${esc(engagement)}${latest?' · Latest digital assessment':''}</p></div><div class="score-ring"><div><strong>${average.toFixed(2)}</strong><small>${overall}</small></div></div></section><article class="panel"><p class="eyebrow">Six-domain profile</p><h3>Readiness scores</h3><div class="domain-score-list">${domainRows.map(d=>`<div class="score-line"><span>${esc(DOMAIN_SHORT[d.name]||d.name)}</span><div class="score-track"><span style="width:${(d.score||0)/3*100}%"></span></div><b>${d.score?d.score.toFixed(1):'—'}</b></div>`).join('')}</div></article><article class="panel"><p class="eyebrow">Planning response</p><h3>Priority actions</h3><div class="recommendation-list">${suggestions}</div></article></div>`;
}

function exportData() {
  const payload = {exportedAt:new Date().toISOString(),schools:state.schools,assessments:state.assessments};
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  const a=document.createElement('a');a.href=url;a.download=`ve-school-readiness-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
  notify("Data export downloaded");
}

document.addEventListener("click", e => {
  const nav=e.target.closest("[data-view]"); if(nav) setView(nav.dataset.view);
  const link=e.target.closest("[data-view-link]"); if(link) setView(link.dataset.viewLink);
  if(e.target.closest("[data-start-assessment]")) startAssessment();
  const open=e.target.closest("[data-open-school]"); if(open){state.selectedSchool=open.dataset.openSchool;setView("analysis");}
  if(e.target.closest("#menu-button")) $(".sidebar").classList.toggle("open");
  if(e.target.closest("#export-button")) exportData();
  if(e.target.closest("[data-next]")){captureForm();if(state.step===0){state.draft.band=gradeBand(state.draft.grades);}state.step++;renderAssessment();}
  if(e.target.closest("[data-prev]")){captureForm();state.step=Math.max(0,state.step-1);renderAssessment();}
  if(e.target.closest("[data-save-draft]")) saveDraft(false);
  if(e.target.closest("[data-submit-assessment]")) saveDraft(true);
});

if(CONFIG.supabaseAnonKey){$("#sync-dot").classList.add("online");$("#sync-label").textContent="Supabase connected";$("#sync-detail").textContent="Project yhaloppwmvdyzssknkpc";}
renderDashboard();renderSchools();renderAnalysis();
