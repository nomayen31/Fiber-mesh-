import Link from "next/link";
import { Facebook, Mail, MapPin, Phone } from "lucide-react";
import { site } from "@/content/site";
import { Logo } from "@/components/ui/Section";

export function Footer() {
  const { footer, contact, brand, nav, delivery } = site;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <Logo className="bg-brand-600" />
            <span className="text-lg font-bold text-white">{brand.name}</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            {footer.about}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">
            {footer.quickLinksTitle}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={`/${item.href}`}
                  className="text-slate-400 transition hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href="/products"
                className="text-slate-400 transition hover:text-white"
              >
                সব পণ্য
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">
            {footer.contactTitle}
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a
                href={`tel:${contact.phone}`}
                className="flex items-start gap-2.5 text-slate-400 transition hover:text-white"
              >
                <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {contact.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={contact.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 text-slate-400 transition hover:text-white"
              >
                <Facebook className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ফেসবুক পেজ
              </a>
            </li>
            {contact.email ? (
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-start gap-2.5 text-slate-400 transition hover:text-white"
                >
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {contact.email}
                </a>
              </li>
            ) : null}
            <li className="flex items-start gap-2.5 text-slate-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {contact.address}
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">
            অর্ডার ও সাপোর্ট
          </h3>
          <p className="mt-4 text-sm text-slate-400">{contact.hours}</p>
          <p className="mt-3 text-sm text-slate-400">
            {delivery.nationwide} • {delivery.cod}
          </p>
          <Link
            href="/#products"
            className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            পণ্য দেখুন
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="container-x space-y-2 py-6">
          <p className="text-xs leading-relaxed text-slate-500">
            {footer.disclaimer}
          </p>
          <p className="text-xs text-slate-500">
            © {year} {brand.name}. {footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
