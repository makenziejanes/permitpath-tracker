// Placeholder mark. Swap in the real PermitPath "City Badge" logo at /public/logo.svg and update this component.
export default function Badge({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="badge">
      <path d="M20 2l15 5.5v11c0 9.5-6.4 16.4-15 19.5C11.4 34.9 5 28 5 18.5v-11z" className="badge-shield" />
      <path d="M12 28V18h5v10M17 28V12h6v16M23 28V16h5v12" className="badge-city" />
      <path d="M10 28.5h20" className="badge-city" />
    </svg>
  );
}
