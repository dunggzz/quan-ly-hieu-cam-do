/* admin.js - combined logic (login, layout injection, sidebar toggle, reports & simple form handlers) */

(() => {
  // ====== USERS (dev-only) ======
  const USERS = [
    { username: "admin", password: "123456", role: "superadmin" },
    { username: "manager", password: "Mng@2025!", role: "manager" },
  ];

  // ====== Khi DOM sẵn sàng ======
  document.addEventListener("DOMContentLoaded", () => {
    // Nếu có form đăng nhập -> thiết lập xử lý login
    const loginForm = document.getElementById("adminLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleLogin();
      });
      return; // không làm phần inject sidebar cho trang login
    }

    // Inject layout (sidebar + header) cho các trang admin khác
    injectLayout();
    // Sau khi inject xong, init behaviors
    initPageBehaviors();
  });

  // ====== LOGIN ======
  function handleLogin() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("login-message");
    const user = USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (user) {
      localStorage.setItem("cam_logged_in_user", JSON.stringify(user));
      msg.textContent = "Đăng nhập thành công — chuyển hướng...";
      msg.className = "message success";
      setTimeout(() => {
        window.location.href = "admin-dashboard.html";
      }, 800);
    } else {
      msg.textContent = "Tên đăng nhập hoặc mật khẩu không đúng!";
      msg.className = "message error";
    }
  }

  // ====== INJECT LAYOUT ======
  function injectLayout() {
    // Sidebar HTML
    const sidebarHTML = `
      <aside class="sidebar" id="site-sidebar">
        <div class="sidebar-header">
          <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="admin">
          <h2>Quản trị viên</h2>
        </div>
        <nav>
          <ul>
            <li><a href="admin-dashboard.html" class="nav-link"><i class="fa-solid fa-house"></i> <span> Bảng điều khiển</span></a></li>
            <li><a href="customers.html" class="nav-link"><i class="fa-solid fa-users"></i> <span> Khách hàng</span></a></li>
            <li><a href="contracts.html" class="nav-link"><i class="fa-solid fa-file-contract"></i> <span> Hợp đồng</span></a></li>
            <li><a href="payments.html" class="nav-link"><i class="fa-solid fa-sack-dollar"></i> <span> Thu / Chuộc</span></a></li>
            <li><a href="reports.html" class="nav-link"><i class="fa-solid fa-chart-line"></i> <span> Báo cáo</span></a></li>
            <li><a href="settings.html" class="nav-link"><i class="fa-solid fa-gear"></i> <span> Cấu hình</span></a></li>
            <li><a href="admin-login.html" class="nav-link logout"><i class="fa-solid fa-right-from-bracket"></i> <span> Đăng xuất</span></a></li>
          </ul>
        </nav>
      </aside>
    `;

    // Header HTML
    const headerHTML = `
      <header class="admin-header">
        <div class="header-left">
          <button class="menu-toggle" id="menuToggle" title="Thu/hiện menu"><i class="fa-solid fa-bars"></i></button>
          <div class="header-title" id="page-title">Trang quản trị</div>
        </div>
        <div class="header-actions" id="headerActions">
          <a href="settings.html"><i class="fa-solid fa-gear"></i> <span class="label">Cấu hình</span></a>
          <a href="admin-login.html"><i class="fa-solid fa-right-from-bracket"></i> <span class="label">Đăng xuất</span></a>
        </div>
      </header>
    `;

    // Chèn sidebar vào body đầu
    document.body.insertAdjacentHTML("afterbegin", sidebarHTML);
    // Tìm wrapper (if none, create)
    let wrapper = document.querySelector(".admin-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "admin-wrapper content-wrapper";
      // Move current body children (except sidebar) into wrapper
      const children = Array.from(document.body.children).filter(
        (el) => el.id !== "site-sidebar"
      );
      children.forEach((c) => wrapper.appendChild(c));
      document.body.appendChild(wrapper);
    }
    // Chèn header vào wrapper (đầu)
    wrapper.insertAdjacentHTML("afterbegin", headerHTML);

    // Apply active link highlight
    highlightActiveLink();
  }

  // ====== Init behaviors after inject ======
  function initPageBehaviors() {
    // sidebar toggle
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("site-sidebar");
    const wrapper = document.querySelector(".admin-wrapper");
    if (menuToggle && sidebar && wrapper) {
      menuToggle.addEventListener("click", () => {
        // If screen small -> open overlay
        if (window.innerWidth <= 900) {
          sidebar.classList.toggle("open");
        } else {
          sidebar.classList.toggle("collapsed");
          if (sidebar.classList.contains("collapsed")) {
            wrapper.style.marginLeft = "72px";
          } else {
            wrapper.style.marginLeft = "260px";
          }
        }
      });
    }

    // Close sidebar on small screens when clicking outside
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 900) {
        const sidebarOpen = sidebar && sidebar.classList.contains("open");
        if (sidebarOpen) {
          const inside =
            e.target.closest(".sidebar") || e.target.closest(".menu-toggle");
          if (!inside) sidebar.classList.remove("open");
        }
      }
    });

    // Show admin name if exists
    const user = JSON.parse(
      localStorage.getItem("cam_logged_in_user") || "null"
    );
    if (user) {
      const label = document.createElement("div");
      label.style.fontWeight = "600";
      label.style.color = "#004b8d";
      label.style.marginLeft = "10px";
      label.textContent = `Xin chào, ${user.username}`;
      const headerLeft = document.querySelector(".header-left");
      if (headerLeft) headerLeft.appendChild(label);
    }

    // Highlight menu
    highlightActiveLink();

    // Run reports generation if on reports.html
    const path = window.location.pathname.split("/").pop();
    if (path === "reports.html") generateReports();
    if (path === "admin-dashboard.html") generateDashboardSamples();

    // Form handlers: new contract, payment, settings
    const newContractForm = document.getElementById("form-new-contract");
    if (newContractForm) {
      newContractForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = document.getElementById("contract-msg");
        msg.textContent = "Tạo hợp đồng thành công (mẫu).";
        msg.className = "message success";
        newContractForm.reset();
      });
    }

    const paymentForm = document.getElementById("form-payment");
    if (paymentForm) {
      paymentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = document.getElementById("payment-msg");
        msg.textContent = "Ghi nhận giao dịch thành công (mẫu).";
        msg.className = "message success";
        paymentForm.reset();
      });
    }

    const settingsForm = document.getElementById("form-settings");
    if (settingsForm) {
      settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = document.getElementById("settings-msg");
        msg.textContent = "Đã lưu cấu hình (mẫu).";
        msg.className = "message success";
      });
    }
  }

  // ====== highlight active nav link ======
  function highlightActiveLink() {
    const current =
      window.location.pathname.split("/").pop() || "admin-dashboard.html";
    const links = document.querySelectorAll(".nav-link");
    links.forEach((a) => {
      if (a.getAttribute("href") === current) a.classList.add("active");
      else a.classList.remove("active");
    });
    // set page title readable
    const map = {
      "admin-dashboard.html": "Bảng điều khiển",
      "customers.html": "Khách hàng",
      "contracts.html": "Hợp đồng",
      "new-contract.html": "Tạo hợp đồng mới",
      "payments.html": "Thu / Chuộc",
      "reports.html": "Báo cáo",
      "settings.html": "Cấu hình",
    };
    const el = document.getElementById("page-title");
    if (el) el.textContent = map[current] || "Trang quản trị";
  }

  // ====== Reports generation (classify due/overdue) ======
  function generateReports() {
    const today = new Date();
    const dayDiff = (d1, d2) => Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    // sample data
    const contracts = [
      {
        id: "HD1025",
        customer: "Nguyễn Văn A",
        asset: "Ô tô Vios",
        startDate: "2025-09-12",
        dueDate: "2025-10-25",
      },
      {
        id: "HD1041",
        customer: "Lê Thị Hạnh",
        asset: "Laptop Dell",
        startDate: "2025-09-15",
        dueDate: "2025-10-26",
      },
      {
        id: "HD0998",
        customer: "Trần Minh Đức",
        asset: "Xe máy SH",
        startDate: "2025-09-01",
        dueDate: "2025-10-15",
      },
      {
        id: "HD1001",
        customer: "Phạm Thu Trang",
        asset: "iPhone 15",
        startDate: "2025-09-10",
        dueDate: "2025-10-17",
      },
      {
        id: "HD1050",
        customer: "Vũ Hoàng Anh",
        asset: "Sổ đỏ Q7",
        startDate: "2025-09-20",
        dueDate: "2025-11-05",
      },
    ];

    const dueSoon = [],
      overdue = [],
      active = [];
    contracts.forEach((c) => {
      const due = new Date(c.dueDate);
      const diff = dayDiff(today, due);
      if (diff < 0) {
        c.status = "Quá hạn";
        c.delay = Math.abs(diff);
        c.badge = "danger";
        overdue.push(c);
      } else if (diff <= 7) {
        c.status = "Sắp đến hạn";
        c.delay = diff;
        c.badge = "warning";
        dueSoon.push(c);
      } else {
        c.status = "Đang hoạt động";
        c.delay = diff;
        c.badge = "normal";
        active.push(c);
      }
    });

    // fill counts
    const cards = document.querySelectorAll(".card .stat");
    if (cards && cards.length >= 3) {
      cards[0].textContent = active.length;
      cards[1].textContent = dueSoon.length;
      cards[2].textContent = overdue.length;
    } else {
      // try summary-cards .stat
      const ss = document.querySelectorAll(".summary-cards .stat");
      if (ss.length >= 3) {
        ss[0].textContent = active.length;
        ss[1].textContent = dueSoon.length;
        ss[2].textContent = overdue.length;
      }
    }

    renderTable(dueSoon, "#dueSoonTable tbody");
    renderTable(overdue, "#overdueTable tbody");

    // also update dashboard recent contracts if present
    const recentTbody = document.querySelector("#recent-contracts tbody");
    if (recentTbody) {
      recentTbody.innerHTML = "";
      const list = contracts.slice(0, 5);
      list.forEach((c) => {
        recentTbody.innerHTML += `<tr><td>${c.id}</td><td>${
          c.customer
        }</td><td>${c.asset}</td><td>${formatDate(
          c.dueDate
        )}</td><td><span class="badge ${c.badge}">${c.status}</span></td></tr>`;
      });
      // set stats on dashboard
      const elC = document.getElementById("stat-customers");
      if (elC) elC.textContent = "45";
      const elK = document.getElementById("stat-contracts");
      if (elK) elK.textContent = contracts.length;
      const elD = document.getElementById("stat-dues");
      if (elD) elD.textContent = dueSoon.length;
      const elO = document.getElementById("stat-overdue");
      if (elO) elO.textContent = overdue.length;
    }
  }

  function renderTable(list, selector) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#666">Không có dữ liệu</td></tr>`;
      return;
    }
    tbody.innerHTML = "";
    list.forEach((c) => {
      tbody.innerHTML += `<tr>
        <td>${c.id}</td>
        <td>${c.customer}</td>
        <td>${c.asset}</td>
        <td>${formatDate(c.startDate)}</td>
        <td>${formatDate(c.dueDate)}</td>
        <td>${c.delay} ngày</td>
        <td><span class="badge ${c.badge}">${c.status}</span></td>
      </tr>`;
    });
  }

  function formatDate(s) {
    const d = new Date(s);
    return d.toLocaleDateString("vi-VN");
  }

  // ====== dashboard sample filler ======
  function generateDashboardSamples() {
    // if reports already generated, generateReports sets dashboard values
    generateReports();
  }
})();
/* ========== QUẢN LÝ KHÁCH HÀNG ========== */
const customersTable = document.getElementById("customers-table");
const btnAddCustomer = document.getElementById("btn-add-customer");
const searchInput = document.getElementById("search-customer");

// Load dữ liệu khách hàng từ localStorage
if (customersTable) {
  const saved = JSON.parse(localStorage.getItem("customers") || "[]");
  const tbody = customersTable.querySelector("tbody");
  saved.forEach((row) => addCustomerRow(row, tbody));
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
  tr.classList.add("fade-in");
}

// Thêm khách hàng
btnAddCustomer?.addEventListener("click", () => {
  const name = prompt("Tên khách hàng:");
  const phone = prompt("Số điện thoại:");
  const idcard = prompt("CMND/CCCD:");
  if (!name || !phone) return alert("Vui lòng nhập đủ thông tin!");
  const id = "KH" + Date.now().toString().slice(-4);
  const data = { id, name, phone, idcard, contracts: 0, status: "Hoạt động" };
  addCustomerRow(data, customersTable.querySelector("tbody"));
  saveCustomers();
});

// Sửa hoặc xóa khách hàng
customersTable?.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete")) {
    if (confirm("Bạn có chắc muốn xóa khách hàng này?")) {
      e.target.closest("tr").remove();
      saveCustomers();
    }
  } else if (e.target.classList.contains("edit")) {
    const row = e.target.closest("tr").children;
    const name = prompt("Tên mới:", row[1].textContent);
    const phone = prompt("SĐT:", row[2].textContent);
    const idcard = prompt("CMND/CCCD:", row[3].textContent);
    if (name) row[1].textContent = name;
    if (phone) row[2].textContent = phone;
    if (idcard) row[3].textContent = idcard;
    saveCustomers();
  }
});

function saveCustomers() {
  const rows = [...customersTable.querySelectorAll("tbody tr")];
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

// Tìm kiếm khách hàng
searchInput?.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll("#customers-table tbody tr").forEach((tr) => {
    const match = tr.textContent.toLowerCase().includes(term);
    tr.style.display = match ? "" : "none";
  });
});
/* ========== QUẢN LÝ HỢP ĐỒNG ========== */
const contractsTable = document.getElementById("contracts-table");
if (contractsTable) {
  const saved = JSON.parse(localStorage.getItem("contracts") || "[]");
  const tbody = contractsTable.querySelector("tbody");
  saved.forEach((row) => addContractRow(row, tbody));
}

function addContractRow(data, tbody) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${data.id}</td>
    <td>${data.customer}</td>
    <td>${data.asset}</td>
    <td>${data.start}</td>
    <td>${data.due}</td>
    <td>${data.value}</td>
    <td><span class="badge ${data.statusClass}">${data.status}</span></td>
    <td>
      <button class="btn small edit">Sửa</button>
      <button class="btn small delete">Xóa</button>
    </td>`;
  tbody.appendChild(tr);
  tr.classList.add("fade-in");
}

contractsTable?.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete")) {
    if (confirm("Xóa hợp đồng này?")) {
      e.target.closest("tr").remove();
      saveContracts();
    }
  } else if (e.target.classList.contains("edit")) {
    const row = e.target.closest("tr").children;
    const value = prompt("Cập nhật giá trị:", row[5].textContent);
    if (value) row[5].textContent = value;
    saveContracts();
  }
});

function saveContracts() {
  const rows = [...contractsTable.querySelectorAll("tbody tr")];
  const data = rows.map((r) => ({
    id: r.children[0].textContent,
    customer: r.children[1].textContent,
    asset: r.children[2].textContent,
    start: r.children[3].textContent,
    due: r.children[4].textContent,
    value: r.children[5].textContent,
    status: r.children[6].textContent,
  }));
  localStorage.setItem("contracts", JSON.stringify(data));
}
/* ========== GIAO DỊCH ========== */
const paymentForm = document.getElementById("form-payment");
if (paymentForm) {
  const msg = document.getElementById("payment-msg");
  paymentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(paymentForm));
    const list = JSON.parse(localStorage.getItem("payments") || "[]");
    const id = "GD" + Date.now().toString().slice(-4);
    list.push({
      id,
      ...formData,
      date: new Date().toLocaleDateString("vi-VN"),
    });
    localStorage.setItem("payments", JSON.stringify(list));
    msg.textContent = "💾 Đã ghi nhận giao dịch " + id;
    msg.style.color = "#0077b6";
    paymentForm.reset();
  });
}
/* ========== CẤU HÌNH ========== */
const settingsForm = document.getElementById("form-settings");
if (settingsForm) {
  const msg = document.getElementById("settings-msg");
  const saved = JSON.parse(localStorage.getItem("settings") || "{}");
  for (let k in saved) if (settingsForm[k]) settingsForm[k].value = saved[k];
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(settingsForm));
    localStorage.setItem("settings", JSON.stringify(formData));
    msg.textContent = "✅ Đã lưu cấu hình hệ thống!";
    msg.style.color = "#0077b6";
  });
}
