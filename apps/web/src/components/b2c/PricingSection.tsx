export function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-neutral-50 border-y border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold mb-12">So funktioniert unsere Preisgestaltung</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Tier 1 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
            <div className="text-4xl font-black text-neutral-200 mb-4">01</div>
            <h4 className="text-lg font-bold mb-2">Tag 1 – 7</h4>
            <p className="text-neutral-500 text-sm">
              Standard-Tagestarif für kurzfristige Bedürfnisse.
            </p>
          </div>

          {/* Tier 2 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-brand-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brand-100 text-brand-700 text-xs font-bold px-3 py-1 rounded-bl-lg">
              20% RABATT
            </div>
            <div className="text-4xl font-black text-brand-50 mb-4">02</div>
            <h4 className="text-lg font-bold mb-2">Tag 8 – 30</h4>
            <p className="text-neutral-500 text-sm">
              Automatisch 20% Rabatt auf den Tagestarif bei verlängerter Miete.
            </p>
          </div>

          {/* Tier 3 */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-brand-600 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              40% RABATT
            </div>
            <div className="text-4xl font-black text-brand-50 mb-4">03</div>
            <h4 className="text-lg font-bold mb-2">Ab 31 Tagen</h4>
            <p className="text-neutral-500 text-sm">
              Maximaler 40% Rabatt. Bestes Preis-Leistungs-Verhältnis für echte Langzeitmobilität.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
