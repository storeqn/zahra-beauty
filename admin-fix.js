/* زهرة بيوتي - تثبيت حفظ القسم الفرعي في صفحة الإدارة */
(() => {
  const isAdmin = /(^|\/)admin\.html$/i.test(location.pathname) || document.title.includes('إدارة المتجر');
  if (!isAdmin) return;

  const pending = new Map();

  function val(id){
    return document.getElementById(id)?.value?.trim?.() || '';
  }

  function snapshot(){
    const id = typeof editingId !== 'undefined' ? String(editingId || '').trim() : val('productId');
    return {
      id,
      name: val('name'),
      price: val('price'),
      old_price: val('old_price'),
      stock: val('stock'),
      category: val('category'),
      sub_category: val('sub_category'),
      brand: val('brand'),
      image: val('image'),
      images: val('images'),
      desc: val('desc'),
      discount_note: val('discount_note'),
      offer: document.getElementById('offer')?.checked ? 'نعم' : '',
      featured: document.getElementById('featured')?.checked ? 'نعم' : ''
    };
  }

  function mergePendingIntoProducts(){
    if (typeof products === 'undefined' || !Array.isArray(products)) return;
    pending.forEach((saved, id) => {
      const p = products.find(x => String(x.id || '').trim() === String(id));
      if (!p) return;
      // لا تسمح لنسخة CSV قديمة بمسح القسم الفرعي الذي حُفظ للتو.
      if (saved.sub_category) p.sub_category = saved.sub_category;
      if (saved.category) p.category = saved.category;
      if (saved.brand) p.brand = saved.brand;
      if (saved.stock !== '') p.stock = saved.stock;
    });
  }

  function restoreEditField(){
    const id = typeof editingId !== 'undefined' ? String(editingId || '').trim() : val('productId');
    if (!id || !pending.has(id)) return;
    const saved = pending.get(id);
    const sub = document.getElementById('sub_category');
    if (sub && !sub.value.trim() && saved.sub_category) sub.value = saved.sub_category;
  }

  window.addEventListener('load', () => {
    const form = document.getElementById('productForm');
    const list = document.getElementById('productsList');
    if (!form) return;

    // نلتقط القيم قبل أن يقوم الكود الأصلي بتصفير النموذج.
    form.addEventListener('submit', () => {
      const data = snapshot();
      if (data.id) pending.set(data.id, data);

      // إذا رجعت نسخة CSV القديمة بعد الحفظ، أعد دمج القيمة الصحيحة محلياً.
      setTimeout(() => {
        mergePendingIntoProducts();
        try {
          if (typeof renderProducts === 'function') renderProducts();
          if (typeof updateSuggestions === 'function') updateSuggestions();
        } catch (_) {}
      }, 900);

      setTimeout(() => {
        mergePendingIntoProducts();
        try {
          if (typeof renderProducts === 'function') renderProducts();
        } catch (_) {}
      }, 2500);
    }, true);

    // عند فتح المنتج من جديد، لا تسمح للـ CSV القديم بإظهار القسم الفرعي فارغاً.
    list?.addEventListener('click', () => {
      setTimeout(restoreEditField, 30);
      setTimeout(restoreEditField, 250);
    }, true);

    // استبدال التحديث الصامت بنسخة تنتظر تحديث Google Sheets ولا تمسح القسم الفرعي.
    setTimeout(() => {
      try {
        if (typeof refreshProductsSilently === 'function' && typeof fetchProductsData === 'function') {
          refreshProductsSilently = async function(){
            let newest = null;
            for (let attempt = 0; attempt < 4; attempt++) {
              try {
                newest = await fetchProductsData();
                if (Array.isArray(newest)) {
                  products = newest;
                  mergePendingIntoProducts();
                  products.forEach(p => {
                    try { rememberSubcategory(p.category, p.sub_category); } catch (_) {}
                  });
                  try { updateSuggestions(); } catch (_) {}
                  try { renderProducts(); } catch (_) {}
                }
              } catch (e) {
                console.warn('Admin refresh retry', e);
              }
              if (attempt < 3) await new Promise(r => setTimeout(r, 900));
            }
          };
        }
      } catch (e) {
        console.warn('Admin subcategory fix could not patch refresh', e);
      }
    }, 0);
  });
})();
