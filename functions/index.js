const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

admin.initializeApp();

const BREVO_API_KEY_SECRET = "BREVO_API_KEY";
const BREVO_SENDER_EMAIL_SECRET = "BREVO_SENDER_EMAIL";
const BREVO_SENDER_NAME = "Natical RID's";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const RID_DETAILS_BASE_URL = "https://sistemarid.github.io/NATICAL-RID-s/rids.html";

function formatRidNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(5, "0");
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendBrevoEmail({ to, subject, textContent, htmlContent, tags = [] }) {
  const apiKey = String(process.env[BREVO_API_KEY_SECRET] || "").trim();
  const senderEmail = String(process.env[BREVO_SENDER_EMAIL_SECRET] || "").trim();

  if (!apiKey || !senderEmail) {
    logger.warn("Segredos do Brevo ausentes. Email ignorado.", {
      hasApiKey: Boolean(apiKey),
      hasSenderEmail: Boolean(senderEmail)
    });
    return false;
  }

  if (!Array.isArray(to) || !to.length) {
    logger.info("Nenhum destinatario de email encontrado.");
    return false;
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: {
        name: BREVO_SENDER_NAME,
        email: senderEmail
      },
      to,
      subject,
      textContent,
      htmlContent,
      tags
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Brevo respondeu ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return true;
}

async function getRidLeaderEmailRecipient(db, rid) {
  const leaderId = String(rid?.responsibleLeader || "").trim();
  const leaderName = String(rid?.responsibleLeaderName || "").trim();

  if (leaderId) {
    const userDoc = await db.collection("users").doc(leaderId).get().catch(() => null);
    if (userDoc?.exists) {
      const user = userDoc.data() || {};
      const email = String(user.email || "").trim().toLowerCase();
      const name = String(user.name || user.fullName || leaderName).trim();
      if (email && user.emailNotifications !== false) {
        return { email, name };
      }
    }
  }

  if (!leaderName) return null;

  const snapshot = await db.collection("users")
    .where("name", "==", leaderName)
    .limit(1)
    .get()
    .catch(() => null);

  if (!snapshot || snapshot.empty) return null;

  const user = snapshot.docs[0].data() || {};
  const email = String(user.email || "").trim().toLowerCase();
  if (!email || user.emailNotifications === false) return null;

  return {
    email,
    name: String(user.name || user.fullName || leaderName).trim()
  };
}

async function sendRidLeaderEmail(db, rid, payload) {
  const recipient = await getRidLeaderEmailRecipient(db, rid);
  if (!recipient) {
    logger.info("Nenhum lider designado com email valido para notificar.");
    return;
  }

  try {
    await sendBrevoEmail({
      ...payload,
      to: [recipient]
    });
    logger.info("Email enviado para lider designado.", {
      recipient: recipient.email,
      subject: payload.subject
    });
  } catch (error) {
    logger.error("Falha ao enviar email para lider designado.", {
      subject: payload.subject,
      error: error?.message || String(error)
    });
  }
}

function buildRidStatusNotification(after, ridId) {
  const nextStatus = normalizeStatus(after.status);
  const ridNumber = formatRidNumber(after.ridNumber);
  const leaderName = String(after.responsibleLeaderName || "").trim() || "Responsavel nao identificado";
  const correctiveActions = String(after.correctiveActions || "").trim();

  if (nextStatus === "CORRIGIDO") {
    return {
      title: "Novo RID corrigido",
      body: `RID #${ridNumber || "-----"}\n${leaderName}\n${correctiveActions || "Acao corretiva registrada."}`,
      tag: `rid-corrected-${ridId}`
    };
  }

  if (nextStatus === "EM ANDAMENTO") {
    return {
      title: "RID em andamento",
      body: `RID #${ridNumber || "-----"} entrou em andamento.`,
      tag: `rid-em-andamento-${ridId}`
    };
  }

  if (nextStatus === "EXCLUIDO") {
    return {
      title: "RID excluido",
      body: `RID #${ridNumber || "-----"} foi excluido.`,
      tag: `rid-excluido-${ridId}`
    };
  }

  if (nextStatus === "ENCERRADO") {
    return {
      title: "RID encerrado",
      body: `RID #${ridNumber || "-----"} foi encerrado.`,
      tag: `rid-encerrado-${ridId}`
    };
  }

  return null;
}

function getRidEmailDetails(rid, ridId) {
  return {
    ridId: String(ridId || "").trim() || "-",
    ridNumber: formatRidNumber(rid.ridNumber) || "-----",
    emitterName: String(rid.emitterName || "Nao informado").trim() || "Nao informado",
    location: String(rid.location || rid.sector || "Nao informado").trim() || "Nao informado",
    riskClassification: String(rid.riskClassification || "Nao informada").trim() || "Nao informada",
    description: String(rid.description || "Nao informada").trim() || "Nao informada",
    status: String(rid.status || "Nao informado").trim() || "Nao informado"
  };
}

function buildRidDetailsUrl(ridId) {
  const url = new URL(RID_DETAILS_BASE_URL);
  if (ridId) url.searchParams.set("rid", String(ridId).trim());
  return url.toString();
}

function buildAnnouncementNotification(data) {
  const target = String(data.target || "all").trim().toLowerCase();
  let body = "NATICAL RID's atualizado, confira...";

  if (target === "dashboard") {
    body = "NATICAL RID's da gestao atualizado, confira...";
  } else if (target === "mobile") {
    body = "NATICAL RID's mobile atualizado, confira...";
  }

  return {
    title: "NOVA ATUALIZACAO",
    body,
    tag: `global-announcement-${String(data.updatedAt?.seconds || Date.now())}`
  };
}

async function collectTokens(query) {
  const snapshot = await query.get();
  if (snapshot.empty) return [];

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      return String(data.token || doc.id || "").trim();
    })
    .filter(Boolean);
}

async function deleteInvalidTokens(db, tokens, response) {
  const invalidTokens = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code || "";
    if (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered") {
      invalidTokens.push(tokens[index]);
    }
  });

  if (!invalidTokens.length) return;
  await Promise.all(invalidTokens.map((token) => db.collection("notificationTokens").doc(token).delete().catch(() => null)));
}

async function sendMulticastToPage(db, page, url, notification) {
  const tokens = await collectTokens(
    db.collection("notificationTokens")
      .where("enabled", "==", true)
      .where("page", "==", page)
  );

  if (!tokens.length) {
    logger.info("Nenhum token ativo para a pagina solicitada.", { page });
    return;
  }

  const message = {
    data: {
      title: notification.title,
      body: notification.body,
      url,
      click_action: url,
      icon: "./icon-192.png",
      tag: notification.tag,
      type: "global-announcement"
    },
    tokens
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  await deleteInvalidTokens(db, tokens, response);

  logger.info("Push processado para aviso global.", {
    page,
    totalTokens: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount
  });
}

function getAnnouncementTargets(target) {
  if (target === "dashboard") {
    return [{ page: "dashboard", url: "./dashboard.html" }];
  }
  if (target === "mobile") {
    return [{ page: "mobile", url: "./mobile.html" }];
  }
  return [
    { page: "dashboard", url: "./dashboard.html" },
    { page: "mobile", url: "./mobile.html" }
  ];
}

exports.sendRidPushNotification = onDocumentCreated({
  document: "rids/{ridId}",
  secrets: [BREVO_API_KEY_SECRET, BREVO_SENDER_EMAIL_SECRET]
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const rid = snapshot.data() || {};
  const db = admin.firestore();
  const ridDetails = getRidEmailDetails(rid, snapshot.id);
  const ridNumber = ridDetails.ridNumber;
  const location = ridDetails.location;
  const ridDetailsUrl = buildRidDetailsUrl(snapshot.id);

  const tokens = await collectTokens(
    db.collection("notificationTokens")
      .where("enabled", "==", true)
      .where("page", "==", "dashboard")
  );

  if (tokens.length) {
    const message = {
      data: {
        title: "Novo RID recebido",
        body: `RID #${ridNumber || "-----"} | ${location}`,
        ridId: snapshot.id,
        ridNumber: ridNumber || "",
        url: "./dashboard.html",
        click_action: "./dashboard.html",
        icon: "./icon-192.png",
        tag: snapshot.id
      },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    await deleteInvalidTokens(db, tokens, response);

    logger.info("Push de RID processado.", {
      totalTokens: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount
    });
  } else {
    logger.info("Nenhum token web ativo para notificar.");
  }

  await sendRidLeaderEmail(db, rid, {
    subject: `Novo RID designado - RID #${ridNumber || "-----"}`,
    textContent: [
      `Um novo RID foi designado para voce.`,
      `ID do RID: ${ridDetails.ridId}`,
      `RID: #${ridDetails.ridNumber}`,
      `Nome do emissor: ${ridDetails.emitterName}`,
      `Local: ${ridDetails.location}`,
      `Classificacao de risco: ${ridDetails.riskClassification}`,
      `Descricao: ${ridDetails.description}`,
      `Status: ${ridDetails.status}`,
      ``,
      `Ir para o RID: ${ridDetailsUrl}`
    ].join("\n"),
    htmlContent: `
      <div>
        <h2>Novo RID designado</h2>
        <p>Um novo RID foi designado para voce.</p>
        <p><strong>ID do RID:</strong> ${escapeHtml(ridDetails.ridId)}</p>
        <p><strong>RID:</strong> #${escapeHtml(ridDetails.ridNumber)}</p>
        <p><strong>Nome do emissor:</strong> ${escapeHtml(ridDetails.emitterName)}</p>
        <p><strong>Local:</strong> ${escapeHtml(ridDetails.location)}</p>
        <p><strong>Classificacao de risco:</strong> ${escapeHtml(ridDetails.riskClassification)}</p>
        <p><strong>Descricao:</strong> ${escapeHtml(ridDetails.description)}</p>
        <p><strong>Status:</strong> ${escapeHtml(ridDetails.status)}</p>
        <p style="margin-top:24px;">
          <a href="${escapeHtml(ridDetailsUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;">
            Ir Para o RID
          </a>
        </p>
      </div>
    `,
    tags: ["rid-created", "admin-alert"]
  });
});

exports.sendRidStatusChangedPushNotification = onDocumentUpdated({
  document: "rids/{ridId}",
  secrets: [BREVO_API_KEY_SECRET, BREVO_SENDER_EMAIL_SECRET]
}, async (event) => {
  const before = event.data?.before?.data() || null;
  const after = event.data?.after?.data() || null;
  if (!before || !after) return;

  const previousStatus = normalizeStatus(before.status);
  const nextStatus = normalizeStatus(after.status);
  if (previousStatus === nextStatus) return;
  if (!["EM ANDAMENTO", "CORRIGIDO", "EXCLUIDO", "ENCERRADO"].includes(nextStatus)) return;

  const emitterUid = String(after.emitterId || "").trim();
  if (!emitterUid) {
    logger.info("RID com mudanca de status sem emitterId autenticado. Push mobile ignorado.", { ridId: event.params.ridId });
    return;
  }

  const db = admin.firestore();
  const tokens = await collectTokens(
    db.collection("notificationTokens")
      .where("enabled", "==", true)
      .where("page", "==", "mobile")
      .where("uid", "==", emitterUid)
  );

  const notification = buildRidStatusNotification(after, event.params.ridId);
  if (!notification) return;
  const ridDetails = getRidEmailDetails(after, event.params.ridId);
  const ridNumber = ridDetails.ridNumber;
  const ridDetailsUrl = buildRidDetailsUrl(event.params.ridId);

  if (tokens.length) {
    const message = {
      data: {
        title: notification.title,
        body: notification.body,
        ridId: event.params.ridId,
        ridNumber,
        status: nextStatus,
        correctedBy: String(after.responsibleLeaderName || "").trim(),
        correctiveActions: String(after.correctiveActions || "").trim(),
        url: "./mobile.html",
        click_action: "./mobile.html",
        icon: "./icon-192.png",
        tag: notification.tag
      },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    await deleteInvalidTokens(db, tokens, response);

    logger.info("Push de mudanca de status de RID processado.", {
      ridId: event.params.ridId,
      previousStatus,
      nextStatus,
      emitterUid,
      totalTokens: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount
    });
  } else {
    logger.info("Nenhum token mobile ativo para emissor da RID com mudanca de status.", {
      ridId: event.params.ridId,
      emitterUid
    });
  }

  await sendRidLeaderEmail(db, after, {
    subject: `RID #${ridNumber || "-----"} atualizado para ${nextStatus}`,
    textContent: [
      `O RID #${ridNumber || "-----"} mudou de status.`,
      `ID do RID: ${ridDetails.ridId}`,
      `Nome do emissor: ${ridDetails.emitterName}`,
      `Local: ${ridDetails.location}`,
      `Classificacao de risco: ${ridDetails.riskClassification}`,
      `Descricao: ${ridDetails.description}`,
      `Status anterior: ${previousStatus || "-"}`,
      `Status atual: ${nextStatus}`,
      `Responsavel: ${String(after.responsibleLeaderName || "Nao informado").trim() || "Nao informado"}`,
      `Acao corretiva: ${String(after.correctiveActions || "Nao informada").trim() || "Nao informada"}`,
      ``,
      `Ir para o RID: ${ridDetailsUrl}`
    ].join("\n"),
    htmlContent: `
      <div>
        <h2>RID atualizado</h2>
        <p>O RID <strong>#${escapeHtml(ridNumber || "-----")}</strong> mudou de status.</p>
        <p><strong>ID do RID:</strong> ${escapeHtml(ridDetails.ridId)}</p>
        <p><strong>Nome do emissor:</strong> ${escapeHtml(ridDetails.emitterName)}</p>
        <p><strong>Local:</strong> ${escapeHtml(ridDetails.location)}</p>
        <p><strong>Classificacao de risco:</strong> ${escapeHtml(ridDetails.riskClassification)}</p>
        <p><strong>Descricao:</strong> ${escapeHtml(ridDetails.description)}</p>
        <p><strong>Status anterior:</strong> ${escapeHtml(previousStatus || "-")}</p>
        <p><strong>Status atual:</strong> ${escapeHtml(nextStatus)}</p>
        <p><strong>Responsavel:</strong> ${escapeHtml(String(after.responsibleLeaderName || "Nao informado").trim() || "Nao informado")}</p>
        <p><strong>Acao corretiva:</strong> ${escapeHtml(String(after.correctiveActions || "Nao informada").trim() || "Nao informada")}</p>
        <p style="margin-top:24px;">
          <a href="${escapeHtml(ridDetailsUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;">
            Ir Para o RID
          </a>
        </p>
      </div>
    `,
    tags: ["rid-status-changed", "admin-alert", nextStatus.toLowerCase()]
  });
});

exports.sendGlobalAnnouncementPushNotification = onDocumentCreated({
  document: "globalAnnouncements/{announcementId}",
  secrets: [BREVO_API_KEY_SECRET, BREVO_SENDER_EMAIL_SECRET]
}, async (event) => {
  const data = event.data?.data() || {};
  if (!data.isActive) return;

  const db = admin.firestore();
  const notification = buildAnnouncementNotification(data);
  await Promise.all(
    getAnnouncementTargets(data.target).map((target) =>
      sendMulticastToPage(db, target.page, target.url, notification)
    )
  );

});

exports.sendGlobalAnnouncementUpdatedPushNotification = onDocumentUpdated({
  document: "globalAnnouncements/{announcementId}",
  secrets: [BREVO_API_KEY_SECRET, BREVO_SENDER_EMAIL_SECRET]
}, async (event) => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};
  if (!after.isActive) return;

  const changed =
    String(before.title || "") !== String(after.title || "") ||
    String(before.message || "") !== String(after.message || "") ||
    String(before.startDate || "") !== String(after.startDate || "") ||
    Number(before.daysVisible || 0) !== Number(after.daysVisible || 0) ||
    Number(before.dailyLimit || 0) !== Number(after.dailyLimit || 0) ||
    Boolean(before.isActive) !== Boolean(after.isActive);

  if (!changed) return;

  const db = admin.firestore();
  const notification = buildAnnouncementNotification(after);
  await Promise.all(
    getAnnouncementTargets(after.target).map((target) =>
      sendMulticastToPage(db, target.page, target.url, notification)
    )
  );

});
