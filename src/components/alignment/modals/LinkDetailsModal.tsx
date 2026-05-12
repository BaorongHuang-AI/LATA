import {useEffect, useState} from 'react';
import {Modal, Button, Input, Slider, Select, Tag} from 'antd';
import { LinkIcon, Star, StarOff, Trash2, Edit, Save, X } from 'lucide-react';
import {getConfidenceColor, getConfidenceLabel} from "../../../utils/confidence";
import {Line, Link} from "../../../types/alignment";

interface LinkDetailsModalProps {
    visible: boolean;
    link: Link | null | undefined;
    sourceLines: Line[];
    targetLines: Line[];
    onClose: () => void;
    onToggleFavorite: (linkId: string) => void;
    onDelete: (linkId: string) => void;
    onUpdate?: (linkId: string, updates: { strategy: string; comment: string; confidence: number }) => void;
    onOpenWordAlignment?: () => void;
    linkFormState?: {
        strategy: string;
        comment: string;
        confidence: number;
    };

    setLinkFormState?: (state: { strategy: string; comment: string; confidence: number }) => void;
}


const STRATEGY_SEPARATOR = ' | ';

function getCanonicalOrder(tags: any[]): Map<string, number> {
    return new Map(tags.map((t, i) => [t.name, i]));
}
function parseStrategy(value?: string): string[] {
    if (!value) return [];
    return Array.from(
        new Set(
            value
                .split(STRATEGY_SEPARATOR)
                .map(s => s.trim())
                .filter(Boolean)
        )
    );
}

function stringifyStrategy(
    values: string[],
    tags: any[]
): string {
    const orderMap = getCanonicalOrder(tags);

    return Array.from(new Set(values))                 // dedupe
        .sort((a, b) => {
            const ia = orderMap.get(a);
            const ib = orderMap.get(b);

            if (ia == null && ib == null) return a.localeCompare(b);
            if (ia == null) return 1;
            if (ib == null) return -1;
            return ia - ib;
        })
        .join(STRATEGY_SEPARATOR);
}

export const LinkDetailsModal: React.FC<LinkDetailsModalProps> = ({
                                                                      visible,
                                                                      link,
                                                                      sourceLines,
                                                                      targetLines,
                                                                      onClose,
                                                                      onToggleFavorite,
                                                                      onDelete,
                                                                      linkFormState,
                                                                      setLinkFormState,
                                                                      onUpdate,
                                                                      onOpenWordAlignment,
                                                                  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedStrategy, setEditedStrategy] = useState<string[]>([]);

    const [editedComment, setEditedComment] = useState('');
    const [editedConfidence, setEditedConfidence] = useState(0);
    const [tags, setTags] = useState<any[]>([]);

    async function loadTags() {
        const data = await window.api.listTags();
        setTags(data);
    }

    useEffect(() => {
        loadTags();
    }, []);
    //
    // useEffect(() => {
    //     if (visible && link && setLinkFormState) {
    //         setLinkFormState({
    //             strategy: link.strategy || '',
    //             comment: link.comment || '',
    //             confidence: link.confidence,
    //         });
    //     }
    // }, [visible, link, setLinkFormState]);



    useEffect(() => {
        if (visible && link && setLinkFormState) {
            setLinkFormState({
                strategy: link.strategy || '',
                comment: link.comment || '',
                confidence: link.confidence,
            });
        }
    }, [visible, link, setLinkFormState]);

    if (!link) return null;

    const handleEdit = () => {
        setEditedStrategy(parseStrategy(linkFormState.strategy));
        setEditedComment(linkFormState.comment || '');
        setEditedConfidence(linkFormState.confidence);
        setIsEditing(true);
    };

    const handleSave = () => {
        const strategyString = stringifyStrategy(editedStrategy, tags);

        const updates = {
            strategy: strategyString, // ← STRING saved
            comment: editedComment,
            confidence: editedConfidence,
        };

        setLinkFormState?.(updates);
        onUpdate?.(link.id, updates);

        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleDelete = () => {
        onDelete(link.id);
        onClose();
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <LinkIcon size={16} />
                    Link Details
                </div>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={500}
        >
            <div className="space-y-4">
                {/* Alignment Info */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">Alignment</p>
                    <div className="font-mono text-xs bg-gray-50 p-2 rounded">
                        {link.sourceIds
                            .map((id) => sourceLines.find((l) => l.id === id || l.lineNumber === id)?.lineNumber || id)
                            .join(' ')}
                        {' ↔ '}
                        {link.targetIds
                            .map((id) => targetLines.find((l) => l.id === id || l.lineNumber === id)?.lineNumber || id)
                            .join(' ')}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                        {link.sourceIds.length} source ↔ {link.targetIds.length} target
                    </p>
                </div>

                {/* Confidence */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">Confidence</p>
                    {isEditing ? (
                        <div className="space-y-2">
                            <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={editedConfidence}
                                onChange={setEditedConfidence}
                                tooltip={{ formatter: (value) => `${((value || 0) * 100).toFixed(0)}%` }}
                            />
                            <p className="text-xs text-gray-600">
                                {getConfidenceLabel(editedConfidence)} ({(editedConfidence * 100).toFixed(0)}%)
                            </p>
                        </div>
                    ) : (
                        <span
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: getConfidenceColor(linkFormState.confidence) }}
                        >
                            {getConfidenceLabel(linkFormState.confidence)} ({(linkFormState.confidence * 100).toFixed(0)}%)
                        </span>
                    )}
                </div>

                {/* Strategy */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">Technique</p>
                    {isEditing ? (
                        <Select<string[]>
                            mode="multiple"
                            allowClear
                            placeholder="Select translation techniques"
                            value={editedStrategy as any}
                            onChange={setEditedStrategy}
                            options={tags as any}
                            fieldNames={{
                                label: 'name',
                                value: 'name',
                            }}
                            style={{ width: "100%" }}
                        />
                    ) : (
                        <div className="flex flex-wrap gap-1 bg-blue-50 p-2 rounded border border-blue-200">
                            {parseStrategy(linkFormState.strategy).length ? (
                                parseStrategy(linkFormState.strategy).map(name => {
                                    const tag = tags.find(t => t.name === name);

                                    return (
                                        <span
                                            key={name}
                                            className="text-xs px-2 py-0.5 rounded-full text-white"
                                            style={{ backgroundColor: tag?.color || '#666' }}
                                            title={tag?.description}
                                        >
                    {name}
                </span>
                                    );
                                })
                            ) : (
                                <span className="text-sm text-gray-500">No strategy specified</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Comment */}
                <div>
                    <p className="text-xs text-gray-500 mb-1">Comment</p>
                    {isEditing ? (
                        <Input.TextArea
                            value={editedComment}
                            onChange={(e) => setEditedComment(e.target.value)}
                            placeholder="Enter comment..."
                            rows={3}
                        />
                    ) : (
                        <p className="text-sm text-gray-700 bg-amber-50 p-2 rounded border border-amber-200">
                            {linkFormState.comment || 'No comment'}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                    {isEditing ? (
                        <>
                            <Button
                                type="primary"
                                icon={<Save size={14} />}
                                onClick={handleSave}
                                className="!bg-green-500 !border-green-500"
                            >
                                Save
                            </Button>
                            <Button icon={<X size={14} />} onClick={handleCancel}>
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button icon={<Edit size={14} />} onClick={handleEdit}>
                                Edit
                            </Button>
                            <Button
                                icon={link.isFavorite ? <Star size={14} /> : <StarOff size={14} />}
                                onClick={() => onToggleFavorite(link.id)}
                                type={link.isFavorite ? 'primary' : 'default'}
                            >
                                {link.isFavorite ? 'Favorited' : 'Favorite'}
                            </Button>
                            {onOpenWordAlignment && (
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        onClose();
                                        onOpenWordAlignment();
                                    }}
                                >
                                    Word Alignment
                                </Button>
                            )}
                            <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>
                                Delete
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};
