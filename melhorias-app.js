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
    allMaintenances: [],
    allUsers: [],
    draftFilters: {},
    filters: {},
    showResolved: false,
    selectedMaintenanceId: null,
    unsubMaintenances: null,
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
    filterStatus: document.getElementById("filterStatus"),
    filterResponsible: document.getElementById("filterResponsible"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    openCreateModalButton: document.getElementById("openCreateModalButton"),
    totalCount: document.getElementById("totalCount"),
    openCount: document.getElementById("openCount"),
    progressCount: document.getElementById("progressCount"),
    doneCount: document.getElementById("doneCount"),
    listCount: document.getElementById("listCount"),
    toggleResolvedButton: document.getElementById("toggleResolvedButton"),
    pendingList: document.getElementById("pendingList"),
    resolvedBlock: document.getElementById("resolvedBlock"),
    resolvedList: document.getElementById("resolvedList"),
    createModal: document.getElementById("createModal"),
    createModalClose: document.getElementById("createModalClose"),
    createForm: document.getElementById("createForm"),
    maintenanceEquipment: document.getElementById("maintenanceEquipment"),
    maintenanceSector: document.getElementById("maintenanceSector"),
    maintenanceLocation: document.getElementById("maintenanceLocation"),
    maintenancePriority: document.getElementById("maintenancePriority"),
    maintenanceAssignedTo: document.getElementById("maintenanceAssignedTo"),
    maintenanceDescription: document.getElementById("maintenanceDescription"),
    createFeedback: document.getElementById("createFeedback"),
    createSubmitButton: document.getElementById("createSubmitButton"),
    createCancelButton: document.getElementById("createCancelButton"),
    detailsModal: document.getElementById("detailsModal"),
    detailsModalClose: document.getElementById("detailsModalClose"),
    detailsTitle: document.getElementById("detailsTitle"),
    detailsContent: document.getElementById("detailsContent"),
    detailsForm: document.getElementById("detailsForm"),
    detailsResolution: document.getElementById("detailsResolution"),
    detailsStatus: document.getElementById("detailsStatus"),
    detailsAssignedTo: document.getElementById("detailsAssignedTo"),
    detailsFeedback: document.getElementById("detailsFeedback"),
    detailsCancelButton: document.getElementById("detailsCancelButton"),
    detailsSaveButton: document.getElementById("detailsSaveButton")
  };

  function isAdminProfile(user = state.currentUserData) {
    return !!user?.isAdmin;
  }

  function isDeveloperProfile(user = state.currentUserData) {
    return !!(user?.isAdmin && user?.isDeveloper);
  }

  function updateAdminNavigation() {
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

  function normalizeStatus(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/_/g, " ")
      .trim()
      .toUpperCase();
  }

  function isDoneStatus(value) {
    return normalizeStatus(value) === "CONCLUIDA";
  }

  function isProgressStatus(value) {
    return normalizeStatus(value) === "EM ANDAMENTO";
  }

  function isOpenStatus(value) {
    return normalizeStatus(value) === "ABERTA";
  }

  function getStatusLabel(value) {
    const normalized = normalizeStatus(value);
    if (normalized === "CONCLUIDA") return "CONCLUIDA";
    if (normalized === "EM ANDAMENTO") return "EM ANDAMENTO";
    return "ABERTA";
  }

  function getStatusClasses(value) {
    const normalized = normalizeStatus(value);
    if (normalized === "CONCLUIDA") return "bg-green-50 text-green-700 border-green-100";
    if (normalized === "EM ANDAMENTO") return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-red-50 text-red-700 border-red-100";
  }

  function getPriorityClasses(value) {
    const normalized = normalizeStatus(value);
    if (normalized === "CRITICA") return "text-purple-700";
    if (normalized === "ALTA") return "text-red-600";
    if (normalized === "MEDIA") return "text-amber-600";
    return "text-gray-700";
  }

  function resetFilters() {
    state.draftFilters = { status: "", responsible: "", search: "" };
    state.filters = { ...state.draftFilters };
    dom.filterStatus.value = "";
    dom.filterResponsible.value = "";
    dom.searchInput.value = "";
  }

  function populateResponsibleSelects() {
    const users = state.allUsers
      .filter((user) => !user.deleted)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

    const options = [`<option value="">Todos os responsaveis</option>`]
      .concat(users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(formatField(user.name, "Sem nome"))}</option>`))
      .join("");

    dom.filterResponsible.innerHTML = options;
    dom.filterResponsible.value = state.draftFilters.responsible || "";

    const assignmentOptions = [`<option value="">Selecione um responsavel</option>`]
      .concat(users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(formatField(user.name, "Sem nome"))}</option>`))
      .join("");

    dom.maintenanceAssignedTo.innerHTML = assignmentOptions;
    dom.detailsAssignedTo.innerHTML = assignmentOptions;
  }

  function getFilteredMaintenances() {
    const search = String(state.filters.search || "").trim().toLowerCase();

    return state.allMaintenances
      .filter((item) => !item.deleted)
      .filter((item) => {
        if (state.filters.status && normalizeStatus(item.status) !== normalizeStatus(state.filters.status)) return false;
        if (state.filters.responsible && item.assignedTo !== state.filters.responsible) return false;
        if (!search) return true;
        const haystack = [
          item.maintenanceNumber,
          item.requesterName,
          item.assignedToName,
          item.equipment,
          item.sector,
          item.location,
          item.description,
          item.priority
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => {
        const left = toDateSafe(b.updatedAt || b.createdAt || b.concludedAt)?.getTime() || 0;
        const right = toDateSafe(a.updatedAt || a.createdAt || a.concludedAt)?.getTime() || 0;
        return left - right;
      });
  }

  function renderStats(filtered) {
    dom.totalCount.textContent = String(filtered.length);
    dom.openCount.textContent = String(filtered.filter((item) => isOpenStatus(item.status)).length);
    dom.progressCount.textContent = String(filtered.filter((item) => isProgressStatus(item.status)).length);
    dom.doneCount.textContent = String(filtered.filter((item) => isDoneStatus(item.status)).length);
    dom.listCount.textContent = `${filtered.length} registro${filtered.length === 1 ? "" : "s"}`;
  }

  function renderMaintenanceCard(item, tone) {
    const surfaceClass = tone === "done"
      ? "bg-gray-50 border-gray-200"
      : "bg-white border-gray-100";

    return `
      <article class="rounded-2xl border ${surfaceClass} px-5 py-4 cursor-pointer hover:shadow-md transition-shadow" data-maintenance-card="${escapeHtml(item.id)}">
        <div class="maintenance-grid">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">ID</div>
            <div class="text-sm font-bold text-gray-900 mt-1">${escapeHtml(formatField(item.maintenanceNumber))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Emitente</div>
            <div class="text-sm text-gray-900 mt-1">${escapeHtml(formatField(item.requesterName || item.emitterName || item.createdByName))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Prioridade</div>
            <div class="text-sm font-bold mt-1 ${getPriorityClasses(item.priority)}">${escapeHtml(formatField(item.priority, "NORMAL"))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Status</div>
            <div class="mt-1">
              <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClasses(item.status)}">${escapeHtml(getStatusLabel(item.status))}</span>
            </div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data</div>
            <div class="text-sm text-gray-700 mt-1">${escapeHtml(formatDateTime(item.createdAt))}</div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Equipamento</div>
            <div class="text-sm text-gray-800 mt-1">${escapeHtml(formatField(item.equipment))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Setor</div>
            <div class="text-sm text-gray-800 mt-1">${escapeHtml(formatField(item.sector))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Responsavel</div>
            <div class="text-sm text-gray-800 mt-1">${escapeHtml(formatField(item.assignedToName))}</div>
          </div>
        </div>
      </article>
    `;
  }

  function renderLists() {
    const filtered = getFilteredMaintenances();
    const pending = filtered.filter((item) => !isDoneStatus(item.status));
    const resolved = filtered.filter((item) => isDoneStatus(item.status));

    renderStats(filtered);

    dom.pendingList.innerHTML = pending.length
      ? pending.map((item) => renderMaintenanceCard(item, "pending")).join("")
      : `<div class="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">Nenhuma melhoria ativa para este recorte.</div>`;

    dom.resolvedList.innerHTML = resolved.length
      ? resolved.map((item) => renderMaintenanceCard(item, "done")).join("")
      : `<div class="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">Nenhuma melhoria concluida encontrada.</div>`;

    if (state.showResolved) {
      dom.resolvedBlock.classList.remove("hidden-state");
      dom.toggleResolvedButton.textContent = "Ocultar concluidas";
    } else {
      dom.resolvedBlock.classList.add("hidden-state");
      dom.toggleResolvedButton.textContent = "Ver concluidas";
    }
  }

  async function getNextMaintenanceNumberSafe() {
    const counterRef = db.collection("counters").doc("maintenances");
    return db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      if (!doc.exists) throw new Error("Documento counters/maintenances nao existe");
      const next = Number(doc.data().lastNumber || 0) + 1;
      transaction.update(counterRef, { lastNumber: next });
      return `MAN-${String(next).padStart(5, "0")}`;
    });
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
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "gestor"}. Aqui voce acompanha as melhorias abertas e concluidas.`;
    populateResponsibleSelects();
    renderLists();
    lucide.createIcons();
  }

  function openCreateModal() {
    dom.createFeedback.classList.add("hidden-state");
    dom.createForm.reset();
    populateResponsibleSelects();
    dom.createModal.classList.add("visible");
  }

  function closeCreateModal() {
    dom.createModal.classList.remove("visible");
  }

  function openDetailsModal(maintenanceId) {
    const item = state.allMaintenances.find((entry) => entry.id === maintenanceId);
    if (!item) return;
    state.selectedMaintenanceId = maintenanceId;
    dom.detailsTitle.textContent = formatField(item.maintenanceNumber);
    dom.detailsContent.innerHTML = [
      ["Status atual", getStatusLabel(item.status)],
      ["Emitente", formatField(item.requesterName || item.emitterName || item.createdByName)],
      ["Responsavel", formatField(item.assignedToName)],
      ["Prioridade", formatField(item.priority)],
      ["Setor", formatField(item.sector)],
      ["Equipamento", formatField(item.equipment)],
      ["Local", formatField(item.location)],
      ["Data de emissao", formatDateTime(item.createdAt)],
      ["Ultima atualizacao", formatDateTime(item.updatedAt)],
      ["Data de conclusao", formatDateTime(item.concludedAt)],
      ["Descricao", formatField(item.description)],
      ["Solucao aplicada", formatField(item.resolution)]
    ].map(([label, value], index) => `
      <div class="${index >= 10 ? "md:col-span-2" : ""}">
        <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">${escapeHtml(label)}</div>
        <div class="mt-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">${escapeHtml(value)}</div>
      </div>
    `).join("");

    dom.detailsResolution.value = item.resolution || "";
    dom.detailsStatus.value = getStatusLabel(item.status);
    populateResponsibleSelects();
    dom.detailsAssignedTo.value = item.assignedTo || "";
    dom.detailsFeedback.classList.add("hidden-state");
    dom.detailsModal.classList.add("visible");
  }

  function closeDetailsModal() {
    dom.detailsModal.classList.remove("visible");
    state.selectedMaintenanceId = null;
  }

  function listenUsers() {
    if (typeof state.unsubUsers === "function") state.unsubUsers();
    state.unsubUsers = db.collection("users").onSnapshot((snapshot) => {
      state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (state.currentUserData) {
        populateResponsibleSelects();
        renderLists();
      }
    });
  }

  function listenMaintenances() {
    if (typeof state.unsubMaintenances === "function") state.unsubMaintenances();
    state.unsubMaintenances = db.collection("maintenances").onSnapshot((snapshot) => {
      state.allMaintenances = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (state.currentUserData) renderLists();
    });
  }

  async function createMaintenance(event) {
    event.preventDefault();
    dom.createFeedback.classList.add("hidden-state");
    dom.createSubmitButton.disabled = true;
    dom.createSubmitButton.textContent = "Salvando...";

    try {
      const equipment = dom.maintenanceEquipment.value.trim();
      const sector = dom.maintenanceSector.value.trim();
      const location = dom.maintenanceLocation.value.trim();
      const priority = dom.maintenancePriority.value;
      const assignedTo = dom.maintenanceAssignedTo.value;
      const description = dom.maintenanceDescription.value.trim();

      if (!equipment || !sector || !description || !assignedTo) {
        throw new Error("Preencha equipamento, setor, responsavel e descricao.");
      }

      const maintenanceNumber = await getNextMaintenanceNumberSafe();
      const assignedUser = state.allUsers.find((user) => user.id === assignedTo);

      await db.collection("maintenances").add({
        maintenanceNumber,
        equipment,
        sector,
        location,
        priority,
        description,
        status: "ABERTA",
        requesterId: state.currentUser.uid,
        requesterName: state.currentUserData?.name || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        concludedAt: null,
        resolution: "",
        assignedTo,
        assignedToName: assignedUser?.name || ""
      });

      closeCreateModal();
    } catch (error) {
      dom.createFeedback.textContent = error.message || "Nao foi possivel salvar a melhoria.";
      dom.createFeedback.classList.remove("hidden-state");
    } finally {
      dom.createSubmitButton.disabled = false;
      dom.createSubmitButton.textContent = "Salvar melhoria";
    }
  }

  async function saveMaintenance(event) {
    event.preventDefault();
    if (!state.selectedMaintenanceId) return;

    dom.detailsFeedback.classList.add("hidden-state");
    dom.detailsSaveButton.disabled = true;
    dom.detailsSaveButton.textContent = "Salvando...";

    try {
      const assignedTo = dom.detailsAssignedTo.value;
      const assignedUser = state.allUsers.find((user) => user.id === assignedTo);
      const status = getStatusLabel(dom.detailsStatus.value);
      const updates = {
        resolution: dom.detailsResolution.value.trim(),
        status: status === "CONCLUIDA" ? "CONCLUIDA" : status,
        assignedTo,
        assignedToName: assignedUser?.name || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        concludedAt: status === "CONCLUIDA" ? firebase.firestore.FieldValue.serverTimestamp() : null
      };

      await db.collection("maintenances").doc(state.selectedMaintenanceId).update(updates);
      closeDetailsModal();
    } catch (error) {
      dom.detailsFeedback.textContent = error.message || "Nao foi possivel salvar as alteracoes.";
      dom.detailsFeedback.classList.remove("hidden-state");
    } finally {
      dom.detailsSaveButton.disabled = false;
      dom.detailsSaveButton.textContent = "Salvar alteracoes";
    }
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
        responsible: dom.filterResponsible.value || "",
        search: dom.searchInput.value || ""
      };
      state.filters = { ...state.draftFilters };
      renderLists();
      dom.filtersPanel.classList.remove("visible");
    });

    dom.clearFiltersButton.addEventListener("click", () => {
      resetFilters();
      renderLists();
    });

    dom.toggleResolvedButton.addEventListener("click", () => {
      state.showResolved = !state.showResolved;
      renderLists();
    });

    dom.openCreateModalButton.addEventListener("click", openCreateModal);
    dom.createModalClose.addEventListener("click", closeCreateModal);
    dom.createCancelButton.addEventListener("click", closeCreateModal);
    dom.createModal.addEventListener("click", (event) => {
      if (event.target === dom.createModal) closeCreateModal();
    });
    dom.createForm.addEventListener("submit", createMaintenance);

    dom.detailsModalClose.addEventListener("click", closeDetailsModal);
    dom.detailsCancelButton.addEventListener("click", closeDetailsModal);
    dom.detailsModal.addEventListener("click", (event) => {
      if (event.target === dom.detailsModal) closeDetailsModal();
    });
    dom.detailsForm.addEventListener("submit", saveMaintenance);

    document.addEventListener("click", (event) => {
      const card = event.target.closest("[data-maintenance-card]");
      if (card) {
        openDetailsModal(card.getAttribute("data-maintenance-card"));
        return;
      }

      if (!event.target.closest(".filter-popover")) {
        dom.filtersPanel.classList.remove("visible");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCreateModal();
        closeDetailsModal();
        dom.filtersPanel.classList.remove("visible");
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allMaintenances = [];
      state.allUsers = [];
      if (typeof state.unsubMaintenances === "function") state.unsubMaintenances();
      if (typeof state.unsubUsers === "function") state.unsubUsers();
      state.unsubMaintenances = null;
      state.unsubUsers = null;
      closeCreateModal();
      closeDetailsModal();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!isAdminProfile()) {
      sessionStorage.setItem("ridLoginFeedback", "Sua conta nao tem permissao para este painel.");
      await auth.signOut();
      return;
    }

    resetFilters();
    listenUsers();
    listenMaintenances();
    showPage();
  });

  bindEvents();
  lucide.createIcons();
})();
