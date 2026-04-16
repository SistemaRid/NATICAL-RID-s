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
    filters: {},
    selectedHistoryId: null,
    unsubHistory: null
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
    if (role === "USER") return "Usuario";
    return role;
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

  function normalizeHistoryItem(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      ridId: data.ridId || "",
      ridNumber: data.ridNumber || "",
      emitterName: data.emitterName || "",
      leaderName: data.leaderName || data.before?.responsibleLeaderName || "",
      changedBy: data.changedBy || null,
      changes: data.changes || {},
      before: data.before || {},
      meta: data.meta || {},
      createdAt: toDateSafe(data.createdAt) || new Date()
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
        const ridText = `${item.ridId} ${item.ridNumber}`.toLowerCase();
        if (!ridText.includes(rid)) return false;
      }
      if (user && !getChangedByLabel(item).toLowerCase().includes(user)) return false;
      if (date) {
        const itemDate = item.createdAt ? item.createdAt.toISOString().slice(0, 10) : "";
        if (itemDate !== date) return false;
      }
      if (search) {
        const entries = getChangeEntries(item);
        const haystack = [
          item.emitterName,
          item.leaderName,
          getChangedByLabel(item),
          ...entries.flatMap((entry) => [entry.field, entry.from, entry.to])
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
                <span class="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">RID #${escapeHtml(formatRidNumber(item.ridNumber || item.ridId))}</span>
                <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">${escapeHtml(getRoleLabel(item))}</span>
              </div>
              <div class="text-sm font-semibold text-gray-900 mt-3">${escapeHtml(getChangedByLabel(item))}</div>
              <div class="text-xs text-gray-400 mt-1">${escapeHtml(formatDateTime(item.createdAt))}</div>
            </div>
            <div class="text-xs text-gray-500 text-right">
              <div>${fields.length} ${fields.length === 1 ? "campo alterado" : "campos alterados"}</div>
              <div class="mt-1">Emitente: ${escapeHtml(formatField(item.emitterName, "-"))}</div>
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

    dom.historyModalTitle.textContent = `RID #${formatRidNumber(item.ridNumber || item.ridId)}`;
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
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Emitente do RID</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatField(item.emitterName, "-"))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Lider anterior registrado</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatField(item.leaderName || item.before?.responsibleLeaderName, "-"))}</div>
        </div>
      </div>
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
    if (state.unsubHistory) state.unsubHistory();
    state.unsubHistory = db.collection("ridHistory").orderBy("createdAt", "desc").limit(500).onSnapshot((snapshot) => {
      state.allHistory = snapshot.docs.map(normalizeHistoryItem);
      renderList();
    }, () => {
      dom.historyList.innerHTML = `<div class="empty-state">Nao foi possivel carregar o historico de alteracoes.</div>`;
    });
  }

  function cleanupSubscriptions() {
    if (state.unsubHistory) {
      state.unsubHistory();
      state.unsubHistory = null;
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
    dom.welcomeText.textContent = `Bem-vindo, ${formatField(state.currentUserData?.name, "Usuario")}. Aqui voce acompanha tudo o que foi alterado nos RIDs.`;
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
