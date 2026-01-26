// Toolbox Feature Types

export interface Strategy {
    id: string;
    title: string;
    description: string;
    category: string; // "Strength" | "Weakness" | "General" etc.
    tags: string[]; // e.g. ["Focus", "Anxiety", "Sleep"]
    content?: string; // Markdown notes
    findings?: {
        id: string;
        date: string;
        note: string;
        rating: number; // 1-5 effectiveness
    }[];
    isFavorite?: boolean;
}
