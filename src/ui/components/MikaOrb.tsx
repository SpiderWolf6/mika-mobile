import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import Svg, {Path, Defs, RadialGradient, Stop} from 'react-native-svg';
import {ProcessingStage} from '../../types';

const ORB       = 200;
const NUM_BARS  = 32;           // more points = smoother boundary
const BLOB_R    = ORB * 0.44;   // max blob radius
const CENTER    = ORB / 2;
const TENSION   = 0.5;          // catmull-rom tension — higher = rounder

interface Props {
  stage: ProcessingStage;
  audioLevel?: number;
}

// Catmull-rom → cubic bezier, closed path
function smoothPath(pts: {x: number; y: number}[]): string {
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) * TENSION / 2;
    const cp1y = p1.y + (p2.y - p0.y) * TENSION / 2;
    const cp2x = p2.x - (p3.x - p1.x) * TENSION / 2;
    const cp2y = p2.y - (p3.y - p1.y) * TENSION / 2;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + ' Z';
}

function scaledPath(pts: {x: number; y: number}[], f: number): string {
  return smoothPath(pts.map(p => ({
    x: CENTER + (p.x - CENTER) * f,
    y: CENTER + (p.y - CENTER) * f,
  })));
}

function blobPointsFromScales(scales: number[]): {x: number; y: number}[] {
  return scales.map((s, i) => {
    const angle = (i / scales.length) * 2 * Math.PI - Math.PI / 2;
    const r = BLOB_R * (0.60 + s * 0.40);
    return { x: CENTER + Math.cos(angle) * r, y: CENTER + Math.sin(angle) * r };
  });
}

export function MikaOrb({stage, audioLevel = 0}: Props) {
  const outerRot = useRef(new Animated.Value(0)).current;
  const innerRot = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const coreGlow = useRef(new Animated.Value(0.5)).current;
  const ring1    = useRef(new Animated.Value(0)).current;
  const ring2    = useRef(new Animated.Value(0)).current;
  const anims    = useRef<Animated.CompositeAnimation[]>([]);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Native-driver bar values (for iris bars only)
  const bars = useRef(Array.from({length: NUM_BARS}, () => new Animated.Value(0.35))).current;

  // JS-side target scales — bars animate toward these
  const targetScales = useRef<number[]>(Array(NUM_BARS).fill(0.35));
  // Current interpolated scales — updated via rAF at 60fps
  const currentScales = useRef<number[]>(Array(NUM_BARS).fill(0.35));
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const [blobPath, setBlobPath]     = useState(() => smoothPath(blobPointsFromScales(currentScales.current)));
  const [ripplePath1, setRipplePath1] = useState('');
  const [ripplePath2, setRipplePath2] = useState('');

  const audioLevelRef = useRef(audioLevel);
  useEffect(() => { audioLevelRef.current = audioLevel; }, [audioLevel]);

  // rAF loop — lerps currentScales toward targetScales, recomputes blob path each frame
  function startRaf() {
    if (rafRef.current !== null) { return; }
    lastFrameRef.current = performance.now();
    function frame(now: number) {
      const dt = Math.min(now - lastFrameRef.current, 50); // cap at 50ms
      lastFrameRef.current = now;
      // Smoothing factor: higher = snappier, lower = more lag
      // ~12ms half-life for audio-reactive, ~80ms for roaming
      const isReactive = stageIsReactive.current;
      const alpha = isReactive
        ? 1 - Math.pow(0.5, dt / 35)   // half-life 35ms — snappy but smooth
        : 1 - Math.pow(0.5, dt / 120);  // half-life 120ms — slow dreamy
      let changed = false;
      for (let i = 0; i < NUM_BARS; i++) {
        const diff = targetScales.current[i] - currentScales.current[i];
        if (Math.abs(diff) > 0.001) {
          currentScales.current[i] += diff * alpha;
          changed = true;
        }
      }
      if (changed) {
        const pts = blobPointsFromScales(currentScales.current);
        const path = smoothPath(pts);
        setBlobPath(path);
        setRipplePath1(scaledPath(pts, 1.16));
        setRipplePath2(scaledPath(pts, 1.32));
      }
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  function stopRaf() {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  const stageIsReactive = useRef(false);

  function stopAll() {
    anims.current.forEach(a => a.stop());
    anims.current = [];
    timers.current.forEach(t => clearTimeout(t));
    timers.current = [];
  }

  function go(a: Animated.CompositeAnimation) { anims.current.push(a); a.start(); }

  // Random roaming — sets targetScales, rAF lerps currentScales smoothly
  function roamBar(idx: number, min: number, max: number, speed: number) {
    const next = min + Math.random() * (max - min);
    const dur  = speed * (0.8 + Math.random() * 0.4);
    const anim = Animated.timing(bars[idx], {
      toValue: next, duration: dur,
      easing: Easing.inOut(Easing.sin), useNativeDriver: true,
    });
    anims.current.push(anim);
    anim.start(({finished}) => {
      if (finished) {
        targetScales.current[idx] = next;
        roamBar(idx, min, max, speed);
      }
    });
  }

  function startRoam(min: number, max: number, speed: number) {
    bars.forEach((_, i) => {
      const t = setTimeout(() => roamBar(i, min, max, speed), i * (speed / NUM_BARS));
      timers.current.push(t);
    });
  }

  // Audio-reactive — polls audioLevelRef and updates targetScales each tick
  const audioTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startAudioReactive(baseMin: number) {
    if (audioTickRef.current) { clearInterval(audioTickRef.current); }
    // Per-bar phase offsets so bars don't all peak simultaneously
    const phaseOffset = Array.from({length: NUM_BARS}, (_, i) => (i / NUM_BARS) * Math.PI * 2);
    let tick = 0;
    audioTickRef.current = setInterval(() => {
      tick++;
      const level = audioLevelRef.current;
      for (let i = 0; i < NUM_BARS; i++) {
        // Sinusoidal variation across bars + small random noise
        const wave   = 0.5 + 0.5 * Math.sin(phaseOffset[i] + tick * 0.15);
        const noise  = (Math.random() - 0.5) * 0.15;
        const target = Math.max(baseMin, Math.min(1.0, level * (0.7 + wave * 0.5) + noise));
        targetScales.current[i] = target;
        // Also drive the native-driver bar for iris effect
        bars[i].setValue(target);
      }
    }, 30); // 33fps target updates
  }

  function stopAudioReactive() {
    if (audioTickRef.current) { clearInterval(audioTickRef.current); audioTickRef.current = null; }
  }

  useEffect(() => {
    stopAll();
    stopAudioReactive();
    ring1.setValue(0);
    ring2.setValue(0);
    stageIsReactive.current = (stage === 'recording' || stage === 'speaking');
    startRaf();

    if (stage === 'idle') {
      startRoam(0.18, 0.6, 2000);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.02, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 0.98, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 0.65, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.25, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'recording') {
      startAudioReactive(0.18);
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true})));
    }

    if (stage === 'transcribing' || stage === 'thinking') {
      startRoam(0.12, 0.88, 500);
      go(Animated.loop(Animated.sequence([
        Animated.timing(orbScale, {toValue: 1.04, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(orbScale, {toValue: 0.96, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.sequence([
        Animated.timing(coreGlow, {toValue: 1.0, duration: 450, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(coreGlow, {toValue: 0.15, duration: 450, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ])));
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 3500, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true})));
    }

    if (stage === 'speaking') {
      startAudioReactive(0.18);
      go(Animated.loop(Animated.timing(outerRot, {toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(innerRot, {toValue: 1, duration: 4500, easing: Easing.linear, useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring1, {toValue: 1, duration: 800,  easing: Easing.out(Easing.quad), useNativeDriver: true})));
      go(Animated.loop(Animated.timing(ring2, {toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true})));
    }

    return () => {
      stopAll();
      stopAudioReactive();
      stopRaf();
    };
  }, [stage]);

  // Clean up rAF on unmount
  useEffect(() => { return () => { stopRaf(); stopAudioReactive(); }; }, []);

  const PRIMARY = stage === 'recording'   ? '#ff3d7f'
    : stage === 'thinking' || stage === 'transcribing' ? '#bf5af2'
    : stage === 'speaking' ? '#00c8ff'
    : '#4f8ef7';

  const outerDeg = outerRot.interpolate({inputRange:[0,1], outputRange:['0deg','360deg']});
  const innerDeg = innerRot.interpolate({inputRange:[0,1], outputRange:['360deg','0deg']});
  const r1s = ring1.interpolate({inputRange:[0,1], outputRange:[1, 2.0]});
  const r1o = ring1.interpolate({inputRange:[0,0.4,1], outputRange:[0.45,0.12,0]});
  const r2s = ring2.interpolate({inputRange:[0,1], outputRange:[1, 2.8]});
  const r2o = ring2.interpolate({inputRange:[0,0.4,1], outputRange:[0.25,0.05,0]});

  const irisBarR = BLOB_R * 0.70;

  return (
    <View style={styles.container}>
      {/* Rotating orbit dashes */}
      <Animated.View style={[styles.orbit,      {borderColor: PRIMARY, transform:[{rotate: outerDeg}]}]} />
      <Animated.View style={[styles.orbitInner, {borderColor: PRIMARY, transform:[{rotate: innerDeg}]}]} />

      {/* Blob-shaped ripple rings */}
      {ripplePath2 ? (
        <Animated.View style={[styles.rippleWrap, {opacity: r2o, transform:[{scale: r2s}]}]}>
          <Svg width={ORB} height={ORB}>
            <Path d={ripplePath2} fill="none" stroke={PRIMARY} strokeWidth={1} />
          </Svg>
        </Animated.View>
      ) : null}
      {ripplePath1 ? (
        <Animated.View style={[styles.rippleWrap, {opacity: r1o, transform:[{scale: r1s}]}]}>
          <Svg width={ORB} height={ORB}>
            <Path d={ripplePath1} fill="none" stroke={PRIMARY} strokeWidth={1.2} />
          </Svg>
        </Animated.View>
      ) : null}

      {/* Main orb */}
      <Animated.View style={[styles.orbArea, {transform:[{scale: orbScale}]}]}>
        <Svg width={ORB} height={ORB} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#0e0f1e" stopOpacity="1" />
              <Stop offset="100%" stopColor="#05060e" stopOpacity="1" />
            </RadialGradient>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={PRIMARY} stopOpacity="0.40" />
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
            return (
              <Animated.View
                key={i}
                style={[styles.bar, {
                  backgroundColor: PRIMARY,
                  shadowColor: PRIMARY,
                  transform: [
                    {translateX: Math.cos(angle) * irisBarR},
                    {translateY: Math.sin(angle) * irisBarR},
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
    opacity: 0.25,
  },
  orbitInner: {
    position: 'absolute',
    width: ORB + 25, height: ORB + 25,
    borderRadius: (ORB + 25) / 2,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    opacity: 0.12,
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
    height: 20,
    borderRadius: 2,
    opacity: 0.8,
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
