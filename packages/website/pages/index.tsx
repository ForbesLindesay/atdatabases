import 'twin.macro';
import Head from 'next/head';
import React from 'react';
import HeroUnit from '../components/HeroUnit';
import NavBar from '../components/NavBar';
import UserLogos from '../components/UserLogos';
import DatabaseCloud from '../components/DatabaseCloud';
import Features from '../components/Features';
import Link from 'next/link';
import FeatureWithCode, {
  CodeSample,
  SampleTable,
  SampleTableCell,
  SampleTableRow,
} from '../components/FeatureWithCode';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Head>
        <title>@databases</title>
      </Head>
      <Background>
        <NavBar>
          <div tw="mt-16 mx-auto max-w-7xl px-4 sm:mt-24">
            <HeroUnit />
            <UserLogos />
            <div tw="h-4" />
            <FeatureWithCode title="Type safe API for simple operations">
              <CodeSample>
                <span tw="text-purple-700">await</span>{' '}
                <span tw="text-blue-400">tables</span>.
                <span tw="text-yellow-500">users</span>(
                <span tw="text-blue-400">db</span>).
                <span tw="text-yellow-500">insert</span>
                {`({\n`}
                {`  `}
                <span tw="text-blue-400">email</span>
                {`: `}
                <span tw="text-yellow-700">`janet@example.com`</span>
                {`,\n`}
                {`  `}
                <span tw="text-blue-400">active</span>
                {`: `}
                <span tw="text-blue-800">true</span>
                {`,\n`}
                {`});`}
              </CodeSample>
              <SampleTable>
                <SampleTableRow>
                  <SampleTableCell>adam@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>forbes@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>dee@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow variant="new">
                  <SampleTableCell>janet@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
              </SampleTable>
            </FeatureWithCode>
            <FeatureWithCode>
              <CodeSample>
                <span tw="text-purple-700">await</span>{' '}
                <span tw="text-blue-400">tables</span>.
                <span tw="text-yellow-500">users</span>(
                <span tw="text-blue-400">db</span>).
                <span tw="text-yellow-500">update</span>
                {`(\n`}
                {`  {`}
                <span tw="text-blue-400">email</span>
                {`: `}
                <span tw="text-yellow-700">`dee@example.com`</span>
                {`},\n`}
                {`  {`}
                <span tw="text-blue-400">active</span>
                {`: `}
                <span tw="text-blue-800">false</span>
                {`},\n`}
                {`);`}
              </CodeSample>
              <SampleTable>
                <SampleTableRow>
                  <SampleTableCell>adam@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>forbes@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow variant="change">
                  <SampleTableCell>dee@example.com</SampleTableCell>
                  <SampleTableCell>false</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>janet@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
              </SampleTable>
            </FeatureWithCode>

            <FeatureWithCode>
              <CodeSample>
                <span tw="text-purple-700">await</span>{' '}
                <span tw="text-blue-400">tables</span>.
                <span tw="text-yellow-500">users</span>(
                <span tw="text-blue-400">db</span>).
                <span tw="text-yellow-500">delete</span>
                {`({\n`}
                {`  `}
                <span tw="text-blue-400">email</span>
                {`: `}
                <span tw="text-yellow-700">`forbes@example.com`</span>
                {`,\n`}
                {`});`}
              </CodeSample>
              <SampleTable>
                <SampleTableRow>
                  <SampleTableCell>adam@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow variant="delete">
                  <SampleTableCell>forbes@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>dee@example.com</SampleTableCell>
                  <SampleTableCell>false</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>janet@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
              </SampleTable>
            </FeatureWithCode>
            <div tw="h-12" />
            <FeatureWithCode title="Type safe single-table queries">
              <CodeSample>
                <span tw="text-purple-700">await</span>{' '}
                <span tw="text-blue-400">tables</span>.
                <span tw="text-yellow-500">users</span>(
                <span tw="text-blue-400">db</span>
                {`)\n  .`}
                <span tw="text-yellow-500">find</span>
                {`({\n`}
                {`    `}
                <span tw="text-blue-400">email</span>
                {`: `}
                <span tw="text-blue-400">anyOf</span>
                {`([\n`}
                {`      `}
                <span tw="text-yellow-700">`adam@example.com`</span>
                {`,\n`}
                {`      `}
                <span tw="text-yellow-700">`janet@example.com`</span>
                {`,\n`}
                {`    ]),\n`}
                {`  })\n  .`}
                <span tw="text-yellow-500">all</span>
                {`();`}
              </CodeSample>
              <SampleTable>
                <SampleTableRow variant="select">
                  <SampleTableCell>adam@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>dee@example.com</SampleTableCell>
                  <SampleTableCell>false</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow variant="select">
                  <SampleTableCell>janet@example.com</SampleTableCell>
                  <SampleTableCell>true</SampleTableCell>
                </SampleTableRow>
              </SampleTable>
            </FeatureWithCode>
            <div tw="h-12" />
            <FeatureWithCode title="Use the full power of SQL to write complex queries">
              <CodeSample>
                <span tw="text-purple-700">await</span>{' '}
                <span tw="text-blue-400">db</span>
                {`.`}
                <span tw="text-yellow-500">query</span>
                {`(`}
                <span tw="text-blue-400">sql</span>
                {`\`\n`}
                {`  `}
                <span tw="text-blue-400">SELECT</span>
                {`\n    `}users.email,{`\n    `}count(*){' '}
                <span tw="text-blue-400">AS</span> posts{`\n  `}
                <span tw="text-blue-400">FROM</span> users{`\n  `}
                <span tw="text-blue-400">INNER JOIN</span> posts{`\n  `}
                <span tw="text-blue-400">ON</span> (users.email = posts.author)
                {`\n  `}
                <span tw="text-blue-400">GROUP BY</span> users.email{`\n  `}
                <span tw="text-blue-400">WHERE</span> users.active ={' '}
                <span tw="text-blue-800">true</span>
                {`\n\`);`}
              </CodeSample>
              <SampleTable headers={['email', 'posts']}>
                <SampleTableRow>
                  <SampleTableCell>adam@example.com</SampleTableCell>
                  <SampleTableCell>4</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>janet@example.com</SampleTableCell>
                  <SampleTableCell>16</SampleTableCell>
                </SampleTableRow>
              </SampleTable>
            </FeatureWithCode>
            <div tw="h-12" />
            <FeatureWithCode title="Wrap any operations into an atomic transaction">
              <CodeSample>
                <span tw="text-purple-700">await</span>{' '}
                <span tw="text-blue-400">db</span>.
                <span tw="text-yellow-500">tx</span>(
                <span tw="text-purple-700">async</span> (
                <span tw="text-blue-400">db</span>
                {`) => {\n  `}
                <span tw="text-purple-700">await</span>{' '}
                <span tw="text-blue-400">tables</span>.
                <span tw="text-yellow-500">users</span>(
                <span tw="text-blue-400">db</span>).
                <span tw="text-yellow-500">update</span>
                {`(\n`}
                {`    {`}
                <span tw="text-blue-400">email</span>
                {`: `}
                <span tw="text-yellow-700">`dee@example.com`</span>
                {`},\n`}
                {`    {`}
                <span tw="text-blue-400">active</span>
                {`: `}
                <span tw="text-blue-800">true</span>
                {`},\n`}
                {`  );\n  `}
                <span tw="text-purple-700">return await</span>{' '}
                <span tw="text-blue-400">db</span>
                {`.`}
                <span tw="text-yellow-500">query</span>
                {`(`}
                <span tw="text-blue-400">sql</span>
                {`\`\n`}
                {`    `}
                <span tw="text-blue-400">SELECT</span>
                {`\n      `}users.email,{`\n      `}count(*){' '}
                <span tw="text-blue-400">AS</span> posts{`\n    `}
                <span tw="text-blue-400">FROM</span> users{`\n    `}
                <span tw="text-blue-400">INNER JOIN</span> posts{`\n    `}
                <span tw="text-blue-400">ON</span> (users.email = posts.author)
                {`\n    `}
                <span tw="text-blue-400">GROUP BY</span> users.email{`\n    `}
                <span tw="text-blue-400">WHERE</span> users.active ={' '}
                <span tw="text-blue-800">true</span>
                {`\n  \`);\n});`}
              </CodeSample>
              <SampleTable headers={['email', 'posts']}>
                <SampleTableRow>
                  <SampleTableCell>adam@example.com</SampleTableCell>
                  <SampleTableCell>4</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>dee@example.com</SampleTableCell>
                  <SampleTableCell>3</SampleTableCell>
                </SampleTableRow>
                <SampleTableRow>
                  <SampleTableCell>janet@example.com</SampleTableCell>
                  <SampleTableCell>16</SampleTableCell>
                </SampleTableRow>
              </SampleTable>
            </FeatureWithCode>
            <div tw="h-16" />
            <DatabaseCloud />
            <div tw="h-16" />
            <Features />

            <div tw="mt-12 mb-12 max-w-md mx-auto sm:flex sm:justify-center md:mt-16">
              <div tw="rounded-md shadow">
                <Link href="/docs/sql">
                  <a
                    href="/docs/sql"
                    tw="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-900 hover:bg-red-700 md:py-4 md:text-lg md:px-10"
                  >
                    Get started
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </NavBar>
        <Footer />
      </Background>
    </>
  );
}

function Background({children}: {children: React.ReactNode}) {
  return <div tw="relative bg-gray-200 overflow-hidden">{children}</div>;
}
