// Predefined color palette for user avatars
// Each color includes a gradient and complementary text color
export const userColorPalette = [
  {
    id: 'indigo',
    name: 'Indigo',
    gradient: 'from-indigo-500 to-indigo-600',
    bgDark: 'from-indigo-500 to-purple-600',
    hexColor: '#4f46e5',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    gradient: 'from-emerald-500 to-emerald-600',
    bgDark: 'from-emerald-500 to-teal-600',
    hexColor: '#10b981',
  },
  {
    id: 'rose',
    name: 'Rose',
    gradient: 'from-rose-500 to-rose-600',
    bgDark: 'from-rose-500 to-pink-600',
    hexColor: '#f43f5e',
  },
  {
    id: 'amber',
    name: 'Amber',
    gradient: 'from-amber-500 to-amber-600',
    bgDark: 'from-amber-500 to-orange-600',
    hexColor: '#f59e0b',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    gradient: 'from-cyan-500 to-cyan-600',
    bgDark: 'from-cyan-500 to-blue-600',
    hexColor: '#06b6d4',
  },
  {
    id: 'purple',
    name: 'Purple',
    gradient: 'from-purple-500 to-purple-600',
    bgDark: 'from-purple-500 to-pink-600',
    hexColor: '#a855f7',
  },
  {
    id: 'lime',
    name: 'Lime',
    gradient: 'from-lime-500 to-lime-600',
    bgDark: 'from-lime-500 to-green-600',
    hexColor: '#84cc16',
  },
  {
    id: 'orange',
    name: 'Orange',
    gradient: 'from-orange-500 to-orange-600',
    bgDark: 'from-orange-500 to-red-600',
    hexColor: '#f97316',
  },
];

/**
 * Get a consistent color for a user based on their ID
 * Uses the user ID to deterministically select a color from the palette
 */
export function getUserColor(userId: string): (typeof userColorPalette)[number] {
  // Hash the user ID to get a consistent index
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % userColorPalette.length;
  return userColorPalette[index];
}

/**
 * Get color by ID
 */
export function getColorById(colorId: string) {
  return userColorPalette.find((c) => c.id === colorId) || getUserColor('default');
}

/**
 * Get the Tailwind class for a user's avatar background (dark theme)
 */
export function getUserAvatarClass(userId: string): string {
  const color = getUserColor(userId);
  return `bg-gradient-to-br ${color.bgDark}`;
}

/**
 * Get avatar class by color ID
 */
export function getAvatarClassByColorId(colorId: string): string {
  const color = getColorById(colorId);
  return `bg-gradient-to-br ${color.bgDark}`;
}
