export interface ConversationTurn {
  id: string;
  timestamp: number;
  userInput: string;
  transcription: string;
  response: string;
}

export type ProcessingStage =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking';
