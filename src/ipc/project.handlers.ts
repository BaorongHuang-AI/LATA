import { ipcMain } from 'electron';
import projectService from '../db/projectService';
import {Project, ProjectMetadata, ProjectDocument} from '../types/project';

// ==================== Projects ====================

ipcMain.handle('projects:create', async (_, data) => {
    const id = projectService.createProject(data);
    return { success: true, id };
});

ipcMain.handle('projects:get', async (_, id: number) => {
    return projectService.getProject(id);
});

ipcMain.handle('projects:getWithMetadata', async (_, id: number) => {
    return projectService.getProjectWithMetadata(id);
});

ipcMain.handle('projects:getAll', async () => {
    return projectService.getAllProjects();
});

ipcMain.handle('projects:getAllWithMetadata', async () => {
    return projectService.getAllProjectsWithMetadata();
});

ipcMain.handle('projects:update', async (_, id: number, updates: Partial<Project>) => {
    projectService.updateProject(id, updates);
    return { success: true };
});

ipcMain.handle('projects:delete', async (_, id: number) => {
    projectService.deleteProject(id);
    return { success: true };
});

// ==================== Project Metadata ====================

ipcMain.handle('projects:upsertMetadata', async (_, metadata: ProjectMetadata) => {
    projectService.upsertProjectMetadata(metadata);
    return { success: true };
});

ipcMain.handle('projects:getMetadata', async (_, projectId: number) => {
    return projectService.getProjectMetadata(projectId);
});

ipcMain.handle('projects:getInheritedMetadata', async (_, projectId: number) => {
    return projectService.getInheritedMetadata(projectId);
});

// ==================== Project Documents ====================

ipcMain.handle('projects:getDocuments', async (_, projectId: number) => {
    return projectService.getProjectDocuments(projectId);
});

ipcMain.handle('projects:addDocument', async (_, documentId: number, projectId: number) => {
    projectService.addDocumentToProject(documentId, projectId);
    return { success: true };
});

ipcMain.handle('projects:removeDocument', async (_, documentId: number) => {
    projectService.removeDocumentFromProject(documentId);
    return { success: true };
});

// ==================== Combined Operations ====================

ipcMain.handle('projects:saveWithMetadata', async (_, data) => {
    const id = projectService.saveProjectWithMetadata(data);
    return { success: true, id };
});

ipcMain.handle('projects:updateWithMetadata', async (_, id: number, data) => {
    projectService.updateProjectWithMetadata(id, data);
    return { success: true };
});

// ==================== Export ====================

ipcMain.handle('projects:exportAll', async (_, projectId: number) => {
    // This will be handled by the main process export functionality
    // Return the documents for export
    const documents = projectService.getProjectDocuments(projectId);
    const projectWithMetadata = projectService.getProjectWithMetadata(projectId);
    return { success: true, documents, project: projectWithMetadata };
});
