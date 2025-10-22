/* public-contact.js
 * Thu thập & lưu thông tin KH từ các form `.contact-form` (mọi trang dịch vụ + contact)
 * Lưu vào localStorage key: 'CUSTOMER_LEADS' (mảng các object)
 * Có thể tuỳ biến để gửi API sau này (fetch) — hiện tại demo ở local.
 */
(function () {
  const KEY = "CUSTOMER_LEADS";

  function readLeads() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]") || [];
    } catch (_) {
      return [];
    }
  }
  function saveLeads(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  // Suy ra loại dịch vụ theo trang (fallback khi form không có <select>)
  function inferService() {
    const path = (location.pathname || "").toLowerCase();
    if (path.includes("camoto")) return "oto";
    if (path.includes("camxemay")) return "xemay";
    if (path.includes("camsodo")) return "sodo";
    if (path.includes("laptop") || path.includes("camlaptop")) return "laptop";
    if (path.includes("dienthoai") || path.includes("camdienthoai")) return "dienthoai";
    return "khac";
  }

  function getValueByNameOrPlaceholder(form, name, fallbacks) {
    // Ưu tiên theo [name], sau đó theo placeholder chứa từ khoá
    let el = form.querySelector(`[name="${name}"]`);
    if (el) return el.value.trim();

    const inputs = Array.from(form.querySelectorAll("input, textarea, select"));
    for (const node of inputs) {
      const ph = (node.getAttribute("placeholder") || "").toLowerCase();
      for (const fb of fallbacks) {
        if (ph.includes(fb)) return (node.value || "").trim();
      }
    }
    return "";
  }

  function getServiceValue(form) {
    const sel = form.querySelector("select");
    if (sel && sel.value) return sel.value;
    // Fallback theo trang
    return inferService();
  }

  function toast(msg) {
    try {
      // Nhẹ nhàng không dùng CSS ngoài — tạo toast nhỏ rồi tự ẩn
      const t = document.createElement("div");
      t.textContent = msg;
      Object.assign(t.style, {
        position: "fixed",
        left: "50%",
        top: "20px",
        transform: "translateX(-50%)",
        background: "#111",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: "10px",
        boxShadow: "0 6px 18px rgba(0,0,0,.2)",
        zIndex: 99999,
        fontSize: "14px",
      });
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2200);
    } catch (_) {}
  }

  function attachHandlers() {
    const forms = document.querySelectorAll(".contact-form");
    if (!forms.length) return;

    forms.forEach((form) => {
      // Tránh gắn nhiều lần
      if (form.dataset.bound === "1") return;
      form.dataset.bound = "1";

      form.addEventListener("submit", (e) => {
        e.preventDefault();

        // Lấy dữ liệu linh hoạt (hỗ trợ cả form có/không có name attributes)
        const name = getValueByNameOrPlaceholder(form, "name", ["họ", "ten", "tên", "ho va ten", "họ và tên"]);
        const email = getValueByNameOrPlaceholder(form, "email", ["email"]);
        const phone = getValueByNameOrPlaceholder(form, "phone", ["điện thoại", "so dien thoai", "số điện thoại"]);
        const message = getValueByNameOrPlaceholder(form, "message", ["tin nhắn", "mo ta", "mô tả", "ghi chú", "message"]);

        // Xử lý dịch vụ
        const service = getServiceValue(form);

        // Tối thiểu: tên + phone
        if (!name || !phone) {
          toast("Vui lòng nhập Họ tên và Số điện thoại.");
          return;
        }

        const lead = {
          id: "LEAD-" + Date.now(),
          name,
          email,
          phone,
          service,
          message,
          page: location.pathname,
          createdAt: new Date().toISOString(),
        };

        const list = readLeads();
        list.unshift(lead);
        saveLeads(list);

        // Dọn form & báo OK
        try { form.reset(); } catch (_) {}
        toast("Đã gửi thông tin! Chúng tôi sẽ liên hệ sớm.");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachHandlers);
  } else {
    attachHandlers();
  }
})();
