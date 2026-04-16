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
  const secondaryApp = firebase.apps.find((app) => app.name === "SecondaryFuncionarios") || firebase.initializeApp(firebaseConfig, "SecondaryFuncionarios");

  const auth = firebase.auth();
  const secondaryAuth = secondaryApp.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  const db = firebase.firestore();

  const state = {
    currentUser: null,
    currentUserData: null,
    allUsers: [],
    filters: { sector: "", search: "" },
    draftFilters: { sector: "", search: "" },
    modalMode: "edit",
    selectedEmployeeId: null,
    actionEmployeeId: null,
    unsubUsers: null
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
    toggleFiltersButton: document.getElementById("toggleFiltersButton"),
    filtersPanel: document.getElementById("filtersPanel"),
    filterSector: document.getElementById("filterSector"),
    searchInput: document.getElementById("searchInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    applyFiltersButton: document.getElementById("applyFiltersButton"),
    employeesCount: document.getElementById("employeesCount"),
    downloadPdfButton: document.getElementById("downloadPdfButton"),
    addEmployeeButton: document.getElementById("addEmployeeButton"),
    employeesList: document.getElementById("employeesList"),
    employeeModal: document.getElementById("employeeModal"),
    employeeModalTitle: document.getElementById("employeeModalTitle"),
    employeeModalClose: document.getElementById("employeeModalClose"),
    employeeForm: document.getElementById("employeeForm"),
    employeeName: document.getElementById("employeeName"),
    employeeEmail: document.getElementById("employeeEmail"),
    employeeCpf: document.getElementById("employeeCpf"),
    employeeUnit: document.getElementById("employeeUnit"),
    employeeSector: document.getElementById("employeeSector"),
    employeeRole: document.getElementById("employeeRole"),
    employeeVacationField: document.getElementById("employeeVacationField"),
    employeeVacationStart: document.getElementById("employeeVacationStart"),
    employeeVacationEnd: document.getElementById("employeeVacationEnd"),
    employeeVacationClear: document.getElementById("employeeVacationClear"),
    employeePasswordField: document.getElementById("employeePasswordField"),
    employeePassword: document.getElementById("employeePassword"),
    employeeAdminField: document.getElementById("employeeAdminField"),
    employeeIsAdmin: document.getElementById("employeeIsAdmin"),
    employeeFormFeedback: document.getElementById("employeeFormFeedback"),
    employeeFormCancel: document.getElementById("employeeFormCancel"),
    employeeFormSubmit: document.getElementById("employeeFormSubmit"),
    employeeDeleteConfirmModal: document.getElementById("employeeDeleteConfirmModal"),
    employeeDeleteConfirmFeedback: document.getElementById("employeeDeleteConfirmFeedback"),
    employeeDeleteConfirmCancel: document.getElementById("employeeDeleteConfirmCancel"),
    employeeDeleteConfirmSubmit: document.getElementById("employeeDeleteConfirmSubmit"),
    employeeRemovalRequestModal: document.getElementById("employeeRemovalRequestModal"),
    employeeRemovalReasonInput: document.getElementById("employeeRemovalReasonInput"),
    employeeRemovalRequestFeedback: document.getElementById("employeeRemovalRequestFeedback"),
    employeeRemovalRequestCancel: document.getElementById("employeeRemovalRequestCancel"),
    employeeRemovalRequestSubmit: document.getElementById("employeeRemovalRequestSubmit")
  };

  function isAdminProfile(user = state.currentUserData) {
    return !!user?.isAdmin;
  }

  function isDeveloperProfile(user = state.currentUserData) {
    return !!(user?.isAdmin && user?.isDeveloper);
  }

  function updateAdminNavigation() {
    document.querySelectorAll('[data-admin-only-nav="designated"]').forEach((element) => {
      element.classList.toggle("hidden-state", !isAdminProfile());
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

  function formatField(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function toDateSafe(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function toDateInputValue(value) {
    const date = toDateSafe(value);
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function readVacationPeriodFromForm() {
    const startValue = String(dom.employeeVacationStart.value || "").trim();
    const endValue = String(dom.employeeVacationEnd.value || "").trim();

    if (!startValue && !endValue) {
      return { vacationPeriod: null, error: "" };
    }

    if (!startValue || !endValue) {
      return { vacationPeriod: null, error: "Preencha inicio e fim das ferias." };
    }

    const startDate = new Date(`${startValue}T00:00:00Z`);
    const endDate = new Date(`${endValue}T23:59:59Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return { vacationPeriod: null, error: "Periodo de ferias invalido." };
    }

    return {
      vacationPeriod: {
        start: firebase.firestore.Timestamp.fromDate(startDate),
        end: firebase.firestore.Timestamp.fromDate(endDate)
      },
      error: ""
    };
  }

  function clearVacationFields() {
    dom.employeeVacationStart.value = "";
    dom.employeeVacationEnd.value = "";
  }

  function formatVacationSummary(vacationPeriod) {
    const start = toDateSafe(vacationPeriod?.start);
    const end = toDateSafe(vacationPeriod?.end);
    if (!start || !end) return "";
    return `Ferias: ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;
  }

  function closeFiltersPanel() {
    dom.filtersPanel.classList.remove("visible");
  }

  function getEmployeeRole(employee) {
    return formatField(employee.function || employee.role || employee.userType || (employee.isDeveloper ? "Desenvolvedor" : employee.isAdmin ? "Administrador" : "Funcionario"));
  }

  function normalizeCpf(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function getFilteredEmployees() {
    const search = String(state.filters.search || "").trim().toLowerCase();
    return state.allUsers
      .filter((user) => !user.deleted)
      .filter((user) => !state.filters.sector || user.sector === state.filters.sector)
      .filter((user) => {
        if (!search) return true;
        const haystack = [user.name, user.email, user.cpf, user.unit, user.sector, getEmployeeRole(user)].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }

  function populateSectorFilter() {
    const currentValue = dom.filterSector.value;
    const sectors = [...new Set(state.allUsers.map((item) => formatField(item.sector, "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    dom.filterSector.innerHTML = `<option value="">Todos os setores</option>${sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`).join("")}`;
    dom.filterSector.value = sectors.includes(currentValue) ? currentValue : state.draftFilters.sector || "";
  }

  function renderEmployees() {
    const employees = getFilteredEmployees();
    dom.employeesCount.textContent = `${employees.length} funcionario${employees.length === 1 ? "" : "s"}`;

    if (!employees.length) {
      dom.employeesList.innerHTML = `
        <div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          <div class="text-sm font-medium text-gray-500">Nenhum funcionario encontrado com os filtros atuais.</div>
        </div>
      `;
      return;
    }

    dom.employeesList.innerHTML = employees.map((employee) => `
      <div class="rounded-2xl border border-gray-100 bg-white px-5 py-5">
        <div class="employee-row">
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Nome</div>
            <div class="text-sm font-semibold text-gray-900 mt-1 md:mt-0">${escapeHtml(formatField(employee.name))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Email</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0 break-all">${escapeHtml(formatField(employee.email, "Sem email"))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">CPF</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatField(employee.cpf))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Unidade</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatField(employee.unit))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Setor</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(formatField(employee.sector))}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider font-semibold text-gray-400 md:hidden">Funcao</div>
            <div class="text-sm text-gray-700 mt-1 md:mt-0">${escapeHtml(getEmployeeRole(employee))}</div>
            ${employee.vacationPeriod ? `<div class="text-xs text-amber-700 mt-1">${escapeHtml(formatVacationSummary(employee.vacationPeriod))}</div>` : ""}
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-start md:justify-end">
            <button type="button" data-edit-employee="${escapeHtml(employee.id)}" class="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Editar</button>
            ${isDeveloperProfile()
              ? `<button type="button" data-delete-employee="${escapeHtml(employee.id)}" class="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700">Excluir</button>`
              : state.currentUserData?.isAdmin
                ? `<button type="button" data-request-employee="${escapeHtml(employee.id)}" class="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700">Solicitar remocao</button>`
                : ""}
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderPage() {
    populateSectorFilter();
    renderEmployees();
  }

  function downloadEmployeesPdf() {
    const employees = getFilteredEmployees();
    const jsPdfApi = window.jspdf?.jsPDF;
    if (!jsPdfApi) return;

    const doc = new jsPdfApi({ orientation: "portrait", unit: "mm", format: "a4" });
    const today = new Date();
    const sectorLabel = state.filters.sector || "Todos os setores";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatorio de Funcionarios", 14, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em ${today.toLocaleDateString("pt-BR")} - Setor: ${sectorLabel}`, 14, 23);
    doc.text(`Total de funcionarios: ${employees.length}`, 14, 29);

    doc.autoTable({
      startY: 36,
      head: [["Nome", "CPF", "Setor", "Funcao"]],
      body: employees.map((employee) => [
        formatField(employee.name),
        formatField(employee.cpf),
        formatField(employee.sector),
        getEmployeeRole(employee)
      ]),
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        lineColor: [229, 231, 235]
      },
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      bodyStyles: {
        textColor: [55, 65, 81]
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      margin: { left: 14, right: 14 }
    });

    const fileDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    doc.save(`funcionarios-${fileDate}.pdf`);
  }

  function resetEmployeeForm() {
    dom.employeeName.value = "";
    dom.employeeEmail.value = "";
    dom.employeeCpf.value = "";
    dom.employeeUnit.value = "";
    dom.employeeSector.value = "";
    dom.employeeRole.value = "";
    clearVacationFields();
    dom.employeePassword.value = "";
    dom.employeeIsAdmin.checked = false;
    dom.employeeFormFeedback.classList.add("hidden-state");
    dom.employeeFormFeedback.textContent = "";
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
    dom.welcomeText.textContent = `Bem-vindo, ${state.currentUserData?.name || "gestor"}. Aqui voce acompanha o cadastro completo de funcionarios.`;
    renderPage();
    lucide.createIcons();
  }

  function findEmployeeById(employeeId) {
    return state.allUsers.find((item) => item.id === employeeId) || null;
  }

  function openCreateEmployeeModal() {
    state.modalMode = "create";
    state.selectedEmployeeId = null;
    resetEmployeeForm();
    dom.employeeModalTitle.textContent = "Adicionar funcionario";
    dom.employeeVacationField.classList.add("hidden-state");
    dom.employeePasswordField.classList.remove("hidden-state");
    if (isDeveloperProfile()) {
      dom.employeeAdminField.classList.remove("hidden-state");
    } else {
      dom.employeeAdminField.classList.add("hidden-state");
    }
    dom.employeeFormSubmit.textContent = "Criar funcionario";
    dom.employeeModal.classList.add("visible");
  }

  function openEmployeeModal(employeeId) {
    const employee = findEmployeeById(employeeId);
    if (!employee) return;
    state.modalMode = "edit";
    state.selectedEmployeeId = employeeId;
    dom.employeeModalTitle.textContent = `Editar ${employee.name || "funcionario"}`;
    dom.employeeVacationField.classList.remove("hidden-state");
    dom.employeeName.value = employee.name || "";
    dom.employeeEmail.value = employee.email || "";
    dom.employeeCpf.value = employee.cpf || "";
    dom.employeeUnit.value = employee.unit || "";
    dom.employeeSector.value = employee.sector || "";
    dom.employeeRole.value = employee.function || employee.role || employee.userType || "";
    dom.employeeVacationStart.value = toDateInputValue(employee.vacationPeriod?.start);
    dom.employeeVacationEnd.value = toDateInputValue(employee.vacationPeriod?.end);
    dom.employeePassword.value = "";
    dom.employeeIsAdmin.checked = !!employee.isAdmin;
    dom.employeePasswordField.classList.add("hidden-state");
    dom.employeeAdminField.classList.add("hidden-state");
    dom.employeeFormFeedback.classList.add("hidden-state");
    dom.employeeFormFeedback.textContent = "";
    dom.employeeFormSubmit.textContent = "Salvar alteracoes";
    dom.employeeModal.classList.add("visible");
  }

  function closeEmployeeModal() {
    state.modalMode = "edit";
    state.selectedEmployeeId = null;
    dom.employeeModal.classList.remove("visible");
  }

  function openEmployeeDeleteConfirmModal(employeeId) {
    state.actionEmployeeId = employeeId;
    dom.employeeDeleteConfirmFeedback.classList.add("hidden-state");
    dom.employeeDeleteConfirmFeedback.textContent = "";
    dom.employeeDeleteConfirmModal.classList.add("visible");
  }

  function closeEmployeeDeleteConfirmModal() {
    state.actionEmployeeId = null;
    dom.employeeDeleteConfirmModal.classList.remove("visible");
  }

  function openEmployeeRemovalRequestModal(employeeId) {
    state.actionEmployeeId = employeeId;
    dom.employeeRemovalReasonInput.value = "";
    dom.employeeRemovalRequestFeedback.classList.add("hidden-state");
    dom.employeeRemovalRequestFeedback.textContent = "";
    dom.employeeRemovalRequestModal.classList.add("visible");
  }

  function closeEmployeeRemovalRequestModal() {
    state.actionEmployeeId = null;
    dom.employeeRemovalRequestModal.classList.remove("visible");
  }

  async function createEmployee() {
    const name = String(dom.employeeName.value || "").trim();
    const email = String(dom.employeeEmail.value || "").trim().toLowerCase();
    const cpfRaw = String(dom.employeeCpf.value || "").trim();
    const cpfClean = normalizeCpf(cpfRaw);
    const unit = String(dom.employeeUnit.value || "").trim();
    const sector = String(dom.employeeSector.value || "").trim();
    const role = String(dom.employeeRole.value || "").trim();
    const password = String(dom.employeePassword.value || "").trim();
    const makeAdmin = !!dom.employeeIsAdmin.checked && isDeveloperProfile();
    const { vacationPeriod, error: vacationError } = readVacationPeriodFromForm();

    if (!name || !cpfClean || !password) {
      dom.employeeFormFeedback.textContent = "Nome, CPF e senha inicial sao obrigatorios.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    if (cpfClean.length !== 11) {
      dom.employeeFormFeedback.textContent = "CPF invalido.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    if (vacationError) {
      dom.employeeFormFeedback.textContent = vacationError;
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    const authEmail = cpfToEmail(cpfClean);
    dom.employeeFormSubmit.disabled = true;
    try {
      const credential = await secondaryAuth.createUserWithEmailAndPassword(authEmail, password);
      await db.collection("users").doc(credential.user.uid).set({
        name,
        cpf: maskCpf(cpfClean),
        email: email || null,
        unit: unit || null,
        sector: sector || null,
        function: role || null,
        role: role || null,
        vacationPeriod,
        isAdmin: makeAdmin,
        isDeveloper: false,
        userType: makeAdmin ? "Administrador" : "Funcionario",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (makeAdmin) {
        await db.collection("leaders_public").doc(credential.user.uid).set({
          email: email || authEmail,
          name,
          sector: "ADMINISTRADOR"
        }, { merge: true });
      }

      await secondaryAuth.signOut();
      closeEmployeeModal();
    } catch (error) {
      dom.employeeFormFeedback.textContent = "Nao foi possivel criar o funcionario.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
    } finally {
      dom.employeeFormSubmit.disabled = false;
    }
  }

  async function saveEmployee() {
    if (state.modalMode === "create") {
      await createEmployee();
      return;
    }

    const employee = findEmployeeById(state.selectedEmployeeId);
    if (!employee) return;

    const name = String(dom.employeeName.value || "").trim();
    const email = String(dom.employeeEmail.value || "").trim();
    const cpf = String(dom.employeeCpf.value || "").trim();
    const unit = String(dom.employeeUnit.value || "").trim();
    const sector = String(dom.employeeSector.value || "").trim();
    const role = String(dom.employeeRole.value || "").trim();
    const { vacationPeriod, error: vacationError } = readVacationPeriodFromForm();

    if (!name || !cpf) {
      dom.employeeFormFeedback.textContent = "Nome e CPF sao obrigatorios.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    if (vacationError) {
      dom.employeeFormFeedback.textContent = vacationError;
      dom.employeeFormFeedback.classList.remove("hidden-state");
      return;
    }

    dom.employeeFormSubmit.disabled = true;
    try {
      await db.collection("users").doc(employee.id).update({
        name,
        email,
        cpf,
        unit,
        sector,
        function: role,
        role,
        vacationPeriod
      });
      closeEmployeeModal();
    } catch (error) {
      dom.employeeFormFeedback.textContent = "Nao foi possivel salvar as alteracoes do funcionario.";
      dom.employeeFormFeedback.classList.remove("hidden-state");
    } finally {
      dom.employeeFormSubmit.disabled = false;
    }
  }

  async function deleteEmployeeDirectly(employee) {
    await db.collection("users").doc(employee.id).update({
      deleted: true,
      status: "EXCLUIDO",
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deletedBy: {
        uid: state.currentUser.uid,
        name: state.currentUserData?.name || "DEV",
        role: "DEV"
      },
      deleteReason: "Exclusao direta pelo desenvolvedor"
    });
  }

  async function requestEmployeeRemoval(employee, reason) {
    await db.collection("employeeDeleteRequests").add({
      userId: employee.id,
      userName: employee.name || "",
      requesterId: state.currentUser.uid,
      requesterName: state.currentUserData?.name || "",
      reason: reason.trim(),
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function listenUsers() {
    if (typeof state.unsubUsers === "function") state.unsubUsers();
    state.unsubUsers = db.collection("users").onSnapshot((snapshot) => {
      state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (state.currentUserData) renderPage();
    });
  }

  function bindEvents() {
    dom.loginCpf.addEventListener("input", () => {
      dom.loginCpf.value = maskCpf(dom.loginCpf.value);
    });

    dom.employeeCpf.addEventListener("input", () => {
      dom.employeeCpf.value = maskCpf(dom.employeeCpf.value);
    });

    dom.employeeVacationClear.addEventListener("click", clearVacationFields);

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

    dom.toggleFiltersButton.addEventListener("click", () => {
      dom.filtersPanel.classList.toggle("visible");
    });

    dom.downloadPdfButton.addEventListener("click", downloadEmployeesPdf);
    dom.addEmployeeButton.addEventListener("click", openCreateEmployeeModal);


    dom.clearFiltersButton.addEventListener("click", () => {
      state.draftFilters = { sector: "", search: "" };
      state.filters = { ...state.draftFilters };
      dom.filterSector.value = "";
      dom.searchInput.value = "";
      closeFiltersPanel();
      renderPage();
    });

    dom.applyFiltersButton.addEventListener("click", () => {
      state.draftFilters = {
        sector: dom.filterSector.value || "",
        search: dom.searchInput.value || ""
      };
      state.filters = { ...state.draftFilters };
      closeFiltersPanel();
      renderEmployees();
    });

    dom.employeesList.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-employee]");
      if (editButton) {
        openEmployeeModal(editButton.getAttribute("data-edit-employee"));
        return;
      }

      const deleteButton = event.target.closest("[data-delete-employee]");
      if (deleteButton) {
        openEmployeeDeleteConfirmModal(deleteButton.getAttribute("data-delete-employee"));
        return;
      }

      const requestButton = event.target.closest("[data-request-employee]");
      if (requestButton) {
        openEmployeeRemovalRequestModal(requestButton.getAttribute("data-request-employee"));
      }
    });

    dom.employeeModalClose.addEventListener("click", closeEmployeeModal);
    dom.employeeFormCancel.addEventListener("click", closeEmployeeModal);
    dom.employeeModal.addEventListener("click", (event) => {
      if (event.target === dom.employeeModal) closeEmployeeModal();
    });

    dom.employeeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveEmployee();
    });

    dom.employeeDeleteConfirmCancel.addEventListener("click", closeEmployeeDeleteConfirmModal);
    dom.employeeDeleteConfirmModal.addEventListener("click", (event) => {
      if (event.target === dom.employeeDeleteConfirmModal) closeEmployeeDeleteConfirmModal();
    });

    dom.employeeDeleteConfirmSubmit.addEventListener("click", async () => {
      const employee = findEmployeeById(state.actionEmployeeId);
      if (!employee) return;
      closeEmployeeDeleteConfirmModal();
      try {
        await deleteEmployeeDirectly(employee);
      } catch (error) {
        dom.employeeDeleteConfirmFeedback.textContent = "Nao foi possivel excluir o funcionario.";
        dom.employeeDeleteConfirmFeedback.classList.remove("hidden-state");
      }
    });

    dom.employeeRemovalRequestCancel.addEventListener("click", closeEmployeeRemovalRequestModal);
    dom.employeeRemovalRequestModal.addEventListener("click", (event) => {
      if (event.target === dom.employeeRemovalRequestModal) closeEmployeeRemovalRequestModal();
    });

    dom.employeeRemovalRequestSubmit.addEventListener("click", async () => {
      const employee = findEmployeeById(state.actionEmployeeId);
      if (!employee) return;
      const reason = String(dom.employeeRemovalReasonInput.value || "").trim();
      if (!reason) {
        dom.employeeRemovalRequestFeedback.textContent = "Informe o motivo da solicitacao.";
        dom.employeeRemovalRequestFeedback.classList.remove("hidden-state");
        return;
      }

      dom.employeeRemovalRequestSubmit.disabled = true;
      try {
        await requestEmployeeRemoval(employee, reason);
        closeEmployeeRemovalRequestModal();
      } catch (error) {
        dom.employeeRemovalRequestFeedback.textContent = "Nao foi possivel solicitar a remocao do funcionario.";
        dom.employeeRemovalRequestFeedback.classList.remove("hidden-state");
      } finally {
        dom.employeeRemovalRequestSubmit.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".filter-popover")) closeFiltersPanel();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.employeeModal.classList.contains("visible")) closeEmployeeModal();
      if (event.key === "Escape" && dom.employeeDeleteConfirmModal.classList.contains("visible")) closeEmployeeDeleteConfirmModal();
      if (event.key === "Escape" && dom.employeeRemovalRequestModal.classList.contains("visible")) closeEmployeeRemovalRequestModal();
      if (event.key === "Escape" && dom.filtersPanel.classList.contains("visible")) closeFiltersPanel();
    });
  }

  auth.onAuthStateChanged(async (user) => {
    state.currentUser = user;

    if (!user) {
      state.currentUserData = null;
      state.allUsers = [];
      if (typeof state.unsubUsers === "function") state.unsubUsers();
      redirectToLogin();
      return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    state.currentUserData = userDoc.exists ? { id: user.uid, ...userDoc.data() } : null;

    if (!isAdminProfile()) {
      sessionStorage.setItem("ridLoginFeedback", "Sua conta nao tem permissao para este painel.");
      await auth.signOut();
      return;
    }

    listenUsers();
    showPage();
  });

  bindEvents();
  lucide.createIcons();
})();
