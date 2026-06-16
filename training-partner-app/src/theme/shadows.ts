export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  hero: {
    shadowColor: '#E8634A',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
} as const;
