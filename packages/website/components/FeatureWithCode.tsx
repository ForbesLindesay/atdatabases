import 'twin.macro';
import {Children, createContext, useContext} from 'react';
import tw from 'twin.macro';

export default function FeatureWithCode({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div tw="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl">
      {title && (
        <h2 tw="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
          {title}
        </h2>
      )}
      <div tw="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-16 lg:gap-24">
        {children}
      </div>
    </div>
  );
}

export function CodeSample({children}: {children: React.ReactNode}) {
  return (
    <div tw="overflow-x-scroll bg-white text-sm md:text-base text-gray-600 shadow-lg rounded-md md:rounded-lg py-6 md:py-8 px-4 md:px-12 w-full h-full flex items-center">
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}
type Variant = 'new' | 'change' | 'delete' | 'select';
const IsEvenContext = createContext(false);
const VariantContext = createContext<null | Variant>(null);
export function SampleTableRow({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: Variant;
}) {
  const isEven = useContext(IsEvenContext);
  return (
    <VariantContext.Provider value={variant ?? null}>
      <tr
        css={[
          !variant && isEven && tw`bg-white`,
          !variant && !isEven && tw`bg-gray-50`,
          variant === 'new' && tw`bg-green-100`,
          variant === 'change' && tw`bg-yellow-100`,
          variant === 'delete' && tw`bg-red-100`,
          variant === 'select' && tw`bg-blue-100`,
        ]}
      >
        <td
          tw="pl-6 pr-0 py-0 whitespace-nowrap"
          css={[
            variant === 'new' && tw`text-green-900`,
            variant === 'change' && tw`text-yellow-900`,
            variant === 'delete' && tw`text-red-900`,
            variant !== 'select' && tw`text-lg`,
            variant === 'select' && tw`text-3xl`,
          ]}
        >
          {variant === 'new'
            ? '+'
            : variant === 'change'
            ? '⇄'
            : variant === 'delete'
            ? '-'
            : variant === 'select'
            ? '·'
            : ''}
        </td>
        {children}
      </tr>
    </VariantContext.Provider>
  );
}
export function SampleTableCell({children}: {children: React.ReactNode}) {
  const variant = useContext(VariantContext);
  return (
    <td
      tw="px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-500"
      css={[variant === 'delete' && tw`line-through`]}
    >
      {children}
    </td>
  );
}
export function SampleTable({
  headers = ['email', 'active'],
  children,
}: {
  headers?: string[];
  children: React.ReactNode;
}) {
  return (
    <table tw="min-w-full divide-y divide-gray-200 shadow-md">
      <thead tw="bg-gray-50">
        <tr>
          <th
            scope="col"
            tw="w-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          ></th>
          {headers.map((h) => (
            <th
              key={h}
              scope="col"
              tw="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Children.map(children, (child, i) => (
          <IsEvenContext.Provider value={i % 2 === 0}>
            {child}
          </IsEvenContext.Provider>
        ))}
      </tbody>
    </table>
  );
}
