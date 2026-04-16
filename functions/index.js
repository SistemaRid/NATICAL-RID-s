const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

admin.initializeApp();

function formatRidNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(5, "0");
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
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

exports.sendRidPushNotification = onDocumentCreated("rids/{ridId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const rid = snapshot.data() || {};
  const db = admin.firestore();

  const tokens = await collectTokens(
    db.collection("notificationTokens")
      .where("enabled", "==", true)
      .where("page", "==", "dashboard")
  );

  if (!tokens.length) {
    logger.info("Nenhum token web ativo para notificar.");
    return;
  }

  const ridNumber = formatRidNumber(rid.ridNumber);
  const location = String(rid.location || rid.sector || "Local nao informado").trim();

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
});

exports.sendRidStatusChangedPushNotification = onDocumentUpdated("rids/{ridId}", async (event) => {
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

  if (!tokens.length) {
    logger.info("Nenhum token mobile ativo para emissor da RID com mudanca de status.", {
      ridId: event.params.ridId,
      emitterUid
    });
    return;
  }

  const notification = buildRidStatusNotification(after, event.params.ridId);
  if (!notification) return;

  const message = {
    data: {
      title: notification.title,
      body: notification.body,
      ridId: event.params.ridId,
      ridNumber: formatRidNumber(after.ridNumber) || "",
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
});

exports.sendGlobalAnnouncementPushNotification = onDocumentCreated("globalAnnouncements/{announcementId}", async (event) => {
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

exports.sendGlobalAnnouncementUpdatedPushNotification = onDocumentUpdated("globalAnnouncements/{announcementId}", async (event) => {
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
