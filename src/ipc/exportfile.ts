import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import dbService from '../database/database.service';

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
        return { success: false, error: error.message };
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
        return { success: false, error: error.message };
    }
});