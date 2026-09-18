'use client';

import {
  House,
  Target,
  Leaf,
  Tree,
  Sparkle,
  GearSix,
  ArrowRight,
  ArrowUp,
  Plus,
  Barbell,
  ForkKnife,
  ListChecks,
  CaretRight,
  CaretLeft,
  BookOpenText,
  Sun,
  Moon,
  Desktop,
  UserCircle,
  Play,
  DotsThree,
  Check,
  CheckCircle,
  Bell,
  Waves,
  Translate,
  DownloadSimple,
  ShieldCheck,
  Trash,
  LockSimple,
  Plant,
} from '@phosphor-icons/react';

/**
 * The rebrand's icon vocabulary. Phosphor regular by default; `weight="fill"`
 * marks the selected nav item, matching the iOS tab-bar convention.
 *
 * `lis` is the sparkle used for Lis in navigation and on buttons. Lis also has
 * a face (mus/lis-face.tsx, the four expressions under public/botanical); the
 * icon is for places an icon belongs, the face for the surfaces where Lis is
 * present.
 */
const icons = {
  home: House,
  goals: Target,
  life: Leaf,
  grove: Plant,
  tree: Tree,
  lis: Sparkle,
  settings: GearSix,
  profile: UserCircle,
  arrow: ArrowRight,
  send: ArrowUp,
  plus: Plus,
  workout: Barbell,
  food: ForkKnife,
  tasks: ListChecks,
  next: CaretRight,
  previous: CaretLeft,
  book: BookOpenText,
  sun: Sun,
  moon: Moon,
  system: Desktop,
  play: Play,
  more: DotsThree,
  check: Check,
  checkCircle: CheckCircle,
  bell: Bell,
  motion: Waves,
  language: Translate,
  download: DownloadSimple,
  privacy: ShieldCheck,
  trash: Trash,
  lock: LockSimple,
};

export type BotanicalIconName = keyof typeof icons;

export function BotanicalIcon({
  name,
  size = 22,
  weight = 'regular',
}: {
  name: BotanicalIconName;
  size?: number;
  weight?: 'regular' | 'fill' | 'bold';
}) {
  const Icon = icons[name];
  return <Icon size={size} weight={weight} aria-hidden="true" />;
}
