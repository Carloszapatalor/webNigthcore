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
    ? `<a href="/admin" class="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-700 transition">
        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        <span>${esc(user.username)}</span>
      </a>`
    : `<a href="/auth/login"
          class="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-500 transition shadow shadow-purple-900/40">
          ⚔️ Login
        </a>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Clan Nightcore</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style type="text/tailwindcss">
    @layer base {
      ::-webkit-scrollbar { @apply w-2; }
      ::-webkit-scrollbar-track { @apply bg-stone-950; }
      ::-webkit-scrollbar-thumb { @apply bg-stone-800 rounded-full hover:bg-stone-700 transition; }
      h1, h2, h3, .font-rpg { font-family: 'Cinzel', serif; }
      body { font-family: 'Merriweather', serif; }
    }
    .prose h1 { @apply text-3xl font-bold text-stone-100 mt-8 mb-4 font-rpg tracking-wider uppercase; }
    .prose h2 { @apply text-2xl font-bold text-stone-200 mt-6 mb-3 font-rpg tracking-wider uppercase; }
    .prose h3 { @apply text-xl font-semibold text-stone-300 mt-5 mb-2 font-rpg tracking-wider; }
    .prose p  { @apply text-stone-300 mb-4 leading-relaxed text-base; }
    .prose ul { @apply list-disc list-inside text-stone-300 mb-3 space-y-1; }
    .prose ol { @apply list-decimal list-inside text-stone-300 mb-3 space-y-1; }
    .prose code { @apply bg-stone-900 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-900/30 text-sm font-mono; }
    .prose pre  { @apply bg-stone-900 border border-yellow-900/30 rounded-lg p-4 mb-3 overflow-x-auto shadow-inner; }
    .prose pre code { @apply bg-transparent border-0 p-0 text-stone-300; }
    .prose a { @apply text-yellow-500 hover:text-yellow-400 underline; }
    .prose blockquote { @apply border-l-4 border-yellow-700 bg-stone-900/50 pl-4 py-2 pr-4 text-stone-400 italic my-3 rounded-r-lg; }
    .prose hr { @apply border-yellow-900/30 my-6; }
    .prose table { @apply w-full border-collapse text-sm mb-4; }
    .prose th { @apply bg-stone-900 text-stone-300 px-3 py-2 text-left border border-yellow-900/30 font-rpg tracking-wider uppercase; }
    .prose td { @apply text-stone-300 px-3 py-2 border border-yellow-900/30; }
  </style>
</head>
<body class="bg-stone-950 text-stone-200 min-h-screen selection:bg-yellow-500/30 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-stone-900/40 via-stone-950 to-stone-950">
  <nav class="bg-stone-900/90 backdrop-blur-md border-b border-yellow-900/20 sticky top-0 z-50 shadow-xl">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="text-yellow-500 font-bold text-xl font-rpg tracking-widest uppercase hover:scale-105 hover:text-yellow-400 transition-all drop-shadow-md">⚔️ Nightcore</a>
      <div class="flex items-center gap-6 text-sm font-rpg tracking-widest uppercase">
        <a href="/" class="text-stone-300 hover:text-yellow-500 transition">Inicio</a>
        <a href="/guias" class="text-stone-300 hover:text-yellow-500 transition">Guías</a>
        <a href="/ausencias" class="text-stone-300 hover:text-yellow-500 transition">Ausencias</a>
        <a href="/jugadores" class="text-stone-300 hover:text-yellow-500 transition">Jugadores</a>
        ${loginButton}
      </div>
    </div>
  </nav>
  <main class="max-w-5xl mx-auto px-4 py-8">
    ${content}
  </main>
</body>
</html>`;
}

export function adminLayout(title: string, content: string, user: User, currentPath?: string): string {
  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
  ];

  if (user.role !== "escudero") {
    navItems.push({ href: "/admin/miembros", label: "Miembros", icon: "👥" });
    navItems.push({ href: "/admin/reportes", label: "Reportes", icon: "📢" });
  }

  navItems.push({ href: "/admin/whitelist", label: "Whitelist", icon: "🛡️" });
  navItems.push({ href: "/admin/ausencias", label: "Ausencias", icon: "📥" });
  navItems.push({ href: "/admin/eventos", label: "Eventos", icon: "🎯" });
  navItems.push({ href: "/admin/guias", label: "Guías", icon: "📖" });

  if (user.role !== "escudero") {
    navItems.push({ href: "/admin/alters", label: "Alters", icon: "🔀" });
  }

  if (user.role === "superadmin") {
    navItems.push({ href: "/admin/usuarios", label: "Usuarios", icon: "🔑" });
  }

  const nav = navItems
    .map(
      (item) => {
        const isActive = currentPath === item.href || (item.href !== "/admin" && currentPath?.startsWith(item.href));
        return `
    <a href="${item.href}" class="flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm ${isActive ? "bg-yellow-900/20 text-yellow-500 border border-yellow-800/50 shadow-inner" : "text-stone-400 hover:text-white hover:bg-stone-800"
          }">
      <span>${item.icon}</span>
      <span class="font-rpg tracking-wider uppercase text-xs">${item.label}</span>
    </a>`;
      }
    )
    .join("");

  const roleColors: Record<string, string> = {
    superadmin: "text-purple-400",
    diputado: "text-cyan-400",
    escudero: "text-amber-600",
  };
  const roleColor = roleColors[user.role] ?? "text-stone-400";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Admin Nightcore</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style type="text/tailwindcss">
    @layer base {
      ::-webkit-scrollbar { @apply w-2; }
      ::-webkit-scrollbar-track { @apply bg-stone-950; }
      ::-webkit-scrollbar-thumb { @apply bg-stone-800 rounded-full hover:bg-stone-700 transition; }
      h1, h2, h3, .font-rpg { font-family: 'Cinzel', serif; }
      body { font-family: 'Merriweather', serif; }
    }
  </style>
</head>
<body class="bg-stone-950 text-stone-200 min-h-screen flex selection:bg-yellow-500/30">
  <aside class="w-64 bg-stone-900 border-r border-yellow-900/20 flex flex-col min-h-screen fixed top-0 left-0 shadow-2xl">
    <div class="p-6 border-b border-yellow-900/20 bg-black/20">
      <a href="/" class="text-yellow-500 font-bold text-xl font-rpg tracking-widest uppercase drop-shadow-md">⚔️ Nightcore</a>
      <p class="text-[10px] text-stone-500 mt-1 uppercase tracking-widest font-rpg">Panel del Clan</p>
    </div>
    <nav class="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
      <a href="/" class="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition text-xs font-rpg uppercase tracking-widest mb-4 border-b border-yellow-900/10 pb-4 rounded-none">
        <span>🏠</span>
        <span>Ir al Home</span>
      </a>
      ${nav}
    </nav>
    <div class="p-6 border-t border-yellow-900/20 bg-black/30">
      <p class="text-sm text-stone-300 mb-1 px-3 font-bold font-rpg uppercase tracking-wider">${esc(user.username)}</p>
      <p class="text-xs ${roleColor} mb-4 px-3 font-rpg uppercase tracking-widest font-bold">${esc(user.role)}</p>
      <a href="/auth/logout" class="flex items-center gap-2 px-3 py-2 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition text-xs font-rpg uppercase tracking-widest">
        <span>🚪</span><span>Cerrar sesión</span>
      </a>
    </div>
  </aside>
  <div class="ml-64 flex-1 p-10 min-h-screen bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-stone-900/50 via-stone-950 to-stone-950">
    <h1 class="text-3xl font-bold text-white mb-8 tracking-wider uppercase">${esc(title)}</h1>
    ${content}
  </div>
</body>
</html>`;
}
