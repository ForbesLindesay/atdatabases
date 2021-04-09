import Document, {Html, Head, Main, NextScript} from 'next/document';
import {extractCritical} from '@emotion/server';

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
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
