import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {ProcessingStage} from '../../types';

const ORB = 180;

interface Props {
  stage: ProcessingStage;
}

export function MikaOrb({stage}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0.4)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const spin  = useRef(new Animated.Value(0)).current;

  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnim  = useRef<Animated.CompositeAnimation | null>(null);
  const ring1Anim = useRef<Animated.CompositeAnimation | null>(null);
  const ring2Anim = useRef<Animated.CompositeAnimation | null>(null);
  const spinAnim  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    [pulseAnim, glowAnim, ring1Anim, ring2Anim, spinAnim].forEach(r => { r.current?.stop(); });
    ring1.setValue(0);
    ring2.setValue(0);
    spin.setValue(0);

    if (stage === 'idle') {
      pulseAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(pulse, {toValue: 1.04, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1.0,  duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]));
      glowAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(glow, {toValue: 0.65, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(glow, {toValue: 0.25, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]));
    }

    if (stage === 'recording') {
      pulseAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(pulse, {toValue: 1.12, duration: 280, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1.04, duration: 280, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
      ]));
      glowAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(glow, {toValue: 1.0, duration: 280, useNativeDriver: true}),
        Animated.timing(glow, {toValue: 0.5, duration: 280, useNativeDriver: true}),
      ]));
      ring1Anim.current = Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true}));
      ring2Anim.current = Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true}));
    }

    if (stage === 'transcribing' || stage === 'thinking') {
      pulseAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(pulse, {toValue: 1.08, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0.96, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]));
      glowAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(glow, {toValue: 0.9, duration: 380, useNativeDriver: true}),
        Animated.timing(glow, {toValue: 0.3, duration: 380, useNativeDriver: true}),
      ]));
      spinAnim.current = Animated.loop(Animated.timing(spin, {toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true}));
    }

    if (stage === 'speaking') {
      pulseAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(pulse, {toValue: 1.14, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1.04, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true}),
      ]));
      glowAnim.current = Animated.loop(Animated.sequence([
        Animated.timing(glow, {toValue: 1.0, duration: 180, useNativeDriver: true}),
        Animated.timing(glow, {toValue: 0.4, duration: 180, useNativeDriver: true}),
      ]));
      ring1Anim.current = Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 750, easing: Easing.out(Easing.quad), useNativeDriver: true}));
      ring2Anim.current = Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1050, easing: Easing.out(Easing.quad), useNativeDriver: true}));
    }

    pulseAnim.current?.start();
    glowAnim.current?.start();
    ring1Anim.current?.start();
    ring2Anim.current?.start();
    spinAnim.current?.start();
  }, [stage]);

  const color = stage === 'recording'   ? '#ff4d8f'
    : stage === 'thinking' || stage === 'transcribing' ? '#a855f7'
    : stage === 'speaking' ? '#22d3ee'
    : '#6366f1';

  const ringScale1 = ring1.interpolate({inputRange: [0,1], outputRange: [1, 2.1]});
  const ringOpacity1 = ring1.interpolate({inputRange: [0, 0.6, 1], outputRange: [0.55, 0.15, 0]});
  const ringScale2 = ring2.interpolate({inputRange: [0,1], outputRange: [1, 2.7]});
  const ringOpacity2 = ring2.interpolate({inputRange: [0, 0.6, 1], outputRange: [0.35, 0.08, 0]});
  const glowScale = glow.interpolate({inputRange: [0,1], outputRange: [0.9, 1.25]});
  const spinDeg = spin.interpolate({inputRange: [0,1], outputRange: ['0deg','360deg']});
  const isThinking = stage === 'thinking' || stage === 'transcribing';
  const spinOpacity = spin.interpolate({inputRange: [0, 1], outputRange: [isThinking ? 0.6 : 0, isThinking ? 0.6 : 0]});

  return (
    <View style={styles.container}>
      {/* Ripple rings */}
      <Animated.View style={[styles.ring, {borderColor: color, opacity: ringOpacity2, transform: [{scale: ringScale2}]}]} />
      <Animated.View style={[styles.ring, {borderColor: color, opacity: ringOpacity1, transform: [{scale: ringScale1}]}]} />

      {/* Glow blob */}
      <Animated.View style={[styles.glow, {backgroundColor: color, opacity: glow.interpolate({inputRange:[0,1],outputRange:[0,0.18]}), transform: [{scale: glowScale}]}]} />

      {/* Spin dot for thinking */}
      <Animated.View style={[styles.spinWrap, {opacity: spinOpacity, transform: [{rotate: spinDeg}]}]}>
        <View style={[styles.spinDot, {backgroundColor: color}]} />
      </Animated.View>

      {/* Core orb */}
      <Animated.View style={[styles.orb, {transform: [{scale: pulse}]}]}>
        <View style={[styles.orbCore, {backgroundColor: color, shadowColor: color}]} />
        <View style={styles.orbSheen} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: ORB * 3,
    height: ORB * 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 1.5,
  },
  glow: {
    position: 'absolute',
    width: ORB * 0.9,
    height: ORB * 0.9,
    borderRadius: ORB * 0.45,
  },
  spinWrap: {
    position: 'absolute',
    width: ORB + 28,
    height: ORB + 28,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  spinDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCore: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    opacity: 0.88,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.85,
    shadowRadius: 32,
    elevation: 20,
  },
  orbSheen: {
    position: 'absolute',
    top: ORB * 0.13,
    left: ORB * 0.22,
    width: ORB * 0.32,
    height: ORB * 0.22,
    borderRadius: ORB * 0.12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{rotate: '-30deg'}],
  },
});
