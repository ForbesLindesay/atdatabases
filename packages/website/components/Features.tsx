import 'twin.macro';

export default function Features() {
  return (
    <div tw="py-12 bg-white">
      <div tw="max-w-xl mx-auto px-4 sm:px-6 lg:max-w-7xl lg:px-8">
        <h2 tw="sr-only">Key features</h2>
        <dl tw="space-y-10 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
          <div>
            <dt>
              <img
                tw="h-12 w-12 rounded-md"
                src="/typescript.svg"
                alt="TypeScript Logo"
              />
              <p tw="mt-5 text-lg leading-6 font-medium text-gray-900">
                Type Safe
              </p>
            </dt>
            <dd tw="mt-2 text-base text-gray-600">
              @databases is written in TypeScript, so every module has type
              safety and type definitions built in. In addition to that, we also
              have CLIs that let you generate types for your database tables.
            </dd>
          </div>

          <div>
            <dt>
              <img tw="h-12 w-12 rounded-md" src="/npm.svg" alt="NPM Logo" />
              <p tw="mt-5 text-lg leading-6 font-medium text-gray-900">
                Modular
              </p>
            </dt>
            <dd tw="mt-2 text-base text-gray-600">
              Each database driver is published as a separate module. Each
              problem we solve get its own reusable package. This means that
              even if you don't want to use @databases to connect to your SQL
              database, you can still use our locking implementation, or our
              queue implementation.
            </dd>
          </div>

          <div>
            <dt>
              <img
                tw="h-12 w-12 rounded-md"
                src="/promises.svg"
                alt="Promises Logo"
              />
              <p tw="mt-5 text-lg leading-6 font-medium text-gray-900">
                Promises
              </p>
            </dt>
            <dd tw="mt-2 text-base text-gray-600">
              All the @databases APIs are designed with promises in mind from
              the get go. You won't need to mess around with old callback
              styles. This keeps your code clean and simple.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
