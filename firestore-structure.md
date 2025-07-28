# Structure Firestore pour AutoSub

## Collections principales

### 1. Collection `landingPages`
Stocke les informations de chaque landing page créée.

```javascript
// Document ID: généré automatiquement
{
  // Informations de base
  brandName: "string",           // Nom de la marque
  eventType: "string",           // Type d'événement (live/masterclass/webinaire)
  subtitle: "string",            // Sous-titre (HTML depuis Quill)
  description: "string",         // Description (HTML depuis Quill)
  
  // Images
  logoUrl: "string",             // URL du logo uploadé
  trainerImageUrl: "string",     // URL de l'image du formateur
  thirdImageUrl: "string",       // URL de l'image supplémentaire
  
  // Design
  backgroundColor: "string",      // Couleur de fond (#ffffff)
  borderColor: "string",         // Couleur de bordure (#ffd600)
  
  // Informations du formateur
  trainerName: "string",         // Nom du formateur
  trainerIntro: "string",        // Introduction du formateur (HTML depuis Quill)
  
  // Date et heure
  liveDate: "timestamp",         // Date et heure du live
  
  // Configuration email
  emailContent: "string",        // Contenu de l'email à envoyer après inscription
  
  // Liens externes
  googleFormUrl: "string",       // Lien Google Forms (optionnel)
  
  // Configuration des rappels
  reminderTelegram: {
    enabled: "boolean",          // Si les rappels Telegram sont activés
    minutesBefore: "number"      // Minutes avant le live (15, 30, 45, 60, 120)
  },
  reminderWhatsApp: {
    enabled: "boolean",          // Si les rappels WhatsApp sont activés
    minutesBefore: "number"      // Minutes avant le live (15, 30, 60)
  },
  
  // Métadonnées
  createdAt: "timestamp",        // Date de création
  isActive: "boolean",           // Si la landing page est active
  pageId: "string"               // ID unique de la page
}
```

### 2. Collection `registrations`
Stocke les inscriptions de chaque utilisateur.

```javascript
// Document ID: généré automatiquement
{
  // Informations utilisateur
  firstName: "string",           // Prénom
  email: "string",               // Email
  phoneNumber: "string",         // Numéro WhatsApp (optionnel)
  
  // Type de rappel choisi
  reminderType: "string",        // "whatsapp", "telegram", ou "none"
  
  // Référence à la landing page
  landingPageId: "string",       // ID de la landing page
  
  // Informations copiées de la landing page (pour l'email)
  brandName: "string",           // Nom de la marque
  eventType: "string",           // Type d'événement
  liveDate: "timestamp",         // Date du live
  trainerName: "string",         // Nom du formateur
  emailContent: "string",        // Contenu de l'email
  
  // Statuts
  emailSent: "boolean",          // Si l'email de confirmation a été envoyé
  emailSentAt: "timestamp",      // Quand l'email a été envoyé
  reminderSent: "boolean",       // Si le rappel a été envoyé
  reminderSentAt: "timestamp",   // Quand le rappel a été envoyé
  
  // Métadonnées
  registeredAt: "timestamp",     // Date d'inscription
  registrationId: "string",      // ID unique de l'inscription
  userAgent: "string",           // Navigateur utilisé
  ipAddress: "string"            // Adresse IP (si disponible)
}
```

### 3. Collection `emailLogs`
Stocke les logs des emails envoyés pour le suivi.

```javascript
// Document ID: généré automatiquement
{
  registrationId: "string",      // ID de l'inscription
  landingPageId: "string",       // ID de la landing page
  recipientEmail: "string",      // Email du destinataire
  emailType: "string",           // "registration_confirmation" ou "reminder"
  
  // Contenu de l'email
  subject: "string",             // Sujet de l'email
  htmlContent: "string",         // Contenu HTML
  
  // Statuts
  sent: "boolean",               // Si l'email a été envoyé
  sentAt: "timestamp",           // Quand l'email a été envoyé
  error: "string",               // Message d'erreur si échec
  
  // Métadonnées pour 360 Dialog / WhatsApp
  messageId: "string",           // ID du message pour le tracking
  deliveryStatus: "string"       // "pending", "delivered", "failed"
}
```

## Règles de sécurité Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Landing pages - lecture publique, écriture avec validation
    match /landingPages/{pageId} {
      allow read: if true;
      allow create: if request.auth != null || 
        (resource == null && validateLandingPage());
      allow update: if request.auth != null && validateLandingPage();
      
      function validateLandingPage() {
        return request.resource.data.keys().hasAll(['brandName', 'eventType', 'liveDate', 'trainerName', 'emailContent']);
      }
    }
    
    // Registrations - création publique, lecture restreinte
    match /registrations/{registrationId} {
      allow read: if request.auth != null;
      allow create: if validateRegistration();
      allow update: if request.auth != null;
      
      function validateRegistration() {
        return request.resource.data.keys().hasAll(['firstName', 'email', 'landingPageId']) &&
               request.resource.data.email is string &&
               request.resource.data.email.matches('.*@.*');
      }
    }
    
    // Email logs - lecture/écriture pour les fonctions Cloud uniquement
    match /emailLogs/{logId} {
      allow read, write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

## Index Firestore requis

1. **Collection `registrations`**:
   - Index composite : `landingPageId` (croissant) + `registeredAt` (décroissant)
   - Index composite : `liveDate` (croissant) + `reminderSent` (croissant)
   - Index simple : `email` (croissant)

2. **Collection `emailLogs`**:
   - Index composite : `registrationId` (croissant) + `sentAt` (décroissant)
   - Index simple : `emailType` (croissant)

## Fonctions Cloud Firebase nécessaires

### 1. `sendEmail` - Envoi d'emails de confirmation
### 2. `sendWhatsAppReminder` - Integration avec 360 Dialog
### 3. `sendTelegramReminder` - Rappels Telegram
### 4. `cleanupOldData` - Nettoyage automatique des anciennes données