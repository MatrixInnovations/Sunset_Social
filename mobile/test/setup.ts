/* eslint-disable @typescript-eslint/no-require-imports */
import { params, router } from './routerMock';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => require('./routerMock').router,
    useNavigation: () => require('./routerMock').navigation,
    useLocalSearchParams: () => require('./routerMock').params,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack: { Screen: () => null },
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: object) => React.createElement(View, props) };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style }: { children?: React.ReactNode; style?: object }) =>
      React.createElement(View, { style }, children),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
  useStripe: () => ({
    initPaymentSheet: jest.fn(async () => ({})),
    presentPaymentSheet: jest.fn(async () => ({})),
  }),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, ScrollView } = require('react-native');
  const identity = (value: number) => value;
  const Easing = {
    linear: identity,
    bezier: () => identity,
    bezierFn: () => identity,
  };
  return {
    __esModule: true,
    default: {
      View: (props: object) => React.createElement(View, props),
      Text: (props: object) => React.createElement(Text, props),
      ScrollView: (props: object) => React.createElement(ScrollView, props),
      createAnimatedComponent: (Component: unknown) => Component,
    },
    Easing,
    ReduceMotion: { System: 'system', Never: 'never' },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (factory: () => object) => {
      try {
        return factory();
      } catch {
        return {};
      }
    },
    useAnimatedScrollHandler: (handler: unknown) => handler,
    useReducedMotion: () => require('./motionFlag').motionFlag.reduced,
    withTiming: (value: unknown) => value,
    withDelay: (_delay: number, value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values[0],
    withSpring: (value: unknown) => value,
    cancelAnimation: () => undefined,
    interpolate: (_value: number, _input: number[], output: number[]) => output[0],
    interpolateColor: () => '#E3C16F',
    FadeInDown: { duration: () => ({}) },
    FadeInUp: { duration: () => ({}) },
  };
});

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props: object) => React.createElement(View, props),
    useCameraPermissions: () => [{ granted: false }, jest.fn()],
  };
});

beforeEach(() => {
  router.push.mockClear();
  router.back.mockClear();
  router.replace.mockClear();
  params.id = 'sunset-social';
});
