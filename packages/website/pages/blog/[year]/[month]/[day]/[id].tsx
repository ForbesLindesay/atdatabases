import 'twin.macro';

import Head from 'next/head';
import ErrorPage from 'next/error';
import Link from 'next/link';
import {Root} from 'mdast';

import NavBar from '../../../../../components/NavBar';
import Document from '../../../../../components/Document';
import {
  parseMarkdown,
  printSummaryFromMarkdown,
} from '../../../../../utils/markdown2';
import DocumentTableOfContents from '../../../../../components/DocumentTableOfContents';
import Footer from '../../../../../components/Footer';
import {getBlogPosts, IBlogPost} from '../../../../../utils/blog';

type Props = {
  recentPosts: IBlogPost[];
  post?: IBlogPost<Root> & {googleSummary: string; ogSummary: string};
};

const BlogPost = ({post: doc}: Props) => {
  if (!doc?.id) {
    return <ErrorPage statusCode={404} />;
  }

  const url = `https://www.atdatabases.org/blog/${doc.year}/${doc.month
    .toString(10)
    .padStart(2, `0`)}/${doc.day.toString(10).padStart(2, `0`)}/${doc.id}`;
  return (
    <>
      <Head>
        <title>{doc.title}</title>
        <link rel="canonical" href={url} />
        <meta name="description" content={doc.googleSummary} />
        <meta property="og:site_name" content="@databases" />
        <meta property="og:title" content={doc.title} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:description" content={doc.ogSummary} />
        <meta
          property="og:image"
          content="https://www.atdatabases.org/favicon.png"
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:creator" content="@ForbesLindesay" />
        <meta
          name="twitter:image"
          content="https://www.atdatabases.org/favicon.png"
        />
      </Head>
      <NavBar>
        <div tw="px-4 xl:px-6">
          <div tw="mx-auto max-w-6xl lg:grid lg:gap-6 lg:grid-cols-nav-2">
            <div tw="mt-6">
              <article tw="text-lg text-gray-800" style={{maxWidth: `80ch`}}>
                <h1 tw="mt-8 text-center text-4xl font-bold text-black">
                  {doc.title}
                </h1>
                <div tw="w-32 h-2 mt-4 mb-12 bg-red-900 mx-auto" />
                <p tw="text-center mb-8 text-gray-400 italic text-base">
                  First published on{' '}
                  <time
                    dateTime={`${doc.year}-${doc.month
                      .toString(10)
                      .padStart(2, `0`)}-${doc.day
                      .toString(10)
                      .padStart(2, `0`)}`}
                  >
                    {doc.year}-{doc.month.toString(10).padStart(2, `0`)}-
                    {doc.day.toString(10).padStart(2, `0`)}
                  </time>{' '}
                  by <a href={doc.authorURL}>{doc.author}</a>
                </p>
                <Document document={doc.body} />
              </article>
              <div tw="flex md:justify-center mt-12 mx-4 md:mx-0">
                <Link
                  href="/blog"
                  tw="rounded-md px-6 py-4 border border-red-900 text-red-900 bg-white shadow-md hover:bg-red-900 hover:text-red-100"
                >
                  Recent posts
                </Link>
              </div>
            </div>
            <div tw="hidden lg:block relative w-80">
              <div tw="fixed">
                <DocumentTableOfContents document={doc.body} />
              </div>
            </div>
          </div>
        </div>
        <div tw="mt-16">
          <Footer />
        </div>
      </NavBar>
    </>
  );
};

export default BlogPost;

type Params = {
  params: {
    year: string;
    month: string;
    day: string;
    id: string;
  };
};

export async function getStaticProps({
  params,
}: Params): Promise<{props: Props}> {
  const posts = await getBlogPosts();
  const post = posts.find(
    (p) =>
      p.year === parseInt(params.year, 10) &&
      p.month === parseInt(params.month, 10) &&
      p.day === parseInt(params.day, 10) &&
      p.id === params.id,
  );

  if (!post) {
    return {props: {recentPosts: posts.slice(0, 20)}};
  }

  const truncatedBody = await parseMarkdown(
    post.body.split(`<!--truncate-->`)[0],
    post.filename,
  );
  return {
    props: {
      recentPosts: posts.slice(0, 20),
      post: {
        ...post,
        body: await parseMarkdown(post.body, post.filename),
        googleSummary: printSummaryFromMarkdown(truncatedBody, 'google'),
        ogSummary: printSummaryFromMarkdown(truncatedBody, 'og'),
      },
    },
  };
}

export async function getStaticPaths(): Promise<{
  paths: Params[];
  fallback: false;
}> {
  const posts = await getBlogPosts();
  return {
    paths: posts.map((post) => ({
      params: {
        year: post.year.toString(10),
        month: post.month.toString(10).padStart(2, `0`),
        day: post.day.toString(10).padStart(2, `0`),
        id: post.id,
      },
    })),
    fallback: false,
  };
}
