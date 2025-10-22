/* app-core.js
   Core utilities for Cầm Không Hối Hận demo
   - localStorage wrapper & seed data
   - toast notifications and confirm dialog (simple, bottom-right)
   - helpers: formatCurrency, uid, todayISO
   Exported API attached to window.CNR
*/
(function () {
  'use strict';

  const DB = {
    contracts: 'cnr_contracts_v1',
    transactions: 'cnr_transactions_v1',
    customers: 'cnr_customers_v1',
    assets: 'cnr_assets_v1',
    settings: 'cnr_settings_v1'
  };

  /* -------------------- Utilities -------------------- */
  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('read err', e);
      return null;
    }
  }
  function write(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  }
  function uid(prefix = '') {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  }
  function todayISO() {
    return new Date().toISOString().slice(0,10);
  }
  function formatCurrency(n) {
    if (n === null || n === undefined) return '';
    if (typeof n === 'string' && n.trim()==='') return '';
    if (isNaN(Number(n))) return n;
    return new Intl.NumberFormat('vi-VN').format(Number(n)) + '₫';
  }

  /* -------------------- Toast (bottom-right, simple style like admin) -------------------- */
  function showToast(msg, timeout = 3000) {
    const wrapperId = 'cnr-toast-wrapper';
    let wrapper = document.getElementById(wrapperId);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = wrapperId;
      Object.assign(wrapper.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end'
      });
      document.body.appendChild(wrapper);
    }
    const el = document.createElement('div');
    el.className = 'cnr-toast';
    el.textContent = msg;
    Object.assign(el.style, {
      background: '#0b3040', color: '#fff', padding: '10px 14px',
      borderRadius: '8px', boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
      maxWidth: '320px', fontSize: '14px', opacity: '1', transition: 'opacity 0.3s ease'
    });
    wrapper.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, timeout - 300);
    setTimeout(() => { try { el.remove(); } catch(e){} }, timeout);
  }

  /* -------------------- Confirm dialog (simple) -------------------- */
  function confirmDialog(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed', left:0, top:0, width:'100%', height:'100%',
        background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:12000
      });
      const box = document.createElement('div');
      Object.assign(box.style, {
        background:'#fff', padding:'18px', borderRadius:'10px', minWidth:'320px',
        boxShadow:'0 10px 30px rgba(0,0,0,0.2)', textAlign:'left'
      });
      const p = document.createElement('p'); p.textContent = message; p.style.margin='0 0 12px';
      const actions = document.createElement('div'); actions.style.textAlign='right';
      const yes = document.createElement('button'); yes.textContent = 'Xác nhận'; yes.className='btn';
      const no = document.createElement('button'); no.textContent = 'Hủy'; Object.assign(no.style, {marginLeft:'8px', padding:'8px 12px', borderRadius:'8px'});
      actions.appendChild(yes); actions.appendChild(no);
      box.appendChild(p); box.appendChild(actions); overlay.appendChild(box); document.body.appendChild(overlay);
      yes.onclick = () => { overlay.remove(); resolve(true); };
      no.onclick = () => { overlay.remove(); resolve(false); };
    });
  }

  /* -------------------- Seed demo data -------------------- */
  function seedIfEmpty() {
    if (!read(DB.settings)) {
      write(DB.settings, { shop_name: 'Hiệu cầm đồ Cầm Không Hối Hận', phone: '0949301535', default_rate: 1.8, address: '535 Đường Lạc Long Quân, Hà Nội' });
    }
    if (!read(DB.assets)) {
      const assets = [
        { id:'asset-oto', name:'Ô tô', desc:'Xe cá nhân, xe công ty, xe tải nhỏ', rate:1.8 },
        { id:'asset-xemay', name:'Xe máy', desc:'Xe tay ga, xe số chính chủ', rate:2.5 },
        { id:'asset-sodo', name:'Sổ đỏ', desc:'Giấy chứng nhận quyền sử dụng đất', rate:1.5 },
        { id:'asset-laptop', name:'Laptop', desc:'Laptop còn tốt, phụ kiện đầy đủ', rate:3.0 },
        { id:'asset-phone', name:'Điện thoại', desc:'Smartphone', rate:3.0 },
        { id:'asset-khac', name:'Các tài sản khác', desc:'Trang sức, đồng hồ, đồ điện tử', rate:2.2 }
      ];
      write(DB.assets, assets);
    }
    if (!read(DB.customers)) {
      write(DB.customers, {
        'cust-1': { id:'cust-1', name:'Nguyễn Văn A', cmnd:'012345678', phone:'0909123456', address:'Đường ABC, Quận D', avatar:'avatar1.jpg' },
        'cust-2': { id:'cust-2', name:'Trần Thị B', cmnd:'987654321', phone:'0912345678', address:'Đường XYZ, Quận F', avatar:'avatar2.jpg' }
      });
    }
    if (!read(DB.contracts)) {
      const contracts = {
        'CT-0001': { id:'CT-0001', customerId:'cust-1', principal:2000000, rate:1.8, start:'2025-07-20', due:'2025-10-20', status:'active', assetType:'Ô tô', note:'' },
        'CT-0002': { id:'CT-0002', customerId:'cust-2', principal:1000000, rate:1.8, start:'2025-06-01', due:'2025-09-01', status:'overdue', assetType:'Xe máy', note:'' }
      };
      write(DB.contracts, contracts);
    }
    if (!read(DB.transactions)) write(DB.transactions, []);
  }

  seedIfEmpty();

  /* -------------------- Expose API -------------------- */
  window.CNR = {
    DB,
    read,
    write,
    uid,
    todayISO,
    formatCurrency,
    showToast,
    confirmDialog,
    seedIfEmpty
  };
})();