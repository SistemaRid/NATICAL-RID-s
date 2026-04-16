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
    allRids: [],
    allUsers: [],
    filters: {},
    draftFilters: {},
    unsubRids: null,
    unsubUsers: null
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
    filterMonth: document.getElementById("filterMonth"),
    filterYear: document.getElementById("filterYear"),
    filterSector: document.getElementById("filterSector"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    riskCount: document.getElementById("riskCount"),
    criticalCount: document.getElementById("criticalCount"),
    overdueCount: document.getElementById("overdueCount"),
    deletedCount: document.getElementById("deletedCount"),
    unassignedCount: document.getElementById("unassignedCount"),
    leadersList: document.getElementById("leadersList"),
    sectorRanking: document.getElementById("sectorRanking"),
    recurrenceList: document.getElementById("recurrenceList"),
    deletedListCount: document.getElementById("deletedListCount"),
    deletedList: document.getElementById("deletedList"),
    managementLoginList: document.getElementById("managementLoginList")
  };

  function isAdminProfile(user = state.currentUserData) {
    const userType = String(user?.userType || "").trim().toLowerCase();
    return !!(
      user?.isAdmin ||
      userType === "administrador" ||
      userType === "desenvolvedor"
    );
  }

  function isDeveloperProfile(user = state.currentUserData) {
    const userType = String(user?.userType || "").trim().toLowerCase();
    return !!(
      (user?.isAdmin && user?.isDeveloper) ||
      userType === "desenvolvedor"
    );
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
    if (typeof value === "string") {
      const trimmed = value.trim();
      const brDate = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brDate) return new Date(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]), 12, 0, 0);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleDateString("pt-BR") : "-";
  }

  function formatDateTime(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleString("pt-BR") : "-";
  }

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits ? digits.padStart(5, "0") : "-";
  }

  function normalizeStatus(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function normalizeRisk(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function getCurrentPeriodDefaults() {
    const now = new Date();
    return { month: String(now.getMonth() + 1), year: String(now.getFullYear()), sector: "", search: "" };
  }

  function resetFilters() {
    state.draftFilters = { ...getCurrentPeriodDefaults() };
    state.filters = { ...state.draftFilters };
    dom.filterMonth.value = state.draftFilters.month;
    dom.filterYear.value = state.draftFilters.year;
    dom.filterSector.value = state.draftFilters.sector;
    dom.searchInput.value = state.draftFilters.search;
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

  function fillSectorOptions() {
    const sectors = new Set();
    state.allRids.forEach((rid) => {
      const sector = formatField(rid.sector, "");
      if (sector) sectors.add(sector);
    });
    state.allUsers.forEach((user) => {
      const sector = formatField(user.sector, "");
      if (sector) sectors.add(sector);
    });

    const previous = dom.filterSector.value || state.draftFilters.sector || "";
    dom.filterSector.innerHTML = `<option value="">Todos os setores</option>${Array.from(sectors).sort((a, b) => a.localeCompare(b, "pt-BR")).map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`).join("")}`;
    dom.filterSector.value = previous;
  }

  function getRidEmissionDate(rid) {
    return toDateSafe(rid.emissionDate) || toDateSafe(rid.createdAt) || null;
  }

  function isDeletedRid(rid) {
    return rid.deleted === true || normalizeStatus(rid.status) === "EXCLUIDO";
  }

  function getFilteredRids() {
    const monthRaw = state.filters.month || getCurrentPeriodDefaults().month;
    const year = Number(state.filters.year || getCurrentPeriodDefaults().year);
    const sector = state.filters.sector || "";
    const search = String(state.filters.search || "").trim().toLowerCase();
    const showAllMonths = monthRaw === "all";

    return state.allRids.filter((rid) => {
      const emissionDate = getRidEmissionDate(rid);
      if (!emissionDate) return false;
      if (emissionDate.getFullYear() !== year) return false;
      if (!showAllMonths && emissionDate.getMonth() + 1 !== Number(monthRaw)) return false;
      if (sector && formatField(rid.sector, "") !== sector) return false;
      if (!search) return true;

      const haystack = [
        rid.ridNumber,
        rid.description,
        rid.location,
        rid.sector,
        rid.emitterName,
        rid.responsibleLeaderName,
        rid.responsibleLeader,
        rid.deleteReason
      ].join(" ").toLowerCase();

      return haystack.includes(search);
    });
  }

  function getRiskyRids(rids) {
    return rids.filter((rid) => ["MEDIO", "ALTO", "CRITICO"].includes(normalizeRisk(rid.riskClassification)));
  }

  function getLeaderLabel(rid) {
    const byName = formatField(rid.responsibleLeaderName, "");
    if (byName) return byName;
    const id = formatField(rid.responsibleLeader, "");
    if (!id) return "";
    const user = state.allUsers.find((item) => item.id === id);
    return user?.name || id;
  }

  function renderStats(filteredRids) {
    const risky = getRiskyRids(filteredRids);
    const critical = risky.filter((rid) => normalizeRisk(rid.riskClassification) === "CRITICO");
    const overdue = filteredRids.filter((rid) => normalizeStatus(rid.status) === "VENCIDO");
    const deleted = filteredRids.filter((rid) => isDeletedRid(rid));
    const unassigned = filteredRids.filter((rid) => !isDeletedRid(rid) && !["CORRIGIDO", "ENCERRADO"].includes(normalizeStatus(rid.status)) && !getLeaderLabel(rid));

    dom.riskCount.textContent = String(risky.length);
    dom.criticalCount.textContent = String(critical.length);
    dom.overdueCount.textContent = String(overdue.length);
    dom.deletedCount.textContent = String(deleted.length);
    dom.unassignedCount.textContent = String(unassigned.length);
  }

  function renderLeaders(filteredRids) {
    const leaders = state.allUsers
      .filter((user) => user?.isAdmin || user?.isDeveloper)
      .map((leader) => {
        const assigned = filteredRids.filter((rid) => formatField(rid.responsibleLeader, "") === leader.id || formatField(rid.responsibleLeaderName, "") === leader.name);
        const corrected = assigned.filter((rid) => ["CORRIGIDO", "ENCERRADO"].includes(normalizeStatus(rid.status))).length;
        const overdue = assigned.filter((rid) => normalizeStatus(rid.status) === "VENCIDO").length;
        const risky = assigned.filter((rid) => ["MEDIO", "ALTO", "CRITICO"].includes(normalizeRisk(rid.riskClassification))).length;
        const rate = assigned.length ? Math.round((corrected / assigned.length) * 100) : 0;
        return { id: leader.id, name: leader.name || "Sem nome", assigned: assigned.length, corrected, overdue, risky, rate };
      })
      .filter((leader) => leader.assigned > 0)
      .sort((a, b) => (b.corrected - a.corrected) || (b.assigned - a.assigned) || a.name.localeCompare(b.name, "pt-BR"));

    if (!leaders.length) {
      dom.leadersList.innerHTML = `<div class="empty-state">Nenhum lider com RIDs em carteira neste recorte.</div>`;
      return;
    }

    dom.leadersList.innerHTML = leaders.map((leader) => `
      <div class="leader-card">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-sm font-semibold text-gray-900">${escapeHtml(leader.name)}</div>
            <div class="text-xs text-gray-400 mt-1">${leader.assigned} RIDs vinculados</div>
          </div>
          <span class="leader-pill ${leader.rate >= 70 ? "bg-emerald-50 text-emerald-700" : leader.rate >= 40 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}">${leader.rate}% resolvido</span>
        </div>
        <div class="grid grid-cols-3 gap-3 mt-4">
          <div class="rounded-2xl border border-gray-100 bg-white px-3 py-3">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Corrigidos</div>
            <div class="text-lg font-bold text-emerald-700 mt-1">${leader.corrected}</div>
          </div>
          <div class="rounded-2xl border border-gray-100 bg-white px-3 py-3">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Vencidos</div>
            <div class="text-lg font-bold text-rose-700 mt-1">${leader.overdue}</div>
          </div>
          <div class="rounded-2xl border border-gray-100 bg-white px-3 py-3">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Riscos medio+</div>
            <div class="text-lg font-bold text-amber-700 mt-1">${leader.risky}</div>
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderSectorRanking(filteredRids) {
    const riskBySector = new Map();
    getRiskyRids(filteredRids).forEach((rid) => {
      const sector = formatField(rid.sector, "Sem setor");
      riskBySector.set(sector, (riskBySector.get(sector) || 0) + 1);
    });

    const rows = Array.from(riskBySector.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(1, ...rows.map(([, total]) => total));

    if (!rows.length) {
      dom.sectorRanking.innerHTML = `<div class="empty-state">Nenhum setor com riscos medio, alto ou critico neste recorte.</div>`;
      return;
    }

    dom.sectorRanking.innerHTML = rows.map(([sector, total], index) => `
      <div>
        <div class="flex items-center justify-between gap-4 mb-2">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-semibold inline-flex items-center justify-center flex-shrink-0">${index + 1}</span>
            <span class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(sector)}</span>
          </div>
          <span class="text-sm font-semibold text-gray-500">${total}</span>
        </div>
        <div class="rank-bar"><div class="rank-fill" style="width:${Math.max(12, Math.round((total / max) * 100))}%"></div></div>
      </div>
    `).join("");
  }

  function renderRecurrence(filteredRids) {
    const recurrence = new Map();

    getRiskyRids(filteredRids).forEach((rid) => {
      const sector = formatField(rid.sector, "Sem setor");
      const entry = recurrence.get(sector) || { total: 0, critical: 0, overdue: 0 };
      entry.total += 1;
      if (normalizeRisk(rid.riskClassification) === "CRITICO") entry.critical += 1;
      if (normalizeStatus(rid.status) === "VENCIDO") entry.overdue += 1;
      recurrence.set(sector, entry);
    });

    const rows = Array.from(recurrence.entries())
      .filter(([, entry]) => entry.total >= 2)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8);

    if (!rows.length) {
      dom.recurrenceList.innerHTML = `<div class="empty-state">Nenhuma reincidencia relevante encontrada neste periodo.</div>`;
      return;
    }

    dom.recurrenceList.innerHTML = rows.map(([sector, entry]) => `
      <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-semibold text-gray-900">${escapeHtml(sector)}</div>
            <div class="text-xs text-gray-400 mt-1">${entry.total} ocorrencias medio+ no periodo</div>
          </div>
          <span class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600">${entry.total}x</span>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <div class="rounded-2xl bg-red-50 px-3 py-3">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-red-400">Criticos</div>
            <div class="text-lg font-bold text-red-700 mt-1">${entry.critical}</div>
          </div>
          <div class="rounded-2xl bg-amber-50 px-3 py-3">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-amber-500">Vencidos</div>
            <div class="text-lg font-bold text-amber-700 mt-1">${entry.overdue}</div>
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderDeletedList(filteredRids) {
    const deletedRows = filteredRids
      .filter((rid) => isDeletedRid(rid))
      .sort((a, b) => (toDateSafe(b.deletedAt || b.updatedAt || b.createdAt)?.getTime() || 0) - (toDateSafe(a.deletedAt || a.updatedAt || a.createdAt)?.getTime() || 0));

    dom.deletedListCount.textContent = `${deletedRows.length} ${deletedRows.length === 1 ? "item" : "itens"}`;

    if (!deletedRows.length) {
      dom.deletedList.innerHTML = `<div class="empty-state">Nenhum RID removido no recorte selecionado.</div>`;
      return;
    }

    dom.deletedList.innerHTML = deletedRows.map((rid) => `
      <div class="deleted-item">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">RID #${escapeHtml(formatRidNumber(rid.ridNumber))}</span>
            <span class="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700">Removido</span>
          </div>
          <div class="text-xs text-gray-500">${escapeHtml(formatDate(rid.deletedAt || rid.updatedAt || rid.createdAt))}</div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Descricao</div>
            <div class="text-sm text-gray-800 mt-1">${escapeHtml(formatField(rid.description, "Sem descricao"))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Motivo</div>
            <div class="text-sm text-gray-800 mt-1">${escapeHtml(formatField(rid.deleteReason, "Motivo nao informado"))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Setor</div>
            <div class="text-sm text-gray-800 mt-1">${escapeHtml(formatField(rid.sector, "Sem setor"))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Solicitado/removido por</div>
            <div class="text-sm text-gray-800 mt-1">${escapeHtml(formatField(rid.deleteRequestedByName || rid.deletedBy?.name || rid.deletedByName, "-"))}</div>
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderManagementLogins() {
    const privilegedUsers = state.allUsers
      .filter((user) => user?.isAdmin || user?.isDeveloper)
      .map((user) => {
        const roleLabel = user?.isDeveloper ? "Desenvolvedor" : "Administrador";
        const lastLogin = toDateSafe(user?.lastManagementLoginAt);
        return {
          id: user.id,
          name: formatField(user.name, "Sem nome"),
          roleLabel,
          sector: formatField(user.sector, "Sem setor"),
          lastLogin,
          lastLoginLabel: formatDateTime(user?.lastManagementLoginAt),
          lastPage: formatField(user?.lastManagementLoginPage, "-")
        };
      })
      .sort((a, b) => (b.lastLogin?.getTime() || 0) - (a.lastLogin?.getTime() || 0) || a.name.localeCompare(b.name, "pt-BR"));

    if (!privilegedUsers.length) {
      dom.managementLoginList.innerHTML = `<div class="empty-state">Nenhum administrador ou desenvolvedor cadastrado.</div>`;
      return;
    }

    dom.managementLoginList.innerHTML = privilegedUsers.map((user) => `
      <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div class="text-sm font-semibold text-gray-900">${escapeHtml(user.name)}</div>
            <div class="text-xs text-gray-400 mt-1">${escapeHtml(user.roleLabel)} · ${escapeHtml(user.sector)}</div>
          </div>
          <span class="inline-flex items-center rounded-full ${user.lastLogin ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"} px-3 py-1 text-[11px] font-semibold">
            ${user.lastLogin ? "Login registrado" : "Sem registro"}
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div class="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Ultimo login</div>
            <div class="text-sm font-semibold text-gray-900 mt-1">${escapeHtml(user.lastLoginLabel)}</div>
          </div>
          <div class="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Tela registrada</div>
            <div class="text-sm font-semibold text-gray-900 mt-1">${escapeHtml(user.lastPage)}</div>
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderPage() {
    updateRoleNavigation();
    const filteredRids = getFilteredRids();
    renderStats(filteredRids);
    renderLeaders(filteredRids);
    renderSectorRanking(filteredRids);
    renderRecurrence(filteredRids);
    renderDeletedList(filteredRids);
    renderManagementLogins();
    dom.welcomeText.textContent = `Bem-vindo, ${formatField(state.currentUserData?.name, "Desenvolvedor")}. Aqui voce acompanha riscos, liderancas e remocoes do periodo.`;
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
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

    dom.toggleFiltersButton.addEventListener("click", () => {
      dom.filtersPanel.classList.toggle("visible");
    });

    dom.applyFiltersButton.addEventListener("click", () => {
      state.filters = {
        month: dom.filterMonth.value || getCurrentPeriodDefaults().month,
        year: dom.filterYear.value || getCurrentPeriodDefaults().year,
        sector: dom.filterSector.value || "",
        search: dom.searchInput.value || ""
      };
      closeFiltersPanel();
      renderPage();
    });

    dom.clearFiltersButton.addEventListener("click", () => {
      resetFilters();
      closeFiltersPanel();
      renderPage();
    });

    document.addEventListener("click", (event) => {
      if (!dom.filtersPanel.classList.contains("visible")) return;
      if (dom.filtersPanel.contains(event.target) || dom.toggleFiltersButton.contains(event.target)) return;
      closeFiltersPanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeFiltersPanel();
    });
  }

  function subscribeUsers() {
    if (state.unsubUsers) state.unsubUsers();
    state.unsubUsers = db.collection("users").onSnapshot((snapshot) => {
      state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      fillSectorOptions();
      renderPage();
    });
  }

  function subscribeRids() {
    if (state.unsubRids) state.unsubRids();
    state.unsubRids = db.collection("rids").onSnapshot((snapshot) => {
      state.allRids = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      fillSectorOptions();
      renderPage();
    });
  }

  function cleanupSubscriptions() {
    if (state.unsubUsers) {
      state.unsubUsers();
      state.unsubUsers = null;
    }
    if (state.unsubRids) {
      state.unsubRids();
      state.unsubRids = null;
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
    subscribeUsers();
    subscribeRids();
    renderPage();
  }

  function init() {
    resetFilters();
    bindListeners();

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
