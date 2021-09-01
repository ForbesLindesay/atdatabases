import {useEffect, useState} from 'react';

let languagePreference: string[] = [];

const subscriptions: (() => void)[] = [];

const setLanguagePref = (newLanguagePreference: string[]) => {
  languagePreference = newLanguagePreference;
  for (const fn of subscriptions) {
    fn();
  }
  localStorage.setItem(
    `language_preference`,
    JSON.stringify(languagePreference),
  );
};
export function useLanguagePreference() {
  const [languagePreferenceState, setState] = useState(languagePreference);
  useEffect(() => {
    const fn = () => {
      setState(languagePreference);
    };
    subscriptions.push(fn);
    try {
      const str = localStorage.getItem(`language_preference`);
      if (str) {
        const val = JSON.parse(str);
        if (Array.isArray(val) && val.every((l) => typeof l === 'string')) {
          setLanguagePref(val);
        }
      }
    } catch (ex) {
      console.error((ex as Error).stack);
      // ignore error
    }
    return () => {
      const i = subscriptions.indexOf(fn);
      if (i !== -1) {
        subscriptions.splice(i, 1);
      }
    };
  }, []);
  return [
    (languages: string[]) => {
      const minIndex = Math.min(
        Infinity,
        ...languages
          .map((lang) => languagePreferenceState.indexOf(lang))
          .filter((i) => i !== -1),
      );
      if (minIndex < languagePreferenceState.length) {
        return languagePreferenceState[minIndex];
      } else {
        return languages[0];
      }
    },
    (newLanguagePreference: string) => {
      setLanguagePref([
        newLanguagePreference,
        ...languagePreference.filter((p) => p !== newLanguagePreference),
      ]);
    },
  ] as const;
}
