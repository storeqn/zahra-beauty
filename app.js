const C = window.STORE_CONFIG;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const firstEl = (...selectors) =>
  selectors.map(s => $(s)).find(Boolean) || null;


/* =========================
   STATE
========================= */

const state = {

  products: [],

  cart: JSON.parse(
    localStorage.getItem('alameer_cart_v2') || '[]'
  ),

  category: 'الكل',

  brand: 'الكل',

  search: '',

  offersOnly: false,

  sort: 'default',

  openProductId: null

};


/* =========================
   HELPERS
========================= */

const money = v =>
  `${Number(v || 0).toLocaleString('en-US')} د.ع`;


const norm = v =>
  String(v ?? '').trim();


const truthy = v =>
  [
    '1',
    'true',
    'yes',
    'y',
    'نعم',
    'عرض',
    'offer',
    'مميز',
    'featured'
  ].includes(
    norm(v).toLowerCase()
  );


const esc = s =>
  String(s ?? '').replace(
    /[&<>'"]/g,
    c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      "'":'&#39;',
      '"':'&quot;'
    }[c])
  );


const byId = id =>
  state.products.find(
    p =>
      String(p.id) ===
      String(id)
  );


/* =========================
   CSV
========================= */

function parseCSV(text){

  const rows = [];

  let row = [];
  let cell = '';
  let quote = false;


  for(
    let i = 0;
    i < text.length;
    i++
  ){

    const ch = text[i];
    const nx = text[i + 1];


    if(
      ch === '"' &&
      quote &&
      nx === '"'
    ){

      cell += '"';

      i++;

    }

    else if(
      ch === '"'
    ){

      quote = !quote;

    }

    else if(
      ch === ',' &&
      !quote
    ){

      row.push(cell);

      cell = '';

    }

    else if(
      (
        ch === '\n' ||
        ch === '\r'
      ) &&
      !quote
    ){

      if(
        ch === '\r' &&
        nx === '\n'
      ){

        i++;

      }


      row.push(cell);

      cell = '';


      if(
        row.some(
          x =>
            x.trim() !== ''
        )
      ){

        rows.push(row);

      }


      row = [];

    }

    else{

      cell += ch;

    }

  }


  row.push(cell);


  if(
    row.some(
      x =>
        x.trim() !== ''
    )
  ){

    rows.push(row);

  }


  if(
    !rows.length
  ){

    return [];

  }


  const headers =
    rows
      .shift()
      .map(
        h =>
          h
            .trim()
            .toLowerCase()
      );


  return rows.map(
    r =>
      Object.fromEntries(
        headers.map(
          (h, i) => [

            h,

            (r[i] ?? '')
              .trim()

          ]
        )
      )
  );

}


/* =========================
   PRODUCT NORMALIZE
========================= */

function normalizeProduct(r, idx){

  const imagesRaw =

    r.images ||

    r.image_urls ||

    r.gallery ||

    '';


  const images = [

    r.image,

    ...imagesRaw.split(
      /\s*[|;\n]\s*/
    )

  ]

  .map(norm)

  .filter(Boolean);


  const uniqImages =
    [...new Set(images)];


  const price =
    Number(
      String(
        r.price || 0
      )
      .replace(
        /[^\d.]/g,
        ''
      )
    ) || 0;


  const oldPrice =
    Number(
      String(

        r.old_price ||

        r.oldprice ||

        0

      )

      .replace(
        /[^\d.]/g,
        ''
      )
    ) || 0;


  const offer =

    truthy(
      r.offer
    )

    ||

    truthy(
      r.is_offer
    )

    ||

    (
      oldPrice > price &&
      price > 0
    )

    ||

    !!norm(
      r.discount_note
    );


  /*
    المنتجات القديمة التي لا تحتوي
    stock تعتبر متوفرة مؤقتاً
  */

  const rawStock =
    norm(r.stock);


  const stock =

    rawStock === ''

    ? 999999

    : Math.max(

        0,

        Number(
          rawStock
        ) || 0

      );


  return {

    id:

      norm(r.id) ||

      `p${idx + 1}`,


    name:

      norm(r.name) ||

      'منتج',


    price,


    old_price:
      oldPrice,


    offer,


    discount_note:
      norm(
        r.discount_note
      ),


    images:

      uniqImages.length

      ? uniqImages

      : [
          'assets/logo.png'
        ],


    category:

      norm(
        r.category
      )

      ||

      'أخرى',


    brand:

      norm(
        r.brand
      )

      ||

      '',


    featured:

      truthy(
        r.featured
      ),


    stock,


    desc:

      norm(

        r.desc ||

        r.description

      ),


    active:

      r.active === ''

      ? true

      : ![
          '0',
          'false',
          'no',
          'لا'
        ]
        .includes(
          norm(
            r.active
          )
          .toLowerCase()
        )

  };

}


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts(){

  const loading =
    $('#loadingCard');


  if(
    loading
  ){

    loading.hidden =
      false;

  }


  try{


    if(
      !C?.sheetCsvUrl
    ){

      throw new Error(
        'sheetCsvUrl missing'
      );

    }


    const separator =

      C.sheetCsvUrl.includes('?')

      ? '&'

      : '?';


    const res =
      await fetch(

        `${C.sheetCsvUrl}${separator}_=${Date.now()}`,

        {
          cache:'no-store'
        }

      );


    if(
      !res.ok
    ){

      throw new Error(
        'تعذر قراءة الشيت'
      );

    }


    const text =
      await res.text();


    const rows =

      parseCSV(text)

      .map(
        normalizeProduct
      )

      .filter(
        p => p.active
      );


    if(
      !rows.length
    ){

      throw new Error(
        'لا توجد منتجات'
      );

    }


    state.products =
      rows;


    localStorage.setItem(

      C.cacheKey ||

      'zahra_products_v1',

      JSON.stringify(
        rows
      )

    );

  }

  catch(error){


    console.error(
      'Products error:',
      error
    );


    let cached = [];


    try{

      cached =
        JSON.parse(

          localStorage.getItem(

            C?.cacheKey ||

            'zahra_products_v1'

          )

          ||

          '[]'

        );

    }

    catch(_){

      cached = [];

    }


    state.products =

      cached.length

      ? cached

      : demoProducts;


    if(
      !cached.length
    ){

      toast(
        'تعذر تحميل المنتجات من الشيت'
      );

    }

  }


  if(
    loading
  ){

    loading.hidden =
      true;

  }


  renderAll();

  renderBrandShowcase();

}


/* =========================
   DEMO
========================= */

const demoProducts = [

  {

    id:'demo1',

    name:'منتج تجريبي',

    price:0,

    old_price:0,

    offer:false,

    discount_note:'',

    images:[
      'assets/logo.png'
    ],

    category:'أخرى',

    brand:'AB',

    featured:true,

    stock:10,

    desc:'منتج تجريبي.'

  }

];


/* =========================
   CATEGORIES
========================= */

function categories(){

  return [

    ...new Set(

      state.products

      .map(
        p =>
          p.category
      )

      .filter(Boolean)

    )

  ];

}


/* =========================
   BRANDS
========================= */

function brands(){

  return [

    ...new Set(

      state.products

      .map(
        p =>
          p.brand
      )

      .filter(Boolean)

    )

  ]

  .sort(
    (a,b) =>
      a.localeCompare(
        b,
        'ar'
      )
  );

}


/* =========================
   HOME BRAND LOGOS
========================= */

const BRANDS_API_URL =
  C?.apiUrl ||
  'https://script.google.com/macros/s/AKfycbwxFs75do4gJ941Agg0x6432z18qPjqkZ0ucutOCkaH-keZfDGP_xCPRhawbVXLIw8Y/exec';

let brandLogoItems = [];

function renderBrandShowcase(){

  const section =
    $('#brandShowcase');

  const track =
    $('#brandShowcaseTrack');

  if(!section || !track){
    return;
  }

  const productBrandNames =
    new Set(
      state.products
        .map(p => norm(p.brand).toLowerCase())
        .filter(Boolean)
    );

  const visibleBrands =
    brandLogoItems
      .filter(b =>
        b.name &&
        b.logo &&
        productBrandNames.has(
          norm(b.name).toLowerCase()
        )
      )
      .sort((a,b) =>
        a.name.localeCompare(b.name,'ar')
      );

  if(!visibleBrands.length){
    section.hidden = true;
    track.innerHTML = '';
    return;
  }

  track.innerHTML =
    visibleBrands
      .map(b => `
        <button
          type="button"
          class="brand-logo-card"
          data-brand-strip="${esc(b.name)}"
          aria-label="عرض منتجات ${esc(b.name)}"
          title="${esc(b.name)}"
        >
          <img
            src="${esc(b.logo)}"
            alt="${esc(b.name)}"
            loading="lazy"
            decoding="async"
            onerror="this.closest('.brand-logo-card').style.display='none'"
          >
        </button>
      `)
      .join('');

  section.hidden = false;
}

async function loadBrandShowcase(){

  try{

    const separator =
      BRANDS_API_URL.includes('?')
      ? '&'
      : '?';

    const res =
      await fetch(
        `${BRANDS_API_URL}${separator}action=brands&_=${Date.now()}`,
        { cache:'no-store' }
      );

    if(!res.ok){
      throw new Error('brands request failed');
    }

    const data =
      await res.json();

    brandLogoItems =
      Array.isArray(data?.brands)
      ? data.brands.map(b => ({
          name:norm(b?.name),
          logo:norm(b?.logo)
        }))
      : [];

    renderBrandShowcase();

  }
  catch(error){
    console.warn('Brands strip:',error);
    renderBrandShowcase();
  }
}


/* =========================
   FILTERED PRODUCTS
========================= */

function filtered(){

  const q =

    state.search

    .toLowerCase()

    .trim();


  let arr =

    state.products.filter(
      p => {


        const offerOk =

          !state.offersOnly ||

          p.offer;


        const categoryOk =

          state.category === 'الكل'

          ||

          p.category ===
            state.category;


        const brandOk =

          state.brand === 'الكل'

          ||

          p.brand ===
            state.brand;


        const searchText = `

          ${p.name || ''}

          ${p.category || ''}

          ${p.brand || ''}

          ${p.desc || ''}

        `

        .toLowerCase();


        const searchOk =

          !q ||

          searchText.includes(q);


        return (

          offerOk &&

          categoryOk &&

          brandOk &&

          searchOk

        );

      }
    );


  if(
    state.sort ===
    'price-low'
  ){

    arr.sort(
      (a,b) =>
        Number(
          a.price || 0
        )
        -
        Number(
          b.price || 0
        )
    );

  }


  if(
    state.sort ===
    'price-high'
  ){

    arr.sort(
      (a,b) =>
        Number(
          b.price || 0
        )
        -
        Number(
          a.price || 0
        )
    );

  }


  if(
    state.sort ===
    'name'
  ){

    arr.sort(
      (a,b) =>
        a.name.localeCompare(
          b.name,
          'ar'
        )
    );

  }


  return arr;

}


/* =========================
   QTY CONTROL
========================= */

function qtyControl(
  id,
  qty
){

  const product =
    byId(id);


  const maxed =

    product &&

    qty >=
      product.stock;


  return `

    <div class="qty-control">


      <button
        type="button"
        data-dec="${esc(id)}">

        −

      </button>


      <span>

        ${qty}

      </span>


      <button
        type="button"
        data-inc="${esc(id)}"
        ${maxed ? 'disabled' : ''}>

        +

      </button>


    </div>

  `;

}


/* =========================
   PRODUCT CARD
========================= */

function productCard(
  p,
  index = 99
){

  const qty =
    cartQty(
      p.id
    );


  const soldOut =
    p.stock <= 0;


  return `

  <article class="product-card">


    <div
      class="product-image-wrap"
      data-open-product="${esc(p.id)}">


      <img

        class="product-image"

        src="${esc(p.images[0])}"

        alt="${esc(p.name)}"

        loading="${
          index < 4
          ? 'eager'
          : 'lazy'
        }"

        decoding="async"

        fetchpriority="${
          index < 4
          ? 'high'
          : 'low'
        }"

        onerror="this.onerror=null;this.src='assets/logo.png'"

      >


      ${
        soldOut

        ? `

          <span class="offer-pill">

            نفذت الكمية

          </span>

        `

        : p.offer

          ? `

            <span class="offer-pill">

              ${esc(
                p.discount_note ||
                'عرض'
              )}

            </span>

          `

          : ''
      }


      ${
        p.images.length > 1

        ? `

          <span class="image-count">

            📷 ${p.images.length}

          </span>

        `

        : ''
      }


    </div>


    <div class="product-body">


      <div class="product-meta">

        ${esc(

          [
            p.category,
            p.brand
          ]

          .filter(Boolean)

          .join(' • ')

        )}

      </div>


      <h3
        class="product-title"
        data-open-product="${esc(p.id)}">

        ${esc(p.name)}

      </h3>


      ${
        p.desc

        ? `

          <p class="product-desc">

            ${esc(p.desc)}

          </p>

        `

        : ''
      }


      ${
        p.price > 0

        ? `

          <div class="price-row">


            <span class="price">

              ${money(
                p.price
              )}

            </span>


            ${
              p.old_price > p.price

              ? `

                <span class="old-price">

                  ${money(
                    p.old_price
                  )}

                </span>

              `

              : ''
            }


          </div>

        `

        : ''
      }


      <div class="product-actions">


        ${
          soldOut

          ? `

            <button
              type="button"
              class="add-btn"
              disabled>

              نفذت الكمية

            </button>

          `

          : qty

            ? qtyControl(
                p.id,
                qty
              )

            : `

              <button
                type="button"
                class="add-btn"
                data-add="${esc(p.id)}">

                أضف للسلة

              </button>

            `
        }


        <button

          type="button"

          class="details-btn"

          data-open-product="${esc(p.id)}">

          التفاصيل

        </button>


      </div>


    </div>


  </article>

  `;

}


/* =========================
   RENDER CATEGORIES
========================= */

function renderCategories(){

  const grid =
    $('#categoryGrid');

  if(!grid){
    return;
  }

  const cats =
    categories();

  grid.innerHTML = `

    <button
      type="button"
      class="category-card ${
        state.category === 'الكل'
          ? 'active'
          : ''
      }"
      data-category="الكل">

      <div class="category-logo-wrap">
        <img
          src="assets/logo.png"
          alt="زهرة بيوتي"
          class="category-logo">
      </div>

      <strong class="category-name">
        كل الأقسام
      </strong>

      <small class="category-count">
        ${state.products.length} منتج
      </small>

    </button>


    ${cats.map(c => {

      const count =
        state.products.filter(
          p => p.category === c
        ).length;

      return `

        <button
          type="button"
          class="category-card ${
            state.category === c
              ? 'active'
              : ''
          }"
          data-category="${esc(c)}">

          <div class="category-logo-wrap">

            <img
              src="assets/logo.png"
              alt="${esc(c)}"
              class="category-logo">

          </div>

          <strong class="category-name">
            ${esc(c)}
          </strong>

          <small class="category-count">
            ${count} منتج
          </small>

        </button>

      `;

    }).join('')}

  `;
}


/* =========================
   FEATURED
========================= */

function getFeaturedSection(){

  return firstEl(

    '#featured',

    '#featuredSection',

    '#selectedProducts',

    '#recommended'

  );

}


function getFeaturedGrid(){

  return firstEl(

    '#featuredGrid',

    '#featuredProductsGrid',

    '#selectedGrid',

    '#selectedProductsGrid',

    '#recommendedGrid'

  )

  ||

  getFeaturedSection()
    ?.querySelector(
      '.product-grid'
    );

}


function renderFeatured(){

  const section =
    getFeaturedSection();


  const grid =
    getFeaturedGrid();


  if(
    !grid
  ){

    return;

  }


  const arr =

    state.products

    .filter(
      p =>
        p.featured
    )

    .slice(
      0,
      8
    );


  grid.innerHTML =

    arr

    .map(
      productCard
    )

    .join('');


  const empty =
    firstEl(

      '#featuredEmpty',

      '#selectedEmpty',

      '#recommendedEmpty'

    );


  if(
    empty
  ){

    empty.hidden =
      !!arr.length;

  }


  if(
    section
  ){

    section.hidden =
      !arr.length;

  }

}


/* =========================
   OFFERS
========================= */

function renderOffers(){

  const grid =
    $('#offersGrid');


  const empty =
    $('#offersEmpty');


  if(
    !grid
  ){

    return;

  }


  const arr =

    state.products

    .filter(
      p =>
        p.offer
    )

    .slice(
      0,
      8
    );


  grid.innerHTML =

    arr

    .map(
      productCard
    )

    .join('');


  if(
    empty
  ){

    empty.hidden =
      !!arr.length;

  }

}


/* =========================
   CATEGORY + BRAND + SORT
========================= */

function renderSubfilters(){

  const box =
    $('#subfilters');

  if(!box){
    return;
  }

  const cats =
    categories();

  const brandList =
    brands();

  box.hidden = false;

  box.innerHTML = `

    <select
      id="categorySelect"
      class="sort-select">

      <option
        value="الكل"
        ${
          state.category === 'الكل'
          ? 'selected'
          : ''
        }>
        كل الأقسام
      </option>

      ${cats.map(c => `
        <option
          value="${esc(c)}"
          ${
            state.category === c
            ? 'selected'
            : ''
          }>
          ${esc(c)}
        </option>
      `).join('')}

    </select>


    <select
      id="brandSelect"
      class="sort-select">

      <option
        value="الكل"
        ${
          state.brand === 'الكل'
          ? 'selected'
          : ''
        }>
        كل البراندات
      </option>

      ${brandList.map(b => `
        <option
          value="${esc(b)}"
          ${
            state.brand === b
            ? 'selected'
            : ''
          }>
          ${esc(b)}
        </option>
      `).join('')}

    </select>


    <select
      id="priceSort"
      class="sort-select">

      <option
        value="default"
        ${
          state.sort === 'default'
          ? 'selected'
          : ''
        }>
        الترتيب الافتراضي
      </option>

      <option
        value="price-low"
        ${
          state.sort === 'price-low'
          ? 'selected'
          : ''
        }>
        السعر: الأقل إلى الأعلى
      </option>

      <option
        value="price-high"
        ${
          state.sort === 'price-high'
          ? 'selected'
          : ''
        }>
        السعر: الأعلى إلى الأقل
      </option>

      <option
        value="name"
        ${
          state.sort === 'name'
          ? 'selected'
          : ''
        }>
        الترتيب حسب الاسم
      </option>

    </select>

  `;
}

/* =========================
   PRODUCTS
========================= */

function renderProducts(){

  const grid =
    $('#productsGrid');


  if(
    !grid
  ){

    return;

  }


  const arr =
    filtered();


  grid.innerHTML =

    arr

    .map(
      productCard
    )

    .join('');


  const empty =
    $('#productsEmpty');


  if(
    empty
  ){

    empty.hidden =
      !!arr.length;

  }


  const count =
    $('#productsCount');


  if(
    count
  ){

    count.textContent =
      `${arr.length} منتج`;

  }


  let title =
    'كل المنتجات';


  if(
    state.offersOnly
  ){

    title =
      'كل العروض';

  }

  else if(
    state.brand !== 'الكل'
  ){

    title =
      `منتجات ${state.brand}`;

  }

  else if(
    state.category !== 'الكل'
  ){

    title =
      state.category;

  }


  const titleEl =
    $('#productsTitle');


  if(
    titleEl
  ){

    titleEl.textContent =
      title;

  }


  renderSubfilters();

}


/* =========================
   RENDER ALL
========================= */

function renderAll(){

  renderCategories();

  renderFeatured();

  renderOffers();

  renderProducts();

  updateCartUI();

}


/* =========================
   CART
========================= */

function cartQty(id){

  return (

    state.cart.find(

      x =>
        String(x.id) ===
        String(id)

    )?.qty

    || 0

  );

}


function cartData(){

  return state.cart

  .map(
    x => ({

      p:
        byId(
          x.id
        ),

      qty:
        x.qty

    })
  )

  .filter(
    x =>
      x.p
  );

}


function updateCartUI(){

  const n =

    state.cart.reduce(

      (sum,x) =>
        sum + x.qty,

      0

    );


  if(
    $('#cartCount')
  ){

    $('#cartCount')
      .textContent =
      n;

  }


  if(
    $('#bottomCartCount')
  ){

    $('#bottomCartCount')
      .textContent =
      n;

  }

}


function saveCart(){

  localStorage.setItem(

    'alameer_cart_v2',

    JSON.stringify(
      state.cart
    )

  );


  updateCartUI();

  renderProducts();

  renderOffers();

  renderFeatured();


  if(
    $('#cartModal')?.open
  ){

    renderCart();

  }

}


/* =========================
   ADD PRODUCT
========================= */

function add(
  id,
  n = 1
){

  const product =
    byId(id);


  if(
    !product
  ){

    return;

  }


  if(
    product.stock <= 0
  ){

    toast(
      'نفذت كمية هذا المنتج'
    );

    return;

  }


  const currentQty =
    cartQty(id);


  if(
    currentQty >=
    product.stock
  ){

    toast(
      `المتوفر فقط ${product.stock} قطعة`
    );

    return;

  }


  const allowedQty =

    Math.min(

      currentQty + n,

      product.stock

    );


  const x =

    state.cart.find(

      i =>
        String(i.id) ===
        String(id)

    );


  if(
    x
  ){

    x.qty =
      allowedQty;

  }

  else{

    state.cart.push({

      id,

      qty:

        Math.min(
          n,
          product.stock
        )

    });

  }


  saveCart();


  const qty =
    cartQty(id);


  const detailQty =
    $('#detailQty');


  if(
    detailQty &&
    String(
      state.openProductId
    )
    ===
    String(id)
  ){

    detailQty.innerHTML =
      qtyControl(
        id,
        qty
      );

  }


  if(
    qty >=
    product.stock
  ){

    toast(
      `وصلت للكمية المتوفرة: ${product.stock}`
    );

  }

  else{

    toast(
      `تمت الإضافة للسلة • العدد ${qty}`
    );

  }

}


/* =========================
   SET QTY
========================= */

function setQty(
  id,
  qty
){

  const product =
    byId(id);


  if(
    !product
  ){

    return;

  }


  qty =
    Number(
      qty || 0
    );


  if(
    qty >
    product.stock
  ){

    qty =
      product.stock;


    toast(
      `المتوفر فقط ${product.stock} قطعة`
    );

  }


  const x =

    state.cart.find(

      i =>
        String(i.id) ===
        String(id)

    );


  if(
    !x &&
    qty > 0
  ){

    state.cart.push({

      id,

      qty

    });

  }

  else if(
    x
  ){

    x.qty =
      qty;

  }


  state.cart =

    state.cart.filter(

      i =>
        i.qty > 0

    );


  saveCart();


  const detailQty =
    $('#detailQty');


  if(
    detailQty &&
    String(
      state.openProductId
    ) === String(id) &&
    qty > 0
  ){

    detailQty.innerHTML =
      qtyControl(
        id,
        qty
      );

  }

}


/* =========================
   CART RENDER
========================= */

function renderCart(){

  const items =
    cartData();


  const cartItems =
    $('#cartItems');


  if(
    !cartItems
  ){

    return;

  }


  cartItems.innerHTML =

    items.length

    ? items.map(

      ({
        p,
        qty
      }) => `


      <div class="cart-item">


        <img

          src="${esc(p.images[0])}"

          alt="${esc(p.name)}"

          onerror="this.onerror=null;this.src='assets/logo.png'"

        >


        <div>


          <h4>

            ${esc(p.name)}

          </h4>


          ${
            p.price > 0

            ? `

              <p>

                ${money(p.price)}
                ×
                ${qty}

              </p>

            `

            : ''
          }


          ${
            qtyControl(
              p.id,
              qty
            )
          }


        </div>


        <button

          type="button"

          class="remove-btn"

          data-remove="${esc(p.id)}">

          حذف

        </button>


      </div>


      `

    ).join('')

    : `

      <div class="empty-card">

        السلة فارغة.

      </div>

    `;


  if(
    $('#cartPieces')
  ){

    $('#cartPieces')
      .textContent =

      items.reduce(

        (sum,x) =>
          sum + x.qty,

        0

      );

  }


  const total =

    items.reduce(

      (sum,x) =>

        sum +

        (
          x.p.price *
          x.qty
        ),

      0

    );


  if(
    $('#cartTotal')
  ){

    $('#cartTotal')
      .textContent =

      money(total);

  }


  let clearTools =
    $('#cartClearTools');


  if(
    !clearTools
  ){

    cartItems.insertAdjacentHTML(

      'beforebegin',

      `

      <div
        class="cart-tools"
        id="cartClearTools">


        <button
          type="button"
          class="clear-cart-btn"
          data-clear-cart>

          حذف السلة بالكامل

        </button>


      </div>

      `

    );

  }


  const clearBtn =
    $('[data-clear-cart]');


  if(
    clearBtn
  ){

    clearBtn.hidden =
      !items.length;

  }

}


/* =========================
   PRODUCT DETAILS
========================= */

function openProduct(id){

  const p =
    byId(id);


  if(
    !p
  ){

    return;

  }


  state.openProductId =
    id;


  const modal =
    $('#productModal');


  const content =
    $('#productModalContent');


  if(
    !modal ||
    !content
  ){

    return;

  }


  const soldOut =
    p.stock <= 0;


  content.innerHTML = `


    <div class="product-detail">


      <div class="gallery">


        <div class="gallery-main">


          <img

            id="galleryMain"

            src="${esc(p.images[0])}"

            alt="${esc(p.name)}"

            onerror="this.onerror=null;this.src='assets/logo.png'"

          >


        </div>


        ${
          p.images.length > 1

          ? `

            <div class="thumbs">


              ${

                p.images.map(

                  (im,i) => `


                  <button

                    type="button"

                    class="thumb ${
                      i === 0
                      ? 'active'
                      : ''
                    }"

                    data-thumb="${esc(im)}">


                    <img

                      src="${esc(im)}"

                      alt="صورة ${i + 1}"

                    >


                  </button>


                  `
                )
                .join('')

              }


            </div>

          `

          : ''
        }


      </div>


      <div class="product-info">


       <div class="product-links">

  ${
    p.category
    ? `
      <button
        type="button"
        class="product-link-btn"
        data-product-category="${esc(p.category)}">
        ${esc(p.category)}
      </button>
    `
    : ''
  }

  ${
    p.brand
    ? `
      <button
        type="button"
        class="product-link-btn"
        data-product-brand="${esc(p.brand)}">
        ${esc(p.brand)}
      </button>
    `
    : ''
  }

</div>


        <h2>

          ${esc(p.name)}

        </h2>


        ${
          soldOut

          ? `

            <div class="discount-note">

              نفذت الكمية

            </div>

          `

          : ''
        }


        ${
          p.price > 0

          ? `

            <div class="price-row">


              <span class="price">

                ${money(
                  p.price
                )}

              </span>


              ${
                p.old_price > p.price

                ? `

                  <span class="old-price">

                    ${money(
                      p.old_price
                    )}

                  </span>

                `

                : ''
              }


            </div>

          `

          : ''
        }


        ${
          p.desc

          ? `

            <div class="full-desc">

              ${esc(
                p.desc
              )}

            </div>

          `

          : ''
        }


        <div class="detail-add">


          <div id="detailQty">


            ${
              !soldOut &&
              cartQty(p.id)

              ? qtyControl(

                  p.id,

                  cartQty(p.id)

                )

              : ''
            }


          </div>


          ${
            soldOut

            ? `

              <button
                type="button"
                class="add-btn"
                disabled>

                نفذت الكمية

              </button>

            `

            : `

              <button
                type="button"
                class="add-btn"
                data-add="${esc(p.id)}">

                أضف قطعة للسلة

              </button>

            `
          }


        </div>


      </div>


    </div>


  `;


  modal.showModal();

}


/* =========================
   CART OPEN / CLOSE
========================= */

let cartScrollY =
  0;


function openCart(){

  renderCart();


  cartScrollY =
    window.scrollY || 0;


  document.body
    .classList
    .add(
      'cart-open'
    );


  document.body.style.top =
    `-${cartScrollY}px`;


  $('#cartModal')
    ?.showModal();

}


function closeCart(){

  const modal =
    $('#cartModal');


  if(
    modal?.open
  ){

    modal.close();

  }


  document.body
    .classList
    .remove(
      'cart-open'
    );


  document.body.style.top =
    '';


  window.scrollTo(
    0,
    cartScrollY
  );

}


/* =========================
   CHECKOUT
========================= */

function checkout(e){

  e.preventDefault();


  const items =
    cartData();


  if(
    !items.length
  ){

    toast(
      'السلة فارغة'
    );

    return;

  }


  const fd =
    new FormData(
      e.currentTarget
    );


  const beforeDiscount =

    items.reduce(

      (sum,x) => {


        const unit =

          x.p.old_price >
          x.p.price

          ? x.p.old_price

          : x.p.price;


        return (

          sum +

          unit *
          x.qty

        );

      },

      0

    );


  const afterDiscount =

    items.reduce(

      (sum,x) =>

        sum +

        (
          x.p.price *
          x.qty
        ),

      0

    );


  const saving =

    Math.max(

      0,

      beforeDiscount -
      afterDiscount

    );


  const number =

    n =>

      Number(
        n || 0
      )
      .toLocaleString(
        'en-US'
      );


  const productsText =

    items.map(

      (x,i) =>

        `${i + 1}) ${x.p.name}` +

        ` | عدد: ${x.qty}` +

        ` | سعر: ${number(x.p.price)}` +

        ` | مجموع: ${number(
          x.p.price * x.qty
        )}`

    )

    .join('\n');


  const name =
    fd.get('name') || '';


  const phone =
    fd.get('phone') || '';


  const address =
    fd.get('address') || '';


  const landmark =
    fd.get('landmark') || '';


  const notes =
    fd.get('notes') || '';


  let fullAddress =
    address;


  if(
    landmark
  ){

    fullAddress +=
      ` - أقرب نقطة دالة: ${landmark}`;

  }


  let msg =

`طلب جديد - كوزمتك زهرة بيوتي AB

الاسم: ${name}
الهاتف: ${phone}
العنوان: ${fullAddress}

المنتجات:
${productsText}

الإجمالي قبل الخصم: ${number(beforeDiscount)}
الإجمالي بعد الخصم: ${number(afterDiscount)}
التوفير: ${number(saving)}`;


  if(
    notes
  ){

    msg +=
      `\n\nملاحظات: ${notes}`;

  }


  window.open(

    `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`,

    '_blank',

    'noopener'

  );

}


/* =========================
   TOAST
========================= */

function toast(msg){

  const t =
    $('#toast');


  if(
    !t
  ){

    return;

  }


  t.textContent =
    msg;


  t.classList.add(
    'show'
  );


  clearTimeout(
    t._timer
  );


  t._timer =
    setTimeout(

      () =>
        t.classList.remove(
          'show'
        ),

      2200

    );

}


/* =========================
   DRAWER
========================= */

function openDrawer(
  v = true
){

  const drawer =
    $('#drawer');


  if(
    !drawer
  ){

    return;

  }


  drawer
    .classList
    .toggle(
      'open',
      v
    );


  drawer
    .setAttribute(

      'aria-hidden',

      String(!v)

    );

}


/* =========================
   VIEW MODE
========================= */

function storeView(mode){

  const hero =
    $('.hero');


  const toolbar =
    $('.toolbar');


  const offers =
    $('#offers');


  const categorySection =
    $('#categories');


  const products =
    $('#products');


  const featured =
    getFeaturedSection();


  if(
    mode === 'home'
  ){

    if(hero)
      hero.hidden = false;

    if(toolbar)
      toolbar.hidden = false;

    if(offers)
      offers.hidden = false;

    if(featured)
      featured.hidden =
        !state.products.some(
          p =>
            p.featured
        );

if(categorySection)
  categorySection.hidden = true;
    

    if(products)
      products.hidden = false;

  }


  if(
    mode === 'categories'
  ){

    if(hero)
      hero.hidden = true;

    if(toolbar)
      toolbar.hidden = true;

    if(offers)
      offers.hidden = true;

    if(featured)
      featured.hidden = true;

    if(categorySection)
      categorySection.hidden = false;

    if(products)
      products.hidden = true;

  }


  if(
    mode === 'products'
  ){

    if(hero)
      hero.hidden = true;

    if(offers)
      offers.hidden = true;

    if(featured)
      featured.hidden = true;

    if(toolbar)
      toolbar.hidden = false;

    if(categorySection)
      categorySection.hidden = true;

    if(products)
      products.hidden = false;

  }

}


/* =========================
   RESET
========================= */

function resetStoreFilters(){

  state.category =
    'الكل';


  state.brand =
    'الكل';


  state.offersOnly =
    false;


  state.search =
    '';


  state.sort =
    'default';


  if(
    $('#searchInput')
  ){

    $('#searchInput')
      .value =
      '';

  }


  renderCategories();

  renderProducts();

}


/* =========================
   DIRECT EVENTS
========================= */

if(
  $('#menuBtn')
){

  $('#menuBtn').onclick =
    () =>
      openDrawer(true);

}


if(
  $('#closeMenuBtn')
){

  $('#closeMenuBtn').onclick =
    () =>
      openDrawer(false);

}


if(
  $('#drawerBackdrop')
){

  $('#drawerBackdrop').onclick =
    () =>
      openDrawer(false);

}


$$('.drawer-nav a')

.forEach(
  a =>

    a.onclick =
      () =>
        openDrawer(false)

);


if(
  $('#cartBtn')
){

  $('#cartBtn').onclick =
    openCart;

}


if(
  $('#bottomCartBtn')
){

  $('#bottomCartBtn').onclick =
    openCart;

}


if(
  $('#checkoutForm')
){

  $('#checkoutForm').onsubmit =
    checkout;

}


if(
  $('#searchInput')
){

  $('#searchInput')
    .addEventListener(

      'input',

      e => {


        state.search =
          e.target.value;


        renderProducts();

      }

    );

}


if(
  $('#showAllBtn')
){

  $('#showAllBtn').onclick =
    () => {


      resetStoreFilters();


      storeView(
        'home'
      );


      location.hash =
        'products';

    };

}


/* =========================
   GLOBAL CLICK
========================= */

document.addEventListener(

  'click',

  e => {

/* شريط شعارات البراندات في الرئيسية */

const brandStrip =
  e.target.closest('[data-brand-strip]');

if(brandStrip){

  state.brand =
    brandStrip.dataset.brandStrip;

  state.category = 'الكل';
  state.offersOnly = false;
  state.search = '';

  if($('#searchInput')){
    $('#searchInput').value = '';
  }

  renderCategories();
  renderProducts();
  storeView('products');

  $('#products')
    ?.scrollIntoView({
      behavior:'smooth',
      block:'start'
    });

  return;
}


/* الانتقال من تفاصيل المنتج إلى القسم */

const productCategory =
  e.target.closest('[data-product-category]');

if(productCategory){

  state.category =
    productCategory.dataset.productCategory;

  state.brand = 'الكل';
  state.offersOnly = false;

  $('#productModal')?.close();

  renderCategories();
  renderProducts();

  storeView('products');

  $('#products')
    ?.scrollIntoView({
      behavior:'smooth',
      block:'start'
    });

  return;
}


/* الانتقال من تفاصيل المنتج إلى البراند */

const productBrand =
  e.target.closest('[data-product-brand]');

if(productBrand){

  state.brand =
    productBrand.dataset.productBrand;

  state.category = 'الكل';
  state.offersOnly = false;

  $('#productModal')?.close();

  renderProducts();

  storeView('products');

  $('#products')
    ?.scrollIntoView({
      behavior:'smooth',
      block:'start'
    });

  return;
}
    
    const addBtn =

      e.target.closest(
        '[data-add]'
      );


    if(
      addBtn
    ){

      add(
        addBtn.dataset.add
      );

      return;

    }


    const inc =

      e.target.closest(
        '[data-inc]'
      );


    if(
      inc
    ){

      setQty(

        inc.dataset.inc,

        cartQty(
          inc.dataset.inc
        ) + 1

      );

      return;

    }


    const dec =

      e.target.closest(
        '[data-dec]'
      );


    if(
      dec
    ){

      setQty(

        dec.dataset.dec,

        cartQty(
          dec.dataset.dec
        ) - 1

      );

      return;

    }


    const remove =

      e.target.closest(
        '[data-remove]'
      );


    if(
      remove
    ){

      setQty(

        remove.dataset.remove,

        0

      );

      return;

    }


    const clear =

      e.target.closest(
        '[data-clear-cart]'
      );


    if(
      clear
    ){

      if(
        state.cart.length
      ){

        state.cart = [];


        saveCart();


        renderCart();


        toast(
          'تم حذف السلة بالكامل'
        );

      }


      return;

    }


    const product =

      e.target.closest(
        '[data-open-product]'
      );


    if(
      product
    ){

      openProduct(
        product.dataset.openProduct
      );

      return;

    }


    const home =

      e.target.closest(

        'a[href="#home"], [data-go-home]'

      );


    if(
      home
    ){

      e.preventDefault();


      resetStoreFilters();


      storeView(
        'home'
      );


      window.scrollTo({

        top:0,

        behavior:'smooth'

      });


      return;

    }


  const categoriesNav =
  e.target.closest(
    'a[href="#categories"], [data-go-categories]'
  );

if(categoriesNav){

  e.preventDefault();

  state.category = 'الكل';
  state.brand = 'الكل';
  state.offersOnly = false;

  renderCategories();

  storeView('categories');

  $('#categories')
    ?.scrollIntoView({
      behavior:'smooth',
      block:'start'
    });

  return;
}

    const category =

      e.target.closest(
        '[data-category]'
      );


    if(
      category
    ){

      state.category =
        category.dataset.category;


      state.brand =
        'الكل';


      state.offersOnly =
        false;


      renderCategories();


      renderProducts();


      storeView(
        'products'
      );


      $('#products')
        ?.scrollIntoView({

          behavior:'smooth',

          block:'start'

        });


      return;

    }


    const quickCategory =

      e.target.closest(
        '[data-quick-category]'
      );


    if(
      quickCategory
    ){

      state.category =
        quickCategory
          .dataset
          .quickCategory;


      state.offersOnly =
        false;


      renderCategories();


      renderProducts();


      return;

    }


    const brand =

      e.target.closest(
        '[data-brand]'
      );


    if(
      brand
    ){

      state.brand =
        brand.dataset.brand;


      state.offersOnly =
        false;


      renderProducts();


      return;

    }


    const offers =

      e.target.closest(
        '[data-filter-offers]'
      );


    if(
      offers
    ){

      state.offersOnly =
        true;


      state.category =
        'الكل';


      state.brand =
        'الكل';


      renderCategories();


      renderProducts();


      storeView(
        'products'
      );


      return;

    }


    const thumb =

      e.target.closest(
        '[data-thumb]'
      );


    if(
      thumb
    ){

      if(
        $('#galleryMain')
      ){

        $('#galleryMain')
          .src =
          thumb.dataset.thumb;

      }


      $$('.thumb')

      .forEach(
        x =>

          x.classList.toggle(

            'active',

            x === thumb

          )
      );


      return;

    }


    const close =

      e.target.closest(
        '[data-close-modal]'
      );


    if(
      close
    ){

      const id =
        close.dataset.closeModal;


      if(
        id ===
        'cartModal'
      ){

        closeCart();

      }

      else{

        $('#'+id)
          ?.close();

      }

    }

  }

);


/* =========================
   SORT
========================= */

document.addEventListener(
  'change',

  e => {

    /* اختيار القسم */
    if(e.target.id === 'categorySelect'){

      state.category = e.target.value;
      state.brand = 'الكل';
      state.offersOnly = false;

      renderCategories();
      renderProducts();

      return;
    }


    /* اختيار البراند */
    if(e.target.id === 'brandSelect'){

      state.brand = e.target.value;
      state.offersOnly = false;

      renderProducts();

      return;
    }


    /* الترتيب */
    if(e.target.id === 'priceSort'){

      state.sort = e.target.value;

      renderProducts();

      return;
    }

  }
);



/* =========================
   CART CLOSE
========================= */

$('#cartModal')
  ?.addEventListener(

    'close',

    () => {


      if(
        document.body
          .classList
          .contains(
            'cart-open'
          )
      ){

        document.body
          .classList
          .remove(
            'cart-open'
          );


        document.body.style.top =
          '';


        window.scrollTo(
          0,
          cartScrollY
        );

      }

    }

  );


/* =========================
   ONLINE
========================= */

window.addEventListener(

  'online',

  () => {

    if(
      $('#offlineBar')
    ){

      $('#offlineBar')
        .hidden =
        true;

    }

  }

);


window.addEventListener(

  'offline',

  () => {

    if(
      $('#offlineBar')
    ){

      $('#offlineBar')
        .hidden =
        false;

    }

  }

);


if(
  $('#offlineBar')
){

  $('#offlineBar')
    .hidden =
    navigator.onLine;

}


/* =========================
   YEAR
========================= */

if(
  $('#year')
){

  $('#year')
    .textContent =
    new Date()
      .getFullYear();

}


/* =========================
   SERVICE WORKER
========================= */

if(
  'serviceWorker'
  in navigator
){

  window.addEventListener(

    'load',

    () => {

      navigator
        .serviceWorker
        .register(
          './sw.js'
        )
        .catch(
          error =>
            console.log(
              'SW:',
              error
            )
        );

    }

  );

}


/* =========================
   START
========================= */

/* =========================================
   INSTALL GUIDE
========================================= */

function isStandaloneMode(){

  return (
    window.matchMedia(
      '(display-mode: standalone)'
    ).matches
    ||
    window.navigator.standalone === true
  );
}


function showInstallGuide(){

  const guide =
    $('#installGuide');

  if(!guide){
    return;
  }

  /* إذا الموقع مفتوح كتطبيق مثبت لا تظهر النافذة */
  if(isStandaloneMode()){
    guide.hidden = true;
    return;
  }

  /* إذا ضغط سابقاً حسنًا فهمت لا تظهر مرة أخرى */
  const dismissed =
    localStorage.getItem(
      'alameer_install_guide_done'
    );

  if(dismissed === '1'){
    guide.hidden = true;
    return;
  }

  setTimeout(
    () => {
      guide.hidden = false;
    },
    1200
  );
}


function closeInstallGuide(
  remember = false
){

  const guide =
    $('#installGuide');

  if(guide){
    guide.hidden = true;
  }

  if(remember){

    localStorage.setItem(
      'alameer_install_guide_done',
      '1'
    );

  }
}


document.addEventListener(
  'click',
  e => {

    const ok =
      e.target.closest(
        '[data-install-ok]'
      );

    if(ok){

      closeInstallGuide(true);

      return;
    }


    const later =
      e.target.closest(
        '[data-install-later]'
      );

    if(later){

      closeInstallGuide(false);

      return;
    }


    const close =
      e.target.closest(
        '[data-install-close]'
      );

    if(close){

      closeInstallGuide(false);

      return;
    }

  }
);


showInstallGuide();


loadProducts();
loadBrandShowcase();
