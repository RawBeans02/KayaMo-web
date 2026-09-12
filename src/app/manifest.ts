import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KayaMo',
    short_name: 'KayaMo',
    description: 'Small steps, meaningful goals, and room to grow.',
    start_url: '/today',
    display: 'standalone',
    background_color: '#F6F7F4',
    theme_color: '#246348',
    icons: [
      { src: '/botanical/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/botanical/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
