interface HeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onHome: () => void
}

export function Header({ searchQuery, onSearchChange, onHome }: HeaderProps) {
  return (
    <header className="header">
      <button className="header__brand" onClick={onHome} aria-label="Go to home">
        <span className="header__logo">▶</span>
        <span className="header__title">VideoApp</span>
      </button>
      <div className="header__search">
        <input
          type="search"
          placeholder="Search videos…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search videos"
        />
      </div>
    </header>
  )
}
