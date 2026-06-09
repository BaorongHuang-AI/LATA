import React, { useEffect, useState, useCallback } from "react";
import { message, Modal, Spin, Tag } from "antd";
import { Trash2, RotateCcw, AlertTriangle, FileText } from "lucide-react";
import type { Document } from "../types/database";

interface TrashedDocument extends Document {
  project_title?: string | null;
}

const TrashboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<TrashedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.getTrashedDocuments();
      setDocuments(data || []);
    } catch (e) {
      console.error("Failed to load trash:", e);
      message.error("Failed to load trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRestore = async (doc: TrashedDocument) => {
    if (!doc.id) return;
    setRestoringId(doc.id);
    try {
      await window.api.restoreDocument(doc.id);
      message.success(`"${doc.title}" restored successfully`);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      message.error("Failed to restore document");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = (doc: TrashedDocument) => {
    if (!doc.id) return;
    Modal.confirm({
      title: "Permanently Delete",
      icon: <AlertTriangle size={20} className="text-red-500" />,
      content: (
        <div>
          <p>
            Are you sure you want to permanently delete{" "}
            <strong>"{doc.title}"</strong>?
          </p>
          <p className="text-red-500 mt-2 text-sm">
            This will remove the document and all its alignments from the
            database. This action cannot be undone.
          </p>
        </div>
      ),
      okText: "Delete Forever",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        setDeletingId(doc.id!);
        try {
          await window.api.permanentDeleteDocument(doc.id!);
          message.success(`"${doc.title}" permanently deleted`);
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        } catch (e) {
          message.error("Failed to delete document");
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleEmptyTrash = () => {
    if (documents.length === 0) return;
    Modal.confirm({
      title: "Empty Trash",
      icon: <AlertTriangle size={20} className="text-red-500" />,
      content: (
        <div>
          <p>
            Are you sure you want to permanently delete{" "}
            <strong>all {documents.length} document(s)</strong> in the trash?
          </p>
          <p className="text-red-500 mt-2 text-sm">
            This action cannot be undone.
          </p>
        </div>
      ),
      okText: "Empty Trash",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        setLoading(true);
        try {
          for (const doc of documents) {
            if (doc.id) {
              await window.api.permanentDeleteDocument(doc.id);
            }
          }
          message.success("Trash emptied");
          setDocuments([]);
        } catch (e) {
          message.error("Failed to empty trash");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Trash2 size={20} className="text-red-500" />
        <h1 className="text-lg font-bold text-gray-800">Trash</h1>
        <span className="text-xs text-gray-400 ml-2">
          Deleted documents — restore or permanently delete them
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spin size="large" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Trash2 size={48} className="text-gray-300" />
            <div className="text-sm text-center">
              Trash is empty. Deleted documents will appear here.
            </div>
          </div>
        ) : (
          <>
            {/* Header with Empty Trash */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-500">
                {documents.length} document{documents.length !== 1 ? "s" : ""} in
                trash
              </div>
              <button
                onClick={handleEmptyTrash}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-red-50 text-red-600 hover:bg-red-100 transition"
              >
                <Trash2 size={14} />
                Empty Trash
              </button>
            </div>

            {/* Document list */}
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm flex items-center gap-4 px-4 py-3"
                >
                  {/* Icon */}
                  <div className="shrink-0 w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-red-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {doc.title}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {doc.status && (
                        <Tag className="text-[10px] leading-tight" color="blue">
                          {doc.status}
                        </Tag>
                      )}
                      {doc.project_title && (
                        <Tag className="text-[10px] leading-tight" color="purple">
                          {doc.project_title}
                        </Tag>
                      )}
                      {doc.deleted_at && (
                        <Tag className="text-[10px] leading-tight" color="red">
                          Deleted: {formatDate(doc.deleted_at)}
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={restoringId === doc.id}
                      onClick={() => handleRestore(doc)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition"
                      title="Restore document"
                    >
                      <RotateCcw size={14} />
                      {restoringId === doc.id ? "Restoring..." : "Restore"}
                    </button>
                    <button
                      disabled={deletingId === doc.id}
                      onClick={() => handlePermanentDelete(doc)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
                      title="Delete forever"
                    >
                      <Trash2 size={14} />
                      {deletingId === doc.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrashboxPage;
