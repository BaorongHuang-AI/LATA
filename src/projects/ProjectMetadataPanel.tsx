import React, { useState, useEffect } from 'react';
import { Modal, Form } from 'antd';
import { ProjectWithMetadata, ProjectMetadata } from '../types/project';
import ProjectMetadataForm from './ProjectMetadataForm';

interface ProjectMetadataPanelProps {
    visible: boolean;
    project: ProjectWithMetadata | null;
    onCancel: () => void;
    onSave: (data: Partial<ProjectMetadata>) => void;
}

const ProjectMetadataPanel: React.FC<ProjectMetadataPanelProps> = ({
    visible,
    project,
    onCancel,
    onSave
}) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (project?.metadata && visible) {
            form.setFieldsValue({
                source_language: project.metadata.source_language,
                target_language: project.metadata.target_language,
                domain: project.metadata.domain,
                document_type: project.metadata.document_type,
                source: project.metadata.source,
                publisher: project.metadata.publisher,
                publish_date: project.metadata.publish_date,
                authors: project.metadata.authors,
                translators: project.metadata.translators,
                editors: project.metadata.editors,
                contributors: project.metadata.contributors,
                doi: project.metadata.doi,
                isbn: project.metadata.isbn,
                volume: project.metadata.volume,
                issue: project.metadata.issue,
                page_range: project.metadata.page_range,
                edition: project.metadata.edition,
                url: project.metadata.url,
                country: project.metadata.country,
                copyright_holder: project.metadata.copyright_holder,
                license: project.metadata.license,
                access_level: project.metadata.access_level,
                keywords: project.metadata.keywords,
                notes: project.metadata.notes,
            });
        } else if (visible) {
            form.resetFields();
        }
    }, [project, visible, form]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            onSave(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={`Project Metadata: ${project?.title || ''}`}
            open={visible}
            onCancel={onCancel}
            onOk={handleSave}
            width={700}
            okText="Save Changes"
            destroyOnClose
        >
            {project && (
                <p className="text-sm text-gray-500 mb-4">
                    This metadata will be inherited by all documents in the project.
                    Individual documents can override these values.
                </p>
            )}
            <Form form={form} layout="vertical">
                <ProjectMetadataForm form={form} />
            </Form>
        </Modal>
    );
};

export default ProjectMetadataPanel;
