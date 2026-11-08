export {};
declare global { interface Window { trainingUpdate?: () => void; trainingUpdateDownloading?: boolean; trainingCheckUpdate?: () => Promise<'ready' | 'current'>; } }
