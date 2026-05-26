import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {ProcessingStage} from '../../types';

const ORB = 160;

interface Props {
  stage: ProcessingStage;
}

export function MikaOrb({stage}: Props) {
  const scale      = useRef(new Animated.Value(1)).current;
  const innerScale = useRef(new Animated.Value(0.72)).current;
  const coreOpacity= useRef(new Animated.Value(0.7)).current;
  const ring1      = useRef(new Animated.Value(0)).current;
  const ring2      = useRef(new Animated.Value(0)).current;
  const ring3      = useRef(new Animated.Value(0)).current;
  const scanLine   = useRef(new Animated.Value(0)).current;
  const hexRot     = useRef(new Animated.Value(0)).current;

  const anims = useRef<Animated.CompositeAnimation[]>([]);

  function stopAll() {
    anims.current.forEach(a => a.stop());
    anims.current = [];
  }

  function run(a: Animated.CompositeAnimation) {
    anims.current.push(a);
    a.start();
  }

  useEffect(() => {
    stopAll();
    ring1.setValue(0);
    ring2.setValue(0);
    ring3.setValue(0);

    if (stage === 'idle') {
      run(Animated.loop(Animated.sequence([
        Animated.timing(scale,       {toValue: 1.03, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(scale,       {toValue: 0.97, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(innerScale,  {toValue: 0.78, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(innerScale,  {toValue: 0.65, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(coreOpacity, {toValue: 0.9,  duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(coreOpacity, {toValue: 0.45, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.timing(hexRot, {toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'recording') {
      run(Animated.loop(Animated.sequence([
        Animated.timing(scale,       {toValue: 1.10, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
        Animated.timing(scale,       {toValue: 1.04, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(innerScale,  {toValue: 0.88, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
        Animated.timing(innerScale,  {toValue: 0.72, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(coreOpacity, {toValue: 1.0,  duration: 220, useNativeDriver: true}),
        Animated.timing(coreOpacity, {toValue: 0.6,  duration: 220, useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 900,  easing: Easing.out(Easing.quad), useNativeDriver: true})));
      run(Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true})));
      run(Animated.loop(Animated.timing(ring3, {toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true})));
      run(Animated.loop(Animated.timing(hexRot, {toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'transcribing' || stage === 'thinking') {
      run(Animated.loop(Animated.sequence([
        Animated.timing(scale,       {toValue: 1.06, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(scale,       {toValue: 0.94, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(innerScale,  {toValue: 0.82, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(innerScale,  {toValue: 0.58, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(coreOpacity, {toValue: 1.0,  duration: 400, useNativeDriver: true}),
        Animated.timing(coreOpacity, {toValue: 0.3,  duration: 400, useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.timing(scanLine, {toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true})));
      run(Animated.loop(Animated.timing(hexRot,   {toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'speaking') {
      run(Animated.loop(Animated.sequence([
        Animated.timing(scale,       {toValue: 1.13, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true}),
        Animated.timing(scale,       {toValue: 1.04, duration: 160, easing: Easing.in(Easing.quad),  useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(innerScale,  {toValue: 0.92, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true}),
        Animated.timing(innerScale,  {toValue: 0.70, duration: 160, easing: Easing.in(Easing.quad),  useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.sequence([
        Animated.timing(coreOpacity, {toValue: 1.0,  duration: 160, useNativeDriver: true}),
        Animated.timing(coreOpacity, {toValue: 0.5,  duration: 160, useNativeDriver: true}),
      ])));
      run(Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 700,  easing: Easing.out(Easing.quad), useNativeDriver: true})));
      run(Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true})));
      run(Animated.loop(Animated.timing(hexRot, {toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true})));
    }
  }, [stage]);

  const PRIMARY   = stage === 'recording'   ? '#ff3d7f'
    : stage === 'thinking' || stage === 'transcribing' ? '#bf5af2'
    : stage === 'speaking' ? '#0af'
    : '#4f8ef7';

  const SECONDARY = stage === 'recording'   ? '#ff8c00'
    : stage === 'thinking' || stage === 'transcribing' ? '#7c3aed'
    : stage === 'speaking' ? '#06f'
    : '#1e3a8a';

  const r1Scale   = ring1.interpolate({inputRange:[0,1], outputRange:[1, 2.2]});
  const r1Opacity = ring1.interpolate({inputRange:[0,0.5,1], outputRange:[0.6,0.2,0]});
  const r2Scale   = ring2.interpolate({inputRange:[0,1], outputRange:[1, 2.8]});
  const r2Opacity = ring2.interpolate({inputRange:[0,0.5,1], outputRange:[0.35,0.1,0]});
  const r3Scale   = ring3.interpolate({inputRange:[0,1], outputRange:[1, 3.5]});
  const r3Opacity = ring3.interpolate({inputRange:[0,0.5,1], outputRange:[0.2,0.05,0]});
  const hexDeg    = hexRot.interpolate({inputRange:[0,1], outputRange:['0deg','360deg']});
  const scanY     = scanLine.interpolate({inputRange:[0,1], outputRange:[-ORB/2, ORB/2]});
  const scanOp    = scanLine.interpolate({inputRange:[0,0.1,0.9,1], outputRange:[0,0.6,0.6,0]});

  return (
    <View style={styles.container}>
      {/* Ripple rings */}
      <Animated.View style={[styles.ring, {borderColor: PRIMARY, opacity: r3Opacity, transform:[{scale: r3Scale}]}]} />
      <Animated.View style={[styles.ring, {borderColor: PRIMARY, opacity: r2Opacity, transform:[{scale: r2Scale}]}]} />
      <Animated.View style={[styles.ring, {borderColor: PRIMARY, opacity: r1Opacity, transform:[{scale: r1Scale}]}]} />

      {/* Rotating hex ring */}
      <Animated.View style={[styles.hexRing, {borderColor: PRIMARY, transform:[{rotate: hexDeg}]}]} />
      <Animated.View style={[styles.hexRingInner, {borderColor: SECONDARY, transform:[{rotate: hexDeg}, {scaleX: -1}]}]} />

      {/* Outer shell */}
      <Animated.View style={[styles.outerShell, {borderColor: PRIMARY, shadowColor: PRIMARY, transform:[{scale}]}]}>

        {/* Glow fill */}
        <Animated.View style={[styles.glowFill, {backgroundColor: PRIMARY, opacity: coreOpacity}]} />

        {/* Inner bright core */}
        <Animated.View style={[styles.innerCore, {backgroundColor: PRIMARY, transform:[{scale: innerScale}]}]} />

        {/* Scan line (thinking state) */}
        <Animated.View style={[styles.scanLine, {backgroundColor: PRIMARY, opacity: scanOp, transform:[{translateY: scanY}]}]} />

        {/* Lens sheen top */}
        <View style={styles.sheenTop} />
        {/* Lens sheen bottom-right */}
        <View style={styles.sheenBottom} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: ORB * 4,
    height: ORB * 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 1,
  },
  hexRing: {
    position: 'absolute',
    width: ORB + 36,
    height: ORB + 36,
    borderRadius: (ORB + 36) / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.25,
  },
  hexRingInner: {
    position: 'absolute',
    width: ORB + 18,
    height: ORB + 18,
    borderRadius: (ORB + 18) / 2,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    opacity: 0.15,
  },
  outerShell: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(6,6,20,0.92)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 30,
  },
  glowFill: {
    position: 'absolute',
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    opacity: 0.12,
  },
  innerCore: {
    width: ORB * 0.55,
    height: ORB * 0.55,
    borderRadius: ORB * 0.275,
    opacity: 0.9,
    shadowColor: '#fff',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 10,
  },
  scanLine: {
    position: 'absolute',
    width: ORB,
    height: 1.5,
    opacity: 0.5,
  },
  sheenTop: {
    position: 'absolute',
    top: ORB * 0.14,
    left: ORB * 0.22,
    width: ORB * 0.28,
    height: ORB * 0.12,
    borderRadius: ORB * 0.08,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{rotate: '-25deg'}],
  },
  sheenBottom: {
    position: 'absolute',
    bottom: ORB * 0.18,
    right: ORB * 0.2,
    width: ORB * 0.12,
    height: ORB * 0.06,
    borderRadius: ORB * 0.04,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{rotate: '-25deg'}],
  },
});
