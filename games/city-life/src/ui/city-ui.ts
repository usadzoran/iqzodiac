import type { CityLocation } from '../game/city-world'
import type { CitySnapshot } from '../game/city-game'

export type CityUiActions = {
  select(id: string): void
  navigate(id: string): void
  enter(id: string): void
  exit(): void
  returnToPlaza(): void
  move(x: number, y: number): void
}

const CATEGORY_LABELS: Record<string, string> = {
  home: 'سكن', cafe: 'مقهى', furniture: 'أثاث', clothing: 'ملابس', appliances: 'أجهزة', grocery: 'بقالة',
}
const FILTERS = [
  { id: 'all', label: 'الكل' }, { id: 'home', label: 'سكن' }, { id: 'cafe', label: 'مقاهٍ' },
  { id: 'furniture', label: 'أثاث' }, { id: 'clothing', label: 'ملابس' }, { id: 'appliances', label: 'أجهزة' }, { id: 'grocery', label: 'بقالة' },
]

/** Arabic RTL shell for the city exploration prototype. Character creation is intentionally deferred. */
export class CityUI {
  private readonly root: HTMLElement
  private readonly frame: HTMLElement
  private readonly list: HTMLElement
  private readonly map: HTMLElement
  private readonly mapRoute: SVGPathElement
  private readonly mapPins = new Map<string, HTMLButtonElement>()
  private mapPlayer?: HTMLElement
  private lastMapRoute = ''
  private filter = 'all'
  private search = ''
  private state?: CitySnapshot

  constructor(root: HTMLElement, private readonly locations: readonly CityLocation[], private readonly actions: CityUiActions) {
    this.root = root
    this.root.innerHTML = this.template()
    this.frame = this.q('.city-interface')
    this.list = this.q('#city-location-list')
    this.map = this.q('#city-mini-map')
    this.mapRoute = this.q('#city-map-route')
    this.root.addEventListener('click', event => this.onClick(event))
    this.root.addEventListener('input', event => this.onInput(event))
    this.bindStick()
    this.renderFilters()
    this.renderLocations()
    this.renderMap()
    this.update({ mode: 'city', x: 0, z: 0, selectedLocationId: '', destinationId: '', interiorLocationId: '', arrived: false, distanceToDestination: null, route: [], status: 'اختر وجهة من القائمة أو من الخريطة.', visitedLocationIds: [] })
  }

  update(state: CitySnapshot): void {
    const selectionChanged = this.state?.selectedLocationId !== state.selectedLocationId
    this.state = state
    this.frame.classList.toggle('is-interior', state.mode === 'interior')
    this.root.dataset.mode = state.mode
    this.q<HTMLElement>('.city-status').textContent = state.status
    this.q<HTMLElement>('.city-mode').textContent = state.mode === 'interior' ? 'داخل المبنى' : 'استكشاف المدينة'
    this.q<HTMLElement>('.city-position').textContent = `${Math.round(state.x)} / ${Math.round(state.z)}`
    this.q<HTMLElement>('.city-progress-count').textContent = `${state.visitedLocationIds.length} / ${this.locations.length}`
    if (selectionChanged) this.renderLocations()
    this.renderMap()
    this.renderSelectedCard(state)
  }

  toggleImmersive(): void {
    const immersive = !this.frame.classList.contains('is-immersive')
    this.frame.classList.toggle('is-immersive', immersive)
    this.q<HTMLButtonElement>('.city-immersive-button').setAttribute('aria-pressed', String(immersive))
    this.q<HTMLButtonElement>('.city-immersive-restore').setAttribute('aria-pressed', String(immersive))
  }

  private onClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-location], [data-filter]')
    if (!target) return
    if (target.dataset.filter) {
      this.filter = target.dataset.filter
      this.renderFilters()
      this.renderLocations()
      return
    }
    if (target.dataset.location) {
      this.actions.select(target.dataset.location)
      return
    }
    switch (target.dataset.action) {
      case 'navigate': {
        const id = this.state?.selectedLocationId
        if (id) this.actions.navigate(id)
        break
      }
      case 'enter': {
        const id = this.state?.selectedLocationId
        if (id) this.actions.enter(id)
        break
      }
      case 'exit': this.actions.exit(); break
      case 'plaza': this.actions.returnToPlaza(); break
      case 'map': this.frame.classList.toggle('map-expanded'); break
      case 'help': this.frame.classList.toggle('show-help'); break
      case 'immersive': this.toggleImmersive(); break
    }
  }

  private onInput(event: Event): void {
    const target = event.target as HTMLInputElement
    if (target.matches('#city-search')) {
      this.search = target.value.trim().toLocaleLowerCase('ar')
      this.renderLocations()
    }
  }

  private renderFilters(): void {
    const host = this.q('.city-filters')
    host.replaceChildren(...FILTERS.map(filter => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.filter = filter.id
      button.className = `city-filter${this.filter === filter.id ? ' is-active' : ''}`
      button.textContent = filter.label
      button.setAttribute('aria-pressed', String(this.filter === filter.id))
      return button
    }))
  }

  private renderLocations(): void {
    if (!this.list) return
    const visible = this.locations.filter(location => {
      const matchesFilter = this.filter === 'all' || location.category === this.filter
      const matchesSearch = !this.search || `${location.name} ${location.description} ${CATEGORY_LABELS[location.category] ?? ''}`.toLocaleLowerCase('ar').includes(this.search)
      return matchesFilter && matchesSearch
    })
    this.list.replaceChildren(...visible.map(location => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `city-location-row${location.id === this.state?.selectedLocationId ? ' is-selected' : ''}`
      button.dataset.location = location.id
      button.setAttribute('aria-pressed', String(location.id === this.state?.selectedLocationId))
      const icon = document.createElement('span')
      icon.className = `city-location-icon icon-${location.category}`
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = this.iconFor(location.category)
      const copy = document.createElement('span')
      copy.className = 'city-location-copy'
      const name = document.createElement('strong')
      name.textContent = location.name
      const detail = document.createElement('small')
      detail.textContent = CATEGORY_LABELS[location.category] ?? 'وجهة'
      copy.append(name, detail)
      const arrow = document.createElement('span')
      arrow.className = 'city-location-arrow'
      arrow.textContent = '↗'
      button.append(icon, copy, arrow)
      return button
    }))
    this.q<HTMLElement>('.city-empty').classList.toggle('is-hidden', visible.length > 0)
  }

  private renderMap(): void {
    if (!this.map) return
    if (!this.mapPins.size) {
      for (const location of this.locations) {
        const pin = document.createElement('button')
        pin.type = 'button'
        pin.dataset.location = location.id
        pin.title = location.name
        pin.setAttribute('aria-label', `اختيار ${location.name}`)
        pin.style.left = `${mapPercent(location.position.x)}%`
        pin.style.top = `${mapPercent(location.position.z)}%`
        this.mapPins.set(location.id, pin)
        this.map.append(pin)
      }
    }
    if (this.state) {
      for (const location of this.locations) {
        const pin = this.mapPins.get(location.id)
        if (pin) pin.className = `city-map-pin${location.id === this.state.selectedLocationId ? ' is-selected' : ''}${this.state.visitedLocationIds.includes(location.id) ? ' is-visited' : ''}`
      }
      if (!this.mapPlayer) {
        this.mapPlayer = document.createElement('span')
        this.mapPlayer.className = 'city-map-player'
        this.mapPlayer.setAttribute('aria-label', 'موقع الاستكشاف الحالي')
        this.map.append(this.mapPlayer)
      }
      this.mapPlayer.style.left = `${mapPercent(this.state.x)}%`
      this.mapPlayer.style.top = `${mapPercent(this.state.z)}%`
      const route = this.state.route
      const path = route.map((point, index) => `${index ? 'L' : 'M'} ${mapPercent(point.x)} ${mapPercent(point.z)}`).join(' ')
      if (path !== this.lastMapRoute) {
        this.mapRoute.setAttribute('d', path)
        this.lastMapRoute = path
      }
    }
  }

  private renderSelectedCard(state: CitySnapshot): void {
    const exit = this.q<HTMLElement>('[data-action="exit"]')
    const navigate = this.q<HTMLButtonElement>('[data-action="navigate"]')
    const enter = this.q<HTMLButtonElement>('[data-action="enter"]')
    const title = this.q<HTMLElement>('.city-selected-name')
    const category = this.q<HTMLElement>('.city-selected-category')
    const description = this.q<HTMLElement>('.city-selected-description')
    const location = this.locations.find(item => item.id === state.selectedLocationId)
    if (state.mode === 'interior') {
      const inside = this.locations.find(item => item.id === state.interiorLocationId)
      title.textContent = inside?.name ?? 'داخل المبنى'
      category.textContent = 'مساحة داخلية قابلة للاستكشاف'
      description.textContent = 'تجوّل داخل المكان وتفحّص توزيع المساحة والأثاث. لا توجد عمليات شراء أو مدفوعات مفعّلة في هذه النسخة.'
      exit.classList.remove('is-hidden')
      navigate.classList.add('is-hidden')
      enter.classList.add('is-hidden')
      return
    }
    exit.classList.add('is-hidden')
    if (!location) {
      title.textContent = 'اختر وجهتك'
      category.textContent = 'حيّ النور · مدينة تجريبية'
      description.textContent = 'حدّد مبنى من الخريطة أو الدليل، ثم اتبع الطريق المضاء للوصول إليه.'
      navigate.classList.add('is-hidden')
      enter.classList.add('is-hidden')
      return
    }
    title.textContent = location.name
    category.textContent = CATEGORY_LABELS[location.category] ?? 'وجهة في المدينة'
    description.textContent = location.description
    const near = state.arrived && state.destinationId === location.id
    navigate.classList.toggle('is-hidden', near)
    enter.classList.toggle('is-hidden', !near)
    enter.disabled = !near
    navigate.disabled = false
    navigate.textContent = state.destinationId === location.id && !near ? `أكمل الطريق · ${Math.max(1, Math.round(state.distanceToDestination ?? 0))} م` : 'ارسم الطريق الأقصر'
  }

  private bindStick(): void {
    const stick = this.q<HTMLElement>('.city-stick')
    const knob = this.q<HTMLElement>('.city-stick-knob')
    const move = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect()
      const radius = rect.width * 0.34
      let x = (event.clientX - (rect.left + rect.width / 2)) / radius
      let y = -((event.clientY - (rect.top + rect.height / 2)) / radius)
      const length = Math.hypot(x, y)
      if (length > 1) { x /= length; y /= length }
      knob.style.transform = `translate(${x * radius * 0.65}px, ${-y * radius * 0.65}px)`
      this.actions.move(x, y)
    }
    stick.addEventListener('pointerdown', event => {
      event.preventDefault()
      stick.setPointerCapture(event.pointerId)
      move(event)
    })
    stick.addEventListener('pointermove', event => { if (stick.hasPointerCapture(event.pointerId)) move(event) })
    const reset = (event: PointerEvent) => {
      if (stick.hasPointerCapture(event.pointerId)) stick.releasePointerCapture(event.pointerId)
      knob.style.transform = ''
      this.actions.move(0, 0)
    }
    stick.addEventListener('pointerup', reset)
    stick.addEventListener('pointercancel', reset)
  }

  private iconFor(category: string): string {
    return ({ home: '⌂', cafe: '◌', furniture: '▰', clothing: '◈', appliances: '▣', grocery: '＋' } as Record<string, string>)[category] ?? '•'
  }

  private q<T extends Element = HTMLElement>(selector: string): T {
    const result = this.root.querySelector<T>(selector)
    if (!result) throw new Error(`Missing City Life UI element: ${selector}`)
    return result
  }

  private template(): string {
    return `<div class="city-interface" dir="rtl">
      <header class="city-topbar">
        <div class="city-brand"><span class="city-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span><strong>City Life</strong><small>حياة المدينة · نموذج استكشاف</small></span></div>
        <div class="city-top-meta"><span class="city-live-dot"></span><span class="city-mode">استكشاف المدينة</span><span class="city-divider"></span><span class="city-district">حيّ النور</span></div>
        <div class="city-top-actions"><button type="button" class="city-icon-button" data-action="plaza" aria-label="العودة إلى الساحة" title="العودة إلى الساحة">⌂</button><button type="button" class="city-icon-button city-map-toggle" data-action="map" aria-label="تبديل الخريطة" title="الخريطة">⌖</button><button type="button" class="city-icon-button city-immersive-button" data-action="immersive" aria-label="تصغير القوائم وإظهار المدينة" title="تركيز على المدينة · H" aria-pressed="false">⛶</button></div>
      </header>
      <button type="button" class="city-immersive-restore" data-action="immersive" aria-label="إظهار القوائم" title="إظهار القوائم · H" aria-pressed="true">☰</button>
      <aside class="city-directory panel-glass">
        <div class="city-section-head"><div><span class="city-eyebrow">حيّ النور <b>·</b> 01</span><h1>استكشف المدينة</h1></div><span class="city-progress"><strong class="city-progress-count">0 / 6</strong><small>وجهات زرتها</small></span></div>
        <label class="city-search"><span aria-hidden="true">⌕</span><input id="city-search" type="search" autocomplete="off" placeholder="ابحث عن مكان أو متجر" /><kbd>/</kbd></label>
        <div class="city-filters" role="group" aria-label="تصفية حسب النوع"></div>
        <div id="city-location-list" class="city-location-list"></div><p class="city-empty is-hidden">لا توجد وجهات تطابق البحث.</p>
        <div class="city-stage-note"><span class="stage-note-icon">◒</span><span><strong>المدينة أولًا</strong><small>ستُضاف الشخصيات في المرحلة الأخيرة.</small></span><span class="stage-note-lock" aria-hidden="true">01</span></div>
      </aside>
      <section class="city-map-panel panel-glass" aria-label="خريطة الحي">
        <div class="city-map-heading"><span><b>خريطة الحي</b><small>المسارات والشوارع الرئيسية</small></span><button type="button" data-action="map" aria-label="توسيع الخريطة">⤢</button></div>
        <div id="city-mini-map" class="city-mini-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="city-map-route" id="city-map-route" d=""/></svg></div>
        <div class="city-map-key"><span><i class="key-you"></i>موقعك</span><span><i class="key-stop"></i>وجهة</span><span><i class="key-route"></i>المسار</span></div>
      </section>
      <section class="city-selected-card panel-glass" aria-live="polite">
        <div class="city-selected-top"><span class="city-selected-symbol" aria-hidden="true">⌖</span><span class="city-selected-category">حيّ النور · مدينة تجريبية</span><span class="city-selected-distance">CITY / 01</span></div>
        <h2 class="city-selected-name">اختر وجهتك</h2><p class="city-selected-description">حدّد مبنى من الخريطة أو الدليل، ثم اتبع الطريق المضاء للوصول إليه.</p>
        <p class="city-status" role="status">اختر وجهة من القائمة أو من الخريطة.</p>
        <div class="city-card-actions"><button type="button" class="city-primary-action" data-action="navigate">ارسم الطريق الأقصر</button><button type="button" class="city-primary-action city-enter-action is-hidden" data-action="enter">ادخل المبنى</button><button type="button" class="city-exit-action is-hidden" data-action="exit">الخروج إلى المدينة</button></div>
      </section>
      <div class="city-control-legend"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><small>تحرّك</small></span><i></i><span><b class="mouse-icon">↔</b><small>اسحب لتدوير الكاميرا</small></span><i></i><span><b class="wheel-icon">⊙</b><small>عجلة الفأرة للتقريب</small></span><i></i><span><kbd>H</kbd><small>تصغير القوائم</small></span></div>
      <div class="city-mobile-stick" aria-label="عصا التحكم باللمس"><div class="city-stick"><span class="city-stick-ring"></span><span class="city-stick-knob"></span></div><small>تحرّك</small></div>
      <div class="city-help-toast"><b>استكشاف مفتوح</b><span>استخدم القائمة لاختيار متجر، أو اضغط H لتصغير القوائم ورؤية المدينة بوضوح.</span></div>
      <div class="city-bottom-right"><span class="city-position-label"><i></i>موقع الاستكشاف</span><b class="city-position">0 / 0</b><span class="city-version">نسخة تجريبية محلية</span></div>
      <div class="city-map-backdrop"></div>
    </div>`
  }
}

function mapPercent(value: number): number {
  return Math.max(4, Math.min(96, ((value + 60) / 120) * 100))
}
