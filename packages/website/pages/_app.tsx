import './custom-styles.css';
import {GlobalStyles} from 'twin.macro';
import {useRouter} from 'next/router';
import {useEffect} from 'react';
import {pageView} from '../utils/gtag';
import {EnvironmentProvider} from '../components/CodeBlock';

function MyApp({Component, pageProps}: any) {
  const router = useRouter();
  useEffect(() => {
    pageView(router.asPath);
    const handleRouteChange = (url: string) => {
      pageView(url);
    };
    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router.events]);
  return (
    <>
      <GlobalStyles />

      <EnvironmentProvider>
        <Component {...pageProps} />
      </EnvironmentProvider>
    </>
  );
}

export default MyApp;
