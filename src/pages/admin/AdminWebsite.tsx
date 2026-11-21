import { Link } from "react-router-dom";
import {
  Dumbbell,
  Home,
  LayoutTemplate,
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
    to: "/studio/home",
    icon: Home,
  },
  {
    label: "Trainers",
    description: "Coach profiles and personal training plans",
    to: "/studio/trainers",
    icon: Dumbbell,
  },
  {
    label: "Facilities",
    description: "Training areas, equipment and photos",
    to: "/studio/facilities",
    icon: PanelsTopLeft,
  },
  {
    label: "Membership prices",
    description: "Manage membership plans and rates used by Billing and the public website",
    to: "/studio/pricing",
    icon: Tags,
  },
  {
    label: "Pro Shop website",
    description: "Products shown to website visitors",
    to: "/studio/proshop",
    icon: ShoppingBag,
  },
  {
    label: "Testimonials",
    description: "Member stories and reviews",
    to: "/studio/testimonials",
    icon: Star,
  },
  {
    label: "Contact and FAQs",
    description: "Contact details and frequently asked questions",
    to: "/studio/contact",
    icon: MessageSquare,
  },
  { label: "Footer", description: "Shared website links and contact details", to: "/studio/footer", icon: LayoutTemplate },
];

export default function AdminWebsite() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Website"
        title="Edit your public website"
        description="Choose the part of the website you want to update. Membership prices and training plans also inform future front-desk charges."
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
