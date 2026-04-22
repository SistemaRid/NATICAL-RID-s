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

  const PAGE_SIZE = 12;

  const state = {
    currentUser: null,
    currentUserData: null,
    allUsers: [],
    allRids: [],
    unsubRids: null,
    currentPage: 1,
    selectedRidId: null,
    actionRidId: null,
    footerTimerId: null
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
    toggleFiltersButton: document.getElementById("toggleFiltersButton"),
    filtersPanel: document.getElementById("filtersPanel"),
    filterMonth: document.getElementById("filterMonth"),
    filterYear: document.getElementById("filterYear"),
    filterSector: document.getElementById("filterSector"),
    filterStatus: document.getElementById("filterStatus"),
    searchInput: document.getElementById("searchInput"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    logoutButton: document.getElementById("logoutButton"),
    listCount: document.getElementById("listCount"),
    ridsList: document.getElementById("ridsList"),
    lateRidsList: document.getElementById("lateRidsList"),
    ridDetailsModal: document.getElementById("ridDetailsModal"),
    ridDetailsTitle: document.getElementById("ridDetailsTitle"),
    ridDetailsBody: document.getElementById("ridDetailsBody"),
    ridDetailsClose: document.getElementById("ridDetailsClose"),
    ridDetailsSave: document.getElementById("ridDetailsSave"),
    ridDetailsFeedback: document.getElementById("ridDetailsFeedback"),
    ridDetailsDeleteAction: document.getElementById("ridDetailsDeleteAction"),
    ridDeleteConfirmModal: document.getElementById("ridDeleteConfirmModal"),
    ridDeleteConfirmFeedback: document.getElementById("ridDeleteConfirmFeedback"),
    ridDeleteConfirmCancel: document.getElementById("ridDeleteConfirmCancel"),
    ridDeleteConfirmSubmit: document.getElementById("ridDeleteConfirmSubmit"),
    ridRemovalRequestModal: document.getElementById("ridRemovalRequestModal"),
    ridRemovalReasonInput: document.getElementById("ridRemovalReasonInput"),
    ridRemovalRequestFeedback: document.getElementById("ridRemovalRequestFeedback"),
    ridRemovalRequestCancel: document.getElementById("ridRemovalRequestCancel"),
    ridRemovalRequestSubmit: document.getElementById("ridRemovalRequestSubmit"),
    prevPageButton: document.getElementById("prevPageButton"),
    nextPageButton: document.getElementById("nextPageButton"),
    paginationInfo: document.getElementById("paginationInfo"),
    siteFooter: document.getElementById("siteFooter")
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
    if (typeof value === "string") {
      const trimmed = value.trim();
      const brDate = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brDate) return new Date(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]), 12, 0, 0);
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleDateString("pt-BR") : "Sem data";
  }

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "-";
    return digits.padStart(5, "0");
  }

  function getRidSortValue(rid) {
    const digits = String(rid?.ridNumber ?? "").replace(/\D/g, "");
    return digits ? Number(digits) : 0;
  }

  function resetFiltersToCurrentMonth() {
    const now = new Date();
    dom.filterMonth.value = String(now.getMonth() + 1);
    dom.filterYear.value = String(now.getFullYear());
    dom.filterSector.value = "";
    dom.filterStatus.value = "";
    dom.searchInput.value = "";
    state.currentPage = 1;
  }

  function closeFiltersPanel() {
    dom.filtersPanel.classList.remove("visible");
  }

  function showTimedFooter() {
    if (!dom.siteFooter) return;
    if (state.footerTimerId) {
      clearTimeout(state.footerTimerId);
      state.footerTimerId = null;
    }
    dom.siteFooter.classList.add("visible");
    state.footerTimerId = window.setTimeout(() => {
      dom.siteFooter?.classList.remove("visible");
      state.footerTimerId = null;
    }, 10000);
  }

  function getSelectedFilters() {
    const now = new Date();
    const monthRaw = dom.filterMonth.value || "";
    return {
      showAllMonths: monthRaw === "all",
      month: monthRaw === "all" ? now.getMonth() + 1 : Number(monthRaw),
      year: Number(dom.filterYear.value) || now.getFullYear(),
      sector: dom.filterSector.value || "",
      status: normalizeStatus(dom.filterStatus.value || ""),
      search: String(dom.searchInput.value || "").trim().toLowerCase()
    };
  }

  function matchesSelectedPeriod(date, filters) {
    if (!date) return false;
    if (filters.showAllMonths) return date.getFullYear() === filters.year;
    return date.getFullYear() === filters.year && date.getMonth() + 1 === filters.month;
  }

  function isBeforeMonthYear(date, month, year) {
    if (!date) return false;
    const dateMonth = date.getMonth() + 1;
    const dateYear = date.getFullYear();
    return dateYear < year || (dateYear === year && dateMonth < month);
  }

  function getStatusMeta(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "VENCIDO") return { label: "Vencido", tone: "bg-red-50 text-red-700 border-red-100" };
    if (normalized === "CORRIGIDO") return { label: "Corrigido", tone: "bg-green-50 text-green-700 border-green-100" };
    if (normalized === "ENCERRADO") return { label: "Encerrado", tone: "bg-slate-100 text-slate-700 border-slate-200" };
    if (normalized === "PENDENTE") return { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-100" };
    return { label: "Em andamento", tone: "bg-orange-50 text-orange-700 border-orange-100" };
  }

  async function createNotification(userId, notificationData) {
    await db.collection("notifications").add({
      userId,
      ...notificationData,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function getLeaderOptions() {
    return state.allUsers
      .filter((user) => user && isPrivilegedUser(user))
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

  function findRidById(ridId) {
    return state.allRids.find((rid) => rid.id === ridId) || null;
  }

  function openRidDetailsModal(ridId) {
    const rid = findRidById(ridId);
    if (!rid) return;
    state.selectedRidId = ridId;
    const status = getStatusMeta(rid.status);
    const leaders = getLeaderOptions();
    dom.ridDetailsTitle.textContent = `RID #${formatRidNumber(rid.ridNumber)}`;
    dom.ridDetailsFeedback.classList.add("hidden-state");
    dom.ridDetailsFeedback.textContent = "";
    dom.ridDetailsDeleteAction.classList.add("hidden-state");
    dom.ridDetailsDeleteAction.textContent = "";
    dom.ridDetailsDeleteAction.className = "hidden-state px-4 py-2.5 rounded-xl border text-sm font-semibold";

    if (state.currentUserData?.isDeveloper) {
      dom.ridDetailsDeleteAction.textContent = "Excluir";
      dom.ridDetailsDeleteAction.className = "px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold";
      dom.ridDetailsDeleteAction.classList.remove("hidden-state");
    } else if (isAdminUser(state.currentUserData)) {
      dom.ridDetailsDeleteAction.textContent = "Solicitar remocao";
      dom.ridDetailsDeleteAction.className = "px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold";
      dom.ridDetailsDeleteAction.classList.remove("hidden-state");
    }

    dom.ridDetailsBody.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap mb-5">
        <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}">${status.label}</span>
        <span class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">${escapeHtml(rid.sector || "Sem setor")}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Emissor</div>
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
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Tipo de incidente</div>
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
        <div class="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-sky-700">Descricao do RID</div>
          <div class="text-sm text-slate-700 mt-2 leading-6">${escapeHtml(rid.description || "Sem descricao")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Acao imediata</div>
          <div class="text-sm text-gray-700 mt-2 leading-6">${escapeHtml(rid.immediateAction || "-")}</div>
        </div>
        ${rid.imageDataUrl ? `
          <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4 md:col-span-2">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Imagem da ocorrencia</div>
            <img src="${escapeHtml(rid.imageDataUrl)}" alt="Imagem do RID" class="mt-3 w-full rounded-2xl border border-gray-100 object-cover">
          </div>
        ` : ""}
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Conclusao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(rid.conclusionDate))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Lider designado</label>
          <select id="ridLeaderSelect" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white">
            <option value="">Sem lider designado</option>
            ${leaders.map((leader) => `
              <option value="${escapeHtml(leader.id)}" ${leader.id === rid.responsibleLeader ? "selected" : ""}>${escapeHtml(leader.name || "Sem nome")}</option>
            `).join("")}
          </select>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Status</label>
          <select id="ridStatusSelect" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white">
            ${["EM ANDAMENTO", "VENCIDO", "CORRIGIDO", "ENCERRADO"].map((option) => `
              <option value="${option}" ${normalizeStatus(rid.status) === option ? "selected" : ""}>${option}</option>
            `).join("")}
          </select>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Prazo (Opcional)</label>
          <input id="ridDeadlineInput" type="date" value="${escapeHtml(toDateInputValue(rid.deadline))}" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:border-gray-400">
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Observacoes</label>
          <textarea readonly rows="4" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 text-gray-600 resize-none">${escapeHtml(rid.observations || "")}</textarea>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-white px-4 py-4 md:col-span-2">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Acoes corretivas</label>
          <textarea id="ridCorrectiveActionsInput" rows="4" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 resize-none focus:outline-none focus:border-gray-400">${escapeHtml(rid.correctiveActions || "")}</textarea>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <label class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">Conclusao</label>
          <textarea readonly rows="4" class="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-100 text-gray-600 resize-none">${escapeHtml(rid.conclusion || "")}</textarea>
        </div>
      </div>
    `;
    dom.ridDetailsModal.classList.add("visible");
  }

  function closeRidDetailsModal() {
    state.selectedRidId = null;
    dom.ridDetailsModal.classList.remove("visible");
  }

  function openRidDeleteConfirmModal(ridId) {
    state.actionRidId = ridId;
    dom.ridDeleteConfirmFeedback.classList.add("hidden-state");
    dom.ridDeleteConfirmFeedback.textContent = "";
    dom.ridDeleteConfirmModal.classList.add("visible");
  }

  function closeRidDeleteConfirmModal() {
    state.actionRidId = null;
    dom.ridDeleteConfirmModal.classList.remove("visible");
  }

  function openRidRemovalRequestModal(ridId) {
    state.actionRidId = ridId;
    dom.ridRemovalReasonInput.value = "";
    dom.ridRemovalRequestFeedback.classList.add("hidden-state");
    dom.ridRemovalRequestFeedback.textContent = "";
    dom.ridRemovalRequestModal.classList.add("visible");
  }

  function closeRidRemovalRequestModal() {
    state.actionRidId = null;
    dom.ridRemovalRequestModal.classList.remove("visible");
  }

  async function requestRidRemoval(rid, reason) {
    if (!reason || !reason.trim()) return;

    let emitterName = rid.emitterName || null;
    if (!emitterName && rid.emitterId) {
      try {
        const userDoc = await db.collection("users").doc(rid.emitterId).get();
        if (userDoc.exists) emitterName = userDoc.data()?.name || null;
      } catch {}
    }

    await db.collection("deleteRequests").add({
      ridId: rid.id,
      ridNumber: rid.ridNumber || null,
      ridDescription: rid.description || null,
      ridEmitterName: emitterName,
      requesterId: state.currentUser.uid,
      requesterName: state.currentUserData?.name || "",
      reason: reason.trim(),
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const developerUsers = state.allUsers.filter((user) => user?.isDeveloper);
    for (const dev of developerUsers) {
      try {
        await createNotification(dev.id, {
          type: "deletion_request",
          ridId: rid.id,
          ridNumber: rid.ridNumber || "",
          title: "Nova Solicitacao de Exclusao",
          message: `${state.currentUserData?.name || "Admin"} solicitou exclusao do RID #${formatRidNumber(rid.ridNumber)}`,
          ridLocation: rid.location || null,
          deadline: null
        });
      } catch {}
    }
  }

  async function deleteRidDirectlyFromModal(rid) {
    const previousObs = rid.observations || "";
    const deleteNote = `[${new Date().toLocaleDateString("pt-BR")}] RID removido do sistema\nMotivo: Exclusao direta pelo desenvolvedor\nRemovido por: ${state.currentUserData?.name || "DEV"}`;

    await db.collection("rids").doc(rid.id).update({
      deleted: true,
      status: "EXCLUIDO",
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deletedBy: {
        uid: state.currentUser.uid,
        name: state.currentUserData?.name || "DEV",
        role: "DEV"
      },
      deleteReason: "Exclusao direta pelo desenvolvedor",
      observations: previousObs ? `${previousObs}\n\n${deleteNote}` : deleteNote
    });

    const adminUsers = state.allUsers.filter((user) => isAdminUser(user) && user.id !== state.currentUser.uid);
    for (const admin of adminUsers) {
      try {
        await createNotification(admin.id, {
          type: "rid_deleted",
          ridId: "",
          ridNumber: rid.ridNumber || "",
          title: "RID Excluida",
          message: `${state.currentUserData?.name || "DEV"} excluiu a RID #${rid.ridNumber || ""}`,
          ridLocation: rid.location || "",
          deadline: null
        });
      } catch {}
    }
  }

  async function saveRidDetails() {
    const ridId = state.selectedRidId;
    const rid = findRidById(ridId);
    if (!rid) return;

    const leaderSelect = document.getElementById("ridLeaderSelect");
    const statusSelect = document.getElementById("ridStatusSelect");
    const deadlineInput = document.getElementById("ridDeadlineInput");
    const correctiveActionsInput = document.getElementById("ridCorrectiveActionsInput");
    const leaderId = leaderSelect?.value || "";
    const leaderData = getLeaderOptions().find((leader) => leader.id === leaderId) || null;
    const nextStatus = statusSelect?.value || rid.status || "EM ANDAMENTO";
    const deadlineValue = String(deadlineInput?.value || "").trim();
    const correctiveActionsValue = String(correctiveActionsInput?.value || "").trim();

    if (normalizeStatus(nextStatus) === "CORRIGIDO" && !correctiveActionsValue) {
      dom.ridDetailsFeedback.textContent = 'Para status "Corrigido", e obrigatorio preencher Acoes corretivas.';
      dom.ridDetailsFeedback.classList.remove("hidden-state");
      return;
    }

    if (normalizeStatus(nextStatus) === "PENDENTE" && !deadlineValue) {
      dom.ridDetailsFeedback.textContent = 'Para status "Pendente", e obrigatorio informar um Prazo.';
      dom.ridDetailsFeedback.classList.remove("hidden-state");
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

    dom.ridDetailsFeedback.classList.add("hidden-state");
    dom.ridDetailsSave.disabled = true;
    dom.ridDetailsSave.textContent = "Salvando...";

    try {
      await db.collection("rids").doc(ridId).update(updates);
      closeRidDetailsModal();
    } catch (error) {
      dom.ridDetailsFeedback.textContent = "Nao foi possivel salvar as alteracoes do RID.";
      dom.ridDetailsFeedback.classList.remove("hidden-state");
    } finally {
      dom.ridDetailsSave.disabled = false;
      dom.ridDetailsSave.textContent = "Salvar alteracoes";
    }
  }

  function populateSectorFilter() {
    const selected = dom.filterSector.value;
    const sectors = Array.from(new Set(state.allUsers.map((user) => String(user?.sector || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    dom.filterSector.innerHTML = '<option value="">Todos os setores</option>' +
      sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`).join("");

    if (sectors.includes(selected)) dom.filterSector.value = selected;
  }

  function getFilteredRids(filters) {
    return state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => {
        if (filters.sector && rid.sector !== filters.sector) return false;
        const status = normalizeStatus(rid.status);
        if (filters.status && status !== filters.status) return false;
        const searchBase = [
          rid.ridNumber,
          rid.emitterName,
          rid.description,
          rid.sector,
          rid.location,
          rid.status
        ].join(" ").toLowerCase();
        if (filters.search && !searchBase.includes(filters.search)) return false;
        const date = toDateSafe(rid.emissionDate) || toDateSafe(rid.createdAt);
        return matchesSelectedPeriod(date, filters);
      })
      .sort((a, b) => {
        const ridDiff = getRidSortValue(b) - getRidSortValue(a);
        if (ridDiff !== 0) return ridDiff;
        return (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0) - (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0);
      });
  }

  function getLatePreviousRids(filters) {
    return state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => {
        if (filters.sector && rid.sector !== filters.sector) return false;
        const date = toDateSafe(rid.emissionDate || rid.createdAt);
        if (!date || !isBeforeMonthYear(date, filters.month, filters.year)) return false;
        const status = normalizeStatus(rid.status);
        return status === "EM ANDAMENTO" || status === "PENDENTE" || status === "VENCIDO";
      })
      .sort((a, b) => (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0) - (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0));
  }

  function renderRidsPage() {
    const filters = getSelectedFilters();
    const filtered = getFilteredRids(filters);
    const latePrevious = getLatePreviousRids(filters);
    const overdueInPeriod = filtered.filter((rid) => normalizeStatus(rid.status) === "VENCIDO").length;

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    const startIndex = (state.currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);
    const rangeStart = filtered.length ? startIndex + 1 : 0;
    const rangeEnd = filtered.length ? startIndex + pageItems.length : 0;

    dom.listCount.textContent = `${filtered.length} registros`;
    dom.paginationInfo.textContent = filtered.length
      ? `Pagina ${state.currentPage} de ${totalPages} • ${rangeStart}-${rangeEnd} de ${filtered.length}`
      : `Pagina 1 de 1 • 0 registros`;
    dom.prevPageButton.disabled = state.currentPage === 1;
    dom.nextPageButton.disabled = state.currentPage === totalPages;

    if (!pageItems.length) {
      dom.ridsList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          <div class="text-sm font-medium text-gray-500">Nenhuma RID encontrada para esse recorte.</div>
          <div class="text-xs text-gray-400 mt-2">Ajuste os filtros e tente novamente.</div>
        </div>
      `;
    } else {
      dom.ridsList.innerHTML = pageItems.map((rid) => {
        const status = getStatusMeta(rid.status);
        return `
          <button type="button" class="rid-clickable-row rounded-2xl border border-gray-100 bg-white px-5 py-5 text-left w-full" data-rid-id="${escapeHtml(rid.id)}">
            <div class="rid-row">
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">RID</div>
                <span class="rid-open-button inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900">#${escapeHtml(formatRidNumber(rid.ridNumber))}</span>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Emissor</div>
                <div class="text-sm text-gray-700">${escapeHtml(rid.emitterName || "Sem emissor")}</div>
                <div class="text-xs text-gray-400 mt-1">${escapeHtml(rid.location || "Local nao informado")}</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Setor</div>
                <div class="text-sm text-gray-700">${escapeHtml(rid.sector || "Sem setor")}</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Status</div>
                <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.tone}">${status.label}</span>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Emissao</div>
                <div class="text-sm text-gray-700">${escapeHtml(formatDate(rid.emissionDate || rid.createdAt))}</div>
              </div>
            </div>
          </button>
        `;
      }).join("");

      dom.ridsList.querySelectorAll("[data-rid-id]").forEach((button) => {
        button.addEventListener("click", () => {
          openRidDetailsModal(button.dataset.ridId);
        });
      });
    }

    if (!latePrevious.length) {
      dom.lateRidsList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          <div class="text-sm font-medium text-gray-500">Nenhuma RID atrasada de meses anteriores.</div>
          <div class="text-xs text-gray-400 mt-2">Quando houver pendencias antigas abertas, elas aparecerao aqui.</div>
        </div>
      `;
    } else {
      dom.lateRidsList.innerHTML = latePrevious.map((rid) => {
        const status = getStatusMeta(rid.status);
        return `
          <button type="button" class="rid-clickable-row rounded-2xl border border-red-100 bg-red-50/40 px-5 py-5 text-left w-full" data-late-rid-id="${escapeHtml(rid.id)}">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-gray-900">RID #${escapeHtml(formatRidNumber(rid.ridNumber))}</div>
                <div class="text-xs text-gray-500 mt-1">${escapeHtml(formatDate(rid.emissionDate || rid.createdAt))} · ${escapeHtml(rid.sector || "Sem setor")}</div>
              </div>
              <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.tone}">${status.label}</span>
            </div>
            <div class="text-sm text-gray-700 mt-3">${escapeHtml(String(rid.description || "Sem descricao").slice(0, 120))}</div>
            <div class="text-xs text-gray-500 mt-3">Emissor: ${escapeHtml(rid.emitterName || "Sem emissor")}</div>
          </button>
        `;
      }).join("");

      dom.lateRidsList.querySelectorAll("[data-late-rid-id]").forEach((button) => {
        button.addEventListener("click", () => {
          openRidDetailsModal(button.dataset.lateRidId);
        });
      });
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
    updateAdminNavigation();
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "gestor"}. Aqui voce acompanha a listagem completa de RIDs.`;
    populateSectorFilter();
    resetFiltersToCurrentMonth();
    renderRidsPage();
    showTimedFooter();
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
      if (isPrivilegedUser()) renderRidsPage();
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

    dom.toggleFiltersButton.addEventListener("click", (event) => {
      event.stopPropagation();
      dom.filtersPanel.classList.toggle("visible");
    });

    dom.applyFiltersButton.addEventListener("click", () => {
      state.currentPage = 1;
      closeFiltersPanel();
      renderRidsPage();
    });

    dom.clearFiltersButton.addEventListener("click", () => {
      resetFiltersToCurrentMonth();
      closeFiltersPanel();
      renderRidsPage();
    });

    dom.prevPageButton.addEventListener("click", () => {
      if (state.currentPage === 1) return;
      state.currentPage -= 1;
      renderRidsPage();
    });

    dom.nextPageButton.addEventListener("click", () => {
      state.currentPage += 1;
      renderRidsPage();
    });

    dom.logoutButton.addEventListener("click", async () => {
      await auth.signOut();
    });

    dom.ridDetailsClose.addEventListener("click", closeRidDetailsModal);
    dom.ridDetailsSave.addEventListener("click", () => {
      void saveRidDetails();
    });
    dom.ridDetailsModal.addEventListener("click", (event) => {
      if (event.target === dom.ridDetailsModal) closeRidDetailsModal();
    });
    dom.ridDetailsDeleteAction.addEventListener("click", () => {
      const rid = findRidById(state.selectedRidId);
      if (!rid) return;
      if (isDeveloperUser(state.currentUserData)) {
        openRidDeleteConfirmModal(rid.id);
      } else if (isAdminUser(state.currentUserData)) {
        openRidRemovalRequestModal(rid.id);
      }
    });
    dom.ridDeleteConfirmCancel.addEventListener("click", closeRidDeleteConfirmModal);
    dom.ridDeleteConfirmModal.addEventListener("click", (event) => {
      if (event.target === dom.ridDeleteConfirmModal) closeRidDeleteConfirmModal();
    });
    dom.ridDeleteConfirmSubmit.addEventListener("click", async () => {
      const rid = findRidById(state.actionRidId);
      if (!rid) return;
      dom.ridDeleteConfirmFeedback.classList.add("hidden-state");
      dom.ridDeleteConfirmSubmit.disabled = true;
      closeRidDeleteConfirmModal();
      closeRidDetailsModal();
      try {
        await deleteRidDirectlyFromModal(rid);
      } catch (error) {
        dom.ridDetailsFeedback.textContent = "Nao foi possivel excluir o RID.";
        dom.ridDetailsFeedback.classList.remove("hidden-state");
      } finally {
        dom.ridDeleteConfirmSubmit.disabled = false;
      }
    });
    dom.ridRemovalRequestCancel.addEventListener("click", closeRidRemovalRequestModal);
    dom.ridRemovalRequestModal.addEventListener("click", (event) => {
      if (event.target === dom.ridRemovalRequestModal) closeRidRemovalRequestModal();
    });
    dom.ridRemovalRequestSubmit.addEventListener("click", async () => {
      const rid = findRidById(state.actionRidId);
      if (!rid) return;
      const reason = String(dom.ridRemovalReasonInput.value || "").trim();
      if (!reason) {
        dom.ridRemovalRequestFeedback.textContent = "Informe o motivo da solicitacao.";
        dom.ridRemovalRequestFeedback.classList.remove("hidden-state");
        return;
      }
      dom.ridRemovalRequestFeedback.classList.add("hidden-state");
      dom.ridRemovalRequestSubmit.disabled = true;
      try {
        await requestRidRemoval(rid, reason);
        closeRidRemovalRequestModal();
        closeRidDetailsModal();
      } catch (error) {
        dom.ridRemovalRequestFeedback.textContent = "Nao foi possivel solicitar a remocao do RID.";
        dom.ridRemovalRequestFeedback.classList.remove("hidden-state");
      } finally {
        dom.ridRemovalRequestSubmit.disabled = false;
      }
    });

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (event) => {
        const href = item.getAttribute("href");
        if (href && href !== "#") return;
        event.preventDefault();
      });
    });

    document.addEventListener("click", (event) => {
      if (!dom.filtersPanel.contains(event.target) && !dom.toggleFiltersButton.contains(event.target)) {
        closeFiltersPanel();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.filtersPanel.classList.contains("visible")) {
        closeFiltersPanel();
      }
      if (event.key === "Escape" && dom.ridDetailsModal.classList.contains("visible")) {
        closeRidDetailsModal();
      }
      if (event.key === "Escape" && dom.ridDeleteConfirmModal.classList.contains("visible")) {
        closeRidDeleteConfirmModal();
      }
      if (event.key === "Escape" && dom.ridRemovalRequestModal.classList.contains("visible")) {
        closeRidRemovalRequestModal();
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allUsers = [];
      state.allRids = [];
      if (typeof state.unsubRids === "function") state.unsubRids();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!state.currentUserData || !isPrivilegedUser()) {
      sessionStorage.setItem("ridLoginFeedback", "Sua conta nao tem permissao para este painel.");
      await auth.signOut();
      return;
    }

    await loadUsers();
    listenRids();
    showPage();
  });

  bindEvents();
  resetFiltersToCurrentMonth();
  lucide.createIcons();
})();
