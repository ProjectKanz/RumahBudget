import type { CSSProperties } from "react"

type IconProps = {
  size?: number
  className?: string
  style?: CSSProperties
}

/**
 * Blocky, rect-based pixel-art icons drawn on a 12x12 grid.
 * `shape-rendering="crispEdges"` keeps the pixel look sharp at any size.
 */
function Pixel({
  size = 24,
  className,
  style,
  children,
  label,
}: IconProps & { children: React.ReactNode; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={className}
      style={style}
      shapeRendering="crispEdges"
      fill="currentColor"
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  )
}

// Coin / balance
export function PixCoin(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="3" y="1" width="6" height="1" />
      <rect x="2" y="2" width="8" height="1" />
      <rect x="1" y="3" width="10" height="6" />
      <rect x="2" y="9" width="8" height="1" />
      <rect x="3" y="10" width="6" height="1" />
      <rect x="5" y="4" width="2" height="1" fill="#0a0612" />
      <rect x="5" y="5" width="2" height="2" fill="#0a0612" />
      <rect x="5" y="7" width="2" height="1" fill="#0a0612" />
    </Pixel>
  )
}

// Arrow up (income)
export function PixUp(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="1" width="2" height="2" />
      <rect x="4" y="2" width="4" height="1" />
      <rect x="3" y="3" width="6" height="1" />
      <rect x="2" y="4" width="8" height="1" />
      <rect x="5" y="4" width="2" height="7" />
    </Pixel>
  )
}

// Arrow down (expense)
export function PixDown(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="1" width="2" height="7" />
      <rect x="2" y="7" width="8" height="1" />
      <rect x="3" y="8" width="6" height="1" />
      <rect x="4" y="9" width="4" height="1" />
      <rect x="5" y="10" width="2" height="1" />
    </Pixel>
  )
}

// Fire (warning / hot spend)
export function PixFire(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="1" width="2" height="1" />
      <rect x="4" y="2" width="3" height="1" />
      <rect x="4" y="3" width="4" height="1" />
      <rect x="3" y="4" width="6" height="1" />
      <rect x="3" y="5" width="6" height="2" />
      <rect x="2" y="7" width="8" height="3" />
      <rect x="3" y="10" width="6" height="1" />
      <rect x="5" y="7" width="2" height="2" fill="#0a0612" />
    </Pixel>
  )
}

// Target (budget health)
export function PixTarget(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="4" y="1" width="4" height="1" />
      <rect x="2" y="2" width="2" height="1" />
      <rect x="8" y="2" width="2" height="1" />
      <rect x="1" y="4" width="1" height="4" />
      <rect x="10" y="4" width="1" height="4" />
      <rect x="2" y="9" width="2" height="1" />
      <rect x="8" y="9" width="2" height="1" />
      <rect x="4" y="10" width="4" height="1" />
      <rect x="5" y="5" width="2" height="2" />
    </Pixel>
  )
}

// Bolt (quick action / next move)
export function PixBolt(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="6" y="1" width="3" height="1" />
      <rect x="5" y="2" width="3" height="1" />
      <rect x="4" y="3" width="3" height="1" />
      <rect x="3" y="4" width="4" height="1" />
      <rect x="5" y="5" width="4" height="1" />
      <rect x="4" y="6" width="4" height="1" />
      <rect x="3" y="7" width="4" height="1" />
      <rect x="4" y="8" width="3" height="1" />
      <rect x="3" y="9" width="3" height="1" />
    </Pixel>
  )
}

// Plus
export function PixPlus(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="2" width="2" height="8" />
      <rect x="2" y="5" width="8" height="2" />
    </Pixel>
  )
}

// Grid / home (nav)
export function PixGrid(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="2" y="2" width="3" height="3" />
      <rect x="7" y="2" width="3" height="3" />
      <rect x="2" y="7" width="3" height="3" />
      <rect x="7" y="7" width="3" height="3" />
    </Pixel>
  )
}

// Wallet (accounts)
export function PixWallet(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="2" y="3" width="8" height="6" />
      <rect x="2" y="2" width="6" height="1" />
      <rect x="7" y="5" width="3" height="2" fill="#0a0612" />
      <rect x="8" y="5" width="1" height="2" />
    </Pixel>
  )
}

// Transfer (transactions)
export function PixTransfer(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="2" y="3" width="6" height="1" />
      <rect x="7" y="2" width="1" height="1" />
      <rect x="7" y="4" width="1" height="1" />
      <rect x="8" y="3" width="1" height="1" />
      <rect x="4" y="8" width="6" height="1" />
      <rect x="4" y="7" width="1" height="1" />
      <rect x="4" y="9" width="1" height="1" />
      <rect x="3" y="8" width="1" height="1" />
    </Pixel>
  )
}

// Chart (reports)
export function PixChart(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="2" y="7" width="2" height="3" />
      <rect x="5" y="4" width="2" height="6" />
      <rect x="8" y="2" width="2" height="8" />
    </Pixel>
  )
}

// Shield (emergency fund)
export function PixShield(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="3" y="2" width="6" height="1" />
      <rect x="2" y="3" width="8" height="4" />
      <rect x="3" y="7" width="6" height="1" />
      <rect x="4" y="8" width="4" height="1" />
      <rect x="5" y="9" width="2" height="1" />
      <rect x="5" y="4" width="2" height="2" fill="#0a0612" />
    </Pixel>
  )
}

// Cart (lifestyle / shopping)
export function PixCart(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="1" y="2" width="2" height="1" />
      <rect x="3" y="3" width="7" height="1" />
      <rect x="3" y="4" width="6" height="3" />
      <rect x="3" y="8" width="1" height="1" />
      <rect x="8" y="8" width="1" height="1" />
    </Pixel>
  )
}

// Heart (giving / family)
export function PixHeart(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="2" y="3" width="3" height="1" />
      <rect x="7" y="3" width="3" height="1" />
      <rect x="1" y="4" width="10" height="2" />
      <rect x="2" y="6" width="8" height="1" />
      <rect x="3" y="7" width="6" height="1" />
      <rect x="4" y="8" width="4" height="1" />
      <rect x="5" y="9" width="2" height="1" />
    </Pixel>
  )
}

// Seed / growth (investment)
export function PixSeed(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="6" width="2" height="4" />
      <rect x="2" y="4" width="3" height="2" />
      <rect x="3" y="3" width="2" height="1" />
      <rect x="7" y="3" width="3" height="2" />
      <rect x="8" y="2" width="2" height="1" />
    </Pixel>
  )
}

// House (living)
export function PixHouse(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="1" width="2" height="1" />
      <rect x="3" y="2" width="6" height="1" />
      <rect x="2" y="3" width="8" height="1" />
      <rect x="1" y="4" width="10" height="1" />
      <rect x="2" y="5" width="8" height="5" />
      <rect x="5" y="7" width="2" height="3" fill="#0a0612" />
    </Pixel>
  )
}

// Bell (alerts)
export function PixBell(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="1" width="2" height="1" />
      <rect x="4" y="2" width="4" height="1" />
      <rect x="3" y="3" width="6" height="5" />
      <rect x="2" y="8" width="8" height="1" />
      <rect x="5" y="9" width="2" height="1" />
    </Pixel>
  )
}

// Settings / gear (profile area)
export function PixGear(props: IconProps & { label?: string }) {
  return (
    <Pixel {...props}>
      <rect x="5" y="1" width="2" height="2" />
      <rect x="5" y="9" width="2" height="2" />
      <rect x="1" y="5" width="2" height="2" />
      <rect x="9" y="5" width="2" height="2" />
      <rect x="3" y="3" width="6" height="6" />
      <rect x="5" y="5" width="2" height="2" fill="#0a0612" />
    </Pixel>
  )
}
