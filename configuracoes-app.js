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

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  const db = firebase.firestore();
  const ANNOUNCEMENTS_COLLECTION = db.collection("globalAnnouncements");
  const WEB_PUSH_COLLECTION = db.collection("webPushCampaigns");
  const RID_FORM_SETTINGS_DOC = db.collection("appSettings").doc("ridFormSchema");
  const RID_FORM_FIXED_NOTE = "O emitente logado continua sendo mostrado automaticamente no app mobile.";
  const DEFAULT_RID_FORM_SCHEMA = [
    {
      key: "contractType",
      label: "Tipo de contrato",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "Funcionario", label: "Funcionario" },
        { value: "Terceiro Contratado", label: "Terceiro Contratado" },
        { value: "Terceiro Eventual", label: "Terceiro Eventual" },
        { value: "Visitante", label: "Visitante" }
      ]
    },
    {
      key: "unit",
      label: "Unidade",
      type: "select",
      required: true,
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
      key: "emissionDate",
      label: "Data",
      type: "date",
      required: true,
      placeholder: "",
      helperText: "",
      options: []
    },
    {
      key: "incidentType",
      label: "Incidente ou desvio",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "Condicao de Risco", label: "Condicao de Risco" },
        { value: "Desvio Comportamental", label: "Desvio Comportamental" },
        { value: "Dano Material", label: "Dano Material" },
        { value: "Quase acidente", label: "Quase acidente" }
      ]
    },
    {
      key: "detectionOrigin",
      label: "Origem da deteccao",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "CSL", label: "CSL" },
        { value: "Inspecao programada", label: "Inspecao programada" },
        { value: "Inspecao nao programada", label: "Inspecao nao programada" },
        { value: "Observacao Comportamental", label: "Observacao Comportamental" },
        { value: "Constatacao espontanea", label: "Constatacao espontanea" },
        { value: "Auditoria", label: "Auditoria" }
      ]
    },
    {
      key: "location",
      label: "Local",
      type: "text",
      required: true,
      placeholder: "Local da ocorrencia",
      helperText: "",
      options: []
    },
    {
      key: "description",
      label: "Descricao",
      type: "textarea",
      required: true,
      placeholder: "Descreva a ocorrencia",
      helperText: "",
      options: []
    },
    {
      key: "riskClassification",
      label: "Classificacao de risco",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "Baixo", label: "Baixo: Situacoes com baixo potencial de causar acidente." },
        { value: "Medio", label: "Medio: Situacoes que podem causar acidente leve." },
        { value: "Alto", label: "Alto: Situacoes com alto potencial de acidente grave." },
        { value: "Critico", label: "Critico: Risco iminente de acidente grave ou fatal." }
      ]
    },
    {
      key: "immediateAction",
      label: "Acao imediata",
      type: "textarea",
      required: true,
      placeholder: "Descreva a acao imediata",
      helperText: "",
      options: []
    },
    {
      key: "imageFile",
      label: "Imagem da ocorrencia",
      type: "file",
      required: false,
      placeholder: "",
      helperText: "Opcional. Voce pode escolher uma foto da galeria ou tirar na hora, dependendo das opcoes do seu celular.",
      options: []
    },
    {
      key: "status",
      label: "Status inicial",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "CORRIGIDO", label: "CORRIGIDO" },
        { value: "VENCIDO", label: "VENCIDO" }
      ]
    },
    {
      key: "responsibleLeader",
      label: "Lider responsavel",
      type: "select",
      required: false,
      placeholder: "",
      helperText: "Se o status for VENCIDO, o lider e obrigatorio. A lista e carregada do cache local quando estiver offline.",
      options: [
        { value: "__LEADERS__", label: "Lista dinamica de lideres" }
      ]
    }
  ];
  const DEFAULT_EMPLOYEE_FORM_SCHEMA = [
    { key: "name", label: "Nome", type: "text", required: true, placeholder: "Nome completo", helperText: "", options: [] },
    { key: "email", label: "Email", type: "email", required: false, placeholder: "email@empresa.com", helperText: "", options: [] },
    { key: "cpf", label: "CPF", type: "text", required: true, placeholder: "000.000.000-00", helperText: "", options: [] },
    {
      key: "employmentType",
      label: "Categoria",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "Defina se o cadastro pertence ao quadro interno ou a um terceiro.",
      options: [
        { value: "FUNCIONARIO", label: "Funcionario" },
        { value: "TERCEIRO", label: "Terceiro" }
      ]
    },
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
    formSchemas: {
      rid: [],
      employee: []
    },
    activeNotificationTab: "announcement",
    activeSchemaTab: "rid",
    activeRidFormFieldIndex: null,
    announcementImageDataUrl: "",
    pushAudienceUsers: [],
    selectedPushRecipientIds: new Set()
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
    profileNameStat: document.getElementById("profileNameStat"),
    profileRoleStat: document.getElementById("profileRoleStat"),
    profileSectorStat: document.getElementById("profileSectorStat"),
    goalStat: document.getElementById("goalStat"),
    goalMonthStat: document.getElementById("goalMonthStat"),
    profileName: document.getElementById("profileName"),
    profileCpf: document.getElementById("profileCpf"),
    profileEmail: document.getElementById("profileEmail"),
    profileRole: document.getElementById("profileRole"),
    profileUnit: document.getElementById("profileUnit"),
    profileSector: document.getElementById("profileSector"),
    passwordForm: document.getElementById("passwordForm"),
    currentPassword: document.getElementById("currentPassword"),
    newPassword: document.getElementById("newPassword"),
    confirmPassword: document.getElementById("confirmPassword"),
    passwordSubmitButton: document.getElementById("passwordSubmitButton"),
    passwordFeedback: document.getElementById("passwordFeedback"),
    goalNotice: document.getElementById("goalNotice"),
    goalForm: document.getElementById("goalForm"),
    goalMonth: document.getElementById("goalMonth"),
    goalYear: document.getElementById("goalYear"),
    goalValue: document.getElementById("goalValue"),
    loadGoalButton: document.getElementById("loadGoalButton"),
    saveGoalButton: document.getElementById("saveGoalButton"),
    goalFeedback: document.getElementById("goalFeedback"),
    announcementSection: document.getElementById("announcementSection"),
    announcementNotice: document.getElementById("announcementNotice"),
    announcementForm: document.getElementById("announcementForm"),
    announcementTitle: document.getElementById("announcementTitle"),
    announcementStartDate: document.getElementById("announcementStartDate"),
    announcementMessage: document.getElementById("announcementMessage"),
    announcementImage: document.getElementById("announcementImage"),
    announcementImagePreview: document.getElementById("announcementImagePreview"),
    announcementImagePreviewImg: document.getElementById("announcementImagePreviewImg"),
    announcementDays: document.getElementById("announcementDays"),
    announcementDailyLimit: document.getElementById("announcementDailyLimit"),
    announcementTarget: document.getElementById("announcementTarget"),
    announcementActive: document.getElementById("announcementActive"),
    loadAnnouncementButton: document.getElementById("loadAnnouncementButton"),
    clearAnnouncementButton: document.getElementById("clearAnnouncementButton"),
    saveAnnouncementButton: document.getElementById("saveAnnouncementButton"),
    announcementFeedback: document.getElementById("announcementFeedback"),
    announcementList: document.getElementById("announcementList"),
    pushNotificationSection: document.getElementById("pushNotificationSection"),
    pushNotificationNotice: document.getElementById("pushNotificationNotice"),
    pushNotificationForm: document.getElementById("pushNotificationForm"),
    pushNotificationTitle: document.getElementById("pushNotificationTitle"),
    pushNotificationTarget: document.getElementById("pushNotificationTarget"),
    pushNotificationMessage: document.getElementById("pushNotificationMessage"),
    pushRecipientSearch: document.getElementById("pushRecipientSearch"),
    pushRecipientRoleFilter: document.getElementById("pushRecipientRoleFilter"),
    pushRecipientUnitFilter: document.getElementById("pushRecipientUnitFilter"),
    pushRecipientSectorFilter: document.getElementById("pushRecipientSectorFilter"),
    pushRecipientEmploymentFilter: document.getElementById("pushRecipientEmploymentFilter"),
    pushRecipientCounts: document.getElementById("pushRecipientCounts"),
    selectAllPushRecipientsButton: document.getElementById("selectAllPushRecipientsButton"),
    selectFilteredPushRecipientsButton: document.getElementById("selectFilteredPushRecipientsButton"),
    clearPushRecipientFiltersButton: document.getElementById("clearPushRecipientFiltersButton"),
    clearPushRecipientsButton: document.getElementById("clearPushRecipientsButton"),
    pushRecipientsList: document.getElementById("pushRecipientsList"),
    loadPushNotificationsButton: document.getElementById("loadPushNotificationsButton"),
    sendPushNotificationButton: document.getElementById("sendPushNotificationButton"),
    pushNotificationFeedback: document.getElementById("pushNotificationFeedback"),
    pushNotificationList: document.getElementById("pushNotificationList"),
    ridFormSection: document.getElementById("ridFormSection"),
    ridFormSectionTitle: document.getElementById("ridFormSectionTitle"),
    ridFormSectionSubtitle: document.getElementById("ridFormSectionSubtitle"),
    ridSchemaTab: document.getElementById("ridSchemaTab"),
    employeeSchemaTab: document.getElementById("employeeSchemaTab"),
    ridFormNotice: document.getElementById("ridFormNotice"),
    loadRidFormButton: document.getElementById("loadRidFormButton"),
    resetRidFormButton: document.getElementById("resetRidFormButton"),
    addRidFormFieldButton: document.getElementById("addRidFormFieldButton"),
    saveRidFormButton: document.getElementById("saveRidFormButton"),
    ridFormFeedback: document.getElementById("ridFormFeedback"),
    ridFormFields: document.getElementById("ridFormFields"),
    ridFieldModal: document.getElementById("ridFieldModal"),
    ridFieldModalTitle: document.getElementById("ridFieldModalTitle"),
    ridFieldModalBody: document.getElementById("ridFieldModalBody"),
    ridFieldModalClose: document.getElementById("ridFieldModalClose"),
    ridFieldModalCancel: document.getElementById("ridFieldModalCancel"),
    ridFieldModalSave: document.getElementById("ridFieldModalSave")
  };

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

  function formatField(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hasLegacyAdminFlag(user) {
    const legacyValue = user?.customFields?.isadmin?.value ?? user?.customFields?.isAdmin?.value;
    return legacyValue === true || String(legacyValue || "").toLowerCase() === "true";
  }

  function hasLegacyObserverFlag(user) {
    const legacyValue = user?.customFields?.isobserver?.value ?? user?.customFields?.isObserver?.value;
    return legacyValue === true || String(legacyValue || "").toLowerCase() === "true";
  }

  function isAdminUser(user) {
    return !!(user?.isAdmin || hasLegacyAdminFlag(user));
  }

  function isDeveloperUser(user) {
    return !!user?.isDeveloper;
  }

  function isObserverUser(user) {
    return !!(user?.isObserver || hasLegacyObserverFlag(user) || String(user?.userType || "").trim().toLowerCase() === "observador");
  }

  function isPrivilegedUser(user = state.currentUserData) {
    return isAdminUser(user) || isDeveloperUser(user);
  }

  function getRoleLabel(user) {
    if (isDeveloperUser(user)) return "Desenvolvedor";
    if (isAdminUser(user)) return "Administrador";
    if (isObserverUser(user)) return "Observador";
    return "Usuario";
  }

  function getMonthLabel(month) {
    const labels = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return labels[Math.max(0, Number(month) - 1)] || "Mes";
  }

  function getMonthKey(month, year) {
    return `${Number(year)}-${String(Number(month)).padStart(2, "0")}`;
  }

  function formatAnnouncementWindow(data) {
    const startDate = String(data?.startDate || "").trim();
    const days = Number(data?.daysVisible || 0);
    if (!startDate || !days) return "janela não definida";
    return `${startDate} por ${days} dia${days === 1 ? "" : "s"}`;
  }

  function getAnnouncementTargetLabel(target) {
    if (target === "dashboard") return "somente PC";
    if (target === "mobile") return "somente mobile";
    return "PC e mobile";
  }

  function formatDateTime(value) {
    const date = value?.toDate ? value.toDate() : new Date(value || "");
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
  }

  function renderNotificationTabLayout() {
    const announcementSection = dom.announcementSection;
    const pushSection = dom.pushNotificationSection;
    if (!announcementSection || !pushSection) return;
    const canManageGlobalAnnouncements = isDeveloperUser(state.currentUserData);
    const canSendTargetedPush = isPrivilegedUser(state.currentUserData);
    if (!canManageGlobalAnnouncements && state.activeNotificationTab === "announcement") {
      state.activeNotificationTab = "push";
    }

    const announcementPanel = document.getElementById("announcementPanel");
    const pushPanel = document.getElementById("pushNotificationPanel");
    const announcementTab = document.getElementById("announcementTab");
    const pushNotificationTab = document.getElementById("pushNotificationTab");

    if (announcementPanel) announcementPanel.classList.toggle("hidden-state", !canManageGlobalAnnouncements || state.activeNotificationTab !== "announcement");
    if (pushPanel) pushPanel.classList.toggle("hidden-state", !canSendTargetedPush || state.activeNotificationTab !== "push");

    if (announcementTab) {
      announcementTab.classList.toggle("hidden-state", !canManageGlobalAnnouncements);
      announcementTab.classList.toggle("active", state.activeNotificationTab === "announcement");
    }

    if (pushNotificationTab) {
      pushNotificationTab.classList.toggle("hidden-state", !canSendTargetedPush);
      pushNotificationTab.classList.toggle("active", state.activeNotificationTab === "push");
    }
  }

  function setupNotificationSectionTabs() {
    const announcementSection = dom.announcementSection;
    const pushSection = dom.pushNotificationSection;
    if (!announcementSection || !pushSection) return;
    if (document.getElementById("notificationTabs")) {
      renderNotificationTabLayout();
      return;
    }

    const announcementHead = announcementSection.querySelector(".settings-head");
    const announcementBody = announcementSection.querySelector(".settings-body");
    const pushHead = pushSection.querySelector(".settings-head");
    const pushBody = pushSection.querySelector(".settings-body");
    if (!announcementHead || !announcementBody || !pushHead || !pushBody) return;

    const titleEl = announcementHead.querySelector("h2");
    const subtitleEl = announcementHead.querySelector("p");
    if (titleEl) titleEl.textContent = "Central de notificacoes";
    if (subtitleEl) subtitleEl.textContent = "Escolha entre aviso global e web push direcionada no mesmo card.";

    const tabs = document.createElement("div");
    tabs.id = "notificationTabs";
    tabs.className = "schema-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Editor de notificacoes");
    tabs.innerHTML = `
      <button id="announcementTab" type="button" class="schema-tab active">Aviso global</button>
      <button id="pushNotificationTab" type="button" class="schema-tab">Web push</button>
    `;
    announcementHead.appendChild(tabs);

    const announcementPanel = document.createElement("div");
    announcementPanel.id = "announcementPanel";
    announcementPanel.className = "notification-panel";
    while (announcementBody.firstChild) {
      announcementPanel.appendChild(announcementBody.firstChild);
    }

    const pushPanel = document.createElement("div");
    pushPanel.id = "pushNotificationPanel";
    pushPanel.className = "notification-panel web-push-scroll hidden-state";
    while (pushBody.firstChild) {
      pushPanel.appendChild(pushBody.firstChild);
    }

    announcementBody.appendChild(announcementPanel);
    announcementBody.appendChild(pushPanel);

    pushSection.classList.add("hidden-state");
    pushSection.remove();

    document.getElementById("announcementTab")?.addEventListener("click", () => {
      state.activeNotificationTab = "announcement";
      renderNotificationTabLayout();
    });
    document.getElementById("pushNotificationTab")?.addEventListener("click", () => {
      state.activeNotificationTab = "push";
      renderNotificationTabLayout();
    });

    renderNotificationTabLayout();
  }

  function normalizeEmploymentTypeLabel(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "TERCEIRO") return "Terceiro";
    if (normalized === "FUNCIONARIO") return "Funcionario";
    return "Nao informado";
  }

  function getPushRecipientRoleKey(user) {
    if (isDeveloperUser(user)) return "developer";
    if (isAdminUser(user)) return "admin";
    if (isObserverUser(user)) return "observer";
    return "user";
  }

  function sortByLocale(items) {
    return [...items].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  }

  function cloneRidFormSchema(schema) {
    return JSON.parse(JSON.stringify(schema || []));
  }

  function getDefaultRidFormSchema() {
    return cloneRidFormSchema(DEFAULT_RID_FORM_SCHEMA);
  }

  function getDefaultEmployeeFormSchema() {
    return cloneRidFormSchema(DEFAULT_EMPLOYEE_FORM_SCHEMA);
  }

  function getSchemaMeta(schemaKey) {
    if (schemaKey === "employee") {
      return {
        title: "Formulario de cadastro de usuario",
        subtitle: "Edite os campos exibidos ao cadastrar um novo usuario no sistema.",
        fixedNote: "Esse editor controla a estrutura do cadastro de novos usuarios."
      };
    }

    return {
      title: "Formulario de RID mobile",
      subtitle: "Cada card resume um campo. Clique em editar para abrir o modal com todas as opcoes.",
      fixedNote: RID_FORM_FIXED_NOTE
    };
  }

  function getCurrentSchemaKey() {
    return state.activeSchemaTab === "employee" ? "employee" : "rid";
  }

  function getCurrentSchemaFields() {
    const schemaKey = getCurrentSchemaKey();
    return state.formSchemas[schemaKey] || [];
  }

  function setCurrentSchemaFields(fields) {
    const schemaKey = getCurrentSchemaKey();
    state.formSchemas[schemaKey] = fields;
  }

  function slugifyRidFieldKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
  }

  function canonicalizeEmployeeFieldKey(value) {
    const normalized = slugifyRidFieldKey(value);
    const aliases = {
      name: "name",
      email: "email",
      cpf: "cpf",
      tipo: "employmentType",
      type: "employmentType",
      employmenttype: "employmentType",
      employeetype: "employmentType",
      categoria: "employmentType",
      tipovinculo: "employmentType",
      tipousuario: "employmentType",
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
    return aliases[normalized] || normalized;
  }

  function normalizeRidFormOption(option, index) {
    const value = String(option?.value ?? "").trim();
    const label = String(option?.label ?? "").trim();
    return {
      value: value || `opcao_${index + 1}`,
      label: label || value || `Opcao ${index + 1}`
    };
  }

  function normalizeRidFormField(field, index) {
    const label = String(field?.label || "").trim() || `Campo ${index + 1}`;
    const key = getCurrentSchemaKey() === "employee"
      ? (canonicalizeEmployeeFieldKey(field?.key || label) || `campo_${index + 1}`)
      : (slugifyRidFieldKey(field?.key || label) || `campo_${index + 1}`);
    const type = ["text", "textarea", "select", "date", "file", "email", "password", "checkbox"].includes(field?.type) ? field.type : "text";
    const options = Array.isArray(field?.options) ? field.options.map(normalizeRidFormOption) : [];
    return {
      key,
      label,
      type,
      required: Boolean(field?.required),
      placeholder: String(field?.placeholder || "").trim(),
      helperText: String(field?.helperText || "").trim(),
      options: type === "select" ? options : []
    };
  }

  function normalizeRidFormSchema(fields) {
    if (!Array.isArray(fields) || !fields.length) {
      return getCurrentSchemaKey() === "employee" ? getDefaultEmployeeFormSchema() : getDefaultRidFormSchema();
    }
    return fields.map(normalizeRidFormField);
  }

  function createRidFormField() {
    const fields = getCurrentSchemaFields();
    const index = fields.length + 1;
    return normalizeRidFormField({
      key: `campo_${index}`,
      label: `Novo campo ${index}`,
      type: "text",
      required: false,
      placeholder: "",
      helperText: "",
      options: []
    }, index - 1);
  }

  function escapeAttribute(value) {
    return escapeHtml(String(value ?? ""));
  }

  function renderRidFormEditor() {
    if (!dom.ridFormFields) return;
    const schemaKey = getCurrentSchemaKey();
    const schemaMeta = getSchemaMeta(schemaKey);
    const fields = getCurrentSchemaFields();

    dom.ridFormSectionTitle.textContent = schemaMeta.title;
    dom.ridFormSectionSubtitle.textContent = schemaMeta.subtitle;
    dom.ridSchemaTab.classList.toggle("active", schemaKey === "rid");
    dom.employeeSchemaTab.classList.toggle("active", schemaKey === "employee");

    if (!fields.length) {
      dom.ridFormFields.innerHTML = `<div class="schema-empty">Nenhum campo configurado. Clique em "Adicionar campo" para montar o formulario.</div>`;
      return;
    }

    dom.ridFormFields.innerHTML = fields.map((field, index) => `
      <article class="schema-card" data-field-index="${index}">
        <div class="schema-card-head">
          <div class="schema-card-head-main">
            <div class="schema-card-index">#${index + 1}</div>
            <div>
              <div class="schema-card-title">${escapeHtml(field.label || `Campo ${index + 1}`)}</div>
              <div class="schema-card-meta">Chave: ${escapeHtml(field.key)} | Tipo: ${escapeHtml(field.type)} | ${field.required ? "Obrigatorio" : "Opcional"}</div>
            </div>
          </div>
          <div class="schema-card-actions">
            <button type="button" data-move-field="up" class="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50" ${index === 0 ? "disabled" : ""}>Subir</button>
            <button type="button" data-move-field="down" class="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50" ${index === fields.length - 1 ? "disabled" : ""}>Descer</button>
            <button type="button" data-edit-field="true" class="px-3 py-2 rounded-xl border border-gray-900 bg-gray-900 text-xs font-semibold text-white hover:bg-gray-800">Editar</button>
            <button type="button" data-remove-field="true" class="px-3 py-2 rounded-xl border border-red-100 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100">Remover</button>
          </div>
        </div>
        <div class="schema-card-summary">
          <div class="schema-summary-tile">
            <div class="schema-summary-label">Tipo</div>
            <div class="schema-summary-value">${escapeHtml(field.type)}</div>
          </div>
          <div class="schema-summary-tile">
            <div class="schema-summary-label">Placeholder</div>
            <div class="schema-summary-value">${escapeHtml(field.placeholder || "Nao definido")}</div>
          </div>
          <div class="schema-summary-tile">
            <div class="schema-summary-label">Obrigatoriedade</div>
            <div class="schema-summary-value">${field.required ? "Campo obrigatorio" : "Campo opcional"}</div>
          </div>
          <div class="schema-summary-tile">
            <div class="schema-summary-label">Alternativas</div>
            <div class="schema-summary-value">${field.type === "select" ? `${field.options.length} cadastrada(s)` : "Nao se aplica"}</div>
          </div>
        </div>
      </article>
    `).join("");
  }

  function getActiveRidFormField() {
    if (state.activeRidFormFieldIndex === null || state.activeRidFormFieldIndex === undefined) return null;
    return getCurrentSchemaFields()[state.activeRidFormFieldIndex] || null;
  }

  function closeRidFieldModal() {
    state.activeRidFormFieldIndex = null;
    dom.ridFieldModal.classList.remove("visible");
    dom.ridFieldModalBody.innerHTML = "";
  }

  function openRidFieldModal(index) {
    state.activeRidFormFieldIndex = index;
    renderRidFieldModal();
    dom.ridFieldModal.classList.add("visible");
  }

  function renderRidFieldModal() {
    const field = getActiveRidFormField();
    if (!field) {
      closeRidFieldModal();
      return;
    }

    dom.ridFieldModalTitle.textContent = field.label || "Campo";
    dom.ridFieldModalBody.innerHTML = `
      <div class="schema-section" data-modal-field-index="${state.activeRidFormFieldIndex}">
        <div class="schema-section-title">Dados do campo</div>
        <div class="schema-grid">
          <div>
            <label class="schema-field-label">Rotulo</label>
            <input data-field-prop="label" type="text" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50" value="${escapeAttribute(field.label)}">
          </div>
          <div>
            <label class="schema-field-label">Chave tecnica</label>
            <input data-field-prop="key" type="text" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50" value="${escapeAttribute(field.key)}" placeholder="Ex: local_ocorrencia">
          </div>
        </div>
        <div class="schema-grid-compact mt-3">
          <div>
            <label class="schema-field-label">Tipo do campo</label>
            <select data-field-prop="type" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50">
              <option value="text" ${field.type === "text" ? "selected" : ""}>Texto curto</option>
              <option value="email" ${field.type === "email" ? "selected" : ""}>Email</option>
              <option value="password" ${field.type === "password" ? "selected" : ""}>Senha</option>
              <option value="checkbox" ${field.type === "checkbox" ? "selected" : ""}>Checkbox</option>
              <option value="textarea" ${field.type === "textarea" ? "selected" : ""}>Texto longo</option>
              <option value="select" ${field.type === "select" ? "selected" : ""}>Lista de alternativas</option>
              <option value="date" ${field.type === "date" ? "selected" : ""}>Data</option>
              <option value="file" ${field.type === "file" ? "selected" : ""}>Arquivo/imagem</option>
            </select>
          </div>
          <div>
            <label class="schema-field-label">Placeholder</label>
            <input data-field-prop="placeholder" type="text" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50" value="${escapeAttribute(field.placeholder)}" placeholder="Texto de apoio">
          </div>
          <div class="flex items-end">
            <label class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700">
              <input data-field-prop="required" type="checkbox" class="rounded border-gray-300 text-black focus:ring-gray-400" ${field.required ? "checked" : ""}>
              Campo obrigatorio
            </label>
          </div>
        </div>
        <div class="mt-3">
          <label class="schema-field-label">Texto de apoio</label>
          <textarea data-field-prop="helperText" rows="2" class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-gray-50 resize-y" placeholder="Mensagem opcional abaixo do campo">${escapeHtml(field.helperText)}</textarea>
          <div class="schema-field-note">Esse texto aparece abaixo do campo no formulario mobile.</div>
        </div>
      </div>
      ${field.type === "select" ? `
        <div class="schema-section" style="margin-top:16px;">
          <div class="schema-section-title">Alternativas</div>
          <div class="schema-options">
            <div class="schema-options-head">
              <div class="schema-field-note" style="margin-top:0;">Edite, adicione ou remova as opcoes desse campo.</div>
              <button type="button" data-add-option="true" class="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">Adicionar alternativa</button>
            </div>
            ${(field.options || []).length ? field.options.map((option, optionIndex) => `
              <div class="schema-option-row" data-option-index="${optionIndex}">
                <div>
                  <div class="schema-option-index">Alternativa ${optionIndex + 1}</div>
                  <input data-option-prop="label" type="text" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white" value="${escapeAttribute(option.label)}" placeholder="Texto exibido para o usuario">
                </div>
                <div>
                  <div class="schema-option-index">Valor salvo</div>
                  <input data-option-prop="value" type="text" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white" value="${escapeAttribute(option.value)}" placeholder="Valor tecnico salvo no RID">
                </div>
                <div class="flex items-end">
                  <button type="button" data-remove-option="true" class="px-3 py-2 rounded-xl border border-red-100 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100">Remover</button>
                </div>
              </div>
            `).join("") : '<div class="schema-empty" style="margin-top:10px;">Esse campo ainda nao possui alternativas.</div>'}
          </div>
        </div>
      ` : ""}
    `;
  }

  function syncRidFieldModalHeader() {
    const field = getActiveRidFormField();
    if (!field) return;
    dom.ridFieldModalTitle.textContent = field.label || "Campo";
  }

  async function loadRidFormSchema() {
    dom.ridFormFeedback.textContent = "Carregando formulario...";
    try {
      const snap = await RID_FORM_SETTINGS_DOC.get();
      const data = snap.exists ? snap.data() || {} : {};
      state.formSchemas.rid = normalizeRidFormSchema(data.ridFields || data.fields);
      state.formSchemas.employee = (Array.isArray(data.employeeFields) && data.employeeFields.length)
        ? data.employeeFields.map(normalizeRidFormField)
        : getDefaultEmployeeFormSchema();
      const fields = getCurrentSchemaFields();
      dom.ridFormNotice.textContent = snap.exists
        ? `Formulario carregado com ${fields.length} campo(s). ${getSchemaMeta(getCurrentSchemaKey()).fixedNote}`
        : `Nenhum formulario salvo. Estrutura padrao carregada. ${getSchemaMeta(getCurrentSchemaKey()).fixedNote}`;
      dom.ridFormFeedback.textContent = "Formulario carregado com sucesso.";
      renderRidFormEditor();
    } catch (error) {
      state.formSchemas.rid = getDefaultRidFormSchema();
      state.formSchemas.employee = getDefaultEmployeeFormSchema();
      dom.ridFormNotice.textContent = `Nao foi possivel ler o formulario salvo. Estrutura padrao carregada. ${getSchemaMeta(getCurrentSchemaKey()).fixedNote}`;
      dom.ridFormFeedback.textContent = "Nao foi possivel carregar o formulario salvo.";
      renderRidFormEditor();
    }
  }

  function validateRidFormSchema() {
    const fields = getCurrentSchemaFields();
    if (!fields.length) return "Adicione pelo menos um campo ao formulario.";

    const keys = new Set();
    for (const field of fields) {
      if (!field.label) return "Todos os campos precisam ter rotulo.";
      if (!field.key) return "Todos os campos precisam ter chave.";
      if (keys.has(field.key)) return `A chave "${field.key}" esta repetida.`;
      keys.add(field.key);

      if (field.type === "select") {
        if (!field.options.length) return `O campo "${field.label}" precisa ter pelo menos uma alternativa.`;
        for (const option of field.options) {
          if (!String(option.label || "").trim() || !String(option.value || "").trim()) {
            return `Preencha texto e valor de todas as alternativas do campo "${field.label}".`;
          }
        }
      }
    }

    return "";
  }

  async function saveRidFormSchema() {
    if (!state.currentUserData?.isDeveloper) {
      dom.ridFormFeedback.textContent = "Apenas desenvolvedor pode salvar o formulario.";
      return;
    }

    const validationMessage = validateRidFormSchema();
    if (validationMessage) {
      dom.ridFormFeedback.textContent = validationMessage;
      return;
    }

    dom.saveRidFormButton.disabled = true;
    dom.ridFormFeedback.textContent = "Salvando formulario...";
    try {
      const fields = normalizeRidFormSchema(getCurrentSchemaFields());
      setCurrentSchemaFields(fields);
      await RID_FORM_SETTINGS_DOC.set({
        ridFields: state.formSchemas.rid,
        employeeFields: state.formSchemas.employee,
        fields: state.formSchemas.rid,
        version: Date.now(),
        fixedNote: getSchemaMeta(getCurrentSchemaKey()).fixedNote,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: state.currentUser.uid,
        updatedByName: state.currentUserData?.name || ""
      }, { merge: true });
      dom.ridFormNotice.textContent = `Formulario salvo com ${fields.length} campo(s). ${getSchemaMeta(getCurrentSchemaKey()).fixedNote}`;
      dom.ridFormFeedback.textContent = "Formulario salvo com sucesso.";
      renderRidFormEditor();
    } catch (error) {
      dom.ridFormFeedback.textContent = "Nao foi possivel salvar o formulario.";
    } finally {
      dom.saveRidFormButton.disabled = false;
    }
  }

  function resetAnnouncementForm() {
    dom.announcementTitle.value = "";
    dom.announcementStartDate.value = "";
    dom.announcementMessage.value = "";
    dom.announcementImage.value = "";
    dom.announcementDays.value = "";
    dom.announcementDailyLimit.value = "";
    dom.announcementTarget.value = "all";
    dom.announcementActive.checked = false;
    state.announcementImageDataUrl = "";
    dom.announcementImagePreview.classList.add("hidden-state");
    dom.announcementImagePreviewImg.removeAttribute("src");
  }

  function resetPushNotificationForm() {
    dom.pushNotificationTitle.value = "";
    dom.pushNotificationTarget.value = "all";
    dom.pushNotificationMessage.value = "";
    dom.pushRecipientSearch.value = "";
    dom.pushRecipientRoleFilter.value = "";
    dom.pushRecipientUnitFilter.value = "";
    dom.pushRecipientSectorFilter.value = "";
    dom.pushRecipientEmploymentFilter.value = "";
    state.selectedPushRecipientIds = new Set();
    renderPushRecipients();
  }

  function updateAnnouncementImagePreview(dataUrl) {
    state.announcementImageDataUrl = String(dataUrl || "").trim();
    if (!state.announcementImageDataUrl) {
      dom.announcementImagePreview.classList.add("hidden-state");
      dom.announcementImagePreviewImg.removeAttribute("src");
      return;
    }

    dom.announcementImagePreviewImg.src = state.announcementImageDataUrl;
    dom.announcementImagePreview.classList.remove("hidden-state");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem selecionada."));
      reader.readAsDataURL(file);
    });
  }

  function renderAnnouncementList(items) {
    if (!items.length) {
      dom.announcementList.innerHTML = '<div class="notice-card text-sm text-gray-500">Nenhum aviso cadastrado ainda.</div>';
      return;
    }

    dom.announcementList.innerHTML = items.map((item) => `
      <article class="border border-gray-200 rounded-2xl bg-white px-4 py-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-gray-900">${formatField(item.title, "Sem título")}</div>
            <div class="text-xs text-gray-500 mt-1">${escapeHtml(getAnnouncementTargetLabel(item.target))} • ${escapeHtml(formatAnnouncementWindow(item))}</div>
          </div>
          <span class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}">
            ${item.isActive ? "Ativo" : "Encerrado"}
          </span>
        </div>
        ${item.imageDataUrl ? `
          <div class="mt-3">
            <img src="${escapeHtml(item.imageDataUrl)}" alt="Imagem do aviso" class="w-full max-h-48 object-cover rounded-2xl border border-gray-200">
          </div>
        ` : ""}
        <div class="text-sm text-gray-600 mt-3 whitespace-pre-wrap">${escapeHtml(item.message || "")}</div>
        <div class="text-[11px] text-gray-400 mt-3">Atualizado em ${escapeHtml(formatDateTime(item.updatedAt))}</div>
        <div class="flex items-center justify-end gap-2 mt-3">
          <button type="button" data-duplicate-announcement="${escapeHtml(item.id)}" class="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">Usar como base</button>
          <button type="button" data-toggle-announcement="${escapeHtml(item.id)}" data-next-active="${item.isActive ? "false" : "true"}" class="px-3 py-2 rounded-xl ${item.isActive ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"} text-xs font-semibold">
            ${item.isActive ? "Encerrar" : "Reativar"}
          </button>
        </div>
      </article>
    `).join("");
  }

  function getFilteredPushAudienceUsers() {
    const search = String(dom.pushRecipientSearch.value || "").trim().toLowerCase();
    const role = String(dom.pushRecipientRoleFilter.value || "").trim();
    const unit = String(dom.pushRecipientUnitFilter.value || "").trim();
    const sector = String(dom.pushRecipientSectorFilter.value || "").trim();
    const employmentType = String(dom.pushRecipientEmploymentFilter.value || "").trim().toUpperCase();

    return state.pushAudienceUsers.filter((user) => {
      if (role && getPushRecipientRoleKey(user) !== role) return false;
      if (unit && String(user.unit || "").trim() !== unit) return false;
      if (sector && String(user.sector || "").trim() !== sector) return false;
      if (employmentType && String(user.employmentType || "").trim().toUpperCase() !== employmentType) return false;
      if (!search) return true;

      const haystack = [
        user.name,
        user.email,
        user.cpf,
        user.unit,
        user.sector,
        user.role,
        getRoleLabel(user)
      ].join(" ").toLowerCase();

      return haystack.includes(search);
    });
  }

  function renderPushRecipientFilters() {
    const units = sortByLocale(state.pushAudienceUsers.map((item) => formatField(item.unit, "")).filter(Boolean));
    const sectors = sortByLocale(state.pushAudienceUsers.map((item) => formatField(item.sector, "")).filter(Boolean));
    const uniqueUnits = [...new Set(units)];
    const uniqueSectors = [...new Set(sectors)];

    const selectedUnit = dom.pushRecipientUnitFilter.value;
    const selectedSector = dom.pushRecipientSectorFilter.value;

    dom.pushRecipientUnitFilter.innerHTML = `<option value="">Todas as unidades</option>${uniqueUnits.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
    dom.pushRecipientSectorFilter.innerHTML = `<option value="">Todos os setores</option>${uniqueSectors.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;

    if (uniqueUnits.includes(selectedUnit)) dom.pushRecipientUnitFilter.value = selectedUnit;
    if (uniqueSectors.includes(selectedSector)) dom.pushRecipientSectorFilter.value = selectedSector;
  }

  function renderPushRecipients() {
    if (!dom.pushRecipientsList) return;
    const filteredUsers = getFilteredPushAudienceUsers();
    const selectedCount = state.selectedPushRecipientIds.size;
    dom.pushRecipientCounts.textContent = `${filteredUsers.length} usuario(s) filtrado(s) e ${selectedCount} selecionado(s).`;

    if (!filteredUsers.length) {
      dom.pushRecipientsList.innerHTML = '<div class="notice-card text-sm text-gray-500">Nenhum usuario encontrado com os filtros atuais.</div>';
      return;
    }

    dom.pushRecipientsList.innerHTML = filteredUsers.map((user) => {
      const userId = String(user.id || "");
      const checked = state.selectedPushRecipientIds.has(userId);
      return `
        <label class="recipient-card">
          <input type="checkbox" data-push-recipient-id="${escapeHtml(userId)}" ${checked ? "checked" : ""}>
          <div class="min-w-0">
            <div class="recipient-card-title">${escapeHtml(formatField(user.name, "Sem nome"))}</div>
            <div class="recipient-card-meta">
              ${escapeHtml(formatField(user.email, "Sem email"))}<br>
              CPF: ${escapeHtml(formatField(user.cpf, "-"))}
            </div>
            <div class="recipient-card-badges">
              <span class="recipient-card-badge">${escapeHtml(getRoleLabel(user))}</span>
              <span class="recipient-card-badge">${escapeHtml(normalizeEmploymentTypeLabel(user.employmentType))}</span>
              <span class="recipient-card-badge">${escapeHtml(formatField(user.unit, "Sem unidade"))}</span>
              <span class="recipient-card-badge">${escapeHtml(formatField(user.sector, "Sem setor"))}</span>
            </div>
          </div>
        </label>
      `;
    }).join("");
  }

  function describePushTarget(target) {
    if (target === "dashboard") return "Somente PC";
    if (target === "mobile") return "Somente mobile";
    return "PC e mobile";
  }

  function buildPushSelectionSummary(campaign) {
    const selectedCount = Number(campaign?.recipientCount || 0);
    const filterBits = [];
    if (campaign?.recipientFilters?.role) filterBits.push(`perfil ${campaign.recipientFilters.role}`);
    if (campaign?.recipientFilters?.unit) filterBits.push(`unidade ${campaign.recipientFilters.unit}`);
    if (campaign?.recipientFilters?.sector) filterBits.push(`setor ${campaign.recipientFilters.sector}`);
    if (campaign?.recipientFilters?.employmentType) filterBits.push(`categoria ${campaign.recipientFilters.employmentType}`);
    const filterText = filterBits.length ? ` | base: ${filterBits.join(", ")}` : "";
    return `${selectedCount} destinatario(s)${filterText}`;
  }

  function renderPushNotificationList(items) {
    if (!items.length) {
      dom.pushNotificationList.innerHTML = '<div class="notice-card text-sm text-gray-500">Nenhuma push cadastrada ainda.</div>';
      return;
    }

    dom.pushNotificationList.innerHTML = items.map((item) => {
      const status = String(item.status || "queued").trim().toLowerCase();
      const badgeClass = status === "sent"
        ? "bg-emerald-50 text-emerald-700"
        : status === "failed"
          ? "bg-red-50 text-red-600"
          : "bg-amber-50 text-amber-700";
      const badgeLabel = status === "sent" ? "Enviado" : status === "failed" ? "Falhou" : "Na fila";
      return `
        <article class="border border-gray-200 rounded-2xl bg-white px-4 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-gray-900">${escapeHtml(formatField(item.title, "Sem titulo"))}</div>
              <div class="text-xs text-gray-500 mt-1">${escapeHtml(describePushTarget(item.target))} | ${escapeHtml(buildPushSelectionSummary(item))}</div>
            </div>
            <span class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${badgeClass}">${badgeLabel}</span>
          </div>
          <div class="text-sm text-gray-600 mt-3 whitespace-pre-wrap">${escapeHtml(item.message || "")}</div>
          <div class="text-[11px] text-gray-400 mt-3">
            Criado em ${escapeHtml(formatDateTime(item.createdAt))} | Tokens enviados: ${escapeHtml(String(item.deliveredTokenCount || 0))}
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadPushAudienceUsers() {
    try {
      const snap = await db.collection("users").orderBy("name").get();
      state.pushAudienceUsers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderPushRecipientFilters();
      renderPushRecipients();
    } catch (error) {
      state.pushAudienceUsers = [];
      renderPushRecipientFilters();
      renderPushRecipients();
      dom.pushNotificationFeedback.textContent = "Nao foi possivel carregar a base de usuarios para a push.";
    }
  }

  async function loadPushNotifications() {
    dom.pushNotificationFeedback.textContent = "Carregando pushs...";
    try {
      const snap = await WEB_PUSH_COLLECTION.orderBy("createdAt", "desc").limit(20).get();
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderPushNotificationList(items);
      dom.pushNotificationFeedback.textContent = "Lista de pushs carregada com sucesso.";
    } catch (error) {
      dom.pushNotificationFeedback.textContent = "Nao foi possivel carregar a lista de pushs.";
    }
  }

  async function savePushNotification(event) {
    event.preventDefault();
    if (!isPrivilegedUser(state.currentUserData)) {
      dom.pushNotificationFeedback.textContent = "Apenas administrador ou desenvolvedor pode enviar web push.";
      return;
    }

    const title = String(dom.pushNotificationTitle.value || "").trim();
    const message = String(dom.pushNotificationMessage.value || "").trim();
    const target = String(dom.pushNotificationTarget.value || "all").trim();
    const selectedIds = [...state.selectedPushRecipientIds].filter(Boolean);

    if (!title || !message) {
      dom.pushNotificationFeedback.textContent = "Preencha titulo e mensagem da push.";
      return;
    }

    if (!selectedIds.length) {
      dom.pushNotificationFeedback.textContent = "Selecione pelo menos um destinatario antes de enviar.";
      return;
    }

    dom.sendPushNotificationButton.disabled = true;
    dom.pushNotificationFeedback.textContent = "Enfileirando push...";
    try {
      await WEB_PUSH_COLLECTION.add({
        title,
        message,
        target,
        status: "queued",
        recipientUserIds: selectedIds,
        recipientCount: selectedIds.length,
        recipientFilters: {
          role: String(dom.pushRecipientRoleFilter.value || "").trim(),
          unit: String(dom.pushRecipientUnitFilter.value || "").trim(),
          sector: String(dom.pushRecipientSectorFilter.value || "").trim(),
          employmentType: String(dom.pushRecipientEmploymentFilter.value || "").trim().toUpperCase(),
          search: String(dom.pushRecipientSearch.value || "").trim()
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: state.currentUser.uid,
        createdByName: state.currentUserData?.name || ""
      });
      dom.pushNotificationNotice.textContent = `Push criada para ${selectedIds.length} destinatario(s) em ${describePushTarget(target)}.`;
      dom.pushNotificationFeedback.textContent = "Push colocada na fila com sucesso.";
      resetPushNotificationForm();
      await loadPushNotifications();
    } catch (error) {
      dom.pushNotificationFeedback.textContent = "Nao foi possivel criar a push.";
    } finally {
      dom.sendPushNotificationButton.disabled = false;
    }
  }

  function updateRoleNavigation() {
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

  async function loadGoal() {
    if (!dom.goalMonth || !dom.goalYear || !dom.goalFeedback || !dom.goalValue || !dom.goalStat || !dom.goalMonthStat || !dom.goalNotice) return;
    const key = getMonthKey(dom.goalMonth.value, dom.goalYear.value);
    dom.goalFeedback.textContent = "Carregando meta...";
    try {
      const snap = await db.collection("goals").doc(key).get();
      if (snap.exists) {
        const value = snap.data()?.goal ?? "";
        dom.goalValue.value = value;
        dom.goalStat.textContent = String(value);
        dom.goalMonthStat.textContent = `${getMonthLabel(dom.goalMonth.value)} de ${dom.goalYear.value}`;
        dom.goalNotice.textContent = `Meta manual cadastrada para ${getMonthLabel(dom.goalMonth.value)} de ${dom.goalYear.value}.`;
        dom.goalFeedback.textContent = "Meta carregada com sucesso.";
      } else {
        dom.goalValue.value = "";
        dom.goalStat.textContent = "-";
        dom.goalMonthStat.textContent = `${getMonthLabel(dom.goalMonth.value)} de ${dom.goalYear.value}`;
        dom.goalNotice.textContent = `Nenhuma meta manual registrada para ${getMonthLabel(dom.goalMonth.value)} de ${dom.goalYear.value}.`;
        dom.goalFeedback.textContent = "Nao existe meta manual para esse mes.";
      }
    } catch (error) {
      dom.goalFeedback.textContent = "Nao foi possivel carregar a meta.";
    }
  }

  async function saveGoal(event) {
    if (!dom.goalValue || !dom.goalMonth || !dom.goalYear || !dom.saveGoalButton || !dom.goalFeedback || !dom.goalStat || !dom.goalMonthStat || !dom.goalNotice) return;
    event.preventDefault();
    if (!isDeveloperUser(state.currentUserData)) {
      dom.goalFeedback.textContent = "Apenas desenvolvedor pode salvar meta manual.";
      return;
    }

    const value = Number(dom.goalValue.value || 0);
    const key = getMonthKey(dom.goalMonth.value, dom.goalYear.value);
    dom.saveGoalButton.disabled = true;
    dom.goalFeedback.textContent = "Salvando meta...";
    try {
      await db.collection("goals").doc(key).set({
        goal: value,
        setBy: state.currentUser.uid,
        setAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      dom.goalStat.textContent = String(value);
      dom.goalMonthStat.textContent = `${getMonthLabel(dom.goalMonth.value)} de ${dom.goalYear.value}`;
      dom.goalNotice.textContent = `Meta manual atualizada para ${getMonthLabel(dom.goalMonth.value)} de ${dom.goalYear.value}.`;
      dom.goalFeedback.textContent = "Meta salva com sucesso.";
    } catch (error) {
      dom.goalFeedback.textContent = "Nao foi possivel salvar a meta.";
    } finally {
      dom.saveGoalButton.disabled = false;
    }
  }

  async function loadAnnouncement() {
    dom.announcementFeedback.textContent = "Carregando aviso...";
    try {
      const snap = await ANNOUNCEMENTS_COLLECTION.orderBy("updatedAt", "desc").get();
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (!items.length) {
        resetAnnouncementForm();
        dom.announcementNotice.textContent = "Nenhum aviso global configurado no momento.";
        renderAnnouncementList([]);
        dom.announcementFeedback.textContent = "Ainda não existe aviso salvo.";
        return;
      }

      const latest = items[0];
      dom.announcementNotice.textContent = latest.isActive
        ? `Último aviso ativo para ${formatAnnouncementWindow(latest)} em ${getAnnouncementTargetLabel(latest.target)}.`
        : "O último aviso salvo está desativado.";
      renderAnnouncementList(items);
      dom.announcementFeedback.textContent = "Avisos carregados com sucesso.";
    } catch (error) {
      dom.announcementFeedback.textContent = "Não foi possível carregar o aviso.";
    }
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    if (!state.currentUserData?.isDeveloper) {
      dom.announcementFeedback.textContent = "Apenas desenvolvedor pode salvar aviso global.";
      return;
    }

    const title = String(dom.announcementTitle.value || "").trim();
    const message = String(dom.announcementMessage.value || "").trim();
    const startDate = String(dom.announcementStartDate.value || "").trim();
    const daysVisible = Number(dom.announcementDays.value || 0);
    const dailyLimit = Number(dom.announcementDailyLimit.value || 0);
    const target = String(dom.announcementTarget.value || "all");
    const isActive = dom.announcementActive.checked;

    if (!title || !message || !startDate || !daysVisible || !dailyLimit) {
      dom.announcementFeedback.textContent = "Preencha título, mensagem, data de início, dias e vezes por dia.";
      return;
    }

    dom.saveAnnouncementButton.disabled = true;
    dom.announcementFeedback.textContent = "Salvando aviso...";
    try {
      await ANNOUNCEMENTS_COLLECTION.add({
        title,
        message,
        imageDataUrl: state.announcementImageDataUrl || "",
        startDate,
        daysVisible,
        dailyLimit,
        target,
        isActive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: state.currentUser.uid,
        updatedByName: state.currentUserData.name || ""
      });
      resetAnnouncementForm();
      dom.announcementNotice.textContent = isActive
        ? `Aviso ativo para ${formatAnnouncementWindow({ startDate, daysVisible })} em ${getAnnouncementTargetLabel(target)}.`
        : "Aviso salvo, porém desativado.";
      dom.announcementFeedback.textContent = "Aviso salvo com sucesso.";
      await loadAnnouncement();
    } catch (error) {
      dom.announcementFeedback.textContent = "Não foi possível salvar o aviso.";
    } finally {
      dom.saveAnnouncementButton.disabled = false;
    }
  }

  async function toggleAnnouncementStatus(id, nextActive) {
    try {
      await ANNOUNCEMENTS_COLLECTION.doc(id).set({
        isActive: nextActive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: state.currentUser.uid,
        updatedByName: state.currentUserData?.name || ""
      }, { merge: true });
      dom.announcementFeedback.textContent = nextActive ? "Aviso ativado." : "Aviso desativado.";
      await loadAnnouncement();
    } catch (error) {
      dom.announcementFeedback.textContent = "Não foi possível alterar o status do aviso.";
    }
  }

  async function duplicateAnnouncement(id) {
    try {
      const snap = await ANNOUNCEMENTS_COLLECTION.doc(id).get();
      if (!snap.exists) return;
      const data = snap.data() || {};
      dom.announcementTitle.value = String(data.title || "");
      dom.announcementStartDate.value = String(data.startDate || "");
      dom.announcementMessage.value = String(data.message || "");
      dom.announcementImage.value = "";
      updateAnnouncementImagePreview(String(data.imageDataUrl || ""));
      dom.announcementDays.value = data.daysVisible ? String(data.daysVisible) : "";
      dom.announcementDailyLimit.value = data.dailyLimit ? String(data.dailyLimit) : "";
      dom.announcementTarget.value = String(data.target || "all");
      dom.announcementActive.checked = Boolean(data.isActive);
      dom.announcementFeedback.textContent = "Campos preenchidos com base no aviso selecionado.";
    } catch (error) {
      dom.announcementFeedback.textContent = "Não foi possível carregar esse aviso para edição.";
    }
  }

  async function changePassword(event) {
    if (!dom.currentPassword || !dom.newPassword || !dom.confirmPassword || !dom.passwordFeedback || !dom.passwordSubmitButton) return;
    event.preventDefault();
    const currentPassword = String(dom.currentPassword.value || "").trim();
    const newPassword = String(dom.newPassword.value || "").trim();
    const confirmPassword = String(dom.confirmPassword.value || "").trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      dom.passwordFeedback.textContent = "Preencha senha atual, nova senha e confirmacao.";
      return;
    }

    if (newPassword.length < 6) {
      dom.passwordFeedback.textContent = "A nova senha precisa ter pelo menos 6 caracteres.";
      return;
    }

    if (newPassword !== confirmPassword) {
      dom.passwordFeedback.textContent = "A confirmacao da nova senha nao confere.";
      return;
    }

    if (!auth.currentUser) {
      dom.passwordFeedback.textContent = "Sessao invalida. Entre novamente.";
      return;
    }

    const email = auth.currentUser.email || formatField(state.currentUserData?.email, cpfToEmail(state.currentUserData?.cpf));
    dom.passwordSubmitButton.disabled = true;
    dom.passwordFeedback.textContent = "Atualizando senha...";

    try {
      const credential = firebase.auth.EmailAuthProvider.credential(email, currentPassword);
      await auth.currentUser.reauthenticateWithCredential(credential);
      await auth.currentUser.updatePassword(newPassword);
      dom.currentPassword.value = "";
      dom.newPassword.value = "";
      dom.confirmPassword.value = "";
      dom.passwordFeedback.textContent = "Senha alterada com sucesso.";
    } catch (error) {
      dom.passwordFeedback.textContent = "Nao foi possivel trocar a senha. Confira a senha atual.";
    } finally {
      dom.passwordSubmitButton.disabled = false;
    }
  }

  function renderProfile() {
    const user = state.currentUserData || {};
    if (dom.welcomeText) dom.welcomeText.textContent = `Bem-vindo, ${formatField(user.name, "Usuario")}. Aqui voce acompanha suas configuracoes da gestao.`;
    if (dom.profileNameStat) dom.profileNameStat.textContent = formatField(user.name, "-");
    if (dom.profileRoleStat) dom.profileRoleStat.textContent = getRoleLabel(user);
    if (dom.profileSectorStat) dom.profileSectorStat.textContent = formatField(user.sector, "-");
    if (dom.profileName) dom.profileName.textContent = formatField(user.name, "-");
    if (dom.profileCpf) dom.profileCpf.textContent = formatField(user.cpf, "-");
    if (dom.profileEmail) dom.profileEmail.textContent = formatField(user.email, `${String(user.cpf || "").replace(/\D/g, "")}@jdemito.com`);
    if (dom.profileRole) dom.profileRole.textContent = formatField(user.role || getRoleLabel(user), getRoleLabel(user));
    if (dom.profileUnit) dom.profileUnit.textContent = formatField(user.unit, "-");
    if (dom.profileSector) dom.profileSector.textContent = formatField(user.sector, "-");

    if (isDeveloperUser(user)) {
      if (dom.goalForm) dom.goalForm.classList.remove("hidden-state");
      if (dom.announcementSection) dom.announcementSection.classList.remove("hidden-state");
      if (dom.pushNotificationSection) dom.pushNotificationSection.classList.add("hidden-state");
      if (dom.ridFormSection) dom.ridFormSection.classList.remove("hidden-state");
      if (dom.goalNotice) dom.goalNotice.textContent = "Defina a meta manual que sera usada nas telas administrativas.";
      if (dom.goalFeedback) dom.goalFeedback.textContent = "";
      state.activeNotificationTab = "announcement";
      renderNotificationTabLayout();
    } else if (isPrivilegedUser(user)) {
      if (dom.goalForm) dom.goalForm.classList.add("hidden-state");
      if (dom.announcementSection) dom.announcementSection.classList.remove("hidden-state");
      if (dom.pushNotificationSection) dom.pushNotificationSection.classList.add("hidden-state");
      if (dom.ridFormSection) dom.ridFormSection.classList.add("hidden-state");
      if (dom.goalNotice) dom.goalNotice.textContent = "A visualizacao de metas manuais e restrita ao perfil de desenvolvedor.";
      if (dom.goalFeedback) dom.goalFeedback.textContent = "";
      if (dom.goalStat) dom.goalStat.textContent = "-";
      state.activeNotificationTab = "push";
      renderNotificationTabLayout();
    } else {
      if (dom.goalForm) dom.goalForm.classList.add("hidden-state");
      if (dom.announcementSection) dom.announcementSection.classList.add("hidden-state");
      if (dom.pushNotificationSection) dom.pushNotificationSection.classList.add("hidden-state");
      if (dom.ridFormSection) dom.ridFormSection.classList.add("hidden-state");
      if (dom.goalNotice) dom.goalNotice.textContent = "A visualizacao de metas manuais e restrita ao perfil de desenvolvedor.";
      if (dom.goalFeedback) dom.goalFeedback.textContent = "";
      if (dom.goalStat) dom.goalStat.textContent = "-";
    }
  }

  function bindListeners() {
    dom.loginCpf.addEventListener("input", () => {
      dom.loginCpf.value = maskCpf(dom.loginCpf.value);
    });

    dom.loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      dom.loginFeedback.classList.add("hidden-state");
      dom.loginSubmitButton.disabled = true;
      try {
        await auth.signInWithEmailAndPassword(cpfToEmail(dom.loginCpf.value), dom.loginPassword.value);
      } catch (error) {
        dom.loginFeedback.textContent = "Nao foi possivel entrar. Confira CPF e senha.";
        dom.loginFeedback.classList.remove("hidden-state");
      } finally {
        dom.loginSubmitButton.disabled = false;
      }
    });

    dom.logoutButton.addEventListener("click", async () => {
      await auth.signOut();
    });

    dom.loadGoalButton?.addEventListener("click", loadGoal);
    dom.goalForm?.addEventListener("submit", saveGoal);
    dom.passwordForm?.addEventListener("submit", changePassword);
    dom.loadAnnouncementButton.addEventListener("click", loadAnnouncement);
    dom.clearAnnouncementButton.addEventListener("click", () => {
      resetAnnouncementForm();
      dom.announcementFeedback.textContent = "Campos do aviso limpos.";
    });
    dom.announcementImage.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        updateAnnouncementImagePreview("");
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        updateAnnouncementImagePreview(dataUrl);
      } catch (error) {
        updateAnnouncementImagePreview("");
        dom.announcementFeedback.textContent = "Nao foi possivel carregar a imagem do aviso.";
      }
    });
    dom.announcementForm.addEventListener("submit", saveAnnouncement);
    dom.announcementList.addEventListener("click", (event) => {
      const toggleButton = event.target.closest("[data-toggle-announcement]");
      if (toggleButton) {
        toggleAnnouncementStatus(toggleButton.dataset.toggleAnnouncement, toggleButton.dataset.nextActive === "true");
        return;
      }

      const duplicateButton = event.target.closest("[data-duplicate-announcement]");
      if (duplicateButton) {
        duplicateAnnouncement(duplicateButton.dataset.duplicateAnnouncement);
      }
    });
    dom.pushNotificationForm.addEventListener("submit", savePushNotification);
    dom.loadPushNotificationsButton.addEventListener("click", loadPushNotifications);
    dom.selectAllPushRecipientsButton.addEventListener("click", () => {
      state.pushAudienceUsers.forEach((user) => {
        if (user?.id) state.selectedPushRecipientIds.add(String(user.id));
      });
      renderPushRecipients();
      dom.pushNotificationFeedback.textContent = "Todos os usuarios carregados foram adicionados a selecao.";
    });
    dom.selectFilteredPushRecipientsButton.addEventListener("click", () => {
      getFilteredPushAudienceUsers().forEach((user) => {
        if (user?.id) state.selectedPushRecipientIds.add(String(user.id));
      });
      renderPushRecipients();
      dom.pushNotificationFeedback.textContent = "Usuarios filtrados adicionados a selecao.";
    });
    dom.clearPushRecipientFiltersButton.addEventListener("click", () => {
      dom.pushRecipientSearch.value = "";
      dom.pushRecipientRoleFilter.value = "";
      dom.pushRecipientUnitFilter.value = "";
      dom.pushRecipientSectorFilter.value = "";
      dom.pushRecipientEmploymentFilter.value = "";
      renderPushRecipients();
      dom.pushNotificationFeedback.textContent = "Filtros de destinatarios limpos.";
    });
    dom.clearPushRecipientsButton.addEventListener("click", () => {
      state.selectedPushRecipientIds = new Set();
      renderPushRecipients();
      dom.pushNotificationFeedback.textContent = "Selecao de destinatarios limpa.";
    });
    [dom.pushRecipientSearch, dom.pushRecipientRoleFilter, dom.pushRecipientUnitFilter, dom.pushRecipientSectorFilter, dom.pushRecipientEmploymentFilter].forEach((field) => {
      field.addEventListener(field === dom.pushRecipientSearch ? "input" : "change", () => {
        renderPushRecipients();
      });
    });
    dom.pushRecipientsList.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-push-recipient-id]");
      if (!checkbox) return;
      const id = String(checkbox.dataset.pushRecipientId || "");
      if (!id) return;
      if (checkbox.checked) {
        state.selectedPushRecipientIds.add(id);
      } else {
        state.selectedPushRecipientIds.delete(id);
      }
      renderPushRecipients();
    });

    dom.loadRidFormButton.addEventListener("click", loadRidFormSchema);
    dom.ridSchemaTab.addEventListener("click", () => {
      state.activeSchemaTab = "rid";
      state.activeRidFormFieldIndex = null;
      dom.ridFormNotice.textContent = `Formulario carregado com ${getCurrentSchemaFields().length} campo(s). ${getSchemaMeta("rid").fixedNote}`;
      renderRidFormEditor();
      closeRidFieldModal();
    });
    dom.employeeSchemaTab.addEventListener("click", () => {
      state.activeSchemaTab = "employee";
      state.activeRidFormFieldIndex = null;
      dom.ridFormNotice.textContent = `Formulario carregado com ${getCurrentSchemaFields().length} campo(s). ${getSchemaMeta("employee").fixedNote}`;
      renderRidFormEditor();
      closeRidFieldModal();
    });
    dom.resetRidFormButton.addEventListener("click", () => {
      setCurrentSchemaFields(getCurrentSchemaKey() === "employee" ? getDefaultEmployeeFormSchema() : getDefaultRidFormSchema());
      dom.ridFormNotice.textContent = `Estrutura padrao restaurada no editor. ${getSchemaMeta(getCurrentSchemaKey()).fixedNote}`;
      dom.ridFormFeedback.textContent = "Estrutura padrao pronta para edicao.";
      renderRidFormEditor();
    });
    dom.addRidFormFieldButton.addEventListener("click", () => {
      const fields = getCurrentSchemaFields();
      fields.push(createRidFormField());
      dom.ridFormFeedback.textContent = "Novo campo adicionado ao editor.";
      renderRidFormEditor();
      openRidFieldModal(fields.length - 1);
    });
    dom.saveRidFormButton.addEventListener("click", saveRidFormSchema);
    dom.ridFieldModalClose.addEventListener("click", closeRidFieldModal);
    dom.ridFieldModalCancel.addEventListener("click", closeRidFieldModal);
    dom.ridFieldModalSave.addEventListener("click", async () => {
      await saveRidFormSchema();
      if (!dom.saveRidFormButton.disabled) {
        closeRidFieldModal();
      }
    });
    dom.ridFieldModal.addEventListener("click", (event) => {
      if (event.target === dom.ridFieldModal) closeRidFieldModal();
    });
    dom.ridFieldModalBody.addEventListener("input", (event) => {
      const field = getActiveRidFormField();
      if (!field) return;

      const prop = event.target.dataset.fieldProp;
      if (prop) {
        field[prop] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        if (prop === "label" && (!field.key || String(field.key).startsWith("campo_") || String(field.key).startsWith("novo_campo"))) {
          field.key = getCurrentSchemaKey() === "employee"
            ? (canonicalizeEmployeeFieldKey(field.label) || field.key)
            : (slugifyRidFieldKey(field.label) || field.key);
          const keyInput = dom.ridFieldModalBody.querySelector('[data-field-prop="key"]');
          if (keyInput) keyInput.value = field.key;
        }
        if (prop === "key") {
          field.key = getCurrentSchemaKey() === "employee"
            ? canonicalizeEmployeeFieldKey(event.target.value)
            : slugifyRidFieldKey(event.target.value);
          event.target.value = field.key;
        }
        if (prop === "type" && field.type !== "select") {
          field.options = [];
        }
        if (prop === "type" && field.type === "select" && !field.options.length) {
          field.options = [{ label: "Opcao 1", value: "opcao_1" }];
        }
        if (prop === "type") {
          renderRidFieldModal();
        } else if (prop === "label") {
          syncRidFieldModalHeader();
        }
        renderRidFormEditor();
        return;
      }

      const optionProp = event.target.dataset.optionProp;
      if (!optionProp) return;
      const optionRow = event.target.closest("[data-option-index]");
      const option = field.options?.[Number(optionRow?.dataset.optionIndex)];
      if (!option) return;
      option[optionProp] = event.target.value;
      renderRidFormEditor();
    });
    dom.ridFieldModalBody.addEventListener("change", (event) => {
      if (event.target.dataset.fieldProp === "required") {
        const field = getActiveRidFormField();
        if (!field) return;
        field.required = event.target.checked;
        renderRidFormEditor();
      }
    });
    dom.ridFormFields.addEventListener("click", (event) => {
      const card = event.target.closest("[data-field-index]");
      if (!card) return;
      const fieldIndex = Number(card.dataset.fieldIndex);
      const fields = getCurrentSchemaFields();
      const field = fields[fieldIndex];
      if (!field) return;

      if (event.target.closest("[data-remove-field]")) {
        fields.splice(fieldIndex, 1);
        dom.ridFormFeedback.textContent = "Campo removido do editor.";
        renderRidFormEditor();
        return;
      }

      const moveButton = event.target.closest("[data-move-field]");
      if (moveButton) {
        const direction = moveButton.dataset.moveField;
        const nextIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
        if (nextIndex < 0 || nextIndex >= fields.length) return;
        const [moved] = fields.splice(fieldIndex, 1);
        fields.splice(nextIndex, 0, moved);
        renderRidFormEditor();
        return;
      }

      if (event.target.closest("[data-edit-field]")) {
        openRidFieldModal(fieldIndex);
        return;
      }
    });

    dom.ridFieldModalBody.addEventListener("click", (event) => {
      const field = getActiveRidFormField();
      if (!field) return;

      if (event.target.closest("[data-add-option]")) {
        field.options = Array.isArray(field.options) ? field.options : [];
        field.options.push({ label: `Opcao ${field.options.length + 1}`, value: `opcao_${field.options.length + 1}` });
        renderRidFieldModal();
        renderRidFormEditor();
        return;
      }

      const optionRow = event.target.closest("[data-option-index]");
      if (event.target.closest("[data-remove-option]") && optionRow) {
        field.options.splice(Number(optionRow.dataset.optionIndex), 1);
        renderRidFieldModal();
        renderRidFormEditor();
      }
    });
  }

  async function handleAuthenticatedUser(user) {
    state.currentUser = user;
    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
    updateRoleNavigation();
    renderProfile();
    dom.authOverlay.classList.remove("visible");
    dom.pageShell.classList.remove("hidden-state");
    dom.bootOverlay.classList.add("hidden-state");
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
    await loadGoal();
    if (isPrivilegedUser(state.currentUserData)) {
      await loadPushAudienceUsers();
      await loadPushNotifications();
    }
    if (isDeveloperUser(state.currentUserData)) {
      await loadAnnouncement();
      await loadRidFormSchema();
    }
  }

  function init() {
    const now = new Date();
    if (dom.goalMonth) dom.goalMonth.value = String(now.getMonth() + 1);
    if (dom.goalYear) dom.goalYear.value = String(now.getFullYear());
    setupNotificationSectionTabs();
    bindListeners();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        state.currentUser = null;
        state.currentUserData = null;
        redirectToLogin();
        return;
      }

      dom.bootOverlay.classList.remove("hidden-state");
      await handleAuthenticatedUser(user);
    });
  }

  init();
})();
