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
    allUsers: [],
    allRids: [],
    filters: {},
    draftFilters: {},
    unsubRids: null,
    selectedRidId: null
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
    filterStatus: document.getElementById("filterStatus"),
    filterRisk: document.getElementById("filterRisk"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    totalCount: document.getElementById("totalCount"),
    pendingCount: document.getElementById("pendingCount"),
    overdueCount: document.getElementById("overdueCount"),
    correctedMonthCount: document.getElementById("correctedMonthCount"),
    correctedTotalCount: document.getElementById("correctedTotalCount"),
    designatedCount: document.getElementById("designatedCount"),
    designatedList: document.getElementById("designatedList"),
    designatedModal: document.getElementById("designatedModal"),
    designatedModalTitle: document.getElementById("designatedModalTitle"),
    designatedModalBody: document.getElementById("designatedModalBody"),
    designatedModalClose: document.getElementById("designatedModalClose"),
    designatedModalFeedback: document.getElementById("designatedModalFeedback"),
    designatedModalSave: document.getElementById("designatedModalSave")
  };

  function isAdminProfile(user = state.currentUserData) {
    return !!user?.isAdmin;
  }

  function isDeveloperProfile(user = state.currentUserData) {
    return !!(user?.isAdmin && user?.isDeveloper);
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

  function normalizeStatus(status) {
    return String(status || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function toDateSafe(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleDateString("pt-BR") : "Sem data";
  }

  function formatDateTime(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleString("pt-BR") : "Sem data";
  }

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "-";
    return digits.padStart(5, "0");
  }

  function formatField(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function getLeaderOptions() {
    return state.allUsers
      .filter((user) => user && (user.isAdmin || user.isDeveloper))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }

  function toDateInputValue(value) {
    const date = toDateSafe(value);
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getStatusTone(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "CORRIGIDO") return "bg-green-50 text-green-700 border-green-100";
    if (normalized === "VENCIDO") return "bg-red-50 text-red-700 border-red-100";
    if (normalized === "ENCERRADO") return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  function resetFilters() {
    state.draftFilters = { status: "", risk: "", search: "" };
    state.filters = { ...state.draftFilters };
    dom.filterStatus.value = "";
    dom.filterRisk.value = "";
    dom.searchInput.value = "";
  }

  function getDesignatedRids() {
    const search = String(state.filters.search || "").trim().toLowerCase();

    return state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => rid.responsibleLeader === state.currentUser?.uid)
      .filter((rid) => normalizeStatus(rid.status) === "VENCIDO")
      .filter((rid) => {
        if (state.filters.status && normalizeStatus(rid.status) !== normalizeStatus(state.filters.status)) return false;
        if (state.filters.risk && normalizeStatus(rid.riskClassification) !== normalizeStatus(state.filters.risk)) return false;
        if (!search) return true;
        const haystack = [
          rid.ridNumber,
          rid.location,
          rid.description,
          rid.sector,
          rid.emitterName,
          rid.status,
          rid.riskClassification
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0) - (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0));
  }

  function renderStats(rids) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    dom.totalCount.textContent = String(rids.length);
    dom.pendingCount.textContent = String(rids.filter((rid) => {
      const status = normalizeStatus(rid.status);
      return status !== "CORRIGIDO" && status !== "ENCERRADO";
    }).length);
    dom.overdueCount.textContent = String(rids.length);
    const correctedAll = rids.filter((rid) => {
      const status = normalizeStatus(rid.status);
      return status === "CORRIGIDO" || status === "ENCERRADO";
    });
    dom.correctedTotalCount.textContent = String(correctedAll.length);
    dom.correctedMonthCount.textContent = String(correctedAll.filter((rid) => {
      const date = toDateSafe(rid.conclusionDate || rid.updatedAt || rid.createdAt);
      return date && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length);
  }

  function renderList() {
    const rids = getDesignatedRids();
    renderStats(rids);
    dom.designatedCount.textContent = `${rids.length} registro${rids.length === 1 ? "" : "s"}`;

    if (!rids.length) {
      dom.designatedList.innerHTML = `<div class="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">Voce nao possui RIDs designados no momento.</div>`;
      return;
    }

    dom.designatedList.innerHTML = rids.map((rid) => `
      <article class="designated-row rounded-2xl border border-gray-100 bg-white px-5 py-4" data-designated-rid="${escapeHtml(rid.id)}">
        <div class="grid grid-cols-1 md:grid-cols-[140px_160px_150px_minmax(0,1fr)_160px_150px] gap-4 items-center">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">RID</div>
            <div class="text-sm font-bold text-gray-900">#${escapeHtml(formatRidNumber(rid.ridNumber))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Data de emissao</div>
            <div class="text-sm text-gray-700">${escapeHtml(formatDate(rid.emissionDate || rid.createdAt))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Setor</div>
            <div class="text-sm text-gray-700">${escapeHtml(formatField(rid.sector))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Local</div>
            <div class="text-sm text-gray-700">${escapeHtml(formatField(rid.location))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Status</div>
            <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(rid.status)}">${escapeHtml(formatField(rid.status, "EM ANDAMENTO"))}</span>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Emitente</div>
            <div class="text-sm text-gray-700">${escapeHtml(formatField(rid.emitterName))}</div>
          </div>
        </div>
      </article>
    `).join("");
  }

  function openModal(ridId) {
    const rid = state.allRids.find((item) => item.id === ridId);
    if (!rid) return;
    state.selectedRidId = ridId;
    const status = getStatusTone(rid.status);
    const leaders = getLeaderOptions();
    dom.designatedModalTitle.textContent = `RID #${formatRidNumber(rid.ridNumber)}`;
    dom.designatedModalFeedback.classList.add("hidden-state");
    dom.designatedModalFeedback.textContent = "";
    dom.designatedModalBody.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap mb-5">
        <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status}">${escapeHtml(formatField(rid.status, "EM ANDAMENTO"))}</span>
        <span class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">${escapeHtml(rid.sector || "Sem setor")}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Emitente</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.emitterName || "Sem emissor")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">CPF do emissor</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.emitterCpf || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Tipo de contrato</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.contractType || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Unidade</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.unit || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Setor</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.sector || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data de emissao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(rid.emissionDate || rid.createdAt))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Responsavel designado</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.responsibleLeaderName || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Tipo</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.incidentType || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Origem da deteccao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.detectionOrigin || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Local</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.location || "Nao informado")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Classificacao de risco</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(rid.riskClassification || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Descricao</div>
          <div class="text-sm text-gray-700 mt-2 leading-6">${escapeHtml(rid.description || "Sem descricao")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Acao imediata</div>
          <div class="text-sm text-gray-700 mt-2 leading-6">${escapeHtml(rid.immediateAction || "-")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Conclusao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(rid.conclusionDate))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Lider designado</label>
          <select id="designatedLeaderSelect" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white">
            <option value="">Sem lider designado</option>
            ${leaders.map((leader) => `
              <option value="${escapeHtml(leader.id)}" ${leader.id === rid.responsibleLeader ? "selected" : ""}>${escapeHtml(leader.name || "Sem nome")}</option>
            `).join("")}
          </select>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Status</label>
          <select id="designatedStatusSelect" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white">
            ${["EM ANDAMENTO", "VENCIDO", "CORRIGIDO", "ENCERRADO"].map((option) => `
              <option value="${option}" ${normalizeStatus(rid.status) === option ? "selected" : ""}>${option}</option>
            `).join("")}
          </select>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Prazo (Opcional)</label>
          <input id="designatedDeadlineInput" type="date" value="${escapeHtml(toDateInputValue(rid.deadline))}" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:border-gray-400">
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Observacoes</label>
          <textarea readonly rows="4" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 text-gray-600 resize-none">${escapeHtml(rid.observations || "")}</textarea>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4 md:col-span-2">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Acoes corretivas</label>
          <textarea id="designatedCorrectiveActionsInput" rows="4" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 resize-none focus:outline-none focus:border-gray-400">${escapeHtml(rid.correctiveActions || "")}</textarea>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Conclusao</label>
          <textarea readonly rows="4" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 text-gray-600 resize-none">${escapeHtml(rid.conclusion || "")}</textarea>
        </div>
      </div>
    `;
    dom.designatedModal.classList.add("visible");
  }

  function closeModal() {
    dom.designatedModal.classList.remove("visible");
    state.selectedRidId = null;
  }

  async function saveModal() {
    const rid = state.allRids.find((item) => item.id === state.selectedRidId);
    if (!rid) return;

    const leaderSelect = document.getElementById("designatedLeaderSelect");
    const statusSelect = document.getElementById("designatedStatusSelect");
    const deadlineInput = document.getElementById("designatedDeadlineInput");
    const correctiveActionsInput = document.getElementById("designatedCorrectiveActionsInput");
    const leaderId = leaderSelect?.value || "";
    const leaderData = getLeaderOptions().find((leader) => leader.id === leaderId) || null;
    const nextStatus = statusSelect?.value || rid.status || "EM ANDAMENTO";
    const deadlineValue = String(deadlineInput?.value || "").trim();
    const correctiveActionsValue = String(correctiveActionsInput?.value || "").trim();

    if (normalizeStatus(nextStatus) === "CORRIGIDO" && !correctiveActionsValue) {
      dom.designatedModalFeedback.textContent = 'Para status "Corrigido", e obrigatorio preencher Acoes corretivas.';
      dom.designatedModalFeedback.classList.remove("hidden-state");
      return;
    }

    const updates = {
      responsibleLeader: leaderId || null,
      responsibleLeaderName: leaderData?.name || null,
      status: nextStatus,
      correctiveActions: correctiveActionsValue || null,
      deadline: deadlineValue
        ? firebase.firestore.Timestamp.fromDate(new Date(`${deadlineValue}T12:00:00`))
        : null
    };

    if (normalizeStatus(nextStatus) === "CORRIGIDO" && !rid.conclusionDate) {
      updates.conclusionDate = firebase.firestore.FieldValue.serverTimestamp();
    }

    dom.designatedModalFeedback.classList.add("hidden-state");
    dom.designatedModalSave.disabled = true;
    dom.designatedModalSave.textContent = "Salvando...";

    try {
      await db.collection("rids").doc(rid.id).update(updates);
      closeModal();
    } catch (error) {
      dom.designatedModalFeedback.textContent = "Nao foi possivel salvar as alteracoes do RID.";
      dom.designatedModalFeedback.classList.remove("hidden-state");
    } finally {
      dom.designatedModalSave.disabled = false;
      dom.designatedModalSave.textContent = "Salvar alteracoes";
    }
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
    updateRoleNavigation();
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "gestor"}. Aqui voce acompanha os RIDs designados ao seu perfil.`;
    renderList();
    lucide.createIcons();
  }

  async function loadUsers() {
    const snapshot = await db.collection("users").get();
    state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  function listenRids() {
    if (typeof state.unsubRids === "function") state.unsubRids();
    state.unsubRids = db.collection("rids").onSnapshot((snapshot) => {
      state.allRids = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (isAdminProfile()) renderList();
    });
  }

  function bindEvents() {
    dom.loginCpf.addEventListener("input", () => {
      dom.loginCpf.value = maskCpf(dom.loginCpf.value);
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

    dom.applyFiltersButton.addEventListener("click", () => {
      state.draftFilters = {
        status: dom.filterStatus.value || "",
        risk: dom.filterRisk.value || "",
        search: dom.searchInput.value || ""
      };
      state.filters = { ...state.draftFilters };
      renderList();
      dom.filtersPanel.classList.remove("visible");
    });

    dom.clearFiltersButton.addEventListener("click", () => {
      resetFilters();
      renderList();
      dom.filtersPanel.classList.remove("visible");
    });

    dom.designatedModalClose.addEventListener("click", closeModal);
    dom.designatedModalSave.addEventListener("click", () => {
      void saveModal();
    });
    dom.designatedModal.addEventListener("click", (event) => {
      if (event.target === dom.designatedModal) closeModal();
    });

    document.addEventListener("click", (event) => {
      const card = event.target.closest("[data-designated-rid]");
      if (card) {
        openModal(card.getAttribute("data-designated-rid"));
        return;
      }

      if (!event.target.closest(".filter-popover")) {
        dom.filtersPanel.classList.remove("visible");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
        dom.filtersPanel.classList.remove("visible");
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allRids = [];
      if (typeof state.unsubRids === "function") state.unsubRids();
      state.unsubRids = null;
      closeModal();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!isAdminProfile()) {
      sessionStorage.setItem("ridLoginFeedback", "Somente administradores ou desenvolvedores podem acessar esta tela.");
      await auth.signOut();
      return;
    }

    await loadUsers();
    resetFilters();
    listenRids();
    showPage();
  });

  bindEvents();
  lucide.createIcons();
})();
