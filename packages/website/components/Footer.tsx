import 'twin.macro';

// This example requires Tailwind CSS v2.0+

// This example requires some changes to your config:

// ```
// // tailwind.config.js
// module.exports = {
//   // ...
//   plugins: [
//     // ...
//     require('@tailwindcss/forms'),
//   ]
// }
// ```
export default function Footer() {
  return (
    <footer tw="bg-gray-800 relative z-10" aria-labelledby="footerHeading">
      <h2 id="footerHeading" tw="sr-only">
        Footer
      </h2>
      <div tw="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
        <div tw="grid grid-cols-1 lg:grid-cols-12">
          <div tw="grid grid-cols-2 col-span-4">
            <div>
              <h3 tw="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                Documentation
              </h3>
              <ul tw="mt-4 space-y-4">
                <li>
                  <a
                    href="/docs/pg"
                    tw="text-base text-gray-300 hover:text-white"
                  >
                    Postgres
                  </a>
                </li>

                <li>
                  <a
                    href="/docs/mysql"
                    tw="text-base text-gray-300 hover:text-white"
                  >
                    MySQL
                  </a>
                </li>

                <li>
                  <a
                    href="/docs/sqlite"
                    tw="text-base text-gray-300 hover:text-white"
                  >
                    SQLite
                  </a>
                </li>

                <li>
                  <a
                    href="/docs/websql"
                    tw="text-base text-gray-300 hover:text-white"
                  >
                    Expo
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 tw="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                Community
              </h3>
              <ul tw="mt-4 space-y-4">
                <li>
                  <a
                    href="/users"
                    tw="text-base text-gray-300 hover:text-white"
                  >
                    Existing Users
                  </a>
                </li>

                <li>
                  <a href="/blog" tw="text-base text-gray-300 hover:text-white">
                    Blog
                  </a>
                </li>

                <li>
                  <a
                    href="https://github.com/ForbesLindesay/atdatabases"
                    tw="text-base text-gray-300 hover:text-white"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <form
            tw="grid grid-cols-12 gap-8 col-span-8 border-t lg:border-l lg:border-t-0 border-gray-700 pt-8 mt-8 lg:mt-0 lg:pt-0 lg:pl-8"
            method="post"
            action="https://www.aweber.com/scripts/addlead.pl"
          >
            <div tw="col-span-12 md:col-span-6 lg:col-span-6 xl:col-span-7">
              <h3 tw="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                Subscribe to my newsletter
              </h3>
              <p tw="mt-2 text-base text-gray-300">
                I will occasionally e-mail you about major updates, exciting
                open source projects and technical articles.
              </p>
            </div>
            <div tw="col-span-12 md:col-span-6 lg:col-span-6 xl:col-span-5 sm:flex mt-8">
              <label>
                <span tw="sr-only">Email address</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  tw="appearance-none min-w-0 w-full bg-white border border-transparent rounded-md py-2 px-4 text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white focus:border-white focus:placeholder-gray-400 sm:max-w-xs"
                  placeholder="Enter your email"
                />
              </label>
              <div tw="mt-3 rounded-md sm:mt-0 sm:ml-3 sm:flex-shrink-0">
                <input type="hidden" name="listname" value="awlist5596970" />
                <input
                  type="hidden"
                  name="redirect"
                  value="https://www.atdatabases.org/subscribed"
                />
                <input type="hidden" name="meta_tags" value="atdatabases" />
                <button
                  type="submit"
                  tw="w-full bg-red-700 border border-transparent rounded-md py-2 px-4 flex items-center justify-center text-base font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                >
                  Subscribe
                </button>
              </div>
            </div>
          </form>
        </div>
        <div tw="mt-8 border-t border-gray-700 pt-8 md:flex md:items-center md:justify-between">
          <div tw="flex space-x-6 md:order-2">
            <a
              href="https://twitter.com/ForbesLindesay"
              tw="text-gray-400 hover:text-gray-300"
            >
              <span tw="sr-only">Twitter</span>
              <svg
                tw="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>

            <a
              href="https://github.com/ForbesLindesay/atdatabases"
              tw="text-gray-400 hover:text-gray-300"
            >
              <span tw="sr-only">GitHub</span>
              <svg
                tw="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
          <p tw="mt-8 text-base text-gray-400 md:mt-0 md:order-1">
            &copy; {new Date().getFullYear()} Forbes Lindesay
          </p>
        </div>
      </div>
    </footer>
  );
}
