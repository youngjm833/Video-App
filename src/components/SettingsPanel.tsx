import { useState } from 'react'

interface SettingsPanelProps {
  apiKey: string
  onSave: (key: string) => void
  onClose: () => void
}

export function SettingsPanel({ apiKey, onSave, onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState(apiKey)

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <label className="settings-panel__label" htmlFor="api-key">
          Anthropic API key
        </label>
        <input
          id="api-key"
          type="password"
          placeholder="sk-ant-…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
        />
        <p className="settings-panel__hint">
          With a key, edits are planned by <strong>Claude</strong>, which looks at sampled
          frames from your footage to pick the best moments. Without one, an offline
          heuristic director is used. Get a key at{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>
        <p className="settings-panel__warning">
          The key is stored in this browser only and sent directly to the Anthropic API.
          Don't paste a key on a shared or public computer.
        </p>
        <div className="settings-panel__actions">
          {apiKey && (
            <button
              className="button"
              onClick={() => {
                onSave('')
                onClose()
              }}
            >
              Remove key
            </button>
          )}
          <button className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            onClick={() => {
              onSave(draft.trim())
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
