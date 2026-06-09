// src/main/ipc/database.handlers.ts

import { ipcMain } from 'electron';
import dbService from '../database/database.service';
import {DocumentMetadata} from "../types/database";




    ipcMain.handle('db:createDocument', async (_, doc) => {
        return dbService.createDocument(doc);
    });

    ipcMain.handle('db:getDocument', async (_, id: number) => {
        return dbService.getDocument(id);
    });

    ipcMain.handle('db:getDocumentWithMetadata', async (_, id: number) => {
        return dbService.getDocumentWithMetadata(id);
    });

    ipcMain.handle('db:getAllDocuments', async () => {
        return dbService.getAllDocuments();
    });

    ipcMain.handle('db:updateDocument', async (_, id: number, updates: Partial<Document>) => {
        dbService.updateDocument(id, updates);
        return { success: true };
    });

    ipcMain.handle('db:deleteDocument', async (_, id: number) => {
        // Soft delete — moves to trash
        dbService.deleteDocument(id);
        return { success: true };
    });

    ipcMain.handle('db:permanentDeleteDocument', async (_, id: number) => {
        dbService.permanentDeleteDocument(id);
        return { success: true };
    });

    ipcMain.handle('db:restoreDocument', async (_, id: number) => {
        dbService.restoreDocument(id);
        return { success: true };
    });

    ipcMain.handle('db:getTrashedDocuments', async () => {
        return dbService.getTrashedDocuments();
    });

    // ==================== Metadata ====================

    ipcMain.handle('db:upsertMetadata', async (_, metadata: DocumentMetadata) => {
        dbService.upsertMetadata(metadata);
        return { success: true };
    });

    ipcMain.handle('db:getMetadata', async (_, documentId: number, type: 'source' | 'target') => {
        return dbService.getMetadata(documentId, type);
    });

    // ==================== Combined Operations ====================

    ipcMain.handle('db:saveDocumentWithMetadata', async (_, data) => {
        return dbService.saveDocumentWithMetadata(data);
    });

    ipcMain.handle('db:updateDocumentWithMetadata', async (_, id: number, data) => {
        dbService.updateDocumentWithMetadata(id, data);
        return { success: true };
    });

    // ==================== Search ====================

    ipcMain.handle('db:searchDocuments', async (_, query: string) => {
        return dbService.searchDocuments(query);
    });

    // ==================== Files ====================

    ipcMain.handle('db:addDocumentFile', async (_, file) => {
        return dbService.addDocumentFile(file);
    });

    ipcMain.handle('db:getDocumentFiles', async (_, documentId: number) => {
        return dbService.getDocumentFiles(documentId);
    });

    ipcMain.handle('db:deleteDocumentFile', async (_, id: number) => {
        dbService.deleteDocumentFile(id);
        return { success: true };
    });

    ipcMain.handle("home:getOverview", async () => {
        return dbService.getHomeOverview();
    });


