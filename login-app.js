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
  const db = typeof firebase.firestore === "function" ? firebase.firestore() : null;
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  const DEVELOPER_ONLY_PAGES = new Set(["centro-controle.html", "alteracoes.html", "solicitacoes.html"]);
  const PRIVILEGED_PAGES = new Set([
    "dashboard.html",
    "rids.html",
    "funcionarios.html",
    "relatorios.html",
    "melhorias.html",
    "designados.html",
    "configuracoes.html"
  ]);

  const dom = {
    bootOverlay: document.getElementById("bootOverlay"),
    loginForm: document.getElementById("loginForm"),
    loginCpf: document.getElementById("loginCpf"),
    loginPassword: document.getElementById("loginPassword"),
    loginSubmitButton: document.getElementById("loginSubmitButton"),
    loginFeedback: document.getElementById("loginFeedback")
  };

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

  function getNextPage() {
    const params = new URLSearchParams(window.location.search);
    const next = String(params.get("next") || "dashboard.html").trim();
    if (!next || /^(https?:)?\/\//i.test(next) || next.includes("login.html")) {
      return "dashboard.html";
    }
    return next;
  }

  function showFeedback(message) {
    dom.loginFeedback.textContent = message;
    dom.loginFeedback.classList.add("visible");
  }

  async function getUserProfile(uid) {
    if (!db || !uid) return null;
    if (window.ridUserProfileResolver?.resolveUserProfile) {
      return window.ridUserProfileResolver.resolveUserProfile(db, {
        uid,
        email: auth.currentUser?.email || ""
      });
    }
    const snapshot = await db.collection("users").doc(uid).get();
    return snapshot.exists ? { id: uid, ...snapshot.data() } : null;
  }

  function isDeveloperProfile(profile) {
    const userType = String(profile?.userType || "").trim().toLowerCase();
    return !!(
      (profile?.isAdmin === true && profile?.isDeveloper === true) ||
      userType === "desenvolvedor"
    );
  }

  function isAdminProfile(profile) {
    const userType = String(profile?.userType || "").trim().toLowerCase();
    return !!(
      profile?.isAdmin === true ||
      userType === "administrador" ||
      userType === "desenvolvedor"
    );
  }

  function canAccessPage(profile, page) {
    if (!profile) return false;
    if (DEVELOPER_ONLY_PAGES.has(page)) return isDeveloperProfile(profile);
    if (PRIVILEGED_PAGES.has(page)) return isAdminProfile(profile);
    return true;
  }

  function consumeStoredFeedback() {
    const message = sessionStorage.getItem("ridLoginFeedback");
    if (!message) return;
    sessionStorage.removeItem("ridLoginFeedback");
    showFeedback(message);
  }

  function hideBoot() {
    dom.bootOverlay.style.display = "none";
  }

  function redirectAuthenticatedUser() {
    window.location.replace(getNextPage());
  }

  dom.loginCpf.addEventListener("input", () => {
    dom.loginCpf.value = maskCpf(dom.loginCpf.value);
  });

  dom.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    dom.loginFeedback.classList.remove("visible");
    dom.loginSubmitButton.disabled = true;
    dom.loginSubmitButton.textContent = "Entrando...";
    try {
      const credential = await auth.signInWithEmailAndPassword(cpfToEmail(dom.loginCpf.value), dom.loginPassword.value);
      const profile = await getUserProfile(credential.user?.uid || "");
      const nextPage = getNextPage();

      if (!profile || !canAccessPage(profile, nextPage)) {
        sessionStorage.setItem("ridLoginFeedback", "Sua conta nao tem permissao para este painel.");
        await auth.signOut();
        showFeedback("Sua conta nao tem permissao para este painel.");
        return;
      }

      sessionStorage.setItem("ridDashboardGoalIntro", "pending");
      window.location.replace(nextPage);
    } catch (error) {
      showFeedback("Nao foi possivel entrar. Confira CPF e senha.");
    } finally {
      dom.loginSubmitButton.disabled = false;
      dom.loginSubmitButton.textContent = "Entrar";
    }
  });

  auth.onAuthStateChanged(async (user) => {
    consumeStoredFeedback();
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);
        const nextPage = getNextPage();
        if (profile && canAccessPage(profile, nextPage)) {
          window.location.replace(nextPage);
          return;
        }
        await auth.signOut();
      } catch (error) {
        await auth.signOut();
      }
      return;
    }
    hideBoot();
  });
})();
