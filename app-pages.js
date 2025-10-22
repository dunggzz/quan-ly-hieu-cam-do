/* app-pages.js
   Page-specific logic that runs only on pages that need JS.
   It auto-detects the current page via location.pathname or document.title.
   Depends on app-core.js (window.CNR).
*/
(function () {
  "use strict";
  if (!window.CNR) {
    console.error(
      "app-core.js not loaded. Please include app-core.js before app-pages.js"
    );
    return;
  }
  const {
    DB,
    read,
    write,
    uid,
    todayISO,
    formatCurrency,
    showToast,
    confirmDialog,
  } = window.CNR;

  /* helper to get filename */
  function currentFile() {
    const p = location.pathname.split("/").pop();
    return p || "index.html";
  }

  /* ---------- Assets page (assets.html) ---------- */
  function initAssetsPage() {
    const file = currentFile();
    if (file !== "assets.html") return;
    const table = document.querySelector(".table");
    const tbody = table && table.querySelector("tbody");
    const render = () => {
      const assets = read(DB.assets) || [];
      tbody.innerHTML = "";
      assets.forEach((a, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td class="asset-name">${escapeHtml(a.name)}</td>
          <td>${escapeHtml(a.desc)}</td>
          <td class="asset-rate">${a.rate}%</td>
          <td>
            <button class="btn btn-edit" data-id="${a.id}">Sửa</button>
            <button class="btn btn-delete" data-id="${
              a.id
            }" style="background:#c0392b">Xóa</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    };

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    render();

    tbody.addEventListener("click", async (e) => {
      if (e.target.matches(".btn-edit")) {
        const id = e.target.dataset.id;
        const assets = read(DB.assets) || [];
        const item = assets.find((x) => x.id === id);
        if (!item) {
          showToast("Không tìm thấy loại tài sản");
          return;
        }
        const newRate = prompt(
          `Chỉnh lãi suất cho "${item.name}" (%/tháng)`,
          item.rate
        );
        if (newRate === null) return;
        const n = parseFloat(newRate);
        if (isNaN(n) || n < 0) {
          showToast("Giá trị không hợp lệ");
          return;
        }
        item.rate = n;
        write(DB.assets, assets);
        render();
        showToast("Cập nhật lãi suất thành công");
      } else if (e.target.matches(".btn-delete")) {
        const id = e.target.dataset.id;
        const ok = await confirmDialog(
          "Bạn có chắc muốn xóa loại tài sản này?"
        );
        if (!ok) return;
        let assets = (read(DB.assets) || []).filter((x) => x.id !== id);
        write(DB.assets, assets);
        render();
        showToast("Đã xóa");
      }
    });
  }

  /* ---------- Customer page (customer.html) ---------- */
  function initCustomerPage() {
    const file = currentFile();
    if (file !== "customer.html") return;
    // The HTML has modal with id="modal" and function showDetail used in original file.
    // We augment by wiring dynamic rows (if present) and keyboard close.
    const modal = document.getElementById("modal");
    if (!modal) return;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") modal.style.display = "none";
    });
    // Add deletion helper for customers if delete buttons exist
    document.querySelectorAll(".btn-delete-customer").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        const id = ev.currentTarget.dataset.id;
        const ok = await confirmDialog(
          "Xóa khách hàng sẽ xóa mọi hợp đồng liên quan. Tiếp tục?"
        );
        if (!ok) return;
        const cs = read(DB.customers) || {};
        delete cs[id];
        write(DB.customers, cs);
        showToast("Đã xóa khách hàng (demo)");
        // try remove row
        const row = document.querySelector(`[data-customer-row="${id}"]`);
        if (row) row.remove();
      });
    });
  }

  /* ---------- New contract page (new-contract.html) ---------- */
  function initNewContractForm() {
    const file = currentFile();
    if (file !== "new-contract.html") return;
    const form = document.querySelector("form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get("name") || "").trim();
      const cmnd = (data.get("id_number") || "").trim();
      const phone = (data.get("phone") || "").trim();
      const item_desc = (data.get("item_desc") || "").trim();
      const principal = Number(data.get("principal") || 0);
      const rate = Number(
        data.get("rate") || read(DB.settings).default_rate || 1.8
      );
      const termDays = Number(data.get("term_days") || 30);
      if (!name || !cmnd || !principal) {
        showToast("Vui lòng điền đầy đủ trường bắt buộc");
        return;
      }
      const customers = read(DB.customers) || {};
      let customerId = Object.keys(customers).find(
        (k) => customers[k].cmnd === cmnd
      );
      if (!customerId) {
        customerId = uid("cust-");
        customers[customerId] = {
          id: customerId,
          name,
          cmnd,
          phone,
          address: "",
        };
        write(DB.customers, customers);
      }
      const id = `CT-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const start = todayISO();
      const dueDate = new Date(Date.now() + termDays * 24 * 3600 * 1000);
      const due = dueDate.toISOString().slice(0, 10);
      const contracts = read(DB.contracts) || {};
      contracts[id] = {
        id,
        customerId,
        principal,
        rate,
        start,
        due,
        status: "active",
        assetType: item_desc || "N/A",
        note: "",
      };
      write(DB.contracts, contracts);
      showToast(`Hợp đồng ${id} đã lưu (local demo)`);
      form.reset();
    });
  }

  /* ---------- Contracts page (contracts.html) ---------- */
  function initContractsPage() {
    const file = currentFile();
    if (file !== "contracts.html") return;
    const table = document.querySelector(".table");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    const render = () => {
      const contracts = read(DB.contracts) || {};
      tbody.innerHTML = "";
      Object.values(contracts).forEach((c) => {
        const cust = (read(DB.customers) || {})[c.customerId] || {
          name: "Khách lạ",
        };
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(c.id)}</td>
          <td>${escapeHtml(cust.name || "N/A")}</td>
          <td>${formatCurrency(c.principal)}</td>
          <td>${c.start}</td>
          <td>${c.due}</td>
          <td>${
            c.status === "overdue"
              ? '<span style="color:#c0392b;font-weight:700">Quá hạn</span>'
              : escapeHtml(c.status)
          }</td>
          <td>
            <a href="#" data-id="${escapeHtml(c.id)}" class="btn-view">Mở</a>
            <button class="btn btn-delete-contract" data-id="${escapeHtml(
              c.id
            )}" style="background:#c0392b">Xóa</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    };
    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }
    render();
    tbody.addEventListener("click", async (e) => {
      if (e.target.matches(".btn-delete-contract")) {
        const id = e.target.dataset.id;
        const ok = await confirmDialog(`Xóa hợp đồng ${id}?`);
        if (!ok) return;
        const contracts = read(DB.contracts) || {};
        delete contracts[id];
        write(DB.contracts, contracts);
        render();
        showToast("Đã xóa HĐ (local demo)");
      } else if (e.target.matches(".btn-view")) {
        e.preventDefault();
        const id = e.target.dataset.id;
        const contracts = read(DB.contracts) || {};
        const c = contracts[id];
        const cust = (read(DB.customers) || {})[c.customerId] || {};
        const modal = document.createElement("div");
        Object.assign(modal.style, {
          position: "fixed",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 12000,
        });
        const cont = document.createElement("div");
        cont.className = "modal-content";
        cont.innerHTML = `
          <span class="close" style="cursor:pointer">&times;</span>
          <div>
            <h3>Hợp đồng ${escapeHtml(c.id)}</h3>
            <p><strong>Khách:</strong> ${escapeHtml(cust.name || "N/A")}</p>
            <p><strong>Giá trị:</strong> ${formatCurrency(c.principal)}</p>
            <p><strong>Ngày vay:</strong> ${c.start}</p>
            <p><strong>Đáo hạn:</strong> ${c.due}</p>
            <p><strong>Trạng thái:</strong> ${escapeHtml(c.status)}</p>
            <p><strong>Ghi chú:</strong> ${escapeHtml(c.note || "")}</p>
          </div>
        `;
        modal.appendChild(cont);
        document.body.appendChild(modal);
        cont.querySelector(".close").onclick = () => modal.remove();
      }
    });
  }

  /* ---------- Lookup page (lookup.html) ---------- */
  function initLookupPage() {
    const file = currentFile();
    if (file !== "lookup.html") return;
    const form = document.querySelector("form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = (form.querySelector('input[name="q"]').value || "").trim();
      if (!q) return;

      // Gộp dữ liệu từ cả hai hệ thống
      const cnrContracts = read(DB.contracts) || {};
      const cnrCustomers = read(DB.customers) || {};
      const adminContracts = Object.fromEntries(
        JSON.parse(localStorage.getItem("contracts") || "[]").map((c) => [
          c.id,
          c,
        ])
      );
      const adminCustomers = Object.fromEntries(
        JSON.parse(localStorage.getItem("customers") || "[]").map((c) => [
          c.id,
          c,
        ])
      );

      const allContracts = { ...cnrContracts, ...adminContracts };
      const allCustomers = { ...cnrCustomers, ...adminCustomers };

      const results = Object.values(allContracts).filter((c) => {
        if (c.id?.toLowerCase() === q.toLowerCase()) return true;
        const cust = allCustomers[c.customerId] || {};
        if (
          (cust.phone || "").replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))
        )
          return true;
        if ((r.phone || "").replace(/\s+/g, "").includes(q.replace(/\s+/g, "")))
          return true;

        if ((cust.name || "").toLowerCase().includes(q.toLowerCase()))
          return true;
        return false;
      });

      const existing = document.getElementById("cnr-lookup-results");
      if (existing) existing.remove();
      const out = document.createElement("div");
      out.id = "cnr-lookup-results";
      out.style.marginTop = "12px";

      if (results.length) {
        out.innerHTML =
          `<h3>Kết quả tra cứu</h3>` +
          results
            .map((r) => {
              const cust = allCustomers[r.customerId] || {
                name: r.customer || "Không rõ",
              };
              const val = r.principal
                ? r.principal.toLocaleString("vi-VN") + " ₫"
                : r.value || "—";
              return `
          <div class="form" style="margin-bottom:10px; padding:12px">
            <p><strong>Mã HĐ:</strong> ${r.id}</p>
            <p><strong>Khách hàng:</strong> ${cust.name}</p>
            <p><strong>Giá trị:</strong> ${val}</p>
            <p><strong>Ngày đáo hạn:</strong> ${r.due || "N/A"}</p>
            <p><strong>Trạng thái:</strong> ${r.status || "Đang xử lý"}</p>
          </div>`;
            })
            .join("");
      } else {
        out.innerHTML = `<div class="form"><p>❌ Không tìm thấy hợp đồng hoặc khách hàng phù hợp với <strong>${q}</strong></p></div>`;
      }

      form.parentElement.appendChild(out);
    });
  }

  /* ---------- Payments page (payments.html) ---------- */
  function initPaymentsPage() {
    const file = currentFile();
    if (file !== "payments.html") return;
    const form = document.querySelector("form");
    if (!form) return;
    const recentContainer = document.querySelector("table.table tbody");
    function renderRecent() {
      const txs = read(DB.transactions) || [];
      if (!recentContainer) return;
      recentContainer.innerHTML = "";
      txs
        .slice()
        .reverse()
        .slice(0, 10)
        .forEach((t, idx) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${idx + 1}</td><td>${escapeHtml(
            t.contractId
          )}</td><td>${escapeHtml(t.type)}</td><td>${formatCurrency(
            t.amount
          )}</td><td>${escapeHtml(t.date)}</td>`;
          recentContainer.appendChild(tr);
        });
    }
    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }
    renderRecent();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const contractId = (data.get("contract_id") || "").trim();
      const type = data.get("type");
      const amount = Number(data.get("amount") || 0);
      const note = data.get("note") || "";
      if (!contractId || !amount) {
        showToast("Nhập Mã HĐ và số tiền");
        return;
      }
      const txs = read(DB.transactions) || [];
      const tx = {
        id: uid("tx-"),
        contractId,
        type,
        amount,
        note,
        date: todayISO(),
      };
      txs.push(tx);
      write(DB.transactions, txs);
      showToast("Ghi nhận giao dịch thành công");
      renderRecent();
      form.reset();
    });
  }

  /* ---------- Register page (register.html) ---------- */
  /* ---------- Register page (register.html) ---------- */
  function initRegisterPage() {
    const file = location.pathname.split("/").pop().toLowerCase();
    if (file !== "register.html") return;

    const form = document.querySelector("form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get("fullname") || "").trim();
      const cmnd = (data.get("id_number") || "").trim();
      const phone = (data.get("phone") || "").trim();
      const item_type = data.get("item_type");
      const item_desc = (data.get("item_desc") || "").trim();
      const principal = Number(data.get("principal") || 0);

      if (!name || !cmnd || !phone || !item_type || !principal) {
        CNR.showToast("❗ Vui lòng điền đầy đủ thông tin!");
        return;
      }

      /* --- Lưu khách hàng vào CNR (public) --- */
      const customers = CNR.read(CNR.DB.customers) || {};
      let customerId = Object.keys(customers).find(
        (k) => customers[k].cmnd === cmnd || customers[k].phone === phone
      );
      if (!customerId) {
        customerId = CNR.uid("cust-");
        customers[customerId] = {
          id: customerId,
          name,
          cmnd,
          phone,
          contracts: [],
        };
      }

      /* --- Tạo hợp đồng mới --- */
      const id = `CT-${Math.floor(1000 + Math.random() * 9000)}`;
      const start = CNR.todayISO();
      const due = new Date(Date.now() + 30 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

      const newContract = {
        id,
        customerId,
        principal,
        rate: 1.8,
        start,
        due,
        status: "Chờ xác nhận",
        assetType: item_type,
        note: item_desc,
        phone,
        customer: name,
      };

      const contracts = CNR.read(CNR.DB.contracts) || {};
      contracts[id] = newContract;
      CNR.write(CNR.DB.contracts, contracts);
      customers[customerId].contracts.push(id);
      CNR.write(CNR.DB.customers, customers);

      /* --- Lưu đồng bộ vào hệ thống admin --- */
      const adminCustomers = JSON.parse(
        localStorage.getItem("customers") || "[]"
      );
      const adminContracts = JSON.parse(
        localStorage.getItem("contracts") || "[]"
      );

      let adminCustomer = adminCustomers.find(
        (c) => c.idcard === cmnd || c.phone === phone
      );
      if (!adminCustomer) {
        adminCustomer = {
          id: "KH" + Date.now().toString().slice(-4),
          name,
          phone,
          idcard: cmnd,
          contracts: 1,
          status: "Chờ xác nhận",
        };
        adminCustomers.push(adminCustomer);
      } else {
        adminCustomer.contracts = Number(adminCustomer.contracts || 0) + 1;
      }

      adminContracts.push({
        id,
        customer: name,
        phone,
        asset: item_type,
        start,
        due,
        value: principal.toLocaleString("vi-VN") + " ₫",
        status: "Chờ xác nhận",
        statusClass: "warning",
      });

      localStorage.setItem("customers", JSON.stringify(adminCustomers));
      localStorage.setItem("contracts", JSON.stringify(adminContracts));

      CNR.showToast(`✅ Hợp đồng ${id} đã được tạo & đồng bộ thành công!`);
      form.reset();
    });
  }

  /* ---------- Reports page (reports.html) ---------- */
  function initReportsPage() {
    const file = currentFile();
    if (file !== "reports.html") return;
    const form = document.querySelector("form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const from =
        form.querySelector('input[name="from"]').value || "1970-01-01";
      const to = form.querySelector('input[name="to"]').value || todayISO();
      const contracts = Object.values(read(DB.contracts) || {});
      const txs = read(DB.transactions) || [];
      const filteredContracts = contracts.filter(
        (c) => c.start >= from && c.start <= to
      );
      const totalContracts = filteredContracts.length;
      const totalInterest = txs
        .filter((t) => t.type === "interest" && t.date >= from && t.date <= to)
        .reduce((s, x) => s + x.amount, 0);
      const tbody = document.querySelector(".table tbody");
      if (tbody) {
        tbody.innerHTML = `
          <tr><td>Tổng hợp đồng (giai đoạn)</td><td>${totalContracts}</td></tr>
          <tr><td>Tổng thu lãi</td><td>${formatCurrency(
            totalInterest
          )}</td></tr>
          <tr><td>Quá hạn</td><td>${
            contracts.filter((c) => new Date(c.due) < new Date()).length
          }</td></tr>
        `;
      }
    });
    // export CSV button
    const exportBtn = document.createElement("button");
    exportBtn.className = "btn";
    exportBtn.textContent = "Xuất CSV tất cả HĐ";
    exportBtn.style.marginTop = "12px";
    const parent = document.querySelector("form").parentElement;
    parent.appendChild(exportBtn);
    exportBtn.addEventListener("click", () => {
      const contracts = Object.values(read(DB.contracts) || {});
      const rows = [
        [
          "id",
          "customerId",
          "principal",
          "rate",
          "start",
          "due",
          "status",
          "assetType",
          "note",
        ],
      ];
      contracts.forEach((c) =>
        rows.push([
          c.id,
          c.customerId,
          c.principal,
          c.rate,
          c.start,
          c.due,
          c.status,
          c.assetType,
          (c.note || "").replace(/\n/g, " "),
        ])
      );
      const csv = rows
        .map((r) =>
          r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contracts_${todayISO()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Đã tải CSV (local)");
    });
  }

  /* ---------- Settings page (setting.html) ---------- */
  function initSettingsPage() {
    const file = currentFile();
    if (file !== "setting.html" && file !== "settings.html") return;
    const form = document.querySelector("form");
    if (!form) return;
    const s = read(DB.settings) || {};
    form.querySelector('input[name="shop_name"]').value = s.shop_name || "";
    if (form.querySelector('input[name="address"]'))
      form.querySelector('input[name="address"]').value = s.address || "";
    if (form.querySelector('input[name="phone"]'))
      form.querySelector('input[name="phone"]').value = s.phone || "";
    if (form.querySelector('input[name="default_rate"]'))
      form.querySelector('input[name="default_rate"]').value =
        s.default_rate || "";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const newS = {
        shop_name: data.get("shop_name"),
        address: data.get("address"),
        phone: data.get("phone"),
        default_rate: Number(data.get("default_rate") || 1.8),
      };
      write(DB.settings, newS);
      showToast("Lưu cấu hình thành công");
    });
  }

  /* ---------- Lazy images + accessibility small fixes ---------- */
  function initLazyImages() {
    document.querySelectorAll("img").forEach((img) => {
      if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.alt || img.alt.trim() === "")
        img.alt = img.getAttribute("data-alt") || "Hình ảnh";
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    try {
      initLazyImages();
      initAssetsPage();
      initCustomerPage();
      initNewContractForm();
      initContractsPage();
      initLookupPage();
      initPaymentsPage();
      initRegisterPage();
      initReportsPage();
      initSettingsPage();
    } catch (err) {
      console.error("app-pages init error", err);
    }
  });
})();
/* ---------- Lookup page (lookup.html) ---------- */
(() => {
  const page = location.pathname.split("/").pop().toLowerCase();
  if (page !== "lookup.html") return;

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form[action='#']");
    const input = form?.querySelector("input[name='q']");
    const section = document.querySelector("main section");

    if (!form || !input || !section) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const keyword = (input.value || "").trim().toLowerCase();
      if (!keyword) {
        if (window.CNR && CNR.showToast)
          CNR.showToast("❗ Vui lòng nhập mã hợp đồng hoặc SĐT.");
        else alert("❗ Vui lòng nhập mã hợp đồng hoặc SĐT.");
        return;
      }

      // ---- Lấy dữ liệu từ cả 2 nguồn ----
      const cnrContracts = window.CNR?.read?.(CNR.DB.contracts) || {};
      const adminContracts = JSON.parse(
        localStorage.getItem("contracts") || "[]"
      );
      const all = [...Object.values(cnrContracts), ...adminContracts];

      const found = all.find((r) => {
        const id = (r.id || "").toLowerCase();
        const phone = (r.phone || "").replace(/\s+/g, "");
        return id === keyword || phone.includes(keyword.replace(/\s+/g, ""));
      });

      if (!found) {
        section.innerHTML = `
          <h3>Kết quả tra cứu</h3>
          <div style="background:#fff;padding:12px;border-radius:10px;box-shadow:0 6px 18px rgba(10,30,40,0.04);">
            <p>❌ Không tìm thấy hợp đồng nào cho "<strong>${keyword}</strong>".</p>
          </div>`;
        return;
      }

      const value =
        found.value ||
        (found.principal
          ? found.principal.toLocaleString("vi-VN") + " ₫"
          : "—");

      section.innerHTML = `
        <h3>Kết quả tra cứu</h3>
        <div style="background:#fff;padding:12px;border-radius:10px;box-shadow:0 6px 18px rgba(10,30,40,0.04);">
          <p><strong>Mã HĐ:</strong> ${found.id}</p>
          <p><strong>Khách hàng:</strong> ${found.customer || "(Không rõ)"}</p>
          <p><strong>Số điện thoại:</strong> ${found.phone || "(Không có)"}</p>
          <p><strong>Tài sản:</strong> ${
            found.assetType || found.asset || "—"
          }</p>
          <p><strong>Giá trị:</strong> ${value}</p>
          <p><strong>Ngày cầm:</strong> ${found.start || "—"}</p>
          <p><strong>Ngày đến hạn:</strong> ${found.due || "—"}</p>
          <p><strong>Trạng thái:</strong> ${found.status || "Đang xử lý"}</p>
        </div>`;
    });
  });
})();
