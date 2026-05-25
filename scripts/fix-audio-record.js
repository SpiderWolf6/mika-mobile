const fs = require('fs');
const path = require('path');

// Fix 1: react-native-audio-record — deactivate AVAudioSession on stop
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

// Fix 2: react-native-tts — force AVAudioSessionCategoryPlayback before speaking
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
    // Target the AVSpeechUtterance allocation inside the speak method
    const uttTarget = 'AVSpeechUtterance *utterance = [[AVSpeechUtterance alloc] initWithString:text];';
    if (src.includes(uttTarget)) {
      src = src.replace(
        uttTarget,
        `/* mika-force-session */\n    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];\n    [[AVAudioSession sharedInstance] setActive:YES error:nil];\n    AVSpeechUtterance *utterance = [[AVSpeechUtterance alloc] initWithString:text];`,
      );
      fs.writeFileSync(ttsFile, src, 'utf8');
      console.log('fix-tts: patch applied');
    } else {
      console.error('fix-tts: patch location not found — dumping first 50 lines for debug:');
      console.error(src.split('\n').slice(0, 50).join('\n'));
    }
  }
}
