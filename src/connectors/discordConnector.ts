import {ConnectorResult, Intent} from '../types';
import {CLOUD_SERVER_URL} from '../config';

export async function handleDiscordIntent(intent: Intent): Promise<ConnectorResult> {
  try {
    const response = await fetch(CLOUD_SERVER_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        source: 'mika-mobile',
        intent: intent.type,
        payload: intent.payload,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      return {success: false, error: `Server error: ${response.status}`};
    }

    const data = await response.json();
    return {success: true, data};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}
