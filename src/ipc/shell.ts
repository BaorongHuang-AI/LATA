import { ipcMain, shell } from "electron";

ipcMain.on("shell:openExternal", (_event, url: string) => {
    shell.openExternal(url);
});
