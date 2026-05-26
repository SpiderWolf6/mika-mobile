import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {ProcessingStage} from '../../types';

const ORB = 140;
const NUM_BARS = 12;

interface Props {
  stage: ProcessingStage;
}

export function MikaOrb({stage}: Props) {
  // Each bar has its own height animation
  const bars = useRef(Array.from({length: NUM_BARS}, () => new Animated.Value(0.3))).current;
  const outerRot  = useRef(new Animated.Value(0)).current;
  const innerRot  = useRef(new Animated.Value(0)).current;
  const orbScale  = useRef(new Animated.Value(1)).current;
  const coreGlow  = useRef(new Animated.Value(0.5)).current;
  const ring1     = useRef(new Animated.Value(0)).current;
  const ring2     = useRef(new Animated.Value(0)).current;
  const anims     = useRef<Animated.CompositeAnimation[]>([]);

  function stopAll() {
    anims.current.forEach(a => a.stop());
    anims.current = [];
  }

  function go(a: Animated.CompositeAnimation) {
    anims.current.push(a);
    a.start();
  }

  function animateBars(minS: number, maxS: number, speed: number, stagger: number) {
    bars.forEach((bar, i) => {
      const delay = i * stagger;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.sequence([
            Animated.timing(bar, {toValue: maxS, duration: speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
            Animated.timing(bar, {toValue: minS, duration: speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
          ]),
        ]),
      );
      go(loop);
    });
  }

  useEffect(() => {
    stopAll();
    ring1.setValue(0);
    ring2.setValue(0);

    if (stage === 'idle') {
      animateBars(0.2, 0.55, 1800, 120);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.03, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 0.97, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 0.7, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.3, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'recording') {
      animateBars(0.25, 1.0, 250, 60);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.08, duration: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 1.02, duration: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 1.0, duration: 250, useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.5, duration: 250, useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 900,  easing: Easing.out(Easing.quad), useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true})));
    }

    if (stage === 'transcribing' || stage === 'thinking') {
      animateBars(0.1, 0.85, 400, 40);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.06, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 0.94, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 1.0, duration: 350, useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.2, duration: 350, useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'speaking') {
      animateBars(0.2, 0.9, 180, 30);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.11, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 1.03, duration: 170, easing: Easing.in(Easing.quad),  useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 1.0, duration: 170, useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.4, duration: 170, useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 700,  easing: Easing.out(Easing.quad), useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true})));
    }
  }, [stage]);

  const PRIMARY = stage === 'recording'   ? '#ff3d7f'
    : stage === 'thinking' || stage === 'transcribing' ? '#bf5af2'
    : stage === 'speaking' ? '#00c8ff'
    : '#4f8ef7';

  const outerDeg = outerRot.interpolate({inputRange:[0,1], outputRange:['0deg','360deg']});
  const innerDeg = innerRot.interpolate({inputRange:[0,1], outputRange:['360deg','0deg']});
  const r1s = ring1.interpolate({inputRange:[0,1], outputRange:[1,2.4]});
  const r1o = ring1.interpolate({inputRange:[0,0.5,1], outputRange:[0.5,0.15,0]});
  const r2s = ring2.interpolate({inputRange:[0,1], outputRange:[1,3.2]});
  const r2o = ring2.interpolate({inputRange:[0,0.5,1], outputRange:[0.3,0.08,0]});

  const RADIUS = ORB * 0.36;

  return (
    <View style={styles.container}>
      {/* Ripple rings */}
      <Animated.View style={[styles.ring, {borderColor: PRIMARY, opacity: r2o, transform:[{scale: r2s}]}]} />
      <Animated.View style={[styles.ring, {borderColor: PRIMARY, opacity: r1o, transform:[{scale: r1s}]}]} />

      {/* Outer orbit dashes — rotating */}
      <Animated.View style={[styles.orbit, {borderColor: PRIMARY, transform:[{rotate: outerDeg}]}]} />
      <Animated.View style={[styles.orbitInner, {borderColor: PRIMARY, transform:[{rotate: innerDeg}]}]} />

      {/* The main orb body */}
      <Animated.View style={[styles.orb, {shadowColor: PRIMARY, transform:[{scale: orbScale}]}]}>

        {/* Ambient glow fill */}
        <Animated.View style={[styles.ambientGlow, {backgroundColor: PRIMARY, opacity: coreGlow.interpolate({inputRange:[0,1],outputRange:[0,0.18]})}]} />

        {/* Iris — ring of bars */}
        <View style={styles.irisContainer}>
          {bars.map((barAnim, i) => {
            const angle = (i / NUM_BARS) * 2 * Math.PI;
            const x = Math.cos(angle) * RADIUS;
            const y = Math.sin(angle) * RADIUS;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  {
                    backgroundColor: PRIMARY,
                    shadowColor: PRIMARY,
                    transform: [
                      {translateX: x},
                      {translateY: y},
                      {rotate: `${(angle * 180) / Math.PI + 90}deg`},
                      {scaleY: barAnim},
                    ],
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Pupil — glowing center dot */}
        <Animated.View style={[styles.pupil, {backgroundColor: PRIMARY, shadowColor: PRIMARY, opacity: coreGlow}]} />

        {/* Lens sheens */}
        <View style={styles.sheenTop} />
        <View style={styles.sheenBot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: ORB * 3.5,
    height: ORB * 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: ORB, height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 1,
  },
  orbit: {
    position: 'absolute',
    width: ORB + 44, height: ORB + 44,
    borderRadius: (ORB + 44) / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  orbitInner: {
    position: 'absolute',
    width: ORB + 22, height: ORB + 22,
    borderRadius: (ORB + 22) / 2,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    opacity: 0.18,
  },
  orb: {
    width: ORB, height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: '#06070f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 36,
    elevation: 24,
  },
  ambientGlow: {
    position: 'absolute',
    width: ORB, height: ORB,
    borderRadius: ORB / 2,
  },
  irisContainer: {
    position: 'absolute',
    width: ORB, height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: 3,
    height: 28,
    borderRadius: 2,
    opacity: 0.85,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  pupil: {
    width: 18, height: 18,
    borderRadius: 9,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },
  sheenTop: {
    position: 'absolute',
    top: ORB * 0.12, left: ORB * 0.22,
    width: ORB * 0.26, height: ORB * 0.1,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{rotate: '-25deg'}],
  },
  sheenBot: {
    position: 'absolute',
    bottom: ORB * 0.16, right: ORB * 0.2,
    width: ORB * 0.1, height: ORB * 0.05,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{rotate: '-25deg'}],
  },
});
