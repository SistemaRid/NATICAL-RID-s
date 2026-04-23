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

  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  const db = firebase.firestore();

  const state = {
    currentUser: null,
    currentUserData: null,
    allHistory: [],
    ridHistory: [],
    employeeHistory: [],
    filters: {},
    selectedHistoryId: null,
    unsubRidHistory: null,
    unsubEmployeeHistory: null
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
    filterRid: document.getElementById("filterRid"),
    filterUser: document.getElementById("filterUser"),
    filterDate: document.getElementById("filterDate"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    totalCount: document.getElementById("totalCount"),
    uniqueUsersCount: document.getElementById("uniqueUsersCount"),
    changedFieldsCount: document.getElementById("changedFieldsCount"),
    latestChangeTime: document.getElementById("latestChangeTime"),
    historyCount: document.getElementById("historyCount"),
    historyList: document.getElementById("historyList"),
    historyModal: document.getElementById("historyModal"),
    historyModalTitle: document.getElementById("historyModalTitle"),
    historyModalBody: document.getElementById("historyModalBody"),
    historyModalClose: document.getElementById("historyModalClose")
  };

  function isAdminProfile(user = state.currentUserData) {
    return !!user?.isAdmin;
  }

  function isDeveloperProfile(user = state.currentUserData) {
    return !!(user?.isAdmin && user?.isDeveloper);
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

  function formatDateTime(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleString("pt-BR") : "-";
  }

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits ? digits.padStart(5, "0") : "-";
  }

  const FIELD_LABELS = {
    name: "Nome",
    email: "Email",
    cpf: "CPF",
    employmentType: "Categoria",
    role: "Funcao",
    function: "Funcao",
    userType: "Tipo de usuario",
    isObserver: "Observador",
    isAdmin: "Administrador",
    isDeveloper: "Desenvolvedor",
    vacationPeriod: "Periodo de ferias",
    deleted: "Excluido",
    deletedAt: "Data de exclusao",
    deletedBy: "Excluido por",
    deleteReason: "Motivo da exclusao",
    customFields: "Campos personalizados",
    observations: "Observacoes",
    conclusionDate: "Data de conclusao",
    emissionDate: "Data de emissao",
    correctiveActions: "Acoes corretivas",
    correctiveAction: "Acao corretiva",
    conclusion: "Conclusao",
    status: "Status",
    responsibleLeader: "Lider designado",
    responsibleLeaderName: "Nome do lider designado",
    dueDate: "Prazo",
    deadline: "Prazo",
    immediateAction: "Acao imediata",
    description: "Descricao",
    location: "Local",
    sector: "Setor",
    riskClassification: "Classificacao de risco",
    emitterName: "Emitente",
    contractType: "Tipo de contrato",
    unit: "Unidade",
    incidentType: "Tipo",
    detectionOrigin: "Origem da deteccao",
    genesis: "Genese do incidente"
  };

  const STATUS_LABELS = {
    VENCIDO: "Vencido",
    CORRIGIDO: "Corrigido",
    ENCERRADO: "Encerrado",
    "EM ANDAMENTO": "Em andamento",
    EXCLUIDO: "Excluido",
    PENDENTE: "Pendente"
  };

  const ACTION_LABELS = {
    RID_UPDATED: "Atualizacao do RID",
    RID_REMOVAL_REQUESTED: "Solicitacao de remocao",
    RID_DELETED: "Exclusao do RID",
    EMPLOYEE_CREATED: "Criacao de funcionario",
    EMPLOYEE_UPDATED: "Atualizacao de funcionario",
    EMPLOYEE_REMOVAL_REQUESTED: "Solicitacao de exclusao de funcionario",
    EMPLOYEE_DELETED: "Exclusao de funcionario"
  };

  function getChangedByLabel(item) {
    if (item.changedBy && typeof item.changedBy === "object") {
      return item.changedBy.name || item.changedBy.uid || item.changedBy.email || "Desconhecido";
    }
    return formatField(item.changedByName || item.user || item.changedBy, "Desconhecido");
  }

  function getRoleLabel(item) {
    const role = item.changedBy?.role || item.role || "";
    if (!role) return "Sem papel";
    if (role === "DEVELOPER") return "Desenvolvedor";
    if (role === "ADMIN") return "Administrador";
    if (role === "OBSERVER") return "Observador";
    if (role === "USER") return "Usuario";
    return role;
  }

  function getActionLabel(item) {
    return ACTION_LABELS[item.action] || formatField(item.meta?.actionLabel || item.action, "Atualizacao");
  }

  function getRecordTypeLabel(item) {
    return item.recordType === "EMPLOYEE" ? "Funcionario" : "RID";
  }

  function getRecordBadgeLabel(item) {
    if (item.recordType === "EMPLOYEE") {
      const employeeName = item.employeeName || item.after?.name || item.before?.name || item.employeeId || "-";
      return `Funcionario: ${employeeName}`;
    }
    return `RID #${formatRidNumber(item.ridNumber || item.ridId)}`;
  }

  function getRecordDetailLabel(item) {
    if (item.recordType === "EMPLOYEE") {
      const employmentType = item.employmentType || item.after?.employmentType || item.before?.employmentType || "-";
      return `Categoria: ${formatField(employmentType, "-")}`;
    }
    return `Emitente: ${formatField(item.emitterName, "-")}`;
  }

  function getRecordModalTitle(item) {
    if (item.recordType === "EMPLOYEE") {
      return formatField(item.employeeName || item.after?.name || item.before?.name, "Funcionario");
    }
    return `RID #${formatRidNumber(item.ridNumber || item.ridId)}`;
  }

  function prettifyFieldName(field) {
    const raw = String(field || "").trim();
    if (!raw) return "Campo";
    if (FIELD_LABELS[raw]) return FIELD_LABELS[raw];
    const normalized = raw
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .trim()
      .toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function formatAuditValue(value) {
    if (value === null || value === undefined || value === "") return "Vazio";
    const date = toDateSafe(value);
    if (date) return date.toLocaleString("pt-BR");
    if (typeof value === "boolean") return value ? "Sim" : "Nao";
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.length ? value.map((item) => formatAuditValue(item)).join(", ") : "Vazio";
    if (typeof value === "object") {
      if (value.name) return String(value.name);
      if (value.uid) return String(value.uid);
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return "Valor complexo";
      }
    }
    const text = String(value).trim();
    if (!text) return "Vazio";
    const upper = text.toUpperCase();
    if (STATUS_LABELS[upper]) return STATUS_LABELS[upper];
    return text;
  }

  function normalizeHistoryItem(doc, recordType = "RID") {
    const data = doc.data();
    const baseItem = {
      id: doc.id,
      changedBy: data.changedBy || null,
      changes: data.changes || {},
      before: data.before || {},
      after: data.after || {},
      meta: data.meta || {},
      action: data.action || "",
      createdAt: toDateSafe(data.createdAt) || new Date(),
      recordType
    };

    if (recordType === "EMPLOYEE") {
      return {
        ...baseItem,
        employeeId: data.employeeId || "",
        employeeName: data.employeeName || data.after?.name || data.before?.name || "",
        employmentType: data.employmentType || data.after?.employmentType || data.before?.employmentType || "",
        unit: data.unit || data.after?.unit || data.before?.unit || "",
        sector: data.sector || data.after?.sector || data.before?.sector || ""
      };
    }

    return {
      ...baseItem,
      ridId: data.ridId || "",
      ridNumber: data.ridNumber || "",
      emitterName: data.emitterName || "",
      leaderName: data.leaderName || data.before?.responsibleLeaderName || ""
    };
  }

  function getChangeEntries(item) {
    const changes = item.changes || {};
    if (Array.isArray(changes)) {
      return changes.map((change) => ({
        field: change.field || "Campo",
        from: change.from,
        to: change.to
      }));
    }
    return Object.entries(changes).map(([field, value]) => ({
      field,
      from: value?.from,
      to: value?.to
    }));
  }

  function getMetaEntries(item) {
    const meta = item.meta || {};
    const entries = [];
    if (meta.reason) entries.push({ label: "Motivo", value: meta.reason });
    if (meta.requestStatus) entries.push({ label: "Status da solicitacao", value: meta.requestStatus });
    if (meta.sourcePage) entries.push({ label: "Origem", value: meta.sourcePage });
    return entries;
  }

  function mergeHistoryCollections() {
    state.allHistory = [...state.ridHistory, ...state.employeeHistory]
      .sort((left, right) => {
        const leftTime = left.createdAt?.getTime?.() || 0;
        const rightTime = right.createdAt?.getTime?.() || 0;
        return rightTime - leftTime;
      });
    renderList();
  }

  function resetFilters() {
    state.filters = { rid: "", user: "", date: "", search: "" };
    dom.filterRid.value = "";
    dom.filterUser.value = "";
    dom.filterDate.value = "";
    dom.searchInput.value = "";
  }

  function closeFiltersPanel() {
    dom.filtersPanel.classList.remove("visible");
  }

  function updateRoleNavigation() {
    document.querySelectorAll('[data-admin-only-nav="designated"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isAdminProfile());
    });
    document.querySelectorAll('[data-developer-only-nav="control-center"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isDeveloperProfile());
    });
    document.querySelectorAll('[data-privileged-nav="changes"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isDeveloperProfile());
    });
    document.querySelectorAll('[data-developer-only-nav="requests"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isDeveloperProfile());
    });
  }

  function getFilteredHistory() {
    const rid = String(state.filters.rid || "").trim().toLowerCase();
    const user = String(state.filters.user || "").trim().toLowerCase();
    const date = state.filters.date || "";
    const search = String(state.filters.search || "").trim().toLowerCase();

    return state.allHistory.filter((item) => {
      if (rid) {
        const recordText = item.recordType === "EMPLOYEE"
          ? `${item.employeeId} ${item.employeeName}`.toLowerCase()
          : `${item.ridId} ${item.ridNumber}`.toLowerCase();
        if (!recordText.includes(rid)) return false;
      }
      if (user && !getChangedByLabel(item).toLowerCase().includes(user)) return false;
      if (date) {
        const itemDate = item.createdAt ? item.createdAt.toISOString().slice(0, 10) : "";
        if (itemDate !== date) return false;
      }
      if (search) {
        const entries = getChangeEntries(item);
        const metaEntries = getMetaEntries(item);
        const haystack = [
          item.employeeName,
          item.employeeId,
          item.employmentType,
          item.emitterName,
          item.leaderName,
          getRecordTypeLabel(item),
          getRecordBadgeLabel(item),
          getActionLabel(item),
          getChangedByLabel(item),
          ...entries.flatMap((entry) => [entry.field, entry.from, entry.to]),
          ...metaEntries.flatMap((entry) => [entry.label, entry.value])
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function renderStats(items) {
    const uniqueUsers = new Set(items.map((item) => getChangedByLabel(item)));
    const totalFields = items.reduce((sum, item) => sum + getChangeEntries(item).length, 0);
    dom.totalCount.textContent = String(items.length);
    dom.uniqueUsersCount.textContent = String(uniqueUsers.size);
    dom.changedFieldsCount.textContent = String(totalFields);
    dom.latestChangeTime.textContent = items.length ? formatDateTime(items[0].createdAt) : "-";
  }

  function renderList() {
    const items = getFilteredHistory();
    renderStats(items);
    dom.historyCount.textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}`;

    if (!items.length) {
      dom.historyList.innerHTML = `<div class="empty-state">Nenhuma alteracao encontrada com esse recorte.</div>`;
      return;
    }

    dom.historyList.innerHTML = items.map((item) => {
      const fields = getChangeEntries(item);
      return `
        <button type="button" class="history-card w-full text-left" data-history-id="${escapeHtml(item.id)}">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-[10px] font-semibold tracking-wide text-white">${escapeHtml(getRecordBadgeLabel(item))}</span>
                <span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">${escapeHtml(getRecordTypeLabel(item))}</span>
                <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">${escapeHtml(getRoleLabel(item))}</span>
                <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">${escapeHtml(getActionLabel(item))}</span>
              </div>
              <div class="text-sm font-semibold text-gray-900 mt-3">${escapeHtml(getChangedByLabel(item))}</div>
              <div class="text-xs text-gray-400 mt-1">${escapeHtml(formatDateTime(item.createdAt))}</div>
            </div>
            <div class="text-xs text-gray-500 text-right">
              <div>${fields.length} ${fields.length === 1 ? "campo alterado" : "campos alterados"}</div>
              <div class="mt-1">${escapeHtml(getRecordDetailLabel(item))}</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mt-4">
            ${fields.slice(0, 5).map((entry) => `<span class="field-chip">${escapeHtml(prettifyFieldName(entry.field))}</span>`).join("")}
            ${fields.length > 5 ? `<span class="field-chip">+${fields.length - 5} outros</span>` : ""}
          </div>
        </button>
      `;
    }).join("");

    dom.historyList.querySelectorAll("[data-history-id]").forEach((button) => {
      button.addEventListener("click", () => openHistoryModal(button.dataset.historyId));
    });

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function openHistoryModal(historyId) {
    const item = state.allHistory.find((entry) => entry.id === historyId);
    if (!item) return;
    state.selectedHistoryId = historyId;
    const entries = getChangeEntries(item);
    const metaEntries = getMetaEntries(item);

    dom.historyModalTitle.textContent = getRecordModalTitle(item);
    dom.historyModalBody.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Quem alterou</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(getChangedByLabel(item))}</div>
          <div class="text-xs text-gray-400 mt-1">${escapeHtml(getRoleLabel(item))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data da alteracao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDateTime(item.createdAt))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">${escapeHtml(item.recordType === "EMPLOYEE" ? "Registro" : "Emitente do RID")}</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(item.recordType === "EMPLOYEE" ? getRecordBadgeLabel(item) : formatField(item.emitterName, "-"))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Tipo de evento</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(getActionLabel(item))}</div>
        </div>
        ${item.recordType === "RID" ? `
          <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Lider anterior registrado</div>
            <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatField(item.leaderName || item.before?.responsibleLeaderName, "-"))}</div>
          </div>
        ` : `
          <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Categoria registrada</div>
            <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatField(item.employmentType || item.after?.employmentType || item.before?.employmentType, "-"))}</div>
          </div>
        `}
      </div>
      ${metaEntries.length ? `
        <div class="rounded-2xl border border-gray-100 bg-white p-4 mb-5">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-4">Metadados do evento</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${metaEntries.map((entry) => `
              <div class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">${escapeHtml(entry.label)}</div>
                <div class="text-sm text-gray-800 mt-1 break-words whitespace-pre-wrap">${escapeHtml(formatAuditValue(entry.value))}</div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
      <div class="rounded-2xl border border-gray-100 bg-white p-4">
        <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-4">Campos alterados</div>
        <div class="space-y-3">
          ${entries.length ? entries.map((entry) => `
            <div class="change-row">
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Campo</div>
                <div class="text-sm font-semibold text-gray-900 mt-1">${escapeHtml(prettifyFieldName(entry.field))}</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Antes</div>
                <div class="text-sm text-gray-700 mt-1 break-words whitespace-pre-wrap">${escapeHtml(formatAuditValue(entry.from))}</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Depois</div>
                <div class="text-sm text-gray-700 mt-1 break-words whitespace-pre-wrap">${escapeHtml(formatAuditValue(entry.to))}</div>
              </div>
            </div>
          `).join("") : `<div class="empty-state">Nenhum detalhe de campo foi salvo para esta alteracao.</div>`}
        </div>
      </div>
    `;

    dom.historyModal.classList.add("visible");
  }

  function closeHistoryModal() {
    state.selectedHistoryId = null;
    dom.historyModal.classList.remove("visible");
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

    dom.toggleFiltersButton.addEventListener("click", () => {
      dom.filtersPanel.classList.toggle("visible");
    });

    dom.applyFiltersButton.addEventListener("click", () => {
      state.filters = {
        rid: dom.filterRid.value || "",
        user: dom.filterUser.value || "",
        date: dom.filterDate.value || "",
        search: dom.searchInput.value || ""
      };
      closeFiltersPanel();
      renderList();
    });

    dom.clearFiltersButton.addEventListener("click", () => {
      resetFilters();
      closeFiltersPanel();
      renderList();
    });

    dom.historyModalClose.addEventListener("click", closeHistoryModal);
    dom.historyModal.addEventListener("click", (event) => {
      if (event.target === dom.historyModal) closeHistoryModal();
    });

    document.addEventListener("click", (event) => {
      if (!dom.filtersPanel.classList.contains("visible")) return;
      if (dom.filtersPanel.contains(event.target) || dom.toggleFiltersButton.contains(event.target)) return;
      closeFiltersPanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFiltersPanel();
        closeHistoryModal();
      }
    });
  }

  function subscribeHistory() {
    if (state.unsubRidHistory) state.unsubRidHistory();
    if (state.unsubEmployeeHistory) state.unsubEmployeeHistory();

    state.unsubRidHistory = db.collection("ridHistory").orderBy("createdAt", "desc").limit(500).onSnapshot((snapshot) => {
      state.ridHistory = snapshot.docs.map((doc) => normalizeHistoryItem(doc, "RID"));
      mergeHistoryCollections();
    }, () => {
      dom.historyList.innerHTML = `<div class="empty-state">Nao foi possivel carregar o historico de alteracoes.</div>`;
    });

    state.unsubEmployeeHistory = db.collection("employeeHistory").orderBy("createdAt", "desc").limit(500).onSnapshot((snapshot) => {
      state.employeeHistory = snapshot.docs.map((doc) => normalizeHistoryItem(doc, "EMPLOYEE"));
      mergeHistoryCollections();
    }, () => {
      dom.historyList.innerHTML = `<div class="empty-state">Nao foi possivel carregar o historico de alteracoes.</div>`;
    });
  }

  function cleanupSubscriptions() {
    if (state.unsubRidHistory) {
      state.unsubRidHistory();
      state.unsubRidHistory = null;
    }
    if (state.unsubEmployeeHistory) {
      state.unsubEmployeeHistory();
      state.unsubEmployeeHistory = null;
    }
  }

  async function handleAuthenticatedUser(user) {
    state.currentUser = user;
    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;

    if (!isDeveloperProfile()) {
      sessionStorage.setItem("ridLoginFeedback", "Esta area e exclusiva para desenvolvedores.");
      await auth.signOut();
      return;
    }

    updateRoleNavigation();
    dom.authOverlay.classList.remove("visible");
    dom.pageShell.classList.remove("hidden-state");
    dom.bootOverlay.classList.add("hidden-state");
    dom.welcomeText.textContent = `Bem-vindo, ${formatField(state.currentUserData?.name, "Usuario")}. Aqui voce acompanha tudo o que foi alterado em RIDs e funcionarios.`;
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
    subscribeHistory();
    renderList();
  }

  function init() {
    resetFilters();
    bindListeners();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    auth.onAuthStateChanged(async (user) => {
      cleanupSubscriptions();
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
