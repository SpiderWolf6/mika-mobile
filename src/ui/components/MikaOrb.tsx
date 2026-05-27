import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import Svg, {Path, Defs, RadialGradient, Stop} from 'react-native-svg';
import {ProcessingStage} from '../../types';

const ORB = 200;
const NUM_BARS = 24;
const BLOB_RADIUS = ORB * 0.46;
const CENTER = ORB / 2;

interface Props {
  stage: ProcessingStage;
  audioLevel?: number; // 0–1, live mic or simulated TTS amplitude
}

// Smooth closed SVG path via catmull-rom → cubic bezier
function smoothPath(pts: {x: number; y: number}[]): string {
  const n = pts.length;
  const cp = pts.map((_, i) => {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const t = 0.4;
    return {
      cp1x: p1.x + (p2.x - p0.x) * t / 2,
      cp1y: p1.y + (p2.y - p0.y) * t / 2,
      cp2x: p2.x - (p3.x - p1.x) * t / 2,
      cp2y: p2.y - (p3.y - p1.y) * t / 2,
    };
  });
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    const c = cp[i];
    d += ` C ${c.cp1x.toFixed(2)} ${c.cp1y.toFixed(2)} ${c.cp2x.toFixed(2)} ${c.cp2y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return d + ' Z';
}

// Blob points scaled outward by a factor (for ghost ripple)
function scaledBlobPath(pts: {x: number; y: number}[], factor: number): string {
  const scaled = pts.map(p => ({
    x: CENTER + (p.x - CENTER) * factor,
    y: CENTER + (p.y - CENTER) * factor,
  }));
  return smoothPath(scaled);
}

export function MikaOrb({stage, audioLevel = 0}: Props) {
  const outerRot  = useRef(new Animated.Value(0)).current;
  const innerRot  = useRef(new Animated.Value(0)).current;
  const orbScale  = useRef(new Animated.Value(1)).current;
  const coreGlow  = useRef(new Animated.Value(0.5)).current;
  const ring1     = useRef(new Animated.Value(0)).current;
  const ring2     = useRef(new Animated.Value(0)).current;
  const anims     = useRef<Animated.CompositeAnimation[]>([]);
  const barTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // JS-side bar scales used for blob path and iris bars
  const barScalesRef = useRef<number[]>(Array(NUM_BARS).fill(0.35));
  const [blobScales, setBlobScales] = useState<number[]>(Array(NUM_BARS).fill(0.35));

  // Animated values for native-driver iris bars
  const bars = useRef(Array.from({length: NUM_BARS}, () => new Animated.Value(0.35))).current;

  // Audio-driven mode: when audioLevel > 0 and stage is recording/speaking,
  // we skip random roaming and push bar values from audioLevel
  const audioLevelRef = useRef(audioLevel);
  useEffect(() => { audioLevelRef.current = audioLevel; }, [audioLevel]);

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

  // Random roaming — used for idle/thinking/transcribing
  function roamBar(bar: Animated.Value, idx: number, min: number, max: number, speed: number) {
    const next = min + Math.random() * (max - min);
    const dur  = speed * (0.7 + Math.random() * 0.6);
    const anim = Animated.timing(bar, {
      toValue: next, duration: dur,
      easing: Easing.inOut(Easing.sin), useNativeDriver: true,
    });
    anims.current.push(anim);
    anim.start(({finished}) => {
      if (finished) {
        barScalesRef.current[idx] = next;
        setBlobScales(prev => { const n = [...prev]; n[idx] = next; return n; });
        roamBar(bar, idx, min, max, speed);
      }
    });
  }

  function startBars(min: number, max: number, speed: number) {
    bars.forEach((bar, i) => {
      const t = setTimeout(() => roamBar(bar, i, min, max, speed), i * (speed / NUM_BARS));
      barTimers.current.push(t);
    });
  }

  // Audio-reactive mode — poll audioLevelRef and push all bars toward it with per-bar noise
  const audioTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startAudioReactive(baseMin: number) {
    // Still do random roaming but at high speed; audioLevel scales the target range
    bars.forEach((bar, i) => {
      function tick() {
        const level = audioLevelRef.current;
        // Each bar gets a noisy version of the level
        const noise = 0.85 + Math.random() * 0.3;
        const target = Math.max(baseMin, Math.min(1.0, level * noise));
        const dur = 80 + Math.random() * 60;
        const anim = Animated.timing(bar, {
          toValue: target, duration: dur,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        });
        anims.current.push(anim);
        anim.start(({finished}) => {
          if (finished) {
            barScalesRef.current[i] = target;
            setBlobScales(prev => { const n = [...prev]; n[i] = target; return n; });
            tick();
          }
        });
      }
      // Stagger starts so bars don't all move together
      const t = setTimeout(tick, i * 8);
      barTimers.current.push(t);
    });
  }

  useEffect(() => {
    stopAll();
    ring1.setValue(0);
    ring2.setValue(0);

    if (stage === 'idle') {
      startBars(0.18, 0.6, 1800);
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
      // Audio-reactive — bars driven by mic level
      startAudioReactive(0.2);
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
      // Audio-reactive — bars driven by simulated TTS amplitude from HomeScreen
      startAudioReactive(0.2);
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

  // Ripple rings — scale the blob boundary outward
  const r1s = ring1.interpolate({inputRange:[0,1], outputRange:[1, 2.0]});
  const r1o = ring1.interpolate({inputRange:[0,0.4,1], outputRange:[0.45,0.12,0]});
  const r2s = ring2.interpolate({inputRange:[0,1], outputRange:[1, 2.8]});
  const r2o = ring2.interpolate({inputRange:[0,0.4,1], outputRange:[0.25,0.05,0]});

  // Blob boundary points
  const blobPoints = blobScales.map((s, i) => {
    const angle = (i / NUM_BARS) * 2 * Math.PI - Math.PI / 2;
    const r = BLOB_RADIUS * (0.62 + s * 0.38);
    return {
      x: CENTER + Math.cos(angle) * r,
      y: CENTER + Math.sin(angle) * r,
    };
  });

  const blobPath = smoothPath(blobPoints);
  // Ghost paths for ripple — slightly larger version of the blob
  const ripplePath1 = scaledBlobPath(blobPoints, 1.18);
  const ripplePath2 = scaledBlobPath(blobPoints, 1.35);

  const irisBarRadius = BLOB_RADIUS * 0.72;

  return (
    <View style={styles.container}>
      {/* Rotating orbit dashes */}
      <Animated.View style={[styles.orbit, {borderColor: PRIMARY, transform:[{rotate: outerDeg}]}]} />
      <Animated.View style={[styles.orbitInner, {borderColor: PRIMARY, transform:[{rotate: innerDeg}]}]} />

      {/* Blob-shaped ripple rings — scale from blob boundary outward */}
      <Animated.View style={[styles.rippleWrap, {opacity: r2o, transform:[{scale: r2s}]}]}>
        <Svg width={ORB} height={ORB}>
          <Path d={ripplePath2} fill="none" stroke={PRIMARY} strokeWidth={1} strokeOpacity={1} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.rippleWrap, {opacity: r1o, transform:[{scale: r1s}]}]}>
        <Svg width={ORB} height={ORB}>
          <Path d={ripplePath1} fill="none" stroke={PRIMARY} strokeWidth={1.2} strokeOpacity={1} />
        </Svg>
      </Animated.View>

      {/* Main blob body + internals */}
      <Animated.View style={[styles.orbArea, {transform:[{scale: orbScale}]}]}>
        <Svg width={ORB} height={ORB} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#0d0e1c" stopOpacity="1" />
              <Stop offset="100%" stopColor="#05060e" stopOpacity="1" />
            </RadialGradient>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={PRIMARY} stopOpacity="0.38" />
              <Stop offset="55%"  stopColor={PRIMARY} stopOpacity="0.10" />
              <Stop offset="100%" stopColor={PRIMARY} stopOpacity="0"    />
            </RadialGradient>
          </Defs>
          <Path d={blobPath} fill="url(#bg)" />
          <Path d={blobPath} fill="url(#glow)" />
          <Path d={blobPath} fill="none" stroke={PRIMARY} strokeWidth={1.5} strokeOpacity={0.75} />
        </Svg>

        {/* Iris bars */}
        <View style={styles.irisContainer} pointerEvents="none">
          {bars.map((barAnim, i) => {
            const angle = (i / NUM_BARS) * 2 * Math.PI;
            const x = Math.cos(angle) * irisBarRadius;
            const y = Math.sin(angle) * irisBarRadius;
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
  rippleWrap: {
    position: 'absolute',
    width: ORB,
    height: ORB,
  },
  orbArea: {
    width: ORB,
    height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  irisContainer: {
    position: 'absolute',
    width: ORB, height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: 2,
    height: 22,
    borderRadius: 2,
    opacity: 0.85,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  pupil: {
    width: 14, height: 14,
    borderRadius: 7,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },
});
