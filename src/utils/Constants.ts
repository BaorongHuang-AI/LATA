// export const  API_BASE_URL = 'http://localhost:8090'
export const  API_BASE_URL = 'http://www.huangbaorong.cn'
export const CEFR_LEVELS = ['A1','A2','B1','B2','C1','C2'] as const;
export type CEFRLevel = typeof CEFR_LEVELS[number];
export const EXERCISE_TYPES = [
    'standard','fill_blank','multiple_choice','reorder',
    'translation',
    'image','dialogue','reverse','timed'
] as const;
export type ExerciseType = typeof EXERCISE_TYPES[number];

// Difficulty options
export const DIFFICULTY_LEVELS = ['easy','medium','hard'] as const;
export type DifficultyLevel = typeof DIFFICULTY_LEVELS[number];

export const LANGUAGES = ['Chinese', 'English', 'Arabic'] as const;
export type Language = typeof LANGUAGES[number];

export const LANGUAGE_OPTIONS = [
    { label: "English", value: "en" },
    { label: "Arabic", value: "ar" },
    { label: "Chinese (Simplified)", value: "zh-CN" },
    { label: "Chinese (Traditional)", value: "zh-TW" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Spanish", value: "es" },
    { label: "Japanese", value: "ja" },
    { label: "Korean", value: "ko" },

] ;

export const DOMAIN_OPTIONS = [
    { label: "General", value: "general" },
    { label: "Legal", value: "legal" },
    { label: "Literature", value: "literature" },
    { label: "Technical", value: "technical" },
    { label: "Medical", value: "medical" },
    { label: "Financial", value: "financial" },
    { label: "Academic", value: "academic" },
    { label: "IT / Software", value: "it" },
    { label: "Marketing", value: "marketing" },
];

export const DOCUMENT_TYPE_OPTIONS = [
    { label: "Article", value: "article" },
    { label: "Book", value: "book" },
    { label: "Report", value: "report" },
    { label: "Manual", value: "manual" },
    { label: "Website", value: "website" },
    { label: "Legal Document", value: "legal" },
    { label: "Speech", value: "speech" },
    { label: "Patent", value: "patent" },
    { label: "Correspondence", value: "correspondence" },
    { label: "Other", value: "other" },
];

export const LICENSE_OPTIONS = [
    { label: "CC BY 4.0", value: "CC BY 4.0" },
    { label: "CC BY-SA 4.0", value: "CC BY-SA 4.0" },
    { label: "CC BY-NC 4.0", value: "CC BY-NC 4.0" },
    { label: "CC BY-ND 4.0", value: "CC BY-ND 4.0" },
    { label: "CC0 (Public Domain)", value: "CC0" },
    { label: "MIT", value: "MIT" },
    { label: "All Rights Reserved", value: "all-rights-reserved" },
    { label: "Other", value: "other" },
];

export const ACCESS_LEVEL_OPTIONS = [
    { label: "Public", value: "public" },
    { label: "Restricted", value: "restricted" },
    { label: "Confidential", value: "confidential" },
    { label: "Private", value: "private" },
];

export const RTL_LANGS = ["ar", "he", "fa", "ur"];
