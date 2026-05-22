import React, { useEffect } from "react";
import { Modal, Form, Input, Select, Button, Space } from "antd";
import type { MultimodalPair } from "../types/multimodal";

interface PairEditorModalProps {
    visible: boolean;
    pair?: MultimodalPair | null;
    onCancel: () => void;
    onSave: (data: any) => void;
    onPickImage: () => Promise<{ filePath: string; fileName: string } | null>;
}

const PairEditorModal: React.FC<PairEditorModalProps> = ({
    visible,
    pair,
    onCancel,
    onSave,
    onPickImage,
}) => {
    const [form] = Form.useForm();
    const [srcPath, setSrcPath] = React.useState("");
    const [srcName, setSrcName] = React.useState("");
    const [tgtPath, setTgtPath] = React.useState("");
    const [tgtName, setTgtName] = React.useState("");

    useEffect(() => {
        if (visible) {
            if (pair) {
                form.setFieldsValue(pair);
                setSrcPath(pair.source_image_path || "");
                setSrcName(pair.source_image_name || "");
                setTgtPath(pair.target_image_path || "");
                setTgtName(pair.target_image_name || "");
            } else {
                form.resetFields();
                setSrcPath("");
                setSrcName("");
                setTgtPath("");
                setTgtName("");
            }
        }
    }, [visible, pair, form]);

    const handlePickSource = async () => {
        const result = await onPickImage();
        if (result) {
            setSrcPath(result.filePath);
            setSrcName(result.fileName);
        }
    };

    const handlePickTarget = async () => {
        const result = await onPickImage();
        if (result) {
            setTgtPath(result.filePath);
            setTgtName(result.fileName);
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            onSave({
                ...values,
                source_image_path: srcPath,
                source_image_name: srcName,
                target_image_path: tgtPath,
                target_image_name: tgtName,
            });
        } catch (e) {
            console.error("Validation failed:", e);
        }
    };

    return (
        <Modal
            title={pair ? "Edit Image Pair" : "Create Image Pair"}
            open={visible}
            onCancel={onCancel}
            onOk={handleOk}
            width={800}
            okText={pair ? "Save Changes" : "Create Pair"}
            okButtonProps={{
                style: {
                    backgroundColor: '#1677ff',
                    borderColor: '#1677ff',
                    color: '#fff',
                },
            }}
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="title"
                    label="Title"
                    rules={[{ required: true, message: "Title is required" }]}
                >
                    <Input placeholder="e.g. Product Label Comparison" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <Input.TextArea rows={2} placeholder="Describe the image pair..." />
                </Form.Item>

                <div className="grid grid-cols-2 gap-6">
                    {/* Source Image */}
                    <div className="border rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Source Image</h4>
                        <Space direction="vertical" className="w-full">
                            <Button onClick={handlePickSource} block>
                                {srcPath ? "Change Image" : "Select Image"}
                            </Button>
                            {srcName && (
                                <div className="text-xs text-gray-500 truncate">
                                    {srcName}
                                </div>
                            )}
                            <Form.Item name="source_language" label="Language" className="mb-0">
                                <Input placeholder="e.g. en" />
                            </Form.Item>
                            <Form.Item name="source_description" label="Description" className="mb-0">
                                <Input.TextArea rows={2} placeholder="Describe the source image..." />
                            </Form.Item>
                        </Space>
                    </div>

                    {/* Target Image */}
                    <div className="border rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Target Image</h4>
                        <Space direction="vertical" className="w-full">
                            <Button onClick={handlePickTarget} block>
                                {tgtPath ? "Change Image" : "Select Image"}
                            </Button>
                            {tgtName && (
                                <div className="text-xs text-gray-500 truncate">
                                    {tgtName}
                                </div>
                            )}
                            <Form.Item name="target_language" label="Language" className="mb-0">
                                <Input placeholder="e.g. zh" />
                            </Form.Item>
                            <Form.Item name="target_description" label="Description" className="mb-0">
                                <Input.TextArea rows={2} placeholder="Describe the target image..." />
                            </Form.Item>
                        </Space>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <Form.Item name="domain" label="Domain">
                        <Input placeholder="e.g. marketing, legal, medical" />
                    </Form.Item>
                    <Form.Item name="context_notes" label="Context Notes">
                        <Input.TextArea rows={2} placeholder="Additional context..." />
                    </Form.Item>
                </div>
            </Form>
        </Modal>
    );
};

export default PairEditorModal;
