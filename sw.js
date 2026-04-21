const CACHE_NAME = "rid-mobile-offline-v3";
const firebaseConfig = {
  apiKey: "AIzaSyBVnWDyQXWNf9JFE3S5W_eDqmrp7B4_nTE",
  authDomain: "natical-rids.firebaseapp.com",
  projectId: "natical-rids",
  storageBucket: "natical-rids.firebasestorage.app",
  messagingSenderId: "954479408416",
  appId: "1:954479408416:web:292797e541d84487021345"
};
const APP_SHELL = [
  "./",
  "./mobile.html",
  "./mobile-terceiros.html",
  "./mobile.css",
  "./mobile-app.js",
  "./mobile-terceiros-app.js",
  "./mobile-manifest.json",
  "./mobile-terceiros-manifest.json",
  "./icon-new.png",
  "./icon.png",
  "./icon-192.png",
  "./logo.png"
];

const EXTERNAL_ASSETS = [
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js"
];

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "./dashboard.html";

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const matchingClient = allClients.find((client) => client.url.includes(targetUrl.replace("./", "")));

    if (matchingClient) {
      await matchingClient.focus();
      return;
    }

    await clients.openWindow(targetUrl);
  })());
});

try {
  importScripts(
    "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js"
  );

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const data = payload?.data || {};
    const notification = payload?.notification || {};
    const title = notification.title || data.title || "Novo RID recebido";
    const body = notification.body || data.body || "Uma nova RID foi registrada no sistema.";
    const url = data.click_action || data.url || "./dashboard.html";
    const icon = data.icon || notification.icon || "./icon-new.png";

    self.registration.showNotification(title, {
      body,
      icon,
      badge: "./icon-new.png",
      data: { url },
      tag: data.tag || "rid-push-notification"
    });
  });
} catch (error) {
  console.warn("Firebase Messaging indisponivel no service worker:", error);
}

async function cacheOfflineBundle() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL.map(async (asset) => {
    try {
      const response = await fetch(asset, { cache: "no-store" });
      if (response && response.ok) {
        await cache.put(asset, response.clone());
      }
    } catch (error) {
      console.warn("Falha ao salvar asset no cache:", asset, error);
    }
  }));

  await Promise.allSettled(EXTERNAL_ASSETS.map(async (url) => {
    const response = await fetch(new Request(url, { mode: "no-cors", cache: "no-store" }));
    await cache.put(url, response);
  }));

  return cache;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await cacheOfflineBundle();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.searchParams.has("network-check")) {
    return;
  }

  const bypassHosts = [
    "firestore.googleapis.com",
    "www.googleapis.com",
    "securetoken.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firebaseinstallations.googleapis.com"
  ];

  if (bypassHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    try {
      const response = await fetch(event.request);
      cache.put(event.request, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        return cache.match("./mobile.html");
      }
      throw error;
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "refresh-offline-cache") return;

  event.waitUntil((async () => {
    try {
      await cacheOfflineBundle();
      event.ports?.[0]?.postMessage({ ok: true });
    } catch (error) {
      console.warn("Falha ao atualizar cache offline sob demanda:", error);
      event.ports?.[0]?.postMessage({ ok: false });
    }
  })());
});
