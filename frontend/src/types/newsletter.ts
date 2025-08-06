export interface Newsletter {
    messageId: string;
    subject: string;
    from: string;
    date: string;
    cleanedHtml: string;
    originalHtml: string;
    isRead: boolean;
    isInTrash: boolean;
    labels: string[];
}