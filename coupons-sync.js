(() => {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxFs75do4gJ941Agg0x6432z18qPjqkZ0ucutOCkaH-keZfDGP_xCPRhawbVXLIw8Y/exec';
  const CACHE_KEY = 'alameer_coupons_cache_v2';
  const CACHE_MAX_AGE = 5 * 60 * 1000;
  const CART_REFRESH_AGE = 60 * 1000;

  let remoteCoupons = {};
  let couponsReady = false;
  let refreshPromise = null;
  let lastRemoteRefresh = 0;

  function showMessage(message, type = 'info') {
    const result = document.getElementById('couponResult');
    if (result) {
      result.textContent = message;
      result.className = 'coupon-result ' + (type === 'error' ? 'error' : 'success');
    }
  }

  function isCouponActive(c) {
    const v = c?.active;
    if (v === false || v === 0) return false;

    const s = String(v ?? '').trim().toLowerCase();
    if (['0', 'false', 'no', 'off', 'disabled', 'لا', 'متوقف'].includes(s)) {
      return false;
    }

    return true;
  }

  function couponStatus(c) {
    if (!isCouponActive(c)) return 'disabled';

    const now = Date.now();
    const startRaw = c.start_at || c.start || '';
    const endRaw = c.end_at || c.end || '';
    const start = startRaw ? new Date(startRaw).getTime() : 0;
    const end = endRaw ? new Date(endRaw).getTime() : 0;

    if (start && !isNaN(start) && now < start) return 'scheduled';
    if (end && !isNaN(end) && now > end) return 'expired';

    return 'active';
  }

  function applyCouponsToStore(coupons) {
    remoteCoupons = {};

    (coupons || []).forEach(c => {
      const code = String(c.code || '').trim().toUpperCase();
      if (!code) return;

      const active = isCouponActive(c);
      const status = couponStatus(c);

      remoteCoupons[code] = {
        ...c,
        code,
        active,
        status,
        start: c.start || c.start_at || '',
        end: c.end || c.end_at || ''
      };
    });

    window.STORE_CONFIG = window.STORE_CONFIG || {};
    window.STORE_CONFIG.coupons = {};

    Object.values(remoteCoupons).forEach(c => {
      if (c.status === 'active' && c.active) {
        window.STORE_CONFIG.coupons[c.code] = {
          type: c.type,
          value: Number(c.value || 0),
          min: Number(c.min || 0),
          active: true,
          start: c.start || '',
          end: c.end || ''
        };
      }
    });

    couponsReady = true;
  }

  function loadCachedCoupons() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !Array.isArray(cached.coupons)) return false;

      applyCouponsToStore(cached.coupons);
      lastRemoteRefresh = Number(cached.savedAt || 0);
      return true;
    } catch (error) {
      console.warn('Coupons cache read error:', error);
      return false;
    }
  }

  function saveCouponsCache(coupons) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          coupons: coupons || []
        })
      );
    } catch (error) {
      console.warn('Coupons cache save error:', error);
    }
  }

  function cacheIsFresh() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return !!(
        cached &&
        Number(cached.savedAt) &&
        Date.now() - Number(cached.savedAt) < CACHE_MAX_AGE
      );
    } catch (_) {
      return false;
    }
  }

  function shouldRefreshForCart() {
    return !lastRemoteRefresh || (Date.now() - lastRemoteRefresh >= CART_REFRESH_AGE);
  }

  async function loadRemoteCoupons({ force = false } = {}) {
    if (refreshPromise) return refreshPromise;

    if (!force && couponsReady && cacheIsFresh()) {
      return remoteCoupons;
    }

    refreshPromise = (async () => {
      try {
        const res = await fetch(
          `${SCRIPT_URL}?action=coupons&t=${Date.now()}`,
          { cache: 'no-store' }
        );

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || data.error || 'تعذر تحميل الكوبونات');
        }

        const coupons = data.coupons || [];
        applyCouponsToStore(coupons);
        saveCouponsCache(coupons);
        lastRemoteRefresh = Date.now();

        return remoteCoupons;
      } catch (error) {
        console.error('Coupons sync error:', error);

        if (!couponsReady) {
          window.STORE_CONFIG = window.STORE_CONFIG || {};
          window.STORE_CONFIG.coupons = window.STORE_CONFIG.coupons || {};
        }

        throw error;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  function refreshCouponsInBackground() {
    if (!shouldRefreshForCart()) return;
    loadRemoteCoupons({ force: true }).catch(() => {});
  }

  function explainCoupon(code) {
    const c = remoteCoupons[code];
    if (!c) return 'الكوبون غير صحيح';
    if (c.status === 'expired') return 'انتهت صلاحية هذا الكوبون';
    if (c.status === 'scheduled') return 'هذا الكوبون لم يبدأ بعد';
    if (c.status === 'disabled' || !c.active) return 'هذا الكوبون متوقف حالياً';
    return '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.STORE_CONFIG = window.STORE_CONFIG || {};
    window.STORE_CONFIG.coupons = window.STORE_CONFIG.coupons || {};

    loadCachedCoupons();
    loadRemoteCoupons({ force: true }).catch(() => {});

    const button = document.getElementById('applyCouponBtn');
    const input = document.getElementById('couponInput');

    ['cartBtn', 'bottomCartBtn'].forEach(id => {
      const cartButton = document.getElementById(id);
      if (cartButton) {
        cartButton.addEventListener('click', refreshCouponsInBackground, { passive: true });
      }
    });

    if (!button || !input) return;

    const original = button.onclick;

    button.onclick = async event => {
      const code = input.value.trim().toUpperCase();

      if (!couponsReady) {
        try {
          await loadRemoteCoupons({ force: true });
        } catch (_) {
          showMessage('تعذر التحقق من الكوبون حالياً، حاول مرة أخرى', 'error');
          return;
        }
      }

      const reason = explainCoupon(code);
      if (reason) {
        event?.preventDefault?.();
        showMessage(reason, 'error');

        const totals = document.getElementById('couponTotals');
        if (totals) {
          totals.hidden = true;
          totals.innerHTML = '';
        }
        return;
      }

      if (typeof original === 'function') {
        original.call(button, event);
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !cacheIsFresh()) {
        loadRemoteCoupons({ force: true }).catch(() => {});
      }
    });
  });
})();