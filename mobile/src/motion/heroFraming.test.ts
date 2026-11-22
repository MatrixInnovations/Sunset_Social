// Jest (jest-expo preset). Guards the "hands + glasses never cropped" rule for Event I.
import { HERO_ART, heroHeightFor, safeZoneVisible } from './heroFraming';

const art = HERO_ART.sunsetToast;

describe('Event I hero safe zone', () => {
  it.each([320, 360, 375, 390, 393, 412, 430, 768])('W=%i keeps hands + glasses at rest and at max scale', (W) => {
    const H = heroHeightFor(W, art, 340);
    expect(safeZoneVisible(W, H, art, 1)).toBe(true);
    expect(safeZoneVisible(W, H, art, 1.06)).toBe(true);
  });
  it('390 pt phone gets a 302 pt hero', () => {
    expect(heroHeightFor(390, art, 340)).toBe(302);
  });
  it('the mockup 340 pt height would crop at 390 pt', () => {
    expect(safeZoneVisible(390, 340, art, 1.06)).toBe(false);
  });
});
