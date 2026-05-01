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

export function publicLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Clan Nightcore</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style type="text/tailwindcss">
    .prose h1 { @apply text-2xl font-bold text-white mt-6 mb-3; }
    .prose h2 { @apply text-xl font-bold text-white mt-5 mb-2; }
    .prose h3 { @apply text-lg font-semibold text-gray-200 mt-4 mb-2; }
    .prose p  { @apply text-gray-300 mb-3 leading-relaxed; }
    .prose ul { @apply list-disc list-inside text-gray-300 mb-3 space-y-1; }
    .prose ol { @apply list-decimal list-inside text-gray-300 mb-3 space-y-1; }
    .prose code { @apply bg-gray-800 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono; }
    .prose pre  { @apply bg-gray-800 rounded-lg p-4 mb-3 overflow-x-auto; }
    .prose pre code { @apply bg-transparent p-0; }
    .prose a { @apply text-purple-400 hover:text-purple-300 underline; }
    .prose blockquote { @apply border-l-4 border-purple-700 pl-4 text-gray-400 italic my-3; }
    .prose hr { @apply border-gray-700 my-6; }
    .prose table { @apply w-full border-collapse text-sm mb-4; }
    .prose th { @apply bg-gray-800 text-gray-300 px-3 py-2 text-left border border-gray-700; }
    .prose td { @apply text-gray-300 px-3 py-2 border border-gray-700; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <nav class="bg-gray-900 border-b border-gray-800">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="text-purple-400 font-bold text-xl tracking-wide">⚔️ Nightcore</a>
      <div class="flex items-center gap-6 text-sm">
        <a href="/" class="text-gray-300 hover:text-purple-400 transition">Inicio</a>
        <a href="/guias" class="text-gray-300 hover:text-purple-400 transition">Guías</a>
        <a href="/auth/login"
          class="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-500 transition shadow shadow-purple-900/40">
          ⚔️ Login
        </a>
      </div>
    </div>
  </nav>
  <main class="max-w-5xl mx-auto px-4 py-8">
    ${content}
  </main>
</body>
</html>`;
}

export function adminLayout(title: string, content: string, user: User): string {
  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/miembros", label: "Miembros", icon: "👥" },
    { href: "/admin/whitelist", label: "Whitelist", icon: "🛡️" },
    { href: "/admin/eventos", label: "Eventos", icon: "🎯" },
    { href: "/admin/guias", label: "Guías", icon: "📖" },
    { href: "/admin/alters", label: "Alters", icon: "🔀" },
  ];

  if (user.role === "superadmin" || user.role === "admin") {
    navItems.push({ href: "/admin/usuarios", label: "Usuarios", icon: "🔑" });
  }

  const nav = navItems
    .map(
      (item) => `
    <a href="${item.href}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition text-sm">
      <span>${item.icon}</span>
      <span>${item.label}</span>
    </a>`
    )
    .join("");

  const roleColors: Record<string, string> = {
    superadmin: "text-purple-400",
    admin: "text-blue-400",
    diputado: "text-cyan-400",
  };
  const roleColor = roleColors[user.role] ?? "text-gray-400";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Admin Nightcore</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex">
  <aside class="w-56 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen fixed top-0 left-0">
    <div class="p-4 border-b border-gray-800">
      <a href="/" class="text-purple-400 font-bold text-lg">⚔️ Nightcore</a>
      <p class="text-xs text-gray-500 mt-0.5">Panel Admin</p>
    </div>
    <nav class="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
      ${nav}
    </nav>
    <div class="p-3 border-t border-gray-800">
      <p class="text-xs text-gray-300 mb-0.5 px-3 font-medium">${esc(user.username)}</p>
      <p class="text-xs ${roleColor} mb-2 px-3">${esc(user.role)}</p>
      <a href="/auth/logout" class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition text-sm">
        <span>🚪</span><span>Cerrar sesión</span>
      </a>
    </div>
  </aside>
  <div class="ml-56 flex-1 p-8 min-h-screen">
    <h1 class="text-2xl font-bold text-white mb-6">${esc(title)}</h1>
    ${content}
  </div>
</body>
</html>`;
}
