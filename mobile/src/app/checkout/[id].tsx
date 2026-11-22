export { CheckoutScreen as default } from '@/screens/CheckoutScreen';

export function generateStaticParams() {
  return [{ id: 'sunset-social' }, { id: 'tasting-room' }];
}
