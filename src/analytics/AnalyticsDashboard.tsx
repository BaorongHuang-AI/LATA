import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, message, Modal, Tag } from "antd";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Plus, BarChart3, Trash2, Play } from "lucide-react";
import type { AnalyticsExperiment } from "../types/analytics";

const AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<AnalyticsExperiment[]>([]);

  const load = async () => {
    try {
      setExperiments(await window.api.getAllAnalyticsExperiments());
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = (exp: AnalyticsExperiment) => {
    Modal.confirm({
      title: "Delete experiment?", content: `Delete "${exp.title}" and all its results?`,
      okText: "Delete", okButtonProps: { danger: true, style: { backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' } },
      onOk: async () => { await window.api.deleteAnalyticsExperiment(exp.id!); message.success("Deleted"); load(); },
    });
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "green";
      case "running": return "blue";
      case "error": return "red";
      default: return "default";
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <BarChart3 size={20} className="text-indigo-500" />
        <h1 className="text-lg font-bold text-gray-800">Comparative Translation Analytics</h1>
        <span className="text-xs text-gray-400 ml-2">Research platform for translation studies</span>
        <div className="flex-1" />
        <Button type="primary" icon={<Plus size={14} />}
          onClick={() => navigate("/analytics/new")}
          style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' }}>
          New Experiment
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {experiments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No experiments yet</p>
              <p className="text-xs mt-1">Design your first comparative analysis experiment.</p>
              <Button className="mt-4" type="primary" onClick={() => navigate("/analytics/new")}
                style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' }}>
                Create Experiment
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {experiments.map((exp) => (
              <div key={exp.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition cursor-pointer group"
                onClick={() => navigate(`/analytics/${exp.id}`)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 truncate flex-1">{exp.title}</h3>
                  <div className="flex gap-1 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => handleDelete(exp)} />
                  </div>
                </div>
                {exp.research_question && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{exp.research_question}</p>
                )}
                <div className="flex gap-2 items-center">
                  <Tag color={statusColor(exp.status)}>{exp.status}</Tag>
                  <span className="text-xs text-gray-400">{exp.created_at?.slice(0, 10)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {exp.status === "completed" ? (
                    <Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/analytics/${exp.id}`); }}>
                      View Results
                    </Button>
                  ) : exp.status === "draft" ? (
                    <Button size="small" type="primary" icon={<Play size={12} />}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await window.api.runAnalyticsExperiment(exp.id!);
                          message.success("Experiment completed!");
                          load();
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        } catch (err: any) { message.error(err.message || "Experiment failed"); }
                      }}
                      style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' }}>
                      Run
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
