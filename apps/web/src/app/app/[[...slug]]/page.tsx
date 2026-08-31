import { redirect } from 'next/navigation';

const LEGACY: Record<string, string> = {
  food: '/calories',
  home: '/today',
  settings: '/today',
  goals: '/todos',
  life: '/today',
  grove: '/today',
  mus: '/mus',
};

export default async function LegacyAppRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const key = slug?.[0];
  redirect(key && LEGACY[key] ? LEGACY[key] : '/today');
}
