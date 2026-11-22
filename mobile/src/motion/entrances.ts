/**
 * Entrance presets for Reanimated layout animations (`entering={…}`).
 * Screen blocks: eyebrow → title → lede → cards, rise 12 pt + fade, 420 ms, 60 ms apart.
 * Lists: first 8 items rise 10 pt + fade, 45 ms apart; item 9+ appears with no animation.
 * Reduced motion: same timings, opacity only (allowed), never movement.
 */
import { EntryAnimationsValues, LayoutAnimation, withDelay, withTiming } from 'react-native-reanimated';
import { dist, dur, ease, fadeCfg, stagger } from './motion';

type Entering = (values: EntryAnimationsValues) => LayoutAnimation;

function rise(delay: number, distance: number, reduced: boolean): Entering {
  return () => {
    'worklet';
    if (reduced) {
      return {
        initialValues: { opacity: 0 },
        animations: { opacity: withDelay(delay, withTiming(1, fadeCfg(dur.base))) },
      };
    }
    const cfg = { duration: dur.enter, easing: ease.out };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: distance }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, cfg)),
        transform: [{ translateY: withDelay(delay, withTiming(0, cfg)) }],
      },
    };
  };
}

/** Block `index` on a screen (0 = eyebrow). */
export const blockIn = (index: number, reduced = false) =>
  rise(stagger.lead + index * stagger.block, dist.rise, reduced);

/** List item `index`. Returns undefined past the cap so long lists don't trail in. */
export const listItemIn = (index: number, reduced = false) =>
  index < stagger.listMaxAnimated ? rise(index * stagger.list, dist.listRise, reduced) : undefined;

/** Tab content cross-fade target: 6 pt rise, 180 ms. */
export const tabContentIn = (reduced = false) => {
  const f: Entering = () => {
    'worklet';
    const cfg = { duration: dur.micro, easing: ease.out };
    return reduced
      ? { initialValues: { opacity: 0 }, animations: { opacity: withTiming(1, fadeCfg(dur.micro)) } }
      : {
          initialValues: { opacity: 0, transform: [{ translateY: dist.tabRise }] },
          animations: { opacity: withTiming(1, cfg), transform: [{ translateY: withTiming(0, cfg) }] },
        };
  };
  return f;
};
