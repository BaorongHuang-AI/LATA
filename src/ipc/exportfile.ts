import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import dbService from '../database/database.service';
import { getDbPath, closeDb } from '../db/db';
import { generateSingleDocumentWorkbook, generateProjectWorkbook, ExcelAlignmentData } from './excelExport';

ipcMain.handle('save-ces-alignment-zip', async (event, { sourceDocXml, targetDocXml, alignXml, sourceDocFilename, targetDocFilename }) => {
    const result = await dialog.showSaveDialog({
        title: 'Save CES Alignment',
        defaultPath: 'ces_alignment.zip',
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    try {
        // Create zip in main process
        const zip = new JSZip();
        zip.file(sourceDocFilename, sourceDocXml);
        zip.file(targetDocFilename, targetDocFilename);
        zip.file('alignment.xml', alignXml);

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(result.filePath, zipBuffer);

        return { success: true, filePath: result.filePath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('save-project-zip', async (event, { projectTitle, documents }) => {
    const result = await dialog.showSaveDialog({
        title: `Export Project: ${projectTitle}`,
        defaultPath: `${projectTitle.replace(/\s+/g, '_')}_export.zip`,
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    try {
        const zip = new JSZip();

        // Create folders for each document
        for (const doc of documents) {
            const docFolder = zip.folder(doc.title.replace(/[\/\\:*?"<>|]/g, '_'));

            if (doc.sourceDocXml) {
                docFolder.file(doc.sourceFilename, doc.sourceDocXml);
            }
            if (doc.targetDocXml) {
                docFolder.file(doc.targetFilename, doc.targetDocXml);
            }
            if (doc.alignXml) {
                docFolder.file('alignment.xml', doc.alignXml);
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(result.filePath, zipBuffer);

        return { success: true, filePath: result.filePath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// ---- Excel Export Handlers ----

ipcMain.handle('save-excel-alignment', async (_event, data: ExcelAlignmentData) => {
    const docTitle = data.documentTitle || 'alignment';
    const defaultName = `${docTitle.replace(/\s+/g, '_')}.xlsx`;

    const result = await dialog.showSaveDialog({
        title: 'Export to Excel',
        defaultPath: defaultName,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    try {
        const workbook = await generateSingleDocumentWorkbook(data);
        const buffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync(result.filePath, buffer as unknown as Buffer);
        return { success: true, filePath: result.filePath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('save-project-excel', async (_event, payload: { projectTitle: string; documents: ExcelAlignmentData[] }) => {
    const { projectTitle, documents } = payload;
    const defaultName = `${projectTitle.replace(/\s+/g, '_')}_export.xlsx`;

    const result = await dialog.showSaveDialog({
        title: `Export Project to Excel: ${projectTitle}`,
        defaultPath: defaultName,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    try {
        const workbook = await generateProjectWorkbook(projectTitle, documents);
        const buffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync(result.filePath, buffer as unknown as Buffer);
        return { success: true, filePath: result.filePath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// ---- Database Export / Import ----

ipcMain.handle('export-database', async () => {
    const dbPath = getDbPath();

    if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Database file not found.' };
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const defaultName = `LATA_backup_${dateStr}.lata`;

    const result = await dialog.showSaveDialog({
        title: 'Export Database Backup',
        defaultPath: defaultName,
        filters: [{ name: 'LATA Backup Files', extensions: ['lata'] }],
    });

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    try {
        // Create a zip containing the sqlite file
        const zip = new JSZip();
        const dbBuffer = fs.readFileSync(dbPath);
        zip.file('lataannotation.sqlite', dbBuffer);

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(result.filePath, zipBuffer);

        // Get file size for confirmation message
        const stats = fs.statSync(result.filePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        return { success: true, filePath: result.filePath, sizeMB };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('import-database', async () => {
    const dbPath = getDbPath();

    const result = await dialog.showOpenDialog({
        title: 'Import Database Backup',
        filters: [
            { name: 'LATA Backup Files', extensions: ['lata'] },
            { name: 'ZIP Files', extensions: ['zip'] },
        ],
        properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    const importPath = result.filePaths[0];

    try {
        // Validate the file
        const importBuffer = fs.readFileSync(importPath);
        let sqliteBuffer: Buffer;

        // Check if it's a zip file (magic bytes: PK)
        if (importBuffer[0] === 0x50 && importBuffer[1] === 0x4b) {
            const zip = new JSZip();
            await zip.loadAsync(importBuffer);

            // Find a .sqlite or .db file in the zip
            const sqliteFile = Object.keys(zip.files).find(
                (name) => name.endsWith('.sqlite') || name.endsWith('.db')
            );

            if (!sqliteFile) {
                return { success: false, error: 'No database file found in the archive. The file must contain a .sqlite or .db file.' };
            }

            sqliteBuffer = await zip.file(sqliteFile)!.async('nodebuffer');
        } else {
            // Treat as raw sqlite file
            sqliteBuffer = importBuffer;
        }

        // Validate it looks like a SQLite file (magic bytes: SQLite format 3\0)
        const sqliteMagic = 'SQLite format 3\x00';
        const header = sqliteBuffer.slice(0, 16).toString('utf8');
        if (!header.startsWith(sqliteMagic)) {
            return { success: false, error: 'The selected file does not appear to be a valid SQLite database.' };
        }

        // Create backup of current DB
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        const backupPath = dbPath.replace('.sqlite', `_backup_${dateStr}.sqlite`);

        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupPath);
        }

        // Close the current database connection
        closeDb();

        // Write the imported database
        fs.writeFileSync(dbPath, sqliteBuffer);

        return { success: true, backupPath };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('restart-app', async () => {
    app.relaunch();
    app.exit(0);
});