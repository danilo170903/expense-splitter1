export default function Brand({ large = false }) {
  return (
    <span className={large ? 'brand brand-large' : 'brand'}>
      <span className="brand-mark" aria-hidden="true" />
      Podijeli troškove
    </span>
  )
}
