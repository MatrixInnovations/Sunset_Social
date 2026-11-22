export { EventScreen as default } from '@/screens/EventScreen';

export function generateStaticParams() {
  return [{ id: 'sunset-social' }, { id: 'tasting-room' }];
}
