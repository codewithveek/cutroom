import {
  Activity,
  FolderClosed,
  LayoutGrid,
  Library,
  type LucideIcon,
  Palette,
  Plus,
  Settings,
} from "lucide-react";

export interface NavLink {
  kind: "link";
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
  /** Extra path prefixes that mark this item active. */
  matches?: ReadonlyArray<string>;
}

export interface NavTree {
  kind: "projects";
  id: "projects";
  label: string;
  Icon: LucideIcon;
}

export type NavEntry = NavLink | NavTree;

/** Two groups split by a divider, as in the design: making videos, then everything around them. */
export const navGroups: ReadonlyArray<ReadonlyArray<NavEntry>> = [
  [
    { kind: "link", id: "home", label: "Home", href: "/", Icon: LayoutGrid },
    { kind: "link", id: "new", label: "New video", href: "/new", Icon: Plus },
    { kind: "projects", id: "projects", label: "Projects", Icon: FolderClosed },
    { kind: "link", id: "activity", label: "Activity", href: "/activity", Icon: Activity },
  ],
  [
    { kind: "link", id: "library", label: "Library", href: "/library", Icon: Library },
    { kind: "link", id: "styles", label: "Styles", href: "/styles", Icon: Palette },
    { kind: "link", id: "settings", label: "Settings", href: "/settings", Icon: Settings },
  ],
];

export function isActivePath(pathname: string, link: NavLink): boolean {
  if (link.href === "/") return pathname === "/";
  return [link.href, ...(link.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
