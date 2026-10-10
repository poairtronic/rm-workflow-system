
interface VelanLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  color?: string;
}

export function VelanLogo({
  className = '',
  width = 68,
  height = 54,
  color = '#4A5568', // Slate corporate print gray
}: VelanLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 80"
      width={width}
      height={height}
      className={className}
      fill="none"
    >
      {/* 
        Shape 1: Top Symmetrical Flying Chevron
        - Left edge: x=6, from y=2 down to y=19 (vertical)
        - Bottom inner curve: arcs from (6, 19) down through (26, 36) to (50, 48), then up through (74, 36) to (94, 19)
        - Right edge: x=94, from y=19 up to y=2 (vertical)
        - Top V-valley: arcs smoothly from (94, 2) down through (70, 10) to the central V-notch at (50, 23), then back up through (30, 10) to (6, 2)
      */}
      <path
        d="M 6 2 
           L 6 19 
           C 25 35, 36 48, 50 48 
           C 64 48, 75 35, 94 19 
           L 94 2 
           C 72 10, 60 18, 50 24 
           C 40 18, 28 10, 6 2 Z"
        fill={color}
      />

      {/* 
        Shape 2: Bottom-Left Vertical Pillar / Teardrop
        - Left edge: straight vertical line along x=6, from y=29 down to y=66
        - Bottom: rounded curve from (6, 66) down to (16, 75), rounding up to (26, 66)
        - Right edge: rounded inward drop bulging to (26, 52), then curving in towards (6, 29)
      */}
      <path
        d="M 6 29 
           L 6 66 
           C 6 73, 11 76, 16 76 
           C 21 76, 26 73, 26 66 
           C 26 52, 25 43, 14 33 
           L 6 29 Z"
        fill={color}
      />

      {/* 
        Shape 3: Bottom-Right Vertical Pillar / Teardrop (Perfect Symmetrical Mirror)
        - Right edge: straight vertical line along x=94, from y=29 down to y=66
        - Bottom: rounded curve from (94, 66) down to (84, 76), rounding up to (74, 66)
        - Left edge: rounded inward drop bulging to (74, 52), then curving in towards (94, 29)
      */}
      <path
        d="M 94 29 
           L 94 66 
           C 94 73, 89 76, 84 76 
           C 79 76, 74 73, 74 66 
           C 74 52, 75 43, 86 33 
           L 94 29 Z"
        fill={color}
      />
    </svg>
  );
}

