import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Handle root route
    if (router.pathname === '/') {
      router.replace('/landing');
    }
  }, [router.pathname]);

  return <Component {...pageProps} />
}

export default MyApp;