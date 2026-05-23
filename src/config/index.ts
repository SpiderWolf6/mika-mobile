import {Platform} from 'react-native';
import RNFS from 'react-native-fs';

// Wiki lives in the iCloud-synced Documents folder so Obsidian can read it
export const WIKI_DIR =
  Platform.OS === 'ios'
    ? `${RNFS.DocumentDirectoryPath}/MikaWiki`
    : `${RNFS.ExternalDirectoryPath}/MikaWiki`;

// Whisper model file bundled in the app
export const WHISPER_MODEL_PATH = `${RNFS.MainBundlePath}/whisper-base.en.bin`;

// Phi-3 mini GGUF model file bundled in the app
export const PHI3_MODEL_PATH = `${RNFS.MainBundlePath}/phi-3-mini-4k-instruct.Q4_K_M.gguf`;

export const CLOUD_SERVER_URL = 'https://your-server.example.com/api/trigger';

export const GOOGLE_WEB_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

// Max wiki files to inject as context per SLM call
export const MAX_WIKI_CONTEXT_FILES = 5;

// Max conversation history to keep in context
export const MAX_CONTEXT_TURNS = 6;
