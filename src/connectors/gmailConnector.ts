import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {ConnectorResult, Intent} from '../types';
import {GOOGLE_WEB_CLIENT_ID} from '../config';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  offlineAccess: true,
});

export async function signInWithGoogle(): Promise<string | null> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch (err) {
    console.error('Google sign-in error:', err);
    return null;
  }
}

export async function handleGmailIntent(intent: Intent): Promise<ConnectorResult> {
  // TODO: implement full Gmail send/read flow
  const accessToken = await signInWithGoogle();
  if (!accessToken) {
    return {success: false, error: 'Gmail authentication failed'};
  }

  const action = intent.payload.action ?? 'send';

  if (action === 'send') {
    return sendEmail(accessToken, intent);
  } else if (action === 'list') {
    return listEmails(accessToken, intent);
  }

  return {success: false, error: `Unknown gmail action: ${action}`};
}

async function sendEmail(
  accessToken: string,
  intent: Intent,
): Promise<ConnectorResult> {
  try {
    const {to, subject, body} = intent.payload;
    const raw = btoa(
      `To: ${to}\r\nSubject: ${subject ?? '(no subject)'}\r\n\r\n${body ?? ''}`,
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({raw}),
      },
    );

    if (!response.ok) {
      return {success: false, error: `Gmail API error: ${response.status}`};
    }

    const data = await response.json();
    return {success: true, data};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}

async function listEmails(
  accessToken: string,
  intent: Intent,
): Promise<ConnectorResult> {
  try {
    const q = intent.payload.query ?? 'is:inbox is:unread';
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=10`,
      {
        headers: {Authorization: `Bearer ${accessToken}`},
      },
    );

    if (!response.ok) {
      return {success: false, error: `Gmail API error: ${response.status}`};
    }

    const data = await response.json();
    return {success: true, data};
  } catch (err) {
    return {success: false, error: String(err)};
  }
}
