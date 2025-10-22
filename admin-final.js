/* =====================================================
   admin-final.js
   Phiên bản hợp nhất đầy đủ (admin.js + admin.fixed.js)
   Tác dụng: quản lý đăng nhập, sidebar, header, khách hàng,
   hợp đồng, thanh toán, báo cáo, cấu hình.
   ===================================================== */

(() => {
  // ====== Keys ======
  const KEY_USER = "cam_logged_in_user";
  const KEY_CONTRACTS = "contracts";
  const KEY_PAYMENTS = "payments";

  // ====== State ======
  let contracts = [];
  let payments = [];

  // ====== Boot ======
  document.addEventListener("DOMContentLoaded", () => {
    // Trang login?
    const loginForm = document.getElementById("adminLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleLogin();
      });
      return;
    }

    // Nạp dữ liệu
    loadContracts();
    loadPayments();

    // Inject layout (nếu chưa có)
    injectLayout();

    // Route-specific
    const path = (
      window.location.pathname.split("/").pop() || ""
    ).toLowerCase();
    if (path === "reports.html") generateReports();
    if (path === "admin-dashboard.html") renderDashboard();
    if (path === "contracts.html")
      renderContractsTable("#contracts-table tbody");
    if (path === "payments.html") renderPaymentsHistory();

    // Form: Tạo hợp đồng
    const newContractForm = document.getElementById("form-new-contract");
    if (newContractForm) {
      newContractForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleCreateContract(newContractForm);
      });
      // fallback nếu nút không phải submit
      const tryBtn = newContractForm.querySelector(
        '[type="button"], #btnCreateContract, [data-action="create-contract"]'
      );
      if (tryBtn) {
        tryBtn.addEventListener("click", (e) => {
          e.preventDefault();
          handleCreateContract(newContractForm);
        });
      }
    }

    // Form: Giao dịch
    const paymentForm = document.getElementById("form-payment");
    if (paymentForm) {
      paymentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleRecordPayment(paymentForm);
      });
    }

    // Form: Settings
    const settingsForm = document.getElementById("form-settings");
    if (settingsForm) {
      const msg = document.getElementById("settings-msg");
      const saved = JSON.parse(localStorage.getItem("settings") || "{}");
      for (let k in saved)
        if (settingsForm[k]) settingsForm[k].value = saved[k];
      settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(settingsForm));
        localStorage.setItem("settings", JSON.stringify(formData));
        if (msg) {
          msg.textContent = "✅ Đã lưu cấu hình hệ thống!";
          msg.style.color = "#0077b6";
        }
      });
    }

    // Quản lý khách hàng
    initCustomers();
  });

  // ====== LOGIN ======
  function handleLogin() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("login-message");
    const user = { username, role: "admin" };
    localStorage.setItem(KEY_USER, JSON.stringify(user));
    msg.textContent = "Đăng nhập thành công — chuyển hướng...";
    msg.className = "message success";
    setTimeout(() => (window.location.href = "admin-dashboard.html"), 600);
  }

  // ====== Load/Save ======
  function loadContracts() {
    try {
      contracts = JSON.parse(localStorage.getItem(KEY_CONTRACTS) || "[]");
    } catch {
      contracts = [];
    }
  }
  function saveContracts() {
    try {
      localStorage.setItem(KEY_CONTRACTS, JSON.stringify(contracts));
    } catch {}
  }
  function loadPayments() {
    try {
      payments = JSON.parse(localStorage.getItem(KEY_PAYMENTS) || "[]");
    } catch {
      payments = [];
    }
  }
  function savePayments() {
    try {
      localStorage.setItem(KEY_PAYMENTS, JSON.stringify(payments));
    } catch {}
  }

  // ====== Create Contract ======
  function handleCreateContract(form) {
    const msg = document.getElementById("contract-msg");
    const fd = new FormData(form);

    const customer = (fd.get("customer") || "").trim();
    const phone = (fd.get("phone") || "").trim();
    const asset = (fd.get("asset") || "").trim();
    const start = (fd.get("start") || fd.get("startDate") || "").trim();
    const due = (fd.get("due") || fd.get("dueDate") || "").trim();
    const valueNum = Number(fd.get("value") || fd.get("amount") || 0);

    if (!customer || !asset || !start || !due || !valueNum || valueNum <= 0) {
      if (msg) {
        msg.textContent = "Vui lòng điền đầy đủ & hợp lệ.";
        msg.className = "message error";
      }
      return;
    }

    const id = genId("HD");
    const { status, statusClass } = computeStatus(due);
    const contract = {
      id,
      customer,
      phone,
      asset,
      start,
      due,
      value: valueNum.toLocaleString("vi-VN") + " ₫",
      status,
      statusClass,
      createdAt: new Date().toISOString(),
    };

    contracts.unshift(contract);
    saveContracts();
    renderContractsTable("#contracts-table tbody");
    renderDashboard();
    generateReports();

    if (msg) {
      msg.textContent = `Tạo hợp đồng ${id} thành công.`;
      msg.className = "message success";
    }
    form.reset();
  }

  // ====== Record Payment ======
  function handleRecordPayment(form) {
    const msg = document.getElementById("payment-msg");
    const fd = new FormData(form);
    const contractId = (
      fd.get("contractId") ||
      fd.get("contract") ||
      ""
    ).trim();
    const type = (fd.get("type") || "").trim();
    const amount = Number(fd.get("amount") || 0);
    const note = (fd.get("note") || "").trim();

    if (!contractId || !type || amount <= 0) {
      if (msg) {
        msg.textContent = "Vui lòng nhập dữ liệu giao dịch hợp lệ.";
        msg.className = "message error";
      }
      return;
    }

    const c = contracts.find((x) => x.id === contractId);
    if (!c) {
      if (msg) {
        msg.textContent = "Không tìm thấy hợp đồng.";
        msg.className = "message error";
      }
      return;
    }

    const id = genId("GD");
    payments.unshift({
      id,
      contractId,
      customer: c.customer,
      type,
      amount,
      note,
      date: new Date().toLocaleString("vi-VN"),
    });
    savePayments();

    if (
      type.toLowerCase().includes("chuộc") ||
      type.toLowerCase().includes("chuoc")
    ) {
      c.status = "Đã chuộc";
      c.statusClass = "normal";
      saveContracts();
    }

    renderPaymentsHistory();
    renderContractsTable("#contracts-table tbody");
    renderDashboard();
    generateReports();

    if (msg) {
      msg.textContent = `💾 Đã ghi nhận giao dịch ${id}`;
      msg.className = "message success";
    }
    form.reset();
  }

  // ====== Dashboard & Reports ======
  function computeStatus(dueISO) {
    const today = new Date();
    const due = new Date(dueISO);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (isNaN(due.getTime()))
      return { status: "Đang hoạt động", statusClass: "normal" };
    if (diff < 0) return { status: "Quá hạn", statusClass: "danger" };
    if (diff <= 7) return { status: "Sắp đến hạn", statusClass: "warning" };
    return { status: "Đang hoạt động", statusClass: "normal" };
  }

  function renderDashboard() {
    const { active, dueSoon, overdue } = classifyContracts();
    setText("#stat-contracts", active.length + dueSoon.length + overdue.length);
    setText("#stat-dues", dueSoon.length);
    setText("#stat-overdue", overdue.length);
    setText("#stat-customers", unique(contracts.map((c) => c.customer)).length);

    const tb = document.querySelector("#recent-contracts tbody");
    if (!tb) return;
    tb.innerHTML = "";
    if (!contracts.length) {
      tb.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666">Không có hợp đồng</td></tr>`;
      return;
    }
    contracts.slice(0, 5).forEach((c) => {
      tb.innerHTML += `<tr>
        <td>${c.id}</td>
        <td>${esc(c.customer)}</td>
        <td>${esc(c.asset)}</td>
        <td>${fmtDate(c.due)}</td>
        <td><span class="badge ${c.statusClass}">${c.status}</span></td>
      </tr>`;
    });
  }

  function generateReports() {
    const { active, dueSoon, overdue } = classifyContracts();
    const c = document.querySelectorAll(".summary-cards .stat");
    if (c.length >= 3) {
      c[0].textContent = active.length;
      c[1].textContent = dueSoon.length;
      c[2].textContent = overdue.length;
    }
    fillTable("#dueSoonTable tbody", dueSoon);
    fillTable("#overdueTable tbody", overdue);
  }

  function classifyContracts() {
    const list = JSON.parse(localStorage.getItem(KEY_CONTRACTS) || "[]") || [];
    contracts = list.map((c) => {
      if (c.status === "Đã chuộc") return c;
      const s = computeStatus(c.due);
      return { ...c, status: s.status, statusClass: s.statusClass };
    });
    saveContracts();
    const active = [],
      dueSoon = [],
      overdue = [];
    contracts.forEach((c) => {
      if (c.status === "Quá hạn") overdue.push(c);
      else if (c.status === "Sắp đến hạn") dueSoon.push(c);
      else active.push(c);
    });
    return { active, dueSoon, overdue };
  }

  function fillTable(selector, list) {
    const tb = document.querySelector(selector);
    if (!tb) return;
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#666">Không có dữ liệu</td></tr>`;
      return;
    }
    tb.innerHTML = list
      .map(
        (c) => `
      <tr>
        <td>${c.id}</td>
        <td>${esc(c.customer)}</td>
        <td>${esc(c.asset)}</td>
        <td>${fmtDate(c.start)}</td>
        <td>${fmtDate(c.due)}</td>
        <td>${daysFromNow(c.due)} ngày</td>
        <td><span class="badge ${c.statusClass}">${c.status}</span></td>
      </tr>`
      )
      .join("");
  }

  function renderContractsTable(selector) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;
    if (!contracts.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#666">Không có dữ liệu</td></tr>`;
      return;
    }
    tbody.innerHTML = contracts
      .map(
        (c) => `
      <tr>
        <td>${c.id}</td>
        <td>${esc(c.customer)}</td>
        <td>${esc(c.phone || "")}</td>
        <td>${esc(c.asset)}</td>
        <td>${fmtDate(c.start)}</td>
        <td>${fmtDate(c.due)}</td>
        <td>${c.value}</td>
        <td><span class="badge ${c.statusClass}">${c.status}</span></td>
        <td>
          <button class="btn small edit">Sửa</button>
          <button class="btn small delete">Xóa</button>
        </td>
      </tr>`
      )
      .join("");
  }

  function renderPaymentsHistory() {
    const tb = document.querySelector("table.report-table tbody");
    if (!tb) return;
    if (!payments.length) {
      tb.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#666">Không có giao dịch</td></tr>`;
      return;
    }
    tb.innerHTML = payments
      .map(
        (p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.contractId}</td>
        <td>${esc(p.customer)}</td>
        <td>${esc(p.type)}</td>
        <td>${p.date}</td>
        <td>${Number(p.amount).toLocaleString("vi-VN")} ₫</td>
      </tr>`
      )
      .join("");
  }

  // ====== Utils ======
  function genId(prefix) {
    return (
      prefix +
      Date.now().toString(36).toUpperCase() +
      Math.floor(Math.random() * 900 + 100)
    );
  }
  function fmtDate(s) {
    const d = new Date(s);
    return isNaN(d) ? s || "" : d.toLocaleDateString("vi-VN");
  }
  function daysFromNow(due) {
    const d = new Date(due);
    if (isNaN(d)) return "—";
    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    return Math.abs(diff);
  }
  function esc(t) {
    return (t || "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function unique(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }
  function setText(sel, val) {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  }

  // ====== Layout auto inject (chỉ thêm khi chưa có) ======
  function injectLayout() {
    if (
      document.querySelector(".sidebar") ||
      document.querySelector(".admin-header")
    )
      return;
    const sidebarHTML = `
      <aside class="sidebar" id="site-sidebar">
        <div class="sidebar-header">
          <h2>Quản trị viên</h2>
        </div>
        <nav>
          <ul>
            <li><a href="admin-dashboard.html">Bảng điều khiển</a></li>
            <li><a href="customers.html">Khách hàng</a></li>
            <li><a href="contracts.html">Hợp đồng</a></li>
            <li><a href="payments.html">Thu / Chuộc</a></li>
            <li><a href="reports.html">Báo cáo</a></li>
            <li><a href="settings.html">Cấu hình</a></li>
          </ul>
        </nav>
      </aside>`;
    document.body.insertAdjacentHTML("afterbegin", sidebarHTML);
    const headerHTML = `<header class="admin-header"><h1>Trang quản trị</h1></header>`;
    document.body.insertAdjacentHTML("afterbegin", headerHTML);
  }

  // ====== Quản lý khách hàng ======
  function initCustomers() {
    const table = document.getElementById("customers-table");
    if (!table) return;
    const saved = JSON.parse(localStorage.getItem("customers") || "[]");
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";
    saved.forEach((row) => addCustomerRow(row, tbody));

    const btnAdd = document.getElementById("btn-add-customer");
    btnAdd?.addEventListener("click", () => {
      const name = prompt("Tên khách hàng:");
      const phone = prompt("Số điện thoại:");
      const idcard = prompt("CMND/CCCD:");
      if (!name || !phone) return alert("Vui lòng nhập đủ thông tin!");
      const id = "KH" + Date.now().toString().slice(-4);
      const data = {
        id,
        name,
        phone,
        idcard,
        contracts: 0,
        status: "Hoạt động",
      };
      addCustomerRow(data, tbody);
      saveCustomers(table);
    });

    const searchInput = document.getElementById("search-customer");
    searchInput?.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll("#customers-table tbody tr").forEach((tr) => {
        tr.style.display = tr.textContent.toLowerCase().includes(term)
          ? ""
          : "none";
      });
    });

    table.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete")) {
        if (confirm("Xóa khách hàng này?")) {
          e.target.closest("tr").remove();
          saveCustomers(table);
        }
      } else if (e.target.classList.contains("edit")) {
        const row = e.target.closest("tr").children;
        const name = prompt("Tên mới:", row[1].textContent);
        const phone = prompt("SĐT:", row[2].textContent);
        const idcard = prompt("CMND/CCCD:", row[3].textContent);
        if (name) row[1].textContent = name;
        if (phone) row[2].textContent = phone;
        if (idcard) row[3].textContent = idcard;
        saveCustomers(table);
      }
    });
  }

  function addCustomerRow(data, tbody) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.id}</td>
      <td>${data.name}</td>
      <td>${data.phone}</td>
      <td>${data.idcard}</td>
      <td>${data.contracts}</td>
      <td><span class="badge normal">${data.status}</span></td>
      <td>
        <button class="btn small edit">Sửa</button>
        <button class="btn small delete">Xóa</button>
      </td>`;
    tbody.appendChild(tr);
  }

  function saveCustomers(table) {
    const rows = [...table.querySelectorAll("tbody tr")];
    const data = rows.map((r) => ({
      id: r.children[0].textContent,
      name: r.children[1].textContent,
      phone: r.children[2].textContent,
      idcard: r.children[3].textContent,
      contracts: r.children[4].textContent,
      status: r.children[5].textContent,
    }));
    localStorage.setItem("customers", JSON.stringify(data));
  }
})(); // ====== GẮN SỰ KIỆN CHO NÚT SỬA & XÓA HỢP ĐỒNG (phiên bản ổn định) ======
document.addEventListener("click", function (e) {
  const target = e.target;

  // ----- XÓA HỢP ĐỒNG -----
  if (target.classList.contains("delete")) {
    const row = target.closest("tr");
    if (!row) return;
    const id = row.children[0].textContent.trim();
    if (!id) return;
    if (confirm("Bạn có chắc muốn xóa hợp đồng " + id + " ?")) {
      // Lấy lại danh sách hợp đồng mới nhất từ localStorage
      let data = JSON.parse(localStorage.getItem("contracts") || "[]");
      data = data.filter((c) => c.id !== id);
      localStorage.setItem("contracts", JSON.stringify(data));

      // Cập nhật giao diện
      contracts = data;
      renderContractsTable("#contracts-table tbody");
      renderDashboard();
      generateReports();
    }
  }

  // ----- SỬA HỢP ĐỒNG -----
  if (target.classList.contains("edit")) {
    const row = target.closest("tr");
    if (!row) return;
    const id = row.children[0].textContent.trim();
    let data = JSON.parse(localStorage.getItem("contracts") || "[]");
    const c = data.find((x) => x.id === id);
    if (!c) return alert("Không tìm thấy hợp đồng!");

    const newVal = prompt(
      "Nhập giá trị mới cho hợp đồng " + id + ":",
      c.value.replace(/[^\d]/g, "")
    );
    if (newVal && !isNaN(newVal)) {
      c.value = Number(newVal).toLocaleString("vi-VN") + " ₫";
      // Lưu lại
      localStorage.setItem("contracts", JSON.stringify(data));
      contracts = data;
      renderContractsTable("#contracts-table tbody");
      renderDashboard();
      generateReports();
    }
  }
}); // ====== HIỂN THỊ KHÁCH HÀNG TRONG customers.html ======
document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#customers-table tbody");
  if (!table) return;

  const customers = JSON.parse(localStorage.getItem("customers") || "[]");
  table.innerHTML = customers
    .map(
      (c) => `
      <tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${c.phone}</td>
        <td>${c.idcard}</td>
        <td>${c.contracts}</td>
        <td><span class="badge normal">${c.status}</span></td>
      </tr>`
    )
    .join("");
}); // ====== HIỂN THỊ, SỬA & XÓA KHÁCH HÀNG TRONG customers.html ======
document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#customers-table tbody");
  if (!table) return;

  function loadCustomers() {
    return JSON.parse(localStorage.getItem("customers") || "[]");
  }

  function saveCustomers(list) {
    localStorage.setItem("customers", JSON.stringify(list));
  }

  function renderCustomers() {
    const customers = loadCustomers();
    if (!customers.length) {
      table.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#666">Chưa có khách hàng</td></tr>`;
      return;
    }
    table.innerHTML = customers
      .map(
        (c) => `
      <tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${c.phone}</td>
        <td>${c.idcard}</td>
        <td>${c.contracts}</td>
        <td><span class="badge normal">${c.status}</span></td>
        <td>
          <button class="btn small edit">Sửa</button>
          <button class="btn small delete">Xóa</button>
        </td>
      </tr>`
      )
      .join("");
  }

  renderCustomers();

  // --- Bắt sự kiện Sửa / Xóa ---
  document.addEventListener("click", (e) => {
    const btn = e.target;
    if (!btn.closest("#customers-table")) return;

    const row = btn.closest("tr");
    const id = row?.children[0]?.textContent?.trim();
    if (!id) return;

    // Xóa khách hàng
    if (btn.classList.contains("delete")) {
      if (confirm(`Bạn có chắc muốn xóa khách hàng ${id}?`)) {
        let list = loadCustomers();
        list = list.filter((c) => c.id !== id);
        saveCustomers(list);
        renderCustomers();
        alert("✅ Đã xóa khách hàng!");
      }
    }

    // Sửa khách hàng
    if (btn.classList.contains("edit")) {
      let list = loadCustomers();
      const c = list.find((c) => c.id === id);
      if (!c) return alert("Không tìm thấy khách hàng!");

      const newName = prompt("Tên khách hàng:", c.name) || c.name;
      const newPhone = prompt("Số điện thoại:", c.phone) || c.phone;
      const newIdCard = prompt("CMND/CCCD:", c.idcard) || c.idcard;
      const newStatus = prompt("Trạng thái:", c.status) || c.status;

      c.name = newName;
      c.phone = newPhone;
      c.idcard = newIdCard;
      c.status = newStatus;

      saveCustomers(list);
      renderCustomers();
      alert("💾 Đã cập nhật thông tin khách hàng!");
    }
  });
});
// ====== THÊM NÚT ĐĂNG XUẤT CHO ADMIN ======
document.addEventListener("DOMContentLoaded", () => {
  // 1️⃣ Tìm vị trí sidebar hoặc header để chèn nút
  const sidebar = document.querySelector(".sidebar");
  const header = document.querySelector(".admin-header");

  // 2️⃣ Nếu có sidebar
  if (sidebar && !sidebar.querySelector(".logout-btn")) {
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "logout-btn";
    logoutBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Đăng xuất`;
    logoutBtn.style.cssText = `
      width: 85%;
      margin: 15px auto;
      display: block;
      background: #d33;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px;
      font-size: 15px;
      cursor: pointer;
      transition: 0.3s;
    `;
    logoutBtn.addEventListener(
      "mouseenter",
      () => (logoutBtn.style.background = "#b22")
    );
    logoutBtn.addEventListener(
      "mouseleave",
      () => (logoutBtn.style.background = "#d33")
    );
    logoutBtn.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
        localStorage.removeItem("adminLogged"); // hoặc key bạn đang dùng
        window.location.href = "admin-login.html"; // chuyển về trang đăng nhập
      }
    });
    sidebar.appendChild(logoutBtn);
  }

  // 3️⃣ Nếu có header mà chưa có nút đăng xuất
  if (header && !header.querySelector(".logout-btn")) {
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "logout-btn";
    logoutBtn.textContent = "Đăng xuất";
    logoutBtn.style.cssText = `
      background: #d33;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      margin-left: 15px;
      cursor: pointer;
      font-size: 15px;
    `;
    logoutBtn.addEventListener(
      "mouseenter",
      () => (logoutBtn.style.background = "#b22")
    );
    logoutBtn.addEventListener(
      "mouseleave",
      () => (logoutBtn.style.background = "#d33")
    );
    logoutBtn.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
        localStorage.removeItem("adminLogged");
        window.location.href = "admin-login.html";
      }
    });
    header.appendChild(logoutBtn);
  }
});
/* ==========================
   PAYMENTS PAGE (payments.html)
   ========================== */
document.addEventListener("DOMContentLoaded", () => {
  const file = location.pathname.split("/").pop().toLowerCase();
  if (file !== "payments.html") return; // chỉ chạy khi đang ở payments.html

  const form = document.getElementById("form-payment");
  const inputId = form?.querySelector("input[name='contractId']");
  const infoBox = document.getElementById("contract-info");
  const msg = document.getElementById("payment-msg");

  if (!form || !inputId) return;

  // 🔹 Khi nhập mã hợp đồng
  inputId.addEventListener("input", () => {
    const id = inputId.value.trim();
    if (!id) {
      infoBox.style.display = "none";
      msg.textContent = "";
      return;
    }

    const contracts = JSON.parse(localStorage.getItem("contracts") || "[]");
    const c = contracts.find(
      (x) => (x.id || "").toLowerCase() === id.toLowerCase()
    );
    if (!c) {
      msg.textContent = `❌ Không tìm thấy hợp đồng mã "${id}"!`;
      msg.style.color = "red";
      infoBox.style.display = "none";
      return;
    }

    msg.textContent = "";
    msg.style.color = "";
    infoBox.style.display = "block";

    // 🔹 Tính lãi tự động
    const start = new Date(c.start);
    const today = new Date();
    const diffDays = Math.max(
      1,
      Math.ceil((today - start) / (1000 * 60 * 60 * 24))
    );
    const value = Number((c.value || "0").replace(/[^\d]/g, ""));
    const interestRate = 0.03; // 3% / tháng
    const dailyRate = interestRate / 30;
    const interest = Math.round(value * dailyRate * diffDays);

    // 🔹 Hiển thị chi tiết
    document.getElementById("info-customer").textContent =
      c.customer || "(Không rõ)";
    document.getElementById("info-asset").textContent = c.asset || "(Không rõ)";
    document.getElementById("info-value").textContent = c.value || "—";
    document.getElementById("info-start").textContent = new Date(
      c.start
    ).toLocaleDateString("vi-VN");
    document.getElementById("info-due").textContent = new Date(
      c.due
    ).toLocaleDateString("vi-VN");
    document.getElementById("info-days").textContent = diffDays;
    document.getElementById("info-interest").textContent =
      interest.toLocaleString("vi-VN") + " ₫";

    // 🔹 Gợi ý số tiền
    const amountInput = form.querySelector("input[name='amount']");
    const typeSelect = form.querySelector("select[name='type']");

    function updateAmount() {
      if (typeSelect.value === "Chuộc") {
        amountInput.value = (interest + value).toFixed(0);
      } else {
        amountInput.value = interest.toFixed(0);
      }
    }

    typeSelect.onchange = updateAmount;
    updateAmount();
  });

  // 🔹 Khi bấm "Ghi nhận"
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const id = (data.get("contractId") || "").trim();
    const type = data.get("type");
    const amount = parseFloat(data.get("amount") || "0");
    const note = data.get("note") || "";
    const date = new Date().toLocaleString("vi-VN");

    if (!id) {
      msg.textContent = "✅ Ghi nhận giao dịch thành công!";
      msg.style.color = "green";
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      msg.textContent = "❌ Vui lòng nhập hoặc để hệ thống gợi ý số tiền!";
      msg.style.color = "red";
      return;
    }

    const contracts = JSON.parse(localStorage.getItem("contracts") || "[]");
    const c = contracts.find(
      (x) => (x.id || "").toLowerCase() === id.toLowerCase()
    );
    if (!c) {
      msg.textContent = "❌ Không tìm thấy hợp đồng!";
      msg.style.color = "red";
      return;
    }

    const payments = JSON.parse(localStorage.getItem("payments") || "[]");
    const newPayment = {
      id: "GD" + Date.now().toString().slice(-6),
      contractId: id,
      customer: c.customer,
      type,
      date,
      amount: amount.toLocaleString("vi-VN") + " ₫",
      note,
    };
    payments.unshift(newPayment);
    localStorage.setItem("payments", JSON.stringify(payments));

    msg.textContent = "✅ Ghi nhận giao dịch thành công!";
    msg.style.color = "green";
    form.reset();
    infoBox.style.display = "none";
    renderPaymentsList();
  });

  // 🔹 Hiển thị lịch sử giao dịch
  function renderPaymentsList() {
    const tbody = document.querySelector("table tbody");
    if (!tbody) return;
    const list = JSON.parse(localStorage.getItem("payments") || "[]").slice(
      0,
      10
    );
    tbody.innerHTML = list
      .map(
        (p) => `
        <tr>
          <td>${p.id}</td>
          <td>${p.contractId}</td>
          <td>${p.customer}</td>
          <td>${p.type}</td>
          <td>${p.date}</td>
          <td>${p.amount}</td>
        </tr>`
      )
      .join("");
  }
  renderPaymentsList();
});
