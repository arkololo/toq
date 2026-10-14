# Déployer TOQ sur Railway

## Cause de l'erreur actuelle

Le POM racine a le packaging `pom` : il agrège cinq applications et ne produit pas de JAR racine. Chaque module produit `services/<service>/target/app.jar`. Le build automatique observé ne conserve que `/app/target`, puis tente de lancer `target/*jar`. Changer uniquement la commande de démarrage ne suffit donc pas si les JAR des modules ne sont pas conservés dans l'image.

Le warning Maven concernant `-Pproduction` est indépendant : aucun profil Maven de ce nom n'existe. Les Dockerfiles construisent directement le module voulu sans ce profil et copient son JAR dans `/app/app.jar`.

## Services et chemins

Le fichier `railway.json` à la racine configure par défaut **frontend-edge** : builder Dockerfile, image frontend/Nginx et commande de démarrage Nginx explicite. Il évite l'auto-détection Maven sur le POM agrégateur lors de l'import du dépôt. Il configure uniquement ce service ; les API et Keycloak doivent sélectionner leur propre fichier dans Settings.

Pour le service créé lors de l'import de ce dépôt, dont `pom.xml` est à la racine Git :

1. Utiliser ce service comme `frontend-edge`.
2. Root Directory : `/` ; Railway Config File : `/railway.json`.
3. Variables : `PORT=8080` et `VITE_KEYCLOAK_URL=https://<domaine-public-keycloak>`.
4. Pousser le fichier racine puis lancer un **nouveau build** de ce commit. Un simple redémarrage de l'ancienne image conserverait l'erreur.

Dans les détails du nouveau déploiement, vérifier le builder `DOCKERFILE`, le chemin `frontend/Dockerfile.railway` et la commande Nginx. Railway indique la provenance des réglages avec une icône de fichier. Si le build exécute encore Maven ou si le démarrage contient `target/*jar`, la nouvelle configuration n'est pas appliquée au déploiement concerné.

Créer huit services dans le même projet et le même environnement : PostgreSQL, Keycloak, les cinq API, puis le frontend. Utiliser les noms ci-dessous pour correspondre au DNS privé attendu par Nginx. PostgreSQL est créé avec le template Railway et un volume persistant.

Pour les sept services construits depuis le dépôt, sélectionner le même dépôt et la même branche. **Root Directory doit être le répertoire contenant le POM parent**, car les Dockerfiles ont besoin de ses fichiers :

- Si le dépôt commence par `pom.xml`, `services/`, `frontend/` : laisser Root Directory vide (ou `/`).
- Si le dépôt contient ces fichiers dans `toq/` : Root Directory = `/toq`.

Dans Settings, renseigner **Railway Config File** pour chaque service :

| Service | Config File si le POM est à la racine | Dockerfile (relatif à Root Directory) |
| --- | --- | --- |
| user-service | /services/user-service/railway.json | services/user-service/Dockerfile |
| recipe-service | /services/recipe-service/railway.json | services/recipe-service/Dockerfile |
| nutrition-service | /services/nutrition-service/railway.json | services/nutrition-service/Dockerfile |
| planner-service | /services/planner-service/railway.json | services/planner-service/Dockerfile |
| social-service | /services/social-service/railway.json | services/social-service/Dockerfile |
| keycloak | /infra/keycloak/railway.json | infra/keycloak/Dockerfile |
| frontend-edge | /frontend/railway.json | frontend/Dockerfile.railway |

Si Root Directory est `/toq`, **préfixer les chemins Config File par `/toq`**, mais garder les chemins Dockerfile du tableau. Railway résout le fichier de configuration depuis la racine du dépôt, indépendamment de Root Directory.

Supprimer les anciennes commandes Build/Start personnalisées et les variables `RAILWAY_DOCKERFILE_PATH` contradictoires. Les fichiers JSON sélectionnent le builder Dockerfile et, pour les API, la commande `java -jar /app/app.jar`. Le frontend et Keycloak utilisent l'entrypoint de leur image.

Définir `PORT=8080` sur les sept services applicatifs. Les API gardent leur port de management 8081. Générer deux domaines publics HTTPS, avec le port cible 8080 : un pour `frontend-edge`, un pour `keycloak`.

## PostgreSQL

Créer les six bases et leurs utilisateurs séparés : `toq_user` / `toq_user_app`, `toq_recipe` / `toq_recipe_app`, `toq_nutrition` / `toq_nutrition_app`, `toq_planner` / `toq_planner_app`, `toq_social` / `toq_social_app`, `keycloak` / `keycloak_app`.

Le script existant `infra/postgres/init/001-databases.sql` réalise cette initialisation. L'exécuter **une seule fois sur une nouvelle instance dédiée**, depuis un client psql connecté comme administrateur à la base `postgres`. Ce script lit les secrets dans l'environnement du client psql : `TOQ_USER_DB_PASSWORD`, `TOQ_RECIPE_DB_PASSWORD`, `TOQ_NUTRITION_DB_PASSWORD`, `TOQ_PLANNER_DB_PASSWORD`, `TOQ_SOCIAL_DB_PASSWORD`, `KEYCLOAK_DB_PASSWORD`. Utiliser des valeurs distinctes générées pour Railway. Depuis la machine locale, utiliser les paramètres du TCP Proxy PostgreSQL, car le DNS privé Railway n'est accessible qu'aux conteneurs.

Exemple, depuis la racine du projet, après avoir renseigné ces variables et les variables de connexion psql :

```sh
psql -v ON_ERROR_STOP=1 -f infra/postgres/init/001-databases.sql
```

Flyway initialise ensuite les tables au démarrage de chaque API. Les migrations d'infrastructure locales ne sont pas automatiquement exécutées par le template PostgreSQL Railway.

## Keycloak

Configurer les variables de `keycloak` :

```text
PORT=8080
KC_DB_URL=jdbc:postgresql://<domaine-prive-postgres>:5432/keycloak
KC_DB_USERNAME=keycloak_app
KC_DB_PASSWORD=<secret de keycloak_app>
KC_HOSTNAME=https://<domaine-public-keycloak>
KC_HTTP_HOST=::
KC_BOOTSTRAP_ADMIN_USERNAME=toq-admin
KC_BOOTSTRAP_ADMIN_PASSWORD=<secret administrateur>
KC_CACHE=local
KC_DB_POOL_INITIAL_SIZE=2
KC_DB_POOL_MIN_SIZE=2
KC_DB_POOL_MAX_SIZE=10
```

L'image démarre en mode production avec HTTP interne et prise en charge des en-têtes du proxy Railway. Elle importe le realm TOQ au premier démarrage. Les imports au démarrage ne remplacent pas un realm déjà existant.

Dans la console d'administration Keycloak, sélectionner le realm **TOQ**, puis le client **toq-web**, et remplacer les valeurs locales :

- Valid redirect URIs : `https://<domaine-public-frontend>/*`
- Web origins : `https://<domaine-public-frontend>`
- Valid post logout redirect URIs : `https://<domaine-public-frontend>/*`

Conserver le client public, le flux Authorization Code et PKCE S256, ainsi que les scopes importés dont `toq-api-audience`.

## Les cinq API Java

Sur chaque service, définir les variables suivantes avec la base et l'utilisateur correspondants :

```text
PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://<domaine-prive-postgres>:5432/<base-du-service>
SPRING_DATASOURCE_USERNAME=<utilisateur-du-service>
SPRING_DATASOURCE_PASSWORD=<secret-du-service>
TOQ_OIDC_ISSUER_URI=https://<domaine-public-keycloak>/realms/TOQ
TOQ_OIDC_JWK_SET_URI=http://keycloak.railway.internal:8080/realms/TOQ/protocol/openid-connect/certs
TOQ_OIDC_AUDIENCE=toq-api
SERVER_ADDRESS=::
```

L'issuer doit correspondre exactement à celui des tokens, donc utiliser le domaine public HTTPS. La récupération des clés passe par le réseau privé.

Les appels entre services utilisent par défaut les noms Docker Compose. Sur `nutrition-service`, `planner-service` et `social-service`, ajouter cette variable `SPRING_APPLICATION_JSON` (une ligne) pour les remplacer :

```json
{"toq":{"recipe-base-url":"http://recipe-service.railway.internal:8080","user-base-url":"http://user-service.railway.internal:8080"}}
```

Les API n'ont pas besoin de domaine public. Leur readiness reste disponible sur le port privé de management 8081 ; ne configurer pas un healthcheck Railway sur le port 8080 avec un chemin actuator, puisque ces endpoints sont servis sur 8081.

## Frontend et proxy

Définir sur `frontend-edge` :

```text
PORT=8080
VITE_KEYCLOAK_URL=https://<domaine-public-keycloak>
```

Cette URL publique, sans suffixe `/realms/TOQ` et sans slash final, est injectée **au build** dans le frontend et dans la configuration de sécurité du proxy. Reconstruire le frontend après toute modification de l'URL.

Si le service frontend porte encore le nom `toq` lors de l'import du dépôt, ajouter la variable dans **toq → Variables**, dans l'environnement du déploiement. La valeur doit être l'URL publique du service **Keycloak**, par exemple `https://keycloak-production-xxxx.up.railway.app` (remplacer cet exemple par le domaine réel). Un fichier `.env` local ne configure pas ces variables Railway.

Si Keycloak n'est pas encore créé, suivre d'abord la section Keycloak et lui attribuer un domaine public ciblant le port 8080. Ajouter ensuite `VITE_KEYCLOAK_URL` au frontend, appliquer les modifications Railway et déclencher un nouveau build. L'argument Dockerfile est déjà déclaré ; le message `Missing VITE_KEYCLOAK_URL` signale une variable absente ou vide avant l'installation des dépendances.

Le Dockerfile Railway utilise une configuration Nginx dédiée : elle route les chemins API vers les cinq domaines `<service>.railway.internal:8080`, conserve les restrictions des endpoints internes et adapte la Content Security Policy au domaine Keycloak. Le DNS est relu périodiquement pour suivre les redéploiements des API. Le démarrage local conserve sa configuration Nginx et son URL Keycloak par défaut.

## Ordre et vérification

1. Déployer PostgreSQL et initialiser les bases.
2. Déployer Keycloak et configurer les URLs du client.
3. Déployer les cinq API avec leurs variables.
4. Déployer le frontend avec son domaine public.
5. Vérifier `https://<domaine-public-frontend>/healthz`, puis connexion, profil, recettes, nutrition, planning et partage. Le healthcheck frontend valide Nginx ; il ne garantit pas la disponibilité des API.

Les logs de build doivent indiquer l'utilisation des Dockerfiles. Les logs Java doivent montrer le démarrage Spring Boot et Flyway, puis l'écoute HTTP sur 8080. Si l'erreur de JAR est remplacée par une erreur de datasource ou d'issuer, vérifier les variables du service concerné.

## Documentation officielle

- [Railway : Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway : monorepos et chemins de configuration](https://docs.railway.com/deployments/monorepo)
- [Railway : configuration par fichier](https://docs.railway.com/config-as-code/reference)
- [Railway : réseau privé](https://docs.railway.com/networking/private-networking/how-it-works)
- [Keycloak : conteneurs](https://www.keycloak.org/server/containers)
- [Keycloak : proxy](https://www.keycloak.org/server/reverseproxy)
