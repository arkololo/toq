# TOQ

TOQ réunit les recettes, les repères nutritionnels, le planning hebdomadaire, les courses et le partage. Le frontend React reprend la navigation latérale et les éléments fournis dans `base/Charte graphique`. L'application démarre localement avec Docker Compose ; [le guide Railway](docs/RAILWAY.md) décrit la configuration du déploiement distant.

## Démarrage

Prérequis : Docker Desktop en mode Linux et Docker Compose. Prévoir environ 8 Gio de mémoire pour les huit conteneurs.

Sous Windows, depuis la racine du dépôt :

```powershell
.\scripts\setup-local.ps1
docker compose --parallel 2 up -d --build --wait --wait-timeout 300
.\scripts\smoke-test.ps1
```

Sous Linux/macOS :

```sh
sh scripts/setup-local.sh
docker compose --parallel 2 up -d --build --wait --wait-timeout 300
sh scripts/smoke-test.sh
```

Ouvrir [TOQ](http://localhost:8080) et utiliser « Se connecter » pour créer un compte ou ouvrir une session. [La console Keycloak](http://localhost:8081/admin/) utilise le compte `toq-admin` et le secret local `KEYCLOAK_ADMIN_PASSWORD` stocké dans `.env`. Le script conserve les secrets existants et ajoute les clés manquantes sans effacer les données. Ne partagez pas `.env`.

Un volume PostgreSQL créé **avant** l'ajout du Social Service nécessite une seule migration d'infrastructure après `setup-local` :

```powershell
docker compose up -d --no-deps postgres
Get-Content infra/postgres/init/002-social-existing.sql -Raw | docker compose exec -T postgres psql -U toq_admin -d postgres
docker compose --parallel 2 up -d --build --wait --wait-timeout 300
```

Sur une installation neuve, cette étape n'est pas nécessaire. Ne lancez pas `docker compose down --volumes` pour une mise à jour courante : cela supprimerait les données locales.

## Utilisation

Les jauges nutritionnelles passent de l'orange au vert à la cible, puis au rouge si elle est dépassée. Quand une recette déjà planifiée change, ses repas sont actualisés à la prochaine consultation et la liste de courses doit être régénérée. Dans **Partager**, la photo de la recette est reprise automatiquement ; un nouvel upload peut la remplacer. L'onglet **Mes favoris** regroupe les publications enregistrées.

Au premier accès, choisir obligatoirement un pseudo ; il reste modifiable dans **Profil**, et le nouveau nom apparaît aussi sur les anciennes publications et commentaires. Dans **Paramètres**, cocher les habitudes alimentaires dans le menu déroulant ; saisir les allergies séparées par des virgules. La langue est le français et le fuseau horaire est Europe/Paris. **Nutrition** affiche les objectifs, les jauges et les apports des repas planifiés. La recherche par code-barres utilise Open Food Facts ; en cas de valeurs absentes, chercher et choisir un aliment générique équivalent dans CIQUAL. Les valeurs du produit restent celles d'OFF et les autres sont marquées « estimation CIQUAL ». Dans **Recettes**, chaque ingrédient a ses champs nom, quantité et unité ; les quatre valeurs nutritionnelles, facultatives, sont saisies ensemble **par portion** dans des champs séparés. On peut ajouter une photo PNG/JPEG, importer un fichier JSON TOQ ou partir d'un modèle TheMealDB. La photo TheMealDB est copiée automatiquement quand elle existe. La recherche française est convertie localement en mots-clés anglais ; les recettes TheMealDB restent dans leur langue source. **Planning** gère la semaine et génère une liste de courses consolidée, présentée par catégorie et imprimable. **Partager** publie une de vos recettes avec une photo facultative et permet aux autres utilisateurs de liker, commenter et enregistrer la publication en favori.

Le catalogue de modèles utilise les endpoints publics de [TheMealDB](https://www.themealdb.com/docs_api_guide.php) avec la clé de développement `1`, adaptée à l'usage local. La recherche française utilise un dictionnaire local de mots-clés ; les recettes et instructions originales ne sont pas retraduites. Les services Recipe et Nutrition possèdent une sortie réseau dédiée à TheMealDB et Open Food Facts ; les autres services métier restent sur les réseaux internes. Pour un déploiement public ultérieur, il faudra vérifier les conditions d'utilisation et les clés adaptées.

Le catalogue CIQUAL provient de **« Anses. 2025. Table de composition nutritionnelle des aliments Ciqual »**, [jeu de données officiel](https://doi.org/10.57745/RDMHWY), sous Licence Ouverte 2.0. Le script [import-ciqual-2025.py](scripts/import-ciqual-2025.py) produit la migration à partir du fichier français officiel et vérifie son empreinte. Les valeurs non numériques ou inférieures à une limite de détection restent inconnues ; aucune correspondance automatique entre un produit de marque et un aliment générique n'est présumée.

## Développement et vérification

```powershell
.\mvnw.cmd verify
cd frontend
npm ci
npm run lint
npm run test -- --run
npm run build
```

Les services utilisent Java 21, Spring Boot et des bases PostgreSQL séparées. L'API passe par Nginx sur `localhost:8080`; seul Keycloak est également accessible sur `localhost:8081`. Les services métier et PostgreSQL n'ont aucun port hôte. `docker compose ps` affiche leur état. `docker compose logs --tail 80 <service>` aide à diagnostiquer une panne.

Le déploiement de l'ensemble sur Railway est décrit dans [le guide Railway](docs/RAILWAY.md).

Les décisions et limites sont décrites dans [l'état du projet](docs/STATUS.md), [l'architecture](docs/architecture/ARCHITECTURE_PHASE_0.md) et [la sécurité locale](docs/SECURITY.md).
