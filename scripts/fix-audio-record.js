const fs = require('fs');
const path = require('path');

// Fix 1: react-native-audio-record — deactivate AVAudioSession on stop
// so TTS can take over the audio session immediately after recording ends
const audioRecordFile = path.join(
  __dirname,
  '../node_modules/react-native-audio-record/ios/RNAudioRecord.m',
);

if (fs.existsSync(audioRecordFile)) {
  let src = fs.readFileSync(audioRecordFile, 'utf8');
  const marker = '[[AVAudioSession sharedInstance] setActive:NO';
  if (src.includes(marker)) {
    console.log('fix-audio-record: already applied');
  } else {
    const closeCall = 'AudioFileClose(_recordState.mAudioFile);';
    if (src.includes(closeCall)) {
      src = src.replace(
        closeCall,
        closeCall +
          '\n        [[AVAudioSession sharedInstance] setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];',
      );
      fs.writeFileSync(audioRecordFile, src, 'utf8');
      console.log('fix-audio-record: patch applied');
    } else {
      console.error('fix-audio-record: patch location not found');
    }
  }
}

// Fix 2: react-native-tts — force setActive:YES before speaking
// so it can acquire the audio session even after recording left it active
const ttsFile = path.join(
  __dirname,
  '../node_modules/react-native-tts/ios/TextToSpeech/TextToSpeech.m',
);

if (fs.existsSync(ttsFile)) {
  let src = fs.readFileSync(ttsFile, 'utf8');
  const ttsMarker = '/* mika-force-session */';
  if (src.includes(ttsMarker)) {
    console.log('fix-tts: already applied');
  } else {
    const speakTarget = '- (void)speak:(NSString*)text';
    if (src.includes(speakTarget)) {
      src = src.replace(
        speakTarget,
        `- (void)speak:(NSString*)text {\n    /* mika-force-session */\n    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];\n    [[AVAudioSession sharedInstance] setActive:YES error:nil];\n}\n- (void)speak_orig:(NSString*)text`,
      );
      // That approach would break the method — use a simpler insertion instead
      // Revert and do a clean insertion before the utterance creation
      src = fs.readFileSync(ttsFile, 'utf8');
      // Find the line where AVSpeechUtterance is created and insert before it
      const uttTarget = 'AVSpeechUtterance *utterance';
      if (src.includes(uttTarget)) {
        src = src.replace(
          uttTarget,
          `/* mika-force-session */\n    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];\n    [[AVAudioSession sharedInstance] setActive:YES error:nil];\n    AVSpeechUtterance *utterance`,
        );
        fs.writeFileSync(ttsFile, src, 'utf8');
        console.log('fix-tts: patch applied');
      } else {
        console.error('fix-tts: patch location not found');
      }
    }
  }
}
