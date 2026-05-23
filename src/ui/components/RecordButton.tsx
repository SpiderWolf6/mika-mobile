import React, {useCallback} from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  View,
  ActivityIndicator,
} from 'react-native';

interface RecordButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}

export function RecordButton({
  isRecording,
  isProcessing,
  onPressIn,
  onPressOut,
}: RecordButtonProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.15, duration: 600, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 600, useNativeDriver: true}),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  return (
    <Animated.View style={[styles.wrapper, {transform: [{scale: pulseAnim}]}]}>
      <TouchableOpacity
        style={[styles.button, isRecording && styles.recording]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isProcessing}
        activeOpacity={0.8}>
        {isProcessing ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <View style={[styles.mic, isRecording && styles.micActive]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  recording: {
    backgroundColor: '#E24A4A',
  },
  mic: {
    width: 20,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  micActive: {
    backgroundColor: '#FFD700',
  },
});
