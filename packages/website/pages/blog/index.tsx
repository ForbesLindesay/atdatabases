import 'twin.macro';

import Head from 'next/head';
import Link from 'next/link';
import {Root} from 'mdast';

import NavBar from '../../components/NavBar';
import Document from '../../components/Document';
import {parseMarkdown} from '../../utils/markdown2';
import Footer from '../../components/Footer';
import {getBlogPosts, IBlogPost} from '../../utils/blog';

type Props = {
  recentPosts: IBlogPost<Root>[];
};

const Blog = ({recentPosts}: Props) => {
  return (
    <>
      <Head>
        <title>@databases - Blog</title>
      </Head>
      <NavBar>
        <div tw="px-4 xl:px-6">
          <div tw="mx-auto max-w-3xl">
            <div tw="mt-6">
              {recentPosts.map((post) => (
                <article
                  key={`${post.year}/${post.month}/${post.day}/${post.id}`}
                  tw="text-lg text-gray-800 border-b border-gray-400 pb-6"
                  style={{maxWidth: `80ch`}}
                >
                  <h1 tw="mt-8 text-center text-4xl font-bold text-black">
                    {post.title}
                  </h1>
                  <div tw="w-32 h-2 mt-4 mb-16 bg-red-900 mx-auto" />
                  <Document document={post.body} />

                  <div tw="flex md:justify-center mt-12 mx-4 md:mx-0">
                    <Link
                      href={post.pathname}
                      tw="rounded-md px-6 py-4 border border-red-900 text-red-900 bg-white shadow-md hover:bg-red-900 hover:text-red-100"
                    >
                      Read More
                    </Link>
                  </div>
                </article>
              ))}
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

export default Blog;

export async function getStaticProps(): Promise<{props: Props}> {
  const posts = await getBlogPosts();

  return {
    props: {
      recentPosts: await Promise.all(
        posts.slice(0, 20).map(async (post) => ({
          ...post,
          body: await parseMarkdown(
            post.body.split(`<!--truncate-->`)[0],
            post.filename,
          ),
        })),
      ),
    },
  };
}
