# 🚀 Guide de Configuration AutoSub

## 📋 Résumé des changements apportés

Votre système AutoSub est maintenant configuré pour :

✅ **Capture des données utilisateur** : `firstName`, `email`, `whatsappNumber`  
✅ **Contenu email personnalisé** par le créateur  
✅ **Formatage automatique** des numéros WhatsApp pour 360dialog  
✅ **Automatisation complète** : emails + rappels WhatsApp  
✅ **Structure Firestore optimisée** pour l'intégration avec 360dialog  

## 🔧 Étapes de configuration

### 1. Configuration Firebase Functions

```bash
# Dans le dossier functions/
npm install
```

### 2. Configuration des variables d'environnement

```bash
# Email configuration
firebase functions:config:set email.user="votre-email@gmail.com"
firebase functions:config:set email.password="votre-mot-de-passe-app"
firebase functions:config:set email.from="noreply@votre-domaine.com"

# 360Dialog configuration  
firebase functions:config:set whatsapp.api_key="VOTRE_360DIALOG_API_KEY"
firebase functions:config:set whatsapp.channel_id="VOTRE_CHANNEL_ID"
```

### 3. Déploiement des Functions

```bash
firebase deploy --only functions
```

### 4. Configuration des règles Firestore

Dans la console Firebase > Firestore > Règles :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /landingPages/{landingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /registrations/{registrationId} {
      allow create: if true;
      allow read, update: if request.auth != null;
    }
    
    match /emailQueue/{emailId} {
      allow read, write: if request.auth != null;
    }
    
    match /whatsappQueue/{whatsappId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Création des index Firestore

Dans la console Firebase > Firestore > Index, créez ces index composites :

**Collection `registrations`:**
- `landingPageId` (ASC), `registeredAt` (DESC)
- `emailSent` (ASC), `registeredAt` (ASC)
- `reminderScheduled` (ASC), `liveDate` (ASC)

**Collection `emailQueue`:**
- `status` (ASC), `scheduledFor` (ASC)

**Collection `whatsappQueue`:**
- `status` (ASC), `scheduledFor` (ASC)

## 📱 Configuration 360Dialog

### 1. Obtenir les clés API

1. Connectez-vous à votre compte 360Dialog
2. Récupérez votre **API Key** 
3. Récupérez votre **Channel ID**

### 2. Configuration des templates (optionnel)

Créez un template dans 360Dialog pour les rappels :

**Nom du template :** `live_reminder`  
**Catégorie :** `UTILITY`  
**Langue :** `fr`

**Contenu :**
```
🎯 Rappel : Votre {{1}} "{{2}}" commence dans {{3}} !

📅 Rendez-vous dans quelques minutes.

À tout de suite ! 🚀
```

**Variables :**
1. `{{1}}` = Type d'événement (live, masterclass, etc.)
2. `{{2}}` = Nom de l'événement  
3. `{{3}}` = Temps restant (15 minutes)

## 📧 Configuration Email

### Option 1: Gmail (simple)

1. Activez l'authentification à 2 facteurs sur Gmail
2. Générez un mot de passe d'application
3. Utilisez ce mot de passe dans les variables d'environnement

### Option 2: SendGrid (recommandé)

Modifiez `functions/index.js` :

```javascript
const transporter = nodemailer.createTransporter({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: functions.config().sendgrid.api_key
  }
});
```

Configuration :
```bash
firebase functions:config:set sendgrid.api_key="VOTRE_SENDGRID_API_KEY"
```

## 🔄 Flux automatisé

### Lors d'une inscription :

1. **Frontend** → Sauvegarde dans `registrations`
2. **Trigger** → `onRegistrationCreated` se déclenche automatiquement
3. **Email** → Ajouté à `emailQueue` pour envoi immédiat
4. **WhatsApp** → Ajouté à `whatsappQueue` pour envoi programmé

### Traitement automatique :

- **Emails** : Traités toutes les minutes par `processEmailQueue`
- **WhatsApp** : Traités toutes les minutes par `processWhatsAppQueue`

## 🎯 Champs capturés pour 360Dialog

```javascript
{
  firstName: "Jean",                    // ✅ Prénom utilisateur
  email: "jean@example.com",           // ✅ Email utilisateur  
  whatsappNumber: "+33612345678",      // ✅ Numéro formaté pour 360dialog
  reminderType: "whatsapp",            // ✅ Type de rappel choisi
  emailContent: "Contenu personnalisé..." // ✅ Message du créateur
}
```

## 🎨 Utilisation dans votre HTML

Remplacez le script dans votre HTML par le contenu de `landing-page-script.js` que nous avons créé.

Le script gère automatiquement :
- ✅ Formatage des numéros WhatsApp
- ✅ Sauvegarde structurée dans Firestore  
- ✅ Déclenchement de l'automatisation
- ✅ Interface utilisateur adaptée

## 🔍 Monitoring

### Logs des emails :
```bash
firebase functions:log --only=processEmailQueue
```

### Logs des WhatsApp :
```bash
firebase functions:log --only=processWhatsAppQueue  
```

### Console Firestore :
- Vérifiez les collections `emailQueue` et `whatsappQueue`
- Surveillez les statuts : `pending`, `sent`, `failed`

## 🚨 Dépannage

### Problème d'envoi email :
1. Vérifiez les variables d'environnement
2. Consultez les logs : `firebase functions:log`
3. Testez avec un email simple

### Problème WhatsApp 360Dialog :
1. Vérifiez votre quota 360Dialog
2. Testez l'API avec Postman
3. Vérifiez le format des numéros (+33...)

### Problème de déclenchement :
1. Vérifiez les règles Firestore
2. Consultez les logs des triggers
3. Testez manuellement depuis la console

## 📊 Structure finale des données

Votre Firestore contiendra maintenant :

```
📁 landingPages/
   └── 📄 {id} (données de la landing page + emailContent)

📁 registrations/  
   └── 📄 {id} (inscription complète avec whatsappNumber formaté)

📁 emailQueue/
   └── 📄 {id} (emails en attente d'envoi)

📁 whatsappQueue/
   └── 📄 {id} (messages WhatsApp programmés pour 360dialog)
```

🎉 **Votre système AutoSub est maintenant prêt pour une automatisation complète avec 360Dialog !**