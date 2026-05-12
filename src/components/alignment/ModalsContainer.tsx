import {MetadataModal} from "./modals/MetadataModal";
import {LinkDetailsModal} from "./modals/LinkDetailsModal";
import {LineNumberModal} from "./modals/LineNumberModal";
import {CommentModal} from "./modals/CommentModal";
import {CreateLinkModal} from "./modals/CreateLinkModal";
import {QuickLinkModal} from "./modals/QuickLinkModal";
import {AlignmentMetadata, FontSettings, Line, Link} from "../../types/alignment";
import {DocumentMetadata} from "../../utils/AlignUtils";
import {AdvancedMetadataModal} from "./modals/AdvancedMetadataModal";
import WordAlignmentModal from "./modals/WordAlignmentModal";

interface ModalsContainerProps {
    documentId: any,
    modals: any;
    setModals: any;
    // metadata: AlignmentMetadata;
    // setMetadata: (metadata: AlignmentMetadata) => void;
    sourceMetadata: DocumentMetadata;
    targetMetadata: DocumentMetadata;
    setSourceMetadata: (metadata: DocumentMetadata) => void;
    setTargetMetadata: (metadata: DocumentMetadata) => void;
    fontSettings: FontSettings;
    setFontSettings: (settings: FontSettings) => void;
    linkFormState: {
        confidence: number;
        strategy: string;
        comment: string;
    };
    setLinkFormState: (state: { confidence: number; strategy: string; comment: string }) => void; // ADD THIS
    pendingSourceIds: string[];
    pendingTargetIds: string[];
    selectedSourceIds: string[];
    selectedTargetIds: string[];
    sourceLines: Line[];
    targetLines: Line[];
    onConfirmQuickLink: () => void;
    onCancelQuickLink: () => void;
    onCreateLink: () => void;
    editingItem?: {
        type: 'line' | 'link';
        id: string;
        field: 'comment' | 'lineNumber';
    } | null;
    editValue?: string;
    setEditValue?: (value: string) => void;
    onSaveEdit?: () => void;
    links?: Link[];
    selectedLinkForDetails?: string | null;
    onCloseLinkDetails?: () => void;
    onToggleLinkFavorite?: (linkId: string) => void;
    onDeleteLink?: (linkId: string) => void;
    onUpdateLink?:(linkId: any, updates: any) => void;
    // Word alignment
    wordAlignmentPair?: { sourceKey: string; targetKey: string; sourceText: string; targetText: string } | null;
    onWordAlignmentSaved?: () => void;
}

export const ModalsContainer: React.FC<ModalsContainerProps> = ({
                                                                    documentId,
                                                                    modals,
                                                                    setModals,
                                                                    sourceMetadata,
                                                                    targetMetadata,
                                                                    setSourceMetadata,
                                                                    setTargetMetadata,
                                                                    fontSettings,
                                                                    setFontSettings,
                                                                    linkFormState,
                                                                    setLinkFormState, // ADD THIS
                                                                    pendingSourceIds,
                                                                    pendingTargetIds,
                                                                    selectedSourceIds,
                                                                    selectedTargetIds,
                                                                    sourceLines,
                                                                    targetLines,
                                                                    onConfirmQuickLink,
                                                                    onCancelQuickLink,
                                                                    onCreateLink,
                                                                    editingItem,
                                                                    editValue = '',
                                                                    setEditValue,
                                                                    onSaveEdit,
                                                                    links = [],
                                                                    selectedLinkForDetails,
                                                                    onCloseLinkDetails,
                                                                    onToggleLinkFavorite,
                                                                    onDeleteLink,
                                                                    onUpdateLink,
                                                                    wordAlignmentPair,
                                                                    onWordAlignmentSaved,
                                                                }) => {
    const closeModal = (key:any) => {
        setModals((prev) => ({ ...prev, [key]: false }));
    };

    const selectedLink = selectedLinkForDetails
        ? links.find(l => l.id === selectedLinkForDetails)
        : null;

    return (
        <>
            <QuickLinkModal
                visible={modals.quickLink}
                onConfirm={onConfirmQuickLink}
                onCancel={onCancelQuickLink}
                pendingSourceIds={pendingSourceIds}
                pendingTargetIds={pendingTargetIds}
                sourceLines={sourceLines}
                targetLines={targetLines}
                linkFormState={linkFormState}
                setLinkFormState={setLinkFormState} // ADD THIS
            />

            <CreateLinkModal
                visible={modals.createLink}
                onConfirm={onCreateLink}
                onCancel={() => closeModal('createLink')}
                selectedSourceIds={selectedSourceIds}
                selectedTargetIds={selectedTargetIds}
                sourceLines={sourceLines}
                targetLines={targetLines}
                linkFormState={linkFormState}
                setLinkFormState={setLinkFormState}
            />

            <CommentModal
                visible={modals.comment}
                value={editValue}
                onChange={setEditValue || (() => {})}
                onSave={() => {
                    onSaveEdit?.();
                    closeModal('comment');
                }}
                onCancel={() => closeModal('comment')}
            />

            <LineNumberModal
                visible={modals.editLine}
                value={editValue}
                onChange={setEditValue || (() => {})}
                onSave={() => {
                    onSaveEdit?.();
                    closeModal('editLine');
                }}
                onCancel={() => closeModal('editLine')}
            />

            {/*<MetadataModal*/}
            {/*    visible={modals.metadata}*/}
            {/*    metadata={metadata}*/}
            {/*    onChange={setMetadata}*/}
            {/*    onClose={() => closeModal('metadata')}*/}
            {/*/>*/}

            <AdvancedMetadataModal
                documentId={documentId}
                visible={modals.metadata}
                sourceMeta={sourceMetadata}
                targetMeta={targetMetadata}
                setSourceMeta={setSourceMetadata}
                setTargetMeta={setTargetMetadata}
                onClose={() => closeModal('metadata')}
            />

            <LinkDetailsModal
                visible={modals.linkDetails}
                link={selectedLink}
                sourceLines={sourceLines}
                targetLines={targetLines}
                onClose={() => {
                    closeModal('linkDetails');
                    onCloseLinkDetails?.();
                }}
                onToggleFavorite={onToggleLinkFavorite || (() => {})}
                onDelete={onDeleteLink || (() => {})}
                linkFormState={linkFormState}
                setLinkFormState={setLinkFormState} // ADD THIS
                onUpdate={onUpdateLink}
                onOpenWordAlignment={
                    wordAlignmentPair
                        ? () => {
                              setModals((prev: any) => ({ ...prev, linkDetails: false, wordAlignment: true }));
                              onCloseLinkDetails?.();
                          }
                        : undefined
                }
            />

            {wordAlignmentPair && (
                <WordAlignmentModal
                    visible={modals.wordAlignment}
                    documentId={Number(documentId)}
                    sourceSentenceKey={wordAlignmentPair.sourceKey}
                    targetSentenceKey={wordAlignmentPair.targetKey}
                    sourceText={wordAlignmentPair.sourceText}
                    targetText={wordAlignmentPair.targetText}
                    srcLang={sourceMetadata?.language || ""}
                    tgtLang={targetMetadata?.language || ""}
                    fontSettings={fontSettings}
                    onClose={() => setModals((prev: any) => ({ ...prev, wordAlignment: false }))}
                    onSaved={onWordAlignmentSaved || (() => {})}
                />
            )}
        </>
    );
};