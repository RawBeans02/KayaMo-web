import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg hover:brightness-110 active:brightness-95 disabled:bg-surface-2 disabled:text-muted disabled:hover:brightness-100',
  secondary:
    'bg-surface-2 text-text hover:bg-surface disabled:text-muted',
  ghost:
    'bg-transparent text-text hover:bg-surface-2 disabled:text-muted',
};

const sizeClass: Record<ButtonSize, string> = {
  md: 'min-h-12 px-4 text-body',
  lg: 'min-h-thumb px-5 text-title',
};

export function Button({
  variant = 'primary',
  size = 'lg',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex w-full items-center justify-center rounded-md font-body font-semibold tracking-wide',
        'transition-[transform,filter,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
