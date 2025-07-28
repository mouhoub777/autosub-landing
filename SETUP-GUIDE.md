# Guide d'installation AutoSub Landing Page avec Firestore

## 🚀 Vue d'ensemble

Ce système AutoSub vous permet de créer des landing pages automatisées avec :
- **Inscriptions automatiques** stockées dans Firestore
- **Emails de confirmation** automatiques
- **Rappels WhatsApp** via 360 Dialog
- **Rappels Telegram** 
- **Dashboard de statistiques**

## 📋 Prérequis

1. **Compte Google/Firebase** 
2. **Compte 360 Dialog** pour WhatsApp Business API
3. **Bot Telegram** (optionnel)
4. **Compte email SMTP** (Gmail recommandé)

## 🔧 Installation étape par étape

### 1. Configuration Firebase

1. **Créer un projet Firebase** :
   ```bash
   # Aller sur https://console.firebase.google.com
   # Créer un nouveau projet "autosub-landing"
   ```

2. **Activer Firestore** :
   - Dans la console Firebase, aller à `Firestore Database`
   - Cliquer sur "Créer une base de données"
   - Choisir "Commencer en mode test" (nous configurerons les règles plus tard)

3. **Activer Firebase Storage** :
   - Aller à `Storage`
   - Cliquer sur "Commencer"

4. **Configurer l'authentification** (optionnel pour l'admin) :
   - Aller à `Authentication`
   - Activer "Email/Password"

### 2. Configuration Firestore

1. **Créer les collections** :
   ```javascript
   // Collections à créer (automatiquement créées lors du premier ajout)
   - landingPages
   - registrations 
   - emailLogs
   ```

2. **Règles de sécurité Firestore** :
   ```javascript
   // Copier les règles depuis firestore-structure.md
   // Dans la console Firebase > Firestore > Règles
   ```

3. **Index composites** :
   ```javascript
   // Firebase créera automatiquement les index nécessaires
   // Ou les créer manuellement via la console
   ```

### 3. Configuration 360 Dialog (WhatsApp)

1. **Créer un compte 360 Dialog** :
   ```bash
   # Aller sur https://www.360dialog.com
   # S'inscrire et configurer WhatsApp Business API
   ```

2. **Obtenir l'API Key** :
   ```bash
   # Dans le dashboard 360 Dialog
   # Copier votre API Key
   ```

3. **Configurer le webhook** :
   ```bash
   # URL du webhook (sera l'URL de votre fonction Cloud)
   # https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/whatsappWebhook
   ```

### 4. Configuration Firebase Functions

1. **Installer Firebase CLI** :
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialiser le projet** :
   ```bash
   mkdir autosub-functions
   cd autosub-functions
   firebase init functions
   ```

3. **Installer les dépendances** :
   ```bash
   cd functions
   npm install axios nodemailer
   ```

4. **Copier le code des fonctions** :
   ```bash
   # Copier le contenu de cloud-functions-example.js dans functions/index.js
   ```

5. **Configurer les variables d'environnement** :
   ```bash
   # Email configuration
   firebase functions:config:set email.user="your-email@gmail.com"
   firebase functions:config:set email.password="your-app-password"
   
   # 360 Dialog configuration
   firebase functions:config:set dialog360.apikey="your-360dialog-api-key"
   firebase functions:config:set dialog360.webhook="your-webhook-url"
   
   # Telegram configuration (optionnel)
   firebase functions:config:set telegram.bottoken="your-telegram-bot-token"
   ```

6. **Déployer les fonctions** :
   ```bash
   firebase deploy --only functions
   ```

### 5. Configuration du HTML

1. **Mettre à jour la configuration Firebase** :
   ```javascript
   // Dans autosub-landing-complete.html
   // Remplacer la config Firebase par la vôtre
   const firebaseConfig = {
     apiKey: "VOTRE_API_KEY",
     authDomain: "VOTRE_PROJECT.firebaseapp.com",
     projectId: "VOTRE_PROJECT_ID",
     storageBucket: "VOTRE_PROJECT.appspot.com",
     messagingSenderId: "VOTRE_SENDER_ID",
     appId: "VOTRE_APP_ID"
   };
   ```

2. **Héberger le HTML** :
   ```bash
   # Option 1: Firebase Hosting
   firebase init hosting
   firebase deploy --only hosting
   
   # Option 2: Hébergement web classique
   # Uploader autosub-landing-complete.html sur votre serveur
   ```

## 🔑 Configuration des comptes de service

### Gmail App Password

1. **Activer la 2FA** sur votre compte Gmail
2. **Générer un mot de passe d'application** :
   - Aller dans `Compte Google > Sécurité`
   - `Mots de passe des applications`
   - Générer un nouveau mot de passe
   - Utiliser ce mot de passe dans la config Firebase

### 360 Dialog Setup

1. **Vérifier le numéro WhatsApp Business**
2. **Obtenir l'approbation Meta** pour l'API
3. **Configurer les templates de messages** (optionnel)

### Bot Telegram (optionnel)

1. **Créer un bot** via @BotFather
2. **Obtenir le token**
3. **Configurer les commandes du bot**

## 📊 Structure des données Firestore

### Collection `landingPages`
```javascript
{
  brandName: "Mon Entreprise",
  eventType: "webinaire", 
  liveDate: timestamp,
  emailContent: "Contenu de l'email...",
  reminderWhatsApp: {
    enabled: true,
    minutesBefore: 30
  },
  // ... autres champs
}
```

### Collection `registrations`  
```javascript
{
  firstName: "Jean",
  email: "jean@example.com",
  phoneNumber: "+33612345678",
  reminderType: "whatsapp",
  landingPageId: "abc123",
  emailSent: true,
  reminderSent: false,
  // ... autres champs
}
```

## 🧪 Test du système

### 1. Test de création de landing page
```javascript
// Remplir le formulaire de création
// Vérifier que les données sont sauvées dans Firestore
```

### 2. Test d'inscription
```javascript
// S'inscrire via le modal
// Vérifier l'email de confirmation
// Vérifier l'enregistrement dans Firestore
```

### 3. Test des rappels
```javascript
// Programmer un live dans 30 minutes
// Activer les rappels WhatsApp
// Vérifier que le rappel est envoyé automatiquement
```

## 🚨 Dépannage

### Erreurs communes

1. **Firebase non initialisé** :
   ```javascript
   // Vérifier la configuration dans autosub-landing-complete.html
   // Vérifier les règles Firestore
   ```

2. **Emails non envoyés** :
   ```bash
   # Vérifier la config email dans Firebase Functions
   firebase functions:config:get
   ```

3. **WhatsApp non fonctionnel** :
   ```javascript
   // Vérifier l'API key 360 Dialog
   // Vérifier le webhook configuré
   ```

### Logs de débogage

```bash
# Voir les logs des fonctions
firebase functions:log

# Voir les logs en temps réel
firebase functions:log --only sendEmail
```

## 📈 Monitoring et statistiques

### Dashboard personnalisé
```javascript
// Utiliser getLandingPageStats pour créer un dashboard
// Monitorer les taux de conversion
// Suivre les livraisons d'emails/WhatsApp
```

### Métriques importantes
- Taux d'inscription
- Taux de livraison d'emails  
- Taux de livraison WhatsApp
- Engagement des utilisateurs

## 🔒 Sécurité

### Règles Firestore
```javascript
// Appliquer les règles de sécurité strictes
// Limiter l'accès en lecture/écriture
```

### Variables d'environnement
```bash
# Jamais exposer les clés API dans le code frontend
# Utiliser Firebase Functions config
```

## 🚀 Mise en production

### Checklist de déploiement
- [ ] Config Firebase mise à jour
- [ ] Fonctions Cloud déployées
- [ ] Variables d'environnement configurées
- [ ] Règles Firestore appliquées
- [ ] Tests de bout en bout réussis
- [ ] Monitoring activé

### Performance
```javascript
// Optimiser les requêtes Firestore
// Utiliser la mise en cache côté client
// Compresser les images avant upload
```

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs Firebase Functions
2. Tester les API endpoints manuellement
3. Vérifier la configuration Firestore
4. Consulter la documentation 360 Dialog

---

✅ **Système prêt !** Vous pouvez maintenant créer des landing pages automatisées avec inscriptions, emails et rappels WhatsApp/Telegram entièrement automatisés.