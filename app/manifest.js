export default function manifest() {
  return {
    name: 'PermitPath HQ',
    short_name: 'PermitPath',
    description: 'Daily plans, check-ins, and goals for the PermitPath team.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f8f7',
    theme_color: '#1e6b47',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
