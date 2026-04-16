(function () {
  if (typeof window === "undefined") return;

  function normalizeCpf(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 11);
  }

  function maskCpf(value) {
    const digits = normalizeCpf(value);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  async function resolveUserProfile(db, user) {
    if (!db || !user?.uid) return null;

    const byUid = await db.collection("users").doc(user.uid).get();
    if (byUid.exists) {
      return { id: byUid.id, ...byUid.data() };
    }

    const authEmail = String(user.email || "").trim();
    const cpfFromEmail = normalizeCpf(authEmail.split("@")[0] || "");

    if (cpfFromEmail.length === 11) {
      try {
        const byCpf = await db.collection("users")
          .where("cpf", "==", maskCpf(cpfFromEmail))
          .limit(1)
          .get();
        if (!byCpf.empty) {
          const doc = byCpf.docs[0];
          return { id: doc.id, ...doc.data() };
        }
      } catch (error) {}
    }

    if (authEmail) {
      try {
        const byEmail = await db.collection("users")
          .where("email", "==", authEmail)
          .limit(1)
          .get();
        if (!byEmail.empty) {
          const doc = byEmail.docs[0];
          return { id: doc.id, ...doc.data() };
        }
      } catch (error) {}
    }

    return null;
  }

  window.ridUserProfileResolver = {
    normalizeCpf,
    maskCpf,
    resolveUserProfile
  };
})();
