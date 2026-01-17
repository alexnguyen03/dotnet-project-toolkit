export interface WatchGroup {
    id: string;
    name: string;
    projects: string[]; // List of project names (or unique identifiers)
    arguments?: string; // Optional global args
}
