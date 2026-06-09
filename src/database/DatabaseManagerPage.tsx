import React, { useState } from "react";
import { message, Modal } from "antd";
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const DatabaseManagerPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // ---- Export ----

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await window.api.exportDatabase();
      if (result.canceled) return;
      if (result.success) {
        message.success(
          `Database exported successfully (${result.sizeMB || "?"} MB)`
        );
      } else {
        message.error(result.error || "Export failed");
      }
    } catch (e) {
      message.error("Export failed: " + (e instanceof Error ? e.message : e));
    } finally {
      setExporting(false);
    }
  };

  // ---- Import ----

  const handleImport = () => {
    Modal.confirm({
      title: "Import Database Backup",
      icon: <AlertTriangle size={24} className="text-amber-500" />,
      content: (
        <div className="space-y-3">
          <p className="font-semibold text-gray-800">
            You are about to replace your entire database.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠️ Important warnings:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                A backup of your current database will be created
                automatically.
              </li>
              <li>
                All current data (documents, alignments, settings) will be
                replaced with the imported data.
              </li>
              <li>
                The application will restart after a successful import.
              </li>
              <li>This action cannot be undone.</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            Please ensure you have selected the correct backup file (.lata or
            .zip).
          </p>
        </div>
      ),
      okText: "I Understand, Continue",
      okButtonProps: {
        style: { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
      },
      cancelText: "Cancel",
      width: 520,
      onOk: async () => {
        setImporting(true);
        try {
          const result = await window.api.importDatabase();
          if (result.canceled) return;
          if (result.success) {
            Modal.success({
              title: "Import Successful",
              icon: <CheckCircle size={24} className="text-green-500" />,
              content: (
                <div className="space-y-2">
                  <p>The database has been imported successfully.</p>
                  {result.backupPath && (
                    <p className="text-sm text-gray-500">
                      A backup of your previous database was saved to:{" "}
                      <code className="bg-gray-100 px-1 rounded text-xs break-all">
                        {result.backupPath}
                      </code>
                    </p>
                  )}
                  <p className="font-semibold">
                    The application will now restart to apply the changes.
                  </p>
                </div>
              ),
              okText: "Restart Now",
              onOk: () => {
                window.api.restartApp();
              },
            });
          } else {
            message.error(result.error || "Import failed");
          }
        } catch (e) {
          message.error(
            "Import failed: " + (e instanceof Error ? e.message : e)
          );
        } finally {
          setImporting(false);
        }
      },
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Database size={20} className="text-indigo-500" />
        <h1 className="text-lg font-bold text-gray-800">Database Manager</h1>
        <span className="text-xs text-gray-400 ml-2">
          Export or import the application database
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Export Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <Download size={24} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-800">
                  Export Database
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Create a compressed backup file (.lata) of your entire
                  database, including all documents, alignments, settings, and
                  user accounts. You can send this file to others or keep it as
                  a backup.
                </p>

                <div className="bg-gray-50 rounded-lg p-3 mt-3 text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">What's included:</span> All
                    documents, alignments, projects, metadata, LLM settings,
                    prompts, tags, and user accounts.
                  </p>
                  <p>
                    <span className="font-medium">Format:</span> Compressed ZIP
                    archive with <code className="bg-gray-200 px-1 rounded text-xs">.lata</code> extension.
                  </p>
                </div>

                <button
                  disabled={exporting}
                  onClick={handleExport}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
                >
                  <Download size={16} />
                  {exporting ? "Exporting..." : "Export Database"}
                </button>
              </div>
            </div>
          </div>

          {/* Import Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                <Upload size={24} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-800">
                  Import Database
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Replace the current database with a previously exported backup
                  file (.lata). A backup of your existing database will be
                  created automatically before importing.
                </p>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 text-sm text-amber-800">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={14} />
                    Important warnings
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      All existing data will be replaced with the imported data.
                    </li>
                    <li>
                      A backup of your current database will be saved alongside
                      the database file.
                    </li>
                    <li>The application will restart after import.</li>
                    <li>
                      Only import files that were exported from LATA (
                      <code className="bg-amber-100 px-1 rounded text-xs">.lata</code> format) or valid SQLite databases.
                    </li>
                  </ul>
                </div>

                <button
                  disabled={importing}
                  onClick={handleImport}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 transition text-sm font-medium"
                >
                  <Upload size={16} />
                  {importing ? "Importing..." : "Import Database"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseManagerPage;
