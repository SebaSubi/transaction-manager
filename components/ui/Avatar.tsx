/** Initial-based avatar; the household has no uploaded images. */
export function Avatar({ name, color }: { name: string; color?: string }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("es-AR");

  return (
    <span
      className="avatar"
      aria-hidden
      style={color === undefined ? undefined : { background: color }}
    >
      {initial}
    </span>
  );
}
