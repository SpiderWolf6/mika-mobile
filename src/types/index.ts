export type IntentType =
  | 'calendar'
  | 'reminder'
  | 'alarm'
  | 'search'
  | 'gmail'
  | 'discord'
  | 'wiki_query'
  | 'wiki_write'
  | 'unknown';

export interface Intent {
  type: IntentType;
  confidence: number;
  payload: Record<string, string>;
}

export interface ConversationTurn {
  id: string;
  timestamp: number;
  userInput: string;
  transcription: string;
  intent: Intent;
  response: string;
}

export interface WikiFile {
  name: string;
  path: string;
  content: string;
  lastModified: number;
}

export interface ConnectorResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Stored alarm tracked internally by the app
export interface AlarmRecord {
  id: string;
  label: string;
  isoTime: string;
  notifeeId: string;
  active: boolean;
}

export type ProcessingStage =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking';
