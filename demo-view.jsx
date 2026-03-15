import React, { useState, useEffect } from 'react';
import { 
  Car, Calendar, TrendingUp, Users, LogOut, Settings, 
  Menu, X, Phone, Mail, MapPin, ChevronRight, CheckCircle2,
  ShieldAlert, Lock
} from 'lucide-react';

// --- DUMMY DATA ---
const FLEET = [
  {
    id: 1,
    name: "Audi RS6 Avant",
    type: "Premium Estate",
    basePrice: 250,
    image: "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&q=80&w=1000",
    specs: ["600 HP", "Automatic", "5 Seats", "Petrol"]
  },
  {
    id: 2,
    name: "Mercedes-Benz G 63 AMG",
    type: "Luxury SUV",
    basePrice: 350,
    image: "https://images.unsplash.com/photo-1520031441872-265e4ff70366?auto=format&fit=crop&q=80&w=1000",
    specs: ["585 HP", "Automatic", "5 Seats", "Petrol"]
  },
  {
    id: 3,
    name: "Porsche Taycan Cross Turismo",
    type: "Electric Sport",
    basePrice: 280,
    image: "https://images.unsplash.com/photo-1614200187524-dc4b892acf16?auto=format&fit=crop&q=80&w=1000",
    specs: ["Electric", "Automatic", "4 Seats", "450km Range"]
  }
];

const REQUESTS = [
  { id: 101, name: "Lukas Weber", car: "Audi RS6 Avant", dates: "12.10 - 26.10", status: "Pending" },
  { id: 102, name: "Sarah Müller", car: "Porsche Taycan", dates: "01.11 - 30.11", status: "Approved" },
];

export default function App() {
  const [view, setView] = useState('b2c'); // 'b2c', 'login', 'admin'
  const [showCookieBanner, setShowCookieBanner] = useState(true);

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 selection:bg-blue-600 selection:text-white">
      {view === 'b2c' && <B2CView setView={setView} />}
      {view === 'login' && <LoginView setView={setView} />}
      {view === 'admin' && <AdminView setView={setView} />}
      
      {showCookieBanner && (
        <CookieBanner onAccept={() => setShowCookieBanner(false)} onDecline={() => setShowCookieBanner(false)} />
      )}
    </div>
  );
}

// --- COMPONENTS ---

function CookieBanner({ onAccept, onDecline }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-white border-t border-neutral-200 shadow-2xl transform transition-transform duration-500">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Privacy & Cookies</h3>
          </div>
          <p className="text-sm text-neutral-600">
            We use cookies to improve your experience and analyze our traffic. 
            By clicking "Accept", you consent to our use of cookies in accordance with the Swiss FADP and GDPR.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 shrink-0">
          <button 
            onClick={onDecline}
            className="px-6 py-2.5 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-100 transition-colors text-sm font-medium"
          >
            Decline Non-Essential
          </button>
          <button 
            onClick={onAccept}
            className="px-6 py-2.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            Accept All Cookies
          </button>
        </div>
      </div>
    </div>
  );
}

function B2CView({ setView }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);

  const scrollToContact = () => {
    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Car className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">EuroAuto<span className="text-blue-600">Rent</span></span>
            </div>
            
            <div className="hidden md:flex space-x-8 items-center">
              <a href="#fleet" className="text-sm font-medium hover:text-blue-600 transition-colors">Our Fleet</a>
              <a href="#pricing" className="text-sm font-medium hover:text-blue-600 transition-colors">Pricing Model</a>
              <button onClick={scrollToContact} className="bg-neutral-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors">
                Request a Quote
              </button>
            </div>

            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative bg-neutral-900 text-white overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=2000" 
            alt="Hero Car" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/60 to-transparent" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 flex flex-col items-center text-center">
          <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold tracking-wider uppercase mb-6">
            Long-Term Rentals in Switzerland
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl">
            Premium Mobility, <br/><span className="text-blue-500">Without the Commitment.</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mb-10">
            Exclusive long-term car rentals. Flexible pricing that drops the longer you drive. Fully insured, meticulously maintained.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <a href="#fleet" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold transition-colors flex items-center justify-center gap-2">
              Explore Fleet <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Fleet Section */}
      <section id="fleet" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Available Vehicles</h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">Select a vehicle to see our dynamic long-term pricing and request a specific quote.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FLEET.map(car => (
              <div key={car.id} className="group rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 bg-white">
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img src={car.image} alt={car.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                    From CHF {car.basePrice} / day
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">{car.type}</div>
                  <h3 className="text-xl font-bold mb-4">{car.name}</h3>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {car.specs.map(spec => (
                      <span key={spec} className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-md">
                        {spec}
                      </span>
                    ))}
                  </div>
                  <button 
                    onClick={() => { setSelectedCar(car); scrollToContact(); }}
                    className="w-full py-3 text-sm font-semibold text-neutral-900 border-2 border-neutral-900 rounded-lg hover:bg-neutral-900 hover:text-white transition-colors"
                  >
                    Inquire About This Car
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Explainer */}
      <section id="pricing" className="py-20 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-12">How Our Pricing Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
              <div className="text-4xl font-black text-neutral-200 mb-4">01</div>
              <h4 className="text-lg font-bold mb-2">Days 1 - 7</h4>
              <p className="text-neutral-500 text-sm">Standard base daily rate applies for short-term needs.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-bl-lg">20% OFF</div>
              <div className="text-4xl font-black text-blue-50 mb-4">02</div>
              <h4 className="text-lg font-bold mb-2">Days 8 - 30</h4>
              <p className="text-neutral-500 text-sm">Automatic 20% discount applied to the daily rate for extended rentals.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-blue-600 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">40% OFF</div>
              <div className="text-4xl font-black text-blue-50 mb-4">03</div>
              <h4 className="text-lg font-bold mb-2">31+ Days</h4>
              <p className="text-neutral-500 text-sm">Maximum 40% discount applied. Best value for true long-term mobility.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form (FADP Compliant) */}
      <section id="contact-form" className="py-24 bg-white relative">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-neutral-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl">
            <h2 className="text-3xl font-bold mb-2">Request a Quote</h2>
            <p className="text-neutral-400 mb-8">Fill out the form below. Our team will contact you with a customized offer within 24 hours.</p>
            
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert("Form submitted successfully! (Dummy)"); }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Full Name *</label>
                  <input required type="text" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Phone Number *</label>
                  <input required type="tel" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+41 79 123 45 67" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address *</label>
                <input required type="email" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Vehicle of Interest</label>
                <select 
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  defaultValue={selectedCar ? selectedCar.name : ""}
                >
                  <option value="" disabled>Select a vehicle...</option>
                  {FLEET.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  <option value="other">Not sure yet / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Message / Desired Dates</label>
                <textarea rows="4" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="I am looking to rent from..." />
              </div>

              {/* MANDATORY FADP/GDPR CONSENT */}
              <div className="flex items-start gap-3 mt-6 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                <div className="flex items-center h-5 mt-0.5">
                  <input required id="privacy_consent" type="checkbox" className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900" />
                </div>
                <div className="text-sm">
                  <label htmlFor="privacy_consent" className="font-medium text-neutral-200">Data Privacy Consent *</label>
                  <p className="text-neutral-400 mt-1 text-xs">
                    I consent to the processing of my personal data (Name, Email, Phone) to handle this inquiry. Data is processed securely and may be transferred to our email processor (Brevo). See our <a href="#" className="text-blue-400 hover:underline">Privacy Policy</a> for details.
                  </p>
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-colors shadow-lg shadow-blue-600/20">
                Submit Request
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer & Hidden Login */}
      <footer className="bg-neutral-50 py-12 border-t border-neutral-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <div className="flex gap-6 mb-8 text-neutral-500">
            <a href="#" className="hover:text-neutral-900 transition-colors text-sm">Impressum</a>
            <a href="#" className="hover:text-neutral-900 transition-colors text-sm">Privacy Policy (AGB)</a>
            <a href="#" className="hover:text-neutral-900 transition-colors text-sm">Cookie Settings</a>
          </div>
          <p className="text-neutral-400 text-sm flex items-center gap-1">
            © {new Date().getFullYear()} Euro Abschlepdienst. All rights reserved. 
            {/* HIDDEN LOGIN TRIGGER */}
            <span 
              onClick={() => setView('login')} 
              className="w-1.5 h-1.5 rounded-full bg-neutral-300 hover:bg-blue-500 cursor-pointer transition-colors ml-2"
              title="Admin Login"
            />
          </p>
        </div>
      </footer>
    </div>
  );
}

function LoginView({ setView }) {
  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">CMS Portal</h2>
        <p className="text-neutral-500 text-center text-sm mb-8">Authorized personnel only.</p>
        
        <form onSubmit={(e) => { e.preventDefault(); setView('admin'); }}>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input required type="email" defaultValue="admin@euro.ch" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
              <input required type="password" defaultValue="password123" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
            Secure Login
          </button>
        </form>
        <button onClick={() => setView('b2c')} className="w-full mt-4 text-sm text-neutral-500 hover:text-neutral-900 text-center">
          &larr; Return to public site
        </button>
      </div>
    </div>
  );
}

function AdminView({ setView }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-neutral-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col">
        <div className="h-20 flex items-center px-6 border-b border-neutral-200">
          <span className="font-bold text-lg">Admin<span className="text-blue-600">CMS</span></span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem icon={TrendingUp} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Car} label="Fleet Manager" active={activeTab === 'fleet'} onClick={() => setActiveTab('fleet')} />
          <SidebarItem icon={Calendar} label="Availability" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <SidebarItem icon={Users} label="Inquiries" active={activeTab === 'inquiries'} onClick={() => setActiveTab('inquiries')} badge="2" />
        </nav>
        <div className="p-4 border-t border-neutral-200">
          <button onClick={() => setView('b2c')} className="flex items-center gap-3 px-4 py-2 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-20 bg-white border-b border-neutral-200 flex items-center justify-between px-8">
          <h1 className="text-xl font-bold capitalize">{activeTab}</h1>
          <div className="flex items-center gap-3 text-sm font-medium">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center">A</div>
            Admin User
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Active Rentals" value="12" subtitle="3 pending return" />
                <StatCard title="Monthly Revenue (Est.)" value="CHF 45,200" subtitle="+12% from last month" />
                <StatCard title="Fleet Utilization" value="85%" subtitle="17 of 20 cars booked" />
              </div>
              
              {/* Recent Requests Table */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden mt-8">
                <div className="p-6 border-b border-neutral-200 flex justify-between items-center">
                  <h3 className="font-bold text-lg">New Web Inquiries</h3>
                  <button onClick={() => setActiveTab('inquiries')} className="text-sm text-blue-600 hover:underline">View All</button>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Requested Car</th>
                      <th className="px-6 py-3 font-medium">Dates</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {REQUESTS.map(req => (
                      <tr key={req.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 font-medium">{req.name}</td>
                        <td className="px-6 py-4 text-neutral-600">{req.car}</td>
                        <td className="px-6 py-4 text-neutral-600">{req.dates}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            req.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-800 font-medium">Review</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'fleet' && (
            <div className="bg-white p-8 rounded-xl border border-neutral-200 text-center text-neutral-500 py-20">
              <Car className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
              <h2 className="text-xl font-bold text-neutral-900 mb-2">Fleet Management UI</h2>
              <p>Here admins will add/edit cars, upload images, and set pricing breakpoints.</p>
              <button className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">
                + Add New Vehicle
              </button>
            </div>
          )}

          {(activeTab === 'calendar' || activeTab === 'inquiries') && (
            <div className="bg-white p-8 rounded-xl border border-neutral-200 text-center text-neutral-500 py-20">
              <Settings className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
              <h2 className="text-xl font-bold text-neutral-900 mb-2">{activeTab} Module</h2>
              <p>This module will be connected to the Node.js API and PostgreSQL database.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-neutral-400'}`} />
        {label}
      </div>
      {badge && (
        <span className="bg-blue-600 text-white text-xs py-0.5 px-2 rounded-full">{badge}</span>
      )}
    </button>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
      <h4 className="text-sm font-medium text-neutral-500 mb-2">{title}</h4>
      <div className="text-3xl font-bold text-neutral-900 mb-1">{value}</div>
      <div className="text-xs text-neutral-500">{subtitle}</div>
    </div>
  );
}