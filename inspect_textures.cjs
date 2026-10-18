const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('http://localhost:5173');
  const info = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      async function inspectImg(url) {
        return new Promise(res => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = img.width;
            cv.height = img.height;
            const ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, img.width, img.height).data;
            const rows = [];
            for (let y = 0; y < img.height; y += Math.floor(img.height / 8)) {
              let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
              for (let x = 0; x < img.width; x += 16) {
                const idx = (y * img.width + x) * 4;
                rTotal += data[idx];
                gTotal += data[idx+1];
                bTotal += data[idx+2];
                count++;
              }
              rows.push({ y, yNorm: (y/img.height).toFixed(2), r: Math.round(rTotal/count), g: Math.round(gTotal/count), b: Math.round(bTotal/count) });
            }
            res({ width: img.width, height: img.height, rows });
          };
          img.src = url;
        });
      }
      const uppr = await inspectImg('/textures/freemode_base/uppr_diff_000_a_whi.png');
      const lowr = await inspectImg('/textures/freemode_base/lowr_diff_000_a_whi.png');
      resolve({ uppr, lowr });
    })
  `);
  console.log('UPPR rows:', JSON.stringify(info.uppr.rows, null, 2));
  console.log('LOWR rows:', JSON.stringify(info.lowr.rows, null, 2));
  app.quit();
});
