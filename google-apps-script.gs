const ZAHRA_SPREADSHEET_ID = '1agOLbZ_JtZAiE0dy1_Foz733yP6FOtaMxbiIUQjO2ls';

/*
  زهرة بيوتي - Google Apps Script
  يدعم المنتجات + الكوبونات + البراندات وشعاراتها.

  مهم بعد تعديل هذا الملف:
  Deploy > Manage deployments > Edit > New version > Deploy
*/

const PRODUCTS_SHEET = 'Products';
const COUPONS_SHEET = 'Coupons';
const BRANDS_SHEET = 'Brands';

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '').trim().toLowerCase();
  if (action === 'coupons' || action === 'list_coupons') return listCoupons_();
  if (action === 'brands' || action === 'list_brands') return listBrands_();
  return jsonResponse({
    success: true,
    message: 'Zahra Beauty Store API is working',
    supports: ['add', 'update', 'coupon_add', 'coupon_update', 'coupon_delete', 'coupons', 'brand_upsert', 'brand_delete', 'brands']
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!e || !e.parameter) throw new Error('No request data received');
    const params = e.parameter;
    const action = String(params.action || 'add').trim().toLowerCase();

    if (action === 'coupon_add') return addCoupon_(params);
    if (action === 'coupon_update') return updateCoupon_(params);
    if (action === 'coupon_delete') return deleteCoupon_(params);
    if (action === 'brand_upsert') return upsertBrand_(params);
    if (action === 'brand_delete') return deleteBrand_(params);

    const sheet = getProductsSheet_();
    const info = ensureProductHeaders_(sheet);
    if (info.headerIndex.id === undefined) throw new Error('Missing required id column');

    if (action === 'update') {
      return updateProduct_(sheet, info.headers, info.headerIndex, params);
    }
    return addProduct_(sheet, info.headers, info.headerIndex, params);
  } catch (err) {
    return jsonResponse({ success: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function getProductsSheet_() {
  const ss = SpreadsheetApp.openById(ZAHRA_SPREADSHEET_ID);
  return ss.getSheetByName(PRODUCTS_SHEET) || ss.getActiveSheet();
}

function getCouponsSheet_() {
  const ss = SpreadsheetApp.openById(ZAHRA_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(COUPONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(COUPONS_SHEET);
    sheet.appendRow(['code', 'type', 'value', 'min', 'start_at', 'end_at', 'active', 'created_at']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getBrandsSheet_() {
  const ss = SpreadsheetApp.openById(ZAHRA_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(BRANDS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(BRANDS_SHEET);
    sheet.appendRow(['name', 'logo', 'updated_at']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getHeaderInfo_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error('Sheet has no headers');
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(h => String(h).trim());
  const headerIndex = {};
  headers.forEach((h, i) => { if (h) headerIndex[h.toLowerCase()] = i; });
  return { headers, headerIndex };
}

function ensureProductHeaders_(sheet) {
  const required = [
    'id','name','price','old_price','offer','discount_note','image','images',
    'category','sub_category','brand','featured','stock','desc','active'
  ];

  if (sheet.getLastColumn() === 0) {
    sheet.appendRow(required);
    sheet.setFrozenRows(1);
    return getHeaderInfo_(sheet);
  }

  let info = getHeaderInfo_(sheet);
  required.forEach(h => {
    if (info.headerIndex[h] === undefined) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
      info = getHeaderInfo_(sheet);
    }
  });
  SpreadsheetApp.flush();
  return getHeaderInfo_(sheet);
}

function addProduct_(sheet, headers, headerIndex, params) {
  const row = new Array(headers.length).fill('');
  const id = String(params.id || '').trim() || generateProductId_();
  row[headerIndex.id] = id;
  Object.keys(params).forEach(key => {
    const k = String(key).trim().toLowerCase();
    if (k === 'action' || k === 'id') return;
    if (headerIndex[k] !== undefined) row[headerIndex[k]] = params[key];
  });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return jsonResponse({ success: true, action: 'add', id, row: sheet.getLastRow() });
}

function updateProduct_(sheet, headers, headerIndex, params) {
  const id = String(params.id || '').trim();
  if (!id) throw new Error('Missing product id');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('No products found');

  const ids = sheet.getRange(2, headerIndex.id + 1, lastRow - 1, 1).getDisplayValues();
  let targetRow = -1;
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) { targetRow = i + 2; break; }
  }
  if (targetRow === -1) throw new Error('Product id not found: ' + id);

  const range = sheet.getRange(targetRow, 1, 1, headers.length);
  const row = range.getValues()[0];
  Object.keys(params).forEach(key => {
    const k = String(key).trim().toLowerCase();
    if (k === 'action' || k === 'id') return;
    if (headerIndex[k] !== undefined) row[headerIndex[k]] = params[key];
  });
  row[headerIndex.id] = id;
  range.setValues([row]);
  SpreadsheetApp.flush();
  return jsonResponse({ success: true, action: 'update', id, row: targetRow });
}

function ensureCouponHeaders_(sheet) {
  const required = ['code', 'type', 'value', 'min', 'start_at', 'end_at', 'active', 'created_at'];
  if (sheet.getLastColumn() === 0) sheet.appendRow(required);
  let info = getHeaderInfo_(sheet);
  required.forEach(h => {
    if (info.headerIndex[h] === undefined) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
      info = getHeaderInfo_(sheet);
    }
  });
  return getHeaderInfo_(sheet);
}

function addCoupon_(params) {
  const sheet = getCouponsSheet_();
  const info = ensureCouponHeaders_(sheet);
  const code = normalizeCouponCode_(params.code);
  if (!code) throw new Error('Coupon code is required');
  if (findCouponRow_(sheet, info.headerIndex, code) !== -1) throw new Error('Coupon already exists: ' + code);
  const row = new Array(info.headers.length).fill('');
  setCouponRow_(row, info.headerIndex, params, code);
  row[info.headerIndex.created_at] = new Date();
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return jsonResponse({ success: true, action: 'coupon_add', code });
}

function updateCoupon_(params) {
  const sheet = getCouponsSheet_();
  const info = ensureCouponHeaders_(sheet);
  const code = normalizeCouponCode_(params.code);
  if (!code) throw new Error('Coupon code is required');
  const targetRow = findCouponRow_(sheet, info.headerIndex, code);
  if (targetRow === -1) throw new Error('Coupon not found: ' + code);
  const range = sheet.getRange(targetRow, 1, 1, info.headers.length);
  const row = range.getValues()[0];
  setCouponRow_(row, info.headerIndex, params, code);
  range.setValues([row]);
  SpreadsheetApp.flush();
  return jsonResponse({ success: true, action: 'coupon_update', code });
}

function deleteCoupon_(params) {
  const sheet = getCouponsSheet_();
  const info = ensureCouponHeaders_(sheet);
  const code = normalizeCouponCode_(params.code);
  if (!code) throw new Error('Coupon code is required');
  const targetRow = findCouponRow_(sheet, info.headerIndex, code);
  if (targetRow === -1) throw new Error('Coupon not found: ' + code);
  sheet.deleteRow(targetRow);
  SpreadsheetApp.flush();
  return jsonResponse({ success: true, action: 'coupon_delete', code });
}

function setCouponRow_(row, idx, params, code) {
  const type = String(params.type || 'percent').trim().toLowerCase();
  const value = Number(params.value || 0);
  const min = Number(params.min || 0);
  if (!['percent', 'fixed'].includes(type)) throw new Error('Invalid coupon type');
  if (!(value > 0)) throw new Error('Discount value must be greater than 0');
  if (type === 'percent' && value > 100) throw new Error('Percentage cannot exceed 100');
  row[idx.code] = code;
  row[idx.type] = type;
  row[idx.value] = value;
  row[idx.min] = Math.max(0, min);
  row[idx.start_at] = parseDateTime_(params.start_at);
  row[idx.end_at] = parseDateTime_(params.end_at);
  row[idx.active] = String(params.active || '1') === '0' ? 0 : 1;
}

function listCoupons_() {
  try {
    const sheet = getCouponsSheet_();
    const info = ensureCouponHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonResponse({ success: true, coupons: [] });
    const values = sheet.getRange(2, 1, lastRow - 1, info.headers.length).getValues();
    const tz = Session.getScriptTimeZone() || 'Asia/Baghdad';
    const now = new Date();
    const coupons = values.map(row => {
      const obj = {};
      info.headers.forEach((h, i) => obj[String(h).toLowerCase()] = row[i]);
      const start = obj.start_at instanceof Date ? obj.start_at : parseDateTime_(obj.start_at);
      const end = obj.end_at instanceof Date ? obj.end_at : parseDateTime_(obj.end_at);
      const active = String(obj.active) !== '0' && String(obj.active).toLowerCase() !== 'false';
      return {
        code: normalizeCouponCode_(obj.code),
        type: String(obj.type || 'percent'),
        value: Number(obj.value || 0),
        min: Number(obj.min || 0),
        start_at: start ? Utilities.formatDate(start, tz, "yyyy-MM-dd'T'HH:mm:ssXXX") : '',
        end_at: end ? Utilities.formatDate(end, tz, "yyyy-MM-dd'T'HH:mm:ssXXX") : '',
        active,
        valid_now: active && (!start || now >= start) && (!end || now <= end)
      };
    }).filter(c => c.code);
    return jsonResponse({ success: true, server_time: now.toISOString(), coupons });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err.message || err), coupons: [] });
  }
}

function findCouponRow_(sheet, idx, code) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const vals = sheet.getRange(2, idx.code + 1, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < vals.length; i++) if (normalizeCouponCode_(vals[i][0]) === code) return i + 2;
  return -1;
}

function normalizeCouponCode_(v) {
  return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
}

function parseDateTime_(v) {
  if (!v) return '';
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error('Invalid date/time: ' + s);
  return d;
}

function ensureBrandHeaders_(sheet) {
  const required = ['name', 'logo', 'updated_at'];
  if (sheet.getLastColumn() === 0) sheet.appendRow(required);
  let info = getHeaderInfo_(sheet);
  required.forEach(h => {
    if (info.headerIndex[h] === undefined) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
      info = getHeaderInfo_(sheet);
    }
  });
  return getHeaderInfo_(sheet);
}

function normalizeBrandName_(v) {
  return String(v || '').trim().replace(/\s+/g, ' ');
}

function findBrandRow_(sheet, idx, name) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const vals = sheet.getRange(2, idx.name + 1, lastRow - 1, 1).getDisplayValues();
  const target = normalizeBrandName_(name).toLowerCase();
  for (let i = 0; i < vals.length; i++) if (normalizeBrandName_(vals[i][0]).toLowerCase() === target) return i + 2;
  return -1;
}

function upsertBrand_(params) {
  const sheet = getBrandsSheet_();
  const info = ensureBrandHeaders_(sheet);
  const name = normalizeBrandName_(params.name);
  const logo = String(params.logo || '').trim();
  const oldName = normalizeBrandName_(params.old_name);
  if (!name) throw new Error('Brand name is required');
  if (!logo) throw new Error('Brand logo URL is required');
  if (!/^https?:\/\//i.test(logo)) throw new Error('Brand logo must be a valid http/https URL');

  let targetRow = oldName ? findBrandRow_(sheet, info.headerIndex, oldName) : -1;
  if (targetRow === -1) targetRow = findBrandRow_(sheet, info.headerIndex, name);

  if (targetRow === -1) {
    const row = new Array(info.headers.length).fill('');
    row[info.headerIndex.name] = name;
    row[info.headerIndex.logo] = logo;
    row[info.headerIndex.updated_at] = new Date();
    sheet.appendRow(row);
  } else {
    const range = sheet.getRange(targetRow, 1, 1, info.headers.length);
    const row = range.getValues()[0];
    row[info.headerIndex.name] = name;
    row[info.headerIndex.logo] = logo;
    row[info.headerIndex.updated_at] = new Date();
    range.setValues([row]);
  }
  SpreadsheetApp.flush();
  return jsonResponse({ success: true, action: 'brand_upsert', name });
}

function deleteBrand_(params) {
  const sheet = getBrandsSheet_();
  const info = ensureBrandHeaders_(sheet);
  const name = normalizeBrandName_(params.name);
  if (!name) throw new Error('Brand name is required');
  const targetRow = findBrandRow_(sheet, info.headerIndex, name);
  if (targetRow === -1) throw new Error('Brand not found: ' + name);
  sheet.deleteRow(targetRow);
  SpreadsheetApp.flush();
  return jsonResponse({ success: true, action: 'brand_delete', name });
}

function listBrands_() {
  try {
    const sheet = getBrandsSheet_();
    const info = ensureBrandHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonResponse({ success: true, brands: [] });
    const values = sheet.getRange(2, 1, lastRow - 1, info.headers.length).getDisplayValues();
    const brands = values.map(row => ({
      name: normalizeBrandName_(row[info.headerIndex.name]),
      logo: String(row[info.headerIndex.logo] || '').trim()
    })).filter(b => b.name && b.logo).sort((a,b) => a.name.localeCompare(b.name));
    return jsonResponse({ success: true, brands });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err.message || err), brands: [] });
  }
}

function generateProductId_() {
  return 'P' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Baghdad', 'yyyyMMddHHmmssSSS');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
