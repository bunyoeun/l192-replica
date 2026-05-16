// init.js — page-specific Supabase integration for L198 frontend
(function () {
  'use strict';

  const page = window.location.pathname.split('/').pop() || 'index.html';

  function fmt(n) { return '$' + parseFloat(n || 0).toFixed(2); }

  function showToast(msg, icon) {
    icon = icon || '✅';
    const t = document.getElementById('toast');
    if (!t) return;
    const ti = document.getElementById('toastIcon');
    const tm = document.getElementById('toastMsg');
    if (ti) ti.textContent = icon;
    if (tm) tm.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tmr);
    t._tmr = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  async function getCartCount() {
    try {
      const items = await getCart();
      const count = items.reduce(function (s, i) { return s + i.quantity; }, 0);
      document.querySelectorAll('.hdr-btn').forEach(function (btn) {
        const icon = btn.querySelector('.icon');
        const label = btn.querySelectorAll('span')[1];
        if (icon && icon.textContent.includes('🛒') && label) {
          label.textContent = count > 0 ? ('Cart (' + count + ')') : 'Cart';
        }
      });
    } catch (e) { /* not signed in */ }
  }

  const CAT_ICONS = {
    electronics: '📱', fashion: '👗',
    'home-garden': '🏠', beauty: '💄',
    sports: '🏋️', food: '🍜',
    books: '📚', toys: '🧸'
  };
  const CAT_BG = {
    electronics: '#e3f2fd', fashion: '#fce4ec',
    'home-garden': '#e8f5e9', beauty: '#ede7f6',
    sports: '#f1f8e9', food: '#fff8e1',
    books: '#e0f2f1', toys: '#fff3e0'
  };
  function catIcon(slug) { return CAT_ICONS[slug] || '🗂️'; }
  function catBg(slug) { return CAT_BG[slug] || '#e8f0fe'; }

  function productCardHtml(p) {
    const discount = p.compare_at_price
      ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
    const img = (p.images && p.images[0]) ? p.images[0].url : '';
    const bg = catBg(p.category && p.category.slug);
    const imgInner = img
      ? '<img src="' + img + '" alt="' + p.name.replace(/"/g, '') + '" style="position:relative;z-index:1;width:100%;height:100%;object-fit:cover;">'
      : '<span style="position:relative;z-index:1;font-size:48px;">' + catIcon(p.category && p.category.slug) + '</span>';
    return '<div class="product-card" onclick="window.location.href=\'product.html?slug=' + p.slug + '\'">'
      + '<div class="product-img" style="--c1:' + bg + ';--c2:' + bg + '88;">'
      + imgInner
      + (discount > 0 ? '<div class="prod-discount">-' + discount + '%</div>' : '')
      + '<div class="prod-fav" onclick="event.stopPropagation();L198Wish(\'' + p.id + '\',this)">❤️</div>'
      + '</div>'
      + '<div class="product-info">'
      + '<div class="product-name">' + p.name + '</div>'
      + '<div class="product-price-row">'
      + '<span class="price-current">' + fmt(p.price) + '</span>'
      + (p.compare_at_price ? '<span class="price-original">' + fmt(p.compare_at_price) + '</span>' : '')
      + '</div>'
      + '<div class="product-sold">' + (p.stock_quantity > 50 ? '🔥 ' + p.stock_quantity + ' in stock' : p.stock_quantity + ' left') + '</div>'
      + (discount > 0 ? '<div class="product-progress"><div class="product-progress-fill" style="width:' + Math.min(90, discount + 20) + '%"></div></div>' : '')
      + '</div></div>';
  }

  window.L198Wish = async function (productId, el) {
    try {
      const user = await getCurrentUser();
      if (!user) { showToast('Please sign in to save items', '🔒'); return; }
      await toggleWishlist(productId);
      const on = el.style.color === 'rgb(220, 38, 38)';
      el.style.color = on ? '' : '#dc2626';
      showToast(on ? 'Removed from wishlist' : 'Added to wishlist!', on ? '➖' : '❤️');
    } catch (e) { showToast(e.message, '❌'); }
  };

  window.L198AddCart = async function (productId, qty) {
    try {
      const user = await getCurrentUser();
      if (!user) { showToast('Please sign in to add items', '🔒'); window.location.href = 'login.html'; return; }
      await addToCart(productId, qty || 1);
      await getCartCount();
      showToast('Added to cart!', '🛒');
    } catch (e) { showToast(e.message, '❌'); }
  };

  // ============================================================
  // INDEX
  // ============================================================
  async function initIndex() {
    await getCartCount();

    const catGrid = document.querySelector('.cat-tiles');
    if (catGrid) {
      try {
        const cats = await getCategories();
        catGrid.innerHTML = cats.map(function (c) {
          return '<div class="cat-tile" onclick="window.location.href=\'category.html?category=' + c.slug + '\'">'
            + '<div class="cat-tile-icon" style="background:' + catBg(c.slug) + ';">' + catIcon(c.slug) + '</div>'
            + '<div class="cat-tile-name">' + c.name + '</div>'
            + '</div>';
        }).join('');
      } catch (e) { console.warn('Categories:', e.message); }
    }

    const rows = document.querySelectorAll('.product-row');
    if (rows[0]) {
      try {
        const prods = await getProducts({ limit: 6 });
        if (prods.length) rows[0].innerHTML = prods.map(productCardHtml).join('');
      } catch (e) { console.warn('Flash products:', e.message); }
    }
    if (rows[1]) {
      try {
        const prods = await getProducts({ limit: 6, offset: 6 });
        if (prods.length) rows[1].innerHTML = prods.map(productCardHtml).join('');
      } catch (e) { console.warn('Recommended:', e.message); }
    }

    function doSearch() {
      const q = (document.getElementById('searchInput') || {}).value;
      if (q && q.trim()) window.location.href = 'search.html?q=' + encodeURIComponent(q.trim());
      else showToast('Please enter a search term', '⚠️');
    }
    const sb = document.querySelector('.search-btn');
    if (sb) sb.onclick = doSearch;
    const si = document.getElementById('searchInput');
    if (si) si.onkeydown = function (e) { if (e.key === 'Enter') doSearch(); };
    window.addToCart = function (name) { showToast('"' + name + '" — click the product to add to cart', '🛒'); };
    window.triggerSearch = doSearch;
  }

  // ============================================================
  // PRODUCT
  // ============================================================
  async function initProduct() {
    await getCartCount();
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) return;
    try {
      const p = await getProduct(slug);
      document.title = p.name + ' – L198';

      const bc = document.querySelector('.breadcrumb');
      if (bc) bc.innerHTML = '<a href="index.html">Home</a><span>›</span>'
        + '<a href="category.html?category=' + (p.category && p.category.slug || '') + '">' + (p.category && p.category.name || 'Products') + '</a><span>›</span>'
        + '<span style="color:var(--gray-700);">' + p.name + '</span>';

      const sl = document.querySelector('.prod-store-link');
      if (sl && p.store) {
        const ini = p.store.name.split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
        sl.innerHTML = '<div class="store-dot">' + ini + '</div>'
          + '<a href="seller-store.html?store=' + p.store.slug + '">' + p.store.name + '</a>'
          + '<span style="color:var(--gray-300);margin:0 4px;">·</span>'
          + '<span style="color:#16a34a;">✓ Verified Seller</span>';
      }

      const pt = document.querySelector('.prod-title');
      if (pt) pt.textContent = p.name;

      const pb = document.querySelector('.price-block');
      if (pb) {
        const disc = p.compare_at_price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
        const sav = p.compare_at_price ? (p.compare_at_price - p.price).toFixed(2) : 0;
        pb.innerHTML = '<div><span class="price-main">' + fmt(p.price) + '</span>'
          + (p.compare_at_price ? '<span class="price-orig">' + fmt(p.compare_at_price) + '</span>' : '') + '</div>'
          + (disc > 0 ? '<div class="price-save">You save: $' + sav + ' (' + disc + '%)</div>' : '');
      }

      const dp = document.getElementById('desc');
      if (dp && p.description) {
        dp.innerHTML = '<h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">About This Product</h3>'
          + '<p style="color:var(--gray-700);line-height:1.8;">' + p.description + '</p>';
      }

      const qs = document.querySelector('.qty-stock');
      if (qs) qs.textContent = p.stock_quantity + ' units left';

      const gb = document.querySelector('.gallery-badge');
      if (gb) {
        const pct = p.compare_at_price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
        gb.textContent = pct > 0 ? ('-' + pct + '% OFF') : 'In Stock';
      }

      if (p.images && p.images.length > 0) {
        const gm = document.querySelector('.gallery-main');
        if (gm) {
          const svdBadge = gm.querySelector('.gallery-badge');
          const svdWish = gm.querySelector('.gallery-wish');
          gm.innerHTML = '';
          if (svdBadge) gm.appendChild(svdBadge);
          if (svdWish) gm.appendChild(svdWish);
          const img = document.createElement('img');
          img.src = p.images[0].url; img.alt = p.name;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:relative;z-index:1;';
          gm.appendChild(img);
        }
      }

      const acb = document.querySelector('.btn-add-cart');
      if (acb) acb.onclick = function () {
        const qi = document.getElementById('qtyInput');
        window.L198AddCart(p.id, parseInt((qi && qi.value) || '1'));
      };
      const bnb = document.querySelector('.btn-buy-now');
      if (bnb) bnb.onclick = async function () {
        const qi = document.getElementById('qtyInput');
        await window.L198AddCart(p.id, parseInt((qi && qi.value) || '1'));
        window.location.href = 'cart.html';
      };

      const wb = document.querySelector('.gallery-wish');
      if (wb) {
        wb.onclick = function () { window.L198Wish(p.id, wb); };
        try {
          const user = await getCurrentUser();
          if (user) {
            const wl = await getWishlist();
            if (wl.some(function (w) { return w.product_id === p.id; })) wb.style.color = '#dc2626';
          }
        } catch (e) {}
      }
    } catch (e) { console.warn('Product load:', e.message); }
  }

  // ============================================================
  // CART
  // ============================================================
  var _items = [];

  async function initCart() {
    const user = await requireAuth();
    if (!user) return;
    await loadCart();
    subscribeToCart(function () { loadCart(); });
  }

  async function loadCart() {
    try {
      _items = await getCart();
      renderCart(_items);
      updateSummary(_items, parseFloat(sessionStorage.getItem('couponDiscount') || '0'));
    } catch (e) { console.warn('Cart load:', e.message); }
  }

  function renderCart(items) {
    const cs = document.querySelector('.cart-section');
    if (!cs) return;
    if (!items.length) {
      cs.innerHTML = '<div style="text-align:center;padding:48px 24px;">'
        + '<div style="font-size:64px;margin-bottom:16px;">🛒</div>'
        + '<div style="font-size:18px;font-weight:700;margin-bottom:8px;">Your cart is empty</div>'
        + '<a href="index.html" style="color:var(--accent);font-weight:600;">Continue Shopping →</a></div>';
      return;
    }
    const byStore = {};
    items.forEach(function (item) {
      const sid = item.product && item.product.store ? item.product.store.id : 'x';
      const sn = item.product && item.product.store ? item.product.store.name : 'L198 Store';
      if (!byStore[sid]) byStore[sid] = { name: sn, items: [] };
      byStore[sid].items.push(item);
    });
    const total = items.reduce(function (s, i) { return s + i.quantity; }, 0);
    let html = '<div class="cart-section-title">'
      + '<div>🛒 My Cart <span style="color:var(--gray-500);font-size:14px;font-weight:400;">(' + total + ' items)</span></div>'
      + '<label class="select-all"><input type="checkbox" id="selectAll" checked onchange="toggleAll(this)"> Select All</label>'
      + '</div>';
    Object.keys(byStore).forEach(function (sid) {
      const st = byStore[sid];
      html += '<div class="store-group">'
        + '<div class="store-group-header">'
        + '<div class="store-avatar-sm" style="background:linear-gradient(135deg,#0a1f44,#1a73e8);">' + st.name.substring(0, 2).toUpperCase() + '</div>'
        + '<span class="store-name-sm">' + st.name + '</span>'
        + '<span class="store-badge">✓ Verified</span></div>';
      st.items.forEach(function (item) { html += itemHtml(item); });
      html += '</div>';
    });
    cs.innerHTML = html;
  }

  function itemHtml(item) {
    const p = item.product || {};
    const price = p.price || 0;
    const orig = p.compare_at_price;
    const disc = orig ? Math.round((1 - price / orig) * 100) : 0;
    return '<div class="cart-item" data-item-id="' + item.id + '">'
      + '<div class="cart-item-check"><input type="checkbox" checked></div>'
      + '<div class="cart-item-img"><span style="position:relative;z-index:1;font-size:32px;">🛒</span></div>'
      + '<div class="cart-item-body">'
      + '<div class="cart-item-name">' + (p.name || 'Product') + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:8px;">'
      + '<span class="cart-item-price">' + fmt(price) + '</span>'
      + (orig ? '<span class="cart-item-orig">' + fmt(orig) + '</span>' : '')
      + (disc > 0 ? '<span style="font-size:11px;color:var(--navy);font-weight:700;background:#e8f0fe;padding:2px 7px;border-radius:4px;">-' + disc + '%</span>' : '')
      + '</div>'
      + '<div class="shipping-tag">🚀 Free · Same-day Delivery</div>'
      + '<div class="cart-item-actions">'
      + '<div class="qty-ctrl-sm">'
      + '<div class="qty-btn-sm" onclick="cartQty(\'' + item.id + '\',-1)">&minus;</div>'
      + '<input class="qty-num-sm" id="qty-' + item.id + '" value="' + item.quantity + '" type="number" min="1" readonly>'
      + '<div class="qty-btn-sm" onclick="cartQty(\'' + item.id + '\',1)">+</div>'
      + '</div>'
      + '<div class="item-actions-right">'
      + '<span class="item-action-btn item-delete" onclick="cartRemove(\'' + item.id + '\')">🗑️ Remove</span>'
      + '</div></div></div></div>';
  }

  function updateSummary(items, couponDiscount) {
    const sub = items.reduce(function (s, i) { return s + (i.product ? i.product.price : 0) * i.quantity; }, 0);
    const itemDisc = items.reduce(function (s, i) {
      const o = i.product && i.product.compare_at_price ? i.product.compare_at_price : (i.product ? i.product.price : 0);
      return s + (o - (i.product ? i.product.price : 0)) * i.quantity;
    }, 0);
    const total = sub - couponDiscount;
    function el(id) { return document.getElementById(id); }
    if (el('totalAmount')) el('totalAmount').textContent = fmt(total);
    if (el('savingsText')) el('savingsText').textContent = 'You saved ' + fmt(itemDisc + couponDiscount) + ' total!';
    if (el('sum-subtotal')) el('sum-subtotal').textContent = fmt(sub);
    if (el('sum-discount')) el('sum-discount').textContent = '-' + fmt(itemDisc);
    if (el('sum-coupon') && couponDiscount > 0) el('sum-coupon').textContent = '-' + fmt(couponDiscount);
  }

  window.cartQty = async function (itemId, delta) {
    const inp = document.getElementById('qty-' + itemId);
    if (!inp) return;
    const nv = Math.max(1, parseInt(inp.value) + delta);
    try { await updateCartItem(itemId, nv); inp.value = nv; await loadCart(); }
    catch (e) { showToast(e.message, '❌'); }
  };

  window.cartRemove = async function (itemId) {
    const el = document.querySelector('[data-item-id="' + itemId + '"]');
    if (el) { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }
    try { await removeFromCart(itemId); await loadCart(); showToast('Item removed', '🗑️'); }
    catch (e) { showToast(e.message, '❌'); }
  };

  window.toggleAll = function (cb) {
    document.querySelectorAll('.cart-item-check input').forEach(function (c) { c.checked = cb.checked; });
  };

  window.applyCoupon = async function () {
    const inp = document.getElementById('couponInput');
    const code = inp ? inp.value.trim() : '';
    if (!code) { showToast('Please enter a voucher code', '⚠️'); return; }
    try {
      const sub = _items.reduce(function (s, i) { return s + (i.product ? i.product.price : 0) * i.quantity; }, 0);
      const coupon = await validateCoupon(code, sub);
      const tag = document.getElementById('couponTag');
      const row = document.getElementById('couponRow');
      if (tag) { tag.style.display = 'flex'; const ct = tag.querySelector('.ctag'); if (ct) ct.textContent = code.toUpperCase(); }
      if (row) row.style.display = 'flex';
      sessionStorage.setItem('couponCode', code);
      sessionStorage.setItem('couponDiscount', coupon.discountAmount);
      updateSummary(_items, coupon.discountAmount);
      showToast('Voucher applied! -' + fmt(coupon.discountAmount), '🎟️');
    } catch (e) { showToast(e.message, '❌'); }
  };

  window.removeCoupon = function () {
    const tag = document.getElementById('couponTag');
    const row = document.getElementById('couponRow');
    const inp = document.getElementById('couponInput');
    if (tag) tag.style.display = 'none';
    if (row) row.style.display = 'none';
    if (inp) inp.value = '';
    sessionStorage.removeItem('couponCode');
    sessionStorage.removeItem('couponDiscount');
    updateSummary(_items, 0);
    showToast('Voucher removed', '➖');
  };

  // ============================================================
  // CHECKOUT-ADDRESS
  // ============================================================
  async function initCheckoutAddress() {
    const user = await requireAuth();
    if (!user) return;
    try {
      const addresses = await getAddresses();
      const container = document.querySelector('.saved-addresses');
      if (container) {
        if (!addresses.length) {
          container.innerHTML = '<div style="color:var(--gray-500);font-size:13px;padding:12px 0;">No saved addresses yet. Add one below.</div>';
        } else {
          container.innerHTML = addresses.map(function (addr) {
            const parts = [addr.street_address, addr.commune, addr.district, addr.city].filter(Boolean).join(', ');
            return '<div class="addr-option ' + (addr.is_default ? 'selected' : '') + '" data-addr-id="' + addr.id + '" onclick="selectAddr(this)">'
              + '<input type="radio" name="addr" ' + (addr.is_default ? 'checked' : '') + '>'
              + '<div class="addr-detail">'
              + '<div class="addr-name">' + (addr.full_name || (user.email || '')) + (addr.is_default ? ' <span class="addr-default-tag">Default</span>' : '') + '</div>'
              + '<div class="addr-phone">' + (addr.phone || '') + '</div>'
              + '<div class="addr-text">' + parts + '</div>'
              + '</div></div>';
          }).join('');
          const first = container.querySelector('.selected') || container.querySelector('.addr-option');
          if (first && first.dataset.addrId) sessionStorage.setItem('selectedAddressId', first.dataset.addrId);
        }
      }
      window.selectAddr = function (el) {
        document.querySelectorAll('.addr-option').forEach(function (a) { a.classList.remove('selected'); });
        el.classList.add('selected');
        const r = el.querySelector('input[type=radio]');
        if (r) r.checked = true;
        sessionStorage.setItem('selectedAddressId', el.dataset.addrId);
      };
    } catch (e) { console.warn('Addresses:', e.message); }

    document.querySelectorAll('.time-slot').forEach(function (slot) {
      slot.addEventListener('click', function () {
        if (this.classList.contains('unavailable')) return;
        const t = (this.querySelector('.slot-time') || {}).textContent || '';
        const d = (this.querySelector('.slot-label') || {}).textContent || '';
        sessionStorage.setItem('selectedSlot', d + ' · ' + t);
      });
    });
    const ds = document.querySelector('.time-slot.selected');
    if (ds) {
      const t = (ds.querySelector('.slot-time') || {}).textContent || '';
      const d = (ds.querySelector('.slot-label') || {}).textContent || '';
      sessionStorage.setItem('selectedSlot', d + ' · ' + t);
    }

    const tog = document.querySelector('.add-addr-toggle');
    if (tog) tog.onclick = function () {
      const form = document.getElementById('newAddrForm');
      const icon = document.getElementById('addAddrIcon');
      if (!form) return;
      const open = form.classList.contains('open');
      form.classList.toggle('open');
      if (icon) icon.textContent = open ? '＋' : '－';
    };

    const cont = document.querySelector('.continue-btn');
    if (cont) cont.onclick = function (e) {
      e.preventDefault();
      if (!sessionStorage.getItem('selectedAddressId')) {
        showToast('Please select a delivery address', '⚠️');
        return;
      }
      window.location.href = 'checkout-payment.html';
    };
  }

  // ============================================================
  // CHECKOUT-PAYMENT
  // ============================================================
  async function initCheckoutPayment() {
    const user = await requireAuth();
    if (!user) return;

    const addrId = sessionStorage.getItem('selectedAddressId');
    const slot = sessionStorage.getItem('selectedSlot') || 'Today · 12PM–3PM';
    if (addrId) {
      try {
        const addresses = await getAddresses();
        const addr = addresses.find(function (a) { return a.id === addrId; }) || addresses[0];
        if (addr) {
          const recap = document.querySelector('.addr-recap');
          if (recap) {
            const ne = recap.querySelector('.ar-name');
            const te = recap.querySelector('.ar-text');
            if (ne) ne.textContent = (addr.full_name || user.email || '') + ' · ' + (addr.phone || '');
            if (te) te.innerHTML = [addr.street_address, addr.commune, addr.district, addr.city].filter(Boolean).join(', ') + '<br>📅 ' + slot;
          }
        }
      } catch (e) {}
    }

    try {
      const items = await getCart();
      const sub = items.reduce(function (s, i) { return s + (i.product ? i.product.price : 0) * i.quantity; }, 0);
      const cd = parseFloat(sessionStorage.getItem('couponDiscount') || '0');
      const total = sub - cd;
      const ta = document.querySelector('.summary-total .amount');
      if (ta) ta.textContent = fmt(total);
      const pb = document.querySelector('.pay-btn');
      if (pb) pb.innerHTML = '🔒 Place Order &amp; Pay ' + fmt(total);
      const qa = document.querySelector('.qr-amount');
      if (qa) qa.textContent = fmt(total);
    } catch (e) {}

    window.processPayment = async function () {
      const ov = document.getElementById('processingOverlay');
      if (ov) ov.classList.add('show');
      try {
        const order = await placeOrder({
          shippingAddressId: sessionStorage.getItem('selectedAddressId'),
          discount: parseFloat(sessionStorage.getItem('couponDiscount') || '0') || undefined,
          couponCode: sessionStorage.getItem('couponCode') || undefined
        });
        sessionStorage.setItem('orderId', order.id);
        sessionStorage.removeItem('couponCode');
        sessionStorage.removeItem('couponDiscount');
        sessionStorage.removeItem('selectedAddressId');
        if (ov) ov.classList.remove('show');
        window.location.href = 'checkout-confirm.html';
      } catch (e) {
        if (ov) ov.classList.remove('show');
        showToast('Order failed: ' + e.message, '❌');
      }
    };
  }

  // ============================================================
  // CHECKOUT-CONFIRM
  // ============================================================
  async function initCheckoutConfirm() {
    const user = await requireAuth();
    if (!user) return;
    const orderId = sessionStorage.getItem('orderId');
    setTimeout(function () { showToast('Your order is confirmed! 🎉', '✅'); }, 400);
    if (!orderId) return;
    try {
      const order = await getOrder(orderId);
      const short = order.id.substring(0, 8).toUpperCase();

      const badge = document.querySelector('.order-id-badge');
      if (badge) badge.innerHTML = '📦 Order #' + short
        + ' <span class="copy-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + order.id + '\');showToast(\'Copied!\',\'📋\')">Copy</span>';

      const sub = document.querySelector('.success-sub');
      if (sub) sub.textContent = 'Thank you for your order! #' + short + ' is confirmed.';

      if (order.items && order.items.length) {
        const ie = document.querySelector('.order-items');
        const ct = document.querySelector('.card-title');
        const tot = order.items.reduce(function (s, i) { return s + i.quantity; }, 0);
        if (ct) ct.textContent = '🛍️ Items Ordered (' + tot + ')';
        if (ie) ie.innerHTML = order.items.map(function (item) {
          return '<div class="order-item">'
            + '<div class="item-img"><span style="position:relative;z-index:1;font-size:26px;">🛍️</span></div>'
            + '<div class="item-info">'
            + '<div class="item-name">' + (item.product_name || 'Product') + '</div>'
            + '<div class="item-qty-price">'
            + '<span class="item-qty">Qty: ' + item.quantity + '</span>'
            + '<span class="item-price">' + fmt(item.unit_price * item.quantity) + '</span>'
            + '</div></div></div>';
        }).join('');
      }

      const st = document.querySelector('.sum-total .amount');
      if (st) st.textContent = fmt(order.total_amount);

      const sr = document.querySelector('.sum-rows');
      if (sr) sr.innerHTML =
        '<div class="sum-row"><span>Subtotal</span><span class="val">' + fmt(order.subtotal_amount || order.total_amount) + '</span></div>'
        + '<div class="sum-row"><span>Delivery fee</span><span class="val green">FREE 🎉</span></div>'
        + (order.discount_amount > 0 ? '<div class="sum-row"><span>Discount</span><span class="val green">-' + fmt(order.discount_amount) + '</span></div>' : '');
    } catch (e) { console.warn('Order confirm:', e.message); }
  }

  // ============================================================
  // ROUTER
  // ============================================================
  document.addEventListener('DOMContentLoaded', async function () {
    if (page === 'index.html' || page === '') {
      await initIndex();
    } else if (page === 'product.html') {
      await initProduct();
    } else if (page === 'cart.html') {
      await initCart();
    } else if (page === 'checkout-address.html') {
      await initCheckoutAddress();
    } else if (page === 'checkout-payment.html') {
      await initCheckoutPayment();
    } else if (page === 'checkout-confirm.html') {
      await initCheckoutConfirm();
    } else {
      try { await getCartCount(); } catch (e) {}
    }
  });

})();
