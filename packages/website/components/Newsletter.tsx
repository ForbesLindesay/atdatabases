import 'twin.macro';

export default function Newsletter() {
  return (
    <div tw="bg-gray-800">
      <div tw="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center">
        <div tw="lg:w-0 lg:flex-1">
          <h2 tw="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            Sign up for our newsletter
          </h2>
          <p tw="mt-3 max-w-3xl text-lg leading-6 text-gray-300">
            I send out an occasional e-mail with updates about @databases and
            some of my other open source projects. This is the best way to stay
            up to date on everything I'm working on.
          </p>
        </div>
        <div tw="mt-8 lg:mt-0 lg:ml-16">
          <form
            tw="sm:flex"
            method="post"
            action="https://www.aweber.com/scripts/addlead.pl"
          >
            <input type="hidden" name="listname" value="awlist5596970" />
            <input
              type="hidden"
              name="redirect"
              value="https://ratelimit.dev/thankyou"
              id="redirect_3d9b01239633509078aeee0a2365d75f"
            />
            <input type="hidden" name="meta_tags" value="atdatabases" />
            <label htmlFor="email" tw="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              tw="w-64 px-5 py-3 border border-transparent placeholder-gray-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white focus:border-white sm:max-w-xs rounded-md"
              placeholder="Enter your email"
            />
            <div tw="mt-3 rounded-md shadow sm:mt-0 sm:ml-3 sm:flex-shrink-0">
              <button
                type="submit"
                tw="w-full flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-700 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
              >
                Send me updates
              </button>
            </div>
          </form>
          <p tw="mt-3 text-sm text-gray-300">
            You can unsubscribe at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
