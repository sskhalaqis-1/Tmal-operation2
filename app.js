const state = {
  config: null,
  records: { checklists: [], inventory_counts: [], issues: [], sales_uploads: [] },
  session: JSON.parse(localStorage.getItem("coffeeOpsSession") || "null"),
  language: localStorage.getItem("coffeeOpsLanguage") || "en",
};

function dict() {
  return window.COFFEE_OPS_TRANSLATIONS[state.language];
}

function t(key) {
  return key.split(".").reduce((value, part) => value?.[part], dict()) ?? key;
}

function moneyFormatter() {
  return new Intl.NumberFormat(state.language === "ar" ? "ar-SA" : "en", { style: "currency", currency: "SAR" });
}

function dateFormatter() {
  return new Intl.DateTimeFormat(state.language === "ar" ? "ar-SA" : "en", { dateStyle: "medium", timeStyle: "short" });
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.session?.token) headers.set("Authorization", `Bearer ${state.session.token}`);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (response.status === 401 && path !== "/api/login") {
    setSession(null);
  }
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function fillSelect(select, values, formatter = (value) => value) {
  if (!select) return;
  const safeValues = Array.isArray(values) ? values : [];
  select.innerHTML = safeValues.map((value) => `<option value="${value}">${formatter(value)}</option>`).join("");
}

function normalizeConfig(config = {}) {
  const defaults = {
    branches: ["Main Branch"],
    issueTypes: ["Shortage", "Expired product", "Missing date label", "Maintenance issue", "Repeated mistake", "Workflow problem"],
    checklistTasks: { opening: [], closing: [], cleaning: [], machine: [] },
    inventoryItems: [],
  };
  return {
    ...defaults,
    ...config,
    branches: Array.isArray(config.branches) ? config.branches : defaults.branches,
    issueTypes: Array.isArray(config.issueTypes) ? config.issueTypes : defaults.issueTypes,
    inventoryItems: Array.isArray(config.inventoryItems) ? config.inventoryItems : defaults.inventoryItems,
    checklistTasks: {
      ...defaults.checklistTasks,
      ...(config.checklistTasks || {}),
    },
  };
}

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelector("#languageButton").textContent = t("languageSwitch");
}

function setLanguage(language) {
  state.language = language;
  localStorage.setItem("coffeeOpsLanguage", language);
  applyTranslations();
  if (state.config) renderConfig();
  renderCurrentData();
}

function setSession(session) {
  state.session = session;
  if (session) localStorage.setItem("coffeeOpsSession", JSON.stringify(session));
  else localStorage.removeItem("coffeeOpsSession");
  updateAccessUI();
}

function setScreen(name) {
  if (!state.session) {
    name = "login";
  }
  if (name === "admin" && state.session?.role !== "admin") {
    showToast(t("adminOnly"));
    name = "staff";
  }

  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.querySelector(`#${name}Screen`)?.classList.add("active");
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.screen === name));
  if (name === "admin") refreshAdmin();
  if (name === "staff") refreshStaffStats();
}

function updateAccessUI() {
  const loggedIn = Boolean(state.session);
  document.querySelector("#logoutButton").classList.toggle("hidden", !loggedIn);
  document.querySelector(".tabs").classList.toggle("hidden", !loggedIn);
  document.querySelector('[data-screen="admin"]').classList.toggle("hidden", state.session?.role !== "admin");
  document.querySelector("#signedInText").textContent = state.session ? `${t("signedInAs")} ${state.session.employee}` : "";
  setScreen(!loggedIn ? "login" : state.session.role === "admin" ? "admin" : "staff");
}

function renderConfig() {
  state.config = normalizeConfig(state.config);
  const { branches, issueTypes, checklistTasks, inventoryItems } = state.config;
  ["checklistBranch", "inventoryBranch", "issueBranch"].forEach((id) => fillSelect(document.querySelector(`#${id}`), branches));
  document.querySelectorAll(".shiftSelect").forEach((select) => {
    fillSelect(select, ["morning", "evening", "full_day"], (value) => t(`shifts.${value}`));
  });
  document.querySelectorAll(".checklistTypeSelect").forEach((select) => {
    fillSelect(select, ["opening", "closing"], (value) => t(`checklistTypes.${value}`));
  });
  fillSelect(document.querySelector("#baristaRoleSelect"), ["head", "assistant"], (value) => t(`baristaRoles.${value}`));
  fillSelect(document.querySelector("#prioritySelect"), ["Normal", "High", "Urgent"], (value) => t(`priorities.${value}`));
  fillSelect(document.querySelector("#issueType"), issueTypes, (value) => t(`issueTypes.${value}`));

  const taskGroups = [
    ["Opening", Array.isArray(checklistTasks.opening) ? checklistTasks.opening : []],
    ["Closing", Array.isArray(checklistTasks.closing) ? checklistTasks.closing : []],
    ["Cleaning", Array.isArray(checklistTasks.cleaning) ? checklistTasks.cleaning : []],
    ["Machine readiness", Array.isArray(checklistTasks.machine) ? checklistTasks.machine : []],
  ];
  const checklistTasksBox = document.querySelector("#checklistTasks");
  if (checklistTasksBox) {
    checklistTasksBox.innerHTML = taskGroups.map(([title, tasks]) => `
      <div>
        <h3>${t(`taskGroups.${title}`)}</h3>
        ${tasks.map((task) => `
          <label class="check-row">
            <span>${task}</span>
            <input type="checkbox" name="task:${task}" />
          </label>
        `).join("")}
      </div>
    `).join("");
  }

  document.querySelector("#inventoryItems").innerHTML = inventoryItems.map((item) => `
    <label class="inventory-row">
      <div>
        <strong>${inventoryName(item)}</strong>
        <span>${t(`categories.${item.category}`)} · ${t(`units.${item.unit}`)}</span>
      </div>
      <input type="number" step="0.01" min="0" name="${item.id}" placeholder="0" />
    </label>
  `).join("");

  document.querySelectorAll('input[name="submissionDate"]').forEach((input) => {
    if (!input.value) input.value = todayValue();
  });
  document.querySelectorAll('input[name="employee"]').forEach((input) => {
    if (!input.value && state.session?.employee) input.value = state.session.employee;
  });
  suggestBaristaRole();
  updateRoleChecklist();
}

async function fileToDataUrl(file) {
  if (!file) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function suggestBaristaRole() {
  const employee = (state.session?.employee || document.querySelector('#checklistForm input[name="employee"]')?.value || "").trim().toLowerCase();
  const select = document.querySelector("#baristaRoleSelect");
  if (!select) return;
  if (employee.includes("habib") || employee.includes("حبيب")) select.value = "assistant";
  if (employee.includes("youssef") || employee.includes("yousef") || employee.includes("يوسف")) select.value = "head";
}

function updateRoleChecklist() {
  const selectedRole = document.querySelector("#baristaRoleSelect")?.value || "head";
  document.querySelectorAll("[data-role-section]").forEach((section) => {
    const isActive = section.dataset.roleSection === selectedRole;
    section.classList.toggle("hidden", !isActive);
    section.querySelectorAll("input, textarea, select").forEach((field) => {
      field.disabled = !isActive;
    });
  });
  updateConditionalFields();
}

function updateConditionalFields() {
  document.querySelectorAll("[data-toggle-target]").forEach((toggle) => {
    const field = document.querySelector(`[data-conditional="${toggle.dataset.toggleTarget}"]`);
    if (!field) return;
    const shouldShow = toggle.checked && !toggle.disabled;
    field.classList.toggle("hidden", !shouldShow);
    field.querySelectorAll("input, textarea, select").forEach((input) => {
      input.disabled = !shouldShow;
    });
  });
}

function inventoryName(item) {
  const translated = t(`inventoryNames.${item.id}`);
  if (translated !== `inventoryNames.${item.id}`) return translated;
  return state.language === "ar" && item.name_ar ? item.name_ar : item.name;
}

async function formFileData(form) {
  const photos = {};
  for (const input of form.querySelectorAll('input[type="file"]')) {
    if (input.disabled || !input.files?.[0]) continue;
    photos[input.name] = {
      name: input.files[0].name,
      preview: await fileToDataUrl(input.files[0]),
    };
  }
  return photos;
}

function visibleChecklistData(form, values) {
  const data = {};
  const checkedTasks = [];
  const missingTasks = [];
  form.querySelectorAll("input, textarea, select").forEach((field) => {
    if (field.disabled || field.type === "file" || !field.name) return;
    if (field.type === "checkbox") {
      data[field.name] = field.checked;
      const label = field.closest("label")?.querySelector("span")?.textContent?.trim();
      if (label) (field.checked ? checkedTasks : missingTasks).push(label);
      return;
    }
    data[field.name] = values[field.name] ?? "";
  });
  return { data, checkedTasks, missingTasks };
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = formValues(form);
  try {
    const session = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSession(session);
    renderConfig();
    await renderCurrentData();
  } catch {
    showToast(t("loginFailed"));
  }
}

async function logout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {
    // Local logout still clears the browser session.
  }
  setSession(null);
}

function submissionPayload(values) {
  return {
    employee: values.employee || state.session?.employee,
    branch: values.branch,
    shift: values.shift,
    submission_date: values.submissionDate || todayValue(),
  };
}

async function submitChecklist(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = formValues(form);
  const { data, checkedTasks, missingTasks } = visibleChecklistData(form, values);
  const photos = await formFileData(form);
  await api("/api/checklists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...submissionPayload(values),
      type: values.baristaRole,
      role_label: t(`baristaRoles.${values.baristaRole}`),
      checklist_data: data,
      checked_tasks: checkedTasks,
      missing_tasks: missingTasks,
      photos,
    }),
  });
  form.reset();
  renderConfig();
  showToast(t("checklistSubmitted"));
  await renderCurrentData();
}

async function submitInventory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = formValues(form);
  const items = state.config.inventoryItems.map((item) => ({
    ...item,
    quantity: Number(values[item.id] || 0),
  }));
  const saved = await api("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...submissionPayload(values), items }),
  });
  form.reset();
  renderConfig();
  showToast(saved.comparison.some((item) => item.unusual) ? t("inventoryUnusual") : t("inventorySubmitted"));
  await renderCurrentData();
}

async function submitIssue(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = formValues(form);
  await api("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...submissionPayload(values), type: values.type, priority: values.priority, details: values.details }),
  });
  form.reset();
  renderConfig();
  showToast(t("issueReported"));
  await renderCurrentData();
}

async function submitSales(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = new FormData(form);
  await api("/api/sales-upload", { method: "POST", body });
  form.reset();
  showToast(t("salesUploaded"));
  await refreshAdmin();
}

async function updateIssue(id, status) {
  const comment = document.querySelector(`[data-comment="${id}"]`)?.value || "";
  await api(`/api/issues/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, comment }),
  });
  showToast(t("issueUpdated"));
  await refreshAdmin();
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function formatDate(value) {
  return dateFormatter().format(new Date(value));
}

function recordMeta(item) {
  const shift = item.shift ? t(`shifts.${item.shift}`) : "";
  return [item.branch, item.employee, shift, item.submission_date, formatDate(item.created_at)].filter(Boolean).join(" · ");
}

function statusPill(status) {
  return `<span class="status ${status.replace(/\s+/g, "")}">${t(`statuses.${status}`)}</span>`;
}

function refreshStaffStats() {
  const today = new Date();
  document.querySelector("#todayText").textContent = dateFormatter().format(today);
  document.querySelector("#signedInText").textContent = state.session ? `${t("signedInAs")} ${state.session.employee}` : "";
}

function todayRecords(records) {
  const today = todayValue();
  return records.filter((item) => (item.submission_date || item.created_at?.slice(0, 10)) === today);
}

function expectedSubmissions(dash) {
  const checkBranches = new Set(dash.checklists_today.map((item) => item.branch));
  const invBranches = new Set(dash.inventory_today.map((item) => item.branch));
  return state.config.branches.flatMap((branch) => {
    const missing = [];
    if (!checkBranches.has(branch)) missing.push({ branch, type: t("dailyChecklist") });
    if (!invBranches.has(branch)) missing.push({ branch, type: t("dailyInventory") });
    return missing;
  });
}

function renderMiniStats(dash) {
  document.querySelector("#miniChecks").textContent = dash.checklists_today.length;
  document.querySelector("#miniInv").textContent = dash.inventory_today.length;
  document.querySelector("#miniIssues").textContent = dash.open_issues.length;
}

function renderMetrics(dash) {
  const totalSubmissions = dash.checklists_today.length + dash.inventory_today.length + todayRecords(state.records.issues).length;
  const missingCount = expectedSubmissions(dash).length;
  document.querySelector("#dashSubmissions").textContent = totalSubmissions;
  document.querySelector("#dashMissingCount").textContent = missingCount;
  document.querySelector("#dashIssues").textContent = dash.open_issues.length;
  document.querySelector(".urgent-card").classList.toggle("urgent-card-active", missingCount > 0);
  if (dash.latest_sales) {
    document.querySelector("#dashSales").textContent = moneyFormatter().format(dash.latest_sales.summary.total_sales || 0);
    document.querySelector("#dashOrders").textContent = `${dash.latest_sales.summary.order_count || 0} ${t("orders")}`;
  } else {
    document.querySelector("#dashSales").textContent = t("noUpload");
    document.querySelector("#dashOrders").textContent = "";
  }
}

function yesNo(value) {
  return value ? t("submitted") : t("missing");
}

function formatValue(value) {
  if (value === true || value === false) return yesNo(value);
  if (value === undefined || value === null || value === "") return "-";
  return value;
}

function detailRows(data, rows) {
  return rows.map(([label, key]) => `
    <tr>
      <td>${label}</td>
      <td><strong>${formatValue(data?.[key])}</strong></td>
    </tr>
  `).join("");
}

function photoGrid(photos = {}, keys = []) {
  const items = keys
    .map(([label, key]) => ({ label, photo: photos[key] }))
    .filter((item) => item.photo?.preview);
  if (!items.length) return "";
  return `
    <div class="photo-grid">
      ${items.map((item) => `
        <figure>
          <img src="${item.photo.preview}" alt="${item.label}" />
          <figcaption>${item.label}</figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function inventorySubmissionTable(item) {
  const comparisonById = Object.fromEntries((item.comparison || []).map((entry) => [entry.id, entry]));
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>${t("dailyInventory")}</th><th>${t("quantity")}</th><th>${t("inventoryChanges")}</th></tr></thead>
        <tbody>
          ${(item.items || []).map((invItem) => {
            const comparison = comparisonById[invItem.id] || {};
            const deltaText = comparison.delta === undefined || comparison.delta === null ? t("firstCount") : `${comparison.delta > 0 ? "+" : ""}${comparison.delta}`;
            return `<tr class="${comparison.unusual ? "urgent-row" : ""}">
              <td>${inventoryName(invItem)}<small>${t(`categories.${invItem.category}`)}</small></td>
              <td><strong>${invItem.quantity} ${t(`units.${invItem.unit}`)}</strong></td>
              <td>${deltaText}${comparison.unusual ? `<span class="badge urgent-badge">${t("unusual")}</span>` : ""}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderChecklistDetails(item) {
  const data = item.checklist_data || {};
  const photos = item.photos || {};
  const isAssistant = item.type === "assistant";
  if (isAssistant) {
    return `
      <div class="detail-block">
        <h4>${t("baristaRoles.assistant")}</h4>
        <h4>${t("startOfShift")}</h4>
      </div>
      <div class="table-wrap">
        <table>
          <tbody>
            ${detailRows(data, [
              [t("milkFridgeTemperature"), "milkFridgeTemperature"],
              [t("dessertFridgeTemperature"), "dessertFridgeTemperature"],
            ])}
          </tbody>
        </table>
      </div>
      <div class="detail-block"><h4>${t("productChecks")}</h4></div>
      <div class="table-wrap">
        <table>
          <tbody>
            ${detailRows(data, [
              [t("syrupsDatesChecked"), "syrupsDatesChecked"],
              [t("dessertDatesChecked"), "dessertDatesChecked"],
              [t("expiredProductsRemoved"), "expiredProductsRemoved"],
            ])}
          </tbody>
        </table>
      </div>
      <div class="detail-block"><h4>${t("barPreparation")}</h4></div>
      <div class="table-wrap">
        <table>
          <tbody>
            ${detailRows(data, [
              [t("takeawayCupsRefilled"), "takeawayCupsRefilled"],
              [t("lidsRefilled"), "lidsRefilled"],
              [t("sugarRefilled"), "sugarRefilled"],
              [t("saucesRefilled"), "saucesRefilled"],
              [t("coffeeBeansRefilled"), "coffeeBeansRefilled"],
              [t("suppliesRefilled"), "suppliesRefilled"],
            ])}
          </tbody>
        </table>
      </div>
      <div class="detail-block"><h4>${t("coffeeBeanManagement")}</h4></div>
      <div class="table-wrap">
        <table>
          <tbody>
            ${detailRows(data, [
              [t("multipleOpenedBagsQuestion"), "hasMultipleOpenedBags"],
              [t("coffeeName"), "openedCoffeeName"],
            ])}
          </tbody>
        </table>
      </div>
      <div class="detail-block"><h4>${t("fridgeOrganization")}</h4></div>
      <div class="table-wrap">
        <table>
          <tbody>
            ${detailRows(data, [
              [t("fridgesOrganized"), "fridgesOrganized"],
              [t("olderProductsInFront"), "olderProductsInFront"],
              [t("noUndatedOpenedProducts"), "noUndatedOpenedProducts"],
            ])}
          </tbody>
        </table>
      </div>
      ${photoGrid(photos, [
        [t("milkFridgePhoto"), "milkFridgePhotoStart"],
        [t("dessertFridgePhoto"), "dessertFridgePhotoStart"],
        [t("preparedBarPhoto"), "preparedBarPhoto"],
        [`${t("endOfShift")} - ${t("milkFridgePhoto")}`, "milkFridgePhotoEnd"],
        [`${t("endOfShift")} - ${t("dessertFridgePhoto")}`, "dessertFridgePhotoEnd"],
      ])}
    `;
  }
  return `
    <div class="detail-block">
      <h4>${t("baristaRoles.head")}</h4>
      <h4>${t("waterReadings")}</h4>
    </div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${detailRows(data, [
            [t("tdsWaterFilter"), "tdsWaterFilter"],
            [t("tdsEspressoMachineWater"), "tdsEspressoMachineWater"],
            [t("tdsVeloKettle"), "tdsVeloKettle"],
            [t("tdsBrewistaKettle"), "tdsBrewistaKettle"],
          ])}
        </tbody>
      </table>
    </div>
    <div class="detail-block"><h4>${t("espressoMachine")}</h4></div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${detailRows(data, [
            [t("machinePressure"), "machinePressure"],
          ])}
        </tbody>
      </table>
    </div>
    <div class="detail-block"><h4>${t("grinders")}</h4></div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${detailRows(data, [
            [t("espressoGrinderChecked"), "espressoGrinderChecked"],
            [t("dripGrinderChecked"), "dripGrinderChecked"],
          ])}
        </tbody>
      </table>
    </div>
    <div class="detail-block"><h4>${t("espressoCalibration")}</h4></div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${detailRows(data, [
            [t("doseGrams"), "doseGrams"],
            [t("yieldGrams"), "yieldGrams"],
            [t("timeSeconds"), "timeSeconds"],
          ])}
        </tbody>
      </table>
    </div>
    <div class="detail-block"><h4>${t("startOfShift")}</h4></div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${detailRows(data, [
            [t("startShiftIssuesQuestion"), "hasStartShiftIssue"],
            [t("issueDescription"), "startShiftIssueDescription"],
          ])}
        </tbody>
      </table>
    </div>
    <div class="detail-block"><h4>${t("duringShift")}</h4></div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${detailRows(data, [
            [t("remadeDrinksQuestion"), "hasRemadeDrinks"],
            [t("numberOfRemadeDrinks"), "numberOfRemadeDrinks"],
            [t("remakeReason"), "remakeReason"],
          ])}
        </tbody>
      </table>
    </div>
    <div class="detail-block"><h4>${t("endOfShift")}</h4></div>
    <div class="table-wrap">
      <table>
        <tbody>
          ${detailRows(data, [
            [t("handoverCompleted"), "handoverCompleted"],
          ])}
        </tbody>
      </table>
    </div>
    ${photoGrid(photos, [
      [t("espressoCalibrationPhoto"), "espressoCalibrationPhoto"],
      [t("barClosingPhoto"), "barClosingPhoto"],
    ])}
  `;
}

function renderTodaySubmissions(dash) {
  const issueToday = todayRecords(state.records.issues);
  const entries = [
    ...dash.checklists_today.map((item) => ({ label: t("dailyChecklist"), item, status: "Submitted" })),
    ...dash.inventory_today.map((item) => ({ label: t("dailyInventory"), item, status: "Submitted" })),
    ...issueToday.map((item) => ({ label: t("shortagesIssues"), item, status: item.priority === "Urgent" ? "Open" : "Submitted" })),
  ].sort((a, b) => new Date(b.item.created_at) - new Date(a.item.created_at));
  document.querySelector("#todaySubmissionsList").innerHTML = entries.length ? entries.map(({ label, item, status }) => `
    <article class="item-card ${item.priority === "Urgent" ? "urgent" : ""}">
      <header><strong>${label}</strong><span class="status ${status}">${status === "Submitted" ? t("submitted") : t("urgent")}</span></header>
      <p class="meta">${recordMeta(item)}</p>
      ${item.checklist_data ? renderChecklistDetails(item) : ""}
      ${item.items ? inventorySubmissionTable(item) : ""}
      ${item.details ? `<div class="detail-block"><h4>${t("details")}</h4><p>${item.details}</p></div>` : ""}
    </article>
  `).join("") : empty(t("noChecklistToday"));
}

function renderMissingSubmissions(dash) {
  const missing = expectedSubmissions(dash);
  document.querySelector("#missingSubmissionsList").innerHTML = missing.length ? missing.map((item) => `
    <article class="item-card urgent">
      <header><strong>${item.branch}</strong><span class="status Open">${t("missing")}</span></header>
      <p>${item.type}</p>
    </article>
  `).join("") : empty(t("allTasksChecked"));
}

function renderInventoryChanges(dash) {
  const submissions = dash.inventory_today.length ? dash.inventory_today.slice().reverse() : state.records.inventory_counts.slice(-3).reverse();
  if (!submissions.length) {
    document.querySelector("#inventoryChanges").innerHTML = empty(t("noInventoryToday"));
    return;
  }
  document.querySelector("#inventoryChanges").innerHTML = submissions.map((submission) => `
    <article class="item-card">
      <header><strong>${t("dailyInventory")}</strong><span class="status Submitted">${t("submitted")}</span></header>
      <p class="meta">${recordMeta(submission)}</p>
      ${inventorySubmissionTable(submission)}
    </article>
  `).join("");
}

function renderIssues() {
  const issues = state.records.issues.slice().reverse();
  if (!issues.length) {
    document.querySelector("#issueList").innerHTML = empty(t("noOpenIssues"));
    return;
  }
  document.querySelector("#issueList").innerHTML = issues.map((issue) => `
    <article class="item-card ${issue.priority === "Urgent" ? "urgent" : ""}">
      <header>
        <strong>${t(`issueTypes.${issue.type}`)} · ${issue.branch}</strong>
        ${statusPill(issue.status)}
      </header>
      <p>${issue.details}</p>
      <p class="meta">${t(`priorities.${issue.priority}`)} · ${recordMeta(issue)}</p>
      ${issue.comments?.length ? `<p class="meta">${issue.comments.map((comment) => comment.text).join(" | ")}</p>` : ""}
      <div class="issue-actions">
        <input data-comment="${issue.id}" placeholder="${t("managerComment")}" />
        <button class="secondary" type="button" onclick="updateIssue('${issue.id}', 'In Progress')">${t("inProgress")}</button>
        <button class="secondary" type="button" onclick="updateIssue('${issue.id}', 'Resolved')">${t("resolve")}</button>
      </div>
    </article>
  `).join("");
}

function renderSales(dash) {
  const upload = dash.latest_sales;
  if (!upload) {
    document.querySelector("#salesSummary").innerHTML = empty(t("noSales"));
    return;
  }
  const summary = upload.summary;
  document.querySelector("#salesSummary").innerHTML = `
    <article class="item-card">
      <header><strong>${upload.filename}</strong><span class="badge">${formatDate(upload.created_at)}</span></header>
      <p>${t("totalSales")}: <strong>${moneyFormatter().format(summary.total_sales || 0)}</strong></p>
      <p>${t("orders")}: <strong>${summary.order_count || 0}</strong></p>
    </article>
    <h3>${t("topProducts")}</h3>
    ${(summary.top_products || []).map((item) => `<div class="item-card"><strong>${item.name}</strong><p class="meta">${t("quantity")} ${item.quantity} · ${moneyFormatter().format(item.sales || 0)}</p></div>`).join("")}
    <h3>${t("salesByCategory")}</h3>
    ${(summary.sales_by_category || []).map((item) => `<div class="item-card"><strong>${item.category}</strong><p class="meta">${moneyFormatter().format(item.sales || 0)}</p></div>`).join("")}
  `;
}

function renderWeekly(dash) {
  const weekly = dash.weekly_summary;
  document.querySelector("#weeklySummary").innerHTML = `
    <article class="item-card"><strong>${weekly.checklists}</strong><p class="meta">${t("checklists")}</p></article>
    <article class="item-card"><strong>${weekly.inventory_counts}</strong><p class="meta">${t("counts")}</p></article>
    <article class="item-card"><strong>${weekly.open_issues}</strong><p class="meta">${t("openIssues")}</p></article>
    <article class="item-card"><strong>${moneyFormatter().format(weekly.sales_total_recent_uploads || 0)}</strong><p class="meta">${t("latestSales")}</p></article>
  `;
}

async function refreshAdmin() {
  if (state.session?.role !== "admin") return;
  const [records, dash] = await Promise.all([api("/api/state"), api("/api/dashboard")]);
  state.records = records;
  renderMiniStats(dash);
  renderMetrics(dash);
  renderTodaySubmissions(dash);
  renderMissingSubmissions(dash);
  renderInventoryChanges(dash);
  renderIssues();
  renderSales(dash);
  renderWeekly(dash);
}

async function renderCurrentData() {
  if (!state.session) return;
  if (state.session.role === "admin") await refreshAdmin();
  else refreshStaffStats();
}

async function init() {
  state.config = await api("/api/config");
  applyTranslations();
  renderConfig();
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setScreen(tab.dataset.screen)));
  document.querySelector("#languageButton").addEventListener("click", () => setLanguage(state.language === "en" ? "ar" : "en"));
  document.querySelector("#logoutButton").addEventListener("click", logout);
  document.querySelector("#roleSelect").addEventListener("change", (event) => {
    const isAdmin = event.target.value === "admin";
    document.querySelector("#pinField").classList.toggle("hidden", isAdmin);
    document.querySelector("#passwordField").classList.toggle("hidden", !isAdmin);
  });
  document.querySelector("#baristaRoleSelect").addEventListener("change", updateRoleChecklist);
  document.querySelector('#checklistForm input[name="employee"]').addEventListener("input", () => {
    suggestBaristaRole();
    updateRoleChecklist();
  });
  document.querySelectorAll("[data-toggle-target]").forEach((toggle) => {
    toggle.addEventListener("change", updateConditionalFields);
  });
  document.querySelector("#loginForm").addEventListener("submit", login);
  document.querySelector("#checklistForm").addEventListener("submit", submitChecklist);
  document.querySelector("#inventoryForm").addEventListener("submit", submitInventory);
  document.querySelector("#issueForm").addEventListener("submit", submitIssue);
  document.querySelector("#salesForm").addEventListener("submit", submitSales);
  updateAccessUI();
}

init().catch((error) => showToast(error.message));
document.addEventListener("click", function (event) {
  const img = event.target.closest("img");

  if (!img || !img.src) return;

  const overlay = document.createElement("div");
  overlay.className = "image-lightbox";
  overlay.innerHTML = `
    <div class="image-lightbox-content">
      <button class="image-lightbox-close" type="button">×</button>
      <img src="${img.src}" alt="Full size image">
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener("click", function (e) {
    if (
      e.target === overlay ||
      e.target.classList.contains("image-lightbox-close")
    ) {
      overlay.remove();
    }
  });
});
