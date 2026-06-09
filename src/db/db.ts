import path from "path";
import {PipelineLogger} from "../ipc/PipelineLogger";
const Database = require('better-sqlite3');
// export const db = new Database(
//     // path.join(process.env.HOME || process.env.APPDATA, 'experiment.sqlite')
//     path.join( 'experiment.sqlite')
// );

// import path from "path";
// const Database = require('better-sqlite3');
// const path = require('path');
// 获取可执行文件所在目录（例如：C:\Program Files\MyApp\）
// const exeDir = path.dirname(app.getPath('exe'));
//
// // 将数据库放在 exe 同级目录下
// const dbPath = path.join(exeDir, 'experiment.sqlite');
// console.log(dbPath)
// export const db = new Database(
//     dbPath
// );
const logger = new PipelineLogger(1);
const dbPath =  path.join(process.env.HOME || process.env.APPDATA, 'lataannotation.sqlite');
console.log("dbpath", dbPath);
logger.raw("dbpath", dbPath);
export const db = new Database(
    dbPath
    // path.join( 'experiment.sqlite')
);

export function getDbPath(): string {
    return dbPath;
}

export function closeDb(): void {
    try {
        db.close();
    } catch {
        // Already closed or error — ignore
    }
}
//
// const sqlFilePath = path.join(app.getAppPath(), "sql", "main.sql");
// console.log("sqlfile path", sqlFilePath);
// // 2. Read the file
// const sql = fs.readFileSync(sqlFilePath, "utf-8");
//
//
// // 3. Execute all statements in the file
// try {
//     db.exec(sql);
//     console.log("Database initialized successfully from main.sql");
// } catch (err) {
//     console.error("Failed to initialize database:", err);
// }
