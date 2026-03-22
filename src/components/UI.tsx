import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-bluegray text-offwhite hover:bg-bluegray/90',
    secondary: 'bg-white text-bluegray border border-black/5 hover:bg-black/5',
    outline: 'border border-bluegray/20 text-bluegray hover:bg-bluegray/5',
    ghost: 'text-bluegray hover:bg-bluegray/5',
    gold: 'gold-gradient text-white shadow-lg shadow-gold/20 hover:opacity-90',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  ...props
}: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass-panel rounded-2xl p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  className,
  ...props
}: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-bluegray/10 text-bluegray',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  className,
}: {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
            {label}
          </label>
          <span className="text-[10px] font-bold text-bluegray">{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-bluegray/10 rounded-lg appearance-none cursor-pointer accent-gold"
      />
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
  className,
}: {
  label?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-widest text-bluegray/40">
          {label}
        </label>
      )}
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
          checked ? 'bg-gold' : 'bg-bluegray/20'
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}
