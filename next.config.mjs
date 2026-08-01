import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static-paths jest-worker keeps dying with EPIPE on this machine
  // ("Jest worker encountered 2 child process exceptions"), taking every
  // route down with 500s. That's jest-worker's child_process fork mode
  // hitting a known Windows pipe bug; worker_threads doesn't fork a
  // process so it sidesteps the EPIPE entirely.
  experimental: {
    workerThreads: true,
    cpus: 1,
  },
  async redirects() {
    return [
      // The login page lives at /auth/sign-in alongside the other auth screens.
      // /login is kept as an alias so the conventional path works; Next
      // preserves the query string, so /login?signedOut=1 still shows the
      // sign-out confirmation.
      { source: '/login', destination: '/auth/sign-in', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'eventseye.com' },
      { protocol: 'https', hostname: 'www.eventseye.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
