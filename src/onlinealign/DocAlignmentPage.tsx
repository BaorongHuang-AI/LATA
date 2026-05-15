import React, {useEffect, useState} from "react";
import {Form, Input, Button, Divider, Collapse, message} from "antd";
import { FileText, Languages, AlignLeft } from "lucide-react";
import DocumentMetadataPanel from "./DocumentMetadataPanel";
import {isRTL, validateMetadata} from "../utils/AlignUtils";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {DocumentMeta} from "../types/database";

// import {useDocument} from "../renderer/hooks/useDocument";


const { TextArea } = Input;
const { Panel } = Collapse;
const DocAlignmentPage: React.FC = () => {
    const { documentId } = useParams<{ documentId: string }>();
    const [document, setDocument] = useState<Document | null>(null);
    const [form] = Form.useForm();
    const [errors, setErrors] = useState<string[]>([]);
    const [locked, setLocked] = useState(false);
    const [syncedFields, setSyncedFields] = useState<Set<string>>(new Set());
    // const { document, loading, saving, saveDocument, updateDocument } = useDocument(documentId);
    const sourceMeta = Form.useWatch<DocumentMeta>("sourceMeta", form);
    const targetMeta = Form.useWatch<DocumentMeta>("targetMeta", form);
    const isExistingDoc = !!documentId;
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const projectId = (location.state as any)?.projectId as number | undefined;
    const [alignLoading, setAlignLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [activeDocumentId, setActiveDocumentId] = useState<number | null>(
        documentId ? Number(documentId) : null
    );

    const [progress, setProgress] = useState({
        stage: "",
        percent: 0,
        detail: { current: 0, total: 0 }
    });

    const handleSyncToggle = (field: string) => {
        setSyncedFields(prev => {
            const next = new Set(prev);
            if (next.has(field)) {
                next.delete(field);
            } else {
                next.add(field);
                const sourceValue = form.getFieldValue(['sourceMeta', field]);
                if (sourceValue !== undefined) {
                    const targetMetaVal = form.getFieldValue('targetMeta') || {};
                    form.setFieldsValue({
                        targetMeta: { ...targetMetaVal, [field]: sourceValue },
                    });
                }
            }
            return next;
        });
    };

    // useEffect(() => {
    //     if (!documentId || !alignLoading) return;
    //
    //     let timer: NodeJS.Timeout;
    //
    //     const pollStatus = async () => {
    //         try {
    //             const status = await window.api.getDocumentStatus(Number(documentId));
    //             // setAlignStatus(status);
    //
    //             // stop polling when done
    //             if (status === "review" || status === "error") {
    //                 clearInterval(timer);
    //                 setAlignLoading(false);
    //
    //                 if (status === "review") {
    //                     message.success("Alignment completed");
    //                     navigate(`/alignsent/${documentId}`);
    //                 }
    //             }
    //         } catch (e) {
    //             console.error(e);
    //         }
    //     };
    //
    //     timer = setInterval(pollStatus, 1500); // every 1.5s
    //     pollStatus(); // run immediately
    //
    //     return () => clearInterval(timer);
    // }, [documentId, alignLoading]);



    const pollStatus = async (docId: number) => {
        if (!docId) return;
        try {
           const timer = setInterval(pollStatus, 1500); // every 1.5s
            const status = await window.api.getDocumentStatus(Number(docId));
            // setAlignStatus(status);

            // stop polling when done
            if (status === "review" || status === "error") {
                clearInterval(timer);
                setAlignLoading(false);

                if (status === "review") {
                    message.success("Alignment completed");
                    navigate(`/alignsent/${docId}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        const handler = (data) => {
            console.log("progress data", data);

            setProgress(data);
            // if(data.stage == 'review' && data.percent === 100){
            //     requestAnimationFrame(() => {
            //         pollStatus();
            //     });
            // }
        };


        window.api.onAlignmentProgress(handler);
        window.api.onAlignmentFinished(async () => {
            console.log("finished")
            setProgress((p) => ({ ...p, stage: "review", percent: 100 }));
            await pollStatus(activeDocumentId);
        });

        return () => {
            window.api.removeAlignmentProgress(handler);
        };
    }, []);



    useEffect(() => {
        if (!isExistingDoc) {
            localStorage.removeItem("aligner-meta-draft");
            form.resetFields();
        }

        setLoading(true);

        window.api
            .getDocumentWithMetadata(Number(activeDocumentId))
            .then((res) => {
                console.log("doc", res);
                setLoading(false);
                if (!res) return;
                setDocument(res.document);
                form.setFieldsValue({
                    sourceMeta: res.sourceMeta,
                    targetMeta: res.targetMeta,
                    sourceContent: res.document.source_content,
                    targetContent: res.document.target_content,
                });

                setLocked(res.document.status !== "draft");
            })
            .catch(console.error);
    }, [documentId, form]);
    /* =====================
       Auto-save metadata
    ===================== */
    useEffect(() => {
        if (isExistingDoc) return;

        const draft = localStorage.getItem("aligner-meta-draft");
        if (draft) {
            form.setFieldsValue(JSON.parse(draft));
        }
    }, [form, isExistingDoc]);

    useEffect(() => {
        if (isExistingDoc) return;

        const values = form.getFieldsValue();

        localStorage.setItem(
            "aligner-meta-draft",
            JSON.stringify(values)
        );
    }, [sourceMeta, targetMeta]);

    useEffect(() => {
        if (isExistingDoc || !projectId) return;

        window.api.getProjectMetadata(projectId).then((pm: any) => {
            if (!pm) return;
            const sourceMetaDefaults: Record<string, any> = {};
            const targetMetaDefaults: Record<string, any> = {};

            if (pm.source) { sourceMetaDefaults.source = pm.source; targetMetaDefaults.source = pm.source; }
            if (pm.publisher) { sourceMetaDefaults.publisher = pm.publisher; targetMetaDefaults.publisher = pm.publisher; }
            if (pm.publish_date) { sourceMetaDefaults.publishDate = pm.publish_date; targetMetaDefaults.publishDate = pm.publish_date; }
            if (pm.domain) { sourceMetaDefaults.domain = pm.domain; targetMetaDefaults.domain = pm.domain; }
            if (pm.source_language) sourceMetaDefaults.language = pm.source_language;
            if (pm.target_language) targetMetaDefaults.language = pm.target_language;
            if (pm.authors) { sourceMetaDefaults.authors = pm.authors; targetMetaDefaults.authors = pm.authors; }
            if (pm.translators) { sourceMetaDefaults.translators = pm.translators; targetMetaDefaults.translators = pm.translators; }
            if (pm.editors) { sourceMetaDefaults.editors = pm.editors; targetMetaDefaults.editors = pm.editors; }
            if (pm.contributors) { sourceMetaDefaults.contributors = pm.contributors; targetMetaDefaults.contributors = pm.contributors; }
            if (pm.doi) { sourceMetaDefaults.doi = pm.doi; targetMetaDefaults.doi = pm.doi; }
            if (pm.isbn) { sourceMetaDefaults.isbn = pm.isbn; targetMetaDefaults.isbn = pm.isbn; }
            if (pm.volume) { sourceMetaDefaults.volume = pm.volume; targetMetaDefaults.volume = pm.volume; }
            if (pm.issue) { sourceMetaDefaults.issue = pm.issue; targetMetaDefaults.issue = pm.issue; }
            if (pm.page_range) { sourceMetaDefaults.pageRange = pm.page_range; targetMetaDefaults.pageRange = pm.page_range; }
            if (pm.edition) { sourceMetaDefaults.edition = pm.edition; targetMetaDefaults.edition = pm.edition; }
            if (pm.url) { sourceMetaDefaults.url = pm.url; targetMetaDefaults.url = pm.url; }
            if (pm.country) { sourceMetaDefaults.country = pm.country; targetMetaDefaults.country = pm.country; }
            if (pm.copyright_holder) { sourceMetaDefaults.copyrightHolder = pm.copyright_holder; targetMetaDefaults.copyrightHolder = pm.copyright_holder; }
            if (pm.license) { sourceMetaDefaults.license = pm.license; targetMetaDefaults.license = pm.license; }
            if (pm.access_level) { sourceMetaDefaults.accessLevel = pm.access_level; targetMetaDefaults.accessLevel = pm.access_level; }
            if (pm.keywords) { sourceMetaDefaults.keywords = pm.keywords; targetMetaDefaults.keywords = pm.keywords; }
            if (pm.notes) { sourceMetaDefaults.notes = pm.notes; targetMetaDefaults.notes = pm.notes; }

            const currentValues = form.getFieldsValue();
            form.setFieldsValue({
                sourceMeta: { ...(currentValues.sourceMeta || {}), ...sourceMetaDefaults },
                targetMeta: { ...(currentValues.targetMeta || {}), ...targetMetaDefaults },
            });
        }).catch(console.error);
    }, [projectId, isExistingDoc]);

    /* =====================
       Validation helpers
    ===================== */
    const sourceContent: string = Form.useWatch("sourceContent", form) || "";
    const targetContent: string = Form.useWatch("targetContent", form) || "";

    const hasContent = sourceContent.trim().length > 0 || targetContent.trim().length > 0;
    const isValid =
        hasContent &&
        !validateMetadata(sourceMeta, "Source").length &&
        !validateMetadata(targetMeta, "Target").length;

    const saveDocument = async () => {
        await form.validateFields();

        const values = form.getFieldsValue();

        if (!values.sourceContent?.trim() && !values.targetContent?.trim()) {
            message.warning("Please enter content for at least one side before saving.");
            throw new Error("No content");
        }

        const docPayload: any = {
            title:
                (values.sourceMeta?.title || "Untitled") + "_" +
                (values.targetMeta?.title || "Untitled"),
            status: "draft",
            source_content: values.sourceContent || "",
            target_content: values.targetContent || "",
        };

        if (projectId) {
            docPayload.project_id = projectId;
        }

        const payload = {
            document: docPayload,
            sourceMetadata: values.sourceMeta,
            targetMetadata: values.targetMeta,
        };

        if (documentId) {
            await window.api.updateDocumentWithMetadata(Number(documentId), payload);
            return documentId;
        } else {
            const newId = await window.api.saveDocumentWithMetadata(payload);
            setActiveDocumentId(newId);
            return newId;
        }
    };


    const handleAlign = async () => {
        // if (!documentId) return;

        setAlignLoading(true);

        try {
            await form.validateFields();

            const sourceErrors = validateMetadata(sourceMeta, "Source document");
            const targetErrors = validateMetadata(targetMeta, "Target document");

            // const rtlWarnings: string[] = [];
            // if (isRTL(sourceMeta?.language) !== isRTL(targetMeta?.language)) {
            //     rtlWarnings.push("Source and Target language direction mismatch (RTL/LTR).");
            // }
            console.log(" errors", sourceErrors ,  targetErrors);
            const allErrors = [...sourceErrors, ...targetErrors];
            console.log("all errors", allErrors);

            if (allErrors.length > 0) {
                setErrors(allErrors);
                return;
            }

            setErrors([]);
            setLocked(true);

            // ✅ SAVE without navigation
            const savedId = await saveDocument();
            setActiveDocumentId(Number(savedId));
            const values = form.getFieldsValue();

            // await window.api.alignParas({
            //     documentId: Number(savedId),
            //     sourceText: values.sourceContent,
            //     targetText: values.targetContent,
            // });

            message.info("Alignment started...");
            if (running) return;

            setRunning(true);
            try {
                await window.api.alignParas({
                    documentId: Number(savedId),
                    sourceText: values.sourceContent,
                    targetText: values.targetContent,
                    srcLang: sourceMeta.language,
                    tgtLang: targetMeta.language,
                });
                setActiveDocumentId(Number(savedId));
                await pollStatus(Number(savedId)); //
            } finally {
                setRunning(false);
            }


            // message.success("Paragraph alignment started");
            // navigate(`/alignsent/${savedId}`);
            // setAlignStatus("processing");

        } catch (e) {
            console.error(e);
            message.error("Failed to start alignment");
        } finally {
            // setAlignLoading(false);
        }
    };

    // const handleAlign = async () => {
    //     if (!documentId) return;
    //     try {
    //         await form.validateFields(); // 🔴 highlight missing fields
    //     } catch {
    //         return;
    //     }
    //
    //     // console.log("Aligner input:", form.getFieldsValue());
    //     const sourceErrors = validateMetadata(sourceMeta, "Source document");
    //     const targetErrors = validateMetadata(targetMeta, "Target document");
    //
    //     const rtlWarnings: string[] = [];
    //     if (isRTL(sourceMeta?.language) !== isRTL(targetMeta?.language)) {
    //         rtlWarnings.push("Source and Target language direction mismatch (RTL/LTR).");
    //     }
    //
    //     const allErrors = [...sourceErrors, ...targetErrors, ...rtlWarnings];
    //
    //     if (allErrors.length > 0) {
    //         setErrors(allErrors);
    //         return;
    //     }
    //
    //     setErrors([]);
    //     setLocked(true); // 🔒 lock metadata
    //     await handleSave();
    //     const values = form.getFieldsValue();
    //     console.log("values", values);
    //     const sourceText = values.sourceContent;
    //     const targetText = values.targetContent;
    //
    //
    //     await window.api.alignParas({
    //         documentId,
    //         sourceText,
    //         targetText,
    //     });
    //
    //     message.success("Paragraph alignment started");
    //     navigate("/alignpara/" + documentId)
    //
    // };

    const handleSave = async () => {
        try {
            const id = await saveDocument();
            message.success("Document saved");
            navigate(`/docalign/${id}`);
        } catch (e) {
            console.error(e);
            message.error("Failed to save document");
        }
    };

    // const handleSave = async () => {
    //     try {
    //         await form.validateFields();
    //     } catch {
    //         return;
    //     }
    //
    //     const values = form.getFieldsValue();
    //
    //     const payload = {
    //         document: {
    //             title:
    //                 values.sourceMeta?.title + "_" +
    //                 values.targetMeta?.title,
    //             // status: locked ? "locked" : "draft",
    //             status:  "draft",
    //             source_content: values.sourceContent,
    //             target_content: values.targetContent
    //         },
    //         sourceMetadata: values.sourceMeta,
    //         targetMetadata: values.targetMeta,
    //     };
    //
    //     try {
    //         if (documentId) {
    //             await window.api.updateDocumentWithMetadata(Number(documentId), payload);
    //             message.success("Document updated");
    //             navigate(`/aligner/${documentId}`);
    //         } else {
    //             const newId = await window.api.saveDocumentWithMetadata(payload);
    //             message.success("Document saved");
    //              navigate(`/aligner/${newId}`);
    //         }
    //     } catch (e) {
    //         console.error(e);
    //         message.error("Failed to save document");
    //     }
    // };


    return (
        <div className="h-full bg-gray-100 p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <AlignLeft className="h-6 w-6 text-blue-600" />
                    <h1 className="text-xl font-semibold">Document Aligner</h1>
                    <p className="text-gray-500">
                        Document:  {document?.title}
                    </p>
                </div>

                {errors.length > 0 && (
                    <div className="alert alert-error">
                        <ul className="list-disc pl-5 text-sm">
                            {errors.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <Form
                    form={form}
                    layout="vertical"
                    className="space-y-2"
                >
                    {/* ========== Metadata ========== */}
                    <Collapse defaultActiveKey={["allmeta"]} ghost className="rounded-md border">
                        <Panel
                            key="allmeta"
                            header={
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-lg">
                                        Document Metadata
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        (Source & Target)
                                    </span>
                                </div>
                            }
                        >
                            <div className="rounded-lg bg-white p-6 shadow-sm">
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <DocumentMetadataPanel
                                        name="sourceMeta"
                                        title="Source Document Metadata"
                                        // disabled={locked}
                                    />

                                    <DocumentMetadataPanel
                                        name="targetMeta"
                                        title="Target Document Metadata"
                                        isTarget
                                        syncedFields={syncedFields}
                                        onSyncToggle={handleSyncToggle}
                                    />
                                </div>
                            </div>
                        </Panel>
                    </Collapse>

                    {/* ========== Text Input ========== */}
                    <div className="rounded-lg bg-white p-6 m-3 shadow-sm">
                        <h2 className="mb-4 text-lg font-medium">Document Content</h2>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <Form.Item name="sourceContent" label="Source Document Text">
                                <TextArea
                                    rows={16}
                                    placeholder="Paste source document text here…"
                                    className="font-mono"
                                    dir={isRTL(sourceMeta?.language) ? "rtl" : "ltr"}
                                />
                            </Form.Item>

                            <Form.Item name="targetContent" label="Target Document Text">
                                <TextArea
                                    rows={16}
                                    placeholder="Paste target document text here…"
                                    className="font-mono"
                                    dir={isRTL(targetMeta?.language) ? "rtl" : "ltr"}
                                />
                            </Form.Item>
                        </div>
                    </div>

                    <Divider />
                    {alignLoading && (
                        <div className="mb-4 rounded-md bg-white p-4 shadow-sm border">

                            <div className="flex justify-between text-sm mb-2">
            <span>
                {progress.stage === "splitting" && "📄 Splitting sentences..."}
                {progress.stage === "aligning" && "🔍 Aligning..."}
                {progress.stage === "repairing" && "🛠 Revising..."}
            </span>

                                <span>{progress.percent}%</span>
                            </div>

                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>

                            <div className="text-xs text-gray-500 mt-1">
                                {Math.round(progress.detail.current)} / {progress.detail.total}
                            </div>
                            <Divider />
                        </div>
                    )}
                    {/* ========== Actions ========== */}
                    <div className="flex justify-end gap-3">
                        <Button onClick={() => form.resetFields()}
                                loading={alignLoading}
                                className="btn btn-default"
                        >
                            Clear
                        </Button>
                        <Button
                            loading={alignLoading}
                            onClick={handleSave}
                            className="btn btn-secondary"
                            disabled={!isValid}
                        >
                            {documentId ? "Update" : "Save Draft"}
                        </Button>

                        <Button
                            loading={alignLoading}

                            className="
                            btn btn-primary
                          bg-blue-600 hover:bg-blue-700
                          text-white
                           rounded-md
                          disabled:bg-blue-400
                        "
                            disabled={!isValid}
                            onClick={handleAlign}
                        >
                            Run Alignment
                        </Button>
                    </div>
                </Form>
            </div>

        </div>
    );
};

export default DocAlignmentPage;
