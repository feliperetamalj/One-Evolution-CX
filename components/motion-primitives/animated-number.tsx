'use client';
// De motion-primitives (animated-number), reducido a <span> para React 19.
import { motion, useSpring, useTransform, type SpringOptions } from 'motion/react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export function AnimatedNumber({
  value,
  className,
  springOptions = { bounce: 0, duration: 800 },
}: {
  value: number;
  className?: string;
  springOptions?: SpringOptions;
}) {
  const spring = useSpring(0, springOptions);
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString('es-CL'));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={cn('tabular-nums', className)}>{display}</motion.span>;
}
