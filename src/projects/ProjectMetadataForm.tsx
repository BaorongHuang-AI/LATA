import React, { useState } from 'react';
import { Form, Input, DatePicker, Select } from 'antd';
import { DOMAIN_OPTIONS, LANGUAGE_OPTIONS, DOCUMENT_TYPE_OPTIONS, LICENSE_OPTIONS, ACCESS_LEVEL_OPTIONS } from '../utils/Constants';

interface ProjectMetadataFormProps {
    form: any;
}

const ProjectMetadataForm: React.FC<ProjectMetadataFormProps> = ({ form }) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">
                Project Metadata (Will be inherited by documents)
            </h4>

            {/* Basic Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item
                    name="source_language"
                    label="Source Language"
                    rules={[{ required: true, message: "Language is required" }]}
                >
                    <Select
                        options={LANGUAGE_OPTIONS}
                        placeholder="Select source language"
                        showSearch
                        optionFilterProp="label"
                    />
                </Form.Item>

                <Form.Item
                    name="target_language"
                    label="Target Language"
                    rules={[{ required: true, message: "Language is required" }]}
                >
                    <Select
                        options={LANGUAGE_OPTIONS}
                        placeholder="Select target language"
                        showSearch
                        optionFilterProp="label"
                    />
                </Form.Item>

                <Form.Item
                    name="domain"
                    label="Domain"
                    rules={[{ required: true, message: "Domain is required" }]}
                >
                    <Select
                        options={DOMAIN_OPTIONS}
                        placeholder="Select domain"
                        showSearch
                        optionFilterProp="label"
                    />
                </Form.Item>

                <Form.Item
                    name="document_type"
                    label="Document Type"
                >
                    <Select
                        options={DOCUMENT_TYPE_OPTIONS}
                        placeholder="Select document type"
                        showSearch
                        optionFilterProp="label"
                    />
                </Form.Item>

                <Form.Item
                    name="source"
                    label="Source"
                    rules={[{ required: true, message: "Source is required" }]}
                >
                    <Input placeholder="e.g. Journal, Website, Organization" />
                </Form.Item>

                <Form.Item
                    name="publisher"
                    label="Publisher"
                >
                    <Input placeholder="Publisher / Institution" />
                </Form.Item>
            </div>

            {/* Advanced Fields */}
            <div>
                <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-3"
                >
                    {showAdvanced ? '▼' : '▶'} Advanced Metadata
                </button>

                {showAdvanced && (
                    <div className="bg-gray-50 p-4 rounded-md space-y-4">
                        {/* Publication Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item name="publish_date" label="Publish Date">
                                <DatePicker className="w-full" />
                            </Form.Item>

                            <Form.Item name="volume" label="Volume">
                                <Input placeholder="e.g. 42" />
                            </Form.Item>

                            <Form.Item name="issue" label="Issue">
                                <Input placeholder="e.g. 3" />
                            </Form.Item>

                            <Form.Item name="page_range" label="Page Range">
                                <Input placeholder="e.g. 123-145" />
                            </Form.Item>

                            <Form.Item name="edition" label="Edition">
                                <Input placeholder="e.g. 2nd Edition" />
                            </Form.Item>
                        </div>

                        {/* Academic Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item name="doi" label="DOI">
                                <Input placeholder="10.1000/xyz123" />
                            </Form.Item>

                            <Form.Item name="isbn" label="ISBN / ISSN">
                                <Input placeholder="ISBN or ISSN number" />
                            </Form.Item>
                        </div>

                        {/* People */}
                        <div className="space-y-2">
                            <Form.Item
                                name="authors"
                                label="Author(s)"
                                tooltip="Separate multiple authors with commas"
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Enter author names"
                                    style={{ width: '100%' }}
                                    tokenSeparators={[',']}
                                />
                            </Form.Item>

                            <Form.Item
                                name="translators"
                                label="Translator(s)"
                                tooltip="Separate multiple translators with commas"
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Enter translator names"
                                    style={{ width: '100%' }}
                                    tokenSeparators={[',']}
                                />
                            </Form.Item>

                            <Form.Item
                                name="editors"
                                label="Editor(s)"
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Enter editor names"
                                    style={{ width: '100%' }}
                                    tokenSeparators={[',']}
                                />
                            </Form.Item>

                            <Form.Item
                                name="contributors"
                                label="Contributors"
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Other contributors"
                                    style={{ width: '100%' }}
                                    tokenSeparators={[',']}
                                />
                            </Form.Item>
                        </div>

                        {/* Keywords */}
                        <Form.Item
                            name="keywords"
                            label="Keywords / Tags"
                            tooltip="Add tags for better searchability"
                        >
                            <Select
                                mode="tags"
                                placeholder="Add keywords (press Enter to add)"
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        {/* Source & Origin */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item name="original_language" label="Original Language">
                                <Select
                                    options={LANGUAGE_OPTIONS}
                                    placeholder="If translated"
                                    showSearch
                                    allowClear
                                />
                            </Form.Item>

                            <Form.Item name="country" label="Country of Origin">
                                <Input placeholder="e.g. United States" />
                            </Form.Item>
                        </div>

                        <Form.Item name="url" label="Source URL">
                            <Input placeholder="https://..." />
                        </Form.Item>

                        {/* Rights & Legal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item name="copyright_holder" label="Copyright Holder">
                                <Input placeholder="Copyright owner" />
                            </Form.Item>

                            <Form.Item name="license" label="License">
                                <Select
                                    options={LICENSE_OPTIONS}
                                    placeholder="Select license"
                                    showSearch
                                    allowClear
                                />
                            </Form.Item>

                            <Form.Item name="access_level" label="Access Level">
                                <Select
                                    options={ACCESS_LEVEL_OPTIONS}
                                    placeholder="Select access level"
                                />
                            </Form.Item>
                        </div>

                        {/* Notes */}
                        <Form.Item name="notes" label="Notes">
                            <Input.TextArea
                                rows={3}
                                placeholder="Additional metadata notes..."
                            />
                        </Form.Item>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectMetadataForm;
