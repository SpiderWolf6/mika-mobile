import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {ProcessingStage} from '../../types';

const ORB = 190;
const NUM_BARS = 16;
const BLOB_RADIUS = ORB * 0.38;

interface Props {
  stage: ProcessingStage;
}

// Smooth never-restarting loop: animates between random values continuously
function smoothRoam(val: Animated.Value, min: number, max: number, speed: number): Animated.CompositeAnimation {
  const next = min + Math.random() * (max - min);
  return Animated.sequence([
    Animated.timing(val, {toValue: next, duration: speed + Math.random() * speed * 0.4, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
  ]);
}

export function MikaOrb({stage}: Props) {
  const bars       = useRef(Array.from({length: NUM_BARS}, () => new Animated.Value(0.35))).current;
  const outerRot   = useRef(new Animated.Value(0)).current;
  const innerRot   = useRef(new Animated.Value(0)).current;
  const orbScale   = useRef(new Animated.Value(1)).current;
  const coreGlow   = useRef(new Animated.Value(0.5)).current;
  const ring1      = useRef(new Animated.Value(0)).current;
  const ring2      = useRef(new Animated.Value(0)).current;
  const anims      = useRef<Animated.CompositeAnimation[]>([]);
  const barTimers  = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Blob shape state — driven by bar values, non-native so we track in JS
  const [blobScales, setBlobScales] = useState<number[]>(Array(NUM_BARS).fill(0.35));

  function stopAll() {
    anims.current.forEach(a => a.stop());
    anims.current = [];
    barTimers.current.forEach(t => clearTimeout(t));
    barTimers.current = [];
  }

  function go(a: Animated.CompositeAnimation) {
    anims.current.push(a);
    a.start();
  }

  // Roaming animation per bar — never resets, just keeps finding new targets
  function roamBar(bar: Animated.Value, idx: number, min: number, max: number, speed: number) {
    const next = min + Math.random() * (max - min);
    const dur  = speed * (0.7 + Math.random() * 0.6);
    const anim = Animated.timing(bar, {
      toValue: next,
      duration: dur,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });
    anims.current.push(anim);
    anim.start(({finished}) => {
      if (finished) {
        // Update blob state from bar value
        setBlobScales(prev => {
          const next2 = [...prev];
          next2[idx] = next;
          return next2;
        });
        roamBar(bar, idx, min, max, speed);
      }
    });
  }

  function startBars(min: number, max: number, speed: number) {
    bars.forEach((bar, i) => {
      // Stagger start so they don't all move together
      const t = setTimeout(() => roamBar(bar, i, min, max, speed), i * (speed / NUM_BARS));
      barTimers.current.push(t);
    });
  }

  useEffect(() => {
    stopAll();
    ring1.setValue(0);
    ring2.setValue(0);

    if (stage === 'idle') {
      startBars(0.18, 0.6, 1600);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.025, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 0.975, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 0.65, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.25, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'recording') {
      startBars(0.3, 1.0, 220);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.07, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 1.01, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 1.0, duration: 220, useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.45, duration: 220, useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 900,  easing: Easing.out(Easing.quad), useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true})));
    }

    if (stage === 'transcribing' || stage === 'thinking') {
      startBars(0.12, 0.9, 380);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.05, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 0.95, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 1.0, duration: 380, useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.15, duration: 380, useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'speaking') {
      startBars(0.22, 0.95, 160);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.10, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 1.02, duration: 160, easing: Easing.in(Easing.quad),  useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 1.0, duration: 160, useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.35, duration: 160, useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true})));
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
  const r2o = ring2.interpolate({inputRange:[0,0.5,1], outputRange:[0.3,0.06,0]});

  // Build blob polygon path from bar scales
  const blobPoints = blobScales.map((s, i) => {
    const angle = (i / NUM_BARS) * 2 * Math.PI - Math.PI / 2;
    const r = BLOB_RADIUS * (0.55 + s * 0.45);
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    };
  });

  return (
    <View style={styles.container}>
      {/* Ripple rings */}
      <Animated.View style={[styles.ring, {borderColor: PRIMARY, opacity: r2o, transform:[{scale: r2s}]}]} />
      <Animated.View style={[styles.ring, {borderColor: PRIMARY, opacity: r1o, transform:[{scale: r1s}]}]} />

      {/* Rotating orbit dashes */}
      <Animated.View style={[styles.orbit, {borderColor: PRIMARY, transform:[{rotate: outerDeg}]}]} />
      <Animated.View style={[styles.orbitInner, {borderColor: PRIMARY, transform:[{rotate: innerDeg}]}]} />

      {/* Orb shell */}
      <Animated.View style={[styles.orb, {shadowColor: PRIMARY, transform:[{scale: orbScale}]}]}>

        {/* Ambient glow */}
        <Animated.View style={[styles.ambientGlow, {backgroundColor: PRIMARY, opacity: coreGlow.interpolate({inputRange:[0,1],outputRange:[0,0.2]})}]} />

        {/* Blob — amorphous shape driven by bar scales */}
        <View style={styles.blobContainer} pointerEvents="none">
          {blobPoints.map((pt, i) => {
            const next = blobPoints[(i + 1) % NUM_BARS];
            const cx = (pt.x + next.x) / 2 + ORB / 2;
            const cy = (pt.y + next.y) / 2 + ORB / 2;
            const dx = next.x - pt.x;
            const dy = next.y - pt.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={i}
                style={[
                  styles.blobSegment,
                  {
                    width: len + 6,
                    backgroundColor: PRIMARY,
                    left: cx - (len + 6) / 2,
                    top: cy - 3,
                    transform: [{rotate: `${angle}deg`}],
                    opacity: 0.55,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Radial bars — iris effect */}
        <View style={styles.irisContainer}>
          {bars.map((barAnim, i) => {
            const angle = (i / NUM_BARS) * 2 * Math.PI;
            const x = Math.cos(angle) * BLOB_RADIUS;
            const y = Math.sin(angle) * BLOB_RADIUS;
            return (
              <Animated.View
                key={i}
                style={[styles.bar, {
                  backgroundColor: PRIMARY,
                  shadowColor: PRIMARY,
                  transform: [
                    {translateX: x},
                    {translateY: y},
                    {rotate: `${(angle * 180) / Math.PI + 90}deg`},
                    {scaleY: barAnim},
                  ],
                }]}
              />
            );
          })}
        </View>

        {/* Pupil */}
        <Animated.View style={[styles.pupil, {backgroundColor: PRIMARY, shadowColor: PRIMARY, opacity: coreGlow}]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: ORB * 3.2,
    height: ORB * 3.2,
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
    width: ORB + 50, height: ORB + 50,
    borderRadius: (ORB + 50) / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.28,
  },
  orbitInner: {
    position: 'absolute',
    width: ORB + 25, height: ORB + 25,
    borderRadius: (ORB + 25) / 2,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    opacity: 0.15,
  },
  orb: {
    width: ORB, height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: '#05060e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 24,
  },
  ambientGlow: {
    position: 'absolute',
    width: ORB, height: ORB,
    borderRadius: ORB / 2,
  },
  blobContainer: {
    position: 'absolute',
    width: ORB,
    height: ORB,
  },
  blobSegment: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
  },
  irisContainer: {
    position: 'absolute',
    width: ORB, height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: 2.5,
    height: 24,
    borderRadius: 2,
    opacity: 0.9,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 4,
  },
  pupil: {
    width: 16, height: 16,
    borderRadius: 8,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
});
