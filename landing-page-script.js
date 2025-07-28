// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDCdErRIPkomQvtTVGtMbfUuU9q4S_HH1w",
  authDomain: "autosub-ab7b1.firebaseapp.com",
  projectId: "autosub-ab7b1",
  storageBucket: "autosub-ab7b1.appspot.com",
  messagingSenderId: "237004008489",
  appId: "1:237004008489:web:673ae4593206846440c038"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Variables globales
let currentLandingPageId = null;

// ⭐ FONCTION PRINCIPALE - CRÉATION DE LANDING PAGE
async function createLanding() {
  try {
    const brandName = document.getElementById('brand').value.trim();
    const eventType = document.getElementById('eventType').value.trim();
    const liveDate = document.getElementById('liveDate').value;
    const trainerName = document.getElementById('trainerName').value.trim();
    const emailContent = document.getElementById('emailContent').value.trim();

    // Validation des champs obligatoires
    if (!brandName || !eventType || !liveDate || !trainerName || !emailContent) {
      document.getElementById('error').textContent = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    // Upload des images si présentes
    const logoFile = document.getElementById('logo').files[0];
    const imageFile = document.getElementById('thirdImg').files[0];
    const trainerImageFile = document.getElementById('trainerImg').files[0];

    let logoUrl = null;
    let imageUrl = null;
    let trainerImageUrl = null;

    if (logoFile) {
      logoUrl = await uploadImageToFirebase(logoFile, 'logos');
    }
    if (imageFile) {
      imageUrl = await uploadImageToFirebase(imageFile, 'images');
    }
    if (trainerImageFile) {
      trainerImageUrl = await uploadImageToFirebase(trainerImageFile, 'trainers');
    }

    // ⭐ DONNÉES DE LA LANDING PAGE POUR FIRESTORE
    const landingPageData = {
      brandName: brandName,
      eventType: eventType,
      subtitle: sloganEditor.root.innerHTML,
      description: quill.root.innerHTML,
      logoUrl: logoUrl,
      imageUrl: imageUrl,
      liveDate: new Date(liveDate).toISOString(),
      trainerName: trainerName,
      trainerIntro: trainerEditor.root.innerHTML,
      trainerImageUrl: trainerImageUrl,
      emailContent: emailContent, // ⭐ CONTENU EMAIL PERSONNALISÉ
      colors: {
        background: document.getElementById('bgColor').value,
        border: document.getElementById('borderColor').value
      },
      reminders: {
        telegram: {
          enabled: document.getElementById('remindTelegram').checked,
          minutesBefore: parseInt(document.getElementById('remindTelegramTime').value) || null,
          channelUrl: "https://t.me/your_channel" // À personnaliser
        },
        whatsapp: {
          enabled: document.getElementById('remindWhatsApp').checked,
          minutesBefore: parseInt(document.getElementById('remindWhatsAppTime').value) || null
        }
      },
      googleFormUrl: document.getElementById('googleFormUrl').value.trim() || null,
      createdAt: new Date().toISOString(),
      status: "active"
    };

    // Sauvegarde dans Firestore
    const docRef = await db.collection('landingPages').add(landingPageData);
    currentLandingPageId = docRef.id;

    console.log('✅ Landing page créée avec ID:', currentLandingPageId);
    document.getElementById('error').style.color = 'green';
    document.getElementById('error').textContent = '✅ Landing page créée avec succès !';

  } catch (error) {
    console.error('❌ Erreur lors de la création:', error);
    document.getElementById('error').textContent = 'Erreur : ' + error.message;
  }
}

// ⭐ FONCTION INSCRIPTION UTILISATEUR - AVEC FIRESTORE
async function submitRegistration() {
  try {
    const firstName = document.getElementById('firstName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const reminderType = document.querySelector('input[name="reminderType"]:checked')?.value || 'none';
    const phoneNumber = document.getElementById('phoneNumber').value.trim();

    // Validation
    let hasError = false;
    
    if (!firstName) {
      document.getElementById('firstNameError').style.display = 'block';
      hasError = true;
    } else {
      document.getElementById('firstNameError').style.display = 'none';
    }

    if (!email || !email.includes('@')) {
      document.getElementById('emailError').style.display = 'block';
      hasError = true;
    } else {
      document.getElementById('emailError').style.display = 'none';
    }

    if (reminderType === 'whatsapp' && !phoneNumber) {
      document.getElementById('phoneError').style.display = 'block';
      hasError = true;
    } else {
      document.getElementById('phoneError').style.display = 'none';
    }

    if (hasError) return;

    // ⭐ FORMATAGE DU NUMÉRO WHATSAPP POUR 360DIALOG
    let formattedPhone = null;
    if (reminderType === 'whatsapp' && phoneNumber) {
      formattedPhone = formatPhoneForWhatsApp(phoneNumber);
    }

    // Récupération des données de la landing page
    const landingPageDoc = await db.collection('landingPages').doc(currentLandingPageId).get();
    const landingPageData = landingPageDoc.data();

    // ⭐ DONNÉES D'INSCRIPTION POUR FIRESTORE
    const registrationData = {
      landingPageId: currentLandingPageId,
      
      // Données utilisateur (pour 360dialog et emails)
      firstName: firstName,
      email: email,
      whatsappNumber: formattedPhone, // ⭐ Format international pour 360dialog
      
      // Préférences de rappel
      reminderType: reminderType,
      reminderSent: false,
      
      // Données de l'événement (copiées pour faciliter l'automatisation)
      brandName: landingPageData.brandName,
      eventType: landingPageData.eventType,
      trainerName: landingPageData.trainerName,
      liveDate: landingPageData.liveDate,
      emailContent: landingPageData.emailContent, // ⭐ Contenu email personnalisé
      
      // Statuts d'automatisation
      emailSent: false,
      emailSentAt: null,
      reminderScheduled: false,
      reminderSentAt: null,
      
      // Métadonnées
      registeredAt: new Date().toISOString(),
      ipAddress: await getUserIP(), // optionnel
      userAgent: navigator.userAgent,
      source: "landing-page"
    };

    // ⭐ SAUVEGARDE DANS FIRESTORE
    const registrationRef = await db.collection('registrations').add(registrationData);
    console.log('✅ Inscription sauvegardée avec ID:', registrationRef.id);

    // ⭐ DÉCLENCHEMENT AUTOMATIQUE DE L'EMAIL
    await triggerEmailAutomation(registrationRef.id, registrationData);

    // ⭐ PROGRAMMATION DES RAPPELS SI ACTIVÉS
    if (reminderType !== 'none') {
      await scheduleReminder(registrationRef.id, registrationData);
    }

    // Interface utilisateur
    closeModal();
    showSuccessMessage();
    disablePage();

  } catch (error) {
    console.error('❌ Erreur lors de l\'inscription:', error);
    alert('Erreur lors de l\'inscription. Veuillez réessayer.');
  }
}

// ⭐ FONCTION AUTOMATISATION EMAIL
async function triggerEmailAutomation(registrationId, registrationData) {
  try {
    const emailData = {
      registrationId: registrationId,
      type: "registration_confirmation",
      
      // Données email
      to: registrationData.email,
      subject: `Confirmation d'inscription - ${registrationData.brandName}`,
      htmlContent: generateEmailHTML(registrationData),
      
      // Données personnalisées
      personalization: {
        firstName: registrationData.firstName,
        brandName: registrationData.brandName,
        eventType: registrationData.eventType,
        trainerName: registrationData.trainerName,
        liveDate: registrationData.liveDate,
        customContent: registrationData.emailContent // ⭐ Contenu du créateur
      },
      
      // Statuts
      status: "pending",
      attempts: 0,
      lastAttempt: null,
      sentAt: null,
      error: null,
      
      createdAt: new Date().toISOString(),
      scheduledFor: new Date().toISOString() // Envoi immédiat
    };

    await db.collection('emailQueue').add(emailData);
    console.log('✅ Email ajouté à la queue d\'envoi');

  } catch (error) {
    console.error('❌ Erreur automatisation email:', error);
  }
}

// ⭐ FONCTION PROGRAMMATION RAPPELS WHATSAPP (360DIALOG)
async function scheduleReminder(registrationId, registrationData) {
  try {
    if (registrationData.reminderType === 'whatsapp') {
      const reminderTime = calculateReminderTime(
        registrationData.liveDate, 
        registrationData.reminderMinutesBefore || 15
      );

      const whatsappData = {
        registrationId: registrationId,
        
        // ⭐ Données 360DIALOG
        phoneNumber: registrationData.whatsappNumber,
        message: generateWhatsAppMessage(registrationData),
        
        // Template 360DIALOG (optionnel)
        template: {
          name: "live_reminder",
          language: "fr",
          parameters: [
            registrationData.firstName,
            registrationData.brandName,
            "15 minutes"
          ]
        },
        
        // Programmation
        scheduledFor: reminderTime,
        
        // Statuts
        status: "pending",
        attempts: 0,
        lastAttempt: null,
        sentAt: null,
        error: null,
        
        createdAt: new Date().toISOString()
      };

      await db.collection('whatsappQueue').add(whatsappData);
      console.log('✅ Rappel WhatsApp programmé pour:', reminderTime);
    }

  } catch (error) {
    console.error('❌ Erreur programmation rappel:', error);
  }
}

// ⭐ FONCTIONS UTILITAIRES

// Formatage numéro WhatsApp pour 360dialog
function formatPhoneForWhatsApp(phone) {
  // Supprime tous les caractères non numériques sauf le +
  let formatted = phone.replace(/[^\d+]/g, '');
  
  // Ajoute +33 si le numéro commence par 0 (France)
  if (formatted.startsWith('0')) {
    formatted = '+33' + formatted.substring(1);
  }
  
  // Ajoute + si manquant
  if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  
  return formatted;
}

// Génération email HTML personnalisé
function generateEmailHTML(registrationData) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; text-align: center; margin-bottom: 20px;">
          🎉 Inscription confirmée !
        </h2>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Bonjour ${registrationData.firstName},
        </p>
        
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Merci de vous être inscrit(e) à notre ${registrationData.eventType} : <strong>${registrationData.brandName}</strong>
        </p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffd600;">
          <div style="color: #333; font-size: 16px; line-height: 1.6;">
            ${registrationData.emailContent.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #1976d2; font-weight: bold;">📅 Détails de l'événement :</p>
          <p style="margin: 5px 0; color: #333;">
            <strong>Date :</strong> ${new Date(registrationData.liveDate).toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <p style="margin: 5px 0; color: #333;">
            <strong>Formateur :</strong> ${registrationData.trainerName}
          </p>
        </div>
        
        ${registrationData.reminderType !== 'none' ? `
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 20px;">
            💬 Vous recevrez un rappel via ${registrationData.reminderType === 'whatsapp' ? 'WhatsApp' : 'Telegram'} avant l'événement.
          </p>
        ` : ''}
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            Email envoyé automatiquement • AutoSub System
          </p>
        </div>
      </div>
    </div>
  `;
}

// Génération message WhatsApp
function generateWhatsAppMessage(registrationData) {
  return `🎯 Rappel : Votre ${registrationData.eventType} "${registrationData.brandName}" avec ${registrationData.trainerName} commence dans 15 minutes !

📅 ${new Date(registrationData.liveDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}

À tout de suite ! 🚀`;
}

// Calcul du moment d'envoi du rappel
function calculateReminderTime(liveDate, minutesBefore) {
  const liveTime = new Date(liveDate);
  const reminderTime = new Date(liveTime.getTime() - (minutesBefore * 60 * 1000));
  return reminderTime.toISOString();
}

// Récupération IP utilisateur (optionnel)
async function getUserIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
}

// ⭐ EVENT LISTENERS ET INITIALISATIONS
document.addEventListener('DOMContentLoaded', function() {
  // Initialisation des éditeurs Quill si présents
  if (document.getElementById('descEditor')) {
    quill = new Quill('#descEditor', { theme: 'snow' });
  }
  if (document.getElementById('slogan-editor')) {
    sloganEditor = new Quill('#slogan-editor', { theme: 'snow' });
  }
  if (document.getElementById('trainerEditor')) {
    trainerEditor = new Quill('#trainerEditor', { theme: 'snow' });
  }

  // Event listener pour le formulaire d'inscription
  document.getElementById('registrationForm').addEventListener('submit', function(e) {
    e.preventDefault();
    submitRegistration();
  });

  // Event listeners pour les rappels
  document.querySelectorAll('input[name="reminderType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.value === 'whatsapp') {
        document.getElementById('whatsappNumber').style.display = 'block';
        document.getElementById('telegramLink').style.display = 'none';
      } else if (this.value === 'telegram') {
        document.getElementById('whatsappNumber').style.display = 'none';
        document.getElementById('telegramLink').style.display = 'block';
      } else {
        document.getElementById('whatsappNumber').style.display = 'none';
        document.getElementById('telegramLink').style.display = 'none';
      }
    });
  });
});

// Fonctions utilitaires pour l'interface
function showSuccessMessage() {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.style.display = 'block';
  successDiv.innerHTML = '🎉 Inscription réussie ! Vous allez recevoir un email de confirmation.';
  document.querySelector('.preview').appendChild(successDiv);
}

function disablePage() {
  document.getElementById('readonlyOverlay').style.display = 'flex';
  document.querySelector('.main').classList.add('page-disabled');
}

function openModal() {
  document.getElementById('registrationModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('registrationModal').style.display = 'none';
  document.body.style.overflow = 'auto';
  document.getElementById('registrationForm').reset();
  document.getElementById('telegramLink').style.display = 'none';
  document.getElementById('whatsappNumber').style.display = 'none';
  document.querySelectorAll('.error-message').forEach(error => {
    error.style.display = 'none';
  });
}

// Upload d'image vers Firebase Storage
async function uploadImageToFirebase(file, path) {
  try {
    const originalName = file.name;
    const cleanedName = originalName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[()]/g, '')
      .replace(/[àâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[ïî]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9.\-]/g, '');

    const timestamp = Date.now();
    const fileName = `${timestamp}-${cleanedName}`;
    const storageRef = storage.ref(`${path}/${fileName}`);
    
    console.log(`🔄 Uploading ${fileName}...`);
    const snapshot = await storageRef.put(file);
    const url = await snapshot.ref.getDownloadURL();
    console.log(`✅ Upload successful: ${fileName}`);
    return url;
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
}