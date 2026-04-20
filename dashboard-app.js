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
  const messaging = typeof firebase.messaging === "function" ? firebase.messaging() : null;
  const WEB_PUSH_VAPID_KEY = "BC2FvVfx_PdEvXYqKdMAwZaNetYp_5Ni94FYINhTBxaXZnrhlCFfczJ-ivYtwsErGGcYAIAqUVzRz2HteJSaNuQ";
  const ANNOUNCEMENTS_COLLECTION = db.collection("globalAnnouncements");

  const state = {
    currentUser: null,
    currentUserData: null,
    allUsers: [],
    allRids: [],
    allDeleteRequests: [],
    unsubRids: null,
    unsubDeleteRequests: null,
    monthlyGoal: null,
    monthlyGoalMeta: null,
    manualGoalValue: null,
    manualGoalMonthKey: null,
    shouldAnimateGoalIntro: false,
    hasLoadedRidsOnce: false,
    notificationAudio: null,
    notificationAudioUnlocked: false,
    pushPromptDismissed: false,
    pushMessagingBound: false,
    pushToken: null,
    pushServiceWorkerRegistration: null
  };

  const dom = {
    bootOverlay: document.getElementById("bootOverlay"),
    authOverlay: document.getElementById("authOverlay"),
    loginForm: document.getElementById("loginForm"),
    loginCpf: document.getElementById("loginCpf"),
    loginPassword: document.getElementById("loginPassword"),
    loginSubmitButton: document.getElementById("loginSubmitButton"),
    loginFeedback: document.getElementById("loginFeedback"),
    dashboardShell: document.getElementById("dashboardShell"),
    dashboardMonth: document.getElementById("dashboardMonth"),
    dashboardYear: document.getElementById("dashboardYear"),
    dashboardSector: document.getElementById("dashboardSector"),
    toggleFiltersButton: document.getElementById("toggleFiltersButton"),
    filtersPanel: document.getElementById("filtersPanel"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    logoutButton: document.getElementById("logoutButton"),
    welcomeText: document.getElementById("welcome-text"),
    statTotalRids: document.getElementById("statTotalRids"),
    statOpenRids: document.getElementById("statOpenRids"),
    statOverdueRids: document.getElementById("statOverdueRids"),
    statCorrectedRids: document.getElementById("statCorrectedRids"),
    statCorrectedDetail: document.getElementById("statCorrectedDetail"),
    statLateRids: document.getElementById("statLateRids"),
    statClosedRids: document.getElementById("statClosedRids"),
    statRemovedRids: document.getElementById("statRemovedRids"),
    statusGoalPanel: document.getElementById("statusGoalPanel"),
    statusBoard: document.getElementById("statusBoard"),
    sectorBoard: document.getElementById("sectorBoard"),
    topEmittersList: document.getElementById("topEmittersList"),
    topEmittersSummary: document.getElementById("topEmittersSummary"),
    employeesWithoutRidsList: document.getElementById("employeesWithoutRidsList"),
    deleteRequestsCount: document.getElementById("deleteRequestsCount"),
    deleteRequestsSummary: document.getElementById("deleteRequestsSummary"),
    deleteRequestsList: document.getElementById("deleteRequestsList"),
    deleteRequestModal: document.getElementById("deleteRequestModal"),
    deleteRequestModalTitle: document.getElementById("deleteRequestModalTitle"),
    deleteRequestModalBody: document.getElementById("deleteRequestModalBody"),
    deleteRequestModalClose: document.getElementById("deleteRequestModalClose"),
    manualGoalModal: document.getElementById("manualGoalModal"),
    manualGoalModalClose: document.getElementById("manualGoalModalClose"),
    manualGoalForm: document.getElementById("manualGoalForm"),
    manualGoalInput: document.getElementById("manualGoalInput"),
    manualGoalFeedback: document.getElementById("manualGoalFeedback"),
    manualGoalCancel: document.getElementById("manualGoalCancel"),
    manualGoalSubmit: document.getElementById("manualGoalSubmit"),
    weeklyRidsList: document.getElementById("weeklyRidsList"),
    weekRidCount: document.getElementById("weekRidCount")
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

  function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function getAnnouncementViewKey(uid, dateKey) {
    return `ridAnnouncementView_${uid}_${dateKey}`;
  }

  function getStoredAnnouncementViews(uid, dateKey) {
    try {
      return JSON.parse(localStorage.getItem(getAnnouncementViewKey(uid, dateKey)) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveStoredAnnouncementViews(uid, dateKey, value) {
    localStorage.setItem(getAnnouncementViewKey(uid, dateKey), JSON.stringify(value));
  }

  function isAnnouncementActive(data) {
    if (!data?.isActive || !data.startDate || !data.daysVisible) return false;
    const start = new Date(`${data.startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return false;
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(1, Number(data.daysVisible || 1)) - 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= start && today <= end;
  }

  function canShowAnnouncement(uid, data) {
    if (!uid || !data?.updatedAt || !data?.id) return false;
    if (data.target === "mobile") return false;
    if (!isAnnouncementActive(data)) return false;
    const dateKey = getTodayKey();
    const stored = getStoredAnnouncementViews(uid, dateKey);
    const announcementId = `${data.id}:${data.updatedAt?.seconds ? data.updatedAt.seconds : String(data.updatedAt || data.startDate || "default")}`;
    const currentViews = Number(stored[announcementId] || 0);
    return currentViews < Math.max(1, Number(data.dailyLimit || 1));
  }

  function markAnnouncementShown(uid, data) {
    const dateKey = getTodayKey();
    const stored = getStoredAnnouncementViews(uid, dateKey);
    const announcementId = `${data.id}:${data.updatedAt?.seconds ? data.updatedAt.seconds : String(data.updatedAt || data.startDate || "default")}`;
    stored[announcementId] = Number(stored[announcementId] || 0) + 1;
    saveStoredAnnouncementViews(uid, dateKey, stored);
  }

  function removeAnnouncementModal() {
    document.getElementById("globalAnnouncementModal")?.remove();
  }

  function showAnnouncementModal(data, onClose) {
    removeAnnouncementModal();
    const overlay = document.createElement("div");
    overlay.id = "globalAnnouncementModal";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "1300";
    overlay.style.background = "rgba(15, 23, 42, 0.52)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "24px";
    overlay.style.backdropFilter = "blur(10px)";
    overlay.style.webkitBackdropFilter = "blur(10px)";
    const announcementImageHtml = data.imageDataUrl
      ? `<div style="margin-bottom:14px;"><img src="${escapeHtml(data.imageDataUrl)}" alt="Imagem do aviso" style="display:block;width:100%;max-height:240px;object-fit:cover;border-radius:18px;border:1px solid #dde5eb;"></div>`
      : "";
    overlay.innerHTML = `
      <div style="width:min(100%,560px);max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:#fff;border-radius:28px;padding:24px;border:1px solid #e5e7eb;box-shadow:0 24px 60px rgba(15,23,42,.22);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;">Aviso do sistema</div>
            <h2 style="margin:6px 0 0;font-size:24px;line-height:1.1;color:#111827;">${escapeHtml(data.title || "Atualização")}</h2>
          </div>
          <button type="button" id="closeGlobalAnnouncementModal" style="width:40px;height:40px;border:none;border-radius:999px;background:#f8fafc;color:#475569;font-size:24px;cursor:pointer;">×</button>
        </div>
        <div style="flex:1;min-height:0;overflow-y:auto;padding-right:6px;">
          ${announcementImageHtml}
          <div style="font-size:15px;line-height:1.7;color:#334155;white-space:pre-wrap;">${escapeHtml(data.message || "")}</div>
        </div>
        <div style="margin-top:18px;display:flex;justify-content:flex-end;">
          <button type="button" id="ackGlobalAnnouncementModal" style="padding:12px 18px;border:none;border-radius:16px;background:#111827;color:#fff;font-weight:700;cursor:pointer;">Entendi</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => {
      removeAnnouncementModal();
      if (typeof onClose === "function") onClose();
    };
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector("#closeGlobalAnnouncementModal")?.addEventListener("click", close);
    overlay.querySelector("#ackGlobalAnnouncementModal")?.addEventListener("click", close);
  }

  async function maybeShowGlobalAnnouncement() {
    if (!state.currentUser?.uid) return;
    try {
      const snap = await ANNOUNCEMENTS_COLLECTION.get();
      const eligible = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => canShowAnnouncement(state.currentUser.uid, item))
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

      if (!eligible.length) return;

      const showNext = (index) => {
        const current = eligible[index];
        if (!current) return;
        markAnnouncementShown(state.currentUser.uid, current);
        showAnnouncementModal(current, () => showNext(index + 1));
      };

      showNext(0);
    } catch (error) {
      console.warn("Nao foi possivel carregar o aviso global:", error);
    }
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

  function normalizeContractType(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function isVisitorRid(rid) {
    return normalizeContractType(rid?.contractType) === "VISITANTE";
  }

  function getSectorNameForBoard(rid) {
    const allowedSectors = new Set(["ADM", "M. MOVEL", "M. FIXA", "M. ELÉTRICA", "PRODUÇÃO", "MINA"]);
    const rawSector = String(rid?.sector || "").trim();
    const normalizedSector = rawSector
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

    const sectorMap = {
      "ADM": "ADM",
      "M. MOVEL": "M. MOVEL",
      "M. FIXA": "M. FIXA",
      "M. ELETRICA": "M. ELÉTRICA",
      "PRODUCAO": "PRODUÇÃO",
      "MINA": "MINA"
    };

    const mappedSector = sectorMap[normalizedSector] || "";
    if (mappedSector && allowedSectors.has(mappedSector)) return mappedSector;
    if (isVisitorRid(rid)) return "ADM";
    return "ADM";
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

  function ensureLiveRidNotificationRoot() {
    return null;
  }

  function playRidNotificationSound() {
    return;
  }

  function unlockRidNotificationSound() {
    state.notificationAudioUnlocked = true;
  }

  function bindNotificationAudioUnlock() {
    state.notificationAudioUnlocked = true;
  }

  function showLiveRidNotification(rid) {
    return;
  }

  function processLiveRidNotifications(snapshot) {
    state.hasLoadedRidsOnce = true;
  }

  function prepareGoalIntroAnimation() {
    state.shouldAnimateGoalIntro = true;
  }

  function canUsePushNotifications() {
    return !!(messaging && "Notification" in window && "serviceWorker" in navigator);
  }

  function describePushError(error) {
    const code = String(error?.code || "").trim();
    const message = String(error?.message || "").trim();
    const details = `${code} ${message}`.toLowerCase();

    if (Notification.permission === "denied" || details.includes("permission-blocked")) {
      return "As notificacoes do navegador estao bloqueadas para este site.";
    }

    if (details.includes("unsupported-browser")) {
      return "Este navegador nao oferece suporte completo para push com o Firebase.";
    }

    if (details.includes("service worker") || details.includes("sw.js") || details.includes("failed-service-worker-registration")) {
      return "O service worker de notificacoes nao conseguiu iniciar corretamente.";
    }

    if (details.includes("token-subscribe-failed") || details.includes("push service")) {
      return "O navegador nao conseguiu criar a inscricao push deste dispositivo.";
    }

    if (details.includes("insufficient permissions") || details.includes("missing or insufficient permissions")) {
      return "O token foi gerado, mas nao foi possivel salva-lo no Firebase.";
    }

    return "Nao foi possivel ativar as notificacoes push.";
  }

  async function ensurePushServiceWorkerRegistration() {
    if (!canUsePushNotifications()) return null;
    if (state.pushServiceWorkerRegistration) return state.pushServiceWorkerRegistration;
    await navigator.serviceWorker.register("./sw.js", {
      scope: "./",
      updateViaCache: "none"
    });
    state.pushServiceWorkerRegistration = await navigator.serviceWorker.ready;
    return state.pushServiceWorkerRegistration;
  }

  function removePushPermissionPrompt() {
    document.getElementById("pushPermissionPrompt")?.remove();
  }

  function showPushStatusCard(message, tone = "info") {
    return;
  }

  function showPushPermissionPrompt() {
    if (!canUsePushNotifications() || !isPrivilegedUser()) return;
    if (Notification.permission !== "default") return;
    if (state.pushPromptDismissed) return;
    if (document.getElementById("pushPermissionPrompt")) return;

    const card = document.createElement("div");
    card.id = "pushPermissionPrompt";
    card.style.position = "fixed";
    card.style.right = "20px";
    card.style.bottom = "20px";
    card.style.zIndex = "1200";
    card.style.maxWidth = "360px";
    card.style.width = "calc(100vw - 32px)";
    card.style.border = "1px solid #dbeafe";
    card.style.background = "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)";
    card.style.borderRadius = "22px";
    card.style.padding = "18px";
    card.style.boxShadow = "0 18px 38px rgba(15, 23, 42, 0.14)";
    card.innerHTML = `
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;">Ativar avisos com site fechado</div>
      <div style="font-size:14px;color:#0f172a;margin-top:8px;line-height:1.5;">Permita notificacoes do navegador para receber alerta de RID nova mesmo com a aba fechada.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button type="button" id="enablePushNotificationsButton" style="border:0;background:#111827;color:#fff;border-radius:14px;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;">Ativar notificacoes</button>
        <button type="button" id="dismissPushNotificationsButton" style="border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:14px;padding:10px 14px;font-size:13px;font-weight:600;cursor:pointer;">Agora nao</button>
      </div>
    `;
    document.body.appendChild(card);

    card.querySelector("#enablePushNotificationsButton")?.addEventListener("click", async () => {
      await requestAndStorePushPermission();
    });
    card.querySelector("#dismissPushNotificationsButton")?.addEventListener("click", () => {
      state.pushPromptDismissed = true;
      removePushPermissionPrompt();
    });
  }

  async function syncPushToken() {
    if (!canUsePushNotifications() || !isPrivilegedUser()) return null;
    const registration = await ensurePushServiceWorkerRegistration();
    if (!registration) return null;
    if (!WEB_PUSH_VAPID_KEY) {
      throw new Error("WEB_PUSH_VAPID_KEY ausente");
    }

    const token = await messaging.getToken({
      vapidKey: WEB_PUSH_VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) return null;

    state.pushToken = token;
    await db.collection("notificationTokens").doc(token).set({
      token,
      uid: state.currentUser?.uid || null,
      userName: state.currentUserData?.name || "",
      isAdmin: isAdminUser(state.currentUserData),
      isDeveloper: isDeveloperUser(state.currentUserData),
      platform: "web",
      page: "dashboard",
      serviceWorkerScope: registration.scope || "",
      userAgent: navigator.userAgent,
      enabled: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return token;
  }

  async function requestAndStorePushPermission() {
    if (!canUsePushNotifications() || !isPrivilegedUser()) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") state.pushPromptDismissed = true;
        removePushPermissionPrompt();
        showPushStatusCard("As notificacoes do navegador nao foram liberadas.");
        return;
      }

      await syncPushToken();
      removePushPermissionPrompt();
      showPushStatusCard("Notificacoes ativadas neste navegador.", "success");
    } catch (error) {
      console.error("Falha ao ativar notificacoes push:", error);
      showPushStatusCard(describePushError(error));
    }
  }

  function subscribeForegroundPushMessages() {
    if (!messaging || state.pushMessagingBound) return;
    state.pushMessagingBound = true;
  }

  async function initializePushNotifications() {
    if (!canUsePushNotifications() || !isPrivilegedUser()) return;
    subscribeForegroundPushMessages();

    try {
      await ensurePushServiceWorkerRegistration();
    } catch (error) {
      console.error("Falha ao registrar o service worker de push:", error);
      return;
    }

    if (Notification.permission === "granted") {
      try {
        await syncPushToken();
      } catch (error) {
        console.error("Falha ao sincronizar token push existente:", error);
      }
      removePushPermissionPrompt();
      return;
    }

    showPushPermissionPrompt();
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.length ? parts.map((part) => part.charAt(0).toUpperCase()).join("") : "PG";
  }

  function resetFiltersToCurrentMonth() {
    const now = new Date();
    dom.dashboardMonth.value = String(now.getMonth() + 1);
    dom.dashboardYear.value = String(now.getFullYear());
    dom.dashboardSector.value = "";
  }

  function closeFiltersPanel() {
    dom.filtersPanel.classList.remove("visible");
  }

  function getSelectedPeriod() {
    const now = new Date();
    const monthRaw = dom.dashboardMonth.value || "";
    return {
      showAllMonths: monthRaw === "all",
      month: monthRaw && monthRaw !== "all" ? Number(monthRaw) : now.getMonth() + 1,
      year: Number(dom.dashboardYear.value) || now.getFullYear(),
      sector: dom.dashboardSector.value || ""
    };
  }

  function matchesSelectedPeriod(date, period) {
    if (!date) return false;
    if (period.showAllMonths) return date.getFullYear() === period.year;
    return date.getFullYear() === period.year && date.getMonth() + 1 === period.month;
  }

  function isBeforeMonthYear(date, month, year) {
    if (!date) return false;
    const dateMonth = date.getMonth() + 1;
    const dateYear = date.getFullYear();
    return dateYear < year || (dateYear === year && dateMonth < month);
  }

  function daysInMonthLocal(year, month1to12) {
    return new Date(year, month1to12, 0).getDate();
  }

  function countNonSundayDaysBetween(startDate, endDate) {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    let count = 0;

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      if (cursor.getDay() !== 0) count += 1;
    }

    return count;
  }

  function getRemainingGoalWorkdays(period) {
    if (period.showAllMonths) return 0;

    const now = new Date();
    const selectedMonth = Number(period.month);
    const selectedYear = Number(period.year);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth)) {
      return 0;
    }

    const monthEnd = new Date(selectedYear, selectedMonth, 0);
    const rangeStart = (selectedYear === currentYear && selectedMonth === currentMonth)
      ? now
      : new Date(selectedYear, selectedMonth - 1, 1);

    return countNonSundayDaysBetween(rangeStart, monthEnd);
  }

  function getUserMonthlyGoalBase(user) {
    if (isPrivilegedUser(user)) return 8;
    return 4;
  }

  function clampDate(date, min, max) {
    if (date < min) return min;
    if (date > max) return max;
    return date;
  }

  function countOverlapDaysLocal(aStart, aEnd, bStart, bEnd) {
    const start = clampDate(aStart, bStart, bEnd);
    const end = clampDate(aEnd, bStart, bEnd);
    if (end < start) return 0;

    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    return Math.floor((e - s) / 86400000) + 1;
  }

  function getGoalUsersForContext(users, sector) {
    return (users || []).filter((user) => {
      if (!user || typeof user.name !== "string") return false;
      if (sector && user.sector !== sector) return false;
      return true;
    });
  }

  function calcAutoMonthlyGoal(users, year, month1to12) {
    const totalDays = daysInMonthLocal(year, month1to12);
    const monthStart = new Date(year, month1to12 - 1, 1, 0, 0, 0);
    const monthEnd = new Date(year, month1to12 - 1, totalDays, 23, 59, 59);

    let raw = 0;
    let empEff = 0;
    let leaderEff = 0;
    let discount = 0;

    (users || []).forEach((user) => {
      const isLeader = isPrivilegedUser(user);
      const base = getUserMonthlyGoalBase(user);
      const vacation = user.vacationPeriod || null;
      const start = toDateSafe(vacation?.start);
      const end = toDateSafe(vacation?.end);

      let overlap = 0;
      if (start && end) overlap = countOverlapDaysLocal(start, end, monthStart, monthEnd);

      const activeDays = Math.max(0, totalDays - overlap);
      const effective = base * (activeDays / totalDays);
      raw += effective;
      discount += (base - effective);
      if (isLeader) leaderEff += effective;
      else empEff += effective;
    });

    return {
      goal: Math.ceil(raw),
      discount,
      empEff,
      leaderEff
    };
  }

  async function loadMonthlyGoal(period) {
    if (period.showAllMonths) {
      state.monthlyGoal = null;
      state.monthlyGoalMeta = null;
      state.manualGoalValue = null;
      state.manualGoalMonthKey = null;
      return;
    }

    const monthYear = `${period.year}-${String(period.month).padStart(2, "0")}`;
    const meta = calcAutoMonthlyGoal(getGoalUsersForContext(state.allUsers, period.sector), period.year, period.month);
    state.monthlyGoal = meta.goal;
    state.monthlyGoalMeta = meta;

    if (!period.sector) {
      const goalDoc = await db.collection("goals").doc(monthYear).get();
      state.manualGoalValue = goalDoc.exists && Number(goalDoc.data()?.goal) > 0 ? Number(goalDoc.data().goal) : null;
      state.manualGoalMonthKey = monthYear;
      return;
    }

    state.manualGoalValue = null;
    state.manualGoalMonthKey = monthYear;
  }

  function getFilteredRids(period) {
    return state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => !isVisitorRid(rid))
      .filter((rid) => {
        if (period.sector && rid.sector !== period.sector) return false;
        const date = toDateSafe(rid.emissionDate) || toDateSafe(rid.createdAt);
        return matchesSelectedPeriod(date, period);
      });
  }

  function getWeekRids(period) {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5);
    weekEnd.setHours(23, 59, 59, 999);

    return state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => !isVisitorRid(rid))
      .filter((rid) => !period.sector || rid.sector === period.sector)
      .filter((rid) => {
        const createdAt = toDateSafe(rid.createdAt);
        return createdAt && createdAt >= weekStart && createdAt <= weekEnd;
      })
      .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0))
      .slice(0, 8);
  }

  function getEmployeesWithoutRids(period, filteredRids) {
    const emitters = new Set(filteredRids.map((rid) => rid.emitterId).filter(Boolean));
    const now = new Date();

    return state.allUsers
      .filter((user) => !period.sector || user.sector === period.sector)
      .filter((user) => !emitters.has(user.id))
      .map((user) => {
        const lastRid = state.allRids
          .filter((rid) => !rid.deleted && !isVisitorRid(rid) && rid.emitterId === user.id)
          .sort((a, b) => (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0) - (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0))[0];
        const lastDate = lastRid ? toDateSafe(lastRid.emissionDate || lastRid.createdAt) : null;
        const daysWithout = lastDate ? Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)) : null;
        return { name: user.name || "Funcionario", lastDate, daysWithout };
      })
      .sort((a, b) => {
        if ((b.daysWithout || -1) !== (a.daysWithout || -1)) {
          return (b.daysWithout || -1) - (a.daysWithout || -1);
        }
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      });
  }

  function getEmployeeRidCountsCurrentMonth(period) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthPeriod = {
      showAllMonths: false,
      month: currentMonth,
      year: currentYear,
      sector: period.sector || ""
    };

    return state.allUsers
      .filter((user) => !monthPeriod.sector || user.sector === monthPeriod.sector)
      .map((user) => {
        const userRidList = state.allRids
          .filter((rid) => !rid.deleted)
          .filter((rid) => !isVisitorRid(rid))
          .filter((rid) => {
            if (monthPeriod.sector && rid.sector !== monthPeriod.sector) return false;
            const ridDate = toDateSafe(rid.emissionDate) || toDateSafe(rid.createdAt);
            if (!matchesSelectedPeriod(ridDate, monthPeriod)) return false;

            const sameId = rid.emitterId && user.id && rid.emitterId === user.id;
            const sameCpf = rid.emitterCpf && user.cpf && String(rid.emitterCpf) === String(user.cpf);
            const sameName = rid.emitterName && user.name && String(rid.emitterName).trim() === String(user.name).trim();
            return sameId || sameCpf || sameName;
          });

        const lastRid = state.allRids
          .filter((rid) => !rid.deleted)
          .filter((rid) => !isVisitorRid(rid))
          .filter((rid) => {
            const sameId = rid.emitterId && user.id && rid.emitterId === user.id;
            const sameCpf = rid.emitterCpf && user.cpf && String(rid.emitterCpf) === String(user.cpf);
            const sameName = rid.emitterName && user.name && String(rid.emitterName).trim() === String(user.name).trim();
            return sameId || sameCpf || sameName;
          })
          .sort((a, b) => (toDateSafe(b.emissionDate || b.createdAt)?.getTime() || 0) - (toDateSafe(a.emissionDate || a.createdAt)?.getTime() || 0))[0];

        return {
          name: user.name || "Funcionario",
          sector: user.sector || "",
          count: userRidList.length,
          lastDate: lastRid ? toDateSafe(lastRid.emissionDate || lastRid.createdAt) : null
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      });
  }

  function getTopEmitterStreaks(topEmitters, period) {
    if (period.showAllMonths) {
      return new Map(topEmitters.map((item) => [item.name, 0]));
    }

    const streaks = new Map();
    const targets = new Map(topEmitters.map((item) => [item.name, item]));
    const maxMonthsBack = 12;

    targets.forEach((_, name) => {
      let streak = 0;

      for (let step = 0; step < maxMonthsBack; step += 1) {
        const date = new Date(period.year, period.month - 1 - step, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const monthRids = state.allRids
          .filter((rid) => !rid.deleted)
          .filter((rid) => !isVisitorRid(rid))
          .filter((rid) => !period.sector || rid.sector === period.sector)
          .filter((rid) => {
            const ridDate = toDateSafe(rid.emissionDate) || toDateSafe(rid.createdAt);
            return ridDate && ridDate.getMonth() + 1 === month && ridDate.getFullYear() === year;
          });

        const emittersMap = {};
        monthRids.forEach((rid) => {
          const emitterName = rid.emitterName || "Sem nome";
          if (!emittersMap[emitterName]) emittersMap[emitterName] = 0;
          emittersMap[emitterName] += 1;
        });

        const topNames = Object.entries(emittersMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([emitterName]) => emitterName);

        if (topNames.includes(name)) streak += 1;
        else break;
      }

      streaks.set(name, streak);
    });

    return streaks;
  }

  function computeDashboard() {
    const period = getSelectedPeriod();
    const filteredRids = getFilteredRids(period);
    const goalProgressRids = state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => {
        if (period.sector && rid.sector !== period.sector) return false;
        const date = toDateSafe(rid.emissionDate) || toDateSafe(rid.createdAt);
        return matchesSelectedPeriod(date, period);
      });

    const openRids = state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => {
        const status = normalizeStatus(rid.status);
        return status === "EM ANDAMENTO" || status === "PENDENTE";
      }).length;

    const overdueRids = filteredRids.filter((rid) => normalizeStatus(rid.status) === "VENCIDO").length;

    const correctedInMonthList = state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => !isVisitorRid(rid))
      .filter((rid) => {
        if (period.sector && rid.sector !== period.sector) return false;
        const status = normalizeStatus(rid.status);
        if (status !== "CORRIGIDO" && status !== "ENCERRADO") return false;
        return matchesSelectedPeriod(toDateSafe(rid.conclusionDate), period);
      });

    const correctedFromPreviousMonths = correctedInMonthList.filter((rid) => {
      return isBeforeMonthYear(toDateSafe(rid.createdAt), period.month, period.year);
    }).length;

    const lateRids = state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => !isVisitorRid(rid))
      .filter((rid) => {
        if (period.sector && rid.sector !== period.sector) return false;
        const emissionDate = toDateSafe(rid.emissionDate || rid.createdAt);
        if (!emissionDate || !isBeforeMonthYear(emissionDate, period.month, period.year)) return false;
        const status = normalizeStatus(rid.status);
        return status !== "CORRIGIDO" && status !== "ENCERRADO" && status !== "EXCLUIDO";
      }).length;

    const closedRids = state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => !isVisitorRid(rid))
      .filter((rid) => {
        if (period.sector && rid.sector !== period.sector) return false;
        return normalizeStatus(rid.status) === "ENCERRADO" && matchesSelectedPeriod(toDateSafe(rid.conclusionDate), period);
      }).length;

    const removedRids = state.allRids
      .filter((rid) => !isVisitorRid(rid))
      .filter((rid) => {
        if (period.sector && rid.sector !== period.sector) return false;
        const status = normalizeStatus(rid.status);
        return rid.deleted || status === "EXCLUIDO";
      })
      .filter((rid) => matchesSelectedPeriod(toDateSafe(rid.deletedAt), period)).length;

    const statusBase = state.allRids
      .filter((rid) => !rid.deleted)
      .filter((rid) => !isVisitorRid(rid))
      .filter((rid) => {
        if (period.sector && rid.sector !== period.sector) return false;
        return matchesSelectedPeriod(toDateSafe(rid.emissionDate) || toDateSafe(rid.createdAt), period);
      });

    const statusItems = [
      { label: "Em andamento", count: statusBase.filter((rid) => { const status = normalizeStatus(rid.status); return status === "EM ANDAMENTO" || status === "PENDENTE"; }).length, color: "#f97316" },
      { label: "Vencido", count: statusBase.filter((rid) => normalizeStatus(rid.status) === "VENCIDO").length, color: "#ef4444" },
      { label: "Corrigido", count: statusBase.filter((rid) => { const status = normalizeStatus(rid.status); return status === "CORRIGIDO" || status === "ENCERRADO"; }).length, color: "#22c55e" }
    ];

    const emittersMap = {};
    filteredRids.forEach((rid) => {
      const key = rid.emitterId || rid.emitterName || rid.id;
      if (!emittersMap[key]) emittersMap[key] = { name: rid.emitterName || "Sem nome", count: 0 };
      emittersMap[key].count += 1;
    });

    const topEmitters = Object.values(emittersMap).sort((a, b) => b.count - a.count).slice(0, 5);
    const topEmitterStreaks = getTopEmitterStreaks(topEmitters, period);

    const sectorMap = {};
    goalProgressRids.forEach((rid) => {
      const sector = getSectorNameForBoard(rid);
      sectorMap[sector] = (sectorMap[sector] || 0) + 1;
    });

    const sectors = Object.entries(sectorMap)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count);

    return {
      period,
      totalRids: filteredRids.length,
      openRids,
      overdueRids,
      correctedRids: correctedInMonthList.length,
      correctedFromPreviousMonths,
      lateRids,
      closedRids,
      removedRids,
      currentGoal: state.monthlyGoal,
      statusItems,
      topEmitters: topEmitters.map((item) => ({
        ...item,
        streak: topEmitterStreaks.get(item.name) || 0
      })),
      sectors,
      deleteRequests: getFilteredDeleteRequests(period),
      employeesWithoutRids: getEmployeesWithoutRids(period, filteredRids),
      employeeRidCountsCurrentMonth: getEmployeeRidCountsCurrentMonth(period),
      goalProgressCount: goalProgressRids.length,
      weeklyRids: getWeekRids(period)
    };
  }

  function renderPriorityInsights(data) {
    const topSector = data.sectors[0];
    const topEmitter = data.topEmitters[0];
    const goalGap = data.currentGoal && data.currentGoal > 0 ? Math.max(data.currentGoal - data.goalProgressCount, 0) : null;

    const cards = [
      {
        title: "RIDs vencidas",
        value: String(data.overdueRids),
        tone: "bg-red-50 text-red-700 border-red-100",
        copy: data.overdueRids > 0 ? "Precisam de tratativa imediata." : "Nenhuma RID vencida no recorte."
      },
      {
        title: "Atrasadas acumuladas",
        value: String(data.lateRids),
        tone: "bg-amber-50 text-amber-700 border-amber-100",
        copy: data.lateRids > 0 ? "Pendencias vindas de meses anteriores." : "Sem pendencias antigas abertas."
      },
      {
        title: "Meta mensal",
        value: data.currentGoal && data.currentGoal > 0 ? String(data.currentGoal) : "-",
        tone: "bg-sky-50 text-sky-700 border-sky-100",
        copy: goalGap == null ? "Meta indisponivel neste filtro." : (goalGap === 0 ? "Meta atingida no periodo." : `Faltam ${goalGap} RIDs para bater a meta.`)
      },
      {
        title: "Maior concentracao",
        value: topSector ? topSector.sector : "-",
        tone: "bg-violet-50 text-violet-700 border-violet-100",
        copy: topSector ? `${topSector.count} RIDs${topEmitter ? ` | Top emissor: ${topEmitter.name}` : ""}` : "Sem setor lider no periodo."
      }
    ];

    dom.priorityInsights.innerHTML = cards.map((card) => `
      <div class="rounded-2xl border p-4 ${card.tone}">
        <div class="text-[11px] font-semibold uppercase tracking-wider opacity-80">${escapeHtml(card.title)}</div>
        <div class="text-2xl font-bold mt-3">${escapeHtml(card.value)}</div>
        <div class="text-xs mt-3 opacity-80 leading-5">${escapeHtml(card.copy)}</div>
      </div>
    `).join("");
  }

  function getFilteredDeleteRequests(period) {
    return state.allDeleteRequests
      .filter((request) => request.requesterId === state.currentUser?.uid)
      .filter((request) => {
        const createdAt = toDateSafe(request.createdAt);
        return matchesSelectedPeriod(createdAt, period);
      })
      .filter((request) => {
        if (!period.sector) return true;
        const rid = state.allRids.find((item) => item.id === request.ridId);
        const requestSector = rid?.sector || request.sector || "";
        return requestSector === period.sector;
      })
      .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
  }

  function getDeleteRequestStatusMeta(status) {
    const normalized = String(status || "pending").trim().toLowerCase();
    if (normalized === "approved" || normalized === "aprovado") {
      return {
        label: "Aprovada",
        tone: "bg-green-50 text-green-700 border-green-100"
      };
    }
    if (normalized === "rejected" || normalized === "rejeitado") {
      return {
        label: "Rejeitada",
        tone: "bg-red-50 text-red-700 border-red-100"
      };
    }
    return {
      label: "Pendente",
      tone: "bg-amber-50 text-amber-700 border-amber-100"
    };
  }

  function findDeleteRequestById(requestId) {
    return state.allDeleteRequests.find((item) => item.id === requestId) || null;
  }

  function openDeleteRequestModal(requestId) {
    const item = findDeleteRequestById(requestId);
    if (!item) return;

    const status = getDeleteRequestStatusMeta(item.status);
    const rid = state.allRids.find((entry) => entry.id === item.ridId);
    const ridNumber = formatRidNumber(item.ridNumber || rid?.ridNumber || "");
    const emissionDate = rid?.emissionDate || rid?.createdAt || item.createdAt;
    const reviewedAt = item.reviewedAt || item.updatedAt || null;
    const rejectionReason = String(item.rejectionReason || item.rejectReason || item.rejection || "").trim();
    const description = String(item.ridDescription || rid?.description || "Descricao nao informada").trim();
    const reason = String(item.reason || "Motivo nao informado").trim();

    dom.deleteRequestModalTitle.textContent = `RID #${ridNumber}`;
    dom.deleteRequestModalBody.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap mb-5">
        <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}">${status.label}</span>
        <span class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">${escapeHtml(rid?.sector || item.sector || "Sem setor")}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data de emissao do RID</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(emissionDate))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data da solicitacao</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(formatDate(item.createdAt))}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Descricao do RID</div>
          <div class="text-sm text-gray-700 mt-2 leading-6">${escapeHtml(description)}</div>
        </div>
        <div class="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-4 md:col-span-2">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-orange-500">Motivo da solicitacao de remocao</div>
          <div class="text-sm text-orange-800 mt-2 leading-6">${escapeHtml(reason)}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Status atual</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${status.label}</div>
        </div>
        <div class="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">${status.label === "Pendente" ? "Ultima atualizacao" : "Data da decisao"}</div>
          <div class="text-sm font-semibold text-gray-900 mt-2">${escapeHtml(reviewedAt ? formatDate(reviewedAt) : "Ainda nao analisada")}</div>
        </div>
        ${rejectionReason ? `
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 md:col-span-2">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-red-500">Motivo da rejeicao</div>
            <div class="text-sm text-red-800 mt-2 leading-6">${escapeHtml(rejectionReason)}</div>
          </div>
        ` : ""}
      </div>
    `;

    dom.deleteRequestModal.classList.add("visible");
  }

  function closeDeleteRequestModal() {
    dom.deleteRequestModal.classList.remove("visible");
  }

  function openManualGoalModal() {
    if (!state.currentUserData?.isDeveloper) return;
    const period = getSelectedPeriod();
    if (period.showAllMonths || period.sector) return;
    dom.manualGoalFeedback.classList.add("hidden-state");
    dom.manualGoalFeedback.textContent = "";
    dom.manualGoalInput.value = state.manualGoalValue ? String(state.manualGoalValue) : "";
    dom.manualGoalModal.classList.add("visible");
  }

  function closeManualGoalModal() {
    dom.manualGoalModal.classList.remove("visible");
  }

  function renderDeleteRequestsBoard(items) {
    const pending = items.filter((item) => getDeleteRequestStatusMeta(item.status).label === "Pendente").length;
    const approved = items.filter((item) => getDeleteRequestStatusMeta(item.status).label === "Aprovada").length;
    const rejected = items.filter((item) => getDeleteRequestStatusMeta(item.status).label === "Rejeitada").length;

    dom.deleteRequestsCount.textContent = `${items.length} solicitac${items.length === 1 ? "ao" : "oes"}`;
    dom.deleteRequestsSummary.innerHTML = `
      <div class="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
        <div class="text-[11px] uppercase tracking-wider font-semibold text-amber-700">Pendentes</div>
        <div class="text-2xl font-bold text-amber-800 mt-2">${pending}</div>
        <div class="text-xs text-amber-700/80 mt-2">Aguardando analise do desenvolvedor.</div>
      </div>
      <div class="rounded-2xl border border-green-100 bg-green-50 px-4 py-4">
        <div class="text-[11px] uppercase tracking-wider font-semibold text-green-700">Aprovadas</div>
        <div class="text-2xl font-bold text-green-800 mt-2">${approved}</div>
        <div class="text-xs text-green-700/80 mt-2">Ja processadas e concluidas.</div>
      </div>
      <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
        <div class="text-[11px] uppercase tracking-wider font-semibold text-red-700">Rejeitadas</div>
        <div class="text-2xl font-bold text-red-800 mt-2">${rejected}</div>
        <div class="text-xs text-red-700/80 mt-2">Solicitacoes que voltaram com negativa.</div>
      </div>
    `;

    if (!items.length) {
      dom.deleteRequestsList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center col-span-full">
          <div class="text-sm font-medium text-gray-500">Nenhuma solicitacao de remocao no periodo.</div>
          <div class="text-xs text-gray-400 mt-2">Quando voce abrir uma solicitacao, ela aparecera aqui para acompanhamento.</div>
        </div>
      `;
      return;
    }

    dom.deleteRequestsList.innerHTML = items.map((item) => {
      const status = getDeleteRequestStatusMeta(item.status);
      const rid = state.allRids.find((entry) => entry.id === item.ridId);
      const ridSector = rid?.sector || item.sector || "Sem setor";
      const ridNumber = formatRidNumber(item.ridNumber || rid?.ridNumber || "");

      return `
        <button type="button" class="delete-request-card rounded-2xl border border-gray-100 bg-white p-4 text-left w-full" data-request-id="${escapeHtml(item.id)}">
          <div class="flex items-center justify-between gap-3">
            <span class="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">RID #${escapeHtml(ridNumber)}</span>
            <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.tone}">${status.label}</span>
          </div>
          <div class="mt-4">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Setor</div>
            <div class="text-sm font-semibold text-gray-900 mt-1">${escapeHtml(ridSector)}</div>
          </div>
          <div class="mt-4">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Data da solicitacao</div>
            <div class="text-sm text-gray-700 mt-1">${escapeHtml(formatDate(item.createdAt))}</div>
          </div>
          <div class="mt-4 text-[11px] text-gray-400">Clique para ver os detalhes</div>
        </button>
      `;
    }).join("");

    dom.deleteRequestsList.querySelectorAll("[data-request-id]").forEach((button) => {
      button.addEventListener("click", () => {
        openDeleteRequestModal(button.dataset.requestId);
      });
    });
  }

  function bindModalEvents() {
    dom.deleteRequestModalClose.addEventListener("click", closeDeleteRequestModal);
    dom.deleteRequestModal.addEventListener("click", (event) => {
      if (event.target === dom.deleteRequestModal) closeDeleteRequestModal();
    });
    dom.manualGoalModalClose.addEventListener("click", closeManualGoalModal);
    dom.manualGoalCancel.addEventListener("click", closeManualGoalModal);
    dom.manualGoalModal.addEventListener("click", (event) => {
      if (event.target === dom.manualGoalModal) closeManualGoalModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.deleteRequestModal.classList.contains("visible")) {
        closeDeleteRequestModal();
      }
      if (event.key === "Escape" && dom.manualGoalModal.classList.contains("visible")) {
        closeManualGoalModal();
      }
      if (event.key === "Escape" && dom.filtersPanel.classList.contains("visible")) {
        closeFiltersPanel();
      }
    });
  }

  function renderGoalPanel(data) {
    if (!state.monthlyGoal || state.monthlyGoal <= 0 || data.period.showAllMonths) {
      dom.statusGoalPanel.innerHTML = `
        <div class="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wider text-gray-400">Meta mensal</div>
              <div class="text-sm text-gray-500 mt-1">Selecione um mes especifico para visualizar a meta de RIDs.</div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500">
              <i data-lucide="target" style="width:16px;height:16px;"></i>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const currentCount = data.goalProgressCount;
    const goal = state.monthlyGoal;
    const remaining = Math.max(goal - currentCount, 0);
    const remainingWorkdays = getRemainingGoalWorkdays(data.period);
    const requiredPerDay = remaining > 0 && remainingWorkdays > 0
      ? (remaining / remainingWorkdays)
      : 0;
    const requiredPerDayLabel = remaining === 0
      ? "Meta atingida; nenhuma emissao diaria adicional e necessaria."
      : remainingWorkdays > 0
        ? `Voce precisa emitir ${requiredPerDay.toFixed(1).replace(".", ",")} RID${requiredPerDay >= 2 ? "s" : ""} por dia para bater a meta.`
        : "Nao ha mais dias uteis disponiveis no periodo para bater a meta.";
    const percentage = Math.min(Math.round((currentCount / goal) * 100), 999);
    const progressWidth = Math.max(6, Math.min((currentCount / goal) * 100, 100));
    const extra = state.monthlyGoalMeta
      ? `Desconto: ${Math.ceil(state.monthlyGoalMeta.discount || 0)}`
      : "Calculo automatico do mes";
    const manualGoalCopy = state.manualGoalValue && !data.period.sector
      ? `Meta manual registrada: ${state.manualGoalValue}`
      : "Nenhuma meta manual registrada";
    const canManageManualGoal = !!state.currentUserData?.isDeveloper && !data.period.showAllMonths && !data.period.sector;
    const manualButton = canManageManualGoal
      ? `<button type="button" id="openManualGoalButton" class="goal-manual-trigger inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">Definir meta manual</button>`
      : "";
    const hitGoal = currentCount >= goal;
    const introClass = state.shouldAnimateGoalIntro ? " goal-panel-intro" : "";
    const progressClass = state.shouldAnimateGoalIntro ? " goal-progress-fill-intro" : "";
    const celebrateClass = hitGoal ? " goal-panel-celebrating is-active" : "";
    const confettiHtml = (state.shouldAnimateGoalIntro || hitGoal)
      ? `
        <div class="goal-confetti" aria-hidden="true">
          <span class="goal-confetti-piece piece-a"></span>
          <span class="goal-confetti-piece piece-b"></span>
          <span class="goal-confetti-piece piece-c"></span>
          <span class="goal-confetti-piece piece-d"></span>
          <span class="goal-confetti-piece piece-e"></span>
          <span class="goal-confetti-piece piece-f"></span>
          <span class="goal-confetti-piece piece-g"></span>
          <span class="goal-confetti-piece piece-h"></span>
          <span class="goal-confetti-piece piece-i"></span>
          <span class="goal-confetti-piece piece-j"></span>
          <span class="goal-confetti-piece piece-k"></span>
          <span class="goal-confetti-piece piece-l"></span>
        </div>
      `
      : "";

    dom.statusGoalPanel.innerHTML = `
      <div id="goalPanelCard" class="rounded-2xl border border-gray-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4${introClass}${celebrateClass}">
        ${confettiHtml}
        <div class="goal-panel-content">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wider text-gray-400">Meta mensal de RIDs</div>
              <div class="flex items-end gap-2 mt-2">
                <div class="text-2xl font-bold text-gray-900">${currentCount}<span class="text-sm text-gray-400 font-medium">/${goal}</span></div>
                <span class="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">Meta automatica</span>
              </div>
              <div class="text-xs text-gray-500 mt-2">${currentCount >= goal ? "Meta atingida no periodo atual." : `Faltam ${remaining} RID${remaining !== 1 ? "s" : ""} para atingir a meta.`}</div>
              <div class="text-xs text-gray-500 mt-2">${requiredPerDayLabel}</div>
              ${state.manualGoalValue && !data.period.sector ? `<div class="text-xs text-gray-400 mt-2">${manualGoalCopy}</div>` : ""}
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold text-gray-900">${percentage}%</div>
              <div class="text-[11px] text-gray-400 mt-1">${extra}</div>
              <div class="mt-3">${manualButton}</div>
            </div>
          </div>
          <div class="mt-4">
            <div class="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div class="goal-progress-bar h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500${progressClass}" style="width:${progressWidth}%;--goal-progress-target:${progressWidth}%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const openManualGoalButton = document.getElementById("openManualGoalButton");
    if (openManualGoalButton) {
      openManualGoalButton.addEventListener("click", openManualGoalModal);
    }
    if (state.shouldAnimateGoalIntro && !hitGoal) {
      const goalPanelCard = document.getElementById("goalPanelCard");
      if (goalPanelCard) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            goalPanelCard.classList.add("is-active");
          });
        });
      }
    }
    state.shouldAnimateGoalIntro = false;
  }

  function renderStatusBoard(items) {
    const total = items.reduce((sum, item) => sum + item.count, 0);
    if (!total) {
      dom.statusBoard.innerHTML = '<div class="text-sm text-gray-400">Nenhum dado no periodo selecionado.</div>';
      return;
    }

    let current = 0;
    const segments = items.map((item) => {
      const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
      const start = current;
      const end = current + percent;
      current = end;
      return { ...item, percent, start, end };
    });

    const gradient = segments
      .map((item) => `${item.color} ${item.start}% ${item.end}%`)
      .join(", ");

    const cardsHtml = segments.map((item) => {
      return `
        <div class="status-metric">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <span class="status-swatch" style="background:${item.color};"></span>
                <span>${escapeHtml(item.label)}</span>
              </div>
              <div class="text-2xl font-bold text-gray-900 mt-2">${item.count}</div>
              <div class="text-xs text-gray-400 mt-1">RIDs no recorte atual</div>
            </div>
            <div class="rounded-full px-2.5 py-1 text-xs font-semibold" style="background:${item.color}15;color:${item.color};">${item.percent}%</div>
          </div>
          <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div class="h-full rounded-full" style="width:${item.percent}%;background:${item.color};"></div>
          </div>
        </div>
      `;
    }).join("");

    dom.statusBoard.innerHTML = `
      <div class="status-hero">
        <div class="status-ring" style="background: conic-gradient(${gradient});">
          <div class="status-ring-center">
            <div class="text-4xl font-bold text-gray-900 leading-none">${total}</div>
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mt-2">RIDs no periodo</div>
          </div>
        </div>
        <div class="status-grid">
          ${cardsHtml}
        </div>
      </div>
      <div class="rounded-2xl border border-gray-100 bg-gray-50 p-3 mt-3">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Distribuicao geral</div>
        <div class="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white">
          ${segments.map((item) => {
            const width = total > 0 ? Math.max((item.count / total) * 100, item.count > 0 ? 4 : 0) : 0;
            return `<div class="h-full flex-shrink-0" style="width:${width}%;background:${item.color};"></div>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderSectorBoard(items) {
    if (!items.length) {
      dom.sectorBoard.innerHTML = '<div class="text-sm text-gray-400">Nenhum setor encontrado para esse recorte.</div>';
      return;
    }

    const sectorPalette = {
      "ADM": "#22d3ee",
      "PRODUÇÃO": "#1d4ed8",
      "M. FIXA": "#a855f7",
      "MINA": "#94a3b8",
      "M. ELÉTRICA": "#f59e0b",
      "M. MOVEL": "#14b8a6"
    };
    const fallbackPalette = ["#22d3ee", "#1d4ed8", "#4f46e5", "#94a3b8", "#f59e0b", "#14b8a6", "#ec4899"];
    const total = items.reduce((sum, item) => sum + item.count, 0);
    const radius = 77;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    const segments = items.map((item, index) => {
      const percent = total > 0 ? (item.count / total) * 100 : 0;
      const length = (percent / 100) * circumference;
      const segment = {
        ...item,
        percent,
        color: sectorPalette[item.sector] || fallbackPalette[index % fallbackPalette.length],
        dasharray: `${length} ${circumference - length}`,
        dashoffset: -offset
      };
      offset += length;
      return segment;
    });

    dom.sectorBoard.innerHTML = `
      <div class="sector-layout">
        <div class="sector-main">
          <div class="sector-donut-wrap">
            <div class="sector-donut">
              <svg class="sector-donut-svg" viewBox="0 0 190 190" aria-label="Grafico de setores">
                <circle cx="95" cy="95" r="${radius}" fill="none" stroke="#eef2f7" stroke-width="14"></circle>
                ${segments.map((item, index) => `
                  <circle
                    class="sector-segment"
                    data-sector-index="${index}"
                    cx="95"
                    cy="95"
                    r="${radius}"
                    stroke="${item.color}"
                    stroke-width="14"
                    stroke-dasharray="${item.dasharray}"
                    stroke-dashoffset="${item.dashoffset}"
                  ></circle>
                `).join("")}
              </svg>
              <div class="sector-donut-center">
                <div id="sectorDonutValue" class="sector-donut-center-value">${total}</div>
                <div id="sectorDonutLabel" class="sector-donut-center-label">Rids do mes</div>
                <div id="sectorDonutMeta" class="sector-donut-center-meta">Passe o mouse</div>
              </div>
            </div>
          </div>
          <div class="sector-legend">
            ${segments.map((item, index) => `
              <div class="sector-legend-item" data-sector-legend-index="${index}">
                <span class="sector-legend-dot" style="background:${item.color};"></span>
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(item.sector)}</div>
                  <div class="text-xs text-gray-400">${item.count} RIDs (${Math.round(item.percent)}%)</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="sector-side">
          <div class="sector-summary">
            ${segments.slice(0, 3).map((item, index) => `
              <div class="sector-summary-card">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="sector-summary-rank" style="background:${item.color};">${index + 1}</span>
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(item.sector)}</div>
                      <div class="text-xs text-gray-400 mt-1">${item.count} RIDs no recorte</div>
                    </div>
                  </div>
                  <div class="text-sm font-semibold" style="color:${item.color};">${Math.round(item.percent)}%</div>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="sector-insight">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Insight rapido</div>
            <div class="text-sm text-gray-700 mt-2">
              ${segments[0]
                ? `${escapeHtml(segments[0].sector)} lidera o mes com ${segments[0].count} RIDs e ${Math.round(segments[0].percent)}% de participacao.`
                : "Sem dados suficientes para gerar insight."}
            </div>
          </div>
        </div>
      </div>
    `;

    bindSectorBoardInteractions(segments, total);
  }

  function bindSectorBoardInteractions(segments, total) {
    const valueEl = document.getElementById("sectorDonutValue");
    const labelEl = document.getElementById("sectorDonutLabel");
    const metaEl = document.getElementById("sectorDonutMeta");
    const segmentEls = Array.from(document.querySelectorAll(".sector-segment"));
    const legendEls = Array.from(document.querySelectorAll("[data-sector-legend-index]"));

    function resetCenter() {
      valueEl.textContent = String(total);
      labelEl.textContent = "Rids do mes";
      metaEl.textContent = "Passe o mouse";
      segmentEls.forEach((el) => {
        el.classList.remove("is-active", "is-dimmed");
      });
    }

    function activate(index) {
      const data = segments[index];
      if (!data) return;

      valueEl.textContent = `${Math.round(data.percent)}%`;
      labelEl.textContent = data.sector;
      metaEl.textContent = `${data.count} RIDs neste setor`;

      segmentEls.forEach((el, currentIndex) => {
        el.classList.toggle("is-active", currentIndex === index);
        el.classList.toggle("is-dimmed", currentIndex !== index);
      });
    }

    segmentEls.forEach((el) => {
      const index = Number(el.dataset.sectorIndex);
      el.addEventListener("mouseenter", () => activate(index));
      el.addEventListener("mouseleave", resetCenter);
    });

    legendEls.forEach((el) => {
      const index = Number(el.dataset.sectorLegendIndex);
      el.addEventListener("mouseenter", () => activate(index));
      el.addEventListener("mouseleave", resetCenter);
    });
  }

  function renderTopEmitters(items) {
    if (!items.length) {
      dom.topEmittersSummary.innerHTML = "";
      dom.topEmittersList.innerHTML = '<p class="text-sm text-gray-400">Nenhum emissor encontrado.</p>';
      return;
    }

    const topThree = items.slice(0, 3);
    const medals = [
      { icon: "🥇", bg: "#fef3c7", color: "#b45309", label: "Ouro" },
      { icon: "🥈", bg: "#e5e7eb", color: "#4b5563", label: "Prata" },
      { icon: "🥉", bg: "#fde2d0", color: "#9a3412", label: "Bronze" }
    ];

    const totalTop = topThree.reduce((sum, item) => sum + item.count, 0);
    const leaderGap = topThree[0] && topThree[1] ? topThree[0].count - topThree[1].count : topThree[0]?.count || 0;

    dom.topEmittersSummary.innerHTML = `
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Top 3</div>
          <div class="text-lg font-bold text-gray-900 mt-1">${totalTop}</div>
          <div class="text-[11px] text-gray-500 mt-1">RIDs somados</div>
        </div>
        <div class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Liderando</div>
          <div class="text-sm font-bold text-gray-900 mt-1 truncate">${escapeHtml(topThree[0]?.name || "-")}</div>
          <div class="text-[11px] text-gray-500 mt-1">Maior emissor do periodo</div>
        </div>
        <div class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Vantagem</div>
          <div class="text-lg font-bold text-gray-900 mt-1">${leaderGap}</div>
          <div class="text-[11px] text-gray-500 mt-1">RIDs acima do 2º lugar</div>
        </div>
      </div>
    `;

    dom.topEmittersList.innerHTML = topThree.map((item, index) => `
      <div class="flex flex-col gap-3 rounded-xl border border-gray-100 px-3 py-3 bg-white sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style="background:${medals[index].bg};color:${medals[index].color};">${medals[index].icon}</div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900 break-words">${escapeHtml(item.name)}</p>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style="background:${medals[index].bg};color:${medals[index].color};">${medals[index].label}</span>
            </div>
            <p class="text-[11px] text-gray-500 mt-1">${
              item.streak >= 3
                ? `${item.streak}º mes consecutivo no Top 3`
                : item.streak === 2
                  ? "2º mes consecutivo no Top 3"
                  : item.streak === 1
                    ? "Entrou no Top 3 neste mes"
                    : "Destaque no periodo"
            }</p>
          </div>
        </div>
        <div class="flex-shrink-0 sm:pl-3 sm:text-right">
          <div class="text-xl font-bold text-gray-900 leading-none">${item.count}</div>
          <div class="text-[10px] uppercase tracking-wider text-gray-400 mt-1">RIDs</div>
        </div>
      </div>
    `).join("");
  }

  function renderEmployeesWithoutRids(items) {
    if (!items.length) {
      dom.employeesWithoutRidsList.innerHTML = '<p class="text-sm text-gray-400">Nenhum funcionario encontrado para este recorte.</p>';
      return;
    }

    dom.employeesWithoutRidsList.innerHTML = items.map((item) => `
      <div class="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${item.count > 0 ? "border-emerald-100 bg-emerald-50/60" : "border-red-100 bg-red-50/60"}">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}">${item.count > 0 ? "Com RID" : "Sem RID"}</span>
            <p class="text-sm font-medium text-gray-900 break-words">${escapeHtml(item.name)}</p>
          </div>
          <p class="text-xs text-gray-500 mt-1">${item.lastDate ? `Ultimo RID em ${escapeHtml(formatDate(item.lastDate))}` : "Nenhum RID emitido"}</p>
        </div>
        <div class="text-left sm:text-right">
          <div class="text-xl font-bold text-gray-900 leading-none">${item.count}</div>
          <div class="text-[10px] uppercase tracking-wider text-gray-400 mt-1">RIDs no mes atual</div>
        </div>
      </div>
    `).join("");
  }

  function renderWeeklyRids(items) {
    dom.weekRidCount.textContent = `${items.length} itens`;
    if (!items.length) {
      dom.weeklyRidsList.innerHTML = '<div class="text-center py-8"><p class="text-sm text-gray-400 font-medium">Nenhuma RID nesta semana</p><p class="text-xs text-gray-300 mt-1">As novas emissoes aparecerao aqui</p></div>';
      return;
    }

    dom.weeklyRidsList.innerHTML = items.map((rid) => `
      <div class="flex flex-col gap-4 border border-gray-100 rounded-xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="flex items-center gap-3 mb-2 flex-wrap">
            <span class="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-gray-900">RID #${escapeHtml(formatRidNumber(rid.ridNumber))}</span>
            <span class="text-xs text-gray-400">${escapeHtml(rid.sector || "Sem setor")}</span>
          </div>
          <p class="text-sm font-medium text-gray-900 break-words">${escapeHtml(rid.emitterName || "Sem emissor")}</p>
          <p class="text-xs text-gray-400 mt-1">${escapeHtml((rid.description || "Sem descricao").slice(0, 90))}</p>
        </div>
        <div class="sm:text-right">
          <p class="text-sm font-semibold text-gray-700">${escapeHtml(rid.status || "PENDENTE")}</p>
          <p class="text-xs text-gray-400 mt-1">${escapeHtml(formatDate(rid.createdAt || rid.emissionDate))}</p>
        </div>
      </div>
    `).join("");
  }

  function populateSectorFilter() {
    const selected = dom.dashboardSector.value;
    const sectors = Array.from(new Set(state.allUsers.map((user) => String(user?.sector || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    dom.dashboardSector.innerHTML = '<option value="">Todos os setores</option>' +
      sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`).join("");

    if (sectors.includes(selected)) dom.dashboardSector.value = selected;
  }

  async function renderDashboard() {
    const data = computeDashboard();
    await loadMonthlyGoal(data.period);
    dom.statTotalRids.textContent = String(data.totalRids);
    dom.statOpenRids.textContent = String(data.openRids);
    dom.statOverdueRids.textContent = String(data.overdueRids);
    dom.statCorrectedRids.textContent = String(data.correctedRids);
    dom.statLateRids.textContent = String(data.lateRids);
    dom.statClosedRids.textContent = String(data.closedRids);
    dom.statRemovedRids.textContent = String(data.removedRids);
    dom.statCorrectedDetail.textContent = data.correctedFromPreviousMonths > 0
      ? `${data.correctedFromPreviousMonths} eram atrasadas e foram resolvidas agora`
      : "Correcao no periodo selecionado";
    renderGoalPanel(data);
    renderStatusBoard(data.statusItems);
    renderSectorBoard(data.sectors);
    renderTopEmitters(data.topEmitters);
    renderEmployeesWithoutRids(data.employeeRidCountsCurrentMonth);
    renderDeleteRequestsBoard(data.deleteRequests);
    renderWeeklyRids(data.weeklyRids);
    lucide.createIcons();
  }

  function showLogin() {
    dom.bootOverlay.classList.add("hidden-state");
    dom.authOverlay.classList.add("visible");
    dom.dashboardShell.classList.add("hidden-state");
    dom.loginFeedback.classList.add("hidden-state");
  }

  function showDashboard() {
    dom.bootOverlay.classList.add("hidden-state");
    dom.authOverlay.classList.remove("visible");
    dom.dashboardShell.classList.remove("hidden-state");
    updateAdminNavigation();
    prepareGoalIntroAnimation();
    resetFiltersToCurrentMonth();
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "gestor"}`;
    populateSectorFilter();
    void renderDashboard();
    void maybeShowGlobalAnnouncement();
    void initializePushNotifications();
    lucide.createIcons();
  }

  async function loadUsers() {
    const snapshot = await db.collection("users").get();
    state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  function listenRids() {
    if (typeof state.unsubRids === "function") state.unsubRids();
    state.hasLoadedRidsOnce = false;
    state.unsubRids = db.collection("rids").onSnapshot((snapshot) => {
      processLiveRidNotifications(snapshot);
      state.allRids = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (isPrivilegedUser()) void renderDashboard();
    });
  }

  function listenDeleteRequests() {
    if (typeof state.unsubDeleteRequests === "function") state.unsubDeleteRequests();
    if (!state.currentUser?.uid) return;

    state.unsubDeleteRequests = db.collection("deleteRequests")
      .where("requesterId", "==", state.currentUser.uid)
      .onSnapshot((snapshot) => {
        state.allDeleteRequests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (isPrivilegedUser()) void renderDashboard();
      }, () => {
        state.allDeleteRequests = [];
        if (isPrivilegedUser()) void renderDashboard();
      });
  }

  function bindEvents() {
    bindNotificationAudioUnlock();

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
      closeFiltersPanel();
      void renderDashboard();
    });

    dom.clearFiltersButton.addEventListener("click", () => {
      resetFiltersToCurrentMonth();
      closeFiltersPanel();
      void renderDashboard();
    });

    dom.logoutButton.addEventListener("click", async () => {
      await auth.signOut();
    });

    dom.manualGoalForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.currentUserData?.isDeveloper) return;

      const period = getSelectedPeriod();
      if (period.showAllMonths || period.sector) {
        dom.manualGoalFeedback.textContent = "A meta manual so pode ser registrada para um mes especifico sem filtro de setor.";
        dom.manualGoalFeedback.classList.remove("hidden-state");
        return;
      }

      const goalValue = Number(dom.manualGoalInput.value);
      if (!Number.isFinite(goalValue) || goalValue <= 0) {
        dom.manualGoalFeedback.textContent = "Informe um valor valido para a meta.";
        dom.manualGoalFeedback.classList.remove("hidden-state");
        return;
      }

      const monthYear = `${period.year}-${String(period.month).padStart(2, "0")}`;
      dom.manualGoalFeedback.classList.add("hidden-state");
      dom.manualGoalSubmit.disabled = true;
      dom.manualGoalSubmit.textContent = "Salvando...";

      try {
        await db.collection("goals").doc(monthYear).set({
          goal: Math.round(goalValue),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: {
            uid: state.currentUser.uid,
            name: state.currentUserData?.name || "DEV"
          }
        }, { merge: true });

        state.manualGoalValue = Math.round(goalValue);
        state.manualGoalMonthKey = monthYear;
        closeManualGoalModal();
        await renderDashboard();
      } catch (error) {
        dom.manualGoalFeedback.textContent = "Nao foi possivel salvar a meta manual.";
        dom.manualGoalFeedback.classList.remove("hidden-state");
      } finally {
        dom.manualGoalSubmit.disabled = false;
        dom.manualGoalSubmit.textContent = "Salvar meta";
      }
    });

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (event) => {
        const href = item.getAttribute("href");
        if (href && href !== "#") return;
        event.preventDefault();
        document.querySelectorAll(".nav-item").forEach((nav) => {
          nav.classList.remove("active", "font-medium", "text-gray-900");
          nav.classList.add("text-gray-500");
        });
        item.classList.add("active", "font-medium", "text-gray-900");
        item.classList.remove("text-gray-500");
      });
    });

    document.addEventListener("click", (event) => {
      if (!dom.filtersPanel.contains(event.target) && !dom.toggleFiltersButton.contains(event.target)) {
        closeFiltersPanel();
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      removeAnnouncementModal();
      state.currentUserData = null;
      state.allUsers = [];
      state.allRids = [];
      state.allDeleteRequests = [];
      if (typeof state.unsubRids === "function") state.unsubRids();
      if (typeof state.unsubDeleteRequests === "function") state.unsubDeleteRequests();
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
    listenDeleteRequests();
    showDashboard();
  });

  bindEvents();
  bindModalEvents();
  resetFiltersToCurrentMonth();
  lucide.createIcons();
})();
