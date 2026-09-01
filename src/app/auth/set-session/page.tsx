'use client';

import { SetAuthSession } from '@kayamo/features';

export default function SetSessionPage() {
  return <SetAuthSession afterAuthPath="/today" />;
}
