// Fonctions Firestore pour AutoSub Landing Page

// Fonction pour sauvegarder une landing page dans Firestore
async function saveLandingPageToFirestore(landingData) {
  if (!db) {
    console.warn('⚠️ Firestore not available, logging data instead');
    console.log('📝 LANDING PAGE DATA:', landingData);
    return 'offline-' + Date.now();
  }

  try {
    console.log('💾 Saving landing page to Firestore...');
    
    const docRef = await db.collection('landingPages').add({
      // Informations de base
      brandName: landingData.brandName,
      eventType: landingData.eventType,
      subtitle: landingData.subtitle,
      description: landingData.description,
      
      // Images
      logoUrl: landingData.logoUrl || null,
      trainerImageUrl: landingData.trainerImageUrl || null,
      thirdImageUrl: landingData.thirdImageUrl || null,
      
      // Design
      backgroundColor: landingData.backgroundColor,
      borderColor: landingData.borderColor,
      
      // Informations du formateur
      trainerName: landingData.trainerName,
      trainerIntro: landingData.trainerIntro || '',
      
      // Date et heure
      liveDate: firebase.firestore.Timestamp.fromDate(new Date(landingData.liveDate)),
      
      // Configuration email
      emailContent: landingData.emailContent,
      
      // Liens externes
      googleFormUrl: landingData.googleFormUrl || '',
      
      // Configuration des rappels
      reminderTelegram: {
        enabled: landingData.reminderTelegram.enabled,
        minutesBefore: landingData.reminderTelegram.minutesBefore || 0
      },
      reminderWhatsApp: {
        enabled: landingData.reminderWhatsApp.enabled,
        minutesBefore: landingData.reminderWhatsApp.minutesBefore || 0
      },
      
      // Métadonnées
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      pageId: docRef.id
    });

    console.log('✅ Landing page saved with ID:', docRef.id);
    return docRef.id;
    
  } catch (error) {
    console.error('❌ Error saving landing page:', error);
    throw error;
  }
}

// Fonction pour sauvegarder une inscription dans Firestore
async function saveRegistrationToFirestore(registrationData) {
  if (!db) {
    console.warn('⚠️ Firestore not available, logging data instead');
    console.log('📝 REGISTRATION DATA:', registrationData);
    return 'offline-' + Date.now();
  }

  try {
    console.log('💾 Saving registration to Firestore...');
    
    const registrationId = db.collection('registrations').doc().id;
    
    const docData = {
      // Informations utilisateur
      firstName: registrationData.firstName,
      email: registrationData.email.toLowerCase().trim(),
      phoneNumber: registrationData.phoneNumber || '',
      
      // Type de rappel choisi
      reminderType: registrationData.reminderType || 'none',
      
      // Référence à la landing page
      landingPageId: registrationData.landingPageId,
      
      // Informations copiées de la landing page
      brandName: registrationData.brandName,
      eventType: registrationData.eventType,
      liveDate: firebase.firestore.Timestamp.fromDate(new Date(registrationData.liveDate)),
      trainerName: registrationData.trainerName,
      emailContent: registrationData.emailContent,
      
      // Statuts
      emailSent: false,
      emailSentAt: null,
      reminderSent: false,
      reminderSentAt: null,
      
      // Métadonnées
      registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
      registrationId: registrationId,
      userAgent: navigator.userAgent,
      ipAddress: null // Sera ajouté par la fonction Cloud si disponible
    };

    await db.collection('registrations').doc(registrationId).set(docData);
    console.log('✅ Registration saved with ID:', registrationId);
    
    return registrationId;
    
  } catch (error) {
    console.error('❌ Error saving registration:', error);
    throw error;
  }
}

// Fonction pour vérifier si un email est déjà inscrit pour une landing page
async function checkExistingRegistration(email, landingPageId) {
  if (!db) {
    console.warn('⚠️ Firestore not available, skipping duplicate check');
    return false;
  }

  try {
    const query = await db.collection('registrations')
      .where('email', '==', email.toLowerCase().trim())
      .where('landingPageId', '==', landingPageId)
      .limit(1)
      .get();
    
    return !query.empty;
  } catch (error) {
    console.error('❌ Error checking existing registration:', error);
    return false;
  }
}

// Fonction pour récupérer les données d'une landing page
async function getLandingPageData(pageId) {
  if (!db) {
    console.warn('⚠️ Firestore not available');
    return null;
  }

  try {
    const doc = await db.collection('landingPages').doc(pageId).get();
    
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    } else {
      console.warn('⚠️ Landing page not found:', pageId);
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting landing page:', error);
    return null;
  }
}

// Fonction pour logger l'envoi d'email
async function logEmailSent(emailLogData) {
  if (!db) {
    console.warn('⚠️ Firestore not available, logging email data instead');
    console.log('📧 EMAIL LOG:', emailLogData);
    return;
  }

  try {
    await db.collection('emailLogs').add({
      registrationId: emailLogData.registrationId,
      landingPageId: emailLogData.landingPageId,
      recipientEmail: emailLogData.recipientEmail,
      emailType: emailLogData.emailType,
      subject: emailLogData.subject,
      htmlContent: emailLogData.htmlContent,
      sent: emailLogData.sent,
      sentAt: emailLogData.sent ? firebase.firestore.FieldValue.serverTimestamp() : null,
      error: emailLogData.error || null,
      messageId: emailLogData.messageId || null,
      deliveryStatus: emailLogData.deliveryStatus || 'pending'
    });
    
    console.log('✅ Email log saved');
  } catch (error) {
    console.error('❌ Error saving email log:', error);
  }
}

// Fonction pour mettre à jour le statut d'envoi d'email d'une inscription
async function updateRegistrationEmailStatus(registrationId, emailSent = true, error = null) {
  if (!db) {
    console.warn('⚠️ Firestore not available');
    return;
  }

  try {
    const updateData = {
      emailSent: emailSent,
      emailSentAt: emailSent ? firebase.firestore.FieldValue.serverTimestamp() : null
    };

    if (error) {
      updateData.emailError = error;
    }

    await db.collection('registrations').doc(registrationId).update(updateData);
    console.log('✅ Registration email status updated');
  } catch (error) {
    console.error('❌ Error updating registration email status:', error);
  }
}

// Fonction pour obtenir les statistiques d'une landing page
async function getLandingPageStats(pageId) {
  if (!db) {
    console.warn('⚠️ Firestore not available');
    return { registrations: 0, emailsSent: 0 };
  }

  try {
    const registrationsSnapshot = await db.collection('registrations')
      .where('landingPageId', '==', pageId)
      .get();
    
    const totalRegistrations = registrationsSnapshot.size;
    let emailsSent = 0;
    
    registrationsSnapshot.forEach(doc => {
      if (doc.data().emailSent) {
        emailsSent++;
      }
    });

    return {
      registrations: totalRegistrations,
      emailsSent: emailsSent,
      emailDeliveryRate: totalRegistrations > 0 ? (emailsSent / totalRegistrations * 100).toFixed(1) : 0
    };
  } catch (error) {
    console.error('❌ Error getting landing page stats:', error);
    return { registrations: 0, emailsSent: 0, emailDeliveryRate: 0 };
  }
}