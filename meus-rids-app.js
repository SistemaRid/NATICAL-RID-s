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
  const RID_IMAGE_MAX_BYTES = 350 * 1024;
  const RID_IMAGE_MAX_DIMENSION = 1280;

  const state = {
    currentUser: null,
    currentUserData: null,
    allRids: [],
    allDeleteRequests: [],
    leaders: [],
    unsubRids: null,
    unsubDeleteRequests: null,
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
    performanceGrid: document.getElementById("performanceGrid"),
    performanceFoot: document.getElementById("performanceFoot"),
    performanceBadge: document.getElementById("performanceBadge"),
    performanceProgress: document.getElementById("performanceProgress"),
    performanceHint: document.getElementById("performanceHint"),
    myRidsCount: document.getElementById("myRidsCount"),
    myRidsList: document.getElementById("myRidsList"),
    openNewRidModalButton: document.getElementById("openNewRidModalButton"),
    myRidModal: document.getElementById("myRidModal"),
    myRidModalTitle: document.getElementById("myRidModalTitle"),
    myRidModalBody: document.getElementById("myRidModalBody"),
    myRidModalClose: document.getElementById("myRidModalClose"),
    newRidModal: document.getElementById("newRidModal"),
    newRidModalClose: document.getElementById("newRidModalClose"),
    newRidForm: document.getElementById("newRidForm"),
    newRidEmitter: document.getElementById("newRidEmitter"),
    newRidEmissionDate: document.getElementById("newRidEmissionDate"),
    newRidResponsibleLeader: document.getElementById("newRidResponsibleLeader"),
    newRidCancel: document.getElementById("newRidCancel"),
    newRidSubmit: document.getElementById("newRidSubmit"),
    newRidFeedback: document.getElementById("newRidFeedback")
  };

  function isAdminProfile(user = state.currentUserData) {
    return !!user?.isAdmin;
  }

  function isDeveloperProfile(user = state.currentUserData) {
    return !!(user?.isAdmin && user?.isDeveloper);
  }

  function isObserverProfile(user = state.currentUserData) {
    const legacyValue = user?.customFields?.isobserver?.value ?? user?.customFields?.isObserver?.value;
    return !!(
      user?.isObserver ||
      legacyValue === true ||
      String(legacyValue || "").toLowerCase() === "true" ||
      String(user?.userType || "").trim().toLowerCase() === "observador"
    );
  }

  function updateAdminNavigation() {
    document.querySelectorAll('[data-admin-only-nav="designated"]').forEach((element) => {
      element.classList.toggle("hidden-state", !(isAdminProfile() && !isObserverProfile()));
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

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "-";
    return digits.padStart(5, "0");
  }

  function getRidSortValue(rid) {
    const digits = String(rid?.ridNumber ?? "").replace(/\D/g, "");
    return digits ? Number(digits) : 0;
  }

  function formatField(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function setNewRidFeedback(message, isError = true) {
    dom.newRidFeedback.textContent = message;
    dom.newRidFeedback.classList.toggle("hidden-state", !message);
    dom.newRidFeedback.className = `${isError ? "text-sm text-red-500" : "text-sm text-emerald-600"}${message ? "" : " hidden-state"}`;
  }

  function estimateBase64Bytes(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem selecionada."));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Nao foi possivel processar a imagem selecionada."));
      image.src = dataUrl;
    });
  }

  async function prepareRidImage(file) {
    if (!file || !file.size) return null;
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("Selecione um arquivo de imagem valido.");
    }

    const sourceDataUrl = await readFileAsDataUrl(file);
    const image = await loadImageElement(sourceDataUrl);
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, RID_IMAGE_MAX_DIMENSION / Math.max(image.width || 1, image.height || 1));

    canvas.width = Math.max(1, Math.round((image.width || 1) * ratio));
    canvas.height = Math.max(1, Math.round((image.height || 1) * ratio));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Nao foi possivel preparar a imagem para envio.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (estimateBase64Bytes(dataUrl) > RID_IMAGE_MAX_BYTES && quality > 0.4) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    if (estimateBase64Bytes(dataUrl) > RID_IMAGE_MAX_BYTES) {
      throw new Error("A imagem ficou grande demais mesmo apos compressao. Use uma foto menor.");
    }

    return {
      dataUrl,
      contentType: "image/jpeg",
      originalName: file.name || "rid.jpg"
    };
  }

  async function loadLeaders() {
    try {
      const snapshot = await db.collection("leaders_public").get();
      state.leaders = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((leader) => leader.isDeveloper !== true)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    } catch (error) {
      state.leaders = [];
    }
  }

  function renderLeaderOptions() {
    const baseOption = '<option value="">Selecione...</option>';
    const options = state.leaders.map((leader) => `<option value="${escapeHtml(leader.id)}">${escapeHtml(leader.name || "Lider")}</option>`).join("");
    dom.newRidResponsibleLeader.innerHTML = baseOption + options;
  }

  function resetNewRidForm() {
    dom.newRidForm.reset();
    dom.newRidEmitter.textContent = formatField(state.currentUserData?.name, "-");
    dom.newRidEmissionDate.value = new Date().toISOString().slice(0, 10);
    renderLeaderOptions();
    if (state.currentUserData?.unit) {
      const unitSelect = dom.newRidForm.querySelector('[name="unit"]');
      if (unitSelect) unitSelect.value = state.currentUserData.unit;
    }
    if (state.currentUserData?.contractType) {
      const contractTypeSelect = dom.newRidForm.querySelector('[name="contractType"]');
      if (contractTypeSelect) contractTypeSelect.value = state.currentUserData.contractType;
    }
    setNewRidFeedback("");
  }

  function openNewRidModal() {
    resetNewRidForm();
    dom.newRidModal.classList.add("visible");
  }

  function closeNewRidModal() {
    dom.newRidModal.classList.remove("visible");
    setNewRidFeedback("");
  }

  async function getNextRidNumberSafe() {
    const counterRef = db.collection("counters").doc("rids");
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(counterRef);
      const data = snapshot.exists ? snapshot.data() || {} : {};
      const current = typeof data.lastNumber === "number"
        ? data.lastNumber
        : (typeof data.value === "number" ? data.value : 0);
      const next = current + 1;
      transaction.set(counterRef, {
        lastNumber: next,
        value: typeof data.value === "number" ? data.value : 0
      }, { merge: true });
      return String(next).padStart(5, "0");
    });
  }

  function buildRidPayload(formData) {
    const leaderId = formData.get("responsibleLeader") || "";
    const leader = state.leaders.find((item) => item.id === leaderId);
    const status = String(formData.get("status") || "VENCIDO").toUpperCase();

    return {
      emitterId: state.currentUser.uid,
      emitterName: state.currentUserData.name,
      emitterCpf: state.currentUserData.cpf,
      contractType: formData.get("contractType"),
      unit: formData.get("unit"),
      sector: state.currentUserData.sector || "",
      emissionDate: formData.get("emissionDate"),
      incidentType: formData.get("incidentType"),
      detectionOrigin: formData.get("detectionOrigin"),
      location: formData.get("location"),
      description: formData.get("description"),
      riskClassification: formData.get("riskClassification"),
      immediateAction: formData.get("immediateAction"),
      image: null,
      status,
      responsibleLeader: leaderId,
      responsibleLeaderName: leader?.name || ""
    };
  }

  async function submitRidToFirestore(payload) {
    const ridNumber = await getNextRidNumberSafe();
    const isCorrectedNow = payload.status === "CORRIGIDO";
    const [year, month, day] = String(payload.emissionDate || "").split("-").map(Number);
    const emissionDate = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);

    await db.collection("rids").add({
      ridNumber,
      emitterId: payload.emitterId,
      emitterName: payload.emitterName,
      emitterCpf: payload.emitterCpf,
      contractType: payload.contractType,
      unit: payload.unit,
      sector: payload.sector,
      emissionDate: firebase.firestore.Timestamp.fromDate(emissionDate),
      incidentType: payload.incidentType,
      detectionOrigin: payload.detectionOrigin,
      location: payload.location,
      description: payload.description,
      riskClassification: payload.riskClassification,
      immediateAction: payload.immediateAction,
      imageDataUrl: payload.image?.dataUrl || null,
      imageContentType: payload.image?.contentType || null,
      imageOriginalName: payload.image?.originalName || null,
      status: isCorrectedNow ? "CORRIGIDO" : "VENCIDO",
      responsibleLeader: payload.responsibleLeader || "",
      responsibleLeaderName: payload.responsibleLeaderName || "",
      emailSent: false,
      emailSentAt: null,
      lastNotifiedLeader: null,
      deadline: null,
      conclusion: null,
      correctiveActions: null,
      observations: null,
      conclusionDate: isCorrectedNow ? firebase.firestore.FieldValue.serverTimestamp() : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function getPersonalMonthlyGoal(user) {
    return user?.isAdmin || user?.isDeveloper ? 8 : 4;
  }

  function getStatusTone(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "EXCLUIDO") return "bg-rose-50 text-rose-700 border-rose-100";
    if (normalized === "CORRIGIDO") return "bg-green-50 text-green-700 border-green-100";
    if (normalized === "VENCIDO") return "bg-red-50 text-red-700 border-red-100";
    if (normalized === "ENCERRADO") return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  function getLatestDeleteRequestForRid(ridId) {
    return state.allDeleteRequests
      .filter((request) => request.ridId === ridId)
      .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0))[0] || null;
  }

  function getDeletedRidMeta(rid) {
    if (!rid?.deleted) return null;

    const request = getLatestDeleteRequestForRid(rid.id);
    const deletedByName = rid.deletedBy?.name || "";
    const deletedByRole = rid.deletedBy?.role || "";
    const deletedAt = formatDate(rid.deletedAt);
    const requestDate = formatDate(request?.createdAt);
    const reason = formatField(request?.reason || rid.deleteReason, "Motivo nao informado.");
    const source = request
      ? `Solicitacao registrada em ${requestDate}`
      : deletedByName
        ? `Remocao feita por ${deletedByName}${deletedByRole ? ` (${deletedByRole})` : ""} em ${deletedAt}`
        : `RID removido em ${deletedAt}`;

    return {
      reason,
      source,
      guidance: "Para tirar duvidas, entre em contato com o gestor responsavel."
    };
  }

  function getMyRidDetails(rid) {
    const deletedMeta = getDeletedRidMeta(rid);
    if (deletedMeta) {
      return [
        { label: "Descricao", value: String(rid.description || "Sem descricao").trim(), tone: "bg-slate-50 border-slate-200 text-slate-800" },
        { label: "Motivo da exclusao", value: deletedMeta.reason, tone: "bg-rose-50 border-rose-100 text-rose-800" },
        { label: "Orientacao", value: deletedMeta.guidance, tone: "bg-amber-50 border-amber-100 text-amber-800" }
      ];
    }

    const status = normalizeStatus(rid.status);
    const description = String(rid.description || "Sem descricao").trim();
    const immediateAction = String(rid.immediateAction || "").trim();
    const correctiveActions = String(rid.correctiveActions || "").trim();
    const isOwnCorrectedWithoutCorrective = status === "CORRIGIDO" &&
      rid.emitterId === state.currentUser?.uid &&
      !correctiveActions &&
      !!immediateAction;

    if (status === "VENCIDO") {
      return [
        { label: "Descricao", value: description, tone: "bg-red-50 border-red-100 text-red-800" }
      ];
    }

    if (isOwnCorrectedWithoutCorrective) {
      return [
        { label: "Descricao", value: description, tone: "bg-sky-50 border-sky-100 text-slate-800" },
        { label: "Acao imediata", value: immediateAction, tone: "bg-amber-50 border-amber-100 text-amber-800" }
      ];
    }

    if (status === "CORRIGIDO" || status === "ENCERRADO") {
      return [
        { label: "Descricao", value: description, tone: "bg-sky-50 border-sky-100 text-slate-800" },
        { label: "Acoes corretivas", value: correctiveActions || "Aguardando detalhamento da acao corretiva.", tone: "bg-green-50 border-green-100 text-green-800" }
      ];
    }

    return [
      { label: "Descricao", value: description, tone: "bg-sky-50 border-sky-100 text-slate-800" }
    ];
  }

  function getMine() {
    return state.allRids
      .filter((rid) => rid.emitterId === state.currentUser?.uid)
      .sort((a, b) => {
        const ridDiff = getRidSortValue(b) - getRidSortValue(a);
        if (ridDiff !== 0) return ridDiff;
        return (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0) - (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0);
      });
  }

  function renderPerformance(rids) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const currentMonthRids = rids.filter((rid) => {
      const date = toDateSafe(rid.emissionDate || rid.createdAt);
      return date && date.getMonth() + 1 === month && date.getFullYear() === year;
    });

    const total = rids.length;
    const inProgress = rids.filter((rid) => normalizeStatus(rid.status) === "EM ANDAMENTO").length;
    const overdue = rids.filter((rid) => normalizeStatus(rid.status) === "VENCIDO").length;
    const corrected = rids.filter((rid) => {
      const status = normalizeStatus(rid.status);
      return status === "CORRIGIDO" || status === "ENCERRADO";
    }).length;
    const monthCount = currentMonthRids.length;
    const goal = getPersonalMonthlyGoal(state.currentUserData);
    const hitGoal = monthCount >= goal;
    const progress = goal > 0 ? Math.min((monthCount / goal) * 100, 100) : 0;
    const remaining = Math.max(goal - monthCount, 0);
    const completionRate = total > 0 ? Math.round((corrected / total) * 100) : 0;
    const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;

    const cards = [
      {
        label: "Total emitido",
        value: total,
        helper: "Historico completo",
        accent: "text-slate-900",
        tone: "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
      },
      {
        label: "Em andamento",
        value: inProgress,
        helper: `${Math.max(total - corrected - overdue, 0)} ativos no fluxo`,
        accent: "text-amber-700",
        tone: "border-amber-100 bg-[linear-gradient(180deg,#fffdf5_0%,#fffbeb_100%)]"
      },
      {
        label: "Vencidos",
        value: overdue,
        helper: `${overdueRate}% do total`,
        accent: "text-rose-700",
        tone: "border-rose-100 bg-[linear-gradient(180deg,#fff8f8_0%,#fff1f2_100%)]"
      },
      {
        label: "Corrigidos",
        value: corrected,
        helper: `${completionRate}% concluido`,
        accent: "text-emerald-700",
        tone: "border-emerald-100 bg-[linear-gradient(180deg,#f6fffb_0%,#ecfdf5_100%)]"
      }
    ];

    dom.performanceGrid.innerHTML = cards.map((card) => `
      <div class="rounded-[22px] border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${card.tone}">
        <div class="text-[11px] uppercase tracking-[0.18em] font-semibold text-slate-400">${card.label}</div>
        <div class="flex items-end justify-between gap-4 mt-3">
          <div class="text-xs text-slate-500 leading-5">${card.helper}</div>
          <div class="text-3xl font-bold ${card.accent}">${card.value}</div>
        </div>
      </div>
    `).join("");

    dom.performanceFoot.textContent = `${monthCount} emitidos no mes · Meta: ${goal}`;
    dom.performanceProgress.style.width = `${progress}%`;
    dom.performanceHint.textContent = hitGoal
      ? `Meta atingida com ${monthCount - goal} RID${monthCount - goal === 1 ? "" : "s"} acima do objetivo.`
      : `Faltam ${remaining} RID${remaining === 1 ? "" : "s"} para bater sua meta deste mes.`;
    dom.performanceBadge.textContent = hitGoal ? "Meta batida" : `${Math.round(progress)}% da meta`;
    dom.performanceBadge.className = hitGoal
      ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm"
      : "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm";
  }

  function renderMyRids(rids) {
    dom.myRidsCount.textContent = `${rids.length} registros`;
    if (!rids.length) {
      dom.myRidsList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          <div class="text-sm font-medium text-gray-500">Voce ainda nao emitiu nenhum RID.</div>
        </div>
      `;
      return;
    }

    dom.myRidsList.innerHTML = rids.map((rid) => `
      <button type="button" data-open-my-rid="${escapeHtml(rid.id)}" class="my-rid-row w-full text-left rounded-2xl border border-gray-100 bg-white px-5 py-5">
        <div class="grid grid-cols-1 md:grid-cols-[140px_160px_minmax(0,1fr)_170px_150px] gap-4 items-center">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">RID</div>
            <div class="text-sm font-bold text-gray-900 mt-1 md:mt-0">#${escapeHtml(formatRidNumber(rid.ridNumber))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Data de emissao</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatDate(rid.emissionDate || rid.createdAt))}</div>
          </div>
          <div class="min-w-0">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Local</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0 truncate">${escapeHtml(formatField(rid.location))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Setor</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatField(rid.sector))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Status</div>
            <div class="mt-1 md:mt-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(rid.status)}">${escapeHtml(rid.status || "EM ANDAMENTO")}</div>
          </div>
        </div>
      </button>
    `).join("");
  }

  function openMyRidModal(ridId) {
    const rid = getMine().find((item) => item.id === ridId);
    if (!rid) return;

    state.selectedRidId = ridId;
    const detailBlocks = getMyRidDetails(rid);

    dom.myRidModalTitle.textContent = `RID #${formatRidNumber(rid.ridNumber)}`;
    dom.myRidModalBody.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Status</div>
          <div class="mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(rid.status)}">${escapeHtml(rid.status || "EM ANDAMENTO")}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data de emissao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(rid.emissionDate || rid.createdAt))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Local</div>
          <div class="text-sm font-semibold text-gray-900 mt-2 break-words">${escapeHtml(formatField(rid.location))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Setor</div>
          <div class="text-sm font-semibold text-gray-900 mt-2 break-words">${escapeHtml(formatField(rid.sector))}</div>
        </div>
      </div>
      ${rid.imageDataUrl ? `
        <div class="mt-5 rounded-2xl border border-gray-100 bg-white px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Imagem da ocorrencia</div>
          <img src="${escapeHtml(rid.imageDataUrl)}" alt="Imagem do RID" class="mt-3 w-full rounded-2xl border border-gray-100 object-cover">
        </div>
      ` : ""}
      <div class="space-y-3 mt-5">
        ${detailBlocks.map((block) => `
          <div class="rounded-2xl border px-4 py-4 ${block.tone}">
            <div class="text-[11px] uppercase tracking-wider font-semibold">${escapeHtml(block.label)}</div>
            <div class="text-sm mt-2 leading-6 whitespace-pre-wrap">${escapeHtml(block.value)}</div>
          </div>
        `).join("")}
      </div>
    `;

    dom.myRidModal.classList.add("visible");
  }

  function closeMyRidModal() {
    state.selectedRidId = null;
    dom.myRidModal.classList.remove("visible");
  }

  function renderPage() {
    const mine = getMine();
    renderPerformance(mine);
    renderMyRids(mine);
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
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "usuario"}. Aqui voce acompanha seus proprios RIDs.`;
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

  function listenDeleteRequests() {
    if (typeof state.unsubDeleteRequests === "function") state.unsubDeleteRequests();
    state.unsubDeleteRequests = db.collection("deleteRequests").onSnapshot((snapshot) => {
      state.allDeleteRequests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (state.currentUserData) renderPage();
    }, (error) => {
      if (String(error?.code || "").includes("permission-denied")) {
        console.warn("Sem permissao para ler deleteRequests em Meus RIDs. Seguindo sem essas informacoes.");
      }
      state.allDeleteRequests = [];
      if (state.currentUserData) renderPage();
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

    dom.openNewRidModalButton.addEventListener("click", openNewRidModal);

    dom.myRidsList.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-open-my-rid]");
      if (!trigger) return;
      openMyRidModal(trigger.getAttribute("data-open-my-rid"));
    });

    dom.myRidModalClose.addEventListener("click", closeMyRidModal);

    dom.myRidModal.addEventListener("click", (event) => {
      if (event.target === dom.myRidModal) closeMyRidModal();
    });

    dom.newRidModalClose.addEventListener("click", closeNewRidModal);
    dom.newRidCancel.addEventListener("click", closeNewRidModal);
    dom.newRidModal.addEventListener("click", (event) => {
      if (event.target === dom.newRidModal) closeNewRidModal();
    });
    dom.newRidForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      dom.newRidSubmit.disabled = true;
      dom.newRidSubmit.textContent = "Emitindo...";
      setNewRidFeedback("");

      try {
        const formData = new FormData(dom.newRidForm);
        const payload = buildRidPayload(formData);
        payload.image = await prepareRidImage(formData.get("imageFile"));
        await submitRidToFirestore(payload);
        closeNewRidModal();
      } catch (error) {
        setNewRidFeedback(error?.message || "Nao foi possivel emitir o RID.");
      } finally {
        dom.newRidSubmit.disabled = false;
        dom.newRidSubmit.textContent = "Emitir RID";
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.myRidModal.classList.contains("visible")) {
        closeMyRidModal();
      }
      if (event.key === "Escape" && dom.newRidModal.classList.contains("visible")) {
        closeNewRidModal();
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allRids = [];
      state.allDeleteRequests = [];
      if (typeof state.unsubRids === "function") state.unsubRids();
      if (typeof state.unsubDeleteRequests === "function") state.unsubDeleteRequests();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!state.currentUserData) {
      sessionStorage.setItem("ridLoginFeedback", "Sua conta nao foi encontrada.");
      await auth.signOut();
      return;
    }

    await loadLeaders();
    listenRids();
    listenDeleteRequests();
    showPage();
  });

  bindEvents();
  lucide.createIcons();
})();
