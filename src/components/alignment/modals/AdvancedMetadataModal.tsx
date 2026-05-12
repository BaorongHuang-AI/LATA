// src/components/alignment/modals/MetadataModal.tsx
import React from 'react';
import {Modal, Form, Input, message} from 'antd';
import type { AlignmentMetadata } from '../../../types/alignment';
import DocumentMetadataPanel from "../../../onlinealign/DocumentMetadataPanel";
import {DocumentMetadata} from "../../../utils/AlignUtils";

const { TextArea } = Input;

interface MetadataModalProps {
    documentId: any
    visible: boolean;
    sourceMeta: DocumentMetadata;
    targetMeta: DocumentMetadata;
    setSourceMeta: (metadata: DocumentMetadata) => void;
    setTargetMeta: (metadata: DocumentMetadata) => void;
    onClose: () => void;
}

export const AdvancedMetadataModal: React.FC<MetadataModalProps> = ({
                                                                documentId,
                                                                visible,
                                                                sourceMeta,
                                                                targetMeta,
                                                                setSourceMeta,
                                                                setTargetMeta,
                                                                onClose,
                                                            }) => {
    const [form] = Form.useForm();
    const [syncedFields, setSyncedFields] = React.useState<Set<string>>(new Set());

    const handleSyncToggle = (field: string) => {
        setSyncedFields(prev => {
            const next = new Set(prev);
            if (next.has(field)) {
                next.delete(field);
            } else {
                next.add(field);
                const sourceValue = form.getFieldValue(['sourceMeta', field]);
                if (sourceValue !== undefined) {
                    const targetMeta = form.getFieldValue('targetMeta') || {};
                    form.setFieldsValue({
                        targetMeta: { ...targetMeta, [field]: sourceValue },
                    });
                }
            }
            return next;
        });
    };

    const handleMetadataSave = async (
        sourceMeta: any,
        targetMeta: any
    ) => {
        setSourceMeta(sourceMeta);
        setTargetMeta(targetMeta);

        await window.api.updateDocumentMetadata({
            documentId,
            sourceMeta,
            targetMeta,
        });

        message.success("Metadata saved");
    };

    return (
        <Modal
            open={visible}
            title="Document Metadata"
            width={1100}
            destroyOnClose
            okText="Save"
            onCancel={onClose}
            okButtonProps={{
                type: 'primary',
                className: '!bg-blue-500 !border-blue-500 !text-white',
            }}
            onOk={async () => {
                try {
                    const values = await form.validateFields(); // validateFields returns a Promise
                    setSourceMeta(values.sourceMeta);
                    setTargetMeta(values.targetMeta);
                    await handleMetadataSave(values.sourceMeta, values.targetMeta);
                    onClose();
                } catch (error) {
                    // validation failed or save failed
                    console.error("Validation or save failed:", error);
                    // Ant Design's Form validation errors are automatically shown,
                    // so you usually don't need to show another message here
                }
            }}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    sourceMeta: sourceMeta ?? {},
                    targetMeta: targetMeta ?? {},
                }}
            >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <DocumentMetadataPanel
                        name="sourceMeta"
                        title="Source Document Metadata"
                    />

                    <DocumentMetadataPanel
                        name="targetMeta"
                        title="Target Document Metadata"
                        isTarget
                        syncedFields={syncedFields}
                        onSyncToggle={handleSyncToggle}
                    />
                </div>
            </Form>
    </Modal>
);
};