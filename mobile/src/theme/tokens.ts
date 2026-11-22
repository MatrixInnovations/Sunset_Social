export const colors = {
  ink: '#0b0a0c',
  inkRaised: '#141216',
  inkCard: '#17141b',
  line: 'rgba(201,169,110,0.28)',
  lineStrong: 'rgba(201,169,110,0.55)',
  gold: '#c9a96e',
  goldBright: '#e3c16f',
  gold300: '#e6d3a3',
  ivory: '#f4ecdd',
  ivoryDim: 'rgba(244,236,221,0.66)',
  ivoryFaint: 'rgba(244,236,221,0.42)',
  burgundy: '#5a1424',
  amber: '#e08a3c',
  rose: '#c46b7d',
  white: '#ffffff',
  black: '#050406',
  danger: '#e15b5b',
  admitted: '#163c2c',
  admittedEdge: '#2fce7a',
  denied: '#3a1418',
  deniedEdge: '#e15b5b',
} as const;

export const fonts = {
  serif: 'CormorantGaramond_500Medium',
  serifSemi: 'CormorantGaramond_600SemiBold',
  serifItalic: 'CormorantGaramond_500Medium_Italic',
  serifSemiItalic: 'CormorantGaramond_600SemiBold_Italic',
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemi: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
} as const;

export const tiles = {
  gold: ['#f0e2c2', '#c9a96e'] as const,
  rose: ['#f0c3cc', '#c46b7d'] as const,
  amber: ['#f3c291', '#e08a3c'] as const,
  champagne: ['#f7f1e6', '#e4d3b4'] as const,
  burgundy: ['#8d3a52', '#5a1424'] as const,
  ivory: ['#f4ecdd', '#d9c7a1'] as const,
} as const;

export type TileName = keyof typeof tiles;
