import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { GoldenTicketReveal } from '@/motion/GoldenTicketReveal';
import { Bone, SkeletonProvider } from '@/motion/Skeleton';
import { blockIn, listItemIn, tabContentIn } from '@/motion/entrances';
import { ShimmerReserveButton } from '@/motion/ShimmerReserveButton';
import { motionFlag } from '../../test/motionFlag';

describe('motion presets', () => {
  afterEach(() => {
    motionFlag.reduced = false;
  });

  it('builds rises for full motion and opacity-only fades when motion is reduced', () => {
    const values = {} as never;
    const full = blockIn(0, false)(values);
    const quiet = blockIn(2, true)(values);
    expect(full.initialValues).toMatchObject({ opacity: 0 });
    expect(quiet.initialValues).toEqual({ opacity: 0 });
    expect(listItemIn(0, false)?.(values).animations).toBeTruthy();
    expect(listItemIn(8, false)).toBeUndefined();
    expect(tabContentIn(false)(values).initialValues).toBeTruthy();
    expect(tabContentIn(true)(values).animations).toBeTruthy();
  });

  it('renders a static bone and a disabled reserve button', async () => {
    motionFlag.reduced = true;
    const bones = await render(
      <SkeletonProvider>
        <Bone height={24} width={120} />
      </SkeletonProvider>,
    );
    expect(bones.toJSON()).toBeTruthy();
    const button = await render(
      <ShimmerReserveButton label="Sold out" onPress={() => undefined} disabled shimmer={false} />,
    );
    expect(button.getByText('SOLD OUT')).toBeTruthy();
  });

  it('fades the ticket reveal without sheen or specks when motion is reduced', async () => {
    motionFlag.reduced = true;
    const view = await render(
      <GoldenTicketReveal ticket={<Text>Ticket face</Text>} header={<Text>{"You're on the list."}</Text>} particles={false} />,
    );
    expect(view.getByText("You're on the list.")).toBeTruthy();
    expect(view.getByText('Ticket face')).toBeTruthy();
  });
});
