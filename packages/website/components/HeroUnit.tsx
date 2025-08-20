import 'twin.macro';
import Link from 'next/link';

export default function HeroUnit() {
  return (
    <div tw="text-center">
      <h1 tw="text-4xl tracking-tight font-extrabold text-gray-800 sm:text-5xl md:text-6xl">
        <div>
          <span tw="block xl:inline">Query </span>{' '}
          <span tw="block text-red-800 xl:inline">SQL Databases</span>
        </div>{' '}
        <div>
          <span tw="block xl:inline">using</span>{' '}
          <span tw="block text-red-800 xl:inline">Node.js and TypeScript</span>
        </div>
      </h1>
      <p tw="mt-3 max-w-md mx-auto text-base text-gray-700 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
        @databases lets you read and write data to Postgres, MySQL, SQLite and
        other databases in Node.js using ordinary SQL, with parameters
        automatically escaped to prevent SQL injection.
      </p>
      <div tw="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
        <div tw="rounded-md shadow">
          <Link
            href="/docs/sql"
            tw="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-800 hover:bg-red-700 md:py-4 md:text-lg md:px-10"
          >
            Get started
          </Link>
        </div>
      </div>

      <p tw="text-center font-semibold text-sm text-gray-700 mt-2">
        100% free and open source
      </p>
    </div>
  );
}
