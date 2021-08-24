import 'twin.macro';

export default function DatabaseCloud() {
  return (
    <div>
      <div tw="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl">
        <div tw="lg:grid lg:grid-cols-2 lg:gap-24 lg:items-center">
          <div>
            <h2 tw="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
              We support your database
            </h2>
            <p tw="mt-6 max-w-3xl text-lg leading-7 text-gray-700">
              Each supported database engine has a separate driver. This means
              that @databases can take advantage of the features unique to each
              database. Core elements are shared. This makes it quick to add
              support for a new database engine.
            </p>
            {/* <div tw="mt-6">
              <a href="#" tw="text-base font-medium text-red-700">
                Get help choosing a database →
              </a>
            </div> */}
          </div>
          <div tw="mt-12 grid grid-cols-2 gap-0.5 lg:mt-0">
            <a
              href="/docs/pg"
              tw="col-span-1 flex justify-center items-center space-x-2 text-gray-600 text-2xl py-8 px-8 bg-gray-50 hover:bg-gray-100"
            >
              <img tw="max-h-12" src="/postgres.svg" alt="Postgres" />
              <div>Postgres</div>
            </a>
            <a
              href="/docs/mysql"
              tw="col-span-1 flex justify-center items-center space-x-2 text-gray-600 text-2xl  py-8 px-8 bg-gray-50 hover:bg-gray-100"
            >
              <img tw="max-h-12" src="/mysql.svg" alt="MySQL" />
              <div>MySQL</div>
            </a>
            <a
              href="/docs/sqlite"
              tw="col-span-1 flex justify-center items-center space-x-2 text-gray-600 text-2xl  py-8 px-8 bg-gray-50 hover:bg-gray-100"
            >
              <img tw="max-h-12" src="/sqlite.svg" alt="SQLite" />
              <div>SQLite</div>
            </a>
            <a
              href="/docs/websql"
              tw="col-span-1 flex justify-center items-center space-x-2 text-gray-600 text-2xl  py-8 px-8 bg-gray-50 hover:bg-gray-100"
            >
              <img tw="max-h-12" src="/expo.svg" alt="Expo" />
              <div>Expo</div>
            </a>
            <a
              href="/docs/bigquery"
              tw="col-span-1 flex justify-center items-center space-x-2 text-gray-600 text-2xl  py-8 px-8 bg-gray-50 hover:bg-gray-100"
            >
              <img tw="max-h-12" src="/bigquery.svg" alt="Google BigQuery" />
              <div>BigQuery</div>
            </a>
            <div tw="col-span-1 flex justify-center items-center space-x-2 text-gray-600 text-2xl  py-8 px-8 bg-gray-50">
              <div tw="text-gray-500">More Soon...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
