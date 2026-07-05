interface HeaderProps {
  directorName: string
  directorIsAI: boolean
  onOpenSettings: () => void
}

export function Header({ directorName, directorIsAI, onOpenSettings }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo">✂</span>
        <span className="header__title">VideoApp Editor</span>
      </div>
      <div className="header__right">
        <span
          className={`header__badge${directorIsAI ? ' header__badge--ai' : ''}`}
          title={
            directorIsAI
              ? 'Edits are planned by Claude, which analyzes sampled frames from your footage.'
              : 'No API key set — edits are planned by an offline keyword heuristic. Add an Anthropic API key in Settings to enable the Claude director.'
          }
        >
          {directorName}
        </span>
        <button className="header__settings" onClick={onOpenSettings} aria-label="Settings">
          ⚙
        </button>
      </div>
    </header>
  )
}
