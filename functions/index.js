const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

// ⭐ CONFIGURATION EMAIL (à adapter selon votre fournisseur)
const transporter = nodemailer.createTransporter({
  service: 'gmail', // ou votre fournisseur
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password
  }
});

// ⭐ CONFIGURATION 360DIALOG
const WHATSAPP_360_API_KEY = functions.config().whatsapp.api_key;
const WHATSAPP_360_CHANNEL_ID = functions.config().whatsapp.channel_id;

// ⭐ FONCTION 1: DÉCLENCHEUR AUTOMATIQUE À L'INSCRIPTION
exports.onRegistrationCreated = functions.firestore
  .document('registrations/{registrationId}')
  .onCreate(async (snap, context) => {
    const registrationData = snap.data();
    const registrationId = context.params.registrationId;

    console.log('🎯 Nouvelle inscription détectée:', registrationId);

    try {
      // 1. Déclencher l'envoi d'email immédiat
      await triggerEmailSending(registrationId, registrationData);

      // 2. Programmer les rappels si nécessaire
      if (registrationData.reminderType === 'whatsapp') {
        await scheduleWhatsAppReminder(registrationId, registrationData);
      }

      console.log('✅ Automatisation déclenchée pour:', registrationId);

    } catch (error) {
      console.error('❌ Erreur automatisation:', error);
    }
  });

// ⭐ FONCTION 2: ENVOI D'EMAIL HTTP
exports.sendEmail = functions.https.onCall(async (data, context) => {
  try {
    const { to, subject, htmlContent, metadata } = data;

    const mailOptions = {
      from: functions.config().email.from,
      to: to,
      subject: subject,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);

    // Log dans Firestore pour tracking
    if (metadata) {
      await db.collection('emailLogs').add({
        ...metadata,
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log('✅ Email envoyé à:', to);
    return { success: true, message: 'Email envoyé avec succès' };

  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    throw new functions.https.HttpsError('internal', 'Erreur lors de l\'envoi de l\'email');
  }
});

// ⭐ FONCTION 3: TRAITEMENT DE LA QUEUE EMAIL
exports.processEmailQueue = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Récupérer les emails en attente
      const pendingEmails = await db.collection('emailQueue')
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', now)
        .limit(10)
        .get();

      console.log(`📧 Processing ${pendingEmails.size} emails`);

      for (const doc of pendingEmails.docs) {
        const emailData = doc.data();
        
        try {
          // Envoyer l'email
          await transporter.sendMail({
            from: functions.config().email.from,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.htmlContent
          });

          // Marquer comme envoyé
          await doc.ref.update({
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Mettre à jour le statut dans registrations
          if (emailData.registrationId) {
            await db.collection('registrations').doc(emailData.registrationId).update({
              emailSent: true,
              emailSentAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }

          console.log('✅ Email sent:', emailData.to);

        } catch (error) {
          console.error('❌ Email failed:', emailData.to, error);
          
          // Incrémenter les tentatives
          await doc.ref.update({
            attempts: admin.firestore.FieldValue.increment(1),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
            error: error.message,
            status: emailData.attempts >= 2 ? 'failed' : 'pending'
          });
        }
      }

    } catch (error) {
      console.error('❌ Erreur processing email queue:', error);
    }
  });

// ⭐ FONCTION 4: TRAITEMENT DES RAPPELS WHATSAPP (360DIALOG)
exports.processWhatsAppQueue = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Récupérer les messages WhatsApp en attente
      const pendingMessages = await db.collection('whatsappQueue')
        .where('status', '==', 'pending')
        .where('scheduledFor', '<=', now)
        .limit(5) // Limiter pour éviter les rate limits
        .get();

      console.log(`📱 Processing ${pendingMessages.size} WhatsApp messages`);

      for (const doc of pendingMessages.docs) {
        const messageData = doc.data();
        
        try {
          // ⭐ ENVOI VIA 360DIALOG API
          const response = await send360DialogMessage(
            messageData.phoneNumber,
            messageData.message,
            messageData.template
          );

          // Marquer comme envoyé
          await doc.ref.update({
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            whatsappMessageId: response.messageId
          });

          // Mettre à jour le statut dans registrations
          if (messageData.registrationId) {
            await db.collection('registrations').doc(messageData.registrationId).update({
              reminderSent: true,
              reminderSentAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }

          console.log('✅ WhatsApp sent:', messageData.phoneNumber);

        } catch (error) {
          console.error('❌ WhatsApp failed:', messageData.phoneNumber, error);
          
          // Incrémenter les tentatives
          await doc.ref.update({
            attempts: admin.firestore.FieldValue.increment(1),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
            error: error.message,
            status: messageData.attempts >= 2 ? 'failed' : 'pending'
          });
        }
      }

    } catch (error) {
      console.error('❌ Erreur processing WhatsApp queue:', error);
    }
  });

// ⭐ FONCTION UTILITAIRE: ENVOI 360DIALOG
async function send360DialogMessage(phoneNumber, message, template = null) {
  const url = `https://waba-v2.360dialog.io/messages`;
  
  let payload;
  
  if (template) {
    // ⭐ UTILISATION D'UN TEMPLATE 360DIALOG
    payload = {
      to: phoneNumber,
      type: "template",
      template: {
        name: template.name,
        language: {
          code: template.language
        },
        components: [
          {
            type: "body",
            parameters: template.parameters.map(param => ({
              type: "text",
              text: param
            }))
          }
        ]
      }
    };
  } else {
    // ⭐ MESSAGE TEXTE SIMPLE
    payload = {
      to: phoneNumber,
      type: "text",
      text: {
        body: message
      }
    };
  }

  const headers = {
    'Authorization': `Bearer ${WHATSAPP_360_API_KEY}`,
    'Content-Type': 'application/json',
    'D360-API-KEY': WHATSAPP_360_API_KEY
  };

  const response = await axios.post(url, payload, { headers });
  
  return {
    messageId: response.data.messages?.[0]?.id,
    status: response.data.messages?.[0]?.message_status
  };
}

// ⭐ FONCTION UTILITAIRE: DÉCLENCHER ENVOI EMAIL
async function triggerEmailSending(registrationId, registrationData) {
  const emailData = {
    registrationId: registrationId,
    type: "registration_confirmation",
    to: registrationData.email,
    subject: `Confirmation d'inscription - ${registrationData.brandName}`,
    htmlContent: generateEmailHTML(registrationData),
    personalization: {
      firstName: registrationData.firstName,
      brandName: registrationData.brandName,
      eventType: registrationData.eventType,
      trainerName: registrationData.trainerName,
      liveDate: registrationData.liveDate,
      customContent: registrationData.emailContent
    },
    status: "pending",
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    scheduledFor: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('emailQueue').add(emailData);
  console.log('✅ Email ajouté à la queue');
}

// ⭐ FONCTION UTILITAIRE: PROGRAMMER RAPPEL WHATSAPP
async function scheduleWhatsAppReminder(registrationId, registrationData) {
  if (!registrationData.whatsappNumber) return;

  // Calculer le moment d'envoi du rappel
  const liveDate = new Date(registrationData.liveDate);
  const minutesBefore = 15; // Par défaut 15 minutes
  const reminderTime = new Date(liveDate.getTime() - (minutesBefore * 60 * 1000));

  const whatsappData = {
    registrationId: registrationId,
    phoneNumber: registrationData.whatsappNumber,
    message: generateWhatsAppMessage(registrationData),
    template: {
      name: "live_reminder",
      language: "fr",
      parameters: [
        registrationData.firstName,
        registrationData.brandName,
        "15 minutes"
      ]
    },
    scheduledFor: admin.firestore.Timestamp.fromDate(reminderTime),
    status: "pending",
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('whatsappQueue').add(whatsappData);
  console.log('✅ Rappel WhatsApp programmé pour:', reminderTime);
}

// ⭐ GÉNÉRATION EMAIL HTML
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

// ⭐ GÉNÉRATION MESSAGE WHATSAPP
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