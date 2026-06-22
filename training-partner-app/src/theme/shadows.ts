export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 1,
  },
  hero: {
    shadowColor: '#0D1B2A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
} as const;
