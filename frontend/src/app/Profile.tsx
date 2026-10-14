import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import logo from '../assets/toq-navbar.png'
import { authenticatedFetch, keycloak } from '../auth/keycloak'
import { HomeDashboard, ThinkSummary } from './DashboardPanels'
import type { DayNutrition, Goal, PlannedMeal } from './DashboardPanels'
import { NutritionPage } from './NutritionPage'
import { PlanningPage } from './PlanningPage'
import { RecipePage } from './RecipePage'
import { SocialPage } from './SocialPage'

type Page = 'home' | 'think' | 'planning' | 'recipes' | 'social' | 'profile' | 'settings'
type Profile = { id: string; displayName: string; version: number }
type Preferences = { dietaryPreferenceCodes: string[]; allergyCodes: string[]; excludedIngredientIds: string[] }
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
const emptyGoal: Goal = { validFrom: today(), validTo: null, kcal: null, proteinG: null, carbohydrateG: null, fatG: null }
const csv = (raw: string) => raw.split(',').map(value => value.trim().toUpperCase()).filter(Boolean)
const weekMonday = () => { const day = new Date(today() + 'T12:00:00'); day.setDate(day.getDate() - (day.getDay() || 7) + 1); return day.toLocaleDateString('sv-SE') }
const habits = [
  ['VEGETARIAN', 'Végétarien'], ['VEGAN', 'Végétalien'], ['PESCETARIAN', 'Pescétarien'],
  ['FLEXITARIAN', 'Flexitarien'], ['HALAL', 'Halal'], ['KOSHER', 'Casher'],
  ['LOW_CARB', 'Réduit en glucides'], ['GLUTEN_FREE', 'Sans gluten'], ['LACTOSE_FREE', 'Sans lactose'],
] as const

export function ProfilePage() {
  const [page, setPage] = useState<Page>('home')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [prefs, setPrefs] = useState<Preferences>({ dietaryPreferenceCodes: [], allergyCodes: [], excludedIngredientIds: [] })
  const [dietary, setDietary] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')
  const [goal, setGoal] = useState<Goal>(emptyGoal)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [days, setDays] = useState<DayNutrition[]>([])
  const [meals, setMeals] = useState<PlannedMeal[]>([])

  useEffect(() => {
    async function load() {
      const result = await authenticatedFetch('/api/v1/users/me')
      if (result.status === 404) return
      if (!result.ok) throw new Error('Le profil ne peut pas être chargé.')
      const current = await result.json() as Profile
      setProfile(current)
      setDisplayName(current.displayName)
      const [p, g] = await Promise.all([authenticatedFetch('/api/v1/users/me/preferences'), authenticatedFetch('/api/v1/users/me/nutrition-goals')])
      if (p.ok) {
        const value = await p.json() as Preferences
        setPrefs(value); setDietary(value.dietaryPreferenceCodes); setAllergies(value.allergyCodes.join(', '))
      }
      if (g.ok) { const values = await g.json() as Goal[]; if (values[0]) setGoal(values[0]) }
    }
    load().catch((error: Error) => { setMessage(error.message); setLoadError(true) }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!profile) return
    const week = weekMonday()
    void Promise.all([authenticatedFetch(`/api/v1/plans/${week}/nutrition`), authenticatedFetch(`/api/v1/plans/${week}`)])
      .then(async ([nutritionResponse, mealsResponse]) => {
        if (nutritionResponse.ok) setDays(await nutritionResponse.json() as DayNutrition[])
        if (mealsResponse.ok) setMeals(await mealsResponse.json() as PlannedMeal[])
      }).catch(() => {})
  }, [profile, page])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    try {
      const response = await authenticatedFetch('/api/v1/users/me', { method: 'PUT', body: JSON.stringify({ displayName }) })
      if (!response.ok) throw new Error('Impossible d’enregistrer le profil.')
      setProfile(await response.json() as Profile); setPage('home'); setMessage('Nom affiché enregistré.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function savePreferences(event: FormEvent) {
    event.preventDefault()
    try {
      const response = await authenticatedFetch('/api/v1/users/me/preferences', { method: 'PUT', body: JSON.stringify({ ...prefs, dietaryPreferenceCodes: dietary, allergyCodes: csv(allergies) }) })
      if (!response.ok) throw new Error('Impossible d’enregistrer les préférences.')
      const value = await response.json() as Preferences
      setPrefs(value); setDietary(value.dietaryPreferenceCodes); setAllergies(value.allergyCodes.join(', ')); setMessage('Préférences enregistrées.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function saveGoal(event: FormEvent) {
    event.preventDefault()
    try {
      const response = await authenticatedFetch('/api/v1/users/me/nutrition-goals', { method: 'PUT', body: JSON.stringify(goal) })
      if (!response.ok) throw new Error('Impossible d’enregistrer l’objectif.')
      setGoal(await response.json() as Goal); setMessage('Objectif enregistré.')
    } catch (error) { setMessage((error as Error).message) }
  }

  const username = String(keycloak.tokenParsed?.preferred_username ?? '')
  const name = profile?.displayName || username || 'vous'
  const nav = (id: Page, label: string, glyph: string) => <button type="button" className={`side-nav-item${page === id ? ' active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => { setPage(id); setMessage('') }}><span className="side-icon" aria-hidden="true">{glyph}</span>{label}</button>
  if (loading) return <main className="workspace-loading">Chargement de votre espace…</main>
  if (loadError) return <main className="workspace-loading"><div><p>{message}</p><button className="button-primary" onClick={() => window.location.reload()}>Réessayer</button></div></main>
  if (!profile) return <main className="onboarding"><div className="onboarding-card"><img src={logo} alt="TOQ" /><p className="eyebrow">Bienvenue chez TOQ</p><h1>Comment souhaitez-vous qu’on vous appelle ?</h1><p>Choisissez un pseudo avant d’accéder à votre espace. Vous pourrez le modifier plus tard dans Profil.</p><form onSubmit={saveProfile}><label>Pseudo obligatoire<input autoFocus value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={80} placeholder="Votre pseudo" required /></label><button className="button-primary" type="submit">Entrer dans TOQ</button></form>{message && <p className="form-message" role="status">{message}</p>}</div></main>
  return <div className="workspace">
    <aside className="sidebar">
      <div className="sidebar-logo-frame"><img src={logo} alt="TOQ" /></div>
      <nav aria-label="Navigation principale">{nav('home', 'Accueil', '⌂')}{nav('think', 'Nutrition', '◈')}{nav('planning', 'Planning', '▦')}{nav('recipes', 'Recettes', '▣')}{nav('social', 'Partager', '♡')}</nav>
      <div className="sidebar-bottom">{nav('profile', 'Profil', '♙')}{nav('settings', 'Paramètres', '⚙')}<button type="button" className="side-nav-item" onClick={() => keycloak.logout({ redirectUri: window.location.origin })}><span className="side-icon" aria-hidden="true">↪</span>Déconnexion</button></div>
    </aside>
    <main className="workspace-main" id="contenu">
      {message && <p className="form-message" role="status">{message}</p>}
      {page === 'home' && <HomeDashboard name={name} goal={goal} days={days} meals={meals} onPage={setPage} />}
      {page === 'think' && <div className="app-page"><header className="app-page-header"><p className="eyebrow">Think</p><h1>Objectifs et nutrition</h1><p>Analysez vos apports planifiés et gardez le cap.</p></header><div className="page-tabs"><a href="#resume">Vue d’ensemble</a><a href="#objectifs">Modifier les objectifs</a><a href="#nutrition">Explorer un produit</a></div><div id="resume"><ThinkSummary goal={goal} days={days} /></div><section className="workspace-card" id="objectifs"><h2>Définir mes objectifs</h2><form className="form-grid" onSubmit={saveGoal}><label>À partir du<input type="date" value={goal.validFrom} onChange={event => setGoal({ ...goal, validFrom: event.target.value })} required /></label><label>Jusqu’au<input type="date" value={goal.validTo ?? ''} onChange={event => setGoal({ ...goal, validTo: event.target.value || null })} /></label><label>Calories par jour<input type="number" min="0" value={goal.kcal ?? ''} onChange={event => setGoal({ ...goal, kcal: event.target.value ? Number(event.target.value) : null })} /></label><label>Protéines (g)<input type="number" min="0" value={goal.proteinG ?? ''} onChange={event => setGoal({ ...goal, proteinG: event.target.value ? Number(event.target.value) : null })} /></label><label>Glucides (g)<input type="number" min="0" value={goal.carbohydrateG ?? ''} onChange={event => setGoal({ ...goal, carbohydrateG: event.target.value ? Number(event.target.value) : null })} /></label><label>Lipides (g)<input type="number" min="0" value={goal.fatG ?? ''} onChange={event => setGoal({ ...goal, fatG: event.target.value ? Number(event.target.value) : null })} /></label><button type="submit" className="button-primary">Enregistrer l’objectif</button></form></section><div id="nutrition"><NutritionPage /></div></div>}
      {page === 'planning' && <PlanningPage />}
      {page === 'recipes' && <RecipePage />}
      {page === 'social' && <SocialPage />}
      {page === 'profile' && <section className="workspace-card"><p className="eyebrow">Profil</p><h1>Mon profil</h1><form className="form-grid" onSubmit={saveProfile}><label>Pseudo affiché<input value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={80} required /></label><button type="submit" className="button-primary">Enregistrer le profil</button></form></section>}
      {page === 'settings' && <section className="workspace-card"><p className="eyebrow">Paramètres</p><h1>Préférences alimentaires</h1><p className="section-note">Choisissez vos habitudes alimentaires. Elles resteront modifiables à tout moment.</p><form className="form-grid" onSubmit={savePreferences}><div className="wide-field"><details className="multi-select"><summary>Habitudes alimentaires <span>{dietary.length ? `${dietary.length} sélectionnée${dietary.length > 1 ? 's' : ''}` : 'Choisir'}</span></summary><div>{[...habits, ...dietary.filter(code => !habits.some(option => option[0] === code)).map(code => [code, code] as const)].map(([code, label]) => <label key={code}><input type="checkbox" checked={dietary.includes(code)} onChange={event => setDietary(current => event.target.checked ? [...current, code] : current.filter(value => value !== code))} />{label}</label>)}</div></details></div><label className="wide-field">Allergies, séparées par des virgules<input value={allergies} onChange={event => setAllergies(event.target.value)} placeholder="GLUTEN, PEANUT" /></label><button type="submit" className="button-primary">Enregistrer les préférences</button></form></section>}
    </main>
  </div>
}
