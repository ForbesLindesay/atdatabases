import './custom-styles.css';
import {GlobalStyles} from 'twin.macro';

function MyApp({Component, pageProps}: any) {
  return (
    <>
      <GlobalStyles />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
