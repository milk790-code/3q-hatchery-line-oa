/**
 * 3Q Hatchery — Google Sheets 資料同步腳本
 * 將 Cloudflare Worker CRM 資料自動同步到 Google Sheets
 *
 * ═══════════════════════════════════════════════════════
 *  設定步驟（一次性）
 * ═══════════════════════════════════════════════════════
 *
 * 1. 在 Google Sheets 建立一份新試算表
 *    命名為「3Q Hatchery CRM」（或任意名稱）
 *    複製網址列中的 Spreadsheet ID，例如：
 *    https://docs.google.com/spreadsheets/d/【這段就是 ID】/edit
 *
 * 2. 在試算表中點「擴充功能」→「Apps Script」
 *
 * 3. 刪除預設的空白 function，把本檔全部內容貼進去
 *
 * 4. 點左上角「專案設定」（齒輪圖示）→「指令碼屬性」→「新增屬性」：
 *    WORKER_URL    https://3q-hatchery-webhook.<你的subdomain>.workers.dev
 *    TRIGGER_TOKEN 與 Cloudflare Secret 裡設定的 TRIGGER_TOKEN 一致
 *    SHEET_ID      步驟 1 複製的試算表 ID
 *
 * 5. 回到編輯器，選取函式 installHourlyTrigger → 點「執行」
 *    第一次執行需授予 Google 帳號權限，依提示允許即可
 *
 * 完成後每小時自動同步一次，也可手動執行 syncAll() 立即更新
 * ═══════════════════════════════════════════════════════
 */

// ── 讀取 Script Properties ──────────────────────────────

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    workerUrl: props.getProperty('WORKER_URL') || '',
    token:     props.getProperty('TRIGGER_TOKEN') || '',
    sheetId:   props.getProperty('SHEET_ID') || '',
  };
}

// ── 主函式：同步全部資料表 ────────────────────────────────

function syncAll() {
  const cfg = getConfig_();
  if (!cfg.workerUrl || !cfg.token || !cfg.sheetId) {
    console.error('缺少設定：請在指令碼屬性設定 WORKER_URL / TRIGGER_TOKEN / SHEET_ID');
    return;
  }

  syncTable_(cfg, 'inquiries');
  syncTable_(cfg, 'campaigns');
  syncTable_(cfg, 'social_events');
  syncDashboard_(cfg);

  console.log('✅ 同步完成：' + new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
}

// ── 同步單一資料表 ───────────────────────────────────────

function syncTable_(cfg, table) {
  const url = cfg.workerUrl + '/api/csv?table=' + encodeURIComponent(table);
  let resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + cfg.token },
      muteHttpExceptions: true,
    });
  } catch (e) {
    console.error('fetch 失敗 [' + table + ']：' + e);
    return;
  }

  if (resp.getResponseCode() !== 200) {
    console.warn('HTTP ' + resp.getResponseCode() + ' 取得 ' + table + ' 失敗');
    return;
  }

  const raw = resp.getContentText('UTF-8').trim();
  if (!raw) return;

  const rows = Utilities.parseCsv(raw);
  if (!rows || rows.length < 1) return;

  const ss    = SpreadsheetApp.openById(cfg.sheetId);
  let   sheet = ss.getSheetByName(table);
  if (!sheet) sheet = ss.insertSheet(table);

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // 凍結標頭列、自動欄寬、標頭粗體
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  try { sheet.autoResizeColumns(1, rows[0].length); } catch (_) {}

  console.log(table + ': 寫入 ' + (rows.length - 1) + ' 筆');
}

// ── 同步 Dashboard 統計 ──────────────────────────────────

function syncDashboard_(cfg) {
  let resp;
  try {
    resp = UrlFetchApp.fetch(cfg.workerUrl + '/api/stats', {
      muteHttpExceptions: true,
    });
  } catch (e) {
    console.warn('Dashboard stats 取得失敗：' + e);
    return;
  }

  if (resp.getResponseCode() !== 200) return;

  let stats;
  try { stats = JSON.parse(resp.getContentText()); } catch (_) { return; }

  const ss    = SpreadsheetApp.openById(cfg.sheetId);
  let   sheet = ss.getSheetByName('dashboard');
  if (!sheet) sheet = ss.insertSheet('dashboard');

  sheet.clearContents();

  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const rows = [
    ['3Q Hatchery CRM 統計', now],
    [],
    ['詢問總數',          stats.inquiries?.total           || 0],
    ['今日新詢問',        stats.inquiries?.today           || 0],
    ['🔥 熱門 lead',      stats.leads?.hot                 || 0],
    ['⚡ 暖 lead',        stats.leads?.warm                || 0],
    ['🌱 冷 lead',        stats.leads?.cold                || 0],
    ['✅ 成交數',         stats.leads?.won                 || 0],
    [],
    ['活動報名總數',       stats.campaigns?.total           || 0],
    ['今日新報名',        stats.campaigns?.today           || 0],
    [],
    ['Tier 1 名額 (100元)', stats.campaign_slots?.tier1?.length || 0],
    ['Tier 2 名額 (200元)', stats.campaign_slots?.tier2?.length || 0],
    ['Tier 3 名額 (300元)', stats.campaign_slots?.tier3?.length || 0],
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setFontSize(14);
  try { sheet.autoResizeColumns(1, 2); } catch (_) {}

  console.log('Dashboard 更新完成');
}

// ── 安裝每小時觸發器（僅需執行一次）─────────────────────────

function installHourlyTrigger() {
  // 清除舊觸發器
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyHours(1)
    .create();

  console.log('✅ 每小時觸發器已安裝。下一次執行：' + new Date(Date.now() + 3600000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
}

// ── 移除所有觸發器（需要時用）───────────────────────────────

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  console.log('所有觸發器已移除');
}
