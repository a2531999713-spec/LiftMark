import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function IndexRoute() {
  const authStatus = useAuthStore((state) => state.authStatus);

  if (authStatus === 'checking') {
    return null;
  }

  if (authStatus === 'unauthenticated') {
    return <Redirect href={'/account/login' as never} />;
  }

  return <Redirect href={'/(tabs)/today' as never} />;
}
