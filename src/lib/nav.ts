import {
  BanknoteIcon,
  FileTextIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  MessageSquareTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PackageIcon,
  PackageXIcon,
  ShoppingCartIcon,
  StarIcon,
  StoreIcon,
  Undo2Icon,
  WalletIcon,
} from "lucide-react";
import { ADS_PERMISSION } from "@/lib/api/ads";
import { EARNINGS_PERMISSIONS } from "@/lib/api/earnings";
import { MESSAGE_SETTINGS_PERMISSION, MESSAGES_VIEW_PERMISSION } from "@/lib/api/messages";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user holds any of these permissions; none means everyone. */
  permission?: string | string[];
  /** A live count shown beside the label. */
  badge?: "unread-messages";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "General",
    items: [{ href: "/", label: "Overview", icon: LayoutDashboardIcon }],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/products", label: "Products", icon: PackageIcon, permission: "products.view" },
      { href: "/inventory/low-stock", label: "Low stock", icon: PackageXIcon, permission: "inventory.manage" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingCartIcon, permission: "orders.view" },
      { href: "/returns", label: "Returns", icon: Undo2Icon, permission: "orders.view" },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        href: "/messages",
        label: "Messages",
        icon: MessageSquareIcon,
        permission: MESSAGES_VIEW_PERMISSION,
        badge: "unread-messages",
      },
      // Any vendor account may read its reviews; replying needs products.manage.
      { href: "/reviews", label: "Reviews", icon: StarIcon },
    ],
  },
  {
    label: "Marketing",
    items: [{ href: "/ads", label: "Ads", icon: MegaphoneIcon, permission: ADS_PERMISSION }],
  },
  {
    label: "Finance",
    items: [
      { href: "/earnings", label: "Earnings", icon: WalletIcon, permission: EARNINGS_PERMISSIONS },
      { href: "/payouts", label: "Payouts", icon: BanknoteIcon, permission: EARNINGS_PERMISSIONS },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/store", label: "Store profile", icon: StoreIcon, permission: "stores.manage" },
      {
        href: "/message-settings",
        label: "Message settings",
        icon: MessageSquareTextIcon,
        permission: MESSAGE_SETTINGS_PERMISSION,
      },
      { href: "/application", label: "Application & agreement", icon: FileTextIcon },
    ],
  },
];

export function visibleNav(can: (permission: string | string[]) => boolean): NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0);
}
