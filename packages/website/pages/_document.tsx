import Document, {Html, Head, Main, NextScript} from 'next/document';
import {extractCritical} from '@emotion/server';
import {GA_TRACKING_ID} from '../utils/gtag';

export default class MyDocument extends Document {
  static async getInitialProps(ctx: any) {
    const initialProps = await Document.getInitialProps(ctx);
    const page = await ctx.renderPage();
    const styles = extractCritical(page.html);
    return {...initialProps, ...page, ...styles};
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          <style
            data-emotion-css={(this.props as any).ids.join(' ')}
            dangerouslySetInnerHTML={{__html: (this.props as any).css}}
          />
          <link rel="shortcut icon" href="/favicon.png" />
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          />

          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}', {
                  send_page_view: false
                });
              `,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
