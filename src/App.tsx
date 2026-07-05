import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipList } from './components/ClipList'
import { Header } from './components/Header'
import { PlanView } from './components/PlanView'
import { PromptPanel } from './components/PromptPanel'
import { RenderPanel } from './components/RenderPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { UploadZone } from './components/UploadZone'
import { createClaudeDirector } from './director/claude'
import { heuristicDirector } from './director/heuristic'
import { renderPlan, type RenderProgress } from './render/renderPlan'
import type { Clip, EditPlan } from './types'
import { fileToClip, loadSampleFootage } from './utils/clips'

const API_KEY_STORAGE = 'videoapp.anthropic-api-key'

export default function App() {
  const [clips, setClips] = useState<Clip[]>([])
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const director = useMemo(
    () => (apiKey ? createClaudeDirector(apiKey) : heuristicDirector),
    [apiKey],
  )

  const saveApiKey = (key: string) => {
    setApiKey(key)
    if (key) localStorage.setItem(API_KEY_STORAGE, key)
    else localStorage.removeItem(API_KEY_STORAGE)
  }
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [thinking, setThinking] = useState(false)
  const [plan, setPlan] = useState<EditPlan | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const planSection = useRef<HTMLElement>(null)

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl)
    }
  }, [outputUrl])

  const addFiles = async (files: File[]) => {
    const newClips = await Promise.all(files.map(fileToClip))
    setClips((existing) => [...existing, ...newClips])
    setPlan(null)
    setRenderStatus('idle')
  }

  const handleLoadSamples = async () => {
    setLoadingSamples(true)
    try {
      const samples = await loadSampleFootage()
      setClips((existing) => [...existing, ...samples])
      setPlan(null)
      setRenderStatus('idle')
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to load sample footage.')
    } finally {
      setLoadingSamples(false)
    }
  }

  const removeClip = (id: string) => {
    setClips((existing) => existing.filter((clip) => clip.id !== id))
    setPlan(null)
    setRenderStatus('idle')
  }

  const generatePlan = async () => {
    setThinking(true)
    setPlanError(null)
    setPlan(null)
    setRenderStatus('idle')
    try {
      const newPlan = await director.createEditPlan({ clips, prompt })
      setPlan(newPlan)
      requestAnimationFrame(() => planSection.current?.scrollIntoView({ behavior: 'smooth' }))
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to plan the edit.')
    } finally {
      setThinking(false)
    }
  }

  const startRender = async () => {
    if (!plan) return
    setRenderStatus('rendering')
    setRenderError(null)
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl)
      setOutputUrl(null)
    }
    try {
      const blob = await renderPlan(plan, clips, setProgress)
      setOutputUrl(URL.createObjectURL(blob))
      setRenderStatus('done')
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : 'Render failed.')
      setRenderStatus('error')
    }
  }

  return (
    <div className="app">
      <Header
        directorName={director.name}
        directorIsAI={Boolean(apiKey)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && (
        <SettingsPanel apiKey={apiKey} onSave={saveApiKey} onClose={() => setSettingsOpen(false)} />
      )}
      <main className="app__content">
        <section className="step">
          <h2 className="step__title">
            <span className="step__number">1</span> Add raw footage
          </h2>
          <UploadZone onFiles={addFiles} onLoadSamples={handleLoadSamples} loadingSamples={loadingSamples} />
          <ClipList clips={clips} onRemove={removeClip} />
        </section>

        <section className={`step${clips.length === 0 ? ' step--disabled' : ''}`}>
          <h2 className="step__title">
            <span className="step__number">2</span> Describe the video you want
          </h2>
          <PromptPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={generatePlan}
            disabled={clips.length === 0}
            thinking={thinking}
          />
          {planError && <p className="step__error">{planError}</p>}
        </section>

        {plan && (
          <section className="step" ref={planSection}>
            <h2 className="step__title">
              <span className="step__number">3</span> Review the edit plan
            </h2>
            <PlanView plan={plan} clips={clips} directorName={director.name} />

            <h2 className="step__title step__title--spaced">
              <span className="step__number">4</span> Render
            </h2>
            <RenderPanel
              status={renderStatus}
              progress={progress}
              outputUrl={outputUrl}
              error={renderError}
              onRender={startRender}
            />
          </section>
        )}
      </main>
    </div>
  )
}
