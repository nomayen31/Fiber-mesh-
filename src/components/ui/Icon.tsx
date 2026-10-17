import {
  AppWindow,
  BadgePercent,
  Banknote,
  Bath,
  Box,
  BrickWall,
  Building2,
  Clock,
  Droplets,
  Dumbbell,
  FlaskConical,
  Hammer,
  Headphones,
  Layers,
  Link as LinkIcon,
  PhoneCall,
  Ruler,
  ShieldCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Content files reference icons by name (strings) so the copy stays editable
 * without touching React code. Unknown names fall back to a sensible default.
 */
const icons: Record<string, LucideIcon> = {
  AppWindow,
  BadgePercent,
  Banknote,
  Bath,
  Box,
  BrickWall,
  Building2,
  Clock,
  Droplets,
  Dumbbell,
  FlaskConical,
  Hammer,
  Headphones,
  Layers,
  Link: LinkIcon,
  PhoneCall,
  Ruler,
  ShieldCheck,
  Truck,
  Wrench,
};

export function Icon({
  name,
  className,
  strokeWidth = 1.75,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Component = icons[name] ?? ShieldCheck;
  return <Component className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
