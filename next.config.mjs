import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'eventseye.com' },
      { protocol: 'https', hostname: 'www.eventseye.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
