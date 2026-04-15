- bashで長い処理をしたいときは必ずログつき非同期nohup実行とログの定期的監視をする。

悪い例:
$ scp very_large_file remote:/home/null/very_large_file

良い例:
nohup bash -lc 'scp very_large_file remote:/home/null/very_large_file' \
  >> ログファイル 2>&1 &
echo $! でPID取得
監視はsleep したあとにログよみこみ、sleepしたあとによみこみを繰り返す


- bashで一度にたくさんのコマンドを一気に実行するのは避ける
悪い例:
npm run dev -- --host 127.0.0.1 --port 4173 >/tmp/prototype1-dev.log 2>&1 & DEV_PID=$!; sleep 4; node -e "const { chromium, devices } = require('playwright'); (async()=>{ const browser=await chromium.launch({channel:'chrome', headless:true}); const page=await browser.newPage(); await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'}); await page.screenshot({path:'/tmp/prototype1-mask-desktop-v1.png',fullPage:true}); await page.locator('button:has-text(\"K\")').first().click(); await page.screenshot({path:'/tmp/prototype1-mask-desktop-click-v1.png',fullPage:true}); const context=await browser.newContext({...devices['Pixel 5']}); const mobile=await context.newPage(); await mobile.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'}); await mobile.screenshot({path:'/tmp/prototype1-mask-mobile-v1.png',fullPage:true}); await mobile.locator('button:has-text(\"LD\")').first().click(); await mobile.screenshot({path:'/tmp/prototype1-mask-mobile-click-v1.png',fullPage:true}); await context.close(); await browser.close(); })();"; STATUS=$?; kill $DEV_PID; wait $DEV_PID 2>/dev/null; exit $STATUS
