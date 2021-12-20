import 'twin.macro';

import React, {useEffect, useState} from 'react';
import tw from 'twin.macro';
import Head from 'next/head';
import Link from 'next/link';
import ErrorPage from 'next/error';
import {Root} from 'mdast';

import NavBar from '../../components/NavBar';
import Sidebar from '../../components/Sidebar/Sidebar';
import {getDocs, IDocument, IDocumentationSection} from '../../utils/docs';
import Document from '../../components/Document';
import {parseMarkdown, printSummaryFromMarkdown} from '../../utils/markdown2';
import DocumentTableOfContents from '../../components/DocumentTableOfContents';
import Footer from '../../components/Footer';
import {useRouter} from 'next/router';

type Props = {
  nav: IDocumentationSection[];
  doc?: IDocument<Root> & {
    googleSummary: string;
    ogSummary: string;
  };
};

const Post = ({nav, doc}: Props) => {
  const [expandNav, setNavExpanded] = useState(false);
  const [docID, setDocID] = useState(doc?.id);

  useEffect(() => {
    setDocID(doc?.id);
  }, [doc?.id]);

  const router = useRouter();
  useEffect(() => {
    setNavExpanded(false);
    const handleRouteChange = (url: string) => {
      setDocID(url.substr(`/docs/`.length));
      setNavExpanded(false);
    };
    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    setNavExpanded(false);
  }, [doc?.id]);

  if (!doc?.id) {
    return <ErrorPage statusCode={404} />;
  }

  return (
    <>
      <Head>
        <title>{doc.title}</title>

        <link
          rel="canonical"
          href={`https://www.atdatabases.org/docs/${doc.id}`}
        />
        <meta name="description" content={doc.googleSummary} />
        <meta property="og:site_name" content="@databases" />
        <meta property="og:title" content={doc.title} />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content={`https://www.atdatabases.org/docs/${doc.id}`}
        />
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
          <div tw="mx-auto max-w-8xl lg:grid lg:gap-6 lg:grid-cols-nav-2 xl:grid-cols-nav-3">
            <nav tw="col-span-2 xl:col-span-1 -mx-4 xl:mx-0">
              <div tw="flex h-12 z-10 relative xl:hidden">
                <button
                  tw="fixed w-full h-12 flex flex-grow items-center bg-gray-300"
                  className="group"
                  type="button"
                  onClick={() => setNavExpanded((e) => !e)}
                >
                  <div tw="flex flex-col justify-around w-12 h-12 p-2">
                    <div
                      tw="h-1 bg-gray-600 group-hover:bg-gray-800 transform origin-left transition-transform duration-75 ease-in-out"
                      css={[expandNav && tw`rotate-45`]}
                    ></div>
                    <div
                      tw="h-1 bg-gray-600 group-hover:bg-gray-800 transition-opacity duration-75 ease-in-out"
                      css={[expandNav && tw`opacity-0`]}
                    ></div>
                    <div
                      tw="h-1 bg-gray-600 group-hover:bg-gray-800 transform origin-left transition-transform duration-75 ease-in-out"
                      css={[expandNav && tw`-rotate-45`]}
                    ></div>
                  </div>
                  <div tw="ml-2 flex items-center text-gray-700 group-hover:text-gray-900 text-lg">
                    {doc.path?.map((p, i) => (
                      <React.Fragment key={i}>
                        {i !== 0 ? (
                          <svg
                            tw="h-8 w-8 text-red-900 transform rotate-90"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fill="currentColor"
                              d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
                            ></path>
                            <path d="M0 0h24v24H0z" fill="none"></path>
                          </svg>
                        ) : null}
                        <div>{p}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </button>
              </div>
              <div
                tw="px-4 xl:px-0 bg-gray-200 xl:bg-transparent"
                css={[
                  expandNav && tw`block min-h-screen`,
                  !expandNav && tw`hidden xl:block`,
                ]}
              >
                <Sidebar sections={nav} activeDoc={docID ?? doc.id} />
              </div>
            </nav>
            <div
              tw="mt-6"
              css={[expandNav && tw`hidden xl:block`, !expandNav && tw`block`]}
            >
              <article tw="text-lg text-gray-800" style={{maxWidth: `80ch`}}>
                <h1 tw="mt-8 text-center text-4xl font-bold text-black">
                  {doc.title}
                </h1>
                <div tw="w-32 h-2 mt-4 mb-16 bg-red-900 mx-auto" />
                <Document document={doc.body} />
                {/* {doc.body.map((block: any, i) => {
                switch (block.type) {
                  case 'html':
                    return (
                      <div
                        key={i}
                        tw="prose prose-red prose-lg my-6"
                        dangerouslySetInnerHTML={{__html: block.html}}
                      />
                    );
                  case 'code':
                    return <CodeBlock key={i} blocks={block.blocks} />;
                }
              })} */}
              </article>
              <div tw="flex flex-col md:flex-row mt-12 mx-4 md:mx-0">
                {doc.previous && (
                  <Link href={`/docs/${doc.previous.id}`} prefetch={false}>
                    <a
                      tw="rounded-md px-6 py-4 border border-red-900 text-red-900 bg-white shadow-md hover:bg-red-900 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                      href={`/docs/${doc.previous.id}`}
                    >
                      ← {doc.previous.label}
                    </a>
                  </Link>
                )}
                <div tw="flex-grow h-4" />
                {doc.next && (
                  <Link href={`/docs/${doc.next.id}`}>
                    <a
                      tw="text-right rounded-md px-6 py-4 border border-red-900 text-red-900 bg-white shadow-md hover:bg-red-900 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                      href={`/docs/${doc.next.id}`}
                    >
                      {doc.next.label} →
                    </a>
                  </Link>
                )}
              </div>
            </div>
            <div tw="hidden lg:block relative w-80">
              <div tw="fixed">
                <DocumentTableOfContents document={doc.body} />
              </div>
            </div>
          </div>
        </div>
        <div css={[expandNav && tw`hidden xl:block`]} tw="mt-16">
          <Footer />
        </div>
      </NavBar>
    </>
  );
};

export default Post;

type Params = {
  params: {
    slug: string;
  };
};

export async function getStaticProps({
  params,
}: Params): Promise<{props: Props}> {
  const {docs, nav} = await getDocs();

  const doc = docs.get(params.slug);
  if (!doc) {
    return {props: {nav}};
  }

  const truncatedBody = await parseMarkdown(
    doc.body.split(`<!--truncate-->`)[0],
    doc.filename,
  );
  return {
    props: {
      nav,
      doc: {
        ...doc,
        body: await parseMarkdown(doc.body, doc.filename),
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
  const {docs} = await getDocs();
  return {
    paths: Array.from(docs.keys()).map((id) => ({params: {slug: id}})),
    fallback: false,
  };
}
