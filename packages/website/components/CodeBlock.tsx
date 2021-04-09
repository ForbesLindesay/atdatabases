import React from 'react';
import 'twin.macro';
import tw, {TwStyle} from 'twin.macro';
import {useLanguagePreference} from '../utils/LanguageSelector';

export enum CodeTokenType {
  Punctuation,
  Keyword,
  SqlKeyword,
  Text,
  String,
  Number,
  Boolean,
  Identifier,
  Property,
  Null,
  Comment,
}
const DISPLAY_NAMES: {[key in string]?: string} = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
};
export function CodeBlock({
  blocks,
  isInBlockquote,
}: {
  blocks: {lang: string; code: {type: CodeTokenType; value: string}[]}[];
  isInBlockquote?: boolean;
}) {
  const [getLanguagePref, setLanguagePref] = useLanguagePreference();
  const lang = getLanguagePref(blocks.map((b) => b.lang));
  const block = blocks.find((b) => b.lang === lang) || blocks[0];
  return (
    <div
      tw="mt-4 overflow-x-scroll text-sm md:text-base text-gray-800 rounded-md md:rounded-lg py-4 md:py-4 px-2 md:px-6"
      css={[
        !isInBlockquote && tw`bg-gray-100`,
        isInBlockquote && tw`bg-yellow-100`,
      ]}
    >
      <Code code={block.code} />
      {blocks.length > 1 && (
        <LanguageSwitcher>
          {blocks.map((b) => (
            <LanguageSwitcherButton
              key={b.lang}
              active={lang === b.lang}
              onClick={() => setLanguagePref(b.lang)}
            >
              {DISPLAY_NAMES[b.lang] ?? b.lang}
            </LanguageSwitcherButton>
          ))}
        </LanguageSwitcher>
      )}
    </div>
  );
}

function LanguageSwitcher({children}: {children: React.ReactNode}) {
  return <ul tw="flex justify-end space-x-2 mt-4">{children}</ul>;
}

function LanguageSwitcherButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        tw="border border-red-900 rounded px-3 py-2"
        css={[
          !active &&
            tw`bg-white text-red-900 hover:border-red-700 hover:bg-red-700 hover:text-white shadow-md`,
          active && tw`bg-red-900 text-white`,
        ]}
        onClick={() => onClick()}
      >
        {children}
      </button>
    </li>
  );
}

function Code({
  code,
}: {
  code: {type: CodeTokenType; value: string; highlight?: boolean}[];
}) {
  return (
    <pre tw="flex items-center">
      <code>
        {code.map((c, i) => {
          const style = getStyle(c.type);
          return (
            <span key={i} css={[style, c.highlight && tw`bg-yellow-200`]}>
              {c.value}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function getStyle(type: CodeTokenType): TwStyle {
  switch (type) {
    case CodeTokenType.Punctuation:
      return tw`text-gray-700`;
    case CodeTokenType.String:
    case CodeTokenType.Number:
      return tw`text-yellow-700`;
    case CodeTokenType.Boolean:
      return tw`text-blue-500`;
    case CodeTokenType.Null:
    case CodeTokenType.Keyword:
      return tw`text-purple-800`;
    case CodeTokenType.SqlKeyword:
      return tw`text-purple-500`;
    case CodeTokenType.Identifier:
      return tw`text-blue-400`;
    case CodeTokenType.Property:
      return tw`text-yellow-500`;
    case CodeTokenType.Comment:
      return tw`text-gray-500`;
    case CodeTokenType.Text:
      return tw``;
  }
}
