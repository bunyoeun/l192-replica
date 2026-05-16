// admin.js — L198 Admin Panel: auth guard + all admin DB functions

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) { window.location.href = '../login.html'; return null; }
  const { data: profile, error } = await db
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single();
  if (error || !profile || profile.role !== 'admin') {
    window.location.href = '../index.html';
    return null;
  }
  document.querySelectorAll('.admin-name').forEach(el => el.textContent = profile.full_name || user.email);
  const avatarEls = document.querySelectorAll('.admin-avatar');
  if (profile.avatar_url) avatarEls.forEach(el => { el.src = profile.avatar_url; el.style.display = 'block'; });
  return { user, profile };
}

// ── Dashboard ─────────────────────────────────────────────────
async function adminGetStats() {
  const [ordersRes, productsRes, usersRes, revenueRes, recentRes] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }),
    db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('orders').select('total_amount').eq('status', 'delivered'),
    db.from('orders')
      .select('id, total_amount, status, created_at, user:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(10)
  ]);
  const revenue = (revenueRes.data || []).reduce((s, o) => s + (o.total_amount || 0), 0);
  return {
    orderCount: ordersRes.count || 0,
    productCount: productsRes.count || 0,
    userCount: usersRes.count || 0,
    revenue,
    recentOrders: recentRes.data || []
  };
}

// ── Products ──────────────────────────────────────────────────
async function adminGetAllProducts(opts = {}) {
  let q = db.from('products')
    .select('id, name, slug, price, compare_at_price, stock_quantity, status, created_at, store:stores(name), category:categories(name)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (opts.search) q = q.ilike('name', '%' + opts.search + '%');
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.categoryId) q = q.eq('category_id', opts.categoryId);
  const limit = opts.limit || 20;
  const offset = opts.offset || 0;
  q = q.range(offset, offset + limit - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

async function adminCreateProduct(data) {
  const { data: result, error } = await db.from('products').insert(data).select().single();
  if (error) throw error;
  return result;
}

async function adminUpdateProduct(id, updates) {
  const { data, error } = await db.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function adminDeactivateProduct(id) {
  return adminUpdateProduct(id, { status: 'inactive' });
}

async function adminGetCategoriesAndStores() {
  const [cats, stores] = await Promise.all([
    db.from('categories').select('id, name').order('name'),
    db.from('stores').select('id, name').order('name')
  ]);
  return { categories: cats.data || [], stores: stores.data || [] };
}

// ── Orders ────────────────────────────────────────────────────
async function adminGetAllOrders(opts = {}) {
  let q = db.from('orders')
    .select('id, status, total_amount, created_at, user:profiles(full_name), items:order_items(id)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  const limit = opts.limit || 25;
  const offset = opts.offset || 0;
  q = q.range(offset, offset + limit - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

async function adminGetOrderItems(orderId) {
  const { data, error } = await db.from('order_items')
    .select('id, quantity, unit_price, product_name')
    .eq('order_id', orderId);
  if (error) throw error;
  return data || [];
}

async function adminUpdateOrderStatus(orderId, status) {
  const { data, error } = await db.from('orders').update({ status }).eq('id', orderId).select().single();
  if (error) throw error;
  return data;
}

// ── Users & Stores ────────────────────────────────────────────
async function adminGetAllUsers(opts = {}) {
  let q = db.from('profiles')
    .select('id, full_name, phone, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (opts.search) q = q.ilike('full_name', '%' + opts.search + '%');
  const limit = opts.limit || 25;
  const offset = opts.offset || 0;
  q = q.range(offset, offset + limit - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

async function adminUpdateUserRole(userId, role) {
  const { data, error } = await db.from('profiles').update({ role }).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

async function adminGetAllStores(opts = {}) {
  let q = db.from('stores')
    .select('id, name, slug, description, is_active, created_at, owner:profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (opts.search) q = q.ilike('name', '%' + opts.search + '%');
  const limit = opts.limit || 25;
  const offset = opts.offset || 0;
  q = q.range(offset, offset + limit - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

async function adminToggleStore(storeId, isActive) {
  const { data, error } = await db.from('stores').update({ is_active: isActive }).eq('id', storeId).select().single();
  if (error) throw error;
  return data;
}

// ── Shared UI helpers ─────────────────────────────────────────
function fmt(n) { return '$' + parseFloat(n || 0).toFixed(2); }

function statusBadge(status) {
  const map = {
    pending:   { bg: '#fff8e1', color: '#d97706', label: 'Pending' },
    confirmed: { bg: '#e0f2fe', color: '#0369a1', label: 'Confirmed' },
    shipped:   { bg: '#ede7f6', color: '#7c3aed', label: 'Shipped' },
    delivered: { bg: '#f0fdf4', color: '#16a34a', label: 'Delivered' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
    active:    { bg: '#f0fdf4', color: '#16a34a', label: 'Active' },
    inactive:  { bg: '#f3f4f6', color: '#6b7280', label: 'Inactive' },
    admin:     { bg: '#fff8e1', color: '#d97706', label: 'Admin' },
    seller:    { bg: '#e0f2fe', color: '#0369a1', label: 'Seller' },
    buyer:     { bg: '#f0fdf4', color: '#16a34a', label: 'Buyer' }
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', label: status };
  return '<span style="background:' + s.bg + ';color:' + s.color + ';font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px;">' + s.label + '</span>';
}

function showAdminToast(msg, icon) {
  icon = icon || '✅';
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:#0a1f44;color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(10,31,68,0.3);border-left:3px solid #f0b429;transform:translateX(120%);transition:transform .3s;';
    document.body.appendChild(t);
  }
  t.innerHTML = '<span>' + icon + '</span><span>' + msg + '</span>';
  t.style.transform = 'translateX(0)';
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => { t.style.transform = 'translateX(120%)'; }, 3000);
}

function paginator(total, limit, offset, onPage) {
  const pages = Math.ceil(total / limit);
  const current = Math.floor(offset / limit) + 1;
  if (pages <= 1) return '';
  let html = '<div style="display:flex;align-items:center;gap:8px;margin-top:16px;justify-content:flex-end;font-size:13px;">';
  html += '<span style="color:#6b7280;">' + (offset + 1) + '–' + Math.min(offset + limit, total) + ' of ' + total + '</span>';
  html += '<button onclick="(' + onPage.toString() + ')(' + Math.max(0, offset - limit) + ')" ' + (current === 1 ? 'disabled' : '') + ' style="padding:6px 12px;border:1.5px solid #e5e7eb;border-radius:7px;background:#fff;cursor:pointer;font-size:12px;">← Prev</button>';
  html += '<button onclick="(' + onPage.toString() + ')(' + (offset + limit) + ')" ' + (current === pages ? 'disabled' : '') + ' style="padding:6px 12px;border:1.5px solid #e5e7eb;border-radius:7px;background:#fff;cursor:pointer;font-size:12px;">Next →</button>';
  html += '</div>';
  return html;
}
