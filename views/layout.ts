import type { JwtPayload } from "../lib/auth.ts";

export type User = JwtPayload;

export function esc(str: any): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function publicLayout(title: string, content: string, user?: User | null): string {
  const loginButton = user
    ? `<a href="/admin" class="flex items-center gap-2 bg-stone-900/80 hover:bg-violet-900/30 text-violet-400 text-[10px] font-bold px-4 py-2 rounded-xl border border-violet-500/20 transition-all duration-300 font-rpg tracking-widest uppercase shadow-[0_0_15px_rgba(139,92,246,0.1)]">
        <span class="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
        <span>${esc(user.username)}</span>
      </a>`
    : `<a href="/auth/login"
          class="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold px-5 py-2.5 rounded-xl border border-violet-400/30 transition-all duration-300 font-rpg tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] active:scale-95">
          ⚔️ Login
        </a>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Nightcore</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Exo+2:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style type="text/tailwindcss">
    @layer base {
      ::-webkit-scrollbar { @apply w-1.5; }
      ::-webkit-scrollbar-track { @apply bg-[#0B0D13]; }
      ::-webkit-scrollbar-thumb { @apply bg-stone-800 rounded-full hover:bg-violet-600 transition; }
      
      body { 
        @apply bg-[#0B0D13] text-stone-300 min-h-screen selection:bg-violet-500/40 overflow-x-hidden;
        font-family: 'Inter', sans-serif;
      }
      
      h1, h2, h3, .font-rpg { font-family: 'Orbitron', sans-serif; }
      .font-subtitle { font-family: 'Exo 2', sans-serif; }
    }

    .neon-border { @apply border border-white/10 shadow-[0_0_20px_rgba(139,92,246,0.1)]; }
    .neon-text-violet { @apply text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]; }
    .neon-text-pink { @apply text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]; }
    .neon-text-cyan { @apply text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]; }
    .neon-text-green { @apply text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]; }
    .neon-text-orange { @apply text-orange-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]; }
    
    .neon-glow-violet { @apply shadow-[0_0_30px_rgba(139,92,246,0.15)] border border-violet-500/20; }
    .neon-glow-pink { @apply shadow-[0_0_30px_rgba(236,72,153,0.15)] border border-pink-500/20; }
    .neon-glow-cyan { @apply shadow-[0_0_30px_rgba(6,182,212,0.15)] border border-cyan-500/20; }
    .neon-glow-green { @apply shadow-[0_0_30px_rgba(34,197,94,0.15)] border border-green-500/20; }
    
    .glass-panel { @apply bg-[#11131A]/60 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-[2.5rem]; }
    
    .btn-primary { @apply bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-95; }
    .btn-secondary { @apply bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all active:scale-95; }

    .prose h1 { @apply text-3xl font-bold text-white mt-8 mb-6 font-rpg tracking-widest uppercase; }
    .prose h2 { @apply text-2xl font-bold text-stone-100 mt-6 mb-4 font-rpg tracking-widest uppercase border-l-4 border-violet-600 pl-4; }
    .prose h3 { @apply text-xl font-semibold text-violet-400 mt-5 mb-3 font-subtitle tracking-wider uppercase; }
    .prose p  { @apply text-stone-400 mb-5 leading-relaxed text-base; }
    .prose ul { @apply list-disc list-inside text-stone-400 mb-4 space-y-2; }
    .prose ol { @apply list-decimal list-inside text-stone-400 mb-4 space-y-2; }
    .prose code { @apply bg-stone-900 text-violet-400 px-2 py-1 rounded border border-violet-900/30 text-sm font-mono; }
    .prose pre  { @apply bg-[#0B0D13] border border-white/5 rounded-2xl p-5 mb-5 overflow-x-auto shadow-inner; }
    .prose a { @apply text-violet-400 hover:text-violet-300 transition-colors underline decoration-violet-900/50 underline-offset-4; }
    .prose blockquote { @apply border-l-4 border-violet-600 bg-violet-600/5 pl-5 py-3 pr-5 text-stone-500 italic my-4 rounded-r-2xl; }

    /* Mobile menu animation */
    #mobile-menu { max-height: 0; overflow: hidden; transition: max-height 0.35s ease, opacity 0.3s ease; opacity: 0; }
    #mobile-menu.open { max-height: 400px; opacity: 1; }
    .hamburger-line { @apply block w-6 h-0.5 bg-stone-400 rounded-full transition-all duration-300; }
    #menu-btn.open .hamburger-line:nth-child(1) { transform: translateY(6px) rotate(45deg); @apply bg-violet-400; }
    #menu-btn.open .hamburger-line:nth-child(2) { opacity: 0; }
    #menu-btn.open .hamburger-line:nth-child(3) { transform: translateY(-6px) rotate(-45deg); @apply bg-violet-400; }
  </style>
</head>
<body class="bg-[#0B0D13] overflow-x-hidden">
  <!-- Background Elements -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden -z-10">
    <div class="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full animate-pulse"></div>
    <div class="absolute -bottom-[20%] -left-[10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[100px] rounded-full"></div>
  </div>

  <nav class="bg-[#0B0D13]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 shadow-2xl">
    <div class="max-w-6xl mx-auto px-4 md:px-6">
      <div class="flex items-center justify-between h-16 md:h-auto md:py-4">
        <!-- Logo -->
        <a href="/" class="group flex items-center gap-3">
          <div class="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)] group-hover:scale-110 transition-all duration-300">
            <span class="text-lg md:text-xl">🛡️</span>
          </div>
          <span class="text-lg md:text-2xl font-bold text-white font-rpg tracking-[0.2em] uppercase group-hover:text-violet-400 transition-colors">Nightcore</span>
        </a>

        <!-- Desktop nav links -->
        <div class="hidden md:flex items-center gap-8 text-[11px] font-rpg tracking-[0.3em] uppercase font-bold text-stone-500">
          <a href="/" class="hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all">Inicio</a>
          <a href="/guias" class="hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all">Pergaminos</a>
          <a href="/ausencias" class="hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all">Ausencias</a>
          <a href="/jugadores" class="hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all">Jugadores</a>
        </div>

        <!-- Right side: login + hamburger -->
        <div class="flex items-center gap-3">
          ${loginButton}
          <!-- Hamburger (mobile only) -->
          <button id="menu-btn" class="md:hidden flex flex-col gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-all" aria-label="Menu">
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>
        </div>
      </div>

      <!-- Mobile dropdown menu -->
      <div id="mobile-menu" class="md:hidden border-t border-white/5">
        <div class="flex flex-col py-4 gap-1">
          <a href="/" class="flex items-center gap-3 px-4 py-3 rounded-xl text-stone-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-rpg uppercase tracking-[0.3em] font-bold">
            🏠 <span>Inicio</span>
          </a>
          <a href="/guias" class="flex items-center gap-3 px-4 py-3 rounded-xl text-stone-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-rpg uppercase tracking-[0.3em] font-bold">
            📖 <span>Pergaminos</span>
          </a>
          <a href="/ausencias" class="flex items-center gap-3 px-4 py-3 rounded-xl text-stone-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-rpg uppercase tracking-[0.3em] font-bold">
            📥 <span>Ausencias</span>
          </a>
          <a href="/jugadores" class="flex items-center gap-3 px-4 py-3 rounded-xl text-stone-400 hover:text-white hover:bg-white/5 transition-all text-[11px] font-rpg uppercase tracking-[0.3em] font-bold">
            ⚔️ <span>Jugadores</span>
          </a>
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
    ${content}
  </main>
  
  <footer class="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 border-t border-white/5 text-center">
    <p class="text-[10px] font-rpg tracking-[0.3em] uppercase text-stone-600">© 2026 Nightcore Clan • Forjando Leyendas</p>
  </footer>

  <script>
    const btn = document.getElementById('menu-btn');
    const menu = document.getElementById('mobile-menu');
    btn?.addEventListener('click', () => {
      btn.classList.toggle('open');
      menu?.classList.toggle('open');
    });
    // Close menu on link click
    menu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      btn?.classList.remove('open');
      menu.classList.remove('open');
    }));
  </script>
</body>
</html>`;
}

export function adminLayout(title: string, content: string, user: User, currentPath?: string): string {
  const navItems = [
    { href: "/admin", label: "Panel Central", icon: "📊" },
  ];

  if (user.role !== "escudero") {
    navItems.push({ href: "/admin/miembros", label: "Miembros", icon: "👥" });
    navItems.push({ href: "/admin/reportes", label: "Reportes", icon: "📢" });
  }

  navItems.push({ href: "/admin/whitelist", label: "Whitelist", icon: "🛡️" });
  navItems.push({ href: "/admin/ausencias", label: "Ausencias", icon: "📥" });
  navItems.push({ href: "/admin/eventos", label: "Eventos", icon: "🎯" });
  navItems.push({ href: "/admin/guias", label: "Pergaminos", icon: "📖" });

  if (user.role !== "escudero") {
    navItems.push({ href: "/admin/alters", label: "Alters", icon: "🔀" });
  }

  if (user.role === "superadmin") {
    navItems.push({ href: "/admin/usuarios", label: "Usuarios", icon: "🔑" });
  }

  const nav = navItems
    .map((item) => {
      const isActive = currentPath === item.href || (item.href !== "/admin" && currentPath?.startsWith(item.href));
      return `
    <a href="${item.href}" onclick="closeSidebar()" class="group flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive ? "bg-violet-600/10 text-violet-400 border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]" : "text-stone-500 hover:text-stone-200 hover:bg-white/5 border border-transparent"}">
      <span class="text-lg group-hover:scale-120 transition-transform duration-300">${item.icon}</span>
      <span class="font-rpg tracking-[0.2em] uppercase text-[10px] font-bold">${item.label}</span>
      ${isActive ? `<div class="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,1)]"></div>` : ""}
    </a>`;
    })
    .join("");

  const roleColors: Record<string, string> = {
    superadmin: "text-fuchsia-400 shadow-[0_0_10px_rgba(192,38,211,0.3)]",
    diputado: "text-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.3)]",
    escudero: "text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]",
  };
  const roleColor = roleColors[user.role] ?? "text-stone-400";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Admin Nightcore</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Exo+2:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style type="text/tailwindcss">
    @layer base {
      ::-webkit-scrollbar { @apply w-1.5; }
      ::-webkit-scrollbar-track { @apply bg-[#0B0D13]; }
      ::-webkit-scrollbar-thumb { @apply bg-stone-800 rounded-full hover:bg-violet-600 transition; }
      
      body { 
        @apply bg-[#0B0D13] text-stone-300 min-h-screen selection:bg-violet-500/40;
        font-family: 'Inter', sans-serif;
      }
      
      h1, h2, h3, .font-rpg { font-family: 'Orbitron', sans-serif; }
      .font-subtitle { font-family: 'Exo 2', sans-serif; }
    }
    
    .neon-border { @apply border border-white/10 shadow-[0_0_20px_rgba(139,92,246,0.1)]; }
    .neon-text-violet { @apply text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]; }
    .neon-text-pink { @apply text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]; }
    .neon-text-cyan { @apply text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]; }
    .neon-text-green { @apply text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]; }
    .neon-text-orange { @apply text-orange-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]; }
    
    .neon-glow-violet { @apply shadow-[0_0_30px_rgba(139,92,246,0.15)] border border-violet-500/20; }
    .neon-glow-pink { @apply shadow-[0_0_30px_rgba(236,72,153,0.15)] border border-pink-500/20; }
    .neon-glow-cyan { @apply shadow-[0_0_30px_rgba(6,182,212,0.15)] border border-cyan-500/20; }
    .neon-glow-green { @apply shadow-[0_0_30px_rgba(34,197,94,0.15)] border border-green-500/20; }
    
    .glass-panel { @apply bg-[#11131A]/60 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-[2.5rem]; }
    .glass-sidebar { @apply bg-[#0D0F16] border-r border-white/5 backdrop-blur-2xl; }
    
    .btn-primary { @apply bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-95; }
    .btn-secondary { @apply bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all active:scale-95; }

    /* Sidebar mobile transitions */
    #admin-sidebar {
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    }
    #sidebar-overlay {
      transition: opacity 0.3s ease;
    }
    .hamburger-line { @apply block w-5 h-0.5 bg-stone-400 rounded-full transition-all duration-300; }
    #admin-menu-btn.open .hamburger-line:nth-child(1) { transform: translateY(6px) rotate(45deg); @apply bg-violet-400; }
    #admin-menu-btn.open .hamburger-line:nth-child(2) { opacity: 0; }
    #admin-menu-btn.open .hamburger-line:nth-child(3) { transform: translateY(-6px) rotate(-45deg); @apply bg-violet-400; }
  </style>
</head>
<body class="bg-[#0B0D13] overflow-x-hidden">
  <!-- Background Elements -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden -z-10">
    <div class="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full animate-pulse"></div>
    <div class="absolute -bottom-[20%] -left-[10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[100px] rounded-full"></div>
  </div>

  <!-- Sidebar Overlay (mobile only) -->
  <div id="sidebar-overlay" class="fixed inset-0 bg-black/60 z-40 opacity-0 pointer-events-none lg:hidden" onclick="closeSidebar()"></div>

  <!-- Sidebar -->
  <aside id="admin-sidebar" class="w-72 glass-sidebar flex flex-col h-screen fixed top-0 left-0 shadow-[20px_0_40px_rgba(0,0,0,0.4)] z-50 -translate-x-full lg:translate-x-0">
    <div class="p-6 md:p-8 border-b border-white/5 mb-4 md:mb-6">
      <a href="/" class="flex items-center gap-3 group">
        <div class="w-10 h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)] group-hover:scale-105 transition-transform">
          <span class="text-xl">🛡️</span>
        </div>
        <div>
          <span class="text-xl font-bold text-white font-rpg tracking-widest uppercase block">Nightcore</span>
          <span class="text-[8px] text-stone-500 font-rpg tracking-[0.4em] uppercase block mt-0.5">Admin Panel</span>
        </div>
      </a>
    </div>

    <nav class="flex-1 px-4 flex flex-col gap-1.5 overflow-y-auto">
      <a href="/" onclick="closeSidebar()" class="flex items-center gap-4 px-4 py-3 rounded-xl text-stone-500 hover:text-white hover:bg-white/5 transition-all text-[10px] font-rpg uppercase tracking-[0.3em] mb-4 border-b border-white/5 pb-6">
        <span class="text-base">🏠</span>
        <span>Volver al Portal</span>
      </a>
      ${nav}
    </nav>

    <div class="p-6 md:p-8 border-t border-white/5 bg-black/20">
      <div class="flex items-center gap-4 mb-4 md:mb-6">
        <div class="w-10 h-10 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center text-stone-400 font-bold font-rpg">
          ${user.username[0].toUpperCase()}
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-white truncate font-rpg tracking-wider uppercase">${esc(user.username)}</p>
          <p class="text-[9px] ${roleColor.split(' ')[0]} font-rpg tracking-[0.2em] uppercase font-bold mt-0.5">${esc(user.role)}</p>
        </div>
      </div>
      <a href="/auth/logout" class="flex items-center gap-3 px-4 py-3 rounded-xl text-stone-600 hover:text-red-400 hover:bg-red-400/5 border border-transparent hover:border-red-400/20 transition-all text-[9px] font-rpg uppercase tracking-[0.3em] font-bold">
        <span>🚪</span><span>Abandonar</span>
      </a>
    </div>
  </aside>

  <!-- Main Content -->
  <div class="lg:ml-72 flex-1 min-h-screen relative flex flex-col">
    <div class="absolute top-0 right-0 w-[40%] h-[40%] bg-violet-600/5 blur-[100px] pointer-events-none -z-10"></div>
    
    <!-- Top header -->
    <header class="h-16 md:h-24 px-4 md:px-12 flex items-center justify-between border-b border-white/5 bg-[#0B0D13]/50 backdrop-blur-sm sticky top-0 z-40">
      <!-- Hamburger (mobile/tablet) -->
      <button id="admin-menu-btn" onclick="openSidebar()" class="flex lg:hidden flex-col gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-all mr-4" aria-label="Menu">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
      <h1 class="text-base md:text-2xl font-bold text-white tracking-[0.2em] md:tracking-[0.3em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] truncate">${esc(title)}</h1>
    </header>

    <div class="p-4 md:p-12 max-w-7xl w-full">
      ${content}
    </div>
  </div>

  <script>
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('admin-menu-btn');

    function openSidebar() {
      sidebar?.classList.remove('-translate-x-full');
      overlay?.classList.remove('opacity-0', 'pointer-events-none');
      overlay?.classList.add('opacity-100');
      menuBtn?.classList.add('open');
    }

    function closeSidebar() {
      sidebar?.classList.add('-translate-x-full');
      overlay?.classList.add('opacity-0', 'pointer-events-none');
      overlay?.classList.remove('opacity-100');
      menuBtn?.classList.remove('open');
    }

    // Close sidebar on escape key
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
  </script>
</body>
</html>`;
}
