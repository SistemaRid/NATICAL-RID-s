(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBVnWDyQXWNf9JFE3S5W_eDqmrp7B4_nTE",
    authDomain: "natical-rids.firebaseapp.com",
    projectId: "natical-rids",
    storageBucket: "natical-rids.firebasestorage.app",
    messagingSenderId: "954479408416",
    appId: "1:954479408416:web:292797e541d84487021345"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const secondaryApp = firebase.apps.find((app) => app.name === "SecondaryFuncionarios") || firebase.initializeApp(firebaseConfig, "SecondaryFuncionarios");

  const auth = firebase.auth();
  const secondaryAuth = secondaryApp.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  const db = firebase.firestore();
  const RID_FORM_SETTINGS_DOC = db.collection("appSettings").doc("ridFormSchema");
  const DEFAULT_EMPLOYEE_FORM_SCHEMA = [
    { key: "name", label: "Nome", type: "text", required: true, placeholder: "Nome completo", helperText: "", options: [] },
    { key: "email", label: "Email", type: "email", required: false, placeholder: "email@empresa.com", helperText: "", options: [] },
    { key: "cpf", label: "CPF", type: "text", required: true, placeholder: "000.000.000-00", helperText: "", options: [] },
    {
      key: "unit",
      label: "Unidade",
      type: "select",
      required: false,
      placeholder: "",
      helperText: "",
      options: [
        { value: "CALTINS", label: "CALTINS" },
        { value: "CALTINS XAMBIOA II", label: "CALTINS XAMBIOA II" },
        { value: "FORMACAL", label: "FORMACAL" },
        { value: "GESSOTINS", label: "GESSOTINS" },
        { value: "MINERAX", label: "MINERAX" },
        { value: "NATICAL", label: "NATICAL" },
        { value: "SUPERCAL", label: "SUPERCAL" }
      ]
    },
    {
      key: "sector",
      label: "Setor",
      type: "select",
      required: false,
      placeholder: "",
      helperText: "",
      options: [
        { value: "ADM", label: "ADM" },
        { value: "M. MOVEL", label: "M. MOVEL" },
        { value: "M. FIXA", label: "M. FIXA" },
        { value: "M. ELETRICA", label: "M. ELETRICA" },
        { value: "PRODUCAO", label: "PRODUCAO" },
        { value: "MINA", label: "MINA" }
      ]
    },
    { key: "role", label: "Funcao", type: "text", required: false, placeholder: "Funcao", helperText: "", options: [] },
    { key: "vacationStart", label: "Inicio das ferias", type: "date", required: false, placeholder: "", helperText: "", options: [] },
    { key: "vacationEnd", label: "Fim das ferias", type: "date", required: false, placeholder: "", helperText: "", options: [] },
    { key: "password", label: "Senha inicial", type: "password", required: true, placeholder: "", helperText: "Usado ao criar um novo usuario.", options: [] },
    { key: "isAdmin", label: "Criar como administrador", type: "checkbox", required: false, placeholder: "", helperText: "Disponivel para desenvolvedor.", options: [] }
  ];

  const state = {
    currentUser: null,
    currentUserData: null,
    allUsers: [],
    filters: { sector: "", search: "" },
    draftFilters: { sector: "", search: "" },
    modalMode: "edit",
    selectedEmployeeId: null,
    actionEmployeeId: null,
    unsubUsers: null,
    employeeFormSchema: JSON.parse(JSON.stringify(DEFAULT_EMPLOYEE_FORM_SCHEMA))
  };

  const dom = {
    bootOverlay: document.getElementById("bootOverlay"),
    authOverlay: document.getElementById("authOverlay"),
    loginForm: document.getElementById("loginForm"),
    loginCpf: document.getElementById("loginCpf"),
    loginPassword: document.getElementById("loginPassword"),
    loginSubmitButton: document.getElementById("loginSubmitButton"),
    loginFeedback: document.getElementById("loginFeedback"),
    pageShell: document.getElementById("pageShell"),
    welcomeText: document.getElementById("welcomeText"),
    logoutButton: document.getElementById("logoutButton"),
    toggleFiltersButton: document.getElementById("toggleFiltersButton"),
    filtersPanel: document.getElementById("filtersPanel"),
    filterSector: document.getElementById("filterSector"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    employeesCount: document.getElementById("employeesCount"),
    downloadPdfButton: document.getElementById("downloadPdfButton"),
    addEmployeeButton: document.getElementById("addEmployeeButton"),
    employeesList: document.getElementById("employeesList"),
    employeeModal: document.getElementById("employeeModal"),
    employeeModalTitle: document.getElementById("employeeModalTitle"),
    employeeModalClose: document.getElementById("employeeModalClose"),
    employeeForm: document.getElementById("employeeForm"),
    employeeFormFields: document.getElementById("employeeFormFields"),
    employeeFormFeedback: document.getElementById("employeeFormFeedback"),
    employeeFormCancel: document.getElementById("employeeFormCancel"),
    employeeFormSubmit: document.getElementById("employeeFormSubmit"),
    employeeDeleteConfirmModal: document.getElementById("employeeDeleteConfirmModal"),
    employeeDeleteConfirmFeedback: document.getElementById("employeeDeleteConfirmFeedback"),
    employeeDeleteConfirmCancel: document.getElementById("employeeDeleteConfirmCancel"),
    employeeDeleteConfirmSubmit: document.getElementById("employeeDeleteConfirmSubmit"),
    employeeRemovalRequestModal: document.getElementById("employeeRemovalRequestModal"),
    employeeRemovalReasonInput: document.getElementById("employeeRemovalReasonInput"),
    employeeRemovalRequestFeedback: document.getElementById("employeeRemovalRequestFeedback"),
    employeeRemovalRequestCancel: document.getElementById("employeeRemovalRequestCancel"),
    employeeRemovalRequestSubmit: document.getElementById("employeeRemovalRequestSubmit")
  };

  function hasLegacyAdminFlag(user) {
    const legacyValue = user?.customFields?.isadmin?.value ?? user?.customFields?.isAdmin?.value;
    return legacyValue === true || String(legacyValue || "").toLowerCase() === "true";
  }

  function isAdminUser(user) {
    return !!(user?.isAdmin || hasLegacyAdminFlag(user));
  }

  function isDeveloperUser(user) {
    return !!user?.isDeveloper;
  }

  function isPrivilegedUser(user = state.currentUserData) {
    return isAdminUser(user) || isDeveloperUser(user);
  }

  function updateAdminNavigation() {
    document.querySelectorAll('[data-admin-only-nav="designated"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isPrivilegedUser());
    });
    document.querySelectorAll('[data-developer-only-nav="control-center"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isDeveloperUser(state.currentUserData));
    });
    document.querySelectorAll('[data-privileged-nav="changes"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isDeveloperUser(state.currentUserData));
    });
    document.querySelectorAll('[data-developer-only-nav="requests"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isDeveloperUser(state.currentUserData));
    });
  }

  function maskCpf(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function cpfToEmail(cpf) {
    return String(cpf || "").replace(/\D/g, "") + "@jdemito.com";
  }

  function redirectToLogin(message) {
    if (message) sessionStorage.setItem("ridLoginFeedback", message);
    const currentPage = window.location.pathname.split(/[\\/]/).pop() || "dashboard.html";
    const next = currentPage === "login.html" ? "dashboard.html" : currentPage;
    window.location.replace(`login.html?next=${encodeURIComponent(next)}`);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatField(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function toDateSafe(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function toDateInputValue(value) {
    const date = toDateSafe(value);
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function cloneSchema(schema) {
    return JSON.parse(JSON.stringify(schema || []));
  }

  function normalizeFormOption(option, index) {
    const value = String(option?.value ?? "").trim();
    const label = String(option?.label ?? "").trim();
    return {
      value: value || `opcao_${index + 1}`,
      label: label || value || `Opcao ${index + 1}`
    };
  }

  function normalizeSchemaKey(value) {
    return String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function canonicalizeEmployeeFieldKey(value) {
    const normalized = normalizeSchemaKey(value);
    const aliases = {
      name: "name",
      email: "email",
      cpf: "cpf",
      unit: "unit",
      sector: "sector",
      role: "role",
      function: "function",
      vacationstart: "vacationStart",
      vacation_end: "vacationEnd",
      vacationend: "vacationEnd",
      password: "password",
      isadmin: "isAdmin",
      isdeveloper: "isDeveloper"
    };
    return aliases[normalized] || (String(value || "").trim() || normalized);
  }

  function normalizeFormField(field, index) {
    const allowedTypes = ["text", "textarea", "select", "date", "email", "password", "checkbox"];
    const key = canonicalizeEmployeeFieldKey(field?.key || `campo_${index + 1}`) || `campo_${index + 1}`;
    const label = String(field?.label || "").trim() || `Campo ${index + 1}`;
    const type = allowedTypes.includes(field?.type) ? field.type : "text";
    return {
      key,
      label,
      type,
      required: Boolean(field?.required),
      placeholder: String(field?.placeholder || "").trim(),
      helperText: String(field?.helperText || "").trim(),
      options: type === "select" && Array.isArray(field?.options)
        ? field.options.map(normalizeFormOption)
        : []
    };
  }

  function normalizeEmployeeFormSchema(schema) {
    if (!Array.isArray(schema) || !schema.length) return cloneSchema(DEFAULT_EMPLOYEE_FORM_SCHEMA);
    return schema.map(normalizeFormField);
  }

  function setEmployeeFormSchema(schema) {
    state.employeeFormSchema = normalizeEmployeeFormSchema(schema);
  }

  async function loadEmployeeFormSchema() {
    try {
      const snap = await RID_FORM_SETTINGS_DOC.get();
      const data = snap.exists ? snap.data() || {} : {};
      setEmployeeFormSchema(data.employeeFields);
    } catch (error) {
      console.warn("Nao foi possivel carregar o formulario configuravel de funcionarios:", error);
      setEmployeeFormSchema(state.employeeFormSchema);
    }
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function getEmployeeFormFieldValue(employee, key) {
    if (!employee) return "";
    const customValue = employee.customFields?.[key]?.value;
    if (customValue !== undefined && customValue !== null) return String(customValue);

    switch (key) {
      case "name": return String(employee.name || "");
      case "email": return String(employee.email || "");
      case "cpf": return String(employee.cpf || "");
      case "unit": return String(employee.unit || "");
      case "sector": return String(employee.sector || "");
      case "role":
      case "function": return String(employee.function || employee.role || "");
      case "vacationStart": return toDateInputValue(employee.vacationPeriod?.start);
      case "vacationEnd": return toDateInputValue(employee.vacationPeriod?.end);
      case "isAdmin": return employee.isAdmin ? "true" : "";
      default: return "";
    }
  }

  function shouldRenderEmployeeField(field, mode) {
    if (field.key === "password") return mode === "create";
    if (field.key === "isAdmin") return mode === "create" && isDeveloperUser(state.currentUserData);
    if (field.key === "vacationStart" || field.key === "vacationEnd") return mode === "edit";
    return true;
  }

  function renderEmployeeField(field, mode, employee) {
    if (!shouldRenderEmployeeField(field, mode)) return "";

    const required = field.required && !(field.key === "isAdmin") ? "required" : "";
    const value = getEmployeeFormFieldValue(employee, field.key);
    const helper = field.helperText ? `<p class="text-xs text-gray-500 mt-2">${escapeHtml(field.helperText)}</p>` : "";
    const wrapperClass = (field.key === "vacationStart" || field.key === "vacationEnd")
      ? "md:col-span-2"
      : "";

    if (field.type === "checkbox") {
      return `
        <div class="${wrapperClass}">
          <div class="text-sm font-medium text-gray-700 block mb-2 invisible select-none">${escapeHtml(field.label)}</div>
          <label class="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
            <input
              type="checkbox"
              name="${escapeAttribute(field.key)}"
              data-employee-field-key="${escapeAttribute(field.key)}"
              class="rounded border-indigo-200"
              ${value ? "checked" : ""}
            >
            ${escapeHtml(field.label)}
          </label>
          ${helper}
        </div>
      `;
    }

    if (field.key === "vacationStart" || field.key === "vacationEnd") {
      return `
        <div>
          <label class="text-sm font-medium text-gray-700 block mb-2" for="employee-field-${escapeAttribute(field.key)}">${escapeHtml(field.label)}</label>
          <input
            id="employee-field-${escapeAttribute(field.key)}"
            type="date"
            name="${escapeAttribute(field.key)}"
            data-employee-field-key="${escapeAttribute(field.key)}"
            value="${escapeAttribute(value)}"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 bg-white"
            ${required}
          >
          ${helper}
        </div>
      `;
    }

    if (field.type === "select") {
      const placeholderLabel = field.placeholder || `Selecione ${field.label.toLowerCase()}`;
      const options = [`<option value="">${escapeHtml(placeholderLabel)}</option>`]
        .concat((field.options || []).map((option) => `<option value="${escapeAttribute(option.value)}" ${String(option.value) === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`))
        .join("");
      return `
        <div class="${wrapperClass}">
          <label class="text-sm font-medium text-gray-700 block mb-2" for="employee-field-${escapeAttribute(field.key)}">${escapeHtml(field.label)}</label>
          <select
            id="employee-field-${escapeAttribute(field.key)}"
            name="${escapeAttribute(field.key)}"
            data-employee-field-key="${escapeAttribute(field.key)}"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 bg-white"
            ${required}
          >
            ${options}
          </select>
          ${helper}
        </div>
      `;
    }

    const inputType = field.type === "textarea" ? null : (field.type === "password" ? "password" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text");
    if (field.type === "textarea") {
      return `
        <div class="${wrapperClass}">
          <label class="text-sm font-medium text-gray-700 block mb-2" for="employee-field-${escapeAttribute(field.key)}">${escapeHtml(field.label)}</label>
          <textarea
            id="employee-field-${escapeAttribute(field.key)}"
            name="${escapeAttribute(field.key)}"
            data-employee-field-key="${escapeAttribute(field.key)}"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 min-h-[120px]"
            placeholder="${escapeAttribute(field.placeholder || "")}"
            ${required}
          >${escapeHtml(value)}</textarea>
          ${helper}
        </div>
      `;
    }

    const extraAttrs = field.key === "cpf" ? ' maxlength="14" inputmode="numeric"' : "";
    return `
      <div class="${wrapperClass}">
        <label class="text-sm font-medium text-gray-700 block mb-2" for="employee-field-${escapeAttribute(field.key)}">${escapeHtml(field.label)}</label>
        <input
          id="employee-field-${escapeAttribute(field.key)}"
          type="${inputType}"
          name="${escapeAttribute(field.key)}"
          data-employee-field-key="${escapeAttribute(field.key)}"
          value="${escapeAttribute(value)}"
          placeholder="${escapeAttribute(field.placeholder || "")}"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400"
          ${required}${extraAttrs}
        >
        ${helper}
      </div>
    `;
  }

  function renderEmployeeFormFields(mode, employee = null) {
    const html = (state.employeeFormSchema || [])
      .map((field) => renderEmployeeField(field, mode, employee))
      .join("");
    dom.employeeFormFields.innerHTML = html;
  }

  function getEmployeeFormElement(key) {
    return dom.employeeForm?.elements?.namedItem(key) || null;
  }

  function getEmployeeFormValue(key) {
    const element = getEmployeeFormElement(key);
    if (!element) return "";
    if (element.type === "checkbox") return element.checked ? "true" : "";
    return String(element.value || "").trim();
  }

  function readVacationPeriodFromForm() {
    const startValue = getEmployeeFormValue("vacationStart");
    const endValue = getEmployeeFormValue("vacationEnd");

    if (!startValue && !endValue) {
      return { vacationPeriod: null, error: "" };
    }

    if (!startValue || !endValue) {
      return { vacationPeriod: null, error: "Preencha inicio e fim das ferias." };
    }

    const startDate = new Date(`${startValue}T00:00:00Z`);
    const endDate = new Date(`${endValue}T23:59:59Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return { vacationPeriod: null, error: "Periodo de ferias invalido." };
    }

    return {
      vacationPeriod: {
        start: firebase.firestore.Timestamp.fromDate(startDate),
        end: firebase.firestore.Timestamp.fromDate(endDate)
      },
      error: ""
    };
  }

  function clearVacationFields() {
    const startField = getEmployeeFormElement("vacationStart");
    const endField = getEmployeeFormElement("vacationEnd");
    if (startField) startField.value = "";
    if (endField) endField.value = "";
  }

  function formatVacationSummary(vacationPeriod) {
    const start = toDateSafe(vacationPeriod?.start);
    const end = toDateSafe(vacationPeriod?.end);
    if (!start || !end) return "";
    return `Ferias: ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;
  }

  function closeFiltersPanel() {
    dom.filtersPanel.classList.remove("visible");
  }

  function getEmployeeRole(employee) {
    return formatField(employee.function || employee.role || employee.userType || (isDeveloperUser(employee) ? "Desenvolvedor" : isAdminUser(employee) ? "Administrador" : "Funcionario"));
  }

  function getEmployeeType(employee) {
    if (isAdminUser(employee) && isDeveloperUser(employee)) {
      return {
        label: "DESENVOLVEDOR",
        className: "developer"
      };
    }

    if (isAdminUser(employee) && !isDeveloperUser(employee)) {
      return {
        label: "ADMINISTRADOR",
        className: "admin"
      };
    }

    return {
      label: "FUNCIONARIO",
      className: "employee"
    };
  }

  function normalizeCpf(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function getFilteredEmployees() {
    const search = String(state.filters.search || "").trim().toLowerCase();
    return state.allUsers
      .filter((user) => !user.deleted)
      .filter((user) => !state.filters.sector || user.sector === state.filters.sector)
      .filter((user) => {
        if (!search) return true;
        const haystack = [user.name, user.email, user.cpf, user.unit, user.sector, getEmployeeRole(user)].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }

  function populateSectorFilter() {
    const currentValue = dom.filterSector.value;
    const sectors = [...new Set(state.allUsers.map((item) => formatField(item.sector, "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    dom.filterSector.innerHTML = `<option value="">Todos os setores</option>${sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`).join("")}`;
    dom.filterSector.value = sectors.includes(currentValue) ? currentValue : state.draftFilters.sector || "";
  }

  function renderEmployees() {
    const employees = getFilteredEmployees();
    dom.employeesCount.textContent = `${employees.length} funcionario${employees.length === 1 ? "" : "s"}`;

    if (!employees.length) {
      dom.employeesList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          <div class="text-sm font-medium text-gray-500">Nenhum funcionario encontrado com os filtros atuais.</div>
        </div>
      `;
      return;
    }

    dom.employeesList.innerHTML = employees.map((employee) => `
      <div class="rounded-2xl border border-gray-100 bg-white px-5 py-5">
        <div class="employee-row">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Nome</div>
            <div class="text-sm font-semibold text-gray-900 mt-1 md:mt-0">${escapeHtml(formatField(employee.name))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Tipo</div>
            <div class="mt-1 md:mt-0">
              <span class="employee-type-badge ${escapeHtml(getEmployeeType(employee).className)}">${escapeHtml(getEmployeeType(employee).label)}</span>
            </div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Email</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0 break-all">${escapeHtml(formatField(employee.email, "Sem email"))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">CPF</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatField(employee.cpf))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Unidade</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatField(employee.unit))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Setor</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatField(employee.sector))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Funcao</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(getEmployeeRole(employee))}</div>
            ${employee.vacationPeriod ? `<div class="text-xs text-amber-700 mt-1">${escapeHtml(formatVacationSummary(employee.vacationPeriod))}</div>` : ""}
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-start md:justify-end">
            <button type="button" data-edit-employee="${escapeHtml(employee.id)}" class="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Editar</button>
            ${isDeveloperUser(state.currentUserData)
              ? `<button type="button" data-delete-employee="${escapeHtml(employee.id)}" class="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700">Excluir</button>`
              : isAdminUser(state.currentUserData)
                ? `<button type="button" data-request-employee="${escapeHtml(employee.id)}" class="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700">Solicitar remocao</button>`
                : ""}
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderPage() {
    populateSectorFilter();
    renderEmployees();
  }

  function downloadEmployeesPdf() {
    const employees = getFilteredEmployees();
    const jsPdfApi = window.jspdf?.jsPDF;
    if (!jsPdfApi) return;

    const doc = new jsPdfApi({ orientation: "portrait", unit: "mm", format: "a4" });
    const today = new Date();
    const sectorLabel = state.filters.sector || "Todos os setores";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatorio de Funcionarios", 14, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em ${today.toLocaleDateString("pt-BR")} - Setor: ${sectorLabel}`, 14, 23);
    doc.text(`Total de funcionarios: ${employees.length}`, 14, 29);

    doc.autoTable({
      startY: 36,
      head: [["Nome", "CPF", "Setor", "Funcao"]],
      body: employees.map((employee) => [
        formatField(employee.name),
        formatField(employee.cpf),
        formatField(employee.sector),
        getEmployeeRole(employee)
      ]),
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        lineColor: [229, 231, 235]
      },
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      bodyStyles: {
        textColor: [55, 65, 81]
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      margin: { left: 14, right: 14 }
    });

    const fileDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    doc.save(`funcionarios-${fileDate}.pdf`);
  }

  function resetEmployeeForm() {
    renderEmployeeFormFields(state.modalMode);
    dom.employeeFormFeedback.classList.add("hidden-state");
    dom.employeeFormFeedback.textContent = "";
  }

  function showLogin() {
    dom.bootOverlay.classList.add("hidden-state");
    dom.authOverlay.classList.add("visible");
    dom.pageShell.classList.add("hidden-state");
    dom.loginFeedback.classList.add("hidden-state");
  }

  function showPage() {
    dom.bootOverlay.classList.add("hidden-state");
    dom.authOverlay.classList.remove("visible");
    dom.pageShell.classList.remove("hidden-state");
    updateAdminNavigation();
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "gestor"}. Aqui voce acompanha o cadastro completo de funcionarios.`;
    renderPage();
    lucide.createIcons();
  }

  function findEmployeeById(employeeId) {
    return state.allUsers.find((item) => item.id === employeeId) || null;
  }

  function openCreateEmployeeModal() {
    state.modalMode = "create";
    state.selectedEmployeeId = null;
    resetEmployeeForm();
    dom.employeeModalTitle.textContent = "Adicionar funcionario";
    dom.employeeFormSubmit.textContent = "Criar funcionario";
    dom.employeeModal.classList.add("visible");
  }

  function openEmployeeModal(employeeId) {
    const employee = findEmployeeById(employeeId);
    if (!employee) return;
    state.modalMode = "edit";
    state.selectedEmployeeId = employeeId;
    dom.employeeModalTitle.textContent = `Editar ${employee.name || "funcionario"}`;
    renderEmployeeFormFields("edit", employee);
    dom.employeeFormFeedback.classList.add("hidden-state");
    dom.employeeFormFeedback.textContent = "";
    dom.employeeFormSubmit.textContent = "Salvar alteracoes";
    dom.employeeModal.classList.add("visible");
  }

  function closeEmployeeModal() {
    state.modalMode = "edit";
    state.selectedEmployeeId = null;
    dom.employeeModal.classList.remove("visible");
  }

  function openEmployeeDeleteConfirmModal(employeeId) {
    state.actionEmployeeId = employeeId;
    dom.employeeDeleteConfirmFeedback.classList.add("hidden-state");
    dom.employeeDeleteConfirmFeedback.textContent = "";
    dom.employeeDeleteConfirmModal.classList.add("visible");
  }

  function closeEmployeeDeleteConfirmModal() {
    state.actionEmployeeId = null;
    dom.employeeDeleteConfirmModal.classList.remove("visible");
  }

  function openEmployeeRemovalRequestModal(employeeId) {
    state.actionEmployeeId = employeeId;
    dom.employeeRemovalReasonInput.value = "";
    dom.employeeRemovalRequestFeedback.classList.add("hidden-state");
    dom.employeeRemovalRequestFeedback.textContent = "";
    dom.employeeRemovalRequestModal.classList.add("visible");
  }

  function closeEmployeeRemovalRequestModal() {
    state.actionEmployeeId = null;
    dom.employeeRemovalRequestModal.classList.remove("visible");
  }

  async function createEmployee() {
    const name = getEmployeeFormValue("name");
    const email = getEmployeeFormValue("email").toLowerCase();
    const cpfRaw = getEmployeeFormValue("cpf");
    const cpfClean = normalizeCpf(cpfRaw);
    const unit = getEmployeeFormValue("unit");
    const sector = getEmployeeFormValue("sector");
    const role = getEmployeeFormValue("role") || getEmployeeFormValue("function");
    const password = getEmployeeFormValue("password");
    const makeAdmin = getEmployeeFormValue("isAdmin") === "true" && isDeveloperUser(state.currentUserData);
    const { vacationPeriod, error: vacationError } = readVacationPeriodFromForm();
    const customFields = {};

    if (!name || !cpfClean || !password) {
      dom.employeeFormFeedback.textContent = "Nome, CPF e senha inicial sao obrigatorios.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    if (cpfClean.length !== 11) {
      dom.employeeFormFeedback.textContent = "CPF invalido.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    if (vacationError) {
      dom.employeeFormFeedback.textContent = vacationError;
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    const authEmail = cpfToEmail(cpfClean);
    dom.employeeFormSubmit.disabled = true;
    try {
      (state.employeeFormSchema || []).forEach((field) => {
        if (!shouldRenderEmployeeField(field, "create")) return;
        if (["name", "email", "cpf", "unit", "sector", "role", "function", "vacationStart", "vacationEnd", "password", "isAdmin"].includes(field.key)) return;
        customFields[field.key] = {
          label: field.label || field.key,
          value: getEmployeeFormValue(field.key),
          type: field.type || "text"
        };
      });

      const credential = await secondaryAuth.createUserWithEmailAndPassword(authEmail, password);
      await db.collection("users").doc(credential.user.uid).set({
        name,
        cpf: maskCpf(cpfClean),
        email: email || null,
        unit: unit || null,
        sector: sector || null,
        function: role || null,
        role: role || null,
        vacationPeriod,
        customFields,
        isAdmin: makeAdmin,
        isDeveloper: false,
        userType: makeAdmin ? "Administrador" : "Funcionario",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await secondaryAuth.signOut();
      closeEmployeeModal();
    } catch (error) {
      dom.employeeFormFeedback.textContent = "Nao foi possivel criar o funcionario.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
    } finally {
      dom.employeeFormSubmit.disabled = false;
    }
  }

  async function saveEmployee() {
    if (state.modalMode === "create") {
      await createEmployee();
      return;
    }

    const employee = findEmployeeById(state.selectedEmployeeId);
    if (!employee) return;

    const name = getEmployeeFormValue("name");
    const email = getEmployeeFormValue("email");
    const cpf = getEmployeeFormValue("cpf");
    const unit = getEmployeeFormValue("unit");
    const sector = getEmployeeFormValue("sector");
    const role = getEmployeeFormValue("role") || getEmployeeFormValue("function");
    const { vacationPeriod, error: vacationError } = readVacationPeriodFromForm();
    const customFields = {};

    if (!name || !cpf) {
      dom.employeeFormFeedback.textContent = "Nome e CPF sao obrigatorios.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    if (vacationError) {
      dom.employeeFormFeedback.textContent = vacationError;
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    dom.employeeFormSubmit.disabled = true;
    try {
      (state.employeeFormSchema || []).forEach((field) => {
        if (!shouldRenderEmployeeField(field, "edit")) return;
        if (["name", "email", "cpf", "unit", "sector", "role", "function", "vacationStart", "vacationEnd", "password", "isAdmin"].includes(field.key)) return;
        customFields[field.key] = {
          label: field.label || field.key,
          value: getEmployeeFormValue(field.key),
          type: field.type || "text"
        };
      });

      await db.collection("users").doc(employee.id).update({
        name,
        email,
        cpf,
        unit,
        sector,
        function: role,
        role,
        vacationPeriod,
        customFields
      });
      closeEmployeeModal();
    } catch (error) {
      dom.employeeFormFeedback.textContent = "Nao foi possivel salvar as alteracoes do funcionario.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
    } finally {
      dom.employeeFormSubmit.disabled = false;
    }
  }

  async function deleteEmployeeDirectly(employee) {
    await db.collection("users").doc(employee.id).update({
      deleted: true,
      status: "EXCLUIDO",
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deletedBy: {
        uid: state.currentUser.uid,
        name: state.currentUserData?.name || "DEV",
        role: "DEV"
      },
      deleteReason: "Exclusao direta pelo desenvolvedor"
    });
  }

  async function requestEmployeeRemoval(employee, reason) {
    await db.collection("employeeDeleteRequests").add({
      userId: employee.id,
      userName: employee.name || "",
      requesterId: state.currentUser.uid,
      requesterName: state.currentUserData?.name || "",
      reason: reason.trim(),
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function listenUsers() {
    if (typeof state.unsubUsers === "function") state.unsubUsers();
    state.unsubUsers = db.collection("users").onSnapshot((snapshot) => {
      state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (state.currentUserData) renderPage();
    });
  }

  function bindEvents() {
    dom.loginCpf.addEventListener("input", () => {
      dom.loginCpf.value = maskCpf(dom.loginCpf.value);
    });

    dom.employeeForm.addEventListener("input", (event) => {
      if (event.target?.matches('input[name="cpf"]')) {
        event.target.value = maskCpf(event.target.value);
      }
    });

    dom.loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      dom.loginFeedback.classList.add("hidden-state");
      dom.loginSubmitButton.disabled = true;
      dom.loginSubmitButton.textContent = "Entrando...";
      try {
        await auth.signInWithEmailAndPassword(cpfToEmail(dom.loginCpf.value), dom.loginPassword.value);
      } catch (error) {
        dom.loginFeedback.textContent = "CPF ou senha incorretos.";
        dom.loginFeedback.classList.remove("hidden-state");
      } finally {
        dom.loginSubmitButton.disabled = false;
        dom.loginSubmitButton.textContent = "Entrar";
      }
    });

    dom.logoutButton.addEventListener("click", async () => {
      await auth.signOut();
    });

    dom.toggleFiltersButton.addEventListener("click", () => {
      dom.filtersPanel.classList.toggle("visible");
    });

    dom.downloadPdfButton.addEventListener("click", downloadEmployeesPdf);
    dom.addEmployeeButton.addEventListener("click", openCreateEmployeeModal);


    dom.clearFiltersButton.addEventListener("click", () => {
      state.draftFilters = { sector: "", search: "" };
      state.filters = { ...state.draftFilters };
      dom.filterSector.value = "";
      dom.searchInput.value = "";
      closeFiltersPanel();
      renderPage();
    });

    dom.applyFiltersButton.addEventListener("click", () => {
      state.draftFilters = {
        sector: dom.filterSector.value || "",
        search: dom.searchInput.value || ""
      };
      state.filters = { ...state.draftFilters };
      closeFiltersPanel();
      renderEmployees();
    });

    dom.employeesList.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-employee]");
      if (editButton) {
        openEmployeeModal(editButton.getAttribute("data-edit-employee"));
        return;
      }

      const deleteButton = event.target.closest("[data-delete-employee]");
      if (deleteButton) {
        openEmployeeDeleteConfirmModal(deleteButton.getAttribute("data-delete-employee"));
        return;
      }

      const requestButton = event.target.closest("[data-request-employee]");
      if (requestButton) {
        openEmployeeRemovalRequestModal(requestButton.getAttribute("data-request-employee"));
      }
    });

    dom.employeeModalClose.addEventListener("click", closeEmployeeModal);
    dom.employeeFormCancel.addEventListener("click", closeEmployeeModal);
    dom.employeeModal.addEventListener("click", (event) => {
      if (event.target === dom.employeeModal) closeEmployeeModal();
    });

    dom.employeeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveEmployee();
    });

    dom.employeeDeleteConfirmCancel.addEventListener("click", closeEmployeeDeleteConfirmModal);
    dom.employeeDeleteConfirmModal.addEventListener("click", (event) => {
      if (event.target === dom.employeeDeleteConfirmModal) closeEmployeeDeleteConfirmModal();
    });

    dom.employeeDeleteConfirmSubmit.addEventListener("click", async () => {
      const employee = findEmployeeById(state.actionEmployeeId);
      if (!employee) return;
      closeEmployeeDeleteConfirmModal();
      try {
        await deleteEmployeeDirectly(employee);
      } catch (error) {
        dom.employeeDeleteConfirmFeedback.textContent = "Nao foi possivel excluir o funcionario.";
        dom.employeeDeleteConfirmFeedback.classList.remove("hidden-state");
      }
    });

    dom.employeeRemovalRequestCancel.addEventListener("click", closeEmployeeRemovalRequestModal);
    dom.employeeRemovalRequestModal.addEventListener("click", (event) => {
      if (event.target === dom.employeeRemovalRequestModal) closeEmployeeRemovalRequestModal();
    });

    dom.employeeRemovalRequestSubmit.addEventListener("click", async () => {
      const employee = findEmployeeById(state.actionEmployeeId);
      if (!employee) return;
      const reason = String(dom.employeeRemovalReasonInput.value || "").trim();
      if (!reason) {
        dom.employeeRemovalRequestFeedback.textContent = "Informe o motivo da solicitacao.";
        dom.employeeRemovalRequestFeedback.classList.remove("hidden-state");
        return;
      }

      dom.employeeRemovalRequestSubmit.disabled = true;
      try {
        await requestEmployeeRemoval(employee, reason);
        closeEmployeeRemovalRequestModal();
      } catch (error) {
        dom.employeeRemovalRequestFeedback.textContent = "Nao foi possivel solicitar a remocao do funcionario.";
        dom.employeeRemovalRequestFeedback.classList.remove("hidden-state");
      } finally {
        dom.employeeRemovalRequestSubmit.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".filter-popover")) closeFiltersPanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.employeeModal.classList.contains("visible")) closeEmployeeModal();
      if (event.key === "Escape" && dom.employeeDeleteConfirmModal.classList.contains("visible")) closeEmployeeDeleteConfirmModal();
      if (event.key === "Escape" && dom.employeeRemovalRequestModal.classList.contains("visible")) closeEmployeeRemovalRequestModal();
      if (event.key === "Escape" && dom.filtersPanel.classList.contains("visible")) closeFiltersPanel();
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allUsers = [];
      if (typeof state.unsubUsers === "function") state.unsubUsers();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!isPrivilegedUser()) {
      sessionStorage.setItem("ridLoginFeedback", "Sua conta nao tem permissao para este painel.");
      await auth.signOut();
      return;
    }

    await loadEmployeeFormSchema();
    listenUsers();
    showPage();
  });

  bindEvents();
  lucide.createIcons();
})();
