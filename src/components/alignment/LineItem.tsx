import React, { useRef, useState } from 'react';
import { Button, Input, Tooltip } from 'antd';
import { Edit3, Star, StarOff, MessageSquare, Save, X, Scissors, ChevronUp, ChevronDown } from 'lucide-react';
import { getConfidenceColor, getConfidenceLabel } from '../../utils/confidence';
import type { Link } from '../../types/alignment';

const { TextArea } = Input;

export const LineItem: React.FC<any> = ({
                                            alignmentType,
                                            line,
                                            index,
                                            type,
                                            isSelected,
                                            linkedTo,
                                            isHighlighted,
                                            isEditing,
                                            editingText,
                                            linkingMode,
                                            fontFamily,
                                            fontSize,
                                            onLineClick,
                                            onEditLine,
                                            onSaveEdit,
                                            onCancelEdit,
                                            onToggleFavorite,
                                            onEditComment,
                                            onEditLineNumber,
                                            setEditingText,
                                            onSplitLine,
                                            isRTL,
                                            onMoveUp,
                                            onMoveDown,
                                            totalLines,
                                        }) => {
    const color = type === 'source' ? 'blue' : 'green';
    const textareaRef = useRef<any>(null); // ADD THIS
    const [showSplitButton, setShowSplitButton] = useState(false);

    const borderClass = isSelected
        ? linkingMode === 'click'
            ? 'border-purple-500 ring-2 ring-purple-200'
            : `border-${color}-500`
        : isHighlighted
            ? `border-${color}-300`
            : 'border-gray-200 hover:border-gray-300';

    const handleSplit = () => {
        if (!textareaRef.current || !onSplitLine) return;
        const cursorPosition = textareaRef.current.resizableTextArea?.textArea?.selectionStart || 0;
        onSplitLine(line.id, cursorPosition);
        setShowSplitButton(false);
    };

    return (
        <div
            id={`${type}-${line.id}`}
            className={`bg-white rounded border-2 transition p-3 ${
                !isEditing && 'cursor-pointer'
            } ${borderClass}`}
            onClick={() => !isEditing && onLineClick()}
        >
            <div className="flex gap-3">
                {/* Line number */}
                <div className="text-center min-w-[2.5rem]">
                    {/*<button*/}
                    {/*    onClick={(e) => {*/}
                    {/*        e.stopPropagation();*/}
                    {/*        onEditLineNumber();*/}
                    {/*    }}*/}
                    {/*    className={`text-xs font-mono font-semibold text-${color}-600 hover:bg-${color}-50 px-1 rounded`}*/}
                    {/*>*/}
                    {/*    {line.lineNumber}*/}
                    {/*</button>*/}
                    {line.lineNumber}
                    <div className="text-[10px] text-gray-400">#{index + 1}</div>
                </div>

                {/* Text */}
                <div className="flex-1">
                    {isEditing ? (
                    <EditMode
                        alignmentType={alignmentType}
                        ref={textareaRef}
                        // text={line.text}
                        text={editingText}
                        fontFamily={fontFamily}
                        fontSize={fontSize}
                        onTextChange={setEditingText}
                        onSave={onSaveEdit}
                        onCancel={() => {
                            onCancelEdit();
                            setShowSplitButton(false);
                        }}
                        showSplitButton={showSplitButton && onSplitLine}
                        onSplit={handleSplit}
                        isRTL = {isRTL}
                    />
                    ) : (
                        <ViewMode
                            text={line.text}
                            comment={line.comment}
                            fontFamily={fontFamily}
                            fontSize={fontSize}
                            onEdit={() => onEditLine(line.text)}
                            isRTL={isRTL}
                        />
                    )}
                </div>

                {/* Actions */}
                {!isEditing && (
                    <LineActions
                        isFavorite={line.isFavorite}
                        hasComment={!!line.comment}
                        onEdit={() => onEditLine(line.text)}
                        onToggleFavorite={onToggleFavorite}
                        onEditComment={onEditComment}
                        onSplit={onSplitLine ? () => {
                            setShowSplitButton(false);
                            onEditLine(line.text);
                        } : undefined}
                        onMoveUp={onMoveUp}
                        onMoveDown={onMoveDown}
                        canMoveUp={index > 0}
                        canMoveDown={index < totalLines - 1}
                        alignmentType={alignmentType}
                    />
                )}
            </div>

            {/* Confidence tags */}
            {/*{linkedTo.length > 0 && !isEditing && (*/}
            {/*    <div className="mt-2 flex gap-1 flex-wrap">*/}
            {/*        {linkedTo.map((link: Link) => (*/}
            {/*            <span*/}
            {/*                key={link.id}*/}
            {/*                className="px-2 py-0.5 rounded text-xs text-white"*/}
            {/*                style={{ backgroundColor: getConfidenceColor(link.confidence) }}*/}
            {/*            >*/}
            {/*                {getConfidenceLabel(link.confidence)}*/}
            {/*            </span>*/}
            {/*        ))}*/}
            {/*    </div>*/}
            {/*)}*/}
        </div>
    );
};

/* ---------- Sub Components ---------- */

const EditMode = React.forwardRef<any, {
    alignmentType: string,
    text: string;
    fontFamily: string;
    fontSize: number;
    onTextChange: (text: string) => void;
    onSave: () => void;
    onCancel: () => void;
    showSplitButton?: boolean;
    onSplit?: () => void;
    isRTL?:boolean;
}>(({ alignmentType, text, fontFamily, fontSize, onTextChange, onSave, onCancel, showSplitButton, onSplit, isRTL }, ref) => (
    // <div onClick={(e) => e.stopPropagation()}>
        <div>
        <TextArea
            ref={ref}
            // onBlur={onSave} // 👈 添加这一行
            value={text}
            autoSize={{ minRows: 2, maxRows: 6 }}
            onChange={(e) => onTextChange(e.target.value)}
            style={{ fontFamily, fontSize,
                direction: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",}}
            className="mb-1"
            autoFocus
        />

                {/*<Button onClick={onSplit} style={{ height: 'fit-content' }}>*/}
                {/*    Split*/}
                {/*</Button>*/}
        <div className="flex gap-1">
            <Button
                size="small"
                icon={<Save size={14} />}
                onClick={onSave}
            >
                Save
            </Button>
            {(alignmentType == 'para' || alignmentType == 'sent') &&
                <Button
                    size="small"
                    icon={<Scissors size={14}/>}
                    onClick={onSplit}
                >
                    Split Here
                </Button>
            }
            <Button
                size="small"
                icon={<X size={14} />}
                onClick={onCancel}
            >
                Cancel
            </Button>
        </div>
    </div>
));


// const EditMode = React.forwardRef<any, {
//     text: string;
//     fontFamily: string;
//     fontSize: number;
//     onTextChange: (text: string) => void;
//     onSave: () => void;
//     onCancel: () => void;
//     showSplitButton?: boolean;
//     onSplit?: () => void;
// }>(({ text, fontFamily, fontSize, onTextChange, onSave, onCancel, showSplitButton, onSplit }, ref) => {
//     const [isFocused, setIsFocused] = useState(false);
//     const [localText, setLocalText] = React.useState(text);
//     const containerRef = useRef<HTMLDivElement>(null); // 👈 to detect clicks inside
//
//     React.useEffect(() => {
//         setLocalText(text);
//     }, [text]);
//
//     const handleBlur = () => {
//         // if (localText !== text) {
//         //     onTextChange(localText); // 确保父组件状态同步（如果需要）
//         // }
//         // onSave();
//         // setIsFocused(false);
//         setTimeout(() => {
//             // Only hide if click happened outside this component
//             if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
//                 setIsFocused(false);
//                 // Save logic
//                 if (localText !== text) {
//                     onTextChange(localText);
//                 }
//                 onSave();
//             }
//         }, 0);
//     };
//     const handleFocus = () => setIsFocused(true);
//
//     return (
//         <div  style={{ position: 'relative' }}
//              ref={containerRef}>
//             {/* Textarea */}
//             <TextArea
//                 ref={ref}
//                 value={localText}
//                 autoSize={{ minRows: 2, maxRows: 6 }}
//                 // onChange={(e) => onTextChange(e.target.value)}
//                 onChange={(e) => {
//                     const val = e.target.value;
//                     setLocalText(val);       // ✅ update local state → enables editing
//                     // Optional: call onTextChange here if parent needs live updates
//                 }}
//                 onFocus={handleFocus}
//                 onBlur={handleBlur}
//                 style={{ fontFamily, fontSize }}
//                 className="mb-1"
//             />
//
//             {/* Right-side buttons - shown only when focused */}
//             {isFocused  && (
//                 <div
//                     style={{
//                         position: 'absolute',
//                         top: '50%',
//                         right: '8px',
//                         transform: 'translateY(-50%)',
//                         display: 'flex',
//                         gap: '8px',
//                         zIndex: 10,
//                     }}
//                 >
//                     <Button size="small" onClick={onSplit}>
//                         Split
//                     </Button>
//                 </div>
//             )}
//         </div>
//     );
// });
const ViewMode = ({ text, comment, fontFamily, fontSize, onEdit, isRTL }) => (
    <div
        className="leading-relaxed text-gray-900 hover:bg-gray-50 rounded px-1 cursor-text"
        style={{
            fontFamily,
            fontSize,
            direction: isRTL ? "rtl" : "ltr",
            textAlign: isRTL ? "right" : "left",
        }}
        onClick={(e) => {
            e.stopPropagation();
            onEdit();
        }}
    >
        <p>{text}</p>

        {comment && (
            <div className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-1">
                <MessageSquare size={12} className="inline mr-1" />
                {comment}
            </div>
        )}
    </div>
);

const LineActions = ({
                         isFavorite,
                         hasComment,
                         onEdit,
                         onToggleFavorite,
                         onEditComment,
                         onSplit,
                         onMoveUp,
                         onMoveDown,
                         canMoveUp,
                         canMoveDown,
                         alignmentType
                     }) => (
    <div className="flex flex-col gap-1">
        <div className="flex gap-1">
            {alignmentType && onMoveUp && onMoveDown && (
                <>
                    <Tooltip title="Move up">
                        <IconBtn
                            onClick={onMoveUp}
                            title="Move up"
                            disabled={!canMoveUp}
                        >
                            <ChevronUp size={15} className={!canMoveUp ? 'text-gray-300' : ''} />
                        </IconBtn>
                    </Tooltip>
                    <Tooltip title="Move down">
                        <IconBtn
                            onClick={onMoveDown}
                            title="Move down"
                            disabled={!canMoveDown}
                        >
                            <ChevronDown size={15} className={!canMoveDown ? 'text-gray-300' : ''} />
                        </IconBtn>
                    </Tooltip>
                </>
            )}
        </div>
        <div className="flex gap-1">
            {/*{onSplit && (*/}
            {/*    <Tooltip title="Split line">*/}
            {/*        <IconBtn onClick={onSplit} title="Split">*/}
            {/*            <Scissors size={15} />*/}
            {/*        </IconBtn>*/}
            {/*    </Tooltip>*/}
            {/*)}*/}
            {/*<IconBtn onClick={onEdit} title="Edit">*/}
            {/*    <Edit3 size={15} />*/}
            {/*</IconBtn>*/}
            <IconBtn onClick={onToggleFavorite} title="Favorite">
                {isFavorite ? (
                    <Star size={15} className="text-yellow-500 fill-current" />
                ) : (
                    <StarOff size={15} />
                )}
            </IconBtn>
            <IconBtn onClick={onEditComment} title="Comment">
                <MessageSquare size={15} className={hasComment ? 'text-amber-500' : ''} />
            </IconBtn>
        </div>
    </div>
);

const IconBtn = ({ children, onClick, title, disabled = false }) => (
    <button
        title={title}
        onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onClick();
        }}
        disabled={disabled}
        className={`p-1 rounded hover:bg-gray-100 text-gray-400 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
        {children}
    </button>
);
