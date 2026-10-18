const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('http://localhost:5173');
  const result = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        // Search for darker spots (nipples or shading) or variations across the grid
        const grid = [];
        const stepX = Math.floor(img.width / 16);
        const stepY = Math.floor(img.height / 16);
        for (let y = 0; y < img.height; y += stepY) {
          const row = [];
          for (let x = 0; x < img.width; x += stepX) {
            const idx = (y * img.width + x) * 4;
            row.push([data[idx], data[idx+1], data[idx+2]]);
          }
          grid.push({ yFrac: (y / img.height).toFixed(2), colors: row.map(c => Math.round((c[0]+c[1]+c[2])/3)) });
        }
        resolve({ w: img.width, h: img.height, grid });
      };
      img.src = '/textures/freemode_base/uppr_diff_000_a_whi.png';
    })
  `);
  console.log('Image dimensions:', result.w, result.h);
  result.grid.forEach(r => console.log('Y=' + r.yFrac + ':', r.colors.join(' ')));
  app.quit();
});
