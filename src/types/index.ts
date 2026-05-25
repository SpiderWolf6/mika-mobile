export type IntentType =
  | 'calendar'
  | 'reminder'
  | 'alarm'
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

// Result from Agent 1 (gatekeeper)
export type GatekeeperOutcome =
  | {status: 'cannot_do'}
  | {status: 'cannot_answer'}
  | {status: 'need_clarification'; connector: 'alarm' | 'reminder' | 'calendar'; question: string; partialInfo: string}
  | {status: 'ready'; connector: 'alarm' | 'reminder' | 'calendar'; summary: string};

// In-memory clarification state — cleared after task completes or on restart
export interface ClarificationState {
  connector: 'alarm' | 'reminder' | 'calendar';
  collectedInfo: string; // everything known so far, plain text
}
