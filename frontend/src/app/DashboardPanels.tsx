import mascotGrid from '../assets/toqi-charte.png'

export type Goal = { validFrom: string; validTo: string | null; kcal: number | null; proteinG: number | null; carbohydrateG: number | null; fatG: number | null }
export type DayNutrition = { date: string; kcal: number; proteinG: number; carbohydrateG: number; fatG: number; complete: boolean; mealCount: number }
export type PlannedMeal = { id: string; recipeTitle: string; date: string; slot: string; portions: number }

const metrics = [
  { key: 'kcal', title: 'Calories', unit: 'kcal', color: 'green' },
  { key: 'proteinG', title: 'Protéines', unit: 'g', color: 'mint' },
  { key: 'carbohydrateG', title: 'Glucides', unit: 'g', color: 'peach' },
  { key: 'fatG', title: 'Lipides', unit: 'g', color: 'gold' },
] as const
const ratio = (value: number, target: number | null) => target && target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0
const progress = (value: number, target: number | null) => target && target > 0 ? Math.round(value / target * 100) : 0
const gaugeState = (value: number, target: number | null) => !target || target <= 0 ? 'unset' : value > target ? 'over' : value >= target ? 'reached' : 'under'
const format = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)
const iconStyle = (index: number) => ({ backgroundImage: `url(${mascotGrid})`, backgroundPosition: `${index * 33.333}% 0%` })

export function GoalGauges({ goal, day }: { goal: Goal; day?: DayNutrition }) {
  return <div className="goal-gauges">{metrics.map(metric => {
    const target = goal[metric.key]
    const current = day?.[metric.key] ?? 0
    const percent = ratio(current, target)
    return <div className={`goal-gauge ${metric.color}`} key={metric.key}><span>{metric.title}</span><strong>{target == null ? 'À définir' : `${format(target)} ${metric.unit} / jour`}</strong><div className={`gauge-track ${gaugeState(current, target)}`} role="progressbar" aria-label={`${metric.title} planifiées`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div><small>{day?.mealCount ? `${format(current)} ${metric.unit} prévus · ${progress(current, target)} % · ${gaugeState(current, target) === 'over' ? 'objectif dépassé' : gaugeState(current, target) === 'reached' ? 'objectif atteint' : 'objectif en cours'}` : 'Aucun repas planifié'}</small></div>
  })}</div>
}

export function HomeDashboard({ name, goal, days, meals, onPage }: { name: string; goal: Goal; days: DayNutrition[]; meals: PlannedMeal[]; onPage: (page: 'think' | 'planning' | 'recipes') => void }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  const day = days.find(item => item.date === today)
  const next = meals.filter(meal => meal.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
  const cards = [
    { title: 'Nutrition', subtitle: 'Mes objectifs et macros', page: 'think' as const },
    { title: 'Planning', subtitle: 'Planifier ma semaine', page: 'planning' as const },
    { title: 'Recettes', subtitle: 'Mes recettes', page: 'recipes' as const },
  ]
  return <div className="home-dashboard"><header className="home-welcome"><div><p className="eyebrow">Votre espace TOQ</p><h1>Bonjour {name} <span aria-hidden="true">👋</span></h1><p>Prêt pour une bonne journée ?</p></div><div className="home-welcome-mascot" style={iconStyle(2)} role="img" aria-label="TOQi vous accueille" /></header>
    <div className="home-feature-grid">{cards.map((card, index) => <button className={`home-feature-card feature-${index}`} key={card.title} onClick={() => onPage(card.page)}><span className="home-feature-art" style={iconStyle(index)} aria-hidden="true" /><strong>{card.title}</strong><span>{card.subtitle}</span><b aria-hidden="true">→</b></button>)}</div>
    <div className="home-bottom"><section className="home-summary"><h2>Aujourd’hui</h2><p className="section-note">Apports prévus pour les repas de la journée.</p><strong className="home-calories">{format(day?.kcal ?? 0)} <span>/ {goal.kcal == null ? '—' : format(goal.kcal)} kcal</span></strong><div className={`gauge-track ${gaugeState(day?.kcal ?? 0, goal.kcal)}`} role="progressbar" aria-label="Calories prévues" aria-valuenow={ratio(day?.kcal ?? 0, goal.kcal)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${ratio(day?.kcal ?? 0, goal.kcal)}%` }} /></div><div className="home-macro-row">{metrics.slice(1).map(metric => <div key={metric.key}><span className={`macro-dot ${metric.color}`} /><strong>{format(day?.[metric.key] ?? 0)} g</strong><small>{metric.title}</small></div>)}</div>{day && !day.complete && <p className="section-note">Calcul partiel : certains ingrédients n’ont pas de données nutritionnelles.</p>}</section>
      <section className="home-next"><h2>Prochain repas</h2>{next ? <><div className="next-meal-art" style={iconStyle(3)} aria-hidden="true" /><strong>{next.recipeTitle}</strong><p>{new Date(next.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {next.portions} portion{next.portions > 1 ? 's' : ''}</p><button className="text-button" onClick={() => onPage('planning')}>Voir mon planning →</button></> : <><p className="section-note">Aucun repas planifié pour les prochains jours.</p><button className="text-button" onClick={() => onPage('planning')}>Planifier un repas →</button></>}</section></div>
  </div>
}

export function ThinkSummary({ goal, days }: { goal: Goal; days: DayNutrition[] }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
  const current = days.find(day => day.date === today)
  return <><section className="think-intro"><div><h2>Mes objectifs</h2><p>Visualisez vos cibles et les apports prévus par votre planning.</p></div><div className="think-mascot" style={iconStyle(3)} aria-hidden="true" /><p>Chaque repas planifié vous aide à garder le cap.</p></section><GoalGauges goal={goal} day={current} /><section className="weekly-chart"><div><h2>Suivi de la semaine</h2><p className="section-note">Pourcentage des objectifs quotidiens couvert par les repas planifiés.</p></div><div className="chart-days">{days.map(day => <div className="chart-day" key={day.date}><div className="chart-bars">{metrics.map(metric => <span className={metric.color} key={metric.key} style={{ height: `${ratio(day[metric.key], goal[metric.key])}%` }} title={`${metric.title} : ${format(day[metric.key])} ${metric.unit}`} />)}</div><strong>{new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</strong></div>)}</div><div className="chart-legend">{metrics.map(metric => <span key={metric.key}><i className={metric.color} />{metric.title}</span>)}</div></section></>
}
