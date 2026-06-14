export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  hero: {
    shadowColor: '#FF5A5F',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
} as const;
