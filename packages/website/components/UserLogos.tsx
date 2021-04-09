import 'twin.macro';

export default function UserLogos() {
  return (
    <div tw="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <p tw="text-center text-sm font-semibold uppercase text-gray-600 tracking-wide">
        Used in production at these companies, and more
      </p>
      <div tw="mt-6 grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <UserLogo href="https://www.mavenoid.com" src="/users/mavenoid.svg">
          Mavenoid
        </UserLogo>
        <UserLogo href="https://www.quandoo.com" src="/users/quandoo.svg">
          Quandoo
        </UserLogo>
        <UserLogo
          href="https://rollingversions.com"
          src="/users/rollingversions.svg"
        >
          Rolling Versions
        </UserLogo>
        <UserLogo
          href="https://savewillpower.com"
          src="/users/savewillpower.svg"
        >
          Save Willpower
        </UserLogo>
        <UserLogo
          href="https://www.threadsstyling.com"
          src="/users/threads.svg"
        >
          Threads Styling
        </UserLogo>
        <UserLogo href="https://www.jepso.com" src="/users/jepso.svg">
          Jepso
        </UserLogo>
      </div>
    </div>
  );
}

function UserLogo({
  href,
  src,
  children,
}: {
  href: string;
  src: string;
  children: string;
}) {
  return (
    <a tw="flex justify-center" href={href}>
      <img tw="h-8 max-w-xs" src={src} alt={children} />
    </a>
  );
}
