'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/#fleet', label: 'Unsere Flotte' },
  { href: '/#pricing', label: 'Preismodell' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/#location', label: 'Standort' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-mid/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-main.png"
              alt="HoppDrive Logo"
              width={140}
              height={44}
              className="h-11 w-auto"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex space-x-8 items-center">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-charcoal hover:text-brand-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/#contact-form"
              className="bg-brand-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Jetzt anfragen
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Navigation umschalten"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        <div
          className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
            mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="pb-6 space-y-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm font-medium text-charcoal hover:text-brand-600 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/#contact-form"
              className="block bg-brand-600 text-white px-5 py-2.5 rounded-full text-sm font-medium text-center hover:bg-brand-700"
              onClick={() => setMobileOpen(false)}
            >
              Jetzt anfragen
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
