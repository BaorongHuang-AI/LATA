import React, {useState} from "react";
import { Sidebar } from "./Sidebar";
import {Routes, Route, useLocation} from "react-router-dom";
import LoginPage from "./LoginPage";

import ForgotPassword from "./ForgotPassword";
import HomePage from "./home/HomePage";
import RegisterPage from "./RegisterPage";
import SettingsLLM from "./settings/SettingsLLM";

import AlignmentManagerPage from "./onlinealign/AlignmentManagerPage";
import DocAlignmentPage from "./onlinealign/DocAlignmentPage";
import {ParaAlignmentPage, SentAlignmentPage} from "./onlinealign/CombinesAlignmentPage";
import PromptManager from "./settings/PromptManager";
import PromptTuner from "./settings/PromptTuner";
import TagManager from "./settings/TagManager";
import MultimodalPage from "./multimodal/MultimodalPage";
import DocumentViewer from "./viewer/DocumentViewer";
import DocumentViewerWrapper from "./viewer/DocumentViewerWrapper";
import ProjectsPage from "./projects/ProjectsPage";
import CorpusAnalysisPage from "./corpus/CorpusAnalysisPage";
import CorpusSearchPage from "./corpus/CorpusSearchPage";
import TerminologyProjectsPage from "./terminology/TerminologyProjectsPage";
import TerminologyProjectDetail from "./terminology/TerminologyProjectDetail";
import TrashboxPage from "./trash/TrashboxPage";
import AnalyticsDashboard from "./analytics/AnalyticsDashboard";
import AnalyticsExperimentPage from "./analytics/AnalyticsExperimentPage";
import SemanticNetworkPage from "./semantic/SemanticNetworkPage";
import StylometricProfilerPage from "./stylometry/StylometricProfilerPage";
import NarrativeAnalysisPage from "./narrative/NarrativeAnalysisPage";
import DatabaseManagerPage from "./database/DatabaseManagerPage";
// import ParaAlignmentPage from "./onlinealign/ParaAlignmentPage";


const Layout = () => {
    const location = useLocation();
    const path = location.pathname;
    // Routes where we do NOT want the sidebar
    const noSidebarRoutes = ["/", "/login", "/forgetPassword", "/register"];
    const showSidebar = !noSidebarRoutes.some((r) => path === r || path.startsWith(r + "/"));
    const [collapsed, setCollapsed] = useState(false);

    // Dynamic content margin based on sidebar width
    const sidebarWidth = collapsed ? 64 : 224; // w-16 = 64px, w-56 = 224px

    return (
        <div className="flex">
            {showSidebar && (
                <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            )}

            <div
                className="flex-1 transition-all duration-300"
                style={{
                    marginLeft: showSidebar ? sidebarWidth : 0,
                }}
            >
                <Routes>
                    <Route path="/" element={<LoginPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/forgetPassword" element={<ForgotPassword />} />
                    <Route path="/promptmanager" element={<PromptManager />} />
                    <Route path="/prompttuner" element={<PromptTuner />} />
                    <Route path="/tagManager" element={<TagManager />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/dashboard" element={<HomePage />} />
                    <Route path="/settings" element={<SettingsLLM />} />
                    <Route path="/docalign" element={<DocAlignmentPage />} />
                    <Route path="/viewer/:id" element={<DocumentViewerWrapper />} />
                    <Route path="/docalign/:documentId" element={<DocAlignmentPage />} />
                    <Route path="/alignpara/:documentId" element={<ParaAlignmentPage />} />
                    <Route path="/alignsent/:documentId" element={<SentAlignmentPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/multimodal" element={<MultimodalPage />} />
                    <Route path="/corpusanalysis" element={<CorpusAnalysisPage />} />
                    <Route path="/corpussearch" element={<CorpusSearchPage />} />
                    <Route path="/terminology" element={<TerminologyProjectsPage />} />
                    <Route path="/terminology/:projectId" element={<TerminologyProjectDetail />} />
                    <Route path="/analytics" element={<AnalyticsDashboard />} />
                    <Route path="/analytics/:experimentId" element={<AnalyticsExperimentPage />} />
                    <Route path="/semantic" element={<SemanticNetworkPage />} />
                    <Route path="/stylometry" element={<StylometricProfilerPage />} />
                    <Route path="/narrative" element={<NarrativeAnalysisPage />} />
                    <Route path="/trash" element={<TrashboxPage />} />
                    <Route path="/database" element={<DatabaseManagerPage />} />
                </Routes>
            </div>
        </div>
    );
};

export default Layout;
