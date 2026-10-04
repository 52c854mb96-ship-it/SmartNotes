/** Logoen (samme motiv som app-ikonet). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden focusable="false" className="logo">
      <rect width="512" height="512" rx="116" fill="#1F5FAD" />
      <rect x="128" y="112" width="244" height="308" rx="30" fill="#0B2F5C" opacity=".32" transform="translate(9 12)" />
      <rect x="128" y="112" width="244" height="308" rx="30" fill="#fff" />
      <path
        d="M308 178H192l66 88-66 88h116"
        fill="none"
        stroke="#1F5FAD"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M376 62Q382 106 424 112Q382 118 376 162Q370 118 328 112Q370 106 376 62Z"
        fill="#F4B740"
        stroke="#1F5FAD"
        strokeWidth="12"
        strokeLinejoin="round"
      />
    </svg>
  );
}
