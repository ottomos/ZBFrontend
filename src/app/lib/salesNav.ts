// Screens that belong to the Sales section.
// Dealers get them directly in the top navigation; every other role reaches
// them through the "Sales" dropdown and may only view them.
export const SALES_NAV_ITEMS = [
  { name: 'Deal', path: '/sales/deal' },
  { name: 'Manager View', path: '/sales/manager-view' },
  { name: 'Segmentation', path: '/sales/segmentation' },
  { name: 'Detection', path: '/sales/detection' },
  { name: 'Customer Intelligence', path: '/sales/customer-intelligence' },
] as const;

export type SalesNavItem = (typeof SALES_NAV_ITEMS)[number];

// Landing screen for the Sales section (also the Dealer's home page).
export const SALES_HOME_PATH: string = SALES_NAV_ITEMS[0].path;

export function isSalesPath(pathname: string): boolean {
  return pathname === '/sales' || pathname.startsWith('/sales/');
}

export function salesItemForPath(pathname: string): SalesNavItem | undefined {
  return SALES_NAV_ITEMS.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
}
