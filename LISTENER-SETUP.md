# 📡 Paiement Mobile Money « Masterclass Listener » — Moov & T-Money (Togocel)

Encaisse les paiements en Mobile Money **sans passerelle payante** : le client envoie
l'argent vers une **puce relais** (SIM Moov / T-Money dans un téléphone Android que tu
gardes), l'app **« Masterclass Listener »** lit le SMS de réception et le transmet au
backend, qui **valide automatiquement** après 4 barrières anti-fraude.

C'est l'équivalent « fait maison » de FedaPay : au lieu d'une clé API + webhook FedaPay,
on a **un jeton partagé + un webhook**.

Utilisé pour : **dépôt d'investissement** (déjà en place) **et le Pack Gold** (nouveau,
activable/désactivable depuis le panel admin).

---

## 0. Tes vraies valeurs (à recopier telles quelles)

| Élément | Valeur RÉELLE |
|---|---|
| **Nom de l'app Android** | Masterclass Listener (relais SMS générique à règles) |
| **Domaine du backend** | `https://jovkey-1xbet.onrender.com` |
| **Chemin du webhook** | `/api/checkout/webhook/sms-raw` |
| **Webhook Moov** | `https://jovkey-1xbet.onrender.com/api/checkout/webhook/sms-raw?receiver=96530302` |
| **Webhook T-Money** | `https://jovkey-1xbet.onrender.com/api/checkout/webhook/sms-raw?receiver=71480354` |
| **Jeton (Bearer)** | `jovkey_sms_6836ac78c56f27082bb4999a8301f1443dd17f29d72faef3` |

> ⚠️ Le paramètre `?receiver=…` dans l'URL dit **sur quelle SIM** le SMS est arrivé.
> C'est pour ça qu'il y a **deux URL** (donc **deux règles** dans l'app), même si les deux
> SIM sont dans le **même téléphone** : chaque règle = une puce.

---

## 1. Côté serveur (Render) — le jeton

Le jeton est déjà écrit dans `backend/.env` :
```
SMS_DEVICE_TOKEN=jovkey_sms_6836ac78c56f27082bb4999a8301f1443dd17f29d72faef3
```
**Sur Render** (Dashboard → service `jovkey-1xbet` → Environment), ajoute la MÊME variable :
```
SMS_DEVICE_TOKEN = jovkey_sms_6836ac78c56f27082bb4999a8301f1443dd17f29d72faef3
```
puis **redéploie**. Sans elle, le webhook répond `401` et rien n'est validé.

### Puces réceptrices (déjà configurées) — `backend/src/checkout/receivers.ts`

| Réseau | Numéro (puce relais) | Actif |
|---|---|---|
| **Moov** | `96530302` | ✅ |
| Moov (2ᵉ, réserve) | `86436058` | ❌ |
| **T-Money (TOGOCEL)** | `71480354` | ✅ |

Les deux numéros actifs sont ceux affichés au client sur le site.

---

## 2. Côté téléphone — configurer l'app « Masterclass Listener »

Installe l'APK sur le téléphone qui contient les 2 SIM, accepte la permission **SMS**,
puis crée **une règle par réseau** (bouton **+ Règle**). L'app poste, pour chaque SMS
retenu :
```
POST <URL de la règle>
Authorization: Bearer <jeton de la règle>
Content-Type: application/json
{ "text": "<SMS intégral>", "from": "MoovMoney" }
```

### Règle 1 — Moov

| Champ (dans l'app) | Valeur à saisir |
|---|---|
| **Nom du projet** | `JOVKEY Moov` |
| **URL du webhook** | `https://jovkey-1xbet.onrender.com/api/checkout/webhook/sms-raw?receiver=96530302` |
| **Jeton (Bearer)** | `jovkey_sms_6836ac78c56f27082bb4999a8301f1443dd17f29d72faef3` |
| **Expéditeur contient** | `Moov` |
| **ID de carte SIM** | vide (sauf si les 2 SIM sont du même type — voir plus bas) |

### Règle 2 — T-Money (Togocel / Mixx by Yas)

| Champ (dans l'app) | Valeur à saisir |
|---|---|
| **Nom du projet** | `JOVKEY T-Money` |
| **URL du webhook** | `https://jovkey-1xbet.onrender.com/api/checkout/webhook/sms-raw?receiver=71480354` |
| **Jeton (Bearer)** | `jovkey_sms_6836ac78c56f27082bb4999a8301f1443dd17f29d72faef3` (le **même**) |
| **Expéditeur contient** | `Mixx` |
| **ID de carte SIM** | vide, ou l'`SIM id` de la SIM T-Money |

> **Filtre SIM (optionnel).** Comme Moov et T-Money ont des expéditeurs différents
> (« MoovMoney » vs « MixxByYas »), le champ **Expéditeur contient** suffit à ne pas
> mélanger les deux — laisse « ID de carte SIM » vide. Ne renseigne l'ID SIM que si un jour
> tu mets deux SIM du même opérateur : reçois un SMS, lis « SIM id … » dans le Journal de
> l'app, et recopie ce nombre.

Après chaque règle : **Tester** (doit afficher « Serveur joignable ») → écran principal →
**DÉMARRER L'ÉCOUTE**. Laisse le téléphone branché et **désactive l'optimisation de
batterie** pour l'app (Réglages → Batterie → Sans restriction). L'écoute redémarre seule
après un reboot.

> **HTTPS obligatoire** : l'app refuse d'envoyer vers une URL `http://` publique (elle
> n'accepte `http://` que pour `localhost` / `192.168.x` / `10.x` en test local). Ton URL
> Render est en `https://`, donc c'est bon — et **rien n'est jamais redirigé ailleurs** :
> l'app poste directement, uniquement, vers l'URL exacte de la règle.

---

## 3. Les 4 barrières anti-fraude (côté serveur — rien à configurer)

`backend/src/checkout/checkout.service.ts` → `ingestRawSms` :

1. **Expéditeur officiel** — un SMS d'un numéro ordinaire est rejeté (seuls
   MoovMoney / Flooz / Mixx / T-Money / Yas passent).
2. **Référence unique** — anti-rejeu du même reçu.
3. **Continuité du solde** — `ancien_solde + montant = nouveau_solde` au centime près
   (un faussaire ne connaît pas le solde exact). Incohérence → archivé pour vérification
   manuelle, jamais validé automatiquement.
4. **Concordance stricte** — numéro expéditeur + montant + puce doivent correspondre à
   une transaction en attente déclarée par le client. → validation **immédiate**.

---

## 4. Activer / masquer côté site (panel admin)

- **Pack Gold** — *Tour de contrôle → Textes & Tarifs → « Paiement Mobile Money — Pack
  Gold »* : interrupteur qui affiche/masque l'option Mobile Money sur l'inscription Gold et
  l'écran « finalise ton paiement ». (Réglage CMS `gold_mobile_money_enabled`, **absent =
  MASQUÉ** : par défaut le Gold n'affiche que Chariow ; active l'interrupteur quand le
  téléphone Listener est prêt et testé.)
- **Investissement** — le dépôt Mobile Money (Moov, T-Money **et international**) reste
  disponible comme avant, dans l'espace investisseur (bouton « Recharger / Investir »).

---

## 5. Test rapide (sans vrai paiement)

Simule un SMS reçu sur la puce Moov :

```bash
curl -X POST "https://jovkey-1xbet.onrender.com/api/checkout/webhook/sms-raw?receiver=96530302" \
  -H "Authorization: Bearer jovkey_sms_6836ac78c56f27082bb4999a8301f1443dd17f29d72faef3" \
  -H "Content-Type: application/json" \
  -d '{ "from": "MoovMoney", "text": "Transfert recu. Montant: 5 000 FCFA Expediteur: 22899043790 Nouveau solde Moov Money: 12 345,00 FCFA. Txn ID: 040726008443" }'
```

- `matched:true` → une transaction en attente concordante a été validée.
- `stored_for_later` → SMS mis en réserve (aucune transaction déclarée encore).
- `401` → jeton incorrect (la variable Render ≠ le jeton de la règle).
