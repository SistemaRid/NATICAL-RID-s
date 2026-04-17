(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBVnWDyQXWNf9JFE3S5W_eDqmrp7B4_nTE",
    authDomain: "natical-rids.firebaseapp.com",
    projectId: "natical-rids",
    storageBucket: "natical-rids.firebasestorage.app",
    messagingSenderId: "954479408416",
    appId: "1:954479408416:web:292797e541d84487021345"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  const db = firebase.firestore();
  const ANNOUNCEMENTS_COLLECTION = db.collection("globalAnnouncements");
  const RID_FORM_SETTINGS_DOC = db.collection("appSettings").doc("ridFormSchema");
  const messaging = typeof firebase.messaging === "function" ? firebase.messaging() : null;
  const WEB_PUSH_VAPID_KEY = "BC2FvVfx_PdEvXYqKdMAwZaNetYp_5Ni94FYINhTBxaXZnrhlCFfczJ-ivYtwsErGGcYAIAqUVzRz2HteJSaNuQ";

  const STORAGE_KEYS = {
    auth: "ridMobileOfflineAuth",
    leaders: "ridMobileOfflineLeaders",
    session: "ridMobileLastSession",
    ridFormSchema: "ridMobileRidFormSchema"
  };

  const DEFAULT_RID_FORM_SCHEMA = [
    {
      key: "contractType",
      label: "Tipo de contrato",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "Funcionario", label: "Funcionario" },
        { value: "Terceiro Contratado", label: "Terceiro Contratado" },
        { value: "Terceiro Eventual", label: "Terceiro Eventual" },
        { value: "Visitante", label: "Visitante" }
      ]
    },
    {
      key: "unit",
      label: "Unidade",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "CALTINS", label: "CALTINS" },
        { value: "CALTINS XAMBIOA II", label: "CALTINS XAMBIOA II" },
        { value: "FORMACAL", label: "FORMACAL" },
        { value: "GESSOTINS", label: "GESSOTINS" },
        { value: "MINERAX", label: "MINERAX" },
        { value: "NATICAL", label: "NATICAL" },
        { value: "SUPERCAL", label: "SUPERCAL" }
      ]
    },
    {
      key: "emissionDate",
      label: "Data",
      type: "date",
      required: true,
      placeholder: "",
      helperText: "",
      options: []
    },
    {
      key: "incidentType",
      label: "Incidente ou desvio",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "Condicao de Risco", label: "Condicao de Risco" },
        { value: "Desvio Comportamental", label: "Desvio Comportamental" },
        { value: "Dano Material", label: "Dano Material" },
        { value: "Quase acidente", label: "Quase acidente" }
      ]
    },
    {
      key: "detectionOrigin",
      label: "Origem da deteccao",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "CSL", label: "CSL" },
        { value: "Inspecao programada", label: "Inspecao programada" },
        { value: "Inspecao nao programada", label: "Inspecao nao programada" },
        { value: "Observacao Comportamental", label: "Observacao Comportamental" },
        { value: "Constatacao espontanea", label: "Constatacao espontanea" },
        { value: "Auditoria", label: "Auditoria" }
      ]
    },
    {
      key: "location",
      label: "Local",
      type: "text",
      required: true,
      placeholder: "Local da ocorrencia",
      helperText: "",
      options: []
    },
    {
      key: "description",
      label: "Descricao",
      type: "textarea",
      required: true,
      placeholder: "Descreva a ocorrencia",
      helperText: "",
      options: []
    },
    {
      key: "riskClassification",
      label: "Classificacao de risco",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "Baixo", label: "Baixo: Situacoes com baixo potencial de causar acidente." },
        { value: "Medio", label: "Medio: Situacoes que podem causar acidente leve." },
        { value: "Alto", label: "Alto: Situacoes com alto potencial de acidente grave." },
        { value: "Critico", label: "Critico: Risco iminente de acidente grave ou fatal." }
      ]
    },
    {
      key: "immediateAction",
      label: "Acao imediata",
      type: "textarea",
      required: true,
      placeholder: "Descreva a acao imediata",
      helperText: "",
      options: []
    },
    {
      key: "imageFile",
      label: "Imagem da ocorrencia",
      type: "file",
      required: false,
      placeholder: "",
      helperText: "Opcional. Voce pode escolher uma foto da galeria ou tirar na hora, dependendo das opcoes do seu celular.",
      options: []
    },
    {
      key: "status",
      label: "Status inicial",
      type: "select",
      required: true,
      placeholder: "",
      helperText: "",
      options: [
        { value: "CORRIGIDO", label: "CORRIGIDO" },
        { value: "VENCIDO", label: "VENCIDO" }
      ]
    },
    {
      key: "responsibleLeader",
      label: "Lider responsavel",
      type: "select",
      required: false,
      placeholder: "",
      helperText: "Se o status for VENCIDO, o lider e obrigatorio. A lista e carregada do cache local quando estiver offline.",
      options: [
        { value: "__LEADERS__", label: "Lista dinamica de lideres" }
      ]
    }
  ];

  const PAGE_SIZE = 8;
  const CONNECTIVITY_CHECK_INTERVAL = 30000;
  const RID_IMAGE_MAX_BYTES = 350 * 1024;
  const RID_IMAGE_MAX_DIMENSION = 1280;

  const state = {
    online: navigator.onLine,
    currentUser: null,
    currentUserData: null,
    currentPage: 1,
    currentMaintenancePage: 1,
    currentAssignedPage: 1,
    activeTab: "rids",
    maintenanceView: "emitted",
    cachedRids: [],
    cachedMaintenances: [],
    cachedAssignedRids: [],
    pendingRids: [],
    pendingMaintenances: [],
    leaders: loadStorage(STORAGE_KEYS.leaders, []),
    modalOpen: false,
    maintenanceModalOpen: false,
    ridDraft: null,
    maintenanceDraft: null,
    selectedRidId: null,
    selectedMaintenanceId: null,
    selectedAssignedRidId: null,
    imageViewerSrc: "",
    imageViewerScale: 1,
    imageViewerOffsetX: 0,
    imageViewerOffsetY: 0,
    imageViewerDragStartX: 0,
    imageViewerDragStartY: 0,
    imageViewerDragging: false,
    imageViewerPinchDistance: 0,
    imageViewerPinchStartScale: 1,
    booting: true,
    offlineBundleUpdating: false,
    actionOverlay: null,
    actionOverlayShownAt: 0,
    pushPromptDismissed: false,
    pushToken: null,
    pushMessagingBound: false,
    pushServiceWorkerRegistration: null,
    ridRealtimeUnsubs: [],
    tabTransitionDirection: "none",
    ridFormSchema: loadStorage(STORAGE_KEYS.ridFormSchema, DEFAULT_RID_FORM_SCHEMA)
  };

  const app = document.getElementById("app");
  const toastRoot = document.getElementById("toast-root");

  function loadStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("Falha ao ler storage:", key, error);
      return fallback;
    }
  }

  function saveStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function cloneRidFormSchema(schema) {
    return JSON.parse(JSON.stringify(schema || []));
  }

  function normalizeRidFormOption(option, index) {
    const value = String(option?.value ?? "").trim();
    const label = String(option?.label ?? "").trim();
    return {
      value: value || `opcao_${index + 1}`,
      label: label || value || `Opcao ${index + 1}`
    };
  }

  function normalizeRidFormField(field, index) {
    const label = String(field?.label || "").trim() || `Campo ${index + 1}`;
    const key = String(field?.key || `campo_${index + 1}`).trim() || `campo_${index + 1}`;
    const type = ["text", "textarea", "select", "date", "file"].includes(field?.type) ? field.type : "text";
    const options = Array.isArray(field?.options) ? field.options.map(normalizeRidFormOption) : [];
    return {
      key,
      label,
      type,
      required: Boolean(field?.required),
      placeholder: String(field?.placeholder || "").trim(),
      helperText: String(field?.helperText || "").trim(),
      options: type === "select" ? options : []
    };
  }

  function normalizeRidFormSchema(schema) {
    if (!Array.isArray(schema) || !schema.length) return cloneRidFormSchema(DEFAULT_RID_FORM_SCHEMA);
    return schema.map(normalizeRidFormField);
  }

  function setRidFormSchema(schema) {
    state.ridFormSchema = normalizeRidFormSchema(schema);
    saveStorage(STORAGE_KEYS.ridFormSchema, state.ridFormSchema);
  }

  async function loadRidFormSchema() {
    if (!state.online) {
      setRidFormSchema(state.ridFormSchema);
      return state.ridFormSchema;
    }

    try {
      const snap = await RID_FORM_SETTINGS_DOC.get();
      const fields = snap.exists ? snap.data()?.fields : null;
      setRidFormSchema(fields);
      return state.ridFormSchema;
    } catch (error) {
      console.warn("Nao foi possivel carregar o formulario de RID configuravel:", error);
      setRidFormSchema(state.ridFormSchema);
      return state.ridFormSchema;
    }
  }

  function getLeaderSelectOptions() {
    return state.leaders.length
      ? state.leaders.map((leader) => ({ value: leader.id, label: leader.name || "Lider" }))
      : [];
  }

  function getRidFieldValue(item, fieldKey) {
    const customValue = item?.customFields?.[fieldKey]?.value;
    if (customValue !== undefined && customValue !== null && String(customValue).trim()) return String(customValue);

    switch (fieldKey) {
      case "contractType": return item?.contractType || "";
      case "unit": return item?.unit || "";
      case "emissionDate": return item?.emissionDate ? formatDate(item.emissionDate) : "";
      case "incidentType": return item?.incidentType || "";
      case "detectionOrigin": return item?.detectionOrigin || "";
      case "location": return item?.location || "";
      case "description": return item?.description || "";
      case "riskClassification": return item?.riskClassification || "";
      case "immediateAction": return item?.immediateAction || "";
      case "status": return item?.status || "";
      case "responsibleLeader": return item?.responsibleLeaderName || item?.responsibleLeader || "";
      default: return "";
    }
  }

  function getRidDetailsFields(item) {
    const knownKeys = new Set();
    const configured = (state.ridFormSchema || []).filter((field) => field.key !== "imageFile" && field.key !== "status").map((field) => {
      knownKeys.add(field.key);
      return {
        label: field.label,
        value: getRidFieldValue(item, field.key)
      };
    }).filter((entry) => String(entry.value || "").trim());

    const extras = Object.entries(item?.customFields || {}).filter(([key, value]) => {
      const raw = String(value?.value || "").trim();
      return raw && !knownKeys.has(key);
    }).map(([, value]) => ({
      label: value?.label || "Campo extra",
      value: value?.value || ""
    }));

    return [
      { label: "Emitente", value: item?.emitterName || "Nao informado" },
      ...configured,
      ...extras
    ];
  }

  function renderRidModalField(field, today) {
    const required = field.required ? "required" : "";
    const helperText = field.helperText ? `<p class="helper-text">${escapeHtml(field.helperText)}</p>` : "";
    const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";

    if (field.type === "select") {
      const isLeaderField = field.key === "responsibleLeader" || (field.options || []).some((option) => option.value === "__LEADERS__");
      const options = isLeaderField
        ? [{ value: "", label: "Designar depois" }, ...getLeaderSelectOptions()]
        : [{ value: "", label: "Selecione..." }, ...(field.options || [])];
      const optionsHtml = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
      return `
        <div class="field">
          <label>${escapeHtml(field.label)}</label>
          <select name="${escapeHtml(field.key)}" ${required}>
            ${optionsHtml}
          </select>
          ${helperText}
        </div>
      `;
    }

    if (field.type === "textarea") {
      return `
        <div class="field">
          <label>${escapeHtml(field.label)}</label>
          <textarea name="${escapeHtml(field.key)}" ${required}${placeholder}></textarea>
          ${helperText}
        </div>
      `;
    }

    if (field.type === "date") {
      const value = field.key === "emissionDate" ? ` value="${escapeHtml(today)}"` : "";
      return `
        <div class="field">
          <label>${escapeHtml(field.label)}</label>
          <input type="date" name="${escapeHtml(field.key)}"${value} ${required}>
          ${helperText}
        </div>
      `;
    }

    if (field.type === "file") {
      return `
        <div class="field">
          <label>${escapeHtml(field.label)}</label>
          <input type="file" name="${escapeHtml(field.key)}" accept="image/*" ${required}>
          ${helperText}
        </div>
      `;
    }

    return `
      <div class="field">
        <label>${escapeHtml(field.label)}</label>
        <input name="${escapeHtml(field.key)}" ${required}${placeholder}>
        ${helperText}
      </div>
    `;
  }

  function captureFormDraft(form) {
    const formData = new FormData(form);
    const draft = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) continue;
      draft[key] = value;
    }
    return draft;
  }

  function restoreFormDraft(form, draft) {
    if (!form || !draft) return;

    Object.entries(draft).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field || typeof field.value === "undefined") return;
      field.value = value;
    });
  }

  function bindDraftPersistence(formId, draftKey) {
    const form = document.getElementById(formId);
    if (!form) return;

    restoreFormDraft(form, state[draftKey]);

    const persistDraft = () => {
      state[draftKey] = captureFormDraft(form);
    };

    form.addEventListener("input", persistDraft);
    form.addEventListener("change", persistDraft);
  }

  function pendingKey(uid) {
    return `ridMobilePending_${uid}`;
  }

  function cacheKey(uid) {
    return `ridMobileCache_${uid}`;
  }

  function syncKey(uid) {
    return `ridMobileLastSync_${uid}`;
  }

  function maintenanceKey(uid) {
    return `ridMobileMaintenances_${uid}`;
  }

  function maintenanceCacheKey(uid) {
    return `ridMobileMaintenancesCache_${uid}`;
  }

  function assignedRidCacheKey(uid) {
    return `ridMobileAssignedCache_${uid}`;
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    const date = toDate(value);
    return date ? date.toLocaleDateString("pt-BR") : "Sem data";
  }

  function formatDateTime(value) {
    const date = toDate(value);
    return date ? date.toLocaleString("pt-BR") : "Sem data";
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
    if (data.target === "dashboard") return false;
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
    overlay.style.zIndex = "120";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.padding = "16px";
    overlay.style.background = "rgba(17, 24, 39, 0.48)";
    overlay.style.backdropFilter = "blur(10px)";
    overlay.style.webkitBackdropFilter = "blur(10px)";
    const announcementImageHtml = data.imageDataUrl
      ? `<div style="margin-bottom:14px;"><img src="${escapeHtml(data.imageDataUrl)}" alt="Imagem do aviso" style="display:block;width:100%;max-height:240px;object-fit:cover;border-radius:18px;border:1px solid #dde5eb;"></div>`
      : "";
    overlay.innerHTML = `
      <div style="width:min(100%,560px);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:#ffffff;border-radius:24px;padding:18px;box-shadow:0 18px 40px rgba(24,39,75,.18);border:1px solid #dde5eb;overflow:hidden;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <div>
            <div style="font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7895a7;">Aviso do sistema</div>
            <h2 style="margin:6px 0 0;font-size:1.35rem;line-height:1.15;color:#213043;">${escapeHtml(data.title || "Atualização")}</h2>
          </div>
          <button type="button" id="closeGlobalAnnouncementModal" style="width:36px;height:36px;border:0;border-radius:999px;background:#f7fafc;color:#415264;font-size:22px;">×</button>
        </div>
        <div style="flex:1;min-height:0;overflow-y:auto;padding-right:4px;">
          ${announcementImageHtml}
          <div style="font-size:.96rem;line-height:1.65;color:#475569;white-space:pre-wrap;">${escapeHtml(data.message || "")}</div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <button type="button" id="ackGlobalAnnouncementModal" style="min-height:46px;padding:0 16px;border:0;border-radius:18px;background:linear-gradient(135deg,#9ab4c3,#7895a7);color:white;font-weight:800;">Entendi</button>
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function normalizeCpf(cpf) {
    return String(cpf || "").replace(/\D/g, "");
  }

  function maskCpf(cpf) {
    const digits = normalizeCpf(cpf).slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  function cpfToEmail(cpf) {
    return `${normalizeCpf(cpf)}@jdemito.com`;
  }

  async function sha256(text) {
    const payload = new TextEncoder().encode(String(text || ""));
    const digest = await crypto.subtle.digest("SHA-256", payload);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastRoot.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function clearAutoFocus() {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && typeof active.blur === "function" && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) {
        active.blur();
      }
    });
  }

  function getOfflineAuth() {
    return loadStorage(STORAGE_KEYS.auth, null);
  }

  function setOfflineAuth(payload) {
    saveStorage(STORAGE_KEYS.auth, payload);
  }

  function clearOfflineAuth() {
    localStorage.removeItem(STORAGE_KEYS.auth);
  }

  function getLastSession() {
    return loadStorage(STORAGE_KEYS.session, null);
  }

  function setLastSession(payload) {
    saveStorage(STORAGE_KEYS.session, payload);
  }

  function clearLastSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
  }

  function setBooting(booting) {
    state.booting = booting;
    renderBootOverlay();
  }

  function setActionOverlay(message, detail = "") {
    state.actionOverlay = { message, detail };
    state.actionOverlayShownAt = Date.now();
    renderActionOverlay();
  }

  async function clearActionOverlay() {
    const elapsed = Date.now() - (state.actionOverlayShownAt || 0);
    const remaining = Math.max(0, 650 - elapsed);
    if (remaining > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, remaining));
    }
    state.actionOverlay = null;
    state.actionOverlayShownAt = 0;
    renderActionOverlay();
  }

  function renderBootOverlay() {
    const existing = document.getElementById("boot-overlay");
    if (!state.booting) {
      existing?.remove();
      return;
    }

    if (existing) return;

    const overlay = document.createElement("div");
    overlay.id = "boot-overlay";
    overlay.className = "boot-overlay";
    overlay.innerHTML = `
      <div class="boot-card">
        <div class="boot-spinner"></div>
        <p class="boot-title">Carregando dados</p>
        <p class="boot-copy">Aguarde enquanto o app restaura sua sessão e prepara os dados offline.</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function renderActionOverlay() {
    const existing = document.getElementById("action-overlay");
    if (!state.actionOverlay) {
      existing?.remove();
      return;
    }

    if (existing) {
      const title = existing.querySelector(".action-overlay-title");
      const detail = existing.querySelector(".action-overlay-detail");
      if (title) title.textContent = state.actionOverlay.message;
      if (detail) detail.textContent = state.actionOverlay.detail || "";
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "action-overlay";
    overlay.className = "action-overlay";
    overlay.innerHTML = `
      <div class="action-overlay-card">
        <div class="boot-spinner"></div>
        <p class="action-overlay-title">${escapeHtml(state.actionOverlay.message)}</p>
        <p class="action-overlay-detail">${escapeHtml(state.actionOverlay.detail || "")}</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function loadUserCache(uid) {
    state.cachedRids = loadStorage(cacheKey(uid), []);
    state.cachedMaintenances = loadStorage(maintenanceCacheKey(uid), []);
    state.cachedAssignedRids = loadStorage(assignedRidCacheKey(uid), []);
    state.pendingRids = loadStorage(pendingKey(uid), []);
    state.pendingMaintenances = loadStorage(maintenanceKey(uid), []);
  }

  function persistUserCache() {
    if (!state.currentUser?.uid) return;
    const sanitizeRidForCache = (item) => ({
      ...item,
      imageDataUrl: "",
      imageContentType: "",
      imageOriginalName: ""
    });

    saveStorage(cacheKey(state.currentUser.uid), state.cachedRids.map(sanitizeRidForCache));
    saveStorage(maintenanceCacheKey(state.currentUser.uid), state.cachedMaintenances);
    saveStorage(assignedRidCacheKey(state.currentUser.uid), state.cachedAssignedRids.map(sanitizeRidForCache));
    saveStorage(pendingKey(state.currentUser.uid), state.pendingRids);
    saveStorage(maintenanceKey(state.currentUser.uid), state.pendingMaintenances);
    localStorage.setItem(syncKey(state.currentUser.uid), new Date().toISOString());

    if (state.currentUserData) {
      setLastSession({
        uid: state.currentUser.uid,
        userData: state.currentUserData
      });
    }
  }

  function getLastSyncAt() {
    if (!state.currentUser?.uid) return null;
    return localStorage.getItem(syncKey(state.currentUser.uid));
  }

  function getLastSyncLabel() {
    const lastSyncAt = getLastSyncAt();
    if (!lastSyncAt) return "Ainda não baixado.";

    const parsed = new Date(lastSyncAt);
    if (Number.isNaN(parsed.getTime())) return "Offline salvo.";
    return `Baixado: ${parsed.toLocaleDateString("pt-BR")}`;
  }

  function setLeaders(leaders) {
    state.leaders = leaders;
    saveStorage(STORAGE_KEYS.leaders, leaders);
  }

  function hydrateCachedLeaders() {
    state.leaders = loadStorage(STORAGE_KEYS.leaders, []);
    return state.leaders;
  }

  function sortRidItems(items) {
    return [...items].sort((a, b) => {
      const aTime = toDate(a.createdAt || a.localCreatedAt || a.emissionDate)?.getTime() || 0;
      const bTime = toDate(b.createdAt || b.localCreatedAt || b.emissionDate)?.getTime() || 0;
      return bTime - aTime;
    });
  }

  function getCombinedRids() {
    const remote = (state.cachedRids || []).map((item) => ({ ...item, isPendingLocal: false }));
    const pending = (state.pendingRids || []).map((item) => ({ ...item, isPendingLocal: true }));
    return sortRidItems([...pending, ...remote]);
  }

  function getPaginatedRids() {
    const items = getCombinedRids();
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    state.currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);
    const start = (state.currentPage - 1) * PAGE_SIZE;
    return {
      items: items.slice(start, start + PAGE_SIZE),
      totalItems: items.length,
      totalPages,
      page: state.currentPage
    };
  }

  function serializeMaintenance(doc) {
    const data = doc.data() || {};
    return {
      id: doc.id,
      maintenanceNumber: data.maintenanceNumber || "",
      requesterId: data.requesterId || "",
      requesterCpf: data.requesterCpf || "",
      requesterName: data.requesterName || "",
      requesterSector: data.requesterSector || data.sector || "",
      kind: data.kind || "",
      item: data.equipment || data.item || "",
      location: data.location || "",
      priority: data.priority || "",
      description: data.description || "",
      status: data.status || "ABERTA",
      assignedTo: data.assignedTo || "",
      assignedToName: data.assignedToName || "",
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
      source: data.source || ""
    };
  }

  function sortMaintenanceItems(items) {
    return [...items].sort((a, b) => {
      const aTime = toDate(a.updatedAt || a.createdAt || a.localCreatedAt)?.getTime() || 0;
      const bTime = toDate(b.updatedAt || b.createdAt || b.localCreatedAt)?.getTime() || 0;
      return bTime - aTime;
    });
  }

  function getCombinedMaintenances() {
    const mode = canSeeAssignedRids() ? state.maintenanceView : "emitted";
    const remote = (state.cachedMaintenances || [])
      .map((item) => ({ ...item, isPendingLocal: false }))
      .filter((item) => {
        if (mode === "designated") return item.assignedTo === state.currentUser?.uid;
        return item.requesterId === state.currentUser?.uid || item.requesterCpf === state.currentUserData?.cpf;
      });
    const pending = mode === "emitted"
      ? (state.pendingMaintenances || []).map((item) => ({
          ...item,
          status: item.status || "PENDENTE",
          isPendingLocal: true
        }))
      : [];
    return sortMaintenanceItems([...pending, ...remote]);
  }

  function getPaginatedMaintenances() {
    const items = getCombinedMaintenances();
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    state.currentMaintenancePage = Math.min(Math.max(state.currentMaintenancePage, 1), totalPages);
    const start = (state.currentMaintenancePage - 1) * PAGE_SIZE;
    return {
      items: items.slice(start, start + PAGE_SIZE),
      totalItems: items.length,
      totalPages,
      page: state.currentMaintenancePage
    };
  }

  function canSeeAssignedRids() {
    return Boolean(state.currentUserData?.isAdmin || state.currentUserData?.isDeveloper);
  }

  function getAllAssignedRids() {
    return sortRidItems((state.cachedAssignedRids || []).filter((item) => !item.deleted));
  }

  function getAssignedRids() {
    return getAllAssignedRids().filter((item) => String(item.status || "").toUpperCase() === "VENCIDO");
  }

  function getPaginatedAssignedRids() {
    const items = getAssignedRids();
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    state.currentAssignedPage = Math.min(Math.max(state.currentAssignedPage, 1), totalPages);
    const start = (state.currentAssignedPage - 1) * PAGE_SIZE;
    return {
      items: items.slice(start, start + PAGE_SIZE),
      totalItems: items.length,
      totalPages,
      page: state.currentAssignedPage
    };
  }

  function isCorrected(status) {
    return String(status || "").toUpperCase() === "CORRIGIDO";
  }

  function isOverdue(status) {
    const normalized = String(status || "").toUpperCase();
    return normalized === "VENCIDO" || normalized.includes("ANDAMENTO");
  }

  function calcStats() {
    const rids = getCombinedRids();
    return {
      total: rids.length,
      corrected: rids.filter((item) => isCorrected(item.status)).length,
      pendingSync: rids.filter((item) => item.isPendingLocal).length,
      overdue: rids.filter((item) => !item.isPendingLocal && isOverdue(item.status)).length
    };
  }

  function getPersonalMonthlyGoal(userData) {
    if (userData?.isAdmin || userData?.isDeveloper) return 8;
    return 4;
  }

  function calcCurrentMonthProgress() {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const emittedThisMonth = getCombinedRids().filter((item) => {
      const date = toDate(item.emissionDate || item.localCreatedAt || item.createdAt);
      return date && date.getMonth() === month && date.getFullYear() === year;
    }).length;
    const goal = getPersonalMonthlyGoal(state.currentUserData);

    return {
      emittedThisMonth,
      goal,
      hitGoal: emittedThisMonth >= goal
    };
  }

  async function detectActualConnectivity() {
    if (!navigator.onLine) return false;

    try {
      await fetch(`https://www.gstatic.com/generate_204?network-check=1&t=${Date.now()}`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store"
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function syncConnectivityState() {
    const actualOnline = await detectActualConnectivity();
    const previous = state.online;
    state.online = actualOnline;

    if (previous !== actualOnline) {
      if (!state.currentUser) {
        renderLogin();
      } else {
        renderApp();
      }
    }

    return actualOnline;
  }

  function getBadgeClass(status, isPendingLocal) {
    if (isPendingLocal) return "pending";
    const normalized = String(status || "").toUpperCase();
    if (normalized === "CORRIGIDO") return "corrected";
    if (normalized === "ENCERRADO" || normalized === "EXCLUIDO") return "closed";
    if (normalized === "VENCIDO" || normalized.includes("ANDAMENTO")) return "overdue";
    return "synced";
  }

  function getStatusLabel(item) {
    if (item.isPendingLocal) return "PENDENTE DE SINCRONIZAÇÃO";
    return String(item.status || "SEM STATUS").toUpperCase();
  }

  function formatRidNumber(ridNumber) {
    const digits = String(ridNumber ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.padStart(5, "0");
  }

  function isIosLikeDevice() {
    const ua = navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalonePwa() {
    return !!(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);
  }

  function getPushUnavailableReason() {
    if (!state.online) return "Conecte este celular a internet para ativar as notificacoes.";
    if (!state.currentUser?.uid) return "Entre na sua conta para ativar as notificacoes do celular.";
    if (!messaging) return "O Firebase Messaging nao carregou neste navegador.";
    if (!("Notification" in window)) return "Este navegador nao oferece suporte a notificacoes.";
    if (!("serviceWorker" in navigator)) return "Este navegador nao oferece suporte a service worker.";
    if (!("PushManager" in window)) return "Este navegador nao oferece suporte completo para push.";
    if (isIosLikeDevice() && !isStandalonePwa()) {
      return "No iPhone/iPad, as notificacoes do PWA so funcionam depois de instalar o app na Tela de Inicio.";
    }
    return "";
  }

  function canUsePushNotifications() {
    return !getPushUnavailableReason();
  }

  function describePushError(error) {
    const details = `${String(error?.code || "")} ${String(error?.message || "")}`.toLowerCase();
    const unavailableReason = getPushUnavailableReason();
    if (unavailableReason) {
      return unavailableReason;
    }
    if (Notification.permission === "denied" || details.includes("permission-blocked")) {
      return "As notificacoes do navegador estao bloqueadas neste celular.";
    }
    if (details.includes("unsupported") || details.includes("messaging/unsupported-browser")) {
      return "Este navegador do celular nao oferece suporte completo para notificacoes push.";
    }
    if (details.includes("service worker") || details.includes("sw.js")) {
      return "Nao foi possivel iniciar o service worker de notificacoes.";
    }
    if (details.includes("vapid") || details.includes("token-subscribe-failed")) {
      return "O navegador nao conseguiu criar o registro push deste celular.";
    }
    if (details.includes("insufficient permissions")) {
      return "O token foi gerado, mas o Firestore nao deixou salvar.";
    }
    return "Nao foi possivel ativar as notificacoes neste celular.";
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

  async function syncMobilePushToken() {
    if (!canUsePushNotifications()) return null;
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
      uid: state.currentUser.uid,
      userName: state.currentUserData?.name || "",
      isAdmin: !!state.currentUserData?.isAdmin,
      isDeveloper: !!state.currentUserData?.isDeveloper,
      platform: "web",
      page: "mobile",
      channel: "rid-status-change",
      serviceWorkerScope: registration.scope || "",
      userAgent: navigator.userAgent,
      enabled: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return token;
  }

  async function disableMobilePushToken() {
    if (!messaging || !state.online || !state.currentUser?.uid) return;

    try {
      const registration = await ensurePushServiceWorkerRegistration();
      const token = state.pushToken || await messaging.getToken({
        vapidKey: WEB_PUSH_VAPID_KEY,
        serviceWorkerRegistration: registration || undefined
      });

      if (!token) return;
      await db.collection("notificationTokens").doc(token).delete().catch(() => null);
      state.pushToken = null;
    } catch (error) {
      console.warn("Nao foi possivel desativar o token mobile:", error);
    }
  }

  async function requestMobilePushPermission() {
    if (!canUsePushNotifications()) {
      showToast(getPushUnavailableReason() || "Nao foi possivel ativar as notificacoes neste celular.", "info");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") state.pushPromptDismissed = true;
        renderApp();
        showToast("As notificacoes nao foram liberadas neste celular.", "info");
        return;
      }

      await syncMobilePushToken();
      renderApp();
      showToast("Notificacoes do celular ativadas.", "success");
    } catch (error) {
      console.error("Falha ao ativar push mobile:", error);
      showToast(describePushError(error), "error");
    }
  }

  function subscribeForegroundPushMessages() {
    if (!messaging || state.pushMessagingBound) return;
    state.pushMessagingBound = true;
    messaging.onMessage((payload) => {
      const data = payload?.data || {};
      const title = data.title || payload?.notification?.title || "Nova notificacao";
      const body = data.body || payload?.notification?.body || "";
      showToast(body ? `${title}: ${body}` : title, "info");
    });
  }

  async function initializeMobilePushNotifications() {
    if (!canUsePushNotifications()) return;
    subscribeForegroundPushMessages();

    try {
      await ensurePushServiceWorkerRegistration();
    } catch (error) {
      console.error("Falha ao registrar push mobile:", error);
      return;
    }

    if (Notification.permission === "granted") {
      try {
        await syncMobilePushToken();
      } catch (error) {
        console.error("Falha ao sincronizar token mobile:", error);
      }
    }
  }

  function renderPushPermissionBanner() {
    if (!canUsePushNotifications()) return "";
    if (Notification.permission !== "default") return "";
    if (state.pushPromptDismissed) return "";

    return `
      <div class="mobile-push-banner">
        <div class="mobile-push-title">Ative as notificacoes do celular</div>
        <div class="mobile-push-copy">Receba aviso quando um lider corrigir um RID seu.</div>
        <div class="mobile-push-actions">
          <button class="btn btn-success btn-small" id="enable-mobile-push-btn">Ativar</button>
          <button class="btn btn-soft btn-small" id="dismiss-mobile-push-btn">Agora nao</button>
        </div>
      </div>
    `;
  }

  function serializeRid(doc) {
    const data = doc.data();
    const normalizedRidNumber = formatRidNumber(data.ridNumber);
    return {
      id: doc.id,
      ridNumber: normalizedRidNumber || null,
      emitterId: data.emitterId || null,
      emitterName: data.emitterName || "",
      emitterCpf: data.emitterCpf || "",
      contractType: data.contractType || "",
      unit: data.unit || "",
      sector: data.sector || "",
      incidentType: data.incidentType || "",
      detectionOrigin: data.detectionOrigin || "",
      location: data.location || "",
      description: data.description || "",
      riskClassification: data.riskClassification || "",
      immediateAction: data.immediateAction || "",
      imageDataUrl: data.imageDataUrl || "",
      imageContentType: data.imageContentType || "",
      imageOriginalName: data.imageOriginalName || "",
      correctiveActions: data.correctiveActions || "",
      status: data.status || "VENCIDO",
      responsibleLeader: data.responsibleLeader || "",
      responsibleLeaderName: data.responsibleLeaderName || "",
      createdAt: toDate(data.createdAt)?.toISOString() || null,
      emissionDate: toDate(data.emissionDate)?.toISOString() || null,
      conclusionDate: toDate(data.conclusionDate)?.toISOString() || null,
      deleted: Boolean(data.deleted),
      deleteReason: data.deleteReason || "",
      deletedAt: toDate(data.deletedAt)?.toISOString() || null,
      deletedByName: data.deletedBy?.name || "",
      deletedByRole: data.deletedBy?.role || "",
      deleteRequesterName: data.deleteRequesterName || "",
      customFields: data.customFields || {}
    };
  }

  function chunkArray(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  async function enrichDeletedRidsWithRequests(rids) {
    const deletedRids = rids.filter((item) => item.deleted && item.id);
    if (!deletedRids.length || !state.online) return rids;

    const ridIds = deletedRids.map((item) => item.id);
    const requests = [];
    const batches = chunkArray(ridIds, 10);

    try {
      for (const batch of batches) {
        const snapshot = await db.collection("deleteRequests")
          .where("ridId", "in", batch)
          .get();
        snapshot.docs.forEach((doc) => requests.push({ id: doc.id, ...doc.data() }));
      }
    } catch (error) {
      const code = String(error?.code || "");
      if (code.includes("permission-denied")) {
        console.warn("Leitura de deleteRequests bloqueada pelas rules; usando dados do RID.", error);
        return rids;
      }
      throw error;
    }

    return rids.map((item) => {
      if (!item.deleted || !item.id) return item;

      const request = requests
        .filter((entry) => entry.ridId === item.id)
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))[0];

      if (!request) return item;

      return {
        ...item,
        deleteRequesterName: request.requesterName || item.deleteRequesterName || "",
        deleteReason: request.reason || item.deleteReason || ""
      };
    });
  }

  async function refreshLeadersCache() {
    if (!state.online) {
      return hydrateCachedLeaders();
    }

    try {
      const leadersSnapshot = await db.collection("leaders_public").get();
      const leaders = leadersSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((leader) => leader.isDeveloper !== true)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

      setLeaders(leaders);
      return leaders;
    } catch (error) {
      console.warn("Falha ao atualizar líderes, usando cache local:", error);
      return hydrateCachedLeaders();
    }
  }

  async function cacheRemoteData() {
    if (!state.online || !state.currentUser?.uid || !state.currentUserData) return;

    const docs = [];
    const signatures = new Set();
    const pushUnique = (item) => {
      const signature = item.ridNumber ? `RID:${item.ridNumber}` : `DOC:${item.id}`;
      if (signatures.has(signature)) return;
      signatures.add(signature);
      docs.push(item);
    };

    const snapshots = await collectRidSnapshots();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => pushUnique(serializeRid(doc))));

    state.cachedRids = sortRidItems(await enrichDeletedRidsWithRequests(docs));
    state.cachedMaintenances = await collectMaintenances();
    state.cachedAssignedRids = canSeeAssignedRids() ? await collectAssignedRidSnapshots() : [];
    await refreshLeadersCache();
    persistUserCache();
  }

  async function collectMaintenances() {
    const queries = [db.collection("maintenances").where("requesterId", "==", state.currentUser.uid)];

    if (canSeeAssignedRids()) {
      queries.push(db.collection("maintenances").where("assignedTo", "==", state.currentUser.uid));
    }

    if (state.currentUserData.cpf) {
      queries.push(db.collection("maintenances").where("requesterCpf", "==", state.currentUserData.cpf));
    }

    const settled = await Promise.allSettled(queries.map((query) => query.get()));
    const docs = [];
    const seen = new Set();

    settled.forEach((result) => {
      if (result.status !== "fulfilled") return;
      result.value.docs.forEach((doc) => {
        if (seen.has(doc.id)) return;
        seen.add(doc.id);
        docs.push(serializeMaintenance(doc));
      });
    });

    return sortMaintenanceItems(docs);
  }

  async function collectAssignedRidSnapshots() {
    if (!canSeeAssignedRids() || !state.currentUser?.uid) return [];
    const snapshot = await db.collection("rids")
      .where("responsibleLeader", "==", state.currentUser.uid)
      .get();

    return sortRidItems(await enrichDeletedRidsWithRequests(snapshot.docs.map((doc) => serializeRid(doc))));
  }

  function stopRealtimeRidSync() {
    (state.ridRealtimeUnsubs || []).forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {}
    });
    state.ridRealtimeUnsubs = [];
  }

  async function collectRidSnapshots() {
    const queries = [{
      label: "emitterId",
      ref: db.collection("rids").where("emitterId", "==", state.currentUser.uid)
    }];

    if (state.currentUserData.cpf) {
      queries.push({
        label: "emitterCpf",
        ref: db.collection("rids").where("emitterCpf", "==", state.currentUserData.cpf)
      });
    }

    const settled = await Promise.allSettled(queries.map((item) => item.ref.get()));
    const successfulSnapshots = [];
    let hasPrimarySnapshot = false;

    settled.forEach((result, index) => {
      const query = queries[index];
      if (result.status === "fulfilled") {
        if (query.label === "emitterId") hasPrimarySnapshot = true;
        successfulSnapshots.push(result.value);
        return;
      }

      console.warn(`Consulta de RIDs ignorada no mobile (${query.label}).`, result.reason);
    });

    if (!hasPrimarySnapshot) {
      throw settled[0]?.reason || new Error("Nao foi possivel consultar os RIDs do usuario.");
    }

    return successfulSnapshots;
  }

  function startRealtimeRidSync() {
    if (!state.online || !state.currentUser?.uid || !state.currentUserData) return;
    if (state.ridRealtimeUnsubs?.length) return;

    const emitterQuery = db.collection("rids").where("emitterId", "==", state.currentUser.uid);
    const queries = [emitterQuery];

    if (canSeeAssignedRids()) {
      queries.push(db.collection("rids").where("responsibleLeader", "==", state.currentUser.uid));
    }

    state.ridRealtimeUnsubs = queries.map((query) => query.onSnapshot(() => {
      cacheRemoteData()
        .then(() => {
          if (state.currentUser) renderApp();
        })
        .catch((error) => {
          console.error("Falha ao atualizar RIDs em tempo real no mobile:", error);
        });
    }, (error) => {
      console.error("Falha no listener em tempo real do mobile:", error);
    }));
  }

  async function sendServiceWorkerMessage(message) {
    if (!("serviceWorker" in navigator)) return false;

    let registration = null;
    try {
      registration = await navigator.serviceWorker.ready;
      await registration.update().catch(() => {});
    } catch (error) {
      console.warn("Service worker ainda não ficou pronto:", error);
    }

    const worker = registration?.active || registration?.waiting || registration?.installing;
    if (!worker) return false;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timeoutId = window.setTimeout(() => resolve(false), 5000);

      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeoutId);
        resolve(Boolean(event.data?.ok));
      };

      try {
        worker.postMessage(message, [channel.port2]);
      } catch (error) {
        console.warn("Falha ao enviar mensagem ao service worker:", error);
        window.clearTimeout(timeoutId);
        resolve(false);
      }
    });
  }

  async function refreshOfflineAssets() {
    if (!state.online) return false;
    return sendServiceWorkerMessage({ type: "refresh-offline-cache" });
  }

  async function refreshOfflineExperience(options = {}) {
    const { showSuccessToast = false, showErrorToast = true } = options;

    if (!state.online) {
      if (showErrorToast) showToast("Conecte-se à internet para baixar ou atualizar o offline.", "error");
      return false;
    }

    state.offlineBundleUpdating = true;
    if (state.currentUser) renderApp();

    try {
      await loadRidFormSchema();
      await cacheRemoteData();
      await syncPendingMaintenances();
      const assetsUpdated = await refreshOfflineAssets();
      persistUserCache();
      if (state.currentUser) renderApp();

      if (showSuccessToast) {
        showToast(
          assetsUpdated
            ? "Cache offline e dados atualizados com sucesso."
            : "Dados atualizados. O cache offline continuará sendo renovado em segundo plano.",
          "success"
        );
      }
      return true;
    } catch (error) {
      console.error("Falha ao atualizar experiência offline:", error);
      if (showErrorToast) {
        showToast(`Erro ao atualizar offline: ${error.message}`, "error");
      }
      return false;
    } finally {
      state.offlineBundleUpdating = false;
      if (state.currentUser) renderApp();
    }
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
    const status = String(formData.get("status") || "").toUpperCase();
    const payload = {
      emitterId: state.currentUser.uid,
      emitterName: state.currentUserData.name,
      emitterCpf: state.currentUserData.cpf,
      contractType: "",
      unit: "",
      sector: state.currentUserData.sector || "",
      emissionDate: new Date().toISOString().slice(0, 10),
      incidentType: "",
      detectionOrigin: "",
      location: "",
      description: "",
      riskClassification: "",
      immediateAction: "",
      image: null,
      status,
      responsibleLeader: leaderId,
      responsibleLeaderName: leader?.name || "",
      customFields: {},
      localCreatedAt: new Date().toISOString()
    };

    state.ridFormSchema.forEach((field) => {
      if (!field?.key || field.type === "file") return;
      const rawValue = formData.get(field.key);
      const value = String(rawValue ?? "").trim();

      switch (field.key) {
        case "contractType":
        case "unit":
        case "emissionDate":
        case "incidentType":
        case "detectionOrigin":
        case "location":
        case "description":
        case "riskClassification":
        case "immediateAction":
          payload[field.key] = value;
          break;
        case "status":
          payload.status = value.toUpperCase();
          break;
        case "responsibleLeader":
          payload.responsibleLeader = value;
          payload.responsibleLeaderName = state.leaders.find((item) => item.id === value)?.name || "";
          break;
        default:
          payload.customFields[field.key] = {
            label: field.label || field.key,
            value,
            type: field.type || "text"
          };
          break;
      }
    });

    return payload;
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
      customFields: payload.customFields || {},
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

  function savePendingRid(payload) {
    state.pendingRids.unshift({
      ...payload,
      localId: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      pendingSync: true,
      localCreatedAt: new Date().toISOString()
    });

    persistUserCache();
  }

  function buildMaintenancePayload(formData) {
    const assignedTo = formData.get("assignedTo") || "";
    const leader = state.leaders.find((item) => item.id === assignedTo);

    return {
      requesterId: state.currentUser.uid,
      requesterCpf: state.currentUserData.cpf || "",
      requesterName: state.currentUserData.name,
      requesterSector: state.currentUserData.sector || "",
      kind: formData.get("kind"),
      assignedTo,
      assignedToName: leader?.name || "",
      item: formData.get("item"),
      location: formData.get("location"),
      priority: formData.get("priority"),
      description: formData.get("description"),
      localCreatedAt: new Date().toISOString()
    };
  }

  async function submitMaintenanceToFirestore(payload) {
    await db.collection("maintenances").add({
      maintenanceNumber: `MAN-${Date.now()}`,
      requesterId: payload.requesterId,
      requesterCpf: payload.requesterCpf || "",
      requesterName: payload.requesterName,
      requesterSector: payload.requesterSector,
      equipment: payload.item,
      sector: payload.requesterSector,
      location: payload.location,
      description: `[${payload.kind}] ${payload.description}`,
      priority: payload.priority,
      status: "ABERTA",
      assignedTo: payload.assignedTo || "",
      assignedToName: payload.assignedToName || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      source: "mobile-offline"
    });
  }

  function savePendingMaintenance(payload) {
    state.pendingMaintenances.unshift({
      ...payload,
      localId: `maint-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    });
    persistUserCache();
  }

  async function syncPendingMaintenances() {
    if (!state.online || !state.pendingMaintenances.length) return;

    const pendingItems = [...state.pendingMaintenances];
    let syncedAny = false;
    for (const item of pendingItems) {
      try {
        await submitMaintenanceToFirestore(item);
        state.pendingMaintenances = state.pendingMaintenances.filter((entry) => entry.localId !== item.localId);
        syncedAny = true;
      } catch (error) {
        console.error("Falha ao sincronizar melhoria pendente:", error);
      }
    }

    if (syncedAny) {
      state.cachedMaintenances = await collectMaintenances();
    }

    persistUserCache();
  }

  async function handleMaintenanceSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const formData = new FormData(form);
      if (!String(formData.get("assignedTo") || "").trim()) {
        showToast("Selecione um líder responsável.", "error");
        submitButton.disabled = false;
        return;
      }

      const payload = buildMaintenancePayload(formData);
      if (state.online) {
        await submitMaintenanceToFirestore(payload);
        await cacheRemoteData();
        persistUserCache();
        showToast("Sugestão enviada com sucesso.", "success");
      } else {
        savePendingMaintenance(payload);
        showToast("Sugestão salva no celular. Ela será enviada quando a internet voltar.", "info");
      }

      state.currentMaintenancePage = 1;
      state.maintenanceView = "emitted";
      state.activeTab = "maintenances";
      state.maintenanceDraft = null;
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar melhoria:", error);
      showToast(`Erro ao salvar sugestão: ${error.message}`, "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function handleRidSubmit(event) {
    event.preventDefault();
    if (state.actionOverlay) return;
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      await syncConnectivityState();

      const formData = new FormData(form);
      const imageField = (state.ridFormSchema || []).find((field) => field.type === "file");
      const status = String(formData.get("status") || "").toUpperCase();
      const leaderId = formData.get("responsibleLeader") || "";

      if (status === "VENCIDO" && !leaderId) {
        showToast("Para RID vencido, selecione um líder.", "error");
        return;
      }

      const payload = buildRidPayload(formData);
      payload.image = await prepareRidImage(formData.get(imageField?.key || "imageFile"));
      payload.imageDataUrl = payload.image?.dataUrl || "";

      if (state.online) {
        const authenticated = await hasAuthenticatedOnlineSession();
        if (!authenticated) {
          setActionOverlay("Salvando localmente", "Sua sessao expirou e o RID sera guardado no celular.");
          savePendingRid(payload);
          showToast("Sua sessão expirou. RID salva no celular. Entre novamente e sincronize.", "info");
          state.currentPage = 1;
          state.ridDraft = null;
          closeModal();
          return;
        }

        setActionOverlay("Enviando RID", "Aguarde enquanto o envio é concluído.");
        await submitRidToFirestore(payload);

        try {
          await cacheRemoteData();
          showToast("RID enviada com sucesso.", "success");
        } catch (cacheError) {
          console.error("RID enviada, mas houve falha ao atualizar o cache local:", cacheError);
          showToast("RID enviada com sucesso, mas o cache do celular nao foi atualizado.", "info");
        }
      } else {
        setActionOverlay("Salvando localmente", "Seu RID está sendo guardado offline.");
        savePendingRid(payload);
        showToast("RID salva no celular. Sincronize quando voltar a internet.", "info");
      }

      state.currentPage = 1;
      state.ridDraft = null;
      closeModal();
    } catch (error) {
      console.error("Erro ao enviar RID:", error);
      showToast(`Erro ao salvar RID: ${error.message}`, "error");
    } finally {
      await clearActionOverlay();
      submitButton.disabled = false;
    }
  }

  async function syncPendingRid(localId, options = {}) {
    const { useOverlay = true } = options;
    if (state.actionOverlay && useOverlay) return;
    const pending = state.pendingRids.find((item) => item.localId === localId);
    if (!pending) return;
    if (!state.online) {
      showToast("Conecte-se à internet para sincronizar.", "error");
      return;
    }

    try {
      if (useOverlay) {
        setActionOverlay("Sincronizando RID", "Aguarde enquanto o envio é concluído.");
      }
      await submitRidToFirestore(pending);
      state.pendingRids = state.pendingRids.filter((item) => item.localId !== localId);
      await cacheRemoteData();
      persistUserCache();
      renderApp();
      showToast("RID sincronizada com sucesso.", "success");
    } catch (error) {
      console.error("Erro ao sincronizar RID:", error);
      showToast(`Falha ao sincronizar: ${error.message}`, "error");
    } finally {
      if (useOverlay) {
        await clearActionOverlay();
      }
    }
  }

  async function syncAllPendingRids() {
    if (state.actionOverlay) return;
    if (!state.pendingRids.length) {
      showToast("Nenhum RID pendente para sincronizar.", "info");
      return;
    }

    if (!state.online) {
      showToast("Você está offline.", "error");
      return;
    }

    setActionOverlay("Sincronizando pendências", "Não feche a tela até terminar.");
    try {
      for (const item of [...state.pendingRids]) {
        await syncPendingRid(item.localId, { useOverlay: false });
      }
    } finally {
      await clearActionOverlay();
    }
  }

  async function refreshData() {
    await refreshOfflineExperience({ showSuccessToast: true, showErrorToast: true });
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      await syncConnectivityState();
      const cpf = form.cpf.value;
      const password = form.password.value;

      if (state.online) {
        const email = cpfToEmail(cpf);
        const credential = await auth.signInWithEmailAndPassword(email, password);
        const userDoc = await db.collection("users").doc(credential.user.uid).get();
        if (!userDoc.exists) {
          throw new Error("Usuário não encontrado na base.");
        }

        state.currentUser = { uid: credential.user.uid };
        state.currentUserData = { id: credential.user.uid, ...userDoc.data() };
        loadUserCache(credential.user.uid);

        setOfflineAuth({
          uid: credential.user.uid,
          cpf: normalizeCpf(cpf),
          passwordHash: await sha256(password),
          userData: state.currentUserData
        });
        setLastSession({
          uid: credential.user.uid,
          userData: state.currentUserData
        });

        const announcementPromise = maybeShowGlobalAnnouncement();
        const cachePromise = cacheRemoteData();
        await announcementPromise;
        await cachePromise;
        startRealtimeRidSync();
        renderApp();
        await initializeMobilePushNotifications();
        showToast("Login realizado.", "success");
      } else {
        const offlineAuth = getOfflineAuth();
        if (!offlineAuth) {
          throw new Error("Sem cache local. Faça o primeiro login com internet.");
        }

        const cpfMatches = offlineAuth.cpf === normalizeCpf(cpf);
        const passwordMatches = offlineAuth.passwordHash === await sha256(password);
        if (!cpfMatches || !passwordMatches) {
          throw new Error("CPF ou senha não conferem com o cache local.");
        }

        state.currentUser = { uid: offlineAuth.uid };
        state.currentUserData = offlineAuth.userData;
        loadUserCache(offlineAuth.uid);
        setLastSession({
          uid: offlineAuth.uid,
          userData: offlineAuth.userData
        });
        await maybeShowGlobalAnnouncement();
        renderApp();
        showToast("Modo offline liberado com dados locais.", "info");
      }
    } catch (error) {
      console.error("Erro de login:", error);
      showToast(error.message || "Falha ao entrar.", "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function logout() {
    try {
      stopRealtimeRidSync();
      await disableMobilePushToken();
      if (state.online) {
        await auth.signOut();
      }
    } catch (error) {
      console.warn("Falha ao sair do Firebase:", error);
    } finally {
      clearOfflineAuth();
      clearLastSession();
      removeAnnouncementModal();
      state.currentUser = null;
      state.currentUserData = null;
      state.cachedRids = [];
      state.cachedMaintenances = [];
      state.cachedAssignedRids = [];
      state.pendingRids = [];
      state.pendingMaintenances = [];
      state.currentPage = 1;
      state.currentMaintenancePage = 1;
      state.currentAssignedPage = 1;
      state.activeTab = "rids";
      state.maintenanceView = "emitted";
      state.modalOpen = false;
      state.maintenanceModalOpen = false;
      state.selectedRidId = null;
      state.selectedMaintenanceId = null;
      state.selectedAssignedRidId = null;
      renderLogin();
    }
  }

  function openRidModal() {
    state.modalOpen = true;
    state.maintenanceModalOpen = false;
    state.selectedRidId = null;
    state.selectedMaintenanceId = null;
    state.selectedAssignedRidId = null;
    renderApp();
  }

  function openMaintenanceModal() {
    state.maintenanceModalOpen = true;
    state.modalOpen = false;
    state.selectedRidId = null;
    state.selectedMaintenanceId = null;
    state.selectedAssignedRidId = null;
    renderApp();
  }

  function setActiveTab(tab) {
    const allowedTabs = canSeeAssignedRids() ? ["rids", "maintenances", "assigned"] : ["rids", "maintenances"];
    if (!allowedTabs.includes(tab)) return;
    const currentIndex = allowedTabs.indexOf(state.activeTab);
    const nextIndex = allowedTabs.indexOf(tab);
    state.tabTransitionDirection = nextIndex > currentIndex ? "forward" : nextIndex < currentIndex ? "backward" : "none";
    state.activeTab = tab;
    renderApp();
  }

  function setMaintenanceView(view) {
    if (!["emitted", "designated"].includes(view)) return;
    state.tabTransitionDirection = "forward";
    state.maintenanceView = view;
    state.currentMaintenancePage = 1;
    renderApp();
  }

  function closeModal() {
    state.modalOpen = false;
    state.maintenanceModalOpen = false;
    state.ridDraft = null;
    state.maintenanceDraft = null;
    state.selectedRidId = null;
    state.selectedMaintenanceId = null;
    state.selectedAssignedRidId = null;
    state.imageViewerSrc = "";
    state.imageViewerScale = 1;
    state.imageViewerOffsetX = 0;
    state.imageViewerOffsetY = 0;
    state.imageViewerDragging = false;
    state.imageViewerPinchDistance = 0;
    renderApp();
  }

  function clampImageViewerScale(value) {
    return Math.min(4, Math.max(1, value));
  }

  function openImageViewer(src) {
    if (!src) return;
    state.imageViewerSrc = src;
    state.imageViewerScale = 1;
    state.imageViewerOffsetX = 0;
    state.imageViewerOffsetY = 0;
    state.imageViewerDragging = false;
    state.imageViewerPinchDistance = 0;
    renderApp();
  }

  function closeImageViewer() {
    state.imageViewerSrc = "";
    state.imageViewerScale = 1;
    state.imageViewerOffsetX = 0;
    state.imageViewerOffsetY = 0;
    state.imageViewerDragging = false;
    state.imageViewerPinchDistance = 0;
    renderApp();
  }

  function applyImageViewerTransform() {
    const image = document.getElementById("mobile-image-viewer-image");
    if (!image) return;
    image.style.transform = `translate(${state.imageViewerOffsetX}px, ${state.imageViewerOffsetY}px) scale(${state.imageViewerScale})`;
  }

  function setImageViewerScale(value) {
    state.imageViewerScale = clampImageViewerScale(value);
    if (state.imageViewerScale <= 1) {
      state.imageViewerOffsetX = 0;
      state.imageViewerOffsetY = 0;
      state.imageViewerDragging = false;
    }
    applyImageViewerTransform();
  }

  function getTouchDistance(touchA, touchB) {
    const deltaX = touchA.clientX - touchB.clientX;
    const deltaY = touchA.clientY - touchB.clientY;
    return Math.hypot(deltaX, deltaY);
  }

  function bindImageViewerTouch() {
    const stage = document.getElementById("mobile-image-viewer-stage");
    if (!stage) return;

    stage.addEventListener("touchstart", (event) => {
      if (event.touches.length === 2) {
        state.imageViewerPinchDistance = getTouchDistance(event.touches[0], event.touches[1]);
        state.imageViewerPinchStartScale = state.imageViewerScale;
        state.imageViewerDragging = false;
        return;
      }

      if (event.touches.length === 1 && state.imageViewerScale > 1) {
        const touch = event.touches[0];
        state.imageViewerDragging = true;
        state.imageViewerDragStartX = touch.clientX - state.imageViewerOffsetX;
        state.imageViewerDragStartY = touch.clientY - state.imageViewerOffsetY;
      }
    }, { passive: true });

    stage.addEventListener("touchmove", (event) => {
      if (event.touches.length === 2 && state.imageViewerPinchDistance > 0) {
        event.preventDefault();
        const nextDistance = getTouchDistance(event.touches[0], event.touches[1]);
        const ratio = nextDistance / state.imageViewerPinchDistance;
        setImageViewerScale(state.imageViewerPinchStartScale * ratio);
        return;
      }

      if (event.touches.length === 1 && state.imageViewerDragging && state.imageViewerScale > 1) {
        event.preventDefault();
        const touch = event.touches[0];
        state.imageViewerOffsetX = touch.clientX - state.imageViewerDragStartX;
        state.imageViewerOffsetY = touch.clientY - state.imageViewerDragStartY;
        applyImageViewerTransform();
      }
    }, { passive: false });

    stage.addEventListener("touchend", () => {
      if (state.imageViewerPinchDistance > 0) {
        state.imageViewerPinchDistance = 0;
      }
      state.imageViewerDragging = false;
    });

    stage.addEventListener("touchend", (event) => {
      if (event.target?.id === "mobile-image-viewer-stage" && event.changedTouches.length === 1) {
        closeImageViewer();
      }
    });
  }

  function openRidDetails(ridId) {
    state.selectedRidId = ridId;
    state.selectedMaintenanceId = null;
    renderApp();
  }

  function openMaintenanceDetails(maintenanceId) {
    state.selectedMaintenanceId = maintenanceId;
    state.selectedRidId = null;
    state.selectedAssignedRidId = null;
    renderApp();
  }

  function openAssignedRidDetails(ridId) {
    state.selectedAssignedRidId = ridId;
    state.selectedRidId = null;
    state.selectedMaintenanceId = null;
    renderApp();
  }

  function getSelectedRid() {
    if (!state.selectedRidId) return null;
    return getCombinedRids().find((item) => {
      if (item.localId && item.localId === state.selectedRidId) return true;
      return item.id === state.selectedRidId;
    }) || null;
  }

  function getSelectedMaintenance() {
    if (!state.selectedMaintenanceId) return null;
    return getCombinedMaintenances().find((item) => {
      if (item.localId && item.localId === state.selectedMaintenanceId) return true;
      return item.id === state.selectedMaintenanceId;
    }) || null;
  }

  function getSelectedAssignedRid() {
    if (!state.selectedAssignedRidId) return null;
    return getAssignedRids().find((item) => item.id === state.selectedAssignedRidId) || null;
  }

  function renderLogin() {
    const offlineAuth = getOfflineAuth();
    const offlineReady = Boolean(offlineAuth?.uid && offlineAuth?.cpf);
    app.innerHTML = `
      <main class="app-shell">
        <section class="login-shell">
          <article class="hero-card">
            <div class="brand-mark">
              <img class="brand-mark-image" src="icon-192.png" alt="RID">
            </div>
            <h1 class="hero-title">Sistema RID's Natical</h1>
            <p class="hero-copy">
              Fa&ccedil;a o primeiro acesso com internet para baixar seus RIDs. Depois disso, o mesmo CPF e senha podem liberar o modo offline neste aparelho.
            </p>
            <div class="row-actions">
              <span class="offline-ready-pill ${offlineReady ? "ready" : "not-ready"}">
                ${offlineReady ? "Pronto para abrir sem internet" : "Ainda n&atilde;o est&aacute; pronto sem internet"}
              </span>
              ${offlineAuth ? `<span class="tiny-pill online">Cache pronto para ${maskCpf(offlineAuth.cpf)}</span>` : ""}
            </div>
            <form id="login-form" class="form-grid">
              <div class="field">
                <label for="cpf">CPF</label>
                <input id="cpf" name="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" required>
              </div>
              <div class="field">
                <label for="password">Senha</label>
                <input id="password" name="password" type="password" inputmode="numeric" maxlength="6" placeholder="******" required>
              </div>
              <div class="actions">
                <button class="btn btn-primary" type="submit">Entrar</button>
              </div>
              <p class="helper-text">
                Sem internet e sem cache anterior, o login offline n&atilde;o consegue validar o usu&aacute;rio.
              </p>
            </form>
            <span class="status-pill login-status-pill ${state.online ? "online" : "offline"}">${state.online ? "Online" : "Offline"}</span>
          </article>
        </section>
      </main>
    `;

    document.getElementById("login-form").addEventListener("submit", handleLogin);
    clearAutoFocus();
  }

  function renderRidCard(item) {
    const badgeClass = getBadgeClass(item.status, item.isPendingLocal);
    const immediateAction = String(item.immediateAction || "").trim();
    const correctiveActions = String(item.correctiveActions || "").trim();
    const correctedAtCreation =
      String(item.status || "").toUpperCase() === "CORRIGIDO" &&
      !correctiveActions &&
      immediateAction;
    const syncButton = item.isPendingLocal ? `
      <button
        class="btn btn-small ${state.online ? "btn-primary" : "btn-soft"}"
        data-sync-rid="${escapeHtml(item.localId)}"
        ${state.online ? "" : "disabled"}
      >
        Sincronizar
      </button>
    ` : "";

    return `
      <article class="rid-card" data-open-rid="${escapeHtml(item.localId || item.id)}" style="cursor:pointer;">
        <div class="rid-head">
          <div>
            <h3 class="rid-title">${item.ridNumber ? `RID #${escapeHtml(formatRidNumber(item.ridNumber))}` : "RID pendente"}</h3>
          </div>
          <span class="badge ${badgeClass}">${getStatusLabel(item)}</span>
        </div>
        <div class="rid-meta">
          <span class="muted">${formatDate(item.emissionDate || item.localCreatedAt || item.createdAt)}</span>
        </div>
        ${correctedAtCreation ? `
          <p class="rid-local-note" style="color:#8a6717;">
            <strong>Ação imediata:</strong> ${escapeHtml(immediateAction)}
          </p>
        ` : ""}
        ${correctiveActions ? `
          <p class="rid-local-note" style="color:#35653b;">
            <strong>Ação corretiva:</strong> ${escapeHtml(correctiveActions)}
          </p>
        ` : ""}
        <div class="rid-foot">
          ${item.isPendingLocal
            ? '<span class="muted">Salva localmente no aparelho.</span>'
            : '<span></span>'}
          ${syncButton}
        </div>
      </article>
    `;
  }

  function getMaintenanceBadgeClass(item) {
    if (item.isPendingLocal) return "pending";
    const status = String(item.status || "").toUpperCase();
    if (status.includes("CONCLU")) return "corrected";
    if (status.includes("ANDAMENTO")) return "synced";
    if (status.includes("CANCEL")) return "closed";
    return "overdue";
  }

  function getMaintenanceStatusLabel(item) {
    if (item.isPendingLocal) return "PENDENTE SYNC";
    return String(item.status || "ABERTA");
  }

  function renderMaintenanceCard(item) {
    return `
      <article class="rid-card" data-open-maintenance="${escapeHtml(item.localId || item.id)}" style="cursor:pointer;">
        <div class="rid-head">
          <div>
            <h3 class="rid-title">${escapeHtml(item.maintenanceNumber || "Sugestão pendente")}</h3>
          </div>
          <span class="badge ${getMaintenanceBadgeClass(item)}">${escapeHtml(getMaintenanceStatusLabel(item))}</span>
        </div>
        <div class="rid-meta">
          <span class="muted">${formatDate(item.localCreatedAt || item.createdAt || item.updatedAt)}</span>
        </div>
      </article>
    `;
  }

  function renderPagination(pageData) {
    if (pageData.totalPages <= 1) return "";

    return `
      <div class="pagination">
        <button class="btn btn-soft btn-small" data-page-nav="prev" ${pageData.page === 1 ? "disabled" : ""}>Anterior</button>
        <span class="muted">Página ${pageData.page} de ${pageData.totalPages}</span>
        <button class="btn btn-soft btn-small" data-page-nav="next" ${pageData.page === pageData.totalPages ? "disabled" : ""}>Próxima</button>
      </div>
    `;
  }

  function renderMaintenancePagination(pageData) {
    if (pageData.totalPages <= 1) return "";

    return `
      <div class="pagination">
        <button class="btn btn-soft btn-small" data-maintenance-page-nav="prev" ${pageData.page === 1 ? "disabled" : ""}>Anterior</button>
        <span class="muted">Página ${pageData.page} de ${pageData.totalPages}</span>
        <button class="btn btn-soft btn-small" data-maintenance-page-nav="next" ${pageData.page === pageData.totalPages ? "disabled" : ""}>Próxima</button>
      </div>
    `;
  }

  function renderAssignedRidCard(item) {
    return `
      <article class="rid-card" data-open-assigned-rid="${escapeHtml(item.id)}" style="cursor:pointer;">
        <div class="rid-head">
          <div>
            <h3 class="rid-title">${item.ridNumber ? `RID #${escapeHtml(formatRidNumber(item.ridNumber))}` : "RID sem número"}</h3>
          </div>
          <span class="badge ${getBadgeClass(item.status, false)}">${getStatusLabel(item)}</span>
        </div>
        <div class="rid-meta">
          <span class="muted">${formatDate(item.emissionDate || item.createdAt)}</span>
        </div>
      </article>
    `;
  }

  function renderAssignedPagination(pageData) {
    if (pageData.totalPages <= 1) return "";

    return `
      <div class="pagination">
        <button class="btn btn-soft btn-small" data-assigned-page-nav="prev" ${pageData.page === 1 ? "disabled" : ""}>Anterior</button>
        <span class="muted">Página ${pageData.page} de ${pageData.totalPages}</span>
        <button class="btn btn-soft btn-small" data-assigned-page-nav="next" ${pageData.page === pageData.totalPages ? "disabled" : ""}>Próxima</button>
      </div>
    `;
  }

  function renderRidModal() {
    if (!state.modalOpen) return "";

    const today = new Date().toISOString().slice(0, 10);
    const fieldsHtml = (state.ridFormSchema || []).map((field) => renderRidModalField(field, today)).join("");
    return `
      <div class="modal-root" id="rid-modal">
        <div class="modal-card">
          <div class="modal-head">
            <h2>Novo RID</h2>
            <button type="button" class="close-btn" data-close-modal="true">x</button>
          </div>
          <form id="rid-form" class="form-grid">
            <div class="field">
              <label>Emitente</label>
              <input value="${escapeHtml(state.currentUserData.name || "")}" readonly>
            </div>
            ${fieldsHtml}
            <div class="actions">
              <button class="btn btn-success" type="submit">${state.online ? "Emitir RID" : "Emitir (pendente)"}</button>
              <button class="btn btn-soft" type="button" data-close-modal="true">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const leaderOptions = state.leaders.length
      ? state.leaders.map((leader) => `<option value="${escapeHtml(leader.id)}">${escapeHtml(leader.name || "Líder")}</option>`).join("")
      : '<option value="">Nenhum líder disponível no cache</option>';

    return `
      <div class="modal-root" id="rid-modal">
        <div class="modal-card">
          <div class="modal-head">
            <h2>Novo RID</h2>
            <button type="button" class="close-btn" data-close-modal="true">×</button>
          </div>
          <form id="rid-form" class="form-grid">
            <div class="field">
              <label>Emitente</label>
              <input value="${escapeHtml(state.currentUserData.name || "")}" readonly>
            </div>
            <div class="field">
              <label>Tipo de contrato</label>
              <select name="contractType" required>
                <option value="">Selecione...</option>
                <option value="Funcionário">Funcionário</option>
                <option value="Terceiro Contratado">Terceiro Contratado</option>
                <option value="Terceiro Eventual">Terceiro Eventual</option>
                <option value="Visitante">Visitante</option>
              </select>
            </div>
            <div class="field">
              <label>Unidade</label>
              <select name="unit" required>
                <option value="">Selecione...</option>
                <option value="CALTINS">CALTINS</option>
                <option value="CALTINS XAMBIOA II">CALTINS XAMBIOA II</option>
                <option value="FORMACAL">FORMACAL</option>
                <option value="GESSOTINS">GESSOTINS</option>
                <option value="MINERAX">MINERAX</option>
                <option value="NATICAL">NATICAL</option>
                <option value="SUPERCAL">SUPERCAL</option>
              </select>
            </div>
            <div class="field">
              <label>Data</label>
              <input type="date" name="emissionDate" value="${today}" required>
            </div>
            <div class="field">
              <label>Incidente ou desvio</label>
              <select name="incidentType" required>
                <option value="">Selecione...</option>
                <option value="Condição de Risco">Condição de Risco</option>
                <option value="Desvio Comportamental">Desvio Comportamental</option>
                <option value="Dano Material">Dano Material</option>
                <option value="Quase acidente">Quase acidente</option>
              </select>
            </div>
            <div class="field">
              <label>Origem da detecção</label>
              <select name="detectionOrigin" required>
                <option value="">Selecione...</option>
                <option value="CSL">CSL</option>
                <option value="Inspeção programada">Inspeção programada</option>
                <option value="Inspeção não programada">Inspeção não programada</option>
                <option value="Observação Comportamental">Observação Comportamental</option>
                <option value="Constatação espontânea">Constatação espontânea</option>
                <option value="Auditoria">Auditoria</option>
              </select>
            </div>
            <div class="field">
              <label>Local</label>
              <input name="location" required placeholder="Local da ocorrência">
            </div>
            <div class="field">
              <label>Descrição</label>
              <textarea name="description" required placeholder="Descreva a ocorrência"></textarea>
            </div>
            <div class="field">
              <label>Classificação de risco</label>
              <select name="riskClassification" required>
                <option value="">Selecione...</option>
                <option value="Baixo">Baixo: Situações com baixo potencial de causar acidente.</option>
                <option value="Médio">Médio: Situações que podem causar acidente leve.</option>
                <option value="Alto">Alto: Situações com alto potencial de acidente grave.</option>
                <option value="Crítico">Crítico: Risco iminente de acidente grave ou fatal.</option>
              </select>
            </div>
            <div class="field">
              <label>Ação imediata</label>
              <textarea name="immediateAction" required placeholder="Descreva a ação imediata"></textarea>
            </div>
            <div class="field">
              <label>Imagem da ocorrencia</label>
              <input type="file" name="imageFile" accept="image/*">
              <p class="helper-text">Opcional. Voce pode escolher uma foto da galeria ou tirar na hora, dependendo das opcoes do seu celular.</p>
            </div>
            <div class="field">
              <label>Status inicial</label>
              <select name="status" required>
                <option value="">Selecione...</option>
                <option value="CORRIGIDO">CORRIGIDO</option>
                <option value="VENCIDO">VENCIDO</option>
              </select>
            </div>
            <div class="field">
              <label>Líder responsável</label>
              <select name="responsibleLeader">
                <option value="">Designar depois</option>
                ${leaderOptions}
              </select>
              <p class="helper-text">
                Se o status for VENCIDO, o líder é obrigatório. A lista é carregada do cache local quando estiver offline.
              </p>
            </div>
            <div class="actions">
              <button class="btn btn-success" type="submit">${state.online ? "Emitir RID" : "Emitir (pendente)"}</button>
              <button class="btn btn-soft" type="button" data-close-modal="true">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderMaintenanceModal() {
    if (!state.maintenanceModalOpen) return "";

    const leaderOptions = state.leaders.length
      ? state.leaders.map((leader) => `<option value="${escapeHtml(leader.id)}">${escapeHtml(leader.name || "Líder")}</option>`).join("")
      : '<option value="">Nenhum líder disponível no cache</option>';

    return `
      <div class="modal-root" id="maintenance-modal">
        <div class="modal-card">
          <div class="modal-head">
            <h2>Melhorias</h2>
            <button type="button" class="close-btn" data-close-modal="true">×</button>
          </div>
          <form id="maintenance-form" class="form-grid">
            <div class="field">
              <label>Tipo</label>
              <select name="kind" required>
                <option value="">Selecione...</option>
                <option value="Melhoria">Melhoria</option>
                <option value="Manutenção">Manutenção</option>
              </select>
            </div>
            <div class="field">
              <label>Equipamento ou item</label>
              <input name="item" required placeholder="Ex: corrimão, motor, iluminação">
            </div>
            <div class="field">
              <label>Local</label>
              <input name="location" required placeholder="Onde precisa da ação">
            </div>
            <div class="field">
              <label>Prioridade</label>
              <select name="priority" required>
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA" selected>Média</option>
                <option value="ALTA">Alta</option>
                <option value="CRITICA">Crítica</option>
              </select>
            </div>
            <div class="field">
              <label>Designar para</label>
              <select name="assignedTo" required>
                <option value="">Selecione um líder...</option>
                ${leaderOptions}
              </select>
              <p class="helper-text">A lista usa o cache local quando estiver offline.</p>
            </div>
            <div class="field">
              <label>Descrição</label>
              <textarea name="description" required placeholder="Descreva a melhoria ou manutenção necessária"></textarea>
            </div>
            <div class="actions">
              <button class="btn btn-success" type="submit">Enviar sugestão</button>
              <button class="btn btn-soft" type="button" data-close-modal="true">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderRidDetailsModal() {
    const item = getSelectedRid();
    if (!item) return "";

    const immediateAction = String(item.immediateAction || "").trim();
    const correctiveActions = String(item.correctiveActions || "").trim();
    const deleteReason = String(item.deleteReason || "").trim();
    const deleteRequesterName = String(item.deleteRequesterName || "").trim();
    const deletedByName = String(item.deletedByName || "").trim();
    const deletedByRole = String(item.deletedByRole || "").trim();
    const deletedAt = formatDate(item.deletedAt);
    const correctedAtCreation =
      String(item.status || "").toUpperCase() === "CORRIGIDO" &&
      !correctiveActions &&
      immediateAction;
    const detailFields = getRidDetailsFields(item).map((field) => `
      <div class="field">
        <label>${escapeHtml(field.label)}</label>
        <div class="muted" style="color:#213043;">${escapeHtml(field.value || "Nao informado")}</div>
      </div>
    `).join("");

    return `
      <div class="modal-root" id="rid-details-modal">
        <div class="modal-card">
          <div class="modal-head">
            <h2>${item.ridNumber ? `RID #${escapeHtml(formatRidNumber(item.ridNumber))}` : "RID pendente"}</h2>
            <button type="button" class="close-btn" data-close-modal="true">x</button>
          </div>
          <div class="form-grid" style="margin-top:0;">
            <div class="field">
              <label>Status</label>
              <div class="badge ${getBadgeClass(item.status, item.isPendingLocal)}" style="width:max-content;">
                ${getStatusLabel(item)}
              </div>
            </div>
            ${detailFields}
            ${item.imageDataUrl ? `
              <div class="field" style="grid-column:1 / -1;">
                <label>Imagem da ocorrencia</label>
                <button
                  type="button"
                  data-open-image-viewer="${escapeHtml(item.imageDataUrl)}"
                  style="display:block; width:100%; margin-top:8px; padding:0; border:0; background:transparent;"
                  aria-label="Abrir imagem do RID"
                >
                  <img src="${escapeHtml(item.imageDataUrl)}" alt="Imagem do RID" style="width:100%; border-radius:18px; border:1px solid rgba(148,163,184,0.22);">
                </button>
              </div>
            ` : ""}
            ${item.deleted ? `
              <div class="field">
                <label>Motivo da exclusao</label>
                <div class="muted" style="color:#8b1e3f;">
                  ${escapeHtml(deleteReason || "Motivo nao informado.")}
                </div>
              </div>
              <div class="field">
                <label>Orientacao</label>
                <div class="muted" style="color:#6f4b12;">
                  Para tirar duvidas, entre em contato com o gestor responsavel.
                </div>
              </div>
              <div class="field">
                <label>Solicitado por</label>
                <div class="muted" style="color:#6b7280;">
                  ${escapeHtml(
                    deleteRequesterName
                      ? `${deleteRequesterName} | removido em ${deletedAt}`
                      : deletedByName
                        ? `${deletedByName}${deletedByRole ? ` (${deletedByRole})` : ""} em ${deletedAt}`
                        : `Registro removido em ${deletedAt}`
                  )}
                </div>
              </div>
            ` : ""}
            ${correctedAtCreation ? `
              <div class="field">
                <label>Acao imediata</label>
                <div class="muted" style="color:#8a6717;">${escapeHtml(immediateAction)}</div>
              </div>
            ` : ""}
            ${correctiveActions ? `
              <div class="field">
                <label>Acao corretiva</label>
                <div class="muted" style="color:#35653b;">${escapeHtml(correctiveActions)}</div>
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    `;

    return `
      <div class="modal-root" id="rid-details-modal">
        <div class="modal-card">
          <div class="modal-head">
            <h2>${item.ridNumber ? `RID #${escapeHtml(formatRidNumber(item.ridNumber))}` : "RID pendente"}</h2>
            <button type="button" class="close-btn" data-close-modal="true">×</button>
          </div>
          <div class="form-grid" style="margin-top:0;">
            <div class="field">
              <label>Status</label>
              <div class="badge ${getBadgeClass(item.status, item.isPendingLocal)}" style="width:max-content;">
                ${getStatusLabel(item)}
              </div>
            </div>
            <div class="field">
              <label>Descrição</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.description || "Sem descrição")}</div>
            </div>
            ${item.imageDataUrl ? `
              <div class="field" style="grid-column:1 / -1;">
                <label>Imagem da ocorrencia</label>
                <button
                  type="button"
                  data-open-image-viewer="${escapeHtml(item.imageDataUrl)}"
                  style="display:block; width:100%; margin-top:8px; padding:0; border:0; background:transparent;"
                  aria-label="Abrir imagem do RID"
                >
                  <img src="${escapeHtml(item.imageDataUrl)}" alt="Imagem do RID" style="width:100%; border-radius:18px; border:1px solid rgba(148,163,184,0.22);">
                </button>
              </div>
            ` : ""}
            ${item.deleted ? `
              <div class="field">
                <label>Motivo da exclusão</label>
                <div class="muted" style="color:#8b1e3f;">
                  ${escapeHtml(deleteReason || "Motivo não informado.")}
                </div>
              </div>
              <div class="field">
                <label>Orientação</label>
                <div class="muted" style="color:#6f4b12;">
                  Para tirar dúvidas, entre em contato com o gestor responsável.
                </div>
              </div>
              <div class="field">
                <label>Solicitado por</label>
                <div class="muted" style="color:#6b7280;">
                  ${escapeHtml(
                    deleteRequesterName
                      ? `${deleteRequesterName} · removido em ${deletedAt}`
                      : deletedByName
                        ? `${deletedByName}${deletedByRole ? ` (${deletedByRole})` : ""} em ${deletedAt}`
                        : `Registro removido em ${deletedAt}`
                  )}
                </div>
              </div>
            ` : ""}
            ${correctedAtCreation ? `
              <div class="field">
                <label>Ação imediata</label>
                <div class="muted" style="color:#8a6717;">${escapeHtml(immediateAction)}</div>
              </div>
            ` : ""}
            ${correctiveActions ? `
              <div class="field">
                <label>Ação corretiva</label>
                <div class="muted" style="color:#35653b;">${escapeHtml(correctiveActions)}</div>
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function renderImageViewerModal() {
    if (!state.imageViewerSrc) return "";

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    const viewerBackground = isStandalone ? "rgba(15,23,42,0.62)" : "rgba(15,23,42,0.94)";

    return `
      <div class="modal-root" id="mobile-image-viewer" style="background:${viewerBackground}; padding:0; z-index:1300;">
        <div
          id="mobile-image-viewer-stage"
          style="
            width:100vw;
            height:100vh;
            overflow:hidden;
            display:flex;
            align-items:center;
            justify-content:center;
            touch-action:none;
            background:transparent;
          "
        >
          <img
            id="mobile-image-viewer-image"
            src="${escapeHtml(state.imageViewerSrc)}"
            alt="Imagem ampliada do RID"
            style="
              max-width:100vw;
              max-height:100vh;
              width:auto;
              height:auto;
              transform:translate(${state.imageViewerOffsetX}px, ${state.imageViewerOffsetY}px) scale(${state.imageViewerScale});
              transform-origin:center center;
              will-change:transform;
            "
          >
        </div>
      </div>
    `;
  }

  function renderMaintenanceDetailsModal() {
    const item = getSelectedMaintenance();
    if (!item) return "";

    const cleanDescription = String(item.description || "").replace(/^\[[^\]]+\]\s*/, "");

    return `
      <div class="modal-root" id="maintenance-details-modal">
        <div class="modal-card">
          <div class="modal-head">
            <h2>${escapeHtml(item.maintenanceNumber || "Sugestão pendente")}</h2>
            <button type="button" class="close-btn" data-close-modal="true">×</button>
          </div>
          <div class="form-grid" style="margin-top:0;">
            <div class="field">
              <label>Status</label>
              <div class="badge ${getMaintenanceBadgeClass(item)}" style="width:max-content;">
                ${escapeHtml(getMaintenanceStatusLabel(item))}
              </div>
            </div>
            <div class="field">
              <label>Data de emissão</label>
              <div class="muted" style="color:#213043;">${escapeHtml(formatDate(item.localCreatedAt || item.createdAt || item.updatedAt))}</div>
            </div>
            <div class="field">
              <label>Tipo</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.kind || "Não informado")}</div>
            </div>
            <div class="field">
              <label>Equipamento ou item</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.item || "Não informado")}</div>
            </div>
            <div class="field">
              <label>Local</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.location || "Não informado")}</div>
            </div>
            <div class="field">
              <label>Prioridade</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.priority || "Não informada")}</div>
            </div>
            <div class="field">
              <label>Responsável</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.assignedToName || "Não informado")}</div>
            </div>
            <div class="field">
              <label>Descrição</label>
              <div class="muted" style="color:#213043;">${escapeHtml(cleanDescription || "Sem descrição")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAssignedRidDetailsModal() {
    const item = getSelectedAssignedRid();
    if (!item) return "";

    return `
      <div class="modal-root" id="assigned-rid-details-modal">
        <div class="modal-card">
          <div class="modal-head">
            <h2>${item.ridNumber ? `RID #${escapeHtml(formatRidNumber(item.ridNumber))}` : "RID designado"}</h2>
            <button type="button" class="close-btn" data-close-modal="true">×</button>
          </div>
          <div class="form-grid" style="margin-top:0;">
            <div class="field">
              <label>Status</label>
              <div class="badge ${getBadgeClass(item.status, false)}" style="width:max-content;">
                ${getStatusLabel(item)}
              </div>
            </div>
            <div class="field">
              <label>Data de emissão</label>
              <div class="muted" style="color:#213043;">${escapeHtml(formatDate(item.emissionDate || item.createdAt))}</div>
            </div>
            <div class="field">
              <label>Quem emitiu</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.emitterName || "Não informado")}</div>
            </div>
            <div class="field">
              <label>Local</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.location || "Não informado")}</div>
            </div>
            <div class="field">
              <label>Descrição</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.description || "Sem descrição")}</div>
            </div>
            <div class="field">
              <label>Ação imediata</label>
              <div class="muted" style="color:#213043;">${escapeHtml(item.immediateAction || "Não informada")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTabbedSection(pageData, maintenancePageData, assignedPageData) {
    const isRidsTab = state.activeTab === "rids";
    const isMaintenanceTab = state.activeTab === "maintenances";
    const isAssignedTab = state.activeTab === "assigned";
    const canToggleMaintenance = canSeeAssignedRids();
    const secondaryTitle = "Sugestões de melhorias";
    const showActionButton = isRidsTab || isMaintenanceTab;
    const transitionClass =
      state.tabTransitionDirection === "forward"
        ? "slide-forward"
        : state.tabTransitionDirection === "backward"
          ? "slide-backward"
          : "";
    return `
      <section class="section">
        <div class="section-header">
          <div class="tabbed-section-head">
            <h2 class="section-title" style="white-space:nowrap; margin-bottom:10px;">${isRidsTab ? "Meus RIDs" : isMaintenanceTab ? secondaryTitle : "RIDs designados vencidos"}</h2>
            ${isMaintenanceTab && canToggleMaintenance ? `
              <div class="tab-switcher maintenance-switcher" role="tablist" aria-label="Filtro de melhorias">
                <button class="tab-chip ${state.maintenanceView === "emitted" ? "active" : ""}" data-maintenance-view="emitted" role="tab" aria-selected="${state.maintenanceView === "emitted" ? "true" : "false"}">Emitidas</button>
                <button class="tab-chip ${state.maintenanceView === "designated" ? "active" : ""}" data-maintenance-view="designated" role="tab" aria-selected="${state.maintenanceView === "designated" ? "true" : "false"}">Designadas</button>
              </div>
            ` : ""}
          </div>
        </div>
        <div class="mobile-tab-panel ${transitionClass}" id="mobile-tab-panel">
          ${showActionButton ? `
            <div class="page-actions page-actions-nowrap">
              ${isRidsTab
                ? '<button class="btn btn-success" id="new-rid-btn" style="flex:1;">Novo RID</button>'
                : '<button class="btn btn-success" id="maintenance-btn" style="flex:1;">Nova melhoria</button>'}
            </div>
          ` : ""}
          <article class="panel">
            ${isRidsTab
              ? (pageData.totalItems
                ? `<div class="rid-list">${pageData.items.map(renderRidCard).join("")}</div>${renderPagination(pageData)}`
                : '<div class="empty-state">Nenhum RID disponível no cache local.</div>')
              : isMaintenanceTab
                ? (maintenancePageData.totalItems
                  ? `<div class="rid-list">${maintenancePageData.items.map(renderMaintenanceCard).join("")}</div>${renderMaintenancePagination(maintenancePageData)}`
                  : `<div class="empty-state">${canSeeAssignedRids() ? (state.maintenanceView === "designated" ? "Nenhuma melhoria designada para este usuário." : "Nenhuma melhoria emitida por este usuário.") : "Nenhuma sugestão de melhoria encontrada para este usuário."}</div>`)
                : (assignedPageData.totalItems
                  ? `<div class="rid-list">${assignedPageData.items.map(renderAssignedRidCard).join("")}</div>${renderAssignedPagination(assignedPageData)}`
                  : '<div class="empty-state">Nenhum RID vencido designado para este usuário.</div>')}
          </article>
        </div>
      </section>
    `;
  }

  function renderApp() {
    const pageData = getPaginatedRids();
    const maintenancePageData = getPaginatedMaintenances();
    const assignedPageData = getPaginatedAssignedRids();
    const stats = calcStats();
    const monthProgress = calcCurrentMonthProgress();
    const lastSyncLabel = getLastSyncLabel();
    const showPerformanceSection = state.activeTab === "rids";

    app.innerHTML = `
      <main class="app-shell">
        <section class="mobile-shell">
          <header class="topbar panel">
            <div class="topbar-meta">
              <h1 style="font-size:1.1rem; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(state.currentUserData.name || "Usuário")}
              </h1>
              <span class="muted" style="font-size:0.84rem;">${escapeHtml(state.currentUserData.userType || "Funcionário")}</span>
              <span class="muted" style="font-size:0.84rem;">${escapeHtml(state.currentUserData.sector || "Sem setor")}</span>
            </div>
            <div class="topbar-actions">
              <div class="topbar-action-row">
                <span class="status-pill ${state.online ? "online" : "offline"}">${state.online ? "Online" : "Offline"}</span>
                <button class="btn btn-danger btn-small" id="logout-btn">Sair</button>
              </div>
              <button class="btn btn-soft btn-small btn-cache" id="offline-cache-btn" ${state.offlineBundleUpdating ? "disabled" : ""}>
                ${state.offlineBundleUpdating ? "Atualizando offline..." : "Baixar offline"}
              </button>
              <div class="topbar-cache-note">${escapeHtml(lastSyncLabel)}</div>
            </div>
          </header>

          ${!state.online ? `
            <div class="offline-banner">
              Sem internet: seus RIDs vieram do cache local. Novos RIDs ficam pendentes até você clicar em sincronizar.
            </div>
          ` : ""}

          ${renderPushPermissionBanner()}

          ${showPerformanceSection ? `
            <section class="section">
              <div class="section-header">
                <h2 class="section-title" style="white-space:nowrap;">Meu desempenho</h2>
              </div>
              <div class="stats-grid">
                <article class="stats-card red-soft">
                  <div class="stats-label">Total</div>
                  <div class="stats-value">${stats.total}</div>
                  <div class="stats-foot">Inclui pendentes locais</div>
                </article>
                <article class="stats-card blue-soft">
                  <div class="stats-label">Corrigidos</div>
                  <div class="stats-value">${stats.corrected}</div>
                  <div class="stats-foot">RIDs concluídos na base</div>
                </article>
                <article class="stats-card green-soft">
                  <div class="stats-label">Pendentes sync</div>
                  <div class="stats-value">${stats.pendingSync}</div>
                  <div class="stats-foot">Salvos no aparelho</div>
                </article>
                <article class="stats-card yellow-soft">
                  <div class="stats-label">Em aberto</div>
                  <div class="stats-value">${stats.overdue}</div>
                  <div class="stats-foot">RIDs vencidos ou em andamento</div>
                </article>
              </div>
              <div style="
                margin-top:10px;
                font-size:0.78rem;
                line-height:1.35;
                padding:10px 12px;
                border-radius:999px;
                background:${monthProgress.hitGoal ? "#eef9ea" : "#fff7e8"};
                border:1px solid ${monthProgress.hitGoal ? "#cfe8c8" : "#f1ddb0"};
                color:${monthProgress.hitGoal ? "#35653b" : "#8a6717"};
              ">
                Você emitiu <strong>${monthProgress.emittedThisMonth}</strong> RID${monthProgress.emittedThisMonth === 1 ? "" : "s"} no mês atual.
                Sua meta é <strong>${monthProgress.goal}</strong>.
                <strong>${monthProgress.hitGoal ? "Meta atingida" : "Meta não atingida"}</strong>.
              </div>
            </section>
          ` : ""}

          ${renderTabbedSection(pageData, maintenancePageData, assignedPageData)}
        </section>
        ${renderRidModal()}
        ${renderMaintenanceModal()}
        ${renderRidDetailsModal()}
        ${renderImageViewerModal()}
        ${renderMaintenanceDetailsModal()}
        ${renderAssignedRidDetailsModal()}
      </main>
    `;

    bindAppEvents();
    clearAutoFocus();
    state.tabTransitionDirection = "none";
  }

  function bindAppEvents() {
    document.getElementById("logout-btn")?.addEventListener("click", logout);
    document.getElementById("offline-cache-btn")?.addEventListener("click", () => {
      refreshOfflineExperience({ showSuccessToast: true, showErrorToast: true });
    });
    document.getElementById("new-rid-btn")?.addEventListener("click", openRidModal);
    document.getElementById("maintenance-btn")?.addEventListener("click", openMaintenanceModal);
    document.querySelectorAll("[data-maintenance-view]").forEach((button) => {
      button.addEventListener("click", () => setMaintenanceView(button.dataset.maintenanceView));
    });
    document.getElementById("enable-mobile-push-btn")?.addEventListener("click", requestMobilePushPermission);
    document.getElementById("dismiss-mobile-push-btn")?.addEventListener("click", () => {
      state.pushPromptDismissed = true;
      renderApp();
    });
    document.getElementById("rid-form")?.addEventListener("submit", handleRidSubmit);
    document.getElementById("maintenance-form")?.addEventListener("submit", handleMaintenanceSubmit);
    bindDraftPersistence("rid-form", "ridDraft");
    bindDraftPersistence("maintenance-form", "maintenanceDraft");

    document.querySelectorAll("[data-sync-rid]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        syncPendingRid(button.dataset.syncRid);
      });
    });

    document.querySelectorAll("[data-open-rid]").forEach((card) => {
      card.addEventListener("click", () => openRidDetails(card.dataset.openRid));
    });

    document.querySelectorAll("[data-open-image-viewer]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openImageViewer(button.dataset.openImageViewer);
      });
    });

    document.querySelectorAll("[data-open-maintenance]").forEach((card) => {
      card.addEventListener("click", () => openMaintenanceDetails(card.dataset.openMaintenance));
    });

    document.querySelectorAll("[data-open-assigned-rid]").forEach((card) => {
      card.addEventListener("click", () => openAssignedRidDetails(card.dataset.openAssignedRid));
    });

    document.querySelectorAll("[data-page-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentPage += button.dataset.pageNav === "next" ? 1 : -1;
        renderApp();
      });
    });

    document.querySelectorAll("[data-maintenance-page-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentMaintenancePage += button.dataset.maintenancePageNav === "next" ? 1 : -1;
        renderApp();
      });
    });

    document.querySelectorAll("[data-assigned-page-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentAssignedPage += button.dataset.assignedPageNav === "next" ? 1 : -1;
        renderApp();
      });
    });

    bindTabSwipe();

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", closeModal);
    });

    document.getElementById("rid-modal")?.addEventListener("click", (event) => {
      if (event.target.id === "rid-modal") closeModal();
    });

    document.getElementById("rid-details-modal")?.addEventListener("click", (event) => {
      if (event.target.id === "rid-details-modal") closeModal();
    });

    document.getElementById("maintenance-modal")?.addEventListener("click", (event) => {
      if (event.target.id === "maintenance-modal") closeModal();
    });

    document.getElementById("maintenance-details-modal")?.addEventListener("click", (event) => {
      if (event.target.id === "maintenance-details-modal") closeModal();
    });

    document.getElementById("assigned-rid-details-modal")?.addEventListener("click", (event) => {
      if (event.target.id === "assigned-rid-details-modal") closeModal();
    });

    document.querySelector("[data-close-image-viewer=\"true\"]")?.addEventListener("click", closeImageViewer);

    document.getElementById("mobile-image-viewer")?.addEventListener("click", (event) => {
      if (event.target.id === "mobile-image-viewer") closeImageViewer();
    });
    document.getElementById("mobile-image-viewer-stage")?.addEventListener("click", (event) => {
      if (event.target.id === "mobile-image-viewer-stage") closeImageViewer();
    });
    document.getElementById("mobile-image-viewer-stage")?.addEventListener("pointerup", (event) => {
      if (event.target.id === "mobile-image-viewer-stage") closeImageViewer();
    });
    document.getElementById("mobile-image-viewer-stage")?.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.2 : -0.2;
      setImageViewerScale(state.imageViewerScale + delta);
    }, { passive: false });
    bindImageViewerTouch();
  }

  function bindTabSwipe() {
    const surface = document.querySelector(".mobile-shell");
    if (!surface) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    surface.addEventListener("touchstart", (event) => {
      if (event.touches.length !== 1) return;
      if (event.target.closest(".modal-root")) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }, { passive: true });

    surface.addEventListener("touchend", (event) => {
      if (!tracking || !event.changedTouches.length) return;
      tracking = false;
      if (event.target.closest(".modal-root")) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const tabs = canSeeAssignedRids()
        ? ["rids", "maintenances", "assigned"]
        : ["rids", "maintenances"];
      const currentIndex = tabs.indexOf(state.activeTab);

      if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;

      if (deltaX < 0 && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
        return;
      }

      if (deltaX > 0 && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    }, { passive: true });
  }

  async function bootstrapFromFirebaseSession() {
    const sessionUser = auth.currentUser;
    if (!sessionUser || !state.online) return false;

    const userDoc = await db.collection("users").doc(sessionUser.uid).get();
    if (!userDoc.exists) return false;

    state.currentUser = { uid: sessionUser.uid };
    state.currentUserData = { id: sessionUser.uid, ...userDoc.data() };
    loadUserCache(sessionUser.uid);
    await loadRidFormSchema();
    const announcementPromise = maybeShowGlobalAnnouncement();
    const refreshPromise = refreshOfflineExperience({ showSuccessToast: false, showErrorToast: false });
    await announcementPromise;
    await refreshPromise;
    startRealtimeRidSync();
    renderApp();
    await initializeMobilePushNotifications();
    return true;
  }

  function bootstrapFromStoredSession() {
    const session = getLastSession();
    if (!session?.uid || !session?.userData) return false;

    state.currentUser = { uid: session.uid };
    state.currentUserData = session.userData;
    loadUserCache(session.uid);
    void loadRidFormSchema();
    void maybeShowGlobalAnnouncement();
    renderApp();
    return true;
  }

  function waitForInitialAuthState() {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user || null);
      }, () => {
        unsubscribe();
        resolve(null);
      });
    });
  }

  async function hasAuthenticatedOnlineSession() {
    if (!state.online || !state.currentUser?.uid) return false;
    if (auth.currentUser?.uid === state.currentUser.uid) return true;
    const restoredUser = await waitForInitialAuthState();
    return restoredUser?.uid === state.currentUser.uid;
  }

  function updateConnectivity(nextOnline) {
    state.online = nextOnline;
    if (!state.currentUser) {
      renderLogin();
    } else {
      renderApp();
    }

    syncConnectivityState().then((actualOnline) => {
      showToast(actualOnline ? "Internet disponível." : "Modo offline ativo.", actualOnline ? "success" : "info");

      if (actualOnline && state.currentUser) {
        hasAuthenticatedOnlineSession()
          .then((authenticated) => {
            if (!authenticated) {
              stopRealtimeRidSync();
              state.currentUser = null;
              state.currentUserData = null;
              renderLogin();
              showToast("Sua sessão expirou. Entre novamente para continuar online.", "error");
              return;
            }

            return refreshOfflineExperience({ showSuccessToast: false, showErrorToast: true })
              .then(() => {
                startRealtimeRidSync();
                initializeMobilePushNotifications().catch((error) => {
                  console.error("Falha ao inicializar push mobile ao reconectar:", error);
                });
                renderApp();
              });
          })
          .catch((error) => {
            console.error("Falha ao atualizar dados ao reconectar:", error);
            showToast("Não foi possível atualizar os RIDs ao reconectar.", "error");
          });
      } else if (!actualOnline) {
        stopRealtimeRidSync();
      }
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
        updateViaCache: "none"
      });
    } catch (error) {
      console.warn("Falha ao registrar service worker:", error);
    }
  }

  async function init() {
    renderLogin();
    setBooting(true);
    setTimeout(() => {
      if (state.booting) setBooting(false);
    }, 4000);
    await registerServiceWorker();
    await syncConnectivityState();

    window.addEventListener("online", () => updateConnectivity(true));
    window.addEventListener("offline", () => updateConnectivity(false));
    window.addEventListener("focus", () => {
      syncConnectivityState();
    });

    setInterval(() => {
      syncConnectivityState();
    }, CONNECTIVITY_CHECK_INTERVAL);

    try {
      const offlineAuth = getOfflineAuth();
      const restoredFirebaseUser = state.online ? await waitForInitialAuthState() : null;

      if (restoredFirebaseUser && state.online) {
        const restored = await bootstrapFromFirebaseSession();
        if (restored) {
          setBooting(false);
          return;
        }
      }

      if (!state.online && offlineAuth?.uid && offlineAuth?.userData) {
        state.currentUser = { uid: offlineAuth.uid };
        state.currentUserData = offlineAuth.userData;
        loadUserCache(offlineAuth.uid);

        stopRealtimeRidSync();
        setBooting(false);
        renderApp();
        return;
      }

      const fallbackSession = getLastSession();
      if (!state.online && fallbackSession?.uid && fallbackSession?.userData) {
        state.currentUser = { uid: fallbackSession.uid };
        state.currentUserData = fallbackSession.userData;
        loadUserCache(fallbackSession.uid);
        stopRealtimeRidSync();
        setBooting(false);
        renderApp();
        return;
      }

      state.currentUser = null;
      state.currentUserData = null;
      stopRealtimeRidSync();
      renderLogin();
      setBooting(false);
    } catch (error) {
      console.error("Falha ao iniciar app mobile:", error);
      showToast("Não foi possível restaurar a sessão.", "error");
      renderLogin();
      setBooting(false);
    }
  }

  init();
})();


