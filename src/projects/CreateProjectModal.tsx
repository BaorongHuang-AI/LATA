import React, { useEffect } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { ProjectWithMetadata } from '../types/project';
import ProjectMetadataForm from './ProjectMetadataForm';

interface CreateProjectModalProps {
    visible: boolean;
    onCancel: () => void;
    onSave: (data: any) => void;
    project?: ProjectWithMetadata | null;
    title?: string;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
    visible,
    onCancel,
    onSave,
    project,
    title = "Create New Project"
}) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (project && visible) {
            form.setFieldsValue({
                title: project.title,
                description: project.description,
                status: project.status,
                source_language: project.metadata?.source_language,
                target_language: project.metadata?.target_language,
                domain: project.metadata?.domain,
                document_type: project.metadata?.document_type,
                source: project.metadata?.source,
                publisher: project.metadata?.publisher,
                publish_date: project.metadata?.publish_date,
                authors: project.metadata?.authors,
                translators: project.metadata?.translators,
                editors: project.metadata?.editors,
                contributors: project.metadata?.contributors,
                doi: project.metadata?.doi,
                isbn: project.metadata?.isbn,
                volume: project.metadata?.volume,
                issue: project.metadata?.issue,
                page_range: project.metadata?.page_range,
                edition: project.metadata?.edition,
                url: project.metadata?.url,
                country: project.metadata?.country,
                copyright_holder: project.metadata?.copyright_holder,
                license: project.metadata?.license,
                access_level: project.metadata?.access_level,
                keywords: project.metadata?.keywords,
                notes: project.metadata?.notes,
            });
        } else if (visible) {
            form.resetFields();
        }
    }, [project, visible, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            const data = {
                project: {
                    title: values.title,
                    description: values.description,
                    status: values.status,
                },
                metadata: {
                    source_language: values.source_language,
                    target_language: values.target_language,
                    domain: values.domain,
                    document_type: values.document_type,
                    source: values.source,
                    publisher: values.publisher,
                    publish_date: values.publish_date,
                    authors: values.authors,
                    translators: values.translators,
                    editors: values.editors,
                    contributors: values.contributors,
                    doi: values.doi,
                    isbn: values.isbn,
                    volume: values.volume,
                    issue: values.issue,
                    page_range: values.page_range,
                    edition: values.edition,
                    url: values.url,
                    country: values.country,
                    copyright_holder: values.copyright_holder,
                    license: values.license,
                    access_level: values.access_level,
                    keywords: values.keywords,
                    notes: values.notes,
                },
            };

            onSave(data);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={title}
            open={visible}
            onCancel={onCancel}
            onOk={handleOk}
            width={700}
            okText={project ? "Save Changes" : "Create Project"}
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                {/* Basic Project Info */}
                <Form.Item
                    name="title"
                    label="Project Name"
                    rules={[{ required: true, message: 'Project name is required' }]}
                >
                    <Input placeholder="Enter project name" />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="Description"
                >
                    <Input.TextArea
                        rows={3}
                        placeholder="Describe the project's purpose..."
                    />
                </Form.Item>

                <Form.Item
                    name="status"
                    label="Status"
                    initialValue="active"
                >
                    <Select>
                        <Select.Option value="active">Active</Select.Option>
                        <Select.Option value="archived">Archived</Select.Option>
                        <Select.Option value="completed">Completed</Select.Option>
                    </Select>
                </Form.Item>

                {/* Metadata Form (required for document inheritance) */}
                <div className="mb-4 pb-4 border-b">
                    <h4 className="text-sm font-semibold text-gray-700">
                        Project Metadata
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                        Documents created under this project will inherit this metadata.
                    </p>
                </div>

                <ProjectMetadataForm form={form} />
            </Form>
        </Modal>
    );
};

export default CreateProjectModal;
