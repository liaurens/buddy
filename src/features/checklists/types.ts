export interface ChecklistItem {
    id: string;
    text: string;
    isChecked: boolean;
}

export interface Checklist {
    id: string;
    name: string;
    description?: string;
    emoji?: string;
    items: ChecklistItem[];
    isPinned: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface ChecklistState {
    checklists: Checklist[];
    isLoading: boolean;
    activeChecklist: Checklist | null;

    // Actions
    createChecklist: (data: Partial<Checklist>) => Promise<Checklist>;
    updateChecklist: (checklist: Checklist) => Promise<void>;
    deleteChecklist: (id: string) => Promise<void>;

    // Specialized Actions
    resetChecklist: (id: string) => Promise<void>; // Uncheck all items
    addItem: (checklistId: string, text: string) => Promise<void>;
    toggleItem: (checklistId: string, itemId: string) => Promise<void>;
    deleteItem: (checklistId: string, itemId: string) => Promise<void>;
}
