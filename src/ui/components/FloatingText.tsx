import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Dimensions} from 'react-native';

const {width} = Dimensions.get('window');

interface Props {
  text: string;
  visible: boolean;
  suckedIn?: boolean;
}

export function FloatingText({text, visible, suckedIn}: Props) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && !suckedIn) {
      Animated.parallel([
        Animated.timing(opacity,    {toValue: 1,   duration: 200, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 0,   duration: 200, useNativeDriver: true}),
        Animated.timing(scale,      {toValue: 1,   duration: 200, useNativeDriver: true}),
      ]).start();
    } else if (suckedIn) {
      Animated.parallel([
        Animated.timing(opacity,    {toValue: 0,   duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 90,  duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true}),
        Animated.timing(scale,      {toValue: 0.3, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true}),
      ]).start();
    } else {
      Animated.timing(opacity, {toValue: 0, duration: 300, useNativeDriver: true}).start(() => {
        translateY.setValue(0);
        scale.setValue(1);
      });
    }
  }, [visible, suckedIn]);

  return (
    <Animated.Text
      style={[styles.text, {opacity, transform: [{translateY}, {scale}]}]}
      numberOfLines={4}>
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    width: width * 0.72,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.82)',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 0.4,
    lineHeight: 27,
  },
});
