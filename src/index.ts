// @ts-nocheck
import { app, BrowserWindow, session, dialog, ipcMain } from 'electron';
import * as path from "path";
import "./ipc"; // 👈 THIS LINE IS REQUIRED
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
const db = require('./db/database');
const updateElectronApp = require('update-electron-app');


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function resolveAsset(assetName) {
  return path.join(__dirname, '..', 'assets', assetName);
  if (process.env.NODE_ENV === 'development') {
    // In dev, assets are in project root /assets
    return path.join(__dirname, '..', 'assets', assetName);
  } else {
    // In prod, assets are copied next to main bundle
    return path.join(__dirname, 'assets', assetName);
  }
}

const createWindow = (): void => {
  const iconFile =
      process.platform === 'win32' ? 'icon.ico' :
          process.platform === 'darwin' ? 'icon.icns' : 'icon.png';

  // const iconPath = resolveAsset(iconFile);
  const iconPath = " D:\\linguapilotprojects\\linguapilotelectronfrontend\\src\\assets\\icons\\icon.ico"

  console.log("icon path", iconPath);
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    // icon: process.platform === 'linux' || process.platform === 'win32' ? iconPath : undefined,
    icon: iconPath,
    webPreferences: {
      preload: path.resolve(__dirname, '../renderer', 'main_window', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
  });


  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);


  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};
app.commandLine.appendSwitch('proxy-server', 'http://localhost:4780');



// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.on('ready', createWindow);

app.whenReady().then(() => {
  createWindow();

  // ✅ Auto update (only in production)
  if (app.isPackaged) {
    updateElectronApp();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//
// const { ipcMain } = require('electron');
// const streamifier = require('streamifier'); // You need to install this package
// const FormData = require('form-data');
// const fs = require('fs');
//
//
// ipcMain.on('upload-file', async (event, fileData) => {
//   console.log("fileData", fileData);
//
//   const { fileStream, name, token } = fileData;  // Get the file stream from the renderer
//
//   // Ensure the file stream is valid, using streamifier if needed
//   const readableStream = streamifier.createReadStream(fileStream); // Convert the file stream into a readable stream
//   console.log("cannot read");
//   if (!readableStream) {
//     console.log("cannot read");
//     throw new Error('Invalid file stream');
//   }
//
//   const form = new FormData();
//
//   // Append the stream to the form data (the stream must be a valid Readable stream)
//   form.append('file', readableStream, name);
//
//
//
//   try {
//     console.log("start uploading");
//     const response = await axios.post(
//         'http://localhost:8090/api/v1/filemgr/fileUploadRecord/upload/file',
//         form,
//         {
//           headers: {
//             ...form.getHeaders(),
//             Authorization: `Bearer ${token}`,
//           },
//         }
//     );
//     console.log("response", response.data);
//     event.reply('upload-success', response.data);
//   } catch (error) {
//     console.log("error", error);
//     event.reply('upload-failed', error.message);
//   }
// });
//

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
const fs = require('fs');
const axios = require('axios');
const path = require('path');

ipcMain.on('download-file', async (event, fileInfo) => {
  const { token, url, fileId, filename } = fileInfo;
  const win = BrowserWindow.getFocusedWindow();

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: filename + ".mqxliff",
    });

    if (canceled || !filePath) return;

    const response = await axios.post(url, { fileId }, {
      headers: {
        Authorization: `Bearer ${token}`, // Replace with actual token handling
      },
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on('finish', async () => {
      console.log('Download completed:', filePath);
      await dialog.showMessageBox(win, {
        type: 'info',
        title: '下载成功',
        message: `文件已保存至:\n${filePath}`,
        buttons: ['确定'],
      });
    });

    writer.on('error', async  (err) => {
      console.error('File write error:', err);
      dialog.showErrorBox('保存失败', `无法保存文件:\n${err.message}`);
    });

  } catch (err) {
    console.error('Download failed:', err);
    dialog.showErrorBox('下载失败', `下载过程中发生错误:\n${err.message}`);
  }
});


ipcMain.handle('app:getVersion', () => app.getVersion());

/* ---------- Session ---------- */

ipcMain.handle('session:start', (_, s) =>
    db.prepare(`
    INSERT INTO session (user_id, question_id, condition, started_at)
    VALUES (?, ?, ?, ?)
  `).run(s.userId, s.questionId, s.condition, Date.now()).lastInsertRowid
);

ipcMain.handle('session:end', (_, id) =>
    db.prepare(`UPDATE session SET ended_at=? WHERE id=?`)
        .run(Date.now(), id)
);

/* ---------- Keystrokes ---------- */

ipcMain.handle('log:keystroke', (_, k) =>
    db.prepare(`
    INSERT INTO keystroke_log
    (session_id, event_type, key_value, cursor_position, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(k.sessionId, k.type, k.key, k.cursor, k.time)
);

/* ---------- Versions ---------- */

ipcMain.handle('save:version', (_, v) =>
    db.prepare(`
    INSERT INTO translation_version
    (session_id, version_index, translated_text, is_final, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(v.sessionId, v.index, v.text, v.final ? 1 : 0, Date.now())
);

/* ---------- AI Suggestions ---------- */

ipcMain.handle('ai:show', (_, a) =>
    db.prepare(`
    INSERT INTO ai_suggestion
    (session_id, suggestion_text, shown_at)
    VALUES (?, ?, ?)
  `).run(a.sessionId, a.text, Date.now()).lastInsertRowid
);

ipcMain.handle('ai:resolve', (_, a) =>
    db.prepare(`
    UPDATE ai_suggestion
    SET accepted_text=?, action=?, resolved_at=?
    WHERE id=?
  `).run(a.accepted, a.action, Date.now(), a.id)
);

/* ---------- Export CSV ---------- */

ipcMain.handle('export:csv', (_, table) => {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) return;

  const csv = [
    Object.keys(rows[0]).join(','),
    ...rows.map(r => Object.values(r).map(v => `"${v ?? ''}"`).join(','))
  ].join('\n');

  fs.writeFileSync(`${table}.csv`, csv);
});

/* ---------- Heatmap ---------- */

ipcMain.handle('heatmap', (_, sessionId) =>
    db.prepare(`
    SELECT cursor_position, COUNT(*) freq
    FROM keystroke_log
    WHERE session_id=?
    GROUP BY cursor_position
  `).all(sessionId)
);

/* ---------- Replay ---------- */

ipcMain.handle('replay', (_, sessionId) =>
    db.prepare(`
    SELECT * FROM keystroke_log
    WHERE session_id=?
    ORDER BY timestamp
  `).all(sessionId)
);
ipcMain.handle("getExercises", (_, filter: { cefr?: string; exercise_type?: string }) => {
  let sql = `
    SELECT *
    FROM exercise_template
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filter.cefr) {
    sql += " AND cefr_level = ?";
    params.push(filter.cefr);
  }

  if (filter.exercise_type) {
    sql += " AND exercise_type = ?";
    params.push(filter.exercise_type);
  }

  sql += " ORDER BY created_at DESC";

  return db.prepare(sql).all(...params);
});

ipcMain.handle("saveExercise", (_, data) => {
  const stmt = db.prepare(`
    INSERT INTO session (
      user_id, task_id, source_text, start_time
    ) VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
      data.userId,
      data.taskId,
      data.sourceText,
      Date.now()
  );

  return { sessionId: result.lastInsertRowid };
});


// Get exercise by ID
ipcMain.handle('getExerciseById', (_, id: number) => {
  return db
      .prepare('SELECT * FROM exercise_template WHERE id = ?')
      .get(id);
});

// Create new exercise
ipcMain.handle('createExercise', (_, data: any) => {
  const stmt = db.prepare(`
    INSERT INTO exercise_template (
      title, source_language, target_language,
      source_text, reference_translation,
      directions, exercise_type, difficulty_level,
      cefr_level, image_url, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
      data.title,
      data.source_language,
      data.target_language,
      data.source_text,
      data.reference_translation,
      data.directions,
      data.exercise_type,
      data.difficulty_level,
      data.cefr_level,
      data.image_url,
      data.created_by || null
  );

  return { id: result.lastInsertRowid };
});

// Update existing exercise
ipcMain.handle('updateExercise', (_, data: any) => {
  const stmt = db.prepare(`
    UPDATE exercise_template
    SET title = ?, source_language = ?, target_language = ?,
        source_text = ?, reference_translation = ?, directions = ?,
        exercise_type = ?, difficulty_level = ?, cefr_level = ?,
        image_url = ?
    WHERE id = ?
  `);

  stmt.run(
      data.title,
      data.source_language,
      data.target_language,
      data.source_text,
      data.reference_translation,
      data.directions,
      data.exercise_type,
      data.difficulty_level,
      data.cefr_level,
      data.image_url,
      data.id
  );

  return { success: true };
});

// Search tags for autocomplete
ipcMain.handle('searchTags', (_, keyword: string) => {
  const stmt = db.prepare(`
    SELECT name
    FROM exercise_tag
    WHERE name LIKE ?
    ORDER BY frequency DESC
    LIMIT 20
  `);
  return stmt.all(`%${keyword}%`);
});

// Create new tag if it doesn’t exist
ipcMain.handle('createTag', (_, tagName: string) => {
  const stmt = db.prepare(`
    INSERT INTO exercise_tag (name, frequency)
    VALUES (?, 1)
    ON CONFLICT(name) DO UPDATE SET frequency = frequency + 1
  `);
  stmt.run(tagName);
  return { success: true };
});

// Save or update highlight
ipcMain.handle("saveHighlight", (event, highlight) => {
  const stmt = db.prepare(`
    INSERT INTO highlight (id, session_id, start_index, end_index, comment, type, suggestion)
    VALUES (@id, @session_id, @start_index, @end_index, @comment, @type, @suggestion)
    ON CONFLICT(id) DO UPDATE SET
      comment=@comment,
      type=@type,
      suggestion=@suggestion
  `);
  stmt.run(highlight);
  return true;
});

// Optional: get highlights by session
ipcMain.handle("getHighlights", (event, sessionId) => {
  return db.prepare(`SELECT * FROM highlight WHERE session_id=?`).all(sessionId);
});



