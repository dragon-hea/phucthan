/* =================================================================================
 *  phucThanBot_AHK.js – phiên bản hoàn chỉnh (thuần AHK, KHÔNG chrome-launcher)
 *  Cập nhật 24‑06‑2025
 *  -------------------------------------------------------------------------------
 *  • Sử dụng AutoHotkey (AHK) ControlClick để bấm "bao lì xì Tiểu Đồng".
 *  • Không dùng ffi‑napi và CŨNG không dùng chrome-launcher ⇒ tránh lỗi taskkill.
 *  • Puppeteer sẽ tự tìm Chrome/Chromium hệ thống; nếu không có, đặt CHROME_PATH.
 *  • Hàm clickViaAHK() tích hợp trong file. 1 file AHK duy nhất: click.ahk.
 *  ================================================================================= */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin  from 'puppeteer-extra-plugin-stealth';
import { execFile }  from 'node:child_process';
import fsProm        from 'node:fs/promises';
import fs            from 'node:fs';
import path          from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------- Đường dẫn ─ helpers --------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ---------- AutoHotkey ------------------------------------------------------- */
const AHK_EXE    = 'C:/Program Files/AutoHotkey/v2/AutoHotkey.exe'; // chỉnh nếu khác
const DEBUG_MODE = process.env.AHK_DEBUG === 'true'; // Set AHK_DEBUG=true để bật debug
const AHK_SCRIPT = path.join(__dirname, 'click.ahk'); // Chỉ dùng 1 file click.ahk

function clickViaAHK(x, y) {
  return new Promise((resolve, reject) => {
    // Kiểm tra file AHK có tồn tại không
    if (!fs.existsSync(AHK_EXE)) {
      return reject(new Error(`AutoHotkey không tìm thấy tại: ${AHK_EXE}`));
    }
    if (!fs.existsSync(AHK_SCRIPT)) {
      return reject(new Error(`Script AHK không tìm thấy tại: ${AHK_SCRIPT}`));
    }
    
    if (DEBUG_MODE) {
      console.log(`🔧 AHK Debug: Click at (${x}, ${y}) using ${path.basename(AHK_SCRIPT)}`);
    }
    
    // Bỏ log tọa độ để giảm spam
    // console.log(`🖱️ Clicking at screen coordinates: (${x}, ${y})`);
    
    // Giảm timeout xuống 2 giây
    const timeout = setTimeout(() => {
      reject(new Error('AHK timeout - script bị đứng'));
    }, 2000);
    
    const ahkProcess = execFile(AHK_EXE, [AHK_SCRIPT, String(x), String(y)], (error, stdout, stderr) => {
      clearTimeout(timeout);
      
      if (error) {
        console.error(`❌ AHK lỗi:`, error.message);
        return reject(new Error(`AHK error: ${error.message}`));
      }
      if (stderr) {
        console.warn(`⚠️ AHK stderr:`, stderr);
      }
      if (DEBUG_MODE && stdout) {
        // Log stdout chi tiết hơn để dễ debug
        console.log(`\n--- AHK Log ---\n${stdout.trim()}\n---------------`);
      }
      resolve();
    });
    
    // Đảm bảo process tự tắt
    ahkProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (DEBUG_MODE) {
        console.log(`🔧 AHK process exited with code: ${code}`);
      }
      if (code === 0) {
        resolve();
      }
    });
  });
}

/* ---------- Config ----------------------------------------------------------- */
const COOKIES_FILE = 'hea.json';
const TARGET_URL   = 'https://qidian-vp.com';

const SCAN_MS      = 80;  // Giảm từ 100ms xuống 80ms để nhanh hơn
const NAME_TEXT    = ''; // Bỏ filter tên - click mọi lì xì
const KEYWORD_TEXT = 'lì xì';

const ALLOWED_WIDTHS = [15,23,35,42,50,62,70,77,89,97];
const FORBIDDEN      = [
  'trừ','âm','-','giảm','cắt','bớt','pay',
  'bốc','nghi','mất','ức','mạnh','manhj',
  'bay','đứt','uc','tru'
].map(t=>t.toLowerCase());
const EXCEPTION = ['qidian-vp.com tiên vực'].map(s=>s.toLowerCase());

const ROOT_SEL            = 'div.flex.w-full.flex-col';
const COLLAPSE_HEADER_SEL = '.ant-collapse-header';
const ENVELOPE_BTN_SEL    =
  'div.mt-1.flex.w-full.flex-wrap.items-center.justify-center.gap-2 button,' +
  'div.ant-collapse-content button,' +
  'div.ant-collapse-content [role="button"]';

const VERBOSE = true;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Chrome path ------------------------------------------------------ */
function guessChromePaths(){
  const list = [];
  if (process.platform === 'win32'){
    list.push('C:/Program Files/Google/Chrome/Application/chrome.exe');
    list.push('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe');
    list.push(`${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`);
    list.push('C:/Program Files/Microsoft/Edge/Application/msedge.exe');
  }
  return list;
}

async function resolveChromePath(){
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH))
    return process.env.CHROME_PATH;
  for (const p of guessChromePaths()) if (p && fs.existsSync(p)) return p;
  return undefined;  // puppeteer sẽ tự quyết;
}

/* ---------- Gửi click -------------------------------------------------------- */
async function sendClick(page, cssX, cssY){
  // Tọa độ từ boundingBox() là tọa độ CSS so với viewport.
  // AHK cần tọa độ pixel vật lý so với viewport.
  // Chúng ta chỉ cần nhân với devicePixelRatio để chuyển đổi.
  const { dpr } = await page.evaluate(() => ({
    dpr: window.devicePixelRatio,
  }));
  
  const px = Math.round(cssX * dpr);
  const py = Math.round(cssY * dpr);
  
  // Retry logic - thử tối đa 2 lần
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await clickViaAHK(px, py);
      await sleep(50);
      return; // Thành công
    } catch (error) {
      console.warn(`⚠️ Click attempt ${attempt} failed: ${error.message}`);
      if (attempt === 2) throw error; // Thất bại sau 2 lần
      await sleep(100); // Chờ trước khi retry
    }
  }
}

async function clickEnvelope(page, btn){
  try {
    // Kiểm tra element còn tồn tại không
    const isConnected = await btn.evaluate(el => el.isConnected);
    if (!isConnected) {
      throw new Error('Element disconnected from DOM');
    }
    
    await btn.evaluate(el => el.scrollIntoView({block:'center', inline:'center', behavior:'instant'}));
    
    // Tăng delay để đảm bảo element sẵn sàng
    await sleep(200);  // Tăng từ 50ms lên 200ms
    
    // Kiểm tra element có visible và clickable không
    const isVisible = await btn.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && 
             style.visibility !== 'hidden' && 
             style.display !== 'none' &&
             !el.disabled;
    });
    
    if (!isVisible) {
      throw new Error('Element not visible or disabled');
    }
    
    const box = await btn.boundingBox();
    if (!box) {
      throw new Error('boundingBox null - element may be hidden or removed');
    }
    
    const clickX = box.x + box.width/2;
    const clickY = box.y + box.height/2;
    if (DEBUG_MODE) {
      console.log(`📍 Element box: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);
      console.log(`🎯 Click target: (${clickX}, ${clickY})`);
    }
    
    await sendClick(page, clickX, clickY);
    
    // Tăng delay sau click để đảm bảo action được thực hiện
    await sleep(300);  // Tăng từ 100ms lên 300ms
    
    // Bỏ after-click check để giảm spam log
    if (DEBUG_MODE) {
      // Kiểm tra xem element có thay đổi sau click không
      const afterClick = await btn.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return {
          visible: rect.width > 0 && rect.height > 0,
          disabled: el.disabled,
          classes: el.className
        };
      }).catch(() => ({ visible: false, disabled: true, classes: 'disconnected' }));
      
      console.log(`🔍 After click: visible=${afterClick.visible}, disabled=${afterClick.disabled}`);
    }
    
  } catch (e) {
    throw new Error(`Click failed: ${e.message}`);
  }
}

/* ================= MAIN ====================================================== */
(async () => {
  if (process.platform !== 'win32'){
    console.error('Script này chỉ hỗ trợ Windows (cần AutoHotkey).');
    process.exit(1);
  }

  let browser, page;
  
  try {
    /* 1. Đọc cookie (nếu có) – đồng thời làm sạch trường sameSite */
    let cookies=[];
    try{
      cookies = JSON.parse(await fsProm.readFile(path.resolve(COOKIES_FILE), 'utf8'))
        .map(c => {
          if (!['Strict','Lax','None'].includes(c.sameSite)) delete c.sameSite;
          return c;
        });
    }catch(e){
      console.warn('Không thể đọc cookie file:', e.message);
    }

    /* 2. Khởi tạo trình duyệt */
    puppeteerExtra.use(StealthPlugin());
    browser = await puppeteerExtra.launch({
      executablePath : await resolveChromePath(), // undefined ⇒ Puppeteer tự lo
      headless       : false,
      defaultViewport: null,
       args: [
      	'--start-maximized',
      	'--disable-background-timer-throttling',
      	'--disable-backgrounding-occluded-windows',
      	'--disable-renderer-backgrounding',
      	'--disable-features=CalculateNativeWinOcclusion'
    ],
      protocolTimeout: 60000
    });
    page = await browser.newPage();
    await page.evaluateOnNewDocument(()=>{Object.defineProperty(navigator,'webdriver',{get:()=>undefined});});

    if (cookies.length){
      try{ await page.setCookie(...cookies.map(c=>({...c,url:TARGET_URL}))); }
      catch(e){ console.warn('Cookie lỗi, bỏ qua:', e.message); }
    }
    await page.goto(TARGET_URL,{waitUntil:'networkidle2'});
    console.log('🌐 Đã mở trang', TARGET_URL);

    // --- THÊM CODE: Click vào nút message một lần ---
    try {
      console.log('🗨️ Đang tìm nút message để click...');
      const messageButtonSelector = 'span[aria-label="message"]';
      // Chờ tối đa 15 giây để nút xuất hiện.
      const messageButton = await page.waitForSelector(messageButtonSelector, { timeout: 15000 });
      
      console.log('✅ Tìm thấy nút message, tiến hành click...');
      
      // Ưu tiên click trực tiếp bằng Puppeteer vì nó đáng tin cậy hơn cho các element thông thường.
      try {
        await messageButton.click({ delay: 100 }); // Thêm delay nhỏ để click tự nhiên hơn
        console.log('👍 Đã click vào nút message bằng Puppeteer.');
      } catch (puppeteerClickError) {
        console.warn(`⚠️ Click bằng Puppeteer thất bại, thử lại bằng AHK. Lỗi: ${puppeteerClickError.message}`);
        // Nếu Puppeteer click lỗi, quay lại dùng AHK làm phương án dự phòng.
        await clickEnvelope(page, messageButton);
        console.log('👍 Đã click vào nút message bằng AHK.');
      }
      
      await messageButton.dispose(); // Dọn dẹp handle
    } catch (e) {
      // Báo lỗi nhẹ nhàng nếu không tìm thấy nút hoặc cả 2 phương thức click đều thất bại.
      console.warn(`⚠️ Không tìm thấy hoặc không thể click vào nút message. Bỏ qua.`);
    }
    // --- KẾT THÚC CODE THÊM ---

    /* 3. Vòng quét */
    let scanCount = 0;
    const processedElements = new Map(); // Track processed elements với timestamp
    
    while (true){
      scanCount++;
      const roots = await page.$$(ROOT_SEL);
      
      for (const root of roots){
        // Tạo unique ID cho element dựa trên nội dung thực tế
        const elementId = await page.evaluate(e => {
          // Tạo ID dựa trên nội dung cụ thể của post
          const nameEl = e.querySelector('div.flex.grow.items-center.font-bold span.truncate span');
          const bodyEl = e.querySelector('div.mt-1');
          const canvasEl = e.querySelector('canvas');
          
          const name = nameEl ? nameEl.textContent.trim() : '';
          const body = bodyEl ? bodyEl.textContent.trim() : '';
          const canvasWidth = canvasEl ? (canvasEl.width || canvasEl.getAttribute('width')) : '';
          
          // Tạo hash từ nội dung
          const content = name + '|' + body + '|' + canvasWidth;
          let hash = 0;
          for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return 'post_' + Math.abs(hash);
        }, root);
        
        // Kiểm tra xem đã xử lý gần đây chưa (trong 30 giây)
        const lastProcessed = processedElements.get(elementId);
        const now = Date.now();
        if (lastProcessed && (now - lastProcessed) < 30000) {
          await root.dispose();
          continue;
        }

        const matched = await page.evaluate((el,n,k)=>{
          // Nếu NAME_TEXT rỗng thì bỏ qua check tên, chỉ check keyword
          if (n && n.trim()) {
            const nameEl = el.querySelector('div.flex.grow.items-center.font-bold span.truncate span');
            if (!nameEl || !nameEl.textContent.includes(n)) return false;
          }
          const body = el.querySelector('div.mt-1');
          return body && body.textContent.toLowerCase().includes(k.toLowerCase());
        }, root, NAME_TEXT, KEYWORD_TEXT);
        if (!matched){ await root.dispose(); continue; }

        const meta = await page.evaluate((el,forbid,allow)=>{
          const txt = ([...el.querySelectorAll('div')]
            .find(d=>d.className?.includes('text-rose-500'))?.textContent || '').toLowerCase();
          const forbiddenHit = forbid.some(f=>txt.includes(f));
          const allowedHit   = allow.some(a=>txt.includes(a));
          
          // Lấy canvas thứ 2 (index 1) - không fallback về canvas đầu
          const canvases = [...el.querySelectorAll('canvas')];
          const cnv = canvases[1]; // Chỉ lấy canvas thứ 2
          const width = cnv ? (cnv.width || parseInt(cnv.getAttribute('width'),10)) : null;
          
          return {txt,width,forbiddenHit,allowedHit,canvasCount:canvases.length};
        }, root, FORBIDDEN, EXCEPTION);

        if (meta.forbiddenHit && !meta.allowedHit){
          // Mark processed để không check lại trong 30 giây
          processedElements.set(elementId, now);
          await root.dispose(); 
          continue;
        }
        
        // Kiểm tra phải có ít nhất 2 canvas và canvas thứ 2 có width hợp lệ
        if (meta.canvasCount < 2 || meta.width === null || !ALLOWED_WIDTHS.includes(meta.width)){
          // Mark processed để không check lại trong 30 giây
          processedElements.set(elementId, now);
          await root.dispose(); 
          continue;
        }

        await page.evaluate((el,hSel)=>{
          const h = el.querySelector(hSel);
          if (h && h.getAttribute('aria-expanded')==='false') h.click();
        }, root, COLLAPSE_HEADER_SEL);
        try{
          await page.waitForFunction((el,hSel)=>{
            const h = el.querySelector(hSel);
            return !h || h.getAttribute('aria-expanded')==='true';
          }, {timeout:1500}, root, COLLAPSE_HEADER_SEL);
        }catch{}

        const envelopes = await root.$$(ENVELOPE_BTN_SEL);
        
        // Kiểm tra trạng thái lì xì trước khi click
        if (envelopes.length > 0) {
          // Kiểm tra xem lì xì còn available không
          const lixiStatus = await page.evaluate(el => {
            // Kiểm tra xem có text "đã hết" hoặc "hết lượt" không
            const textContent = el.textContent.toLowerCase();
            const isFinished = textContent.includes('đã hết') || 
                              textContent.includes('hết lượt') ||
                              textContent.includes('đã kết thúc') ||
                              textContent.includes('finished');
            
            // Kiểm tra trạng thái buttons
            const buttons = [...el.querySelectorAll('button')];
            const activeButtons = buttons.filter(btn => 
              !btn.disabled && 
              !btn.classList.contains('disabled') &&
              btn.textContent.trim() !== ''
            );
            
            return {
              isFinished,
              totalButtons: buttons.length,
              activeButtons: activeButtons.length,
              hasActiveButtons: activeButtons.length > 0
            };
          }, root);
          
          const postInfo = await page.evaluate(el => {
            const nameEl = el.querySelector('div.flex.grow.items-center.font-bold span.truncate span');
            const bodyEl = el.querySelector('div.mt-1');
            // Lấy nội dung thật của lì xì (số tiền/xu)
            const lixiContentEl = [...el.querySelectorAll('div')]
              .find(d => d.className?.includes('text-rose-500'));
            
            return {
              name: nameEl ? nameEl.textContent.trim() : '',
              postContent: bodyEl ? bodyEl.textContent.trim() : '',
              lixiContent: lixiContentEl ? lixiContentEl.textContent.trim() : 'Không xác định'
            };
          }, root);
          
          console.log(`🎯 LÌ XÌ PHÁT HIỆN:`);
          console.log(`   👤 Người: ${postInfo.name}`);
          console.log(`   💰 Nội dung lì xì: ${postInfo.lixiContent}`);
          console.log(`   🎨 Canvas width: ${meta.width}`);
          console.log(`   📦 Số bao: ${envelopes.length}`);
          
          // Kiểm tra xem lì xì đã hết chưa
          if (lixiStatus.isFinished || !lixiStatus.hasActiveButtons) {
            console.log(`   ⚠️ Lì xì đã hết hoặc không còn bao active`);
            console.log(`   ─────────────────────────────────────────`);
            // Mark processed để không check lại
            processedElements.set(elementId, now);
            await root.dispose();
            continue;
          }
          
          // Lì xì còn active → tiến hành click
          console.log(`   ✅ Lì xì còn active, bắt đầu click...`);
        }
        
        // Nếu không có bao nào → mark processed để không check lại
        if (envelopes.length === 0) {
          processedElements.set(elementId, now);
          await root.dispose();
          continue;
        }
        
        // Có bao lì xì → click tất cả
        await sleep(500); // Chờ một chút trước khi click để tránh spam

        // SỬA LỖI: Click tuần tự thay vì song song để tránh lỗi AHK timeout do #SingleInstance Force
        let successCount = 0;
        for (const envelope of envelopes) {
          try {
            await clickEnvelope(page, envelope);
            successCount++;
          } catch (e) {
            // Lỗi click một bao cụ thể sẽ được ghi nhận bởi hàm clickEnvelope, ở đây chỉ cần tiếp tục
          } finally {
            // Luôn dọn dẹp handle của element sau khi xử lý
            await envelope.dispose().catch(() => {});
          }
        }

        // Chờ tất cả click hoàn thành
        // const results = await Promise.allSettled(clickPromises);
        // const successCount = results.filter(r => r.status === 'fulfilled').length;
        
        // Log kết quả click
        console.log(`   ${successCount === envelopes.length ? '✅' : '⚠️'} Kết quả: ${successCount}/${envelopes.length} bao thành công`);
        console.log(`   ─────────────────────────────────────────`);

        // Mark processed với timeout dài để tránh click lặp lại
        processedElements.set(elementId, now);
        
        // Cleanup old processed elements (> 60 giây)
        for (const [id, timestamp] of processedElements.entries()) {
          if (now - timestamp > 60000) {
            processedElements.delete(id);
          }
        }
        
        await root.dispose();
      }
      
      // Bỏ debug log scan để giảm spam
      // if (scanCount % 50 === 0) {
      //   console.log(`🔍 Scan #${scanCount} - Processed: ${processedElements.size} elements`);
      // }
      
      await sleep(SCAN_MS);
    }

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    // Đóng trình duyệt khi kết thúc
    if (browser) {
      await browser.close();
    }
  }
})();
