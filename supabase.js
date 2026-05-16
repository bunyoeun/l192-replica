/**
 * supabase.js — L198 Marketplace
 * Supabase integration for vanilla HTML/JS frontend
 *
 * Place this file in the root of your repo alongside your HTML files.
 * Include it in every page BEFORE your page-specific scripts:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="supabase.js"></script>
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL     = 'https://vbhgmxyaeucxwqpwutxm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XpnU1F6yJjetKXXyLW37Mg_rgZOoC4F';

// ─── CLIENT ──────────────────────────────────────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── AUTH HELPERS ────────────────────────────────────────────────────────────

/**
 * Sign up a new user (buyer by default)
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @param {string} phone
 */
async function signUp(email, password, fullName, phone = '') {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone }
    }
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with email + password
 */
async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign in with Google OAuth
 */
async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/index.html' }
  });
  if (error) throw error;
}

/**
 * Sign out current user
 */
async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email) {
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/login.html'
  });
  if (error) throw error;
}

/**
 * Get current logged-in user (or null)
 */
async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

/**
 * Get current user's profile from profiles table
 */
async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return data;
}

/**
 * Update current user's profile
 */
async function updateProfile(updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await db.from('profiles').update(updates).eq('id', user.id).select().single();
  if (error) throw error;
  return data;
}

/**
 * Guard: redirect to login if not authenticated
 * Call this at the top of any protected page script
 */
async function requireAuth(redirectTo = 'login.html') {
  const user = await getCurrentUser();
  if (!user) window.location.href = redirectTo;
  return user;
}

/**
 * Guard: redirect to home if already authenticated
 * Call this on login.html to skip the page if already signed in
 */
async function redirectIfAuthed(redirectTo = 'index.html') {
  const user = await getCurrentUser();
  if (user) window.location.href = redirectTo;
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

/**
 * Fetch active products (with optional filters)
 * @param {{ categoryId, storeId, search, limit, offset }} opts
 */
async function getProducts(opts = {}) {
  let query = db
    .from('products')
    .select(`*, store:stores(id, name, slug), category:categories(id, name), images:product_images(url, position)`)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (opts.categoryId) query = query.eq('category_id', opts.categoryId);
  if (opts.storeId)    query = query.eq('store_id', opts.storeId);
  if (opts.search)     query = query.ilike('name', `%${opts.search}%`);
  if (opts.limit)      query = query.limit(opts.limit);
  if (opts.offset)     query = query.range(opts.offset, opts.offset + (opts.limit || 20) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Fetch a single product by slug
 */
async function getProduct(slug) {
  const { data, error } = await db
    .from('products')
    .select(`*, store:stores(*), category:categories(*), images:product_images(*), reviews(*, user:profiles(full_name, avatar_url))`)
    .eq('slug', slug)
    .eq('status', 'active')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch all categories
 */
async function getCategories() {
  const { data, error } = await db.from('categories').select('*').order('name');
  if (error) throw error;
  return data;
}

// ─── CART ────────────────────────────────────────────────────────────────────

/**
 * Get current user's cart items
 */
async function getCart() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await db
    .from('cart_items')
    .select(`*, product:products(id, name, price, slug, images:product_images(url))`)
    .eq('user_id', user.id);
  if (error) throw error;
  return data;
}

/**
 * Add item to cart (or update quantity if already exists)
 */
async function addToCart(productId, quantity = 1) {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const { data: existing } = await db
    .from('cart_items')
    .select('id, quantity')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .single();

  if (existing) {
    const { error } = await db
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await db
      .from('cart_items')
      .insert({ user_id: user.id, product_id: productId, quantity });
    if (error) throw error;
  }
}

/**
 * Update cart item quantity
 */
async function updateCartItem(cartItemId, quantity) {
  if (quantity <= 0) return removeFromCart(cartItemId);
  const { error } = await db.from('cart_items').update({ quantity }).eq('id', cartItemId);
  if (error) throw error;
}

/**
 * Remove item from cart
 */
async function removeFromCart(cartItemId) {
  const { error } = await db.from('cart_items').delete().eq('id', cartItemId);
  if (error) throw error;
}

/**
 * Clear entire cart for current user
 */
async function clearCart() {
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await db.from('cart_items').delete().eq('user_id', user.id);
  if (error) throw error;
}

/**
 * Get cart item count (for badge in navbar)
 */
async function getCartCount() {
  const user = await getCurrentUser();
  if (!user) return 0;
  const { count, error } = await db
    .from('cart_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (error) return 0;
  return count || 0;
}

// ─── WISHLIST ────────────────────────────────────────────────────────────────

async function getWishlist() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await db
    .from('wishlists')
    .select(`*, product:products(id, name, price, slug, images:product_images(url))`)
    .eq('user_id', user.id);
  if (error) throw error;
  return data;
}

async function toggleWishlist(productId) {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return false; }

  const { data: existing } = await db
    .from('wishlists')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .single();

  if (existing) {
    await db.from('wishlists').delete().eq('id', existing.id);
    return false; // removed
  } else {
    await db.from('wishlists').insert({ user_id: user.id, product_id: productId });
    return true;  // added
  }
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

/**
 * Get current user's orders
 */
async function getOrders() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await db
    .from('orders')
    .select(`*, items:order_items(*)`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Place an order from current cart
 * @param {{ shippingAddressId, notes, couponCode }} opts
 */
async function placeOrder(opts = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const cartItems = await getCart();
  if (!cartItems.length) throw new Error('Cart is empty');

  const subtotal     = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const shippingCost = 2.50;
  const tax          = +(subtotal * 0.1).toFixed(2);
  const total        = +(subtotal + shippingCost + tax).toFixed(2);

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      user_id:             user.id,
      shipping_address_id: opts.shippingAddressId || null,
      subtotal,
      shipping_cost:       shippingCost,
      tax,
      total,
      notes:               opts.notes || null,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = cartItems.map(item => ({
    order_id:          order.id,
    product_id:        item.product.id,
    store_id:          item.product.store_id,
    product_name:      item.product.name,
    product_image_url: item.product.images?.[0]?.url || null,
    unit_price:        item.product.price,
    quantity:          item.quantity,
    subtotal:          +(item.product.price * item.quantity).toFixed(2),
  }));

  const { error: itemsError } = await db.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  await clearCart();
  return order;
}

// ─── ADDRESSES ───────────────────────────────────────────────────────────────

async function getAddresses() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await db.from('addresses').select('*').eq('user_id', user.id);
  if (error) throw error;
  return data;
}

async function addAddress(address) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await db.from('addresses').insert({ ...address, user_id: user.id }).select().single();
  if (error) throw error;
  return data;
}

// ─── REVIEWS ─────────────────────────────────────────────────────────────────

async function addReview(productId, rating, title, body) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await db
    .from('reviews')
    .upsert({ product_id: productId, user_id: user.id, rating, title, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────

async function searchProducts(query) {
  return getProducts({ search: query, limit: 30 });
}

// ─── REALTIME ────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time order status updates
 * @param {string} orderId
 * @param {function} callback - called with updated order row
 */
function subscribeToOrder(orderId, callback) {
  return db
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'orders',
      filter: `id=eq.${orderId}`
    }, payload => callback(payload.new))
    .subscribe();
}

/**
 * Subscribe to cart changes (multi-tab sync)
 */
async function subscribeToCart(callback) {
  const user = await getCurrentUser();
  if (!user) return;
  return db
    .channel('cart')
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'cart_items',
      filter: `user_id=eq.${user.id}`
    }, () => callback())
    .subscribe();
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

async function getNotifications() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

async function markNotificationRead(notificationId) {
  const { error } = await db.from('notifications').update({ read: true }).eq('id', notificationId);
  if (error) throw error;
}

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────

/**
 * Upload an avatar image for the current user
 * @param {File} file
 */
async function uploadAvatar(file) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const ext  = file.name.split('.').pop();
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await db.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = db.storage.from('avatars').getPublicUrl(path);
  await updateProfile({ avatar_url: data.publicUrl });
  return data.publicUrl;
}

/**
 * Upload a product image (for sellers)
 * @param {File} file
 * @param {string} productId
 */
async function uploadProductImage(file, productId) {
  const ext  = file.name.split('.').pop();
  const path = `${productId}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from('product-images').upload(path, file);
  if (error) throw error;
  const { data } = db.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

// ─── UI UTILITIES ─────────────────────────────────────────────────────────────

/**
 * Update cart badge count in navbar
 * Call on page load on every page that has a cart icon
 */
async function updateCartBadge(selector = '.cart-badge') {
  const count = await getCartCount();
  const badge = document.querySelector(selector);
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

/**
 * Show a toast notification
 */
function showToast(msg, icon = '✅', duration = 3000) {
  let toast = document.getElementById('sb-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sb-toast';
    toast.style.cssText = `position:fixed;top:24px;right:22px;background:#0a1f44;color:#fff;
      padding:13px 20px;border-radius:11px;font-size:13px;font-family:inherit;
      box-shadow:0 8px 32px rgba(10,31,68,0.18);z-index:9999;
      display:flex;align-items:center;gap:10px;
      transform:translateX(120%);transition:transform .3s ease;
      border-left:3px solid #f0b429;`;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  toast.style.transform = 'translateX(0)';
  setTimeout(() => toast.style.transform = 'translateX(120%)', duration);
}

// ─── AUTH STATE LISTENER ──────────────────────────────────────────────────────

/**
 * Listens for auth state changes (login/logout)
 * Updates UI elements with class .user-name, .user-avatar, .auth-show, .auth-hide
 */
db.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user;

  document.querySelectorAll('.auth-show').forEach(el => el.style.display = user ? '' : 'none');
  document.querySelectorAll('.auth-hide').forEach(el => el.style.display = user ? 'none' : '');

  if (user) {
    try {
      const profile = await getProfile();
      document.querySelectorAll('.user-name').forEach(el => el.textContent = profile?.full_name || user.email);
      document.querySelectorAll('.user-avatar').forEach(el => {
        if (profile?.avatar_url) el.src = profile.avatar_url;
      });
    } catch (e) { /* profile not ready yet */ }
    await updateCartBadge();
  }
});

// ─── EXPORT (for use as ES module if bundled) ─────────────────────────────────
// If you're using plain <script> tags, all functions are globally available.
// If you migrate to a bundler later, uncomment the exports below:
/*
export {
  db, signUp, signIn, signInWithGoogle, signOut, sendPasswordReset,
  getCurrentUser, getProfile, updateProfile, requireAuth, redirectIfAuthed,
  getProducts, getProduct, getCategories, searchProducts,
  getCart, addToCart, updateCartItem, removeFromCart, clearCart, getCartCount,
  getWishlist, toggleWishlist,
  getOrders, placeOrder,
  getAddresses, addAddress,
  addReview,
  subscribeToOrder, subscribeToCart,
  getNotifications, markNotificationRead,
  uploadAvatar, uploadProductImage,
  updateCartBadge, showToast
};
*/
