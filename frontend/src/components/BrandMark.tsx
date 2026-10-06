import '../styles/brand.css'

export function BrandMark({ size = 32 }: { size?: number }) {
  return <img className="brand-mark" src="/favicon.svg?v=20261006" width={size} height={size} alt="" aria-hidden="true" />
}
