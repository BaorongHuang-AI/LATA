import {useEffect, useState} from "react";
import {Button, Input, Select} from "antd";


const taskOptions = [ { label: "Paragraph Alignment", value: "paragraph_alignment" }, { label: "Sentence Segmentation", value: "sentence_segmentation" }, { label: "Sentence Alignment", value: "sentence_alignment" }, ];
export default function PromptManager() {
    const [prompts, setPrompts] = useState<any[]>([]);
    const [selected, setSelected] = useState<any | null>(null);
    const [form, setForm] = useState<any>(null);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        const data = await window.api.listPrompts();
        setPrompts(data);
    }

    const startCreate = () => {
        const empty = {
            task_type: "sentence_segmentation",
            name: "",
            systemPrompt: "",
            userPrompt: "",
            model: "gpt-4.1-mini",
            temperature: 0.2,
            max_completion_tokens: 2048,
        };
        setSelected(null);
        setForm(empty);
    };

    const startEdit = (p: any) => {
        setSelected(p);
        setForm({
            ...p,
            systemPrompt: p.system_prompt,
            userPrompt: p.user_prompt,
        });
    };

    const save = async () => {
        if (!form.name) return alert("Name is required");

        if (selected) {
            await window.api.updatePrompt(selected.id, form);
        } else {
            await window.api.savePrompt(form);
        }

        setForm(null);
        setSelected(null);
        await load();
    };

    const remove = async (id: number) => {
        if (!confirm("Delete this prompt?")) return;
        await window.api.deletePrompt(id);
        await load();
    };

    return (
        <div className="flex h-[80vh] gap-4 p-4">

            {/* ================= LEFT: LIST ================= */}
            <div className="w-1/3 bg-white rounded shadow overflow-y-auto">
                <div className="p-4 flex justify-between items-center border-b">
                    <h2 className="font-bold">Prompts</h2>
                    <Button
                        onClick={startCreate}
                        className="bg-blue-600 text-white px-3 py-1 rounded"
                    >
                        + New
                    </Button>
                </div>

                {prompts.map(p => (
                    <div
                        key={p.id}
                        onClick={() => startEdit(p)}
                        className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                            selected?.id === p.id ? "bg-blue-50" : ""
                        }`}
                    >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">
                            {p.task_type}
                        </div>
                    </div>
                ))}
            </div>

            {/* ================= RIGHT: EDITOR ================= */}
            <div className="flex-1 bg-white rounded shadow p-4 overflow-y-auto">
                {!form ? (
                    <div className="text-gray-400 text-center mt-20">
                        Select or create a prompt
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold">
                            {selected ? "Edit Prompt" : "New Prompt"}
                        </h2>

                        <Select
                            value={form.task_type}
                            onChange={v => setForm({ ...form, task_type: v })}
                            options={taskOptions}
                        />

                        <Input
                            placeholder="Name"
                            value={form.name}
                            onChange={e =>
                                setForm({ ...form, name: e.target.value })
                            }
                        />

                        <Input.TextArea
                            rows={5}
                            placeholder="System Prompt"
                            value={form.systemPrompt}
                            onChange={e =>
                                setForm({
                                    ...form,
                                    systemPrompt: e.target.value,
                                })
                            }
                        />

                        <Input.TextArea
                            rows={5}
                            placeholder="User Prompt"
                            value={form.userPrompt}
                            onChange={e =>
                                setForm({
                                    ...form,
                                    userPrompt: e.target.value,
                                })
                            }
                        />

                        <div className="flex gap-2">
                            <Button
                                onClick={save}
                                className="bg-blue-600 text-white px-4 py-2 rounded"
                            >
                                Save
                            </Button>

                            <Button
                                onClick={() => {
                                    setForm(null);
                                    setSelected(null);
                                }}
                                className="btn-sm bg-gray-300 px-4 py-2 rounded"
                            >
                                Cancel
                            </Button>

                            {selected && (
                                <Button
                                    onClick={() => remove(selected.id)}
                                    className="btn-sm bg-red-500 text-white px-4 py-2 rounded ml-auto"
                                >
                                    Delete
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}