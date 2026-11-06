import type { ComponentType, SVGProps } from "react";
import { IconCard, IconChart, IconHome, IconList, IconLoan, IconPiggy, IconReport, IconSend, IconShield } from "@/components/ui/Icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Acasă", icon: IconHome },
  { href: "/conturi", label: "Conturi & Carduri", icon: IconCard },
  { href: "/tranzactii", label: "Tranzacții", icon: IconList },
  { href: "/plati", label: "Plăți", icon: IconSend },
  { href: "/economii", label: "Economii", icon: IconPiggy },
  { href: "/credite", label: "Credite", icon: IconLoan },
  { href: "/investitii", label: "Investiții", icon: IconChart },
  { href: "/asigurari", label: "Asigurări", icon: IconShield },
  { href: "/rapoarte", label: "Rapoarte", icon: IconReport },
];
