'use client';

import {
  House,
  Target,
  Leaf,
  Tree,
  ChatCircleDots,
  GearSix,
  ArrowRight,
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
} from '@phosphor-icons/react';

const icons = {
  home: House,
  goals: Target,
  life: Leaf,
  grove: Tree,
  mus: ChatCircleDots,
  settings: GearSix,
  arrow: ArrowRight,
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
};
export function BotanicalIcon({
  name,
  size = 22,
}: {
  name: keyof typeof icons;
  size?: number;
}) {
  const Icon = icons[name];
  return <Icon size={size} aria-hidden="true" />;
}
