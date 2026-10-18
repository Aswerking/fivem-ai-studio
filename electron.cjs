const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 1024,
    minHeight: 650,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  win.loadURL('http://localhost:5175').catch(() => {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  });

  // اختيار ملف من الجهاز
  ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'اختر ملف الـ Ped لفايف إم',
      properties: ['openFile'],
      filters: [{ name: '3D Models', extensions: ['glb', 'gltf', 'obj'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    const filePath = filePaths[0];
    const fileData = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      buffer: fileData.buffer
    };
  });

  // اختيار مجلد تكسشرات فايف إم بالكامل (مثل freemode_base)
  ipcMain.handle('open-textures-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'اختر مجلد تكسشرات فايف إم (مثل freemode_base)',
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) return null;

    const dirPath = filePaths[0];
    const dirents = fs.readdirSync(dirPath, { withFileTypes: true });
    const supportedExts = ['.png', '.jpg', '.jpeg', '.webp', '.dds', '.bmp'];
    const files = [];

    for (const ent of dirents) {
      if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (supportedExts.includes(ext) || ent.name.toLowerCase().endsWith('.ytd')) {
          const fullPath = path.join(dirPath, ent.name);
          const stat = fs.statSync(fullPath);
          const buf = fs.readFileSync(fullPath);
          let mime = 'image/png';
          if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
          else if (ext === '.webp') mime = 'image/webp';
          else if (ext === '.dds') mime = 'image/x-dds';

          files.push({
            name: ent.name,
            size: stat.size,
            isYtd: ent.name.toLowerCase().endsWith('.ytd'),
            dataUrl: `data:${mime};base64,${buf.toString('base64')}`
          });
        }
      }
    }

    return {
      folderPath: dirPath,
      folderName: path.basename(dirPath),
      files
    };
  });

  // اختيار ملفات تكسشر فردية أو متعددة
  ipcMain.handle('open-texture-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'اختر ملفات التكسشر لفايف إم (.png, .dds, .jpg)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Textures', extensions: ['png', 'jpg', 'jpeg', 'webp', 'dds', 'ytd'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    const files = filePaths.map((filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const buf = fs.readFileSync(filePath);
      let mime = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.dds') mime = 'image/x-dds';

      return {
        name: path.basename(filePath),
        size: buf.length,
        isYtd: filePath.toLowerCase().endsWith('.ytd'),
        dataUrl: `data:${mime};base64,${buf.toString('base64')}`
      };
    });

    return { files };
  });

  // معالجة طلب الذكاء الاصطناعي مباشرة من Node.js لتجاوز قيود CORS
  ipcMain.handle('ask-gemini', async (event, systemPrompt) => {
    return new Promise((resolve, reject) => {
      const apiKey = "AIzaSyC0tUJxtG_mYeL2tWHpImp4hckVX9fpgHo";
      const payload = JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(payload);
      req.end();
    });
  });

  // تحميل واستخراج السيارة الحقيقية (.yft + .ytd + .meta) مباشرة من gta5-mods.com
  ipcMain.handle('fetch-gta5mods-car', async (event, urlOrQuery) => {
    try {
      const { fetchAndExtractGta5ModsCar } = require('./server/gta5ModsExtractor.cjs');
      const result = await fetchAndExtractGta5ModsCar(urlOrQuery);
      const yftBuf = fs.readFileSync(result.yftPath);
      const ytdBuf = result.ytdPath && fs.existsSync(result.ytdPath) ? fs.readFileSync(result.ytdPath) : null;
      return {
        ok: true,
        ...result,
        yftBytes: new Uint8Array(yftBuf),
        ytdBytes: ytdBuf ? new Uint8Array(ytdBuf) : null
      };
    } catch (err) {
      console.warn('[IPC fetch-gta5mods-car error]', err);
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});