import { userEvent } from '@testing-library/react-native';

import { TicketRevealScreen } from '@/screens/TicketRevealScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { EditProfileScreen } from '@/screens/EditProfileScreen';
import { LoungeScreen } from '@/screens/LoungeScreen';
import { NotesScreen } from '@/screens/NotesScreen';
import { SunsetTabBar } from '@/components/SunsetTabBar';
import { GuestWallScreen } from '@/screens/GuestWallScreen';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { DoorScreen } from '@/screens/DoorScreen';
import { EventScreen } from '@/screens/EventScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { WalletScreen } from '@/screens/WalletScreen';
import { createSampleServices } from '@/bootstrap/createSampleServices';
import { SampleDatabase } from '@/data/sampleDatabase';
import { renderScreen } from '../../test/render';
import { useSessionStore } from '@/store/session';
import { emitBack, params, router } from '../../test/routerMock';

describe('MVP screens', () => {
  it('renders Discover with both evenings and the sample label', async () => {
    const view = await renderScreen(<DiscoverScreen />);
    expect(await view.findByText('Good evening.')).toBeTruthy();
    expect(view.getByText('The light is turning gold.')).toBeTruthy();
    expect(view.getByText('The Tasting Room')).toBeTruthy();
    expect(view.getByText('Jan 2027 · 21+')).toBeTruthy();
    expect(view.getByText('Sat, Jan 23, 2027 · Time TBA · Venue to be announced')).toBeTruthy();
    expect(view.getByText('SAMPLE GUESTS')).toBeTruthy();
    await userEvent.press(view.getByTestId('discover-reserve'));
    expect(router.push).toHaveBeenCalledWith('/checkout/sunset-social');
  });

  it('renders the event page with a sticky reserve and no public address', async () => {
    const view = await renderScreen(<EventScreen />);
    expect(await view.findByText('Saturday, January 23, 2027')).toBeTruthy();
    expect(view.getByText(/Time TBA/)).toBeTruthy();
    expect(view.getByText('Rooftop venue to be announced')).toBeTruthy();
    expect(view.getByText('Andrew Lowery')).toBeTruthy();
    expect(view.getByTestId('reserve-your-place')).toBeTruthy();
    await userEvent.press(view.getByTestId('reserve-your-place'));
    expect(router.push).toHaveBeenCalledWith('/checkout/sunset-social');
  });

  it('keeps a day off The Tasting Room', async () => {
    params.id = 'tasting-room';
    const view = await renderScreen(<EventScreen />);
    expect(await view.findByText('Jan 2027')).toBeTruthy();
    expect(view.queryByText('Saturday, January 23, 2027')).toBeNull();
    expect(view.getByText('TICKETS OPEN WITH THE DATE')).toBeTruthy();
  });

  it('quotes two Golden Hour tickets at $70 and stops at 8', async () => {
    const view = await renderScreen(<CheckoutScreen />);
    expect((await view.findAllByText('$70.00')).length).toBeGreaterThan(0);
    expect(view.getByText('SAMPLE ORDER · STRIPE TEST MODE')).toBeTruthy();
    expect(view.getByText(/Max 8 per order/)).toBeTruthy();
    for (let step = 0; step < 6; step += 1) {
      await userEvent.press(view.getByTestId('qty-plus'));
    }
    expect(view.getByTestId('qty-value').props.children).toBe(8);
    await userEvent.press(view.getByTestId('qty-plus'));
    expect(view.getByTestId('checkout-note').props.children).toMatch(/Max 8/);
    expect(view.getAllByText('$280.00').length).toBeGreaterThan(0);
    await userEvent.press(view.getByTestId('promo-row'));
    expect(view.getByTestId('checkout-note').props.children).toMatch(/Invite codes/);
    expect(view.getAllByText('$280.00').length).toBeGreaterThan(0);
  });

  it('shows the sample golden ticket', async () => {
    const view = await renderScreen(<WalletScreen />);
    expect(await view.findByText('Sample Guest')).toBeTruthy();
    expect(view.getByText('Sample Guest')).toBeTruthy();
    expect(view.getByText('SAMPLE · SS01-0001')).toBeTruthy();
    expect(view.getByText('23')).toBeTruthy();
    expect(view.getByText('JAN')).toBeTruthy();
    expect(view.getByText('2027')).toBeTruthy();
    await userEvent.press(view.getByTestId('transfer'));
    expect(view.getByTestId('wallet-note').props.children).toMatch(/later release/);
    await userEvent.press(view.getByText('Waitlist'));
    expect(view.getByText(/waitlist opens/i)).toBeTruthy();
  });

  it('shows the sample guest wall to the demo viewer', async () => {
    const view = await renderScreen(<GuestWallScreen />);
    expect(await view.findByText('SAMPLE GUESTS · NOT REAL PEOPLE')).toBeTruthy();
    expect(view.getByText('Maya R.')).toBeTruthy();
    expect(view.getByText('guest list')).toBeTruthy();
    expect(view.getByText('6')).toBeTruthy();
    expect(view.getAllByText('2').length).toBeGreaterThan(0);
    await userEvent.press(view.getAllByText('Wave')[0]!);
  });

  it('locks the guest wall when the viewer is not a ticket holder', async () => {
    const db = new SampleDatabase();
    db.viewerState = { ...db.viewerState, demo: false, ticketEventIds: [] };
    const view = await renderScreen(<GuestWallScreen />, createSampleServices(db));
    expect(await view.findByText('The guest list is visible to ticket holders.')).toBeTruthy();
  });

  it('renders the profile credit footer', async () => {
    const view = await renderScreen(<ProfileScreen />);
    expect(await view.findByText('Your Name')).toBeTruthy();
    expect(view.getByLabelText('Developed and Designed by Andrew The Software Doctor')).toBeTruthy();
    expect(view.getByText('Yeshua is Lord')).toBeTruthy();
    expect(view.getByText('Questions? Text (240) 893-6247')).toBeTruthy();
    expect(view.getByText(/first evening is Saturday, January 23, 2027/)).toBeTruthy();
    expect(view.getAllByText('0').length).toBeGreaterThan(0);
    expect((await view.findAllByText('1')).length).toBeGreaterThan(0);
  });

  it('shows the host door with a sample admit', async () => {
    const view = await renderScreen(<DoorScreen />);
    expect(await view.findByText('42')).toBeTruthy();
    expect(view.getByText(/ADMITTED/)).toBeTruthy();
    expect(view.getByText('Sample Guest')).toBeTruthy();
    expect(view.getByText('SAMPLE COUNTS & GUEST')).toBeTruthy();
    await userEvent.press(view.getByTestId('door-guest-list'));
    expect(await view.findByText('Maya R.')).toBeTruthy();
    await userEvent.press(view.getByTestId('door-review'));
    expect(await view.findByText('Needs review')).toBeTruthy();
    expect(view.getByText('sample-review-order')).toBeTruthy();
    expect(view.getByText('Sunset Social')).toBeTruthy();
    expect(view.getByText('review')).toBeTruthy();
    expect(view.getByText('capacity')).toBeTruthy();
    expect(view.getByText('2026-11-22 03:00')).toBeTruthy();
    expect(view.getByText('SAMPLE')).toBeTruthy();
    await userEvent.press(view.getByTestId('door-approve'));
    expect(view.getByText(/later release/i)).toBeTruthy();
    await userEvent.press(view.getByTestId('door-manual'));
    await userEvent.type(view.getByTestId('manual-code'), 'SAMPLE-SS01-0099');
    await userEvent.press(view.getByTestId('manual-check'));
    expect(await view.findByText(/REFUNDED/)).toBeTruthy();
  });

  it('renders the quieter screens and the tab bar', async () => {
    const lounge = await renderScreen(<LoungeScreen />);
    expect(lounge.getByText(/closer to the evening/)).toBeTruthy();
    const notes = await renderScreen(<NotesScreen />);
    expect(notes.getByText(/No notes yet/)).toBeTruthy();
    const auth = await renderScreen(<AuthScreen />);
    await userEvent.press(auth.getByText('Text a code'));
    expect(await auth.findByText(/Demo mode/)).toBeTruthy();
    const edit = await renderScreen(<EditProfileScreen />);
    expect(await edit.findByText('Guest profile')).toBeTruthy();
    await userEvent.press(edit.getByTestId('save-profile'));
    expect(router.back).toHaveBeenCalled();
    const navigateToTab = jest.fn();
    const tabs = await renderScreen(
      <SunsetTabBar
        state={{
          index: 0,
          routes: [
            { name: 'index', key: 'index' },
            { name: 'tickets', key: 'tickets' },
            { name: 'guests', key: 'guests' },
            { name: 'lounge', key: 'lounge' },
            { name: 'profile', key: 'profile' },
          ],
        }}
        navigateToTab={navigateToTab}
      />,
    );
    await userEvent.press(tabs.getByText('TICKETS'));
    expect(navigateToTab).toHaveBeenCalledWith('tickets');
  });

  it('starts a new demo attempt after Pay and opens the golden ticket', async () => {
    const services = createSampleServices();
    const keys: string[] = [];
    const place = services.checkout.place.bind(services.checkout);
    services.checkout.place = (input) => {
      keys.push(input.idempotencyKey ?? '');
      return place(input);
    };
    const checkout = await renderScreen(<CheckoutScreen />, services);
    await userEvent.press(await checkout.findByTestId('apple-pay'));
    expect(router.replace).toHaveBeenCalledWith('/ticket-reveal');
    expect(useSessionStore.getState().confirmedTicket?.code.startsWith('SAMPLE-')).toBe(true);
    await userEvent.press(checkout.getByTestId('apple-pay'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('pays in demo mode and toggles the profile', async () => {
    const checkout = await renderScreen(<CheckoutScreen />);
    expect((await checkout.findAllByText('$70.00')).length).toBeGreaterThan(0);
    await userEvent.press(checkout.getByTestId('apple-pay'));
    expect(router.replace).toHaveBeenCalledWith('/ticket-reveal');
    const profile = await renderScreen(<ProfileScreen />);
    await profile.findByText('Your Name');
    await userEvent.press(profile.getByTestId('toggle-dates'));
    await userEvent.press(profile.getByText('Door mode'));
    expect(router.push).toHaveBeenCalledWith('/door');
  });

  it('plays the golden ticket reveal copy', async () => {
    const services = createSampleServices();
    const wallet = await services.tickets.wallet('sample-you');
    useSessionStore.setState({ confirmedTicket: wallet.upcoming[0] ?? null });
    const view = await renderScreen(<TicketRevealScreen />, services);
    expect(view.getByText("You're on the list.")).toBeTruthy();
    const back = { data: { action: { type: 'POP' } }, preventDefault: jest.fn() };
    emitBack(back);
    expect(back.preventDefault).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/tickets');
    expect(view.getByText('See you at golden hour.')).toBeTruthy();
    expect(view.getByText('SAMPLE · SS01-0001')).toBeTruthy();
  });
});
