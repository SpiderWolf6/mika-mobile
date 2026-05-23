# MIKA Mobile — iOS Setup Checklist

## 1. iOS Permissions (ios/MikaMobile/Info.plist)

Add these keys:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>MIKA needs the microphone to hear your voice commands.</string>
<key>NSCalendarsUsageDescription</key>
<string>MIKA needs calendar access to manage your events.</string>
<key>NSCalendarsFullAccessUsageDescription</key>
<string>MIKA needs full calendar access to create and read events.</string>
```

## 2. Model Files

Place these in `ios/MikaMobile/` and add them to the Xcode target:

- `whisper-base.en.bin` — download from whisper.rn releases
- `phi-3-mini-4k-instruct.Q4_K_M.gguf` — download from HuggingFace (microsoft/Phi-3-mini-4k-instruct-gguf)

## 3. Google Sign-In (Gmail connector)

1. Create a project in Google Cloud Console
2. Enable the Gmail API
3. Create OAuth credentials (iOS app type, bundle ID: com.mikamobile)
4. Download `GoogleService-Info.plist` and add to Xcode target
5. Set `GOOGLE_WEB_CLIENT_ID` in `src/config/index.ts`
6. Add the URL scheme to `Info.plist`:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
       </array>
     </dict>
   </array>
   ```

## 4. llama.rn Binary (if npm install failed)

On macOS, run:
```bash
LLAMA_RN_SKIP_DOWNLOAD=0 npm install llama.rn
```

The Windows npm install skips the binary download due to a tar issue — build must happen on macOS.

## 5. Pod Install

```bash
cd ios && pod install
```

## 6. iCloud Entitlement (for wiki sync)

In Xcode → Signing & Capabilities → add iCloud → enable iCloud Documents.
The wiki is written to `DocumentDirectoryPath/MikaWiki/` which iOS maps to iCloud Drive when the entitlement is active. Obsidian iOS can then open that folder.

## 7. Cloud Server (Discord connector)

Set `CLOUD_SERVER_URL` in `src/config/index.ts` to your server endpoint.
The server should accept POST JSON `{source, intent, payload, timestamp}` and forward to Discord via a bot token + webhook.

## 8. Run

```bash
npx react-native run-ios
```
