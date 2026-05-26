import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import {ProcessingStage} from '../../types';

interface Props {
  stage: ProcessingStage;
}

const ORB_SIZE = 180;

export function MikaOrb({stage}: Props) {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.5);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const thinkSpin = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);
    cancelAnimation(glow);
    cancelAnimation(ring1);
    cancelAnimation(ring2);
    cancelAnimation(thinkSpin);

    if (stage === 'idle') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, {duration: 2800, easing: Easing.inOut(Easing.sine)}),
          withTiming(1.0,  {duration: 2800, easing: Easing.inOut(Easing.sine)}),
        ), -1, false,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(0.7, {duration: 2800, easing: Easing.inOut(Easing.sine)}),
          withTiming(0.3, {duration: 2800, easing: Easing.inOut(Easing.sine)}),
        ), -1, false,
      );
      ring1.value = 0;
      ring2.value = 0;
    }

    if (stage === 'recording') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.12, {duration: 300, easing: Easing.inOut(Easing.quad)}),
          withTiming(1.04, {duration: 300, easing: Easing.inOut(Easing.quad)}),
        ), -1, false,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1.0, {duration: 300}),
          withTiming(0.6, {duration: 300}),
        ), -1, false,
      );
      ring1.value = withRepeat(withTiming(1, {duration: 1200, easing: Easing.out(Easing.quad)}), -1, false);
      ring2.value = withRepeat(withTiming(1, {duration: 1800, easing: Easing.out(Easing.quad)}), -1, false);
    }

    if (stage === 'transcribing' || stage === 'thinking') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, {duration: 600, easing: Easing.inOut(Easing.sine)}),
          withTiming(0.96, {duration: 600, easing: Easing.inOut(Easing.sine)}),
        ), -1, false,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(0.9, {duration: 400}),
          withTiming(0.4, {duration: 400}),
        ), -1, false,
      );
      thinkSpin.value = withRepeat(withTiming(1, {duration: 2000, easing: Easing.linear}), -1, false);
    }

    if (stage === 'speaking') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, {duration: 200, easing: Easing.out(Easing.quad)}),
          withTiming(1.05, {duration: 200, easing: Easing.in(Easing.quad)}),
        ), -1, false,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1.0, {duration: 200}),
          withTiming(0.5, {duration: 200}),
        ), -1, false,
      );
      ring1.value = withRepeat(withTiming(1, {duration: 800, easing: Easing.out(Easing.quad)}), -1, false);
      ring2.value = withRepeat(withTiming(1, {duration: 1100, easing: Easing.out(Easing.quad)}), -1, false);
    }
  }, [stage]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{scale: pulse.value}],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{scale: interpolate(glow.value, [0, 1], [1, 1.3])}],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.7, 1], [0.6, 0.2, 0]),
    transform: [{scale: interpolate(ring1.value, [0, 1], [1, 2.0])}],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.7, 1], [0.4, 0.1, 0]),
    transform: [{scale: interpolate(ring2.value, [0, 1], [1, 2.6])}],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${thinkSpin.value * 360}deg`}],
    opacity: (stage === 'thinking' || stage === 'transcribing') ? 0.6 : 0,
  }));

  const color = stage === 'recording' ? '#ff4d8f'
    : stage === 'thinking' || stage === 'transcribing' ? '#a855f7'
    : stage === 'speaking' ? '#22d3ee'
    : '#6366f1';

  return (
    <View style={styles.container}>
      {/* Ripple rings */}
      <Animated.View style={[styles.ring, {borderColor: color}, ring2Style]} />
      <Animated.View style={[styles.ring, {borderColor: color}, ring1Style]} />

      {/* Outer glow */}
      <Animated.View style={[styles.glow, {backgroundColor: color}, glowStyle]} />

      {/* Spin arc for thinking */}
      <Animated.View style={[styles.spinArc, spinStyle]}>
        <View style={[styles.arcDot, {backgroundColor: color}]} />
      </Animated.View>

      {/* Core orb */}
      <Animated.View style={[styles.orb, orbStyle]}>
        <View style={[styles.orbInner, {shadowColor: color}]}>
          <View style={[styles.orbCore, {backgroundColor: color}]} />
          <View style={styles.orbSheen} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: ORB_SIZE * 3,
    height: ORB_SIZE * 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1.5,
  },
  glow: {
    position: 'absolute',
    width: ORB_SIZE * 0.9,
    height: ORB_SIZE * 0.9,
    borderRadius: ORB_SIZE * 0.45,
    opacity: 0.15,
  },
  spinArc: {
    position: 'absolute',
    width: ORB_SIZE + 24,
    height: ORB_SIZE + 24,
    alignItems: 'center',
  },
  arcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 0,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbInner: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
  },
  orbCore: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    opacity: 0.85,
  },
  orbSheen: {
    position: 'absolute',
    top: ORB_SIZE * 0.12,
    left: ORB_SIZE * 0.2,
    width: ORB_SIZE * 0.35,
    height: ORB_SIZE * 0.25,
    borderRadius: ORB_SIZE * 0.15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{rotate: '-30deg'}],
  },
});
