import { useState } from 'react'
import type { FormEvent } from 'react'
import { authenticatedFetch } from '../auth/keycloak'

type Product = { barcode: string; name: string; kcal100g: number | null; proteinG100g: number | null; carbohydrateG100g: number | null; fatG100g: number | null; allergens: string; labels: string; cached: boolean }
type CiqualFood = { code: string; name: string; kcal100g: number | null; proteinG100g: number | null; carbohydrateG100g: number | null; fatG100g: number | null }
const nutrients = [
  ['kcal100g', 'Énergie', 'kcal'], ['proteinG100g', 'Protéines', 'g'],
  ['carbohydrateG100g', 'Glucides', 'g'], ['fatG100g', 'Lipides', 'g'],
] as const

export function NutritionPage() {
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [ciqualQuery, setCiqualQuery] = useState('')
  const [candidates, setCandidates] = useState<CiqualFood[]>([])
  const [equivalent, setEquivalent] = useState<CiqualFood | null>(null)
  const [message, setMessage] = useState('')
  const [ciqualMessage, setCiqualMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [ciqualLoading, setCiqualLoading] = useState(false)

  async function searchProduct(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{8,14}$/.test(barcode)) { setMessage('Saisissez un code-barres de 8 à 14 chiffres.'); return }
    setLoading(true); setMessage(''); setProduct(null); setEquivalent(null); setCandidates([])
    try {
      const response = await authenticatedFetch(`/api/v1/nutrition/products/${barcode}`)
      if (response.status === 404) throw new Error('Aucun produit OFF trouvé. Vous pouvez chercher un aliment équivalent dans CIQUAL ci-dessous.')
      if (!response.ok) throw new Error('La recherche du produit est momentanément indisponible.')
      setProduct(await response.json() as Product)
    } catch (error) { setMessage((error as Error).message) } finally { setLoading(false) }
  }
  async function searchCiqual(event: FormEvent) {
    event.preventDefault()
    if (ciqualQuery.trim().length < 2) { setCiqualMessage('Saisissez au moins deux caractères.'); return }
    setCiqualLoading(true); setCiqualMessage(''); setCandidates([])
    try {
      const response = await authenticatedFetch(`/api/v1/nutrition/ciqual?query=${encodeURIComponent(ciqualQuery.trim())}`)
      if (!response.ok) throw new Error('La recherche CIQUAL est momentanément indisponible.')
      const results = await response.json() as CiqualFood[]
      setCandidates(results)
      if (!results.length) setCiqualMessage('Aucun aliment trouvé. Essayez un terme plus générique.')
    } catch (error) { setCiqualMessage((error as Error).message) } finally { setCiqualLoading(false) }
  }
  const missing = product && nutrients.some(([key]) => product[key] == null)
  return <section className="workspace-card nutrition-page">
    <div className="page-title"><div><p className="eyebrow">Think · Explorer</p><h2>Comprendre les aliments</h2><p className="section-note">Identifiez un produit avec Open Food Facts et complétez ses données manquantes avec un aliment équivalent CIQUAL.</p></div></div>
    <form className="nutrition-search" onSubmit={searchProduct}><label>Code-barres du produit<input value={barcode} onChange={event => setBarcode(event.target.value.replace(/\D/g, ''))} maxLength={14} placeholder="Ex. 3274080005003" inputMode="numeric" /></label><button className="button-primary" type="submit" disabled={loading}>{loading ? 'Recherche…' : 'Rechercher'}</button></form>
    {message && <p className="form-message" role="status">{message}</p>}
    {product && <div className="nutrition-result"><div><span className="eyebrow">Produit · Open Food Facts</span><h3>{product.name}</h3><p>Code-barres {product.barcode}</p></div>
      <div className="nutrition-values">{nutrients.map(([key, label, unit]) => {
        const offValue = product[key]
        const estimated = offValue == null ? equivalent?.[key] ?? null : null
        return <div key={key}><strong>{offValue ?? estimated ?? 'Non renseigné'}{offValue != null || estimated != null ? ` ${unit}` : ''}</strong><span>{label} / 100 g</span><small>{offValue != null ? 'Produit · OFF' : estimated != null ? 'Estimation · CIQUAL' : 'Donnée absente'}</small></div>
      })}</div>
      <div className="nutrition-facts"><p><strong>Allergènes</strong><span>{product.allergens || 'Non renseignés par OFF'}</span></p><p><strong>Labels</strong><span>{product.labels || 'Non renseignés par OFF'}</span></p></div>
      {missing && <p className="ciqual-warning">Des valeurs OFF manquent. Choisissez ci-dessous un aliment générique équivalent : ses valeurs seront affichées comme estimation, sans modifier celles du produit.</p>}
      {equivalent && <small>Équivalent choisi : {equivalent.name} · code CIQUAL {equivalent.code}. Les allergènes ne sont jamais déduits de cet équivalent.</small>}
    </div>}
    <div className="ciqual-browser"><div><p className="eyebrow">Référence française</p><h3>Rechercher dans CIQUAL 2025</h3><p className="section-note">Recherchez un type d’aliment, par exemple « riz cuit » ou « carotte ». La correspondance avec un produit de marque doit être vérifiée par vous.</p></div>
      <form className="nutrition-search" onSubmit={searchCiqual}><label>Aliment équivalent<input value={ciqualQuery} onChange={event => setCiqualQuery(event.target.value)} maxLength={80} placeholder="Ex. riz blanc cuit" /></label><button className="button-secondary" type="submit" disabled={ciqualLoading}>{ciqualLoading ? 'Recherche…' : 'Chercher dans CIQUAL'}</button></form>
      {ciqualMessage && <p className="form-message" role="status">{ciqualMessage}</p>}
      {candidates.length > 0 && <div className="ciqual-results" role="listbox" aria-label="Résultats CIQUAL">{candidates.map(food => <button type="button" role="option" aria-selected={equivalent?.code === food.code} className={equivalent?.code === food.code ? 'selected' : ''} key={food.code} onClick={() => setEquivalent(food)}><strong>{food.name}</strong><small>{food.kcal100g ?? '—'} kcal · {food.proteinG100g ?? '—'} g protéines / 100 g</small><span>{equivalent?.code === food.code ? 'Sélectionné' : 'Choisir cet équivalent'}</span></button>)}</div>}
      {equivalent && <div className="nutrition-result ciqual-selection" aria-live="polite"><div><span className="eyebrow">{product ? 'Équivalent retenu · estimation CIQUAL' : 'Aliment générique · CIQUAL 2025'}</span><h3>{equivalent.name}</h3><p>Code CIQUAL {equivalent.code}</p></div><div className="nutrition-values">{nutrients.map(([key, label, unit]) => <div key={key}><strong>{equivalent[key] == null ? 'Non renseigné' : `${equivalent[key]} ${unit}`}</strong><span>{label} / 100 g</span><small>Valeur CIQUAL</small></div>)}</div>{product && <small>Seules les valeurs absentes du produit OFF sont utilisées comme estimation.</small>}</div>}
      <small>Source : Anses. 2025. Table de composition nutritionnelle des aliments Ciqual. Valeurs pour 100 g ; les valeurs manquantes ne sont pas estimées.</small>
    </div>
  </section>
}
