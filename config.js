window.STORE_CONFIG = {
  storeName: "زهرة بيوتي",
  apiUrl: "https://script.google.com/macros/s/AKfycbzAnGmxXNDdEmh2OeYIF5qX73rRxXFNE3_75WG9IEYD8hlj4cWdbkVla-uTuIUqcYS1/exec",
  whatsapp: "9647765008600",
  sheetCsvUrl: "https://script.google.com/macros/s/AKfycbzAnGmxXNDdEmh2OeYIF5qX73rRxXFNE3_75WG9IEYD8hlj4cWdbkVla-uTuIUqcYS1/exec?action=products_csv",
  currency: "د.ع",
  locale: "ar-IQ",
  logo: "./logo.png",
  instagram: "https://www.instagram.com/zahra_beauty.story/",
  cacheKey: "zahra_products_v1",
  coupons: {
    "AMEER10": { type:"percent", value:10, min:0, active:true }
  },
  demoProducts: []
};

/* تحميل إصلاح حفظ القسم الفرعي في صفحة الإدارة فقط */
if (/(^|\/)admin\.html$/i.test(location.pathname)) {
  const adminFix = document.createElement('script');
  adminFix.src = './admin-fix.js?v=2';
  adminFix.defer = true;
  document.head.appendChild(adminFix);
}

/* =========================
   STORE EXTRAS: INSTAGRAM + FAVORITES + COUPONS
========================= */
(() => {
  const instagramUrl = window.STORE_CONFIG.instagram;
  const instagramIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4.25"></circle><circle cx="17.4" cy="6.7" r="1"></circle></svg>`;
  const favKey = 'zahra_favorites_v1';
  let favorites = new Set(JSON.parse(localStorage.getItem(favKey) || '[]').map(String));
  let activeCoupon = null;

  function notice(message){
    const t=document.getElementById('toast'); if(!t)return;
    t.textContent=message;t.classList.add('show');clearTimeout(t._extraTimer);
    t._extraTimer=setTimeout(()=>t.classList.remove('show'),3000);
  }
  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true}catch(_){
      try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok}catch(__){return false}
    }
  }
  function captureCheckoutMessage(form){
    if(typeof checkout!=='function')return '';
    let captured='';const original=window.open;
    try{window.open=url=>{captured=String(url||'');return null};checkout({preventDefault(){},currentTarget:form})}finally{window.open=original}
    if(!captured)return '';
    try{return new URL(captured).searchParams.get('text')||''}catch(_){return ''}
  }
  function addInstagram(){
    const top=document.querySelector('.topbar-inner'),cart=document.getElementById('cartBtn');
    if(top&&!document.getElementById('instagramHeaderBtn')){
      const a=document.createElement('a');a.id='instagramHeaderBtn';a.className='instagram-header-btn';a.href=instagramUrl;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','إنستغرام زهرة بيوتي');a.innerHTML=instagramIcon;a.addEventListener('click',e=>{e.preventDefault();location.href=instagramUrl;});
      if(cart)top.insertBefore(a,cart);else top.appendChild(a);
    }
    const form=document.getElementById('checkoutForm');
    if(form&&!document.getElementById('instagramCopyBtn')){
      const wa=form.querySelector('.checkout-button'),wrap=document.createElement('div');wrap.className='instagram-order-tools';
      wrap.innerHTML=`<button type="button" id="instagramCopyBtn" class="instagram-copy-button">${instagramIcon}<span>نسخ الطلب للإنستغرام</span></button><a class="instagram-open-button" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">فتح إنستغرام ولصق الطلب</a>`;
      wrap.querySelector('#instagramCopyBtn').onclick=async()=>{if(!form.reportValidity())return;let msg=captureCheckoutMessage(form);if(activeCoupon&&msg)msg=applyCouponToMessage(msg);if(!msg){notice('تعذر تجهيز الطلب');return}notice(await copyText(msg)?'تم نسخ الطلب ✓ افتح إنستغرام والصقه':'تعذر النسخ تلقائياً')};
      if(wa)wa.insertAdjacentElement('afterend',wrap);else form.appendChild(wrap);
    }
  }

  function saveFavs(){localStorage.setItem(favKey,JSON.stringify([...favorites]));updateFavUI()}
  function updateFavUI(){
    document.querySelectorAll('[data-favorite-id]').forEach(b=>{
      const on=favorites.has(String(b.dataset.favoriteId));
      b.classList.toggle('active',on);
      b.innerHTML=on?'♥':'♡';
      b.setAttribute('aria-label',on?'إزالة من المفضلة':'إضافة إلى المفضلة');
    });
    const c=document.getElementById('favoritesCount');if(c&&c.textContent!==String(favorites.size))c.textContent=favorites.size;
  }
  function decorateProducts(){
    document.querySelectorAll('.product-card').forEach(card=>{
      if(card.querySelector('[data-favorite-id]'))return;
      const open=card.querySelector('[data-open-product]');if(!open)return;
      const id=open.getAttribute('data-open-product');
      const b=document.createElement('button');
      b.type='button';
      b.className='favorite-btn';
      b.dataset.favoriteId=id;
      b.innerHTML=favorites.has(String(id))?'♥':'♡';
      b.setAttribute('aria-label','إضافة إلى المفضلة');
      b.setAttribute('data-no-open-product','true');
      card.appendChild(b);
    });updateFavUI();
  }
  function addFavoritesHeader(){
    const top=document.querySelector('.topbar-inner');if(!top||document.getElementById('favoritesHeaderBtn'))return;
    const b=document.createElement('button');b.type='button';b.id='favoritesHeaderBtn';b.className='favorites-header-btn';b.innerHTML=`♥<b id="favoritesCount">${favorites.size}</b>`;b.setAttribute('aria-label','المفضلة');
    b.onclick=()=>{
      if(!favorites.size){notice('لم تضف منتجات إلى المفضلة بعد');return}
      if(typeof state!=='undefined'){state.category='الكل';state.brand='الكل';state.offersOnly=false;state.search='';}
      document.querySelectorAll('.product-card').forEach(card=>{const id=card.querySelector('[data-open-product]')?.getAttribute('data-open-product');card.style.display=favorites.has(String(id))?'':'none'});
      document.getElementById('products')?.scrollIntoView({behavior:'smooth'});notice(`المفضلة: ${favorites.size} منتج`);
    };
    top.appendChild(b);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-favorite-id]');
    if(!b)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const id=String(b.dataset.favoriteId);
    favorites.has(id)?favorites.delete(id):favorites.add(id);
    saveFavs();
    notice(favorites.has(id)?'تمت الإضافة إلى المفضلة ♥':'تمت الإزالة من المفضلة');
  },true);

  function cartSubtotal(){
    try{return cartData().reduce((s,x)=>s+(Number(x.p.price)||0)*x.qty,0)}catch(_){return 0}
  }
  function couponDiscount(total){if(!activeCoupon)return 0;return activeCoupon.type==='percent'?Math.round(total*activeCoupon.value/100):Math.min(total,activeCoupon.value)}
  function renderCouponTotals(){
    const box=document.getElementById('couponTotals');
    if(!box)return;
    const total=cartSubtotal();
    if(!activeCoupon){box.hidden=true;box.innerHTML='';return}
    const discount=couponDiscount(total),final=Math.max(0,total-discount);
    box.hidden=false;
    box.innerHTML=`
      <div><span>المجموع قبل الخصم</span><strong>${total.toLocaleString('en-US')} د.ع</strong></div>
      <div class="discount"><span>خصم الكوبون</span><strong>- ${discount.toLocaleString('en-US')} د.ع</strong></div>
      <div class="final"><span>المجموع بعد الخصم</span><strong>${final.toLocaleString('en-US')} د.ع</strong></div>`;
  }
  function applyCouponToMessage(msg){
    const total=cartSubtotal(),discount=couponDiscount(total),final=Math.max(0,total-discount);
    return `${msg}\n\nكوبون الخصم: ${activeCoupon.code}\nخصم الكوبون: ${discount.toLocaleString('en-US')} د.ع\nالإجمالي النهائي بعد الكوبون: ${final.toLocaleString('en-US')} د.ع`;
  }
  function addCouponBox(){
    const form=document.getElementById('checkoutForm');if(!form||document.getElementById('couponBox'))return;
    const firstButton=form.querySelector('.checkout-button');const box=document.createElement('div');box.id='couponBox';box.className='coupon-box';box.innerHTML=`<label>🎟️ هل لديك كوبون خصم؟</label><div class="coupon-row"><input id="couponInput" type="text" placeholder="أدخل كود الخصم" autocomplete="off"><button type="button" id="applyCouponBtn">تطبيق</button></div><div id="couponResult" class="coupon-result"></div><div id="couponTotals" class="coupon-totals" hidden></div>`;
    if(firstButton)form.insertBefore(box,firstButton);else form.appendChild(box);
    box.querySelector('#applyCouponBtn').onclick=()=>{
      const code=box.querySelector('#couponInput').value.trim().toUpperCase(),cp=window.STORE_CONFIG.coupons?.[code],total=cartSubtotal(),result=box.querySelector('#couponResult');
      if(!cp||cp.active===false){activeCoupon=null;result.textContent='الكوبون غير صحيح أو غير فعال';result.className='coupon-result error';renderCouponTotals();return}
      if(total<Number(cp.min||0)){activeCoupon=null;result.textContent=`الحد الأدنى لاستخدام الكوبون ${Number(cp.min).toLocaleString('en-US')} د.ع`;result.className='coupon-result error';renderCouponTotals();return}
      activeCoupon={...cp,code};const d=couponDiscount(total),final=Math.max(0,total-d);result.textContent=`✓ تم تطبيق ${code} — وفرت ${d.toLocaleString('en-US')} د.ع`;result.className='coupon-result success';renderCouponTotals();notice(`تم الخصم ✓ المجموع الآن ${final.toLocaleString('en-US')} د.ع`);
    };
    form.addEventListener('submit',e=>{
      if(!activeCoupon)return;
      e.preventDefault();let msg=captureCheckoutMessage(form);if(!msg)return;msg=applyCouponToMessage(msg);window.open(`https://wa.me/${window.STORE_CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
    },true);
  }

  function styles(){
    if(document.getElementById('storeExtrasStyles'))return;const s=document.createElement('style');s.id='storeExtrasStyles';s.textContent=`
    .topbar-inner{position:relative}.instagram-header-btn{position:absolute;left:50px;top:50%;transform:translateY(-50%);width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:12px;text-decoration:none;color:#171512;background:#fff;border:1px solid rgba(23,21,18,.1);z-index:2}.instagram-header-btn svg,.instagram-copy-button svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8}.favorites-header-btn{position:absolute;left:94px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:12px;border:1px solid rgba(23,21,18,.1);background:#fff;font-size:22px;line-height:1;color:#b68b3d;z-index:2}.favorites-header-btn b{position:absolute;top:-5px;left:-5px;min-width:18px;height:18px;border-radius:10px;background:#b68b3d;color:#fff;font-size:10px;display:grid;place-items:center}.product-card{position:relative}.favorite-btn{position:absolute;top:12px;left:12px;width:34px;height:34px;border:0;border-radius:10px;background:rgba(17,16,14,.78);color:#fff;font-size:21px;display:flex;align-items:center;justify-content:center;z-index:12;box-shadow:0 6px 16px rgba(0,0,0,.15);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.favorite-btn.active{background:#b68b3d;color:#fff}.favorite-btn:active{transform:scale(.92)}.instagram-order-tools{margin-top:10px;display:grid;gap:8px}.instagram-copy-button{width:100%;min-height:50px;border:0;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:9px;font:inherit;font-weight:800;color:#fff;background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)}.instagram-open-button{min-height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-weight:800;color:#171512;background:#fff;border:1px solid rgba(23,21,18,.12)}.coupon-box{margin:14px 0;padding:13px;border:1px solid rgba(182,139,61,.25);background:#fffaf0;border-radius:16px}.coupon-box label{display:block;font-weight:800;margin-bottom:8px}.coupon-row{display:flex;gap:8px}.coupon-row input{min-width:0;flex:1;text-transform:uppercase}.coupon-row button{border:0;border-radius:12px;padding:0 16px;background:#171512;color:#fff;font-weight:800}.coupon-result{font-size:13px;margin-top:7px}.coupon-result.success{color:#177245}.coupon-result.error{color:#a52a2a}.coupon-totals{margin-top:12px;padding-top:10px;border-top:1px dashed rgba(182,139,61,.35);display:grid;gap:7px}.coupon-totals[hidden]{display:none}.coupon-totals>div{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px}.coupon-totals .discount{color:#177245}.coupon-totals .final{margin-top:2px;padding:10px 12px;border-radius:12px;background:#171512;color:#fff;font-size:16px}.coupon-totals .final strong{font-size:18px;color:#e3c47c}

    /* Sold-out products: make the state unmistakable */
    .product-card:has(.add-btn:disabled) .product-image{filter:grayscale(100%)!important;opacity:.42!important;transition:filter .2s ease,opacity .2s ease}
    .product-card:has(.add-btn:disabled) .product-image-wrap{background:#f1f1f1!important}
    .product-card:has(.add-btn:disabled) .offer-pill{background:#8f8f8f!important;color:#fff!important;border-color:#8f8f8f!important}
    .product-card:has(.add-btn:disabled) .add-btn{background:#b8b8b8!important;color:#fff!important;cursor:not-allowed!important;opacity:1!important}
    .product-card:has(.add-btn:disabled){background:#fbfbfb}

    @media(max-width:520px){.instagram-header-btn{left:46px;width:36px;height:36px}.favorites-header-btn{left:88px;width:36px;height:36px}.favorite-btn{top:10px;left:10px;width:32px;height:32px;font-size:20px}}
    `;document.head.appendChild(s)
  }

  document.addEventListener('DOMContentLoaded',()=>{
    styles();addInstagram();addFavoritesHeader();addCouponBox();decorateProducts();
    const grid=document.getElementById('productsGrid');
    if(grid){
      const observer=new MutationObserver(()=>decorateProducts());
      observer.observe(grid,{childList:true});
    }
  });
})();
