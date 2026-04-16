(function () {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof firebase === "undefined") return;

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
  const db = firebase.firestore();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const CRITICAL_DAYS = 60;
  const RID_NOTIFICATION_STORAGE_KEY = "ridNotificationOpenId";

  const state = {
    currentUser: null,
    currentUserData: null,
    criticalRids: [],
    modalOpen: false,
    unsubscribeCriticalRids: null
  };

  const dom = {
    root: null,
    button: null,
    badge: null,
    modal: null,
    backdrop: null,
    list: null,
    empty: null,
    count: null
  };

  function injectStyles() {
    if (document.getElementById("rid-notifications-styles")) return;
    const style = document.createElement("style");
    style.id = "rid-notifications-styles";
    style.textContent = `
      .rid-notification-anchor {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 12px;
      }
      .rid-notification-button {
        position: relative;
        width: 46px;
        height: 46px;
        border-radius: 16px;
        border: 1px solid rgba(226, 232, 240, 0.98);
        background: rgba(255, 255, 255, 0.96);
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        cursor: pointer;
      }
      .rid-notification-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
        border-color: rgba(148, 163, 184, 0.9);
      }
      .rid-notification-button.has-alerts {
        animation: ridNotificationPulse 1.8s ease-in-out infinite;
        border-color: rgba(248, 113, 113, 0.48);
      }
      .rid-notification-icon {
        width: 20px;
        height: 20px;
        display: block;
      }
      .rid-notification-badge {
        position: absolute;
        top: -6px;
        right: -5px;
        min-width: 20px;
        height: 20px;
        border-radius: 999px;
        padding: 0 6px;
        background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 18px rgba(239, 68, 68, 0.28);
      }
      .rid-notification-badge.hidden-state {
        display: none;
      }
      .rid-notification-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.26);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 1200;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.18s ease;
      }
      .rid-notification-backdrop.visible {
        opacity: 1;
        pointer-events: auto;
      }
      .rid-notification-modal {
        position: fixed;
        top: 84px;
        right: 32px;
        width: min(420px, calc(100vw - 32px));
        max-height: min(72vh, 620px);
        display: flex;
        flex-direction: column;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(226, 232, 240, 0.98);
        box-shadow: 0 26px 60px rgba(15, 23, 42, 0.18);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        z-index: 1201;
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease;
        overflow: hidden;
      }
      .rid-notification-modal.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      .rid-notification-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 18px 14px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.88);
      }
      .rid-notification-modal-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: #0f172a;
      }
      .rid-notification-modal-subtitle {
        margin: 4px 0 0;
        font-size: 0.82rem;
        color: #64748b;
        line-height: 1.45;
      }
      .rid-notification-modal-close {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        border: 1px solid rgba(226, 232, 240, 0.98);
        background: #fff;
        color: #475569;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
      }
      .rid-notification-modal-body {
        padding: 16px 18px 18px;
        overflow-y: auto;
      }
      .rid-notification-empty {
        border: 1px dashed rgba(203, 213, 225, 0.92);
        border-radius: 18px;
        padding: 18px;
        color: #64748b;
        font-size: 0.92rem;
        line-height: 1.55;
        background: rgba(248, 250, 252, 0.82);
      }
      .rid-notification-list {
        display: grid;
        gap: 10px;
      }
      .rid-notification-item {
        width: 100%;
        text-align: left;
        border: 1px solid rgba(226, 232, 240, 0.98);
        border-radius: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        padding: 14px;
        cursor: pointer;
        transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
      }
      .rid-notification-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
        border-color: rgba(248, 113, 113, 0.38);
      }
      .rid-notification-item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .rid-notification-item-title {
        font-size: 0.96rem;
        font-weight: 700;
        color: #0f172a;
      }
      .rid-notification-item-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .rid-notification-item-pill.vencido {
        background: rgba(254, 226, 226, 0.98);
        color: #b91c1c;
      }
      .rid-notification-item-pill.andamento {
        background: rgba(255, 237, 213, 0.98);
        color: #c2410c;
      }
      .rid-notification-item-meta {
        margin-top: 8px;
        font-size: 0.85rem;
        color: #475569;
        line-height: 1.55;
      }
      .rid-notification-item-foot {
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 0.76rem;
        color: #94a3b8;
      }
      .rid-notification-item-link {
        color: #0f172a;
        font-weight: 700;
      }
      .rid-global-actions {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-left: auto;
      }
      @keyframes ridNotificationPulse {
        0% {
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08), 0 0 0 0 rgba(248, 113, 113, 0.08);
          filter: drop-shadow(0 0 0 rgba(248, 113, 113, 0));
        }
        50% {
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12), 0 0 0 10px rgba(248, 113, 113, 0.06);
          filter: drop-shadow(0 0 16px rgba(248, 113, 113, 0.26));
        }
        100% {
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08), 0 0 0 0 rgba(248, 113, 113, 0.08);
          filter: drop-shadow(0 0 0 rgba(248, 113, 113, 0));
        }
      }
      @media (max-width: 920px) {
        .rid-notification-modal {
          top: 72px;
          right: 16px;
          width: min(420px, calc(100vw - 20px));
        }
      }
      @media (max-width: 640px) {
        .rid-global-actions {
          width: 100%;
          justify-content: flex-end;
          margin-top: 12px;
        }
        .rid-notification-anchor {
          margin-left: 0;
        }
        .rid-notification-modal {
          top: 64px;
          right: 10px;
          left: 10px;
          width: auto;
          max-height: min(76vh, 620px);
        }
      }
    `;
    document.head.appendChild(style);
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

  function getRidAgeDays(rid) {
    const baseDate = toDateSafe(rid?.emissionDate) || toDateSafe(rid?.createdAt);
    if (!baseDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - base.getTime()) / ONE_DAY_MS);
  }

  function formatRidNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits ? digits.padStart(5, "0") : "-----";
  }

  function formatStatusLabel(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "VENCIDO") return "VENCIDO";
    return "EM ANDAMENTO";
  }

  function formatStatusTone(status) {
    return normalizeStatus(status) === "VENCIDO" ? "vencido" : "andamento";
  }

  function isCriticalAssignedRid(rid) {
    if (!state.currentUser?.uid || !rid || rid.deleted) return false;
    if (rid.responsibleLeader !== state.currentUser.uid) return false;
    const normalized = normalizeStatus(rid.status);
    if (normalized === "CORRIGIDO" || normalized === "ENCERRADO") return false;
    if (normalized !== "VENCIDO" && normalized !== "EM ANDAMENTO" && normalized !== "EM_ANDAMENTO" && normalized !== "PENDENTE") return false;
    return getRidAgeDays(rid) > CRITICAL_DAYS;
  }

  function buildNotificationHost() {
    if (dom.root) return;
    injectStyles();

    dom.root = document.createElement("div");
    dom.root.className = "rid-notification-anchor";
    dom.root.innerHTML = `
      <button type="button" class="rid-notification-button" aria-label="Abrir alertas de RIDs atrasados" title="Alertas de RIDs atrasados">
        <svg class="rid-notification-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 17H9M17 8A5 5 0 0 0 7 8C7 12.031 5.347 13.799 4.731 14.352A1 1 0 0 0 5.402 16H18.598A1 1 0 0 0 19.269 14.352C18.653 13.799 17 12.031 17 8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M10.268 20A2 2 0 0 0 13.732 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span class="rid-notification-badge hidden-state">0</span>
      </button>
    `;

    dom.button = dom.root.querySelector(".rid-notification-button");
    dom.badge = dom.root.querySelector(".rid-notification-badge");

    dom.backdrop = document.createElement("div");
    dom.backdrop.className = "rid-notification-backdrop";

    dom.modal = document.createElement("div");
    dom.modal.className = "rid-notification-modal";
    dom.modal.innerHTML = `
      <div class="rid-notification-modal-header">
        <div>
          <h2 class="rid-notification-modal-title">Alertas de RIDs designados</h2>
          <p class="rid-notification-modal-subtitle">Aparecem aqui apenas RIDs designados para voce com mais de ${CRITICAL_DAYS} dias e ainda sem resolucao.</p>
        </div>
        <button type="button" class="rid-notification-modal-close" aria-label="Fechar alertas">×</button>
      </div>
      <div class="rid-notification-modal-body">
        <div class="rid-notification-empty">Nenhum RID designado com atraso critico no momento.</div>
        <div class="rid-notification-list hidden-state"></div>
      </div>
    `;

    dom.list = dom.modal.querySelector(".rid-notification-list");
    dom.empty = dom.modal.querySelector(".rid-notification-empty");
    dom.count = dom.modal.querySelector(".rid-notification-modal-title");

    const closeButton = dom.modal.querySelector(".rid-notification-modal-close");
    closeButton.addEventListener("click", closeNotificationsModal);
    dom.backdrop.addEventListener("click", closeNotificationsModal);
    dom.button.addEventListener("click", toggleNotificationsModal);

    document.body.appendChild(dom.backdrop);
    document.body.appendChild(dom.modal);

    const toolbar = document.querySelector(".dashboard-toolbar");
    if (toolbar) {
      toolbar.appendChild(dom.root);
      return;
    }

    const toggleButton = document.getElementById("toggleFiltersButton");
    const togglePopover = toggleButton?.closest(".filter-popover") || null;
    if (togglePopover && togglePopover.parentElement) {
      let actions = togglePopover.parentElement;
      const isKnownActionsContainer = actions.classList.contains("rid-global-actions") || actions.classList.contains("page-header-actions");
      if (!isKnownActionsContainer) {
        actions = document.createElement("div");
        actions.className = "rid-global-actions";
        togglePopover.insertAdjacentElement("beforebegin", actions);
        actions.appendChild(togglePopover);
      } else if (!actions.classList.contains("rid-global-actions")) {
        actions.classList.add("rid-global-actions");
      }
      actions.appendChild(dom.root);
      return;
    }

    const pageHeader = document.querySelector("main header.page-header, main header.dashboard-header, main > header");
    if (!pageHeader) return;

    let actions = pageHeader.querySelector(".rid-global-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "rid-global-actions";
      const headerChildren = Array.from(pageHeader.children);
      if (headerChildren.length > 1) {
        const trailing = headerChildren[headerChildren.length - 1];
        actions.appendChild(trailing);
      }
      pageHeader.appendChild(actions);
    }
    actions.appendChild(dom.root);
  }

  function openNotificationsModal() {
    if (!dom.modal || !dom.backdrop) return;
    state.modalOpen = true;
    dom.modal.classList.add("visible");
    dom.backdrop.classList.add("visible");
  }

  function closeNotificationsModal() {
    if (!dom.modal || !dom.backdrop) return;
    state.modalOpen = false;
    dom.modal.classList.remove("visible");
    dom.backdrop.classList.remove("visible");
  }

  function toggleNotificationsModal() {
    if (state.modalOpen) {
      closeNotificationsModal();
      return;
    }
    openNotificationsModal();
  }

  function renderNotifications() {
    buildNotificationHost();
    if (!dom.root || !dom.button || !dom.badge || !dom.list || !dom.empty) return;

    if (!state.currentUser?.uid) {
      dom.root.style.display = "none";
      closeNotificationsModal();
      return;
    }

    dom.root.style.display = "";

    const items = state.criticalRids;
    const count = items.length;
    dom.button.classList.toggle("has-alerts", count > 0);
    dom.badge.textContent = String(count);
    dom.badge.classList.toggle("hidden-state", count === 0);

    if (!count) {
      dom.empty.classList.remove("hidden-state");
      dom.list.classList.add("hidden-state");
      dom.list.innerHTML = "";
      return;
    }

    dom.empty.classList.add("hidden-state");
    dom.list.classList.remove("hidden-state");
    dom.list.innerHTML = items.map((rid) => {
      const ridNumber = formatRidNumber(rid.ridNumber);
      const statusLabel = formatStatusLabel(rid.status);
      const statusTone = formatStatusTone(rid.status);
      const days = getRidAgeDays(rid);
      return `
        <button type="button" class="rid-notification-item" data-rid-notification-id="${rid.id}">
          <div class="rid-notification-item-head">
            <div class="rid-notification-item-title">RID #${ridNumber}</div>
            <span class="rid-notification-item-pill ${statusTone}">${statusLabel}</span>
          </div>
          <div class="rid-notification-item-meta">Emissor: ${escapeHtml(rid.emitterName || "Sem emissor")}</div>
          <div class="rid-notification-item-foot">
            <span>${days} dias sem resolucao</span>
            <span class="rid-notification-item-link">Abrir RID</span>
          </div>
        </button>
      `;
    }).join("");

    dom.list.querySelectorAll("[data-rid-notification-id]").forEach((button) => {
      button.addEventListener("click", () => {
        openRidFromNotification(button.getAttribute("data-rid-notification-id") || "");
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function openRidFromNotification(ridId) {
    if (!ridId) return;
    sessionStorage.setItem(RID_NOTIFICATION_STORAGE_KEY, ridId);
    closeNotificationsModal();

    const currentPage = window.location.pathname.split(/[\\/]/).pop() || "";
    if (currentPage === "rids.html" && typeof window.openRidNotificationTarget === "function") {
      window.openRidNotificationTarget(ridId);
      return;
    }

    const targetUrl = new URL("rids.html", window.location.href);
    targetUrl.searchParams.set("rid", ridId);
    window.location.href = targetUrl.toString();
  }

  function subscribeToCriticalRids(uid) {
    if (typeof state.unsubscribeCriticalRids === "function") {
      state.unsubscribeCriticalRids();
      state.unsubscribeCriticalRids = null;
    }

    if (!uid) {
      state.criticalRids = [];
      renderNotifications();
      return;
    }

    state.unsubscribeCriticalRids = db.collection("rids")
      .where("responsibleLeader", "==", uid)
      .onSnapshot((snapshot) => {
        state.criticalRids = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(isCriticalAssignedRid)
          .sort((a, b) => getRidAgeDays(b) - getRidAgeDays(a));
        renderNotifications();
      }, (error) => {
        console.error("Falha ao carregar alertas de RIDs designados:", error);
      });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;
    if (!user) {
      state.currentUserData = null;
      state.criticalRids = [];
      subscribeToCriticalRids(null);
      closeNotificationsModal();
      return;
    }

    try {
      state.currentUserData = window.ridUserProfileResolver?.resolveUserProfile
        ? await window.ridUserProfileResolver.resolveUserProfile(db, user)
        : null;
      subscribeToCriticalRids(user.uid);
    } catch (error) {
      console.error("Falha ao preparar alertas de notificacao:", error);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modalOpen) {
      closeNotificationsModal();
    }
  });
})();
