import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarRange,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Ellipsis,
  ExternalLink,
  FileText,
  Flag,
  GalleryHorizontalEnd,
  Keyboard,
  LayoutGrid,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MicVocal,
  Newspaper,
  Package,
  PackageX,
  Plus,
  QrCode,
  Radio,
  ReceiptTurkishLira,
  Rows3,
  Scale,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Stamp,
  Tags,
  TicketPercent,
  TrendingUp,
  TriangleAlert,
  UserCog,
  Users,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

import { cx } from "@/components/laffogato/cx";

/*
 * The panel's icons: lucide-react, pinned exactly in package.json. This is
 * the only file that imports the package (tests/admin-ui-deps.test.ts), so
 * every icon the panel draws is named here once and an upgrade that drops
 * a name fails one test instead of one screen.
 *
 * Keys are the nav sections (roles.ts) where an item owns its section, and
 * the item's own icon key where items share one (appLive, appFal, slides),
 * so the sidebar can keep looking up `item.icon ?? item.section`. The rest
 * are controls. Each key draws a different icon.
 *
 * Lucide's Icon is a client component, so a server page may render
 * AdminIcon too: the icon's path data travels as props.
 */
export const ADMIN_ICONS = {
  dashboard: LayoutGrid,
  orders: ShoppingBag,
  karaoke: MicVocal,
  till: Stamp,
  appLive: Radio,
  menu: Coffee,
  products: Package,
  stock: Boxes,
  customers: Users,
  promos: TicketPercent,
  newsletter: Mail,
  slides: GalleryHorizontalEnd,
  content: FileText,
  mobileApp: Smartphone,
  appFal: Flag,
  reports: ChartColumn,
  invoices: ReceiptTurkishLira,
  tables: QrCode,
  settings: Settings,
  adminUsers: UserCog,
  legal: Scale,
  audit: ScrollText,
  search: Search,
  create: Plus,
  drawer: Menu,
  more: Ellipsis,
  external: ExternalLink,
  dateRange: CalendarRange,
  close: X,
  chevron: ChevronDown,
  // A row's ↑ / ↓ (MoveButtons): this one and `chevron`.
  chevronUp: ChevronUp,
  // The account block: Güvenlik / 2FA, the single-key switch, Sıkı görünüm,
  // Çıkış.
  security: ShieldCheck,
  shortcuts: Keyboard,
  density: Rows3,
  logout: LogOut,
  // The dashboard: its tiles (open orders draw `orders`) and the "Hızlı
  // ekle" records that have no nav item of their own.
  attention: TriangleAlert,
  soldOut: PackageX,
  revenue: TrendingUp,
  categories: Tags,
  announcement: Megaphone,
  post: Newspaper,
  // A wizard's finished step (ui/wizard.tsx).
  stepDone: Check,
  // A KPI's change against its reference (dashboard/kpi-strip.tsx).
  deltaUp: ArrowUpRight,
  deltaDown: ArrowDownRight,
} as const satisfies Record<string, LucideIcon>;

export type AdminIconName = keyof typeof ADMIN_ICONS;

/** The panel's icon size and line: 18 px, a lighter line than lucide's 2. */
export const ADMIN_ICON_SIZE = 18;
export const ADMIN_ICON_STROKE = 1.75;

export interface AdminIconProps extends Omit<LucideProps, "ref"> {
  name: AdminIconName;
}

/**
 * One panel icon. Decorative by default (`aria-hidden`), since the label
 * next to it names the control. An icon-only control labels the control
 * itself; pass `aria-label` here only when the icon alone is the content,
 * and it is then announced as an image.
 */
export function AdminIcon({
  name,
  size = ADMIN_ICON_SIZE,
  strokeWidth = ADMIN_ICON_STROKE,
  className,
  ...rest
}: AdminIconProps) {
  const Icon = ADMIN_ICONS[name];
  const labelled = Boolean(rest["aria-label"] || rest["aria-labelledby"]);
  return (
    <Icon
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      {...rest}
      size={size}
      strokeWidth={strokeWidth}
      className={cx("shrink-0", className)}
    />
  );
}
