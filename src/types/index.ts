export type IntentType =
  | 'calendar'
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

export interface SLMContext {
  wikiSnippets: string[];
  recentTurns: ConversationTurn[];
}
