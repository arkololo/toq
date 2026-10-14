import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { authenticatedFetch } from '../auth/keycloak'
import { ProtectedImage } from './ProtectedImage'

type Ingredient = { name: string; quantity: number; unit: string; kcal100g?: number | null; proteinG100g?: number | null; carbohydrateG100g?: number | null; fatG100g?: number | null }
type Recipe = { id: string; title: string; description: string | null; baseServings: number; ingredients: Ingredient[]; steps: string[]; version: number; hasImage: boolean; kcalPerServing: number | null; proteinGPerServing: number | null; carbohydrateGPerServing: number | null; fatGPerServing: number | null; sourceTemplateId: string | null }
type Nutrition = { complete: boolean; missingIngredients: string[]; totals: { kcalPerServing: number; proteinGPerServing: number; carbohydrateGPerServing: number; fatGPerServing: number } }
type IngredientRow = { name: string; quantity: string; unit: string }
type Form = { title: string; description: string; baseServings: number; ingredients: IngredientRow[]; steps: string; kcalPerServing: string; proteinGPerServing: string; carbohydrateGPerServing: string; fatGPerServing: string; sourceTemplateId: string | null; sourceImageUrl: string | null }
type TemplateSummary = { id: string; title: string; imageUrl: string | null }
type Template = TemplateSummary & { originalTitle: string; category: string; area: string; ingredients: { name: string; measure: string }[]; steps: string[]; translated: boolean }
const emptyIngredient = (): IngredientRow => ({ name: '', quantity: '', unit: 'g' })
const blank = (): Form => ({ title: '', description: '', baseServings: 2, ingredients: [emptyIngredient()], steps: '', kcalPerServing: '', proteinGPerServing: '', carbohydrateGPerServing: '', fatGPerServing: '', sourceTemplateId: null, sourceImageUrl: null })
const macroFields = [
  ['kcalPerServing', 'Calories (kcal)'], ['proteinGPerServing', 'Protéines (g)'],
  ['carbohydrateGPerServing', 'Glucides (g)'], ['fatGPerServing', 'Lipides (g)'],
] as const
const toForm = (recipe: Recipe): Form => ({ title: recipe.title, description: recipe.description ?? '', baseServings: recipe.baseServings,
  ingredients: recipe.ingredients.map(item => ({ name: item.name, quantity: String(item.quantity), unit: item.unit })), steps: recipe.steps.join('\n'),
  kcalPerServing: recipe.kcalPerServing == null ? '' : String(recipe.kcalPerServing), proteinGPerServing: recipe.proteinGPerServing == null ? '' : String(recipe.proteinGPerServing),
  carbohydrateGPerServing: recipe.carbohydrateGPerServing == null ? '' : String(recipe.carbohydrateGPerServing), fatGPerServing: recipe.fatGPerServing == null ? '' : String(recipe.fatGPerServing),
  sourceTemplateId: recipe.sourceTemplateId, sourceImageUrl: null })

function readQuantity(measure: string): IngredientRow {
  const normalized = measure.replace(',', '.').trim()
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/u)
  const fraction = normalized.match(/^(\d+)\/(\d+)\s*(.*)$/u)
  const decimal = normalized.match(/^(\d+(?:\.\d+)?)\s*(.*)$/u)
  const quantity = mixed ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
    : fraction ? Number(fraction[1]) / Number(fraction[2]) : decimal ? Number(decimal[1]) : 1
  const unit = (mixed?.[4] || fraction?.[3] || decimal?.[2] || 'portion').trim()
  return { name: '', quantity: String(quantity > 0 ? quantity : 1), unit: (unit || 'portion').slice(0, 20) }
}

export function RecipePage() {
  const [tab, setTab] = useState<'mine' | 'templates'>('mine')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [editor, setEditor] = useState(false)
  const [form, setForm] = useState<Form>(blank)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [nutrition, setNutrition] = useState<Nutrition | null>(null)
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [templateQuery, setTemplateQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)

  async function reload() {
    const response = await authenticatedFetch('/api/v1/recipes?size=50')
    if (!response.ok) throw new Error('Impossible de charger vos recettes.')
    setRecipes(await response.json() as Recipe[])
  }
  useEffect(() => { void Promise.resolve().then(reload).catch((error: Error) => setMessage(error.message)) }, [])
  useEffect(() => {
    if (!selected || editor) return
    authenticatedFetch(`/api/v1/nutrition/recipes/${selected.id}`).then(async response => { if (response.ok) setNutrition(await response.json() as Nutrition) }).catch(() => setNutrition(null))
  }, [selected, editor])

  async function loadTemplates(term = '') {
    setTemplateLoading(true)
    try {
      const response = await authenticatedFetch(`/api/v1/recipes/templates?query=${encodeURIComponent(term)}`)
      if (!response.ok) throw new Error('Le catalogue de plats est momentanément indisponible.')
      setTemplates(await response.json() as TemplateSummary[])
    } catch (error) { setMessage((error as Error).message) } finally { setTemplateLoading(false) }
  }
  async function openTemplate(id: string) {
    try {
      const response = await authenticatedFetch(`/api/v1/recipes/templates/${id}`)
      if (!response.ok) throw new Error('Ce plat ne peut pas être chargé.')
      setSelectedTemplate(await response.json() as Template)
    } catch (error) { setMessage((error as Error).message) }
  }
  function createFromTemplate(template: Template) {
    setSelected(null); setNutrition(null); setImageFile(null)
    setForm({ ...blank(), title: template.title.slice(0, 120), description: `Recette inspirée de TheMealDB · ${template.originalTitle}`.slice(0, 2000),
      ingredients: template.ingredients.map(item => ({ ...readQuantity(item.measure), name: item.name.slice(0, 120) })),
      steps: template.steps.map(step => step.slice(0, 2000)).join('\n'), sourceTemplateId: template.id, sourceImageUrl: template.imageUrl })
    setTab('mine'); setSelectedTemplate(null); setEditor(true)
    setMessage('Modèle chargé. La recette source est en anglais : vérifiez les ingrédients, les unités et les allergènes avant d’enregistrer.')
  }
  function edit(recipe: Recipe | null) {
    setSelected(recipe); setNutrition(null); setImageFile(null); setForm(recipe ? toForm(recipe) : blank()); setEditor(true); setMessage('')
  }
  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setForm(current => ({ ...current, ingredients: current.ingredients.map((item, position) => position === index ? { ...item, [field]: value } : item) }))
  }
  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as Partial<Recipe>
      if (typeof data.title !== 'string' || !Array.isArray(data.ingredients) || !Array.isArray(data.steps) || !data.ingredients.length || !data.steps.length) throw new Error('Format invalide')
      const imported: Recipe = { id: '', title: data.title, description: data.description ?? null, baseServings: Number(data.baseServings ?? 1),
        ingredients: data.ingredients, steps: data.steps, version: 0, hasImage: false, kcalPerServing: data.kcalPerServing ?? null,
        proteinGPerServing: data.proteinGPerServing ?? null, carbohydrateGPerServing: data.carbohydrateGPerServing ?? null,
        fatGPerServing: data.fatGPerServing ?? null, sourceTemplateId: null }
      if (!Number.isInteger(imported.baseServings) || imported.baseServings < 1) throw new Error('Portions invalides')
      setSelected(null); setNutrition(null); setImageFile(null); setForm(toForm(imported)); setEditor(true)
      setMessage('Recette importée. Vérifiez les données puis enregistrez-la.')
    } catch { setMessage('Ce fichier JSON ne contient pas une recette TOQ valide.') }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    const ingredients = form.ingredients.map(item => ({ name: item.name.trim(), quantity: Number(item.quantity.replace(',', '.')), unit: item.unit.trim() }))
    const steps = form.steps.split('\n').map(step => step.trim()).filter(Boolean)
    const values = macroFields.map(([key]) => form[key].trim())
    if (!ingredients.length || ingredients.some(item => !item.name || !Number.isFinite(item.quantity) || item.quantity <= 0 || !item.unit) || !steps.length) { setMessage('Vérifiez les ingrédients et les étapes.'); return }
    if (values.some(Boolean) && (!values.every(Boolean) || values.some(value => !Number.isFinite(Number(value.replace(',', '.'))) || Number(value.replace(',', '.')) < 0))) {
      setMessage('Renseignez les quatre valeurs nutritionnelles par portion, ou laissez les quatre champs vides.'); return
    }
    const macros = Object.fromEntries(macroFields.map(([key]) => [key, form[key] === '' ? null : Number(form[key].replace(',', '.'))]))
    try {
      const response = await authenticatedFetch(selected ? `/api/v1/recipes/${selected.id}` : '/api/v1/recipes', {
        method: selected ? 'PUT' : 'POST', body: JSON.stringify({ title: form.title, description: form.description || null, baseServings: form.baseServings, ingredients, steps, ...macros, sourceTemplateId: form.sourceTemplateId }),
      })
      if (!response.ok) throw new Error('La recette n’a pas pu être enregistrée.')
      const saved = await response.json() as Recipe
      let imageSaved = true
      if (form.sourceTemplateId && form.sourceImageUrl && !saved.hasImage) {
        imageSaved = (await authenticatedFetch(`/api/v1/recipes/${saved.id}/image/template/${form.sourceTemplateId}`, { method: 'PUT' })).ok
      } else if (imageFile) {
        const body = new FormData(); body.append('file', imageFile)
        imageSaved = (await authenticatedFetch(`/api/v1/recipes/${saved.id}/image`, { method: 'PUT', body })).ok
      }
      setSelected({ ...saved, hasImage: saved.hasImage || (imageSaved && !!(imageFile || form.sourceImageUrl)) })
      setNutrition(null); setEditor(false); setImageFile(null); await reload()
      setMessage(imageSaved ? 'Recette enregistrée.' : 'Recette enregistrée, mais la photo n’a pas pu être récupérée. Vous pouvez en choisir une en modifiant la recette.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function archive(recipe: Recipe) {
    try { const response = await authenticatedFetch(`/api/v1/recipes/${recipe.id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('La recette n’a pas pu être supprimée.'); setSelected(null); setNutrition(null); await reload(); setMessage('Recette supprimée.') }
    catch (error) { setMessage((error as Error).message) }
  }
  async function removeImage(recipe: Recipe) {
    const response = await authenticatedFetch(`/api/v1/recipes/${recipe.id}/image`, { method: 'DELETE' })
    if (response.ok) { setSelected({ ...recipe, hasImage: false }); await reload() }
    else setMessage('Impossible de supprimer cette photo.')
  }
  const visible = recipes.filter(recipe => recipe.title.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
  const showUpload = !form.sourceImageUrl && !(selected?.sourceTemplateId && selected.hasImage)

  return <div className="app-page">
    <header className="app-page-header"><p className="eyebrow">Cook</p><h1>Mes recettes</h1><p>Créez vos plats et découvrez des idées à cuisiner.</p></header>
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="page-tabs"><button className={tab === 'mine' ? 'selected' : ''} onClick={() => { setTab('mine'); setSelectedTemplate(null) }}>Mes recettes</button><button className={tab === 'templates' ? 'selected' : ''} onClick={() => { setTab('templates'); setEditor(false); setSelected(null); if (!templates.length) void loadTemplates() }}>Idées de plats en ligne</button></div>
    {tab === 'mine' && (editor ? <section className="workspace-card recipe-editor">
      <button className="text-button" onClick={() => setEditor(false)}>← Retour aux recettes</button><h2>{selected ? 'Modifier la recette' : 'Créer une recette'}</h2>
      <form className="form-grid" onSubmit={save}>
        <label>Nom du plat<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} maxLength={120} required /></label>
        <label>Portions de référence<input type="number" min="1" max="30" value={form.baseServings} onChange={event => setForm({ ...form, baseServings: Number(event.target.value) })} required /></label>
        <label className="wide-field">Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={2000} /></label>
        <fieldset className="wide-field ingredient-fieldset"><legend>Ingrédients</legend><p className="section-note">Une ligne par aliment. Les quantités servent aussi à générer la liste de courses.</p>
          {form.ingredients.map((ingredient, index) => <div className="ingredient-input-row" key={index}>
            <label>Aliment {index + 1}<input value={ingredient.name} onChange={event => updateIngredient(index, 'name', event.target.value)} maxLength={120} placeholder="Ex. tomate" required /></label>
            <label>Quantité<input type="number" min="0.001" step="any" value={ingredient.quantity} onChange={event => updateIngredient(index, 'quantity', event.target.value)} placeholder="2" required /></label>
            <label>Unité<input value={ingredient.unit} onChange={event => updateIngredient(index, 'unit', event.target.value)} maxLength={20} list="recipe-units" placeholder="g, pièce…" required /></label>
            <button type="button" aria-label={`Retirer l’aliment ${index + 1}`} onClick={() => setForm(current => ({ ...current, ingredients: current.ingredients.filter((_, position) => position !== index) }))} disabled={form.ingredients.length === 1}>×</button>
          </div>)}
          <datalist id="recipe-units"><option value="g" /><option value="kg" /><option value="ml" /><option value="l" /><option value="pièce" /><option value="cuillère à soupe" /><option value="cuillère à café" /><option value="tasse" /></datalist>
          <button className="button-secondary" type="button" onClick={() => setForm(current => ({ ...current, ingredients: [...current.ingredients, emptyIngredient()] }))}>+ Ajouter un ingrédient</button>
        </fieldset>
        <fieldset className="wide-field recipe-macros"><legend>Valeurs nutritionnelles par portion</legend><p className="section-note">Facultatif : renseignez les quatre valeurs ensemble. Elles s’appliquent au plat entier par portion, pas à chaque ingrédient.</p>
          <div>{macroFields.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="any" value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} placeholder="—" /></label>)}</div>
        </fieldset>
        <label className="wide-field">Étapes — une ligne par étape<textarea value={form.steps} onChange={event => setForm({ ...form, steps: event.target.value })} placeholder={'Laver les tomates.\nCuire le riz.'} required /></label>
        {form.sourceImageUrl && <div className="wide-field source-photo"><img src={form.sourceImageUrl} alt={`Photo du modèle ${form.title}`} /><p>Photo originale fournie par TheMealDB ; elle sera copiée dans votre recette.</p></div>}
        {showUpload && <label className="wide-field">Photo du plat (facultative, PNG ou JPEG, 3 Mo max.)<input type="file" accept="image/png,image/jpeg" onChange={event => setImageFile(event.target.files?.[0] ?? null)} />{imageFile && <small>{imageFile.name}</small>}</label>}
        <button className="button-primary" type="submit">Enregistrer la recette</button>
      </form>
    </section> : selected ? <section className="workspace-card"><button className="text-button" onClick={() => setSelected(null)}>← Toutes mes recettes</button>
      <div className="page-title"><div><p className="eyebrow">Fiche recette</p><h2>{selected.title}</h2><p className="section-note">{selected.baseServings} portion{selected.baseServings > 1 ? 's' : ''} · {selected.description}</p></div><button className="button-secondary" onClick={() => edit(selected)}>Modifier</button></div>
      {selected.hasImage && <ProtectedImage key={selected.id} url={`/api/v1/recipes/${selected.id}/image`} alt={`Photo de ${selected.title}`} className="recipe-hero-image" />}
      {selected.hasImage && <button className="text-button" onClick={() => removeImage(selected)}>Supprimer la photo</button>}
      {nutrition && (nutrition.complete || nutrition.missingIngredients.length < selected.ingredients.length) && <div className="nutrition-strip"><strong>{nutrition.totals.kcalPerServing} kcal / portion</strong><span>{nutrition.totals.proteinGPerServing} g protéines</span><span>{nutrition.totals.carbohydrateGPerServing} g glucides</span><span>{nutrition.totals.fatGPerServing} g lipides</span>{!nutrition.complete && <small>Calcul partiel : {nutrition.missingIngredients.join(', ')}</small>}</div>}
      {(!nutrition || (!nutrition.complete && nutrition.missingIngredients.length === selected.ingredients.length)) && <p className="section-note">Aucune valeur nutritionnelle renseignée pour ce plat.</p>}
      <div className="recipe-detail-grid"><div className="detail-panel"><h3>Ingrédients</h3>{selected.ingredients.map((item, index) => <p key={index}><span>{item.name}</span><strong>{item.quantity} {item.unit}</strong></p>)}</div><div className="detail-panel"><h3>Étapes</h3><ol>{selected.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></div></div>
      <button className="text-button danger" onClick={() => archive(selected)}>Supprimer cette recette</button>
    </section> : <section className="workspace-card"><div className="page-title"><div><h2>Mes plats</h2><p className="section-note">Retrouvez et préparez vos recettes.</p></div><div className="recipe-actions"><label className="import-file">Importer une recette JSON<input type="file" accept=".json,application/json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label><button className="button-primary" onClick={() => edit(null)}>+ Ajouter un plat</button></div></div>
      <label className="search-field">Rechercher<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom d’une recette" /></label>
      <div className="recipe-grid">{visible.map(recipe => <button className="recipe-tile recipe-button" key={recipe.id} onClick={() => { setNutrition(null); setSelected(recipe) }}>
        {recipe.hasImage && <ProtectedImage url={`/api/v1/recipes/${recipe.id}/image`} alt="" className="recipe-card-image" />}
        <span className="recipe-tile-body"><strong>{recipe.title}</strong><small>{recipe.baseServings} portions · {recipe.ingredients.length} ingrédients</small><span>{recipe.description || 'Voir la recette'}</span></span>
      </button>)}{visible.length === 0 && <p className="recipe-empty">{recipes.length ? 'Aucune recette ne correspond à votre recherche.' : 'Ajoutez votre première recette pour commencer.'}</p>}</div>
    </section>)}
    {tab === 'templates' && (selectedTemplate ? <section className="workspace-card template-detail"><button className="text-button" onClick={() => setSelectedTemplate(null)}>← Tous les modèles</button>
      {selectedTemplate.imageUrl && <img src={selectedTemplate.imageUrl} alt={selectedTemplate.title} />}
      <p className="eyebrow">TheMealDB · {selectedTemplate.category} · {selectedTemplate.area}</p><h2>{selectedTemplate.title}</h2>
      {selectedTemplate.originalTitle !== selectedTemplate.title && <p className="section-note">Titre original : {selectedTemplate.originalTitle}</p>}
      <p className="form-message">La recette source est affichée en anglais. Les unités tbs et tsp sont converties en français.</p>
      <div className="recipe-detail-grid"><div className="detail-panel"><h3>Ingrédients</h3>{selectedTemplate.ingredients.map((item, index) => <p key={index}><span>{item.name}</span><strong>{item.measure}</strong></p>)}</div><div className="detail-panel"><h3>Préparation</h3><ol>{selectedTemplate.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></div></div>
      <button className="button-primary" onClick={() => createFromTemplate(selectedTemplate)}>Créer ma version de ce plat</button><p className="section-note">Vérifiez les unités et les éventuels allergènes avant de cuisiner.</p>
    </section> : <section className="workspace-card"><div className="page-title"><div><h2>Idées de plats</h2><p className="section-note">Recherchez en français. Les mots recherchés sont convertis en anglais pour TheMealDB ; les recettes source restent dans leur langue d’origine.</p></div></div>
      <form className="template-search" onSubmit={(event: FormEvent) => { event.preventDefault(); void loadTemplates(templateQuery) }}><input value={templateQuery} onChange={event => setTemplateQuery(event.target.value)} maxLength={80} placeholder="Ex. poulet, tarte aux pommes" aria-label="Rechercher un plat en ligne" /><button className="button-primary" type="submit">Rechercher</button></form>
      {templateLoading && <p className="section-note">Chargement des plats…</p>}
      <div className="recipe-grid">{templates.map(template => <button className="recipe-tile recipe-button" key={template.id} onClick={() => openTemplate(template.id)}>{template.imageUrl && <img className="recipe-card-image" src={template.imageUrl} alt="" />}<span className="recipe-tile-body"><strong>{template.title}</strong><span>Voir les ingrédients et les étapes →</span></span></button>)}{!templateLoading && templates.length === 0 && <p className="section-note">Aucun plat trouvé. Essayez un autre terme.</p>}</div>
      <p className="template-credit">Recettes et photos : <a href="https://www.themealdb.com/" target="_blank" rel="noreferrer">TheMealDB</a>. Recherche française par mots-clés.</p>
    </section>)}
  </div>
}
