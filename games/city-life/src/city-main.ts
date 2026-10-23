import './styles/main.css'
import './styles/city.css'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { Renderer, suggestQuality } from './engine/renderer'
import { CityGame } from './game/city-game'
import { CITY_LOCATIONS } from './game/city-world'
import { loadCityState, saveCityState } from './game/city-state'
import { CityUI } from './ui/city-ui'

async function startCityLife(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')
  const root = document.querySelector<HTMLElement>('#ui')
  if (!canvas || !root) throw new Error('City Life canvas or interface root is missing')
  document.documentElement.lang = 'ar'
  document.documentElement.dir = 'rtl'

  const ids = CITY_LOCATIONS.map(location => location.id)
  const initial = loadCityState(globalThis.localStorage, ids)
  const input = new Input(canvas)
  const renderer = new Renderer(canvas, suggestQuality())
  let ui: CityUI
  const game = new CityGame(renderer, input, initial, {
    changed: snapshot => {
      saveCityState({
        version: 1,
        x: snapshot.x,
        z: snapshot.z,
        selectedLocationId: snapshot.selectedLocationId,
        visitedLocationIds: snapshot.visitedLocationIds,
      })
      ui?.update(snapshot)
    },
  })

  ui = new CityUI(root, CITY_LOCATIONS, {
    select: id => { game.selectLocation(id); ui.update(game.snapshot) },
    navigate: id => { game.setDestination(id); ui.update(game.snapshot) },
    enter: id => {
      if (game.snapshot.selectedLocationId === id) game.enterSelected()
      ui.update(game.snapshot)
    },
    exit: () => { game.exitInterior(); ui.update(game.snapshot) },
    returnToPlaza: () => { game.returnToPlaza(); ui.update(game.snapshot) },
    move: (x, y) => input.setTouchMove(x, y),
  })
  ui.update(game.snapshot)

  canvas.addEventListener('click', event => {
    if (game.suppressClick || game.snapshot.mode !== 'city') return
    const id = game.pickLocation(event.clientX, event.clientY)
    if (id) { game.selectLocation(id); ui.update(game.snapshot) }
  })
  window.addEventListener('keydown', event => {
    if (event.key === '/' && !(event.target as HTMLElement | null)?.matches?.('input,textarea')) {
      event.preventDefault()
      root.querySelector<HTMLInputElement>('#city-search')?.focus()
    }
    if (event.key === 'Escape' && (event.target as HTMLElement | null)?.matches?.('#city-search')) {
      ;(event.target as HTMLInputElement).blur()
    }
  })
  if (import.meta.env.DEV) {
    const { registerGameTuning } = await import('../scripts/manus-tuning/adapter.js')
    const { tuning } = await import('./game/tuning')
    await registerGameTuning(tuning)
  }

  const loop = new GameLoop({
    step: dt => {
      if (input.consume('pause')) root.classList.toggle('show-help')
      if (input.consume('interact')) game.enterSelected()
      if (document.activeElement?.matches('input,textarea')) input.setTouchMove(0, 0)
      game.step(dt)
    },
    render: (alpha, frameSeconds) => {
      input.update()
      game.render(alpha, frameSeconds)
      input.endFrame()
    },
  })
  loop.start()
  window.dispatchEvent(new Event('citylife-ready'))
  const app = { game, ui, input, renderer }
  ;(window as unknown as { __citylife: typeof app }).__citylife = app
  window.addEventListener('pagehide', () => { game.dispose(); input.dispose(); loop.stop() }, { once: true })
}

startCityLife().catch(error => {
  console.error(error)
  window.dispatchEvent(new Event('citylife-error'))
  const root = document.getElementById('ui')
  if (root) root.innerHTML = `<div class="city-fatal" dir="rtl">تعذّر تشغيل المدينة. أعد تحميل الصفحة وحاول مرة أخرى.<small>${escapeHtml(String((error as Error)?.message ?? error))}</small></div>`
})

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}
