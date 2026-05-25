const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../node_modules/react-native-audio-record/ios/RNAudioRecord.m');

if (!fs.existsSync(file)) {
  console.log('fix-audio-record: file not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(file, 'utf8');

const marker = '[[AVAudioSession sharedInstance] setActive:NO';
if (src.includes(marker)) {
  console.log('fix-audio-record: patch already applied');
  process.exit(0);
}

// Find AudioFileClose line and insert session deactivation after it
const closeCall = 'AudioFileClose(_recordState.mAudioFile);';
if (!src.includes(closeCall)) {
  console.error('fix-audio-record: could not find patch location, skipping');
  process.exit(0);
}

const insertion = `\n        [[AVAudioSession sharedInstance] setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];`;
src = src.replace(closeCall, closeCall + insertion);

fs.writeFileSync(file, src, 'utf8');
console.log('fix-audio-record: patch applied successfully');
