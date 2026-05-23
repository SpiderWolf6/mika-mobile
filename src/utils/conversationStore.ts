import AsyncStorage from '@react-native-async-storage/async-storage';
import {ConversationTurn} from '../types';
import {MAX_CONTEXT_TURNS} from '../config';

const STORAGE_KEY = '@mika_conversation_history';

export async function loadHistory(): Promise<ConversationTurn[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function appendTurn(turn: ConversationTurn): Promise<void> {
  const history = await loadHistory();
  history.push(turn);
  const trimmed = history.slice(-MAX_CONTEXT_TURNS * 2);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
