import React, {useEffect} from 'react';
import {StyleSheet, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const {width} = Dimensions.get('window');

interface Props {
  text: string;
  visible: boolean;
  suckedIn?: boolean; // true = drift toward center + fade
}

export function FloatingText({text, visible, suckedIn}: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (visible && !suckedIn) {
      opacity.value = withTiming(1, {duration: 200});
      translateY.value = withTiming(0, {duration: 200});
      scale.value = withTiming(1, {duration: 200});
    } else if (suckedIn) {
      // Drift toward orb (down) and shrink + fade
      opacity.value = withTiming(0, {duration: 600, easing: Easing.in(Easing.quad)});
      translateY.value = withTiming(80, {duration: 600, easing: Easing.in(Easing.quad)});
      scale.value = withTiming(0.4, {duration: 600, easing: Easing.in(Easing.quad)});
    } else {
      opacity.value = withTiming(0, {duration: 300});
    }
  }, [visible, suckedIn]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: translateY.value}, {scale: scale.value}],
  }));

  return (
    <Animated.Text style={[styles.text, style]} numberOfLines={4}>
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    width: width * 0.75,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 0.5,
    lineHeight: 26,
  },
});
