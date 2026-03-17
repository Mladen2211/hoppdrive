import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  CarFront, 
  CalendarDays, 
  FileText, 
  MessageSquare, 
  BarChart2, 
  Globe, 
  LogOut, 
  Settings, 
  Bell,
  TrendingUp,
  Search,
  Menu,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  X
} from 'lucide-react';

// --- MOCK DATA ---
const kpiData = [
  { title: 'Fahrzeuge gesamt', value: '12', icon: CarFront, trend: null },
  { title: 'Neue Anfragen', value: '3', icon: MessageSquare, trend: '+3 diese Woche', trendUp: true },
  { title: 'Aktive Buchungen', value: '5', icon: CalendarDays, trend: '+1 seit gestern', trendUp: true },
  { title: 'Monatlicher Umsatz', value: 'CHF 4.250', icon: BarChart2, trend: '+12% Vormonat', trendUp: true },
];

const tableData = [
  { id: 1, name: 'Lukas Meier', email: 'lukas.m@example.com', vehicle: 'VW Crafter (ZH 12345)', status: 'Buchung erstellt', date: '17.03.2026' },
  { id: 2, name: 'Mladen Raguz', email: 'mladenraguz0@gmail.com', vehicle: 'Mercedes Sprinter (ZH 98765)', status: 'Buchung erstellt', date: '16.03.2026' },
  { id: 3, name: 'Sarah Schmidt', email: 's.schmidt@gmx.ch', vehicle: 'Ford Transit (AG 45678)', status: 'Geprüft', date: '16.03.2026' },
  { id: 4, name: 'Elena Rossi', email: 'elena.rossi@bluewin.ch', vehicle: 'Renault Master (TI 34567)', status: 'Ausstehend', date: '15.03.2026' },
];

const navItems = [
  { name: 'Übersicht', icon: LayoutGrid, active: true },
  { name: 'Flotte', icon: CarFront, active: false },
  { name: 'Kalender', icon: CalendarDays, active: false },
  { name: 'Verträge', icon: FileText, active: false },
  { name: 'Anfragen', icon: MessageSquare, active: false },
  { name: 'Berichte', icon: BarChart2, active: false },
  { name: 'Website', icon: Globe, active: false },
];

// --- COMPONENTS ---

const StatusBadge = ({ status }) => {
  let styles = '';
  let dotColor = '';
  
  switch (status) {
    case 'Buchung erstellt':
      styles = 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
      dotColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      break;
    case 'Geprüft':
      styles = 'bg-amber-50 text-amber-700 ring-amber-600/20';
      dotColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
      break;
    case 'Ausstehend':
      styles = 'bg-slate-50 text-slate-700 ring-slate-600/20';
      dotColor = 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]';
      break;
    default:
      styles = 'bg-slate-50 text-slate-700 ring-slate-600/20';
      dotColor = 'bg-slate-500';
  }

  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[13px] font-medium ring-1 ring-inset ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      {status}
    </span>
  );
};

export default function App() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile sidebar if window resizes to desktop view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] font-sans text-slate-900 overflow-hidden selection:bg-red-100 selection:text-red-900">
      
      {/* MOBILE OVERLAY */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`
          fixed md:relative inset-y-0 left-0 z-50 
          bg-white/90 backdrop-blur-2xl border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]
          transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isExpanded ? 'w-72' : 'w-[84px]'}
        `}
      >
        {/* Toggle Button (Desktop only) */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="hidden md:flex absolute -right-3.5 top-8 w-7 h-7 bg-white border border-slate-200 shadow-sm rounded-full items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-200 transition-all z-50 hover:scale-105"
        >
          {isExpanded ? <ChevronLeft size={16} strokeWidth={2.5} /> : <ChevronRight size={16} strokeWidth={2.5} />}
        </button>

        {/* Mobile Close Button */}
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden absolute right-4 top-5 text-slate-400 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        {/* Logo Area */}
        <div className={`h-[72px] flex items-center shrink-0 transition-all duration-300 ${isExpanded ? 'px-6' : 'px-0 justify-center'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)] shrink-0">
              <CarFront size={20} strokeWidth={2.5} />
            </div>
            <span className={`font-bold text-xl tracking-tight text-slate-900 transition-all duration-300 whitespace-nowrap overflow-hidden ${isExpanded ? 'w-[120px] opacity-100' : 'w-0 opacity-0'}`}>
              HoppDrive
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-4 space-y-1.5 custom-scrollbar">
          <div className={`px-2 mb-4 text-[11px] font-bold tracking-widest text-slate-400 uppercase transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 mb-0 overflow-hidden'}`}>
            Hauptmenü
          </div>
          
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href="#"
                className={`relative flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group overflow-hidden ${
                  item.active 
                    ? 'text-red-700 font-medium' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title={!isExpanded ? item.name : undefined}
              >
                {/* Active States Backgrounds */}
                {item.active && (
                  <>
                    <div className="absolute inset-0 bg-red-50 opacity-80 rounded-xl"></div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-red-600 rounded-r-full"></div>
                  </>
                )}
                
                {/* Hover Background */}
                {!item.active && (
                  <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl -z-10"></div>
                )}

                <div className={`flex items-center z-10 ${isExpanded ? '' : 'mx-auto'}`}>
                  <Icon 
                    className={`w-5 h-5 shrink-0 transition-all duration-300 ${item.active ? 'text-red-600 drop-shadow-sm' : 'text-slate-400 group-hover:text-slate-600 group-hover:scale-110'}`} 
                    strokeWidth={item.active ? 2.5 : 2} 
                  />
                  <span className={`transition-all duration-300 whitespace-nowrap ${isExpanded ? 'ml-3 w-auto opacity-100 translate-x-0' : 'ml-0 w-0 opacity-0 -translate-x-4 hidden'}`}>
                    {item.name}
                  </span>
                </div>
              </a>
            );
          })}
        </nav>

        {/* User Area */}
        <div className="p-4 shrink-0">
          <div className={`flex items-center border border-slate-200/60 shadow-sm transition-all duration-300 overflow-hidden ${isExpanded ? 'p-3 bg-white rounded-2xl justify-between' : 'p-2 bg-transparent border-transparent justify-center'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200 ring-2 ring-white transition-all ${!isExpanded && 'hover:ring-red-100 cursor-pointer'}`}>
                A
              </div>
              <div className={`flex flex-col truncate transition-all duration-300 ${isExpanded ? 'w-[100px] opacity-100' : 'w-0 opacity-0 hidden'}`}>
                <span className="text-sm font-semibold text-slate-900 truncate">Admin</span>
                <span className="text-[11px] text-slate-500 truncate">HoppDrive</span>
              </div>
            </div>
            
            {isExpanded && (
              <button className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header - Glassmorphism */}
        <header className="h-[72px] bg-white/70 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30 sticky top-0 supports-[backdrop-filter]:bg-white/40">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden text-slate-500 hover:text-slate-900 p-2 -ml-2 rounded-lg hover:bg-slate-100/50 transition-colors"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center text-sm text-slate-500 hidden sm:flex">
              <span className="hover:text-slate-800 cursor-pointer transition-colors">HoppDrive</span>
              <ChevronRight size={14} className="mx-1.5 text-slate-300" />
              <span className="text-slate-900 font-medium bg-slate-100 px-2 py-1 rounded-md">Übersicht</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="relative hidden lg:block group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Schnellsuche..." 
                className="pl-9 pr-4 py-2 bg-slate-100/50 border border-transparent rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-400 w-64 transition-all placeholder:text-slate-400 shadow-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded shrink-0">⌘</kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded shrink-0">K</kbd>
              </div>
            </div>
            
            <div className="h-5 w-px bg-slate-200 mx-2 hidden sm:block"></div>
            
            <button className="relative p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100/50 rounded-lg transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white shadow-sm"></span>
            </button>
            
            <button className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100/50 rounded-lg transition-all">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
            
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Übersicht</h1>
                <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  System läuft reibungslos • Zuletzt aktualisiert um 12:11
                </p>
              </div>
              <button className="hidden sm:flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:shadow-sm transition-all active:scale-95">
                <FileText size={16} />
                Bericht exportieren
              </button>
            </div>

            {/* Premium KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
              {kpiData.map((kpi, index) => {
                const Icon = kpi.icon;
                return (
                  <div 
                    key={index} 
                    className="group bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden cursor-default"
                  >
                    {/* Subtle top glow line */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <p className="text-sm font-semibold text-slate-500">{kpi.title}</p>
                      <div className="p-2 bg-slate-50 ring-1 ring-slate-100 rounded-xl text-slate-400 group-hover:text-red-600 group-hover:bg-red-50/50 group-hover:ring-red-100 transition-all duration-300">
                        <Icon size={18} strokeWidth={2.5} />
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{kpi.value}</h3>
                    </div>

                    <div className="mt-4 h-5 flex items-center">
                      {kpi.trend ? (
                        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md ${kpi.trendUp ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-600/10' : 'text-slate-600 bg-slate-50 ring-1 ring-slate-600/10'}`}>
                          {kpi.trendUp && <TrendingUp size={14} strokeWidth={2.5} />}
                          {kpi.trend}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-medium">Keine Änderung</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sleek Table Section */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden">
              <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-white">
                <h2 className="text-base font-bold text-slate-900">Aktuelle Anfragen</h2>
                <button className="text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors hover:underline underline-offset-4">
                  Alle ansehen
                  <ArrowUpRight size={16} />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">Kunde</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">Kontakt</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">Fahrzeug</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">Status</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">Datum</th>
                      <th className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tableData.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-sm text-slate-900">{row.name}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {row.email}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                          {row.vehicle}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {row.date}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-slate-400 hover:text-slate-900 transition-colors p-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <MoreHorizontal size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Global styles for custom scrollbar hidden in normal classes */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.2);
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.4);
        }
      `}} />
    </div>
  );
}