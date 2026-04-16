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
    allRequests: [],
    allUsers: [],
    allRids: [],
    filters: {},
    draftFilters: {},
    selectedRequestId: null,
    rejectRequestId: null,
    unsubRequests: null,
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
    filterStatus: document.getElementById("filterStatus"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    pendingCount: document.getElementById("pendingCount"),
    approvedCount: document.getElementById("approvedCount"),
    rejectedCount: document.getElementById("rejectedCount"),
    requestsCount: document.getElementById("requestsCount"),
    requestsList: document.getElementById("requestsList"),
    requestModal: document.getElementById("requestModal"),
    requestModalTitle: document.getElementById("requestModalTitle"),
    requestModalBody: document.getElementById("requestModalBody"),
    requestModalClose: document.getElementById("requestModalClose"),
    rejectModal: document.getElementById("rejectModal"),
    rejectModalClose: document.getElementById("rejectModalClose"),
    rejectReasonInput: document.getElementById("rejectReasonInput"),
    rejectFeedback: document.getElementById("rejectFeedback"),
    rejectCancelButton: document.getElementById("rejectCancelButton"),
    rejectSubmitButton: document.getElementById("rejectSubmitButton")
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

  function formatDate(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleDateString("pt-BR") : "-";
  }

  function formatDateTime(value) {
    const date = toDateSafe(value);
    return date ? date.toLocaleString("pt-BR") : "-";
  }

  function normalizeStatus(value) {
    return String(value || "pending").trim().toLowerCase();
  }

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits ? digits.padStart(5, "0") : "-";
  }

  function getStatusMeta(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "approved" || normalized === "aprovado") {
      return { label: "Aprovada", tone: "bg-green-50 text-green-700 border-green-100" };
    }
    if (normalized === "rejected" || normalized === "rejeitado") {
      return { label: "Rejeitada", tone: "bg-red-50 text-red-700 border-red-100" };
    }
    return { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-100" };
  }

  function resetFilters() {
    state.draftFilters = { status: "", search: "" };
    state.filters = { ...state.draftFilters };
    dom.filterStatus.value = "";
    dom.searchInput.value = "";
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

  function findRid(request) {
    return state.allRids.find((rid) => rid.id === request.ridId) || null;
  }

  function findRequester(request) {
    return state.allUsers.find((user) => user.id === request.requesterId) || null;
  }

  function getFilteredRequests() {
    const search = String(state.filters.search || "").trim().toLowerCase();
    return state.allRequests
      .filter((request) => {
        const requester = findRequester(request);
        return requester?.isAdmin === true;
      })
      .filter((request) => {
        if (request.requesterId === state.currentUser?.uid) return false;
        if (state.filters.status && normalizeStatus(request.status) !== normalizeStatus(state.filters.status)) return false;
        if (!search) return true;
        const rid = findRid(request);
        const haystack = [
          request.ridNumber,
          request.requesterName,
          request.reason,
          request.sector,
          rid?.description,
          rid?.sector
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
  }

  function renderStats(items) {
    dom.pendingCount.textContent = String(items.filter((item) => getStatusMeta(item.status).label === "Pendente").length);
    dom.approvedCount.textContent = String(items.filter((item) => getStatusMeta(item.status).label === "Aprovada").length);
    dom.rejectedCount.textContent = String(items.filter((item) => getStatusMeta(item.status).label === "Rejeitada").length);
  }

  function renderList() {
    const items = getFilteredRequests();
    renderStats(items);
    dom.requestsCount.textContent = `${items.length} solicitac${items.length === 1 ? "ao" : "oes"}`;

    if (!items.length) {
      dom.requestsList.innerHTML = `<div class="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">Nenhuma solicitacao encontrada para este recorte.</div>`;
      return;
    }

    dom.requestsList.innerHTML = items.map((item) => {
      const status = getStatusMeta(item.status);
      const rid = findRid(item);
      const ridNumber = formatRidNumber(item.ridNumber || rid?.ridNumber || "");
      return `
        <button type="button" class="request-card w-full rounded-2xl border border-gray-100 bg-white p-4 text-left" data-request-id="${escapeHtml(item.id)}">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">RID #${escapeHtml(ridNumber)}</span>
              <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.tone}">${status.label}</span>
            </div>
            <div class="text-xs text-gray-400">${escapeHtml(formatDate(item.createdAt))}</div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Solicitante</div>
              <div class="text-sm font-semibold text-gray-900 mt-1">${escapeHtml(formatField(item.requesterName))}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Setor</div>
              <div class="text-sm text-gray-700 mt-1">${escapeHtml(formatField(rid?.sector || item.sector))}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Resumo</div>
              <div class="text-sm text-gray-700 mt-1">${escapeHtml(formatField(item.reason, "Motivo nao informado").slice(0, 72))}</div>
            </div>
          </div>
        </button>
      `;
    }).join("");

    dom.requestsList.querySelectorAll("[data-request-id]").forEach((button) => {
      button.addEventListener("click", () => openRequestModal(button.dataset.requestId));
    });
  }

  function openRequestModal(requestId) {
    const item = state.allRequests.find((request) => request.id === requestId);
    if (!item) return;
    state.selectedRequestId = requestId;
    const rid = findRid(item);
    const status = getStatusMeta(item.status);
    const reviewedBy = item.reviewedByName || item.reviewedBy?.name || "-";
    const rejectionReason = formatField(item.rejectionReason || item.rejectReason || item.rejection, "-");
    const reviewedAt = formatDateTime(item.reviewedAt || item.updatedAt);
    const ridNumber = formatRidNumber(item.ridNumber || rid?.ridNumber || "");

    dom.requestModalTitle.textContent = `RID #${ridNumber}`;
    dom.requestModalBody.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap mb-5">
        <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}">${status.label}</span>
        <span class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">${escapeHtml(formatField(rid?.sector || item.sector, "Sem setor"))}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Solicitante</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatField(item.requesterName))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data da solicitacao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(item.createdAt))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data de emissao do RID</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(rid?.emissionDate || rid?.createdAt))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Responsavel designado</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatField(rid?.responsibleLeaderName))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Descricao do RID</div>
          <div class="text-sm text-gray-700 mt-2 leading-6">${escapeHtml(formatField(item.ridDescription || rid?.description))}</div>
        </div>
        <div class="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-orange-500">Motivo da solicitacao de remocao</div>
          <div class="text-sm text-orange-800 mt-2 leading-6">${escapeHtml(formatField(item.reason, "Motivo nao informado"))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Revisado por</div>
          <div class="text-sm text-gray-700 mt-2">${escapeHtml(reviewedBy)}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Revisado em</div>
          <div class="text-sm text-gray-700 mt-2">${escapeHtml(reviewedAt)}</div>
        </div>
        ${status.label === "Rejeitada" ? `
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 md:col-span-2">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-red-500">Motivo da rejeicao</div>
            <div class="text-sm text-red-800 mt-2 leading-6">${escapeHtml(rejectionReason)}</div>
          </div>
        ` : ""}
      </div>
      ${status.label === "Pendente" ? `
        <div class="flex items-center justify-end gap-3 mt-6">
          <button type="button" id="approveRequestButton" class="px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold">Aprovar solicitacao</button>
          <button type="button" id="rejectRequestButton" class="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold">Recusar solicitacao</button>
        </div>
      ` : ""}
    `;

    if (status.label === "Pendente") {
      dom.requestModalBody.querySelector("#approveRequestButton")?.addEventListener("click", () => approveRequest(requestId));
      dom.requestModalBody.querySelector("#rejectRequestButton")?.addEventListener("click", () => openRejectModal(requestId));
    }

    dom.requestModal.classList.add("visible");
  }

  function closeRequestModal() {
    dom.requestModal.classList.remove("visible");
    state.selectedRequestId = null;
  }

  function openRejectModal(requestId) {
    state.rejectRequestId = requestId;
    dom.rejectReasonInput.value = "";
    dom.rejectFeedback.classList.add("hidden-state");
    dom.rejectModal.classList.add("visible");
  }

  function closeRejectModal() {
    dom.rejectModal.classList.remove("visible");
    state.rejectRequestId = null;
  }

  async function createNotification(userId, payload) {
    if (!userId) return;
    try {
      await db.collection("notifications").add({
        userId,
        ...payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      });
    } catch (_) {
      // silencioso para nao travar a acao principal
    }
  }

  async function approveRequest(requestId) {
    const request = state.allRequests.find((item) => item.id === requestId);
    if (!request) return;
    const rid = findRid(request);
    if (!rid?.id) return;

    const reviewedBy = {
      id: state.currentUser.uid,
      name: state.currentUserData?.name || state.currentUser.email || "Desenvolvedor",
      role: isDeveloperProfile() ? "Desenvolvedor" : "Usuario"
    };

    await db.collection("rids").doc(rid.id).update({
      deleted: true,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deleteReason: request.reason || "Solicitacao aprovada",
      deletedBy: reviewedBy
    });

    await db.collection("deleteRequests").doc(requestId).update({
      status: "approved",
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewedById: reviewedBy.id,
      reviewedByName: reviewedBy.name,
      reviewedBy
    });

    await createNotification(request.requesterId, {
      type: "request_approved",
      title: "Solicitacao aprovada",
      message: `Sua solicitacao de exclusao do RID #${formatRidNumber(request.ridNumber || rid.ridNumber)} foi aprovada.`
    });

    closeRequestModal();
  }

  async function rejectRequest() {
    const requestId = state.rejectRequestId;
    const request = state.allRequests.find((item) => item.id === requestId);
    const reason = dom.rejectReasonInput.value.trim();

    if (!requestId || !request) return;
    if (!reason) {
      dom.rejectFeedback.textContent = "Informe o motivo da rejeicao.";
      dom.rejectFeedback.classList.remove("hidden-state");
      return;
    }

    const reviewedBy = {
      id: state.currentUser.uid,
      name: state.currentUserData?.name || state.currentUser.email || "Desenvolvedor",
      role: isDeveloperProfile() ? "Desenvolvedor" : "Usuario"
    };

    await db.collection("deleteRequests").doc(requestId).update({
      status: "rejected",
      rejectionReason: reason,
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewedById: reviewedBy.id,
      reviewedByName: reviewedBy.name,
      reviewedBy
    });

    await createNotification(request.requesterId, {
      type: "request_rejected",
      title: "Solicitacao rejeitada",
      message: "Sua solicitacao de exclusao do RID foi rejeitada."
    });

    closeRejectModal();
    closeRequestModal();
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
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "dev"}. Aqui voce aprova ou recusa as solicitacoes abertas pelos administradores.`;
    renderList();
    lucide.createIcons();
  }

  function listenRequests() {
    if (typeof state.unsubRequests === "function") state.unsubRequests();
    state.unsubRequests = db.collection("deleteRequests").onSnapshot((snapshot) => {
      state.allRequests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (isDeveloperProfile()) renderList();
    });
  }

  function listenRids() {
    if (typeof state.unsubRids === "function") state.unsubRids();
    state.unsubRids = db.collection("rids").onSnapshot((snapshot) => {
      state.allRids = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (isDeveloperProfile()) renderList();
    });
  }

  function listenUsers() {
    if (typeof state.unsubUsers === "function") state.unsubUsers();
    state.unsubUsers = db.collection("users").onSnapshot((snapshot) => {
      state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (isDeveloperProfile()) renderList();
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

    dom.requestModalClose.addEventListener("click", closeRequestModal);
    dom.requestModal.addEventListener("click", (event) => {
      if (event.target === dom.requestModal) closeRequestModal();
    });
    dom.rejectModalClose.addEventListener("click", closeRejectModal);
    dom.rejectCancelButton.addEventListener("click", closeRejectModal);
    dom.rejectModal.addEventListener("click", (event) => {
      if (event.target === dom.rejectModal) closeRejectModal();
    });
    dom.rejectSubmitButton.addEventListener("click", rejectRequest);

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".filter-popover")) {
        dom.filtersPanel.classList.remove("visible");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeRequestModal();
        closeRejectModal();
        dom.filtersPanel.classList.remove("visible");
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allRequests = [];
      state.allUsers = [];
      state.allRids = [];
      if (typeof state.unsubRequests === "function") state.unsubRequests();
      if (typeof state.unsubUsers === "function") state.unsubUsers();
      if (typeof state.unsubRids === "function") state.unsubRids();
      state.unsubRequests = null;
      state.unsubUsers = null;
      state.unsubRids = null;
      closeRequestModal();
      closeRejectModal();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!isDeveloperProfile()) {
      sessionStorage.setItem("ridLoginFeedback", "Somente desenvolvedores podem acessar esta tela.");
      await auth.signOut();
      return;
    }

    resetFilters();
    listenUsers();
    listenRids();
    listenRequests();
    showPage();
  });

  bindEvents();
  lucide.createIcons();
})();
