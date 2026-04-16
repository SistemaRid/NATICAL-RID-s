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

  if (typeof firebase.auth !== "function" || typeof firebase.firestore !== "function") return;

  const auth = firebase.auth();
  const db = firebase.firestore();
  const SESSION_KEY = "ridManagementTrackedLoginUid";
  const currentPage = window.location.pathname.split(/[\\/]/).pop() || "";

  if (currentPage === "mobile.html") return;

  auth.onAuthStateChanged(async (user) => {
    if (!user?.uid) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    const trackedUid = sessionStorage.getItem(SESSION_KEY);
    if (trackedUid === user.uid) return;

    try {
      const profile = window.ridUserProfileResolver?.resolveUserProfile
        ? await window.ridUserProfileResolver.resolveUserProfile(db, user)
        : null;
      const targetUserId = profile?.id || user.uid;

      await db.collection("users").doc(targetUserId).set({
        lastManagementLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastManagementLoginPage: currentPage || "dashboard.html"
      }, { merge: true });
      sessionStorage.setItem(SESSION_KEY, user.uid);
    } catch (error) {
      console.error("Falha ao registrar ultimo login de gestao:", error);
    }
  });
})();
