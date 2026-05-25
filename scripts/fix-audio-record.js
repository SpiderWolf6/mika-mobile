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

src = src.replace(
  'AudioFileClose(_recordState.mAudioFile);\n    }',
  'AudioFileClose(_recordState.mAudioFile);\n        [[AVAudioSession sharedInstance] setActive:NO\n            withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation\n            error:nil];\n    }'
);

fs.writeFileSync(file, src, 'utf8');
console.log('fix-audio-record: patch applied successfully');
