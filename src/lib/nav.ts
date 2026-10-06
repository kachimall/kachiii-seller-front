import {
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PackageIcon,
  PackageXIcon,
  ShoppingCartIcon,
  StoreIcon,
  Undo2Icon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user holds any of these permissions; none means everyone. */
  permission?: string | string[];
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
    label: "Store",
    items: [
      { href: "/store", label: "Store profile", icon: StoreIcon, permission: "stores.manage" },
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
