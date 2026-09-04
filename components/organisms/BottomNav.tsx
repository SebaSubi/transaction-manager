"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, PiggyBank, Plus, ArrowLeftRight, User } from "lucide-react";

import { Icon } from "@/components/ui/Icon";

/**
 * The four tabs, in this exact order, with the FAB between "Presupuesto" and
 * "Movimientos" (the centre slot). Labels are Spanish product copy and are
 * verbatim from the source design.
 */
const TABS = [
  { href: "/inicio", label: "Inicio", icon: House },
  { href: "/presupuesto", label: "Presupuesto", icon: PiggyBank },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {TABS.slice(0, 2).map((tab) => (
        <NavTab key={tab.href} {...tab} pathname={pathname} />
      ))}

      {/* The add/edit bottom sheet lands in change 2; the FAB is chrome here. */}
      <button type="button" className="bottom-nav__fab" aria-label="Agregar movimiento">
        <Icon as={Plus} size={26} />
      </button>

      {TABS.slice(2).map((tab) => (
        <NavTab key={tab.href} {...tab} pathname={pathname} />
      ))}
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon,
  pathname,
}: (typeof TABS)[number] & { pathname: string }) {
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={active ? "bottom-nav__tab bottom-nav__tab--active" : "bottom-nav__tab"}
      aria-current={active ? "page" : undefined}
    >
      <Icon as={icon} size={22} />
      <span className="bottom-nav__label">{label}</span>
    </Link>
  );
}
