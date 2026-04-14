// src/utils/telemetry/eventPayloads.ts

// Define interfaces for telemetry events

// Interface for user login event
export interface UserLoginEvent {
    userId: string;
    timestamp: string;
    method: string; // e.g., "OAuth", "Email"
}

// Interface for page view event
export interface PageViewEvent {
    userId: string;
    pageUrl: string;
    timestamp: string;
    referrer?: string;
}

// Interface for transaction event
export interface TransactionEvent {
    userId: string;
    transactionId: string;
    amount: number;
    currency: string;
    timestamp: string;
}

// Add more interfaces as needed for other telemetry events.

