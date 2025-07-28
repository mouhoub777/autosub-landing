# Structure Firestore pour AutoSub

## Collections principales

### 1. Collection: `landingPages`
```javascript
{
  id: "auto-generated-id",
  brandName: "Mon Live",
  eventType: "live", // ou "masterclass", "webinaire"
  subtitle: "Subtitle du live",
  description: "Description HTML du live",
  logoUrl: "https://...", // URL Firebase Storage
  imageUrl: "https://...", // Image principale
  liveDate: "2025-01-15T20:00:00Z", // Format ISO
  trainerName: "John Doe",
  trainerIntro: "Introduction HTML du formateur",
  trainerImageUrl: "https://...",
  emailContent: "Contenu personnalisé de l'email de confirmation...", // ⭐ IMPORTANT
  colors: {
    background: "#ffffff",
    border: "#ffd600"
  },
  reminders: {
    telegram: {
      enabled: true,
      minutesBefore: 30,
      channelUrl: "https://t.me/your_channel"
    },
    whatsapp: {
      enabled: true,
      minutesBefore: 15
    }
  },
  googleFormUrl: "https://forms.gle/...", // optionnel
  createdAt: "2025-01-15T10:00:00Z",
  createdBy: "user-id",
  status: "active" // ou "inactive"
}
```

### 2. Collection: `registrations`
```javascript
{
  id: "auto-generated-id",
  landingPageId: "landing-page-id", // Référence à la landing page
  
  // ⭐ DONNÉES UTILISATEUR (pour 360dialog et emails)
  firstName: "Jean",
  email: "jean@example.com",
  whatsappNumber: "+33612345678", // Format international pour 360dialog
  
  // ⭐ PRÉFÉRENCES DE RAPPEL
  reminderType: "whatsapp", // "whatsapp", "telegram", ou "none"
  reminderSent: false, // Pour éviter les doublons
  
  // ⭐ DONNÉES DE L'ÉVÉNEMENT (copiées pour faciliter l'automatisation)
  brandName: "Mon Live",
  eventType: "live",
  trainerName: "John Doe",
  liveDate: "2025-01-15T20:00:00Z",
  emailContent: "Contenu personnalisé...", // Copié depuis landingPage
  
  // ⭐ STATUTS D'AUTOMATISATION
  emailSent: false,
  emailSentAt: null,
  reminderScheduled: false,
  reminderSentAt: null,
  
  // Métadonnées
  registeredAt: "2025-01-15T12:00:00Z",
  ipAddress: "192.168.1.1", // optionnel
  userAgent: "Mozilla/5.0...", // optionnel
  source: "landing-page" // ou "google-form"
}
```

### 3. Collection: `emailQueue` (pour l'automatisation)
```javascript
{
  id: "auto-generated-id",
  registrationId: "registration-id",
  type: "registration_confirmation", // ou "reminder"
  
  // ⭐ DONNÉES EMAIL
  to: "jean@example.com",
  subject: "Confirmation d'inscription - Mon Live",
  htmlContent: "...", // Email HTML généré
  
  // ⭐ DONNÉES PERSONNALISÉES
  personalization: {
    firstName: "Jean",
    brandName: "Mon Live",
    eventType: "live",
    trainerName: "John Doe",
    liveDate: "2025-01-15T20:00:00Z",
    customContent: "Contenu personnalisé du créateur..."
  },
  
  // Statuts
  status: "pending", // "pending", "sent", "failed"
  attempts: 0,
  lastAttempt: null,
  sentAt: null,
  error: null,
  
  createdAt: "2025-01-15T12:01:00Z",
  scheduledFor: "2025-01-15T12:01:00Z" // Envoi immédiat ou programmé
}
```

### 4. Collection: `whatsappQueue` (pour 360dialog)
```javascript
{
  id: "auto-generated-id",
  registrationId: "registration-id",
  
  // ⭐ DONNÉES 360DIALOG
  phoneNumber: "+33612345678", // Format international
  message: "🎯 Rappel : Votre live 'Mon Live' commence dans 15 minutes !",
  
  // ⭐ TEMPLATE 360DIALOG (optionnel)
  template: {
    name: "live_reminder",
    language: "fr",
    parameters: [
      "Jean", // firstName
      "Mon Live", // brandName
      "15 minutes" // timeRemaining
    ]
  },
  
  // Programmation
  scheduledFor: "2025-01-15T19:45:00Z", // 15 min avant le live
  
  // Statuts
  status: "pending", // "pending", "sent", "failed"
  attempts: 0,
  lastAttempt: null,
  sentAt: null,
  error: null,
  
  createdAt: "2025-01-15T12:01:00Z"
}
```

## Règles Firestore

```javascript
// rules.firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Landing pages - lecture publique, écriture authentifiée
    match /landingPages/{landingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Registrations - création publique, lecture/modification par propriétaire
    match /registrations/{registrationId} {
      allow create: if true;
      allow read, update: if request.auth != null;
    }
    
    // Queues - accès admin/functions uniquement
    match /emailQueue/{emailId} {
      allow read, write: if request.auth != null && request.auth.token.admin == true;
    }
    
    match /whatsappQueue/{whatsappId} {
      allow read, write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

## Index Firestore nécessaires

1. **registrations**
   - `landingPageId` (ASC), `registeredAt` (DESC)
   - `emailSent` (ASC), `registeredAt` (ASC)
   - `reminderScheduled` (ASC), `liveDate` (ASC)

2. **emailQueue**
   - `status` (ASC), `scheduledFor` (ASC)
   - `type` (ASC), `createdAt` (DESC)

3. **whatsappQueue**
   - `status` (ASC), `scheduledFor` (ASC)

## Fonctions Cloud Functions à créer

1. **onRegistrationCreated** - Déclenche l'envoi d'email automatique
2. **scheduleReminders** - Programme les rappels WhatsApp/Telegram
3. **sendEmailQueue** - Traite la queue d'emails
4. **sendWhatsAppReminders** - Traite la queue WhatsApp (360dialog)
5. **sendEmail** - Fonction HTTP pour envoyer des emails

Cette structure permet une automatisation complète avec 360dialog et des emails personnalisés !