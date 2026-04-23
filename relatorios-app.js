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
    reportHistory: [],
    filters: {},
    draftFilters: {},
    unsubRids: null,
    unsubReportHistory: null
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
    openReportModalButton: document.getElementById("openReportModalButton"),
    reportModal: document.getElementById("reportModal"),
    reportModalClose: document.getElementById("reportModalClose"),
    reportMonth: document.getElementById("reportMonth"),
    reportYear: document.getElementById("reportYear"),
    reportSector: document.getElementById("reportSector"),
    reportSearch: document.getElementById("reportSearch"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    downloadCsvButton: document.getElementById("downloadCsvButton"),
    reportHistoryCount: document.getElementById("reportHistoryCount"),
    reportHistoryList: document.getElementById("reportHistoryList"),
    reportTopScrollbar: document.getElementById("reportTopScrollbar"),
    reportTopScrollbarInner: document.getElementById("reportTopScrollbarInner"),
    reportTableScroller: document.getElementById("reportTableScroller"),
    openLateReportModalButton: document.getElementById("openLateReportModalButton"),
    reportCount: document.getElementById("reportCount"),
    reportTableBody: document.getElementById("reportTableBody"),
    lateReportCount: document.getElementById("lateReportCount"),
    lateReportTableBody: document.getElementById("lateReportTableBody"),
    lateReportModal: document.getElementById("lateReportModal"),
    lateReportModalClose: document.getElementById("lateReportModalClose")
  };

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

  function hasManagementAccess(user = state.currentUserData) {
    return isAdminUser(user) || isDeveloperUser(user) || isObserverUser(user);
  }

  function canManagePrivilegedNavigation(user = state.currentUserData) {
    return isAdminUser(user) || isDeveloperUser(user);
  }

  function canExportReports(user = state.currentUserData) {
    return hasManagementAccess(user);
  }

  function updateAdminNavigation() {
    document.querySelectorAll('[data-admin-only-nav="designated"]').forEach((element) => {
      element.classList.toggle("hidden-state", !canManagePrivilegedNavigation());
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

  function formatField(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function normalizeStatus(status) {
    return String(status || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "-";
    return digits.padStart(5, "0");
  }

  function getStatusTone(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "CORRIGIDO") return "bg-green-50 text-green-700 border-green-100";
    if (normalized === "VENCIDO") return "bg-red-50 text-red-700 border-red-100";
    if (normalized === "ENCERRADO") return "bg-slate-100 text-slate-700 border-slate-200";
    if (normalized === "EXCLUIDO") return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  function resetFiltersToCurrentMonth() {
    const now = new Date();
    state.draftFilters = {
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
      sector: "",
      search: ""
    };
    state.filters = { ...state.draftFilters };
    dom.reportMonth.value = state.draftFilters.month;
    dom.reportYear.value = state.draftFilters.year;
    dom.reportSector.value = "";
    dom.reportSearch.value = "";
  }

  function populateSectorFilter() {
    const currentValue = dom.reportSector.value;
    const sectors = [...new Set(state.allRids.map((rid) => formatField(rid.sector, "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    dom.reportSector.innerHTML = `<option value="">Todos os setores</option>${sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`).join("")}`;
    dom.reportSector.value = sectors.includes(currentValue) ? currentValue : state.draftFilters.sector || "";
  }

  function getFilteredRids() {
    const now = new Date();
    const month = Number(state.filters.month) || now.getMonth() + 1;
    const year = Number(state.filters.year) || now.getFullYear();
    const search = String(state.filters.search || "").trim().toLowerCase();

    return state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => {
        if (state.filters.sector && rid.sector !== state.filters.sector) return false;
        const date = toDateSafe(rid.emissionDate || rid.createdAt);
        if (!date) return false;
        if (date.getMonth() + 1 !== month || date.getFullYear() !== year) return false;
        if (!search) return true;
        const haystack = [
          rid.ridNumber,
          rid.emitterName,
          rid.location,
          rid.description,
          rid.sector,
          rid.status
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0) - (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0));
  }

  function getLateRids() {
    const now = new Date();
    const month = Number(state.filters.month) || now.getMonth() + 1;
    const year = Number(state.filters.year) || now.getFullYear();
    const search = String(state.filters.search || "").trim().toLowerCase();

    return state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => {
        if (state.filters.sector && rid.sector !== state.filters.sector) return false;
        const date = toDateSafe(rid.emissionDate || rid.createdAt);
        if (!date) return false;
        if (date.getFullYear() > year) return false;
        if (date.getFullYear() === year && date.getMonth() + 1 >= month) return false;
        const status = normalizeStatus(rid.status);
        if (status !== "EM ANDAMENTO" && status !== "VENCIDO") return false;
        if (!search) return true;
        const haystack = [
          rid.ridNumber,
          rid.emitterName,
          rid.location,
          rid.description,
          rid.sector,
          rid.status
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0) - (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0));
  }

  function renderRows(rows) {
    return rows.map((rid) => `
      <tr>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.unit))}</td>
        <td class="px-4 py-3 text-sm font-semibold text-gray-900">#${escapeHtml(formatRidNumber(rid.ridNumber))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatDate(rid.emissionDate || rid.createdAt))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.emitterName))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.incidentType))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.sector))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.location))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.incidentType))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.detectionOrigin))}</td>
        <td class="px-4 py-3 text-sm text-gray-700 max-w-[340px]">${escapeHtml(formatField(rid.description))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.riskClassification))}</td>
        <td class="px-4 py-3 text-sm text-gray-700 max-w-[260px]">${escapeHtml(formatField(rid.immediateAction))}</td>
        <td class="px-4 py-3 text-sm text-gray-700 max-w-[260px]">${escapeHtml(formatField(rid.correctiveActions))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatField(rid.responsibleLeaderName || rid.responsibleLeader))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatDate(rid.deadline))}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(formatDate(rid.conclusionDate))}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(rid.status)}">${escapeHtml(formatField(rid.status, "EM ANDAMENTO"))}</span>
        </td>
      </tr>
    `).join("");
  }

  function renderReportTable() {
    const rows = getFilteredRids();
    const lateRows = getLateRids();
    dom.reportCount.textContent = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
    dom.lateReportCount.textContent = `${lateRows.length} registro${lateRows.length === 1 ? "" : "s"}`;

    if (!rows.length) {
      dom.reportTableBody.innerHTML = `
        <tr>
          <td colspan="17" class="px-4 py-10 text-center text-sm text-gray-500">Nenhum RID encontrado no periodo selecionado.</td>
        </tr>
      `;
    } else {
      dom.reportTableBody.innerHTML = renderRows(rows);
    }

    if (!lateRows.length) {
      dom.lateReportTableBody.innerHTML = `
        <tr>
          <td colspan="17" class="px-4 py-10 text-center text-sm text-gray-500">Nenhum RID atrasado de meses anteriores para este recorte.</td>
        </tr>
      `;
    } else {
      dom.lateReportTableBody.innerHTML = renderRows(lateRows);
    }

    syncTopReportScrollbarWidth();
  }

  function syncTopReportScrollbarWidth() {
    if (!dom.reportTableScroller || !dom.reportTopScrollbarInner) return;
    const table = dom.reportTableScroller.querySelector("table");
    const width = table ? Math.max(table.scrollWidth, dom.reportTableScroller.clientWidth) : dom.reportTableScroller.scrollWidth;
    dom.reportTopScrollbarInner.style.width = `${width}px`;
  }

  function getPeriodLabel() {
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Marco",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro"
    ];
    const now = new Date();
    const month = Number(state.filters.month) || now.getMonth() + 1;
    const year = Number(state.filters.year) || now.getFullYear();
    return `${monthNames[month - 1] || "Mes"} de ${year}`;
  }

  function renderReportHistory() {
    const history = state.reportHistory || [];
    dom.reportHistoryCount.textContent = `${history.length} emiss${history.length === 1 ? "ao" : "oes"}`;

    if (!history.length) {
      dom.reportHistoryList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
          Nenhum relatorio foi emitido ainda.
        </div>
      `;
      return;
    }

    dom.reportHistoryList.innerHTML = history.map((item) => {
      const createdAt = item.exportedDate || formatDate(item.createdAt);
      const createdHour = item.exportedTime || toDateSafe(item.createdAt)?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) || "--:--";
      const sectorLabel = formatField(item.sectorLabel, "Todos os setores");
      return `
        <article class="rounded-2xl border border-gray-100 bg-white px-5 py-4">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="space-y-1">
              <div class="text-sm font-semibold text-gray-900">${escapeHtml(formatField(item.generatedByName, "Usuario nao identificado"))}</div>
              <div class="text-xs text-gray-500">Gerou um relatorio em ${escapeHtml(createdAt)} as ${escapeHtml(createdHour)}</div>
              <div class="flex items-center gap-2 flex-wrap pt-1">
                <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">${escapeHtml(formatField(item.exportType, "CSV"))}</span>
                <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">${escapeHtml(formatField(item.periodLabel, getPeriodLabel()))}</span>
                <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">${escapeHtml(sectorLabel)}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 min-w-[220px]">
              <div class="rounded-2xl bg-gray-50 px-3 py-2">
                <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Periodo</div>
                <div class="text-lg font-bold text-gray-900 mt-1">${escapeHtml(String(item.totalCurrent || 0))}</div>
              </div>
              <div class="rounded-2xl bg-red-50 px-3 py-2">
                <div class="text-[11px] uppercase tracking-wider text-red-400 font-semibold">Atrasados</div>
                <div class="text-lg font-bold text-red-700 mt-1">${escapeHtml(String(item.totalLate || 0))}</div>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function registerReportHistory(currentCount, lateCount) {
    if (!canExportReports()) return;
    if (!state.currentUser || !state.currentUserData) return;
    const sectorLabel = state.filters.sector || "Todos os setores";
    const exportedAt = new Date();
    try {
      await db.collection("reportsHistory").add({
        generatedById: state.currentUser.uid,
        generatedByName: state.currentUserData.name || state.currentUser.email || "Usuario",
        generatedByEmail: state.currentUser.email || state.currentUserData.email || "",
        exportType: "CSV",
        periodLabel: getPeriodLabel(),
        sectorLabel,
        totalCurrent: currentCount,
        totalLate: lateCount,
        exportedDate: exportedAt.toLocaleDateString("pt-BR"),
        exportedTime: exportedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        exportedAtMs: exportedAt.getTime(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.warn("Nao foi possivel registrar o historico de relatorios.", error);
    }
  }

  function exportCsv() {
    if (!canExportReports()) return;
    const rows = getFilteredRids();
    const lateRows = getLateRids();
    const lines = [
      "RIDs do periodo",
      ["Unidade", "RID", "Data Emissao", "Emitente", "Tipo", "Setor", "Local do Incidente", "Genese do Incidente", "Origem da Deteccao", "Descricao", "Classificacao de Risco", "Acao Imediata", "Acoes Corretivas", "Responsavel", "Prazo", "Data Conclusao", "Status"].join(";")
    ];

    rows.forEach((rid) => {
      lines.push([
        formatField(rid.unit),
        `#${formatRidNumber(rid.ridNumber)}`,
        formatDate(rid.emissionDate || rid.createdAt),
        formatField(rid.emitterName),
        formatField(rid.incidentType),
        formatField(rid.sector),
        formatField(rid.location),
        formatField(rid.incidentType),
        formatField(rid.detectionOrigin),
        `"${String(formatField(rid.description)).replace(/"/g, '""')}"`,
        formatField(rid.riskClassification),
        `"${String(formatField(rid.immediateAction)).replace(/"/g, '""')}"`,
        `"${String(formatField(rid.correctiveActions)).replace(/"/g, '""')}"`,
        formatField(rid.responsibleLeaderName || rid.responsibleLeader),
        formatDate(rid.deadline),
        formatDate(rid.conclusionDate),
        formatField(rid.status),
      ].join(";"));
    });

    lines.push("");
    lines.push("RIDs atrasados de meses anteriores");
    lines.push(["Unidade", "RID", "Data Emissao", "Emitente", "Tipo", "Setor", "Local do Incidente", "Genese do Incidente", "Origem da Deteccao", "Descricao", "Classificacao de Risco", "Acao Imediata", "Acoes Corretivas", "Responsavel", "Prazo", "Data Conclusao", "Status"].join(";"));

    lateRows.forEach((rid) => {
      lines.push([
        formatField(rid.unit),
        `#${formatRidNumber(rid.ridNumber)}`,
        formatDate(rid.emissionDate || rid.createdAt),
        formatField(rid.emitterName),
        formatField(rid.incidentType),
        formatField(rid.sector),
        formatField(rid.location),
        formatField(rid.incidentType),
        formatField(rid.detectionOrigin),
        `"${String(formatField(rid.description)).replace(/"/g, '""')}"`,
        formatField(rid.riskClassification),
        `"${String(formatField(rid.immediateAction)).replace(/"/g, '""')}"`,
        `"${String(formatField(rid.correctiveActions)).replace(/"/g, '""')}"`,
        formatField(rid.responsibleLeaderName || rid.responsibleLeader),
        formatDate(rid.deadline),
        formatDate(rid.conclusionDate),
        formatField(rid.status),
      ].join(";"));
    });

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileMonth = state.filters.month || String(new Date().getMonth() + 1).padStart(2, "0");
    const fileYear = state.filters.year || String(new Date().getFullYear());
    link.href = url;
    link.download = `relatorio-rids-${fileYear}-${String(fileMonth).padStart(2, "0")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    void registerReportHistory(rows.length, lateRows.length);
  }

  function renderPage() {
    populateSectorFilter();
    renderReportTable();
    renderReportHistory();
  }

  function openReportModal() {
    dom.reportModal.classList.remove("hidden");
    dom.reportModal.classList.add("flex");
  }

  function closeReportModal() {
    dom.reportModal.classList.add("hidden");
    dom.reportModal.classList.remove("flex");
  }

  function openLateReportModal() {
    dom.lateReportModal.classList.remove("hidden");
    dom.lateReportModal.classList.add("flex");
  }

  function closeLateReportModal() {
    dom.lateReportModal.classList.add("hidden");
    dom.lateReportModal.classList.remove("flex");
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
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "gestor"}. Aqui voce acompanha os relatorios consolidados de RIDs.`;
    dom.openReportModalButton.classList.toggle("hidden-state", !canExportReports());
    dom.downloadCsvButton.classList.toggle("hidden-state", !canExportReports());
    renderPage();
    lucide.createIcons();
  }

  function listenRids() {
    if (typeof state.unsubRids === "function") state.unsubRids();
    state.unsubRids = db.collection("rids").onSnapshot((snapshot) => {
      state.allRids = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (state.currentUserData) renderPage();
    });
  }

  function listenReportHistory() {
    if (typeof state.unsubReportHistory === "function") state.unsubReportHistory();
    state.unsubReportHistory = db
      .collection("reportsHistory")
      .orderBy("createdAt", "desc")
      .limit(30)
      .onSnapshot((snapshot) => {
        state.reportHistory = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (state.currentUserData) renderReportHistory();
      }, (error) => {
        console.warn("Sem permissao para ler reportsHistory. Seguindo sem historico.", error);
        state.reportHistory = [];
        if (state.currentUserData) renderReportHistory();
      });
  }

  function bindEvents() {
    let syncingTopScrollbar = false;
    let syncingTableScrollbar = false;

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

    dom.openReportModalButton.addEventListener("click", openReportModal);
    dom.reportModalClose.addEventListener("click", closeReportModal);
    dom.reportModal.addEventListener("click", (event) => {
      if (event.target === dom.reportModal) closeReportModal();
    });

    dom.applyFiltersButton.addEventListener("click", () => {
      state.draftFilters = {
        month: dom.reportMonth.value || "",
        year: dom.reportYear.value || "",
        sector: dom.reportSector.value || "",
        search: dom.reportSearch.value || ""
      };
      state.filters = { ...state.draftFilters };
      renderReportTable();
    });

    dom.clearFiltersButton.addEventListener("click", () => {
      resetFiltersToCurrentMonth();
      renderPage();
    });

    dom.downloadCsvButton.addEventListener("click", exportCsv);
    dom.openLateReportModalButton.addEventListener("click", openLateReportModal);
    dom.lateReportModalClose.addEventListener("click", closeLateReportModal);
    dom.lateReportModal.addEventListener("click", (event) => {
      if (event.target === dom.lateReportModal) closeLateReportModal();
    });

    dom.reportTopScrollbar.addEventListener("scroll", () => {
      if (syncingTopScrollbar) {
        syncingTopScrollbar = false;
        return;
      }
      syncingTableScrollbar = true;
      dom.reportTableScroller.scrollLeft = dom.reportTopScrollbar.scrollLeft;
    });

    dom.reportTableScroller.addEventListener("scroll", () => {
      if (syncingTableScrollbar) {
        syncingTableScrollbar = false;
        return;
      }
      syncingTopScrollbar = true;
      dom.reportTopScrollbar.scrollLeft = dom.reportTableScroller.scrollLeft;
    });

    window.addEventListener("resize", syncTopReportScrollbarWidth);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.reportModal.classList.contains("flex")) {
        closeReportModal();
      }
      if (event.key === "Escape" && dom.lateReportModal.classList.contains("flex")) {
        closeLateReportModal();
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allRids = [];
      state.reportHistory = [];
      if (typeof state.unsubRids === "function") state.unsubRids();
      if (typeof state.unsubReportHistory === "function") state.unsubReportHistory();
      state.unsubRids = null;
      state.unsubReportHistory = null;
      closeReportModal();
      closeLateReportModal();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!hasManagementAccess()) {
      sessionStorage.setItem("ridLoginFeedback", "Sua conta nao tem permissao para este painel.");
      await auth.signOut();
      return;
    }

    resetFiltersToCurrentMonth();
    listenRids();
    listenReportHistory();
    showPage();
  });

  bindEvents();
  lucide.createIcons();
})();
