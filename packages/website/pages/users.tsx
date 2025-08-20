import 'twin.macro';
import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import NavBar from '../components/NavBar';
import UserLogos from '../components/UserLogos';
import Newsletter from '../components/Newsletter';

export default function Users() {
  return (
    <>
      <Head>
        <title>@databases - users</title>
      </Head>
      <Background>
        <NavBar>
          <div tw="h-96 flex flex-col justify-center">
            <div>
              <UserLogos />
            </div>
          </div>

          <div tw="pb-12 max-w-md mx-auto sm:flex sm:justify-center md:mt-16">
            <div tw="rounded-md shadow">
              <Link
                href="/docs/sql"
                tw="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-900 hover:bg-red-700 md:py-4 md:text-lg md:px-10"
              >
                Get started
              </Link>
            </div>
          </div>
        </NavBar>
        <Newsletter />
      </Background>
    </>
  );
}

function Background({children}: {children: React.ReactNode}) {
  return <div tw="relative bg-gray-200 overflow-hidden">{children}</div>;
}
