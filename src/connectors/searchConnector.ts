import {Linking} from 'react-native';
import {ConnectorResult, Intent} from '../types';

// Opens Chrome on iOS via URL scheme. Falls back to Safari if Chrome not installed.
export async function handleSearchIntent(intent: Intent): Promise<ConnectorResult> {
  const query = intent.payload.query ?? '';
  if (!query) {
    return {success: false, error: 'No search query provided'};
  }

  const encoded = encodeURIComponent(query);
  const chromeUrl = `googlechromes://www.google.com/search?q=${encoded}`;
  const safariUrl = `https://www.google.com/search?q=${encoded}`;

  try {
    const canOpenChrome = await Linking.canOpenURL(chromeUrl);
    const url = canOpenChrome ? chromeUrl : safariUrl;
    await Linking.openURL(url);
    return {success: true, data: {url, query}};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}
