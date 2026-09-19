const STORAGE_KEY = "cartera_neuquen_v1";

const defaultData = {
  settings: {
    interest: 20,
    term: 22,
    commission: 4,
    initialCapital: 10000000
  },
  clients: [],
  credits: [],
  payments: [],
  cash: []
};

let data = loadData();

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultData, ...JSON.parse(saved) } : structuredClone(defaultData);
  } catch (error) {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  render();
}

function money(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function number(value) {
  return Number(value) || 0;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function generateId(prefix) {
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

function addDays(dateString, days) {
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + Number(days));
  return date.toISOString().split("T")[0];
}

function daysLate(dueDate) {
  const todayDate = new Date(today() + "T00:00:00");
  const due = new Date(dueDate + "T00:00:00");
  const diff = Math.floor((todayDate - due) / 86400000);
  return Math.max(0, diff);
}

function getClient(id) {
  return data.clients.find(client => client.id === id);
}

function getCredit(id) {
  return data.credits.find(credit => credit.id === id);
}

function totalPaid(creditId) {
  return data.payments
    .filter(payment => payment.creditId === creditId)
    .reduce((sum, payment) => sum + number(payment.amount), 0);
}

function outstanding(credit) {
  return Math.max(0, number(credit.totalToPay) - totalPaid(credit.id));
}

function isOverdue(credit) {
  return credit.status === "Active" &&
    outstanding(credit) > 0 &&
    daysLate(credit.dueDate) > 0;
}

function capitalPlaced() {
  return data.credits
    .filter(c => c.status !== "Cancelled")
    .reduce((sum, c) => {
      const paid = totalPaid(c.id);
      return sum + Math.max(0, number(c.amount) - paid);
    }, 0);
}

function totalOutstanding() {
  return data.credits
    .filter(c => c.status !== "Cancelled")
    .reduce((sum, c) => sum + outstanding(c), 0);
}

function totalCollected() {
  return data.payments.reduce((sum, p) => sum + number(p.amount), 0);
}

function totalCommissions() {
  return data.payments.reduce((sum, p) => sum + number(p.commission), 0);
}

function cashBalance() {
  let balance = number(data.settings.initialCapital);

  data.cash.forEach(movement => {
    balance += number(movement.entry);
    balance -= number(movement.exit);
  });

  return balance;
}

function render() {
  renderDashboard();
  renderClients();
  renderCredits();
  renderPayments();
  renderCash();
  renderReports();
  renderSettings();
}

function renderDashboard() {
  const available = cashBalance();
  const placed = capitalPlaced();
  const pending = totalOutstanding();
  const collected = totalCollected();

  const activeClients = data.clients.filter(client => client.status !== "Inactive").length;
  const activeCredits = data.credits.filter(c => c.status === "Active").length;
  const overdueCredits = data.credits.filter(isOverdue).length;

  const todayPayments = data.payments.filter(p => p.date === today());
  const todayCollected = todayPayments.reduce((sum, p) => sum + number(p.amount), 0);
  const todayCommission = todayPayments.reduce((sum, p) => sum + number(p.commission), 0);

  setText("dashboardCash", money(available));
  setText("dashboardCapital", money(number(data.settings.initialCapital)));
  setText("dashboardPlaced", money(placed));
  setText("dashboardOutstanding", money(pending));
  setText("dashboardCollected", money(collected));
  setText("dashboardClients", activeClients);
  setText("dashboardOverdue", overdueCredits);
  setText("dashboardToday", money(todayCollected));
  setText("dashboardCommission", money(todayCommission));
  setText("dashboardCredits", activeCredits);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function showView(viewName) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });

  const selected = document.getElementById(viewName);
  if (selected) selected.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.remove("active");
    if (button.dataset.view === viewName) {
      button.classList.add("active");
    }
  });

  window.scrollTo(0, 0);
}

function openModal(title, content) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");

  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="modal-header">
      <h2>${title}</h2>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    ${content}
  `;

  modal.classList.add("show");
}

function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.remove("show");
}

function addClientForm() {
  openModal("Nuevo cliente", `
    <form onsubmit="saveClient(event)">
      <div class="form-group">
        <label>Nombre completo</label>
        <input id="clientName" required>
      </div>

      <div class="form-group">
        <label>Teléfono</label>
        <input id="clientPhone" type="tel">
      </div>

      <div class="form-group">
        <label>Dirección / Zona</label>
        <input id="clientAddress">
      </div>

      <div class="form-group">
        <label>Actividad / Negocio</label>
        <input id="clientBusiness">
      </div>

      <div class="form-group">
        <label>Notas</label>
        <textarea id="clientNotes"></textarea>
      </div>

      <button class="btn green full" type="submit">
        Guardar cliente
      </button>
    </form>
  `);
}

function saveClient(event) {
  event.preventDefault();

  const client = {
    id: generateId("CLI"),
    name: document.getElementById("clientName").value.trim(),
    phone: document.getElementById("clientPhone").value.trim(),
    address: document.getElementById("clientAddress").value.trim(),
    business: document.getElementById("clientBusiness").value.trim(),
    dateAdded: today(),
    status: "Active",
    notes: document.getElementById("clientNotes").value.trim()
  };

  data.clients.push(client);
  saveData();
  closeModal();
  showView("clientes");
}

function renderClients() {
  const container = document.getElementById("clientsList");
  if (!container) return;

  if (!data.clients.length) {
    container.innerHTML = `
      <div class="empty">
        No hay clientes registrados todavía.
      </div>
    `;
    return;
  }

  container.innerHTML = data.clients.map(client => {
    const clientCredits = data.credits.filter(c => c.clientId === client.id && c.status !== "Cancelled");
    const balance = clientCredits.reduce((sum, c) => sum + outstanding(c), 0);

    return `
      <div class="list-item">
        <div class="list-item-top">
          <div>
            <h3>${escapeHtml(client.name)}</h3>
            <p>${escapeHtml(client.phone || "Sin teléfono")}</p>
            <p>${escapeHtml(client.address || "Sin zona registrada")}</p>
          </div>

          <span class="badge ${client.status === "Active" ? "green" : ""}">
            ${client.status === "Active" ? "Activo" : "Inactivo"}
          </span>
        </div>

        <p><strong>Saldo pendiente:</strong> ${money(balance)}</p>

        <div class="actions">
          <button class="btn" onclick="clientDetails('${client.id}')">
            Ver cliente
          </button>

          <button class="btn green" onclick="addCreditForm('${client.id}')">
            Nuevo crédito
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function clientDetails(clientId) {
  const client = getClient(clientId);
  if (!client) return;

  const credits = data.credits.filter(c => c.clientId === clientId);
  const balance = credits.reduce((sum, c) => sum + outstanding(c), 0);

  openModal("Ficha del cliente", `
    <div class="card">
      <h3>${escapeHtml(client.name)}</h3>
      <p>Teléfono: ${escapeHtml(client.phone || "-")}</p>
      <p>Zona: ${escapeHtml(client.address || "-")}</p>
      <p>Actividad: ${escapeHtml(client.business || "-")}</p>
      <p>Saldo pendiente: <strong>${money(balance)}</strong></p>
    </div>

    <button class="btn green full" onclick="addCreditForm('${client.id}')">
      Crear crédito
    </button>
  `);
}

function addCreditForm(clientId = "") {
  const clientOptions = data.clients.map(client => `
    <option value="${client.id}" ${client.id === clientId ? "selected" : ""}>
      ${escapeHtml(client.name)}
    </option>
  `).join("");

  openModal("Nuevo crédito", `
    <form onsubmit="saveCredit(event)">
      <div class="form-group">
        <label>Cliente</label>
        <select id="creditClient" required>
          <option value="">Seleccionar cliente</option>
          ${clientOptions}
        </select>
      </div>

      <div class="form-group">
        <label>Monto prestado</label>
        <input id="creditAmount" type="number" min="1" step="1" value="1000000" required>
      </div>

      <div class="form-group">
        <label>Interés (%)</label>
        <input id="creditInterest" type="number" step="0.01" value="${data.settings.interest}" required>
      </div>

      <div class="form-group">
        <label>Plazo (días)</label>
        <input id="creditTerm" type="number" min="1" value="${data.settings.term}" required>
      </div>

      <div class="form-group">
        <label>Fecha de desembolso</label>
        <input id="creditDate" type="date" value="${today()}" required>
      </div>

      <button class="btn green full" type="submit">
        Crear crédito
      </button>
    </form>
  `);
}

function saveCredit(event) {
  event.preventDefault();

  const clientId = document.getElementById("creditClient").value;
  const amount = number(document.getElementById("creditAmount").value);
  const interest = number(document.getElementById("creditInterest").value);
  const term = number(document.getElementById("creditTerm").value);
  const startDate = document.getElementById("creditDate").value;

  if (!clientId || amount <= 0 || term <= 0) return;

  const interestAmount = amount * (interest / 100);
  const totalToPay = amount + interestAmount;
  const dailyInstallment = totalToPay / term;
  const dueDate = addDays(startDate, term);

  const credit = {
    id: generateId("CRD"),
    clientId,
    date: startDate,
    amount,
    interest,
    interestAmount,
    totalToPay,
    term,
    dailyInstallment,
    dueDate,
    status: "Active",
    notes: ""
  };

  data.credits.push(credit);

  data.cash.push({
    id: generateId("MOV"),
    date: startDate,
    type: "Disbursement",
    concept: `Desembolso ${credit.id}`,
    entry: 0,
    exit: amount,
    notes: ""
  });

  saveData();
  closeModal();
  showView("creditos");
}

function renderCredits() {
  const container = document.getElementById("creditsList");
  if (!container) return;

  if (!data.credits.length) {
    container.innerHTML = `
      <div class="empty">
        No hay créditos registrados todavía.
      </div>
    `;
    return;
  }

  container.innerHTML = data.credits.map(credit => {
    const client = getClient(credit.clientId);
    const balance = outstanding(credit);
    const late = isOverdue(credit);

    if (balance <= 0 && credit.status === "Active") {
      credit.status = "Finished";
    }

    return `
      <div class="list-item">
        <div class="list-item-top">
          <div>
            <h3>${escapeHtml(client ? client.name : "Cliente eliminado")}</h3>
            <p>${credit.id}</p>
            <p>Prestado: ${money(credit.amount)}</p>
            <p>Total a pagar: ${money(credit.totalToPay)}</p>
          </div>

          <span class="badge ${late ? "red" : balance <= 0 ? "green" : "orange"}">
            ${late ? "En mora" : balance <= 0 ? "Finalizado" : "Activo"}
          </span>
        </div>

        <p><strong>Saldo:</strong> ${money(balance)}</p>
        <p><strong>Cuota diaria:</strong> ${money(credit.dailyInstallment)}</p>
        <p><strong>Vencimiento:</strong> ${credit.dueDate}</p>

        ${late ? `<p class="badge red">Días de mora: ${daysLate(credit.dueDate)}</p>` : ""}

        <div class="actions">
          ${balance > 0 ? `
            <button class="btn green" onclick="paymentForm('${credit.id}')">
              Registrar pago
            </button>
          ` : ""}

          <button class="btn secondary" onclick="creditDetails('${credit.id}')">
            Detalles
          </button>
        </div>
      </div>
    `;
  }).join("");

  saveDataWithoutRender();
}

function creditDetails(creditId) {
  const credit = getCredit(creditId);
  if (!credit) return;

  const client = getClient(credit.clientId);
  const paid = totalPaid(creditId);
  const balance = outstanding(credit);

  openModal("Detalle del crédito", `
    <div class="card">
      <p><strong>Cliente:</strong> ${escapeHtml(client ? client.name : "-")}</p>
      <p><strong>Monto:</strong> ${money(credit.amount)}</p>
      <p><strong>Interés:</strong> ${credit.interest}%</p>
      <p><strong>Interés generado:</strong> ${money(credit.interestAmount)}</p>
      <p><strong>Total:</strong> ${money(credit.totalToPay)}</p>
      <p><strong>Pagado:</strong> ${money(paid)}</p>
      <p><strong>Pendiente:</strong> ${money(balance)}</p>
      <p><strong>Plazo:</strong> ${credit.term} días</p>
      <p><strong>Cuota diaria:</strong> ${money(credit.dailyInstallment)}</p>
      <p><strong>Vencimiento:</strong> ${credit.dueDate}</p>
    </div>
  `);
}

function paymentForm(creditId) {
  const credit = getCredit(creditId);
  if (!credit) return;

  const client = getClient(credit.clientId);
  const balance = outstanding(credit);

  openModal("Registrar pago", `
    <form onsubmit="savePayment(event, '${creditId}')">
      <div class="card">
        <p><strong>Cliente:</strong> ${escapeHtml(client ? client.name : "-")}</p>
        <p><strong>Saldo pendiente:</strong> ${money(balance)}</p>
      </div>

      <div class="form-group">
        <label>Fecha del pago</label>
        <input id="paymentDate" type="date" value="${today()}" required>
      </div>

      <div class="form-group">
        <label>Monto recibido</label>
        <input id="paymentAmount" type="number" min="1" max="${balance}" step="1" value="${Math.min(Math.round(credit.dailyInstallment), balance)}" required>
      </div>

      <div class="form-group">
        <label>Método de pago</label>
        <select id="paymentMethod">
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      <div class="form-group">
        <label>Notas</label>
        <textarea id="paymentNotes"></textarea>
      </div>

      <button class="btn green full" type="submit">
        Guardar pago
      </button>
    </form>
  `);
}

function savePayment(event, creditId) {
  event.preventDefault();

  const credit = getCredit(creditId);
  if (!credit) return;

  const amount = number(document.getElementById("paymentAmount").value);
  const balanceBefore = outstanding(credit);

  if (amount <= 0 || amount > balanceBefore) {
    alert("El monto del pago no es válido.");
    return;
  }

  const commission = amount * (number(data.settings.commission) / 100);
  const netAmount = amount - commission;

  const payment = {
    id: generateId("PAY"),
    creditId,
    clientId: credit.clientId,
    date: document.getElementById("paymentDate").value,
    amount,
    method: document.getElementById("paymentMethod").value,
    commission,
    netAmount,
    notes: document.getElementById("paymentNotes").value.trim()
  };

  data.payments.push(payment);

  data.cash.push({
    id: generateId("MOV"),
    date: payment.date,
    type: "Collection",
    concept: `Cobro ${payment.id}`,
    entry: amount,
    exit: commission,
    notes: payment.notes
  });

  if (outstanding(credit) <= 0) {
    credit.status = "Finished";
  }

  saveData();
  closeModal();
  showView("pagos");
}

function renderPayments() {
  const container = document.getElementById("paymentsList");
  if (!container) return;

  if (!data.payments.length) {
    container.innerHTML = `
      <div class="empty">
        No hay pagos registrados todavía.
      </div>
    `;
    return;
  }

  const payments = [...data.payments].reverse();

  container.innerHTML = payments.map(payment => {
    const client = getClient(payment.clientId);

    return `
      <div class="list-item">
        <div class="list-item-top">
          <div>
            <h3>${escapeHtml(client ? client.name : "Cliente")}</h3>
            <p>${payment.date} · ${payment.method}</p>
          </div>

          <span class="badge green">
            ${money(payment.amount)}
          </span>
        </div>

        <p>Comisión 4%: ${money(payment.commission)}</p>
        <p>Neto: ${money(payment.netAmount)}</p>
      </div>
    `;
  }).join("");
}

function addCashForm() {
  openModal("Movimiento de caja", `
    <form onsubmit="saveCash(event)">
      <div class="form-group">
        <label>Fecha</label>
        <input id="cashDate" type="date" value="${today()}" required>
      </div>

      <div class="form-group">
        <label>Tipo</label>
        <select id="cashType">
          <option value="Capital">Capital</option>
          <option value="Expense">Gasto</option>
          <option value="Other">Otro</option>
        </select>
      </div>

      <div class="form-group">
        <label>Concepto</label>
        <input id="cashConcept" required>
      </div>

      <div class="form-group">
        <label>Entrada</label>
        <input id="cashEntry" type="number" min="0" value="0">
      </div>

      <div class="form-group">
        <label>Salida</label>
        <input id="cashExit" type="number" min="0" value="0">
      </div>

      <button class="btn green full" type="submit">
        Guardar movimiento
      </button>
    </form>
  `);
}

function saveCash(event) {
  event.preventDefault();

  const movement = {
    id: generateId("MOV"),
    date: document.getElementById("cashDate").value,
    type: document.getElementById("cashType").value,
    concept: document.getElementById("cashConcept").value.trim(),
    entry: number(document.getElementById("cashEntry").value),
    exit: number(document.getElementById("cashExit").value),
    notes: ""
  };

  data.cash.push(movement);

  saveData();
  closeModal();
  showView("caja");
}

function renderCash() {
  const container = document.getElementById("cashList");
  if (!container) return;

  if (!data.cash.length) {
    container.innerHTML = `
      <div class="empty">
        No hay movimientos manuales de caja.
      </div>
    `;
    return;
  }

  container.innerHTML = [...data.cash].reverse().map(movement => `
    <div class="list-item">
      <div class="list-item-top">
        <div>
          <h3>${escapeHtml(movement.concept)}</h3>
          <p>${movement.date}</p>
          <p>${movement.type}</p>
        </div>

        <div>
          ${movement.entry > 0 ? `<span class="badge green">+${money(movement.entry)}</span>` : ""}
          ${movement.exit > 0 ? `<span class="badge red">-${money(movement.exit)}</span>` : ""}
        </div>
      </div>
    </div>
  `).join("");
}

function renderReports() {
  setText("reportCollected", money(totalCollected()));
  setText("reportOutstanding", money(totalOutstanding()));
  setText("reportCommission", money(totalCommissions()));
  setText("reportPlaced", money(capitalPlaced()));
  setText("reportCash", money(cashBalance()));

  const overdue = data.credits.filter(isOverdue);

  const container = document.getElementById("overdueList");
  if (!container) return;

  if (!overdue.length) {
    container.innerHTML = `
      <div class="empty">
        No hay créditos en mora.
      </div>
    `;
    return;
  }

  container.innerHTML = overdue.map(credit => {
    const client = getClient(credit.clientId);

    return `
      <div class="list-item">
        <h3>${escapeHtml(client ? client.name : "Cliente")}</h3>
        <p>Saldo: ${money(outstanding(credit))}</p>
        <p>Días de mora: <strong>${daysLate(credit.dueDate)}</strong></p>
      </div>
    `;
  }).join("");
}

function renderSettings() {
  const interest = document.getElementById("settingInterest");
  const term = document.getElementById("settingTerm");
  const commission = document.getElementById("settingCommission");

  if (interest) interest.value = data.settings.interest;
  if (term) term.value = data.settings.term;
  if (commission) commission.value = data.settings.commission;
}

function saveSettings() {
  data.settings.interest = number(document.getElementById("settingInterest").value);
  data.settings.term = number(document.getElementById("settingTerm").value);
  data.settings.commission = number(document.getElementById("settingCommission").value);

  saveData();
  alert("Configuración guardada.");
}

function resetDemo() {
  if (!confirm("¿Crear nuevamente los 10 clientes de prueba?")) return;

  data.clients = [];

  for (let i = 1; i <= 10; i++) {
    data.clients.push({
      id: "CLI-DEMO-" + String(i).padStart(3, "0"),
      name: "Cliente Demo " + i,
      phone: "299-000-" + String(i).padStart(4, "0"),
      address: "Zona " + i,
      business: "Comercio / Independiente",
      dateAdded: today(),
      status: "Active",
      notes: "Cliente de prueba"
    });
  }

  data.credits = [];
  data.payments = [];
  data.cash = [];

  saveData();
  alert("Se crearon 10 clientes de prueba.");
}

function clearAllData() {
  if (!confirm("Esto eliminará todos los datos guardados. ¿Continuar?")) return;

  localStorage.removeItem(STORAGE_KEY);
  data = structuredClone(defaultData);
  render();
  alert("Datos eliminados.");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveDataWithoutRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view) showView(view);
    });
  });

  const modal = document.getElementById("modal");

  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
      .catch(() => {});
  }
});
