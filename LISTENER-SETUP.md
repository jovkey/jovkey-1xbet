# 📡 Paiement Mobile Money « Listener » — Moov & T-Money (Togocel)

Ce moyen de paiement encaisse les **dépôts d'investissement** (et les abonnements Gold)
en Mobile Money **sans passerelle payante**. Le principe : le client envoie l'argent vers
une **puce relais** (SIM Moov / T-Money dans un téléphone Android que tu gardes), une app
Android **« Masterclass Listener »** lit le SMS de réception et le transmet au backend, qui
**valide automatiquement** le paiement après 4 barrières anti-fraude.

C'est l'équivalent « fait maison » de FedaPay : au lieu d'une clé API + webhook FedaPay,
on a **un jeton partagé + un webhook** appelé par le téléphone Listener.

---

## 1. Côté serveur (backend) — le jeton

Une **seule variable d'environnement** à définir sur le backend déployé :

```
SMS_DEVICE_TOKEN=<une longue chaîne aléatoire secrète>
```

- Génère une valeur forte (ex. 40+ caractères aléatoires).
- C'est le « mot de passe » que le téléphone Listener présente à chaque SMS.
- Sans elle, le webhook répond `401` et **aucun** paiement n'est validé.

> Rien d'autre à coder : le endpoint et les puces réceptrices existent déjà.

### Puces réceptrices déjà configurées

Dans `backend/src/checkout/receivers.ts` :

| Réseau | Numéro (puce relais) | Actif |
|---|---|---|
| **Moov** | `96530302` | ✅ |
| Moov (2ᵉ, réserve) | `86436058` | ❌ (mettre `active: true` le jour où la SIM + une règle Listener existent) |
| **T-Money (TOGOCEL)** | `71480354` | ✅ |

Pour ajouter/retirer une puce, édite ce fichier (`active: true/false`) — les clients cessent
aussitôt d'utiliser une puce désactivée, sans redéploiement de logique.

---

## 2. Côté téléphone — l'app « Masterclass Listener »

Installe l'APK sur le téléphone qui contient les SIM Moov + T-Money, accepte la permission
**SMS**, puis crée **une règle par réseau** (bouton **+ Règle**).

L'app poste, pour chaque SMS retenu :
```
POST <URL de la règle>
Authorization: Bearer <jeton de la règle>
Content-Type: application/json
{ "text": "<SMS intégral>", "from": "MoovMoney" }
```
Le backend lit `?receiver=` (quelle puce), décode le texte et valide. Le paramètre
`?receiver=` DOIT être présent dans l'URL pour dire **sur quelle SIM** le SMS est arrivé.

### Règle 1 — Moov

| Champ | Valeur |
|---|---|
| **Nom du projet** | `JOVKEY Moov` |
| **URL du webhook** | `https://api.TON-DOMAINE.com/api/checkout/webhook/sms-raw?receiver=96530302` |
| **Jeton (Bearer)** | la valeur **exacte** de `SMS_DEVICE_TOKEN` |
| **Expéditeur contient** | `Moov` (capte « MoovMoney » / « Flooz ») |
| **ID de carte SIM** | vide (ou l'`SIM id` lu dans le journal si les 2 SIM sont du même type) |

### Règle 2 — T-Money (Togocel / Mixx by Yas)

| Champ | Valeur |
|---|---|
| **Nom du projet** | `JOVKEY T-Money` |
| **URL du webhook** | `https://api.TON-DOMAINE.com/api/checkout/webhook/sms-raw?receiver=71480354` |
| **Jeton (Bearer)** | la **même** valeur de `SMS_DEVICE_TOKEN` |
| **Expéditeur contient** | `Mixx` (ou `Yas` / `T-Money`) |
| **ID de carte SIM** | vide, ou l'`SIM id` de la SIM T-Money |

> **HTTPS obligatoire.** L'app refuse d'envoyer vers une URL `http://` publique (elle
> n'accepte le `http://` que pour `localhost` / `192.168.x` / `10.x` en test local).

Après avoir saisi une règle, appuie sur **Tester** : tu dois voir « Serveur joignable ».
Puis, sur l'écran principal, **DÉMARRER L'ÉCOUTE**. Laisse le téléphone branché et
**désactive l'optimisation de batterie** pour l'app (Réglages → Batterie → Sans restriction).

---

## 3. Les 4 barrières anti-fraude (rappel — côté serveur, rien à configurer)

Dans `backend/src/checkout/checkout.service.ts` (`ingestRawSms`) :

1. **Expéditeur officiel** — un SMS venant d'un numéro ordinaire est rejeté (seuls
   « MoovMoney / Flooz / Mixx / T-Money / Yas » sont acceptés).
2. **Référence unique** — anti-rejeu du même reçu.
3. **Continuité du solde** — `ancien_solde + montant = nouveau_solde` au centime près
   (un faussaire ne connaît pas le solde exact de la puce). Incohérence → archivé pour
   vérification manuelle, **jamais** validé automatiquement.
4. **Concordance stricte** — numéro expéditeur + montant + puce réceptrice doivent
   correspondre à une transaction en attente déclarée par le client.

---

## 4. Activer / masquer le dépôt côté site (panel admin)

Dans **Tour de contrôle → Investisseurs**, l'interrupteur **« Dépôt Mobile Money
(Moov / T-Money) »** affiche ou masque le bouton « Recharger / Investir » des
investisseurs, en direct (SSE). Utile pour couper les dépôts quand le téléphone Listener
est hors service, sans rien redéployer.

Techniquement : réglage CMS `investor_mobile_money_enabled` (`{ enabled: true|false }`).
Absent = activé par défaut.

---

## 5. Test rapide (sans vrai paiement)

Depuis un terminal, simule un SMS reçu sur la puce Moov :

```bash
curl -X POST "https://api.TON-DOMAINE.com/api/checkout/webhook/sms-raw?receiver=96530302" \
  -H "Authorization: Bearer $SMS_DEVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "from": "MoovMoney", "text": "Transfert recu. Montant: 5 000 FCFA Expediteur: 22899043790 Nouveau solde Moov Money: 12 345,00 FCFA. Txn ID: 040726008443" }'
```

- `matched:true` → une transaction en attente concordante a été validée.
- `reason:"stored_for_later"` → SMS mis en réserve (aucune transaction déclarée encore).
- `401` → jeton incorrect (`SMS_DEVICE_TOKEN` ≠ jeton de la règle).
