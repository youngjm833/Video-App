export function Header() {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo">✂</span>
        <span className="header__title">VideoApp Editor</span>
      </div>
      <span className="header__badge" title="The edit-planning AI currently runs as an offline heuristic. A Claude-powered director can be plugged into the same interface.">
        AI director: offline mock
      </span>
    </header>
  )
}
