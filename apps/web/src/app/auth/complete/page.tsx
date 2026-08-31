'use client';

import { CompleteAuthSession } from '@kayamo/features';

export default function AuthCompletePage() {
  return <CompleteAuthSession afterAuthPath="/today" />;
}
