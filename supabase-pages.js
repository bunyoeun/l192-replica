/**
 * supabase-pages.js — L198 Marketplace
 * Page-level Supabase wiring for index, product, checkout, orders pages.
 * Include AFTER supabase.js on each page.
 *
 * Usage: <script src="supabase-pages.js"></script>
 *
 * Each page calls the relevant init function from its own <script> block.
 */

// ─── INDEX PAGE ───────────────────────────────────────────────────────────────
async function initIndexPage() {
  await updateCartBadge('.cart-count');
  const user = await getCurrentUser();
  if (user) {
    const profile = await getProfile().catch(() => null);
    const name = profile?.full_name?.split(' ')[0] || 'Account';
    const accountEl = document.getElementById('accountLabel');
    if (accountEl) accountEl.textContent = name;
  }
}

// ─── PRODUCT PAGE ─────────────────────────────────────────────────────────────
async function initProductPage(productSlug) {
  await updateCartBadge();

  // Wishlist heart button
  const wishBtn = document.getElementById('wishBtn');
  if (wishBtn && productSlug) {
    const user = await getCurrentUser();
    if (user) {
      const { data } = await db.from('wishlists').select('id').eq('user_id', user.id)
        .eq('product_id', productSlug).single().catch(() => ({ data: null }));
      if (data) { wishBtn.textContent = '❤️'; wishBtn.classList.add('wished'); }
    }
    wishBtn.onclick = async () => {
      try {
        const added = await toggleWishlist(productSlug);
        wishBtn.textContent = added ? '❤️' : '♡';
        showToast(added ? 'Added to wishlist!' : 'Removed from wishlist', added ? '❤️' : '➖');
      } catch { showToast('Please sign in', '⚠️'); }
    };
  }
}

async function handleAddToCart(productId, quantity = 1) {
  try {
    await addToCart(productId, quantity);
    showToast('Added to cart!', '🛒');
    await updateCartBadge();
  } catch (e) { showToast(e.message || 'Failed to add to cart', '❌'); }
}

async function handleBuyNow(productId, quantity = 1) {
  try {
    await addToCart(productId, quantity);
    window.location.href = 'cart.html';
  } catch { window.location.href = 'login.html'; }
}

// ─── CHECKOUT ADDRESS PAGE ────────────────────────────────────────────────────
async function initAddressPage() {
  await requireAuth('login.html');
  await loadSavedAddresses();
}

async function loadSavedAddresses() {
  try {
    const addresses = await getAddresses();
    const container = document.getElementById('savedAddresses');
    if (!container) return;

    if (!addresses.length) {
      container.innerHTML = '<p style="color:var(--gray-500);font-size:13px;">No saved addresses. Please add one below.</p>';
      // Auto-open the new address form
      const form = document.getElementById('newAddrForm');
      if (form) { form.classList.add('open'); }
      return;
    }

    container.innerHTML = addresses.map((addr, i) => `
      <div class="addr-option ${addr.is_default || i === 0 ? 'selected' : ''}" onclick="selectAddr(this)" data-addr-id="${addr.id}">
        <input type="radio" name="addr" ${addr.is_default || i === 0 ? 'checked' : ''}>
        <div class="addr-detail">
          <div class="addr-name">${addr.label || 'Home'} ${addr.is_default ? '<span class="addr-default-tag">Default</span>' : ''}</div>
          <div class="addr-text">${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city}, ${addr.country}</div>
        </div>
      </div>`).join('');
  } catch (e) { console.error('Failed to load addresses:', e); }
}

async function saveNewAddress() {
  const line1 = document.getElementById('addrLine1')?.value.trim();
  const city = document.getElementById('addrCity')?.value.trim();
  const country = document.getElementById('addrCountry')?.value || 'KH';
  const postal_code = document.getElementById('addrPostal')?.value.trim() || '00000';
  const label = document.getElementById('addrLabel')?.value || 'Home';

  if (!line1 || !city) { showToast('Please fill in address details', '⚠️'); return; }
  try {
    await addAddress({ line1, city, country, postal_code, label });
    showToast('Address saved!', '✅');
    await loadSavedAddresses();
    const form = document.getElementById('newAddrForm');
    if (form) form.classList.remove('open');
  } catch (e) { showToast('Failed to save address: ' + e.message, '❌'); }
}

function getSelectedAddressId() {
  const selected = document.querySelector('.addr-option.selected');
  return selected?.dataset?.addrId || null;
}

// ─── CHECKOUT PAYMENT PAGE ────────────────────────────────────────────────────
async function initPaymentPage() {
  await requireAuth('login.html');
  // Load cart total into summary
  const items = await getCart();
  if (!items.length) { window.location.href = 'cart.html'; return; }
  const subtotal = items.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0);
  const els = {
    subtotal: document.getElementById('paySubtotal'),
    total: document.getElementById('payTotal'),
  };
  if (els.subtotal) els.subtotal.textContent = `$${subtotal.toFixed(2)}`;
  if (els.total) els.total.textContent = `$${subtotal.toFixed(2)}`;
}

async function processPaymentAndOrder() {
  const overlay = document.getElementById('processingOverlay');
  if (overlay) overlay.classList.add('show');
  try {
    const addressId = sessionStorage.getItem('l198_addressId');
    const order = await placeOrder({ shippingAddressId: addressId });
    sessionStorage.setItem('l198_lastOrderId', order.id);
    sessionStorage.removeItem('l198_addressId');
    sessionStorage.removeItem('l198_coupon');
    setTimeout(() => { window.location.href = 'checkout-confirm.html'; }, 500);
  } catch (e) {
    if (overlay) overlay.classList.remove('show');
    showToast('Payment failed: ' + e.message, '❌');
  }
}

// ─── CHECKOUT CONFIRM PAGE ────────────────────────────────────────────────────
async function initConfirmPage() {
  const orderId = sessionStorage.getItem('l198_lastOrderId');
  if (!orderId) return;

  // Subscribe to real-time order updates
  subscribeToOrder(orderId, (updatedOrder) => {
    const statusEl = document.getElementById('liveOrderStatus');
    if (statusEl) statusEl.textContent = updatedOrder.status;
  });

  // Show order ID
  const orderIdEl = document.getElementById('displayOrderId');
  if (orderIdEl) {
    orderIdEl.textContent = `#${orderId.slice(0,8).toUpperCase()}`;
    orderIdEl.onclick = () => {
      navigator.clipboard?.writeText(orderId).catch(() => {});
      showToast('Order ID copied!', '📋');
    };
  }
}

// ─── ORDERS (TRACKING) PAGE ───────────────────────────────────────────────────
async function initOrdersPage() {
  await requireAuth('login.html');
  const orderId = new URLSearchParams(window.location.search).get('id');
  if (orderId) {
    await loadOrderDetail(orderId);
    subscribeToOrder(orderId, (updated) => {
      const el = document.getElementById('liveStatus');
      if (el) el.textContent = updated.status;
    });
  }
}

async function loadOrderDetail(orderId) {
  try {
    const { data: order } = await db.from('orders')
      .select('*, items:order_items(*)')
      .eq('id', orderId)
      .single();
    if (!order) return;

    const headerEl = document.getElementById('orderDetailHeader');
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="oh-id">📦 Order #${order.id.slice(0,8).toUpperCase()}</div>
        <div class="oh-date">${new Date(order.created_at).toLocaleString()}</div>
        <div id="liveStatus">${order.status}</div>
        <div>Total: <strong>$${Number(order.total).toFixed(2)}</strong></div>`;
    }
  } catch (e) { console.error(e); }
}

// ─── SEARCH PAGE ──────────────────────────────────────────────────────────────
async function initSearchPage() {
  await updateCartBadge();
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  if (q) {
    document.getElementById('searchInput').value = q;
    document.getElementById('queryDisplay').textContent = q;
    await runSearch(q);
  }
}

async function runSearch(query) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);">⏳ Searching...</div>';
  try {
    const results = await searchProducts(query);
    if (!results.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;"><div style="font-size:48px;margin-bottom:16px;">🔍</div><h3>No results found</h3><p style="color:var(--gray-500);margin-top:8px;">Try different keywords</p></div>';
      return;
    }
    grid.innerHTML = results.map(p => {
      const img = p.images?.[0]?.url;
      return `
        <div class="product-card" onclick="window.location.href='product.html?slug=${p.slug}'">
          <div class="product-img" style="background:linear-gradient(135deg,#e8f0fe,#c2d4fb);">
            ${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;" alt="${p.name}">` : '<span>🛍️</span>'}
          </div>
          <div class="product-info">
            <div class="product-name">${p.name}</div>
            <div class="product-price-row"><span class="price-current">$${Number(p.price).toFixed(2)}</span></div>
            <button class="add-cart-sm" onclick="event.stopPropagation();handleAddToCart('${p.id}')">🛒 Add to Cart</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626;">❌ Search failed. Please try again.</div>`;
  }
}
