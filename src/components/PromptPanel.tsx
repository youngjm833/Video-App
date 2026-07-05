const PRESETS = [
  {
    label: 'Highlight reel',
    prompt: 'Cut this into a punchy, fast-paced 30 second highlight reel with vibrant colors.',
  },
  {
    label: 'Cinematic montage',
    prompt: 'Make a slow, cinematic 45 second montage with a film look, intercut between clips.',
  },
  {
    label: 'Social short',
    prompt: 'Edit a fast 20 second vertical short for social media.',
  },
  {
    label: 'Chill recap',
    prompt: 'Create a calm 40 second recap in chronological order with gentle pacing.',
  },
]

interface PromptPanelProps {
  prompt: string
  onPromptChange: (prompt: string) => void
  onGenerate: () => void
  disabled: boolean
  thinking: boolean
}

export function PromptPanel({ prompt, onPromptChange, onGenerate, disabled, thinking }: PromptPanelProps) {
  return (
    <div className="prompt-panel">
      <div className="prompt-panel__presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={`chip${prompt === preset.prompt ? ' chip--active' : ''}`}
            onClick={() => onPromptChange(preset.prompt)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <textarea
        className="prompt-panel__input"
        rows={3}
        placeholder='Describe the video you want — e.g. "Make a fast-paced 30 second highlight reel titled &quot;Summer 2026&quot; with punchy colors"'
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
      />
      <div className="prompt-panel__footer">
        <span className="prompt-panel__hint">
          Mention length (“30 seconds”), pace (“fast”, “calm”), format (“vertical”), style
          (“cinematic”, “black and white”, “slow motion”), or a title (titled “…”).
        </span>
        <button
          className="button button--primary"
          onClick={onGenerate}
          disabled={disabled || thinking || prompt.trim() === ''}
        >
          {thinking ? 'Planning the edit…' : 'Generate edit'}
        </button>
      </div>
    </div>
  )
}
