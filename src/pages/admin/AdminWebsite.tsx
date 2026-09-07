import { Link } from "react-router-dom";
import {
  Dumbbell,
  Home,
  MessageSquare,
  PanelsTopLeft,
  ShoppingBag,
  Star,
  Tags,
} from "lucide-react";
import { AdminCard, AdminPageHeader } from "@src/components/admin/AdminUI";

const pages = [
  {
    label: "Home page",
    description: "Main headline, highlights and homepage sections",
    to: "/admin/home",
    icon: Home,
  },
  {
    label: "Trainers",
    description: "Coach profiles and personal training plans",
    to: "/admin/trainers",
    icon: Dumbbell,
  },
  {
    label: "Facilities",
    description: "Training areas, equipment and photos",
    to: "/admin/facilities",
    icon: PanelsTopLeft,
  },
  {
    label: "Membership prices",
    description: "Manage membership plans and rates used by Billing and the public website",
    to: "/admin/pricing",
    icon: Tags,
  },
  {
    label: "Pro Shop website",
    description: "Products shown to website visitors",
    to: "/admin/proshop",
    icon: ShoppingBag,
  },
  {
    label: "Testimonials",
    description: "Member stories and reviews",
    to: "/admin/testimonials",
    icon: Star,
  },
  {
    label: "Contact and footer",
    description: "Contact details, FAQs and footer links",
    to: "/admin/contact",
    icon: MessageSquare,
  },
];

export default function AdminWebsite() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Website"
        title="Edit your public website"
        description="Choose the part of the website you want to update. These pages do not affect daily gym operations."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map(({ label, description, to, icon: Icon }) => (
          <Link key={to} to={to} className="group">
            <AdminCard className="h-full transition group-hover:border-amber-400/45 group-hover:bg-slate-900">
              <Icon className="h-6 w-6 text-amber-300" />
              <h2 className="mt-4 text-lg font-black text-white">{label}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {description}
              </p>
              <div className="mt-4 text-sm font-semibold text-amber-200">
                Open →
              </div>
            </AdminCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
