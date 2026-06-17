export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  hero: {
    shadowColor: '#FF5A4D',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
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
