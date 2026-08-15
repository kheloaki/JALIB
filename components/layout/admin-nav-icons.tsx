import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BadgeCheck,
  Bell,
  Boxes,
  FileText,
  History,
  LayoutDashboard,
  PackagePlus,
  Receipt,
  ScanBarcode,
  ShoppingCart,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";

const ADMIN_NAV_LUCIDE: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  inventory_2: Boxes,
  shopping_cart: ShoppingCart,
  point_of_sale: ScanBarcode,
  add_box: PackagePlus,
  receipt_long: Receipt,
  payments: Banknote,
  assignment_return: Undo2,
  description: FileText,
  group: Users,
  notifications_active: Bell,
  account_balance_wallet: Wallet,
  badge: BadgeCheck,
  history: History,
};

export function adminNavLucideIcon(key: string): LucideIcon {
  return ADMIN_NAV_LUCIDE[key] ?? LayoutDashboard;
}
