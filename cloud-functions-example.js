// Cloud Functions pour AutoSub - Firebase Functions
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

// Configuration 360 Dialog pour WhatsApp Business API
const DIALOG_360_API_KEY = functions.config().dialog360?.apikey;
const DIALOG_360_WEBHOOK_URL = functions.config().dialog360?.webhook;

// Configuration email
const EMAIL_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: functions.config().email?.user,
    pass: functions.config().email?.password
  }
};

/**
 * Fonction pour envoyer des emails de confirmation
 */
exports.sendEmail = functions.https.onCall(async (data, context) => {
  try {
    console.log('📧 Sending email to:', data.to);
    
    const transporter = nodemailer.createTransporter(EMAIL_CONFIG);
    
    const mailOptions = {
      from: `"AutoSub" <${EMAIL_CONFIG.auth.user}>`,
      to: data.to,
      subject: data.subject,
      html: data.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId
    };
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw new functions.https.HttpsError('internal', 'Error sending email', error.message);
  }
});

/**
 * Fonction pour envoyer des rappels WhatsApp via 360 Dialog
 */
exports.sendWhatsAppReminder = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber, message, registrationId } = data;
    
    console.log('📱 Sending WhatsApp reminder to:', phoneNumber);
    
    // Formatter le numéro de téléphone pour 360 Dialog
    const formattedPhone = phoneNumber.replace(/[^\d]/g, '');
    
    const whatsappData = {
      to: formattedPhone,
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await axios.post(
      'https://waba.360dialog.io/v1/messages',
      whatsappData,
      {
        headers: {
          'Authorization': `Bearer ${DIALOG_360_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ WhatsApp message sent successfully:', response.data.messages[0].id);
    
    // Mettre à jour le statut dans Firestore
    await db.collection('registrations').doc(registrationId).update({
      reminderSent: true,
      reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
      whatsappMessageId: response.data.messages[0].id
    });

    // Logger dans emailLogs (même collection pour tous les messages)
    await db.collection('emailLogs').add({
      registrationId: registrationId,
      recipientEmail: phoneNumber, // Utiliser le champ email pour le numéro
      emailType: 'whatsapp_reminder',
      subject: 'WhatsApp Reminder',
      htmlContent: message,
      sent: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      messageId: response.data.messages[0].id,
      deliveryStatus: 'sent'
    });
    
    return {
      success: true,
      messageId: response.data.messages[0].id
    };
    
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    
    // Logger l'erreur
    if (data.registrationId) {
      await db.collection('emailLogs').add({
        registrationId: data.registrationId,
        recipientEmail: data.phoneNumber,
        emailType: 'whatsapp_reminder',
        subject: 'WhatsApp Reminder',
        htmlContent: data.message,
        sent: false,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        deliveryStatus: 'failed'
      });
    }
    
    throw new functions.https.HttpsError('internal', 'Error sending WhatsApp message', error.message);
  }
});

/**
 * Fonction pour envoyer des rappels Telegram
 */
exports.sendTelegramReminder = functions.https.onCall(async (data, context) => {
  try {
    const { telegramChatId, message, registrationId } = data;
    
    console.log('💬 Sending Telegram reminder to:', telegramChatId);
    
    const TELEGRAM_BOT_TOKEN = functions.config().telegram?.bottoken;
    
    const telegramData = {
      chat_id: telegramChatId,
      text: message,
      parse_mode: 'HTML'
    };

    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      telegramData
    );

    console.log('✅ Telegram message sent successfully:', response.data.result.message_id);
    
    // Mettre à jour le statut dans Firestore
    await db.collection('registrations').doc(registrationId).update({
      reminderSent: true,
      reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
      telegramMessageId: response.data.result.message_id
    });

    // Logger dans emailLogs
    await db.collection('emailLogs').add({
      registrationId: registrationId,
      recipientEmail: telegramChatId,
      emailType: 'telegram_reminder',
      subject: 'Telegram Reminder',
      htmlContent: message,
      sent: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      messageId: response.data.result.message_id.toString(),
      deliveryStatus: 'sent'
    });
    
    return {
      success: true,
      messageId: response.data.result.message_id
    };
    
  } catch (error) {
    console.error('❌ Error sending Telegram message:', error);
    
    // Logger l'erreur
    if (data.registrationId) {
      await db.collection('emailLogs').add({
        registrationId: data.registrationId,
        recipientEmail: data.telegramChatId,
        emailType: 'telegram_reminder',
        subject: 'Telegram Reminder',
        htmlContent: data.message,
        sent: false,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        deliveryStatus: 'failed'
      });
    }
    
    throw new functions.https.HttpsError('internal', 'Error sending Telegram message', error.message);
  }
});

/**
 * Fonction programmée pour envoyer automatiquement les rappels
 */
exports.processScheduledReminders = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + (5 * 60 * 1000));
  
  console.log('🕐 Processing scheduled reminders...');
  
  try {
    // Rechercher les inscriptions qui ont besoin d'un rappel
    const query = await db.collection('registrations')
      .where('reminderSent', '==', false)
      .where('liveDate', '>', admin.firestore.Timestamp.fromDate(now))
      .where('liveDate', '<=', admin.firestore.Timestamp.fromDate(fiveMinutesFromNow))
      .get();
    
    const batch = db.batch();
    const reminders = [];
    
    query.forEach(doc => {
      const data = doc.data();
      const liveDate = data.liveDate.toDate();
      const minutesUntilLive = Math.floor((liveDate.getTime() - now.getTime()) / (1000 * 60));
      
      // Vérifier si c'est le bon moment pour le rappel
      const shouldSendReminder = 
        (data.reminderType === 'whatsapp' && data.reminderWhatsApp?.enabled && 
         Math.abs(minutesUntilLive - (data.reminderWhatsApp.minutesBefore || 0)) <= 2) ||
        (data.reminderType === 'telegram' && data.reminderTelegram?.enabled && 
         Math.abs(minutesUntilLive - (data.reminderTelegram.minutesBefore || 0)) <= 2);
      
      if (shouldSendReminder) {
        reminders.push({
          id: doc.id,
          data: data,
          minutesUntilLive: minutesUntilLive
        });
      }
    });
    
    console.log(`📋 Found ${reminders.length} reminders to send`);
    
    // Envoyer les rappels
    for (const reminder of reminders) {
      try {
        const message = generateReminderMessage(reminder.data, reminder.minutesUntilLive);
        
        if (reminder.data.reminderType === 'whatsapp') {
          await admin.functions().httpsCallable('sendWhatsAppReminder')({
            phoneNumber: reminder.data.phoneNumber,
            message: message,
            registrationId: reminder.id
          });
        } else if (reminder.data.reminderType === 'telegram') {
          // Pour Telegram, il faudrait avoir le chat_id de l'utilisateur
          // Ce serait configuré lors de l'inscription via le bot Telegram
          await admin.functions().httpsCallable('sendTelegramReminder')({
            telegramChatId: reminder.data.telegramChatId,
            message: message,
            registrationId: reminder.id
          });
        }
        
        console.log(`✅ Reminder sent for registration: ${reminder.id}`);
        
      } catch (error) {
        console.error(`❌ Error sending reminder for ${reminder.id}:`, error);
      }
    }
    
    return `Processed ${reminders.length} reminders`;
    
  } catch (error) {
    console.error('❌ Error processing scheduled reminders:', error);
    throw error;
  }
});

/**
 * Webhook pour recevoir les statuts de livraison de 360 Dialog
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  try {
    console.log('📲 WhatsApp webhook received:', JSON.stringify(req.body, null, 2));
    
    const { messages, statuses } = req.body;
    
    // Traiter les statuts de livraison
    if (statuses && statuses.length > 0) {
      for (const status of statuses) {
        const { id, status: deliveryStatus, timestamp } = status;
        
        // Mettre à jour le statut dans emailLogs
        const logsQuery = await db.collection('emailLogs')
          .where('messageId', '==', id)
          .limit(1)
          .get();
        
        if (!logsQuery.empty) {
          const logDoc = logsQuery.docs[0];
          await logDoc.ref.update({
            deliveryStatus: deliveryStatus,
            deliveryTimestamp: admin.firestore.Timestamp.fromDate(new Date(timestamp * 1000))
          });
          
          console.log(`✅ Updated delivery status for message ${id}: ${deliveryStatus}`);
        }
      }
    }
    
    // Traiter les messages entrants (si nécessaire)
    if (messages && messages.length > 0) {
      for (const message of messages) {
        console.log('📨 Incoming message:', message);
        // Ici on pourrait traiter les réponses des utilisateurs
      }
    }
    
    res.sendStatus(200);
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Fonction utilitaire pour générer le message de rappel
 */
function generateReminderMessage(registrationData, minutesUntilLive) {
  const eventTime = registrationData.liveDate.toDate().toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `🔔 RAPPEL - ${registrationData.brandName}

Bonjour ${registrationData.firstName},

Votre ${registrationData.eventType} commence dans ${minutesUntilLive} minutes !

📅 ${eventTime}
👤 Formateur: ${registrationData.trainerName}

Ne manquez pas cette opportunité ! 

À tout de suite ! 🚀`;
}

/**
 * Fonction pour nettoyer les anciennes données
 */
exports.cleanupOldData = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  console.log('🧹 Cleaning up old data...');
  
  try {
    // Nettoyer les anciennes inscriptions
    const oldRegistrations = await db.collection('registrations')
      .where('liveDate', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();
    
    const batch = db.batch();
    let deleteCount = 0;
    
    oldRegistrations.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });
    
    if (deleteCount > 0) {
      await batch.commit();
      console.log(`✅ Deleted ${deleteCount} old registrations`);
    }
    
    // Nettoyer les anciens logs d'email
    const oldLogs = await db.collection('emailLogs')
      .where('sentAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();
    
    const logBatch = db.batch();
    let logDeleteCount = 0;
    
    oldLogs.forEach(doc => {
      logBatch.delete(doc.ref);
      logDeleteCount++;
    });
    
    if (logDeleteCount > 0) {
      await logBatch.commit();
      console.log(`✅ Deleted ${logDeleteCount} old email logs`);
    }
    
    return `Cleanup completed: ${deleteCount} registrations, ${logDeleteCount} logs`;
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
});

/**
 * Fonction pour obtenir les statistiques d'une landing page
 */
exports.getLandingPageStats = functions.https.onCall(async (data, context) => {
  try {
    const { landingPageId } = data;
    
    if (!landingPageId) {
      throw new functions.https.HttpsError('invalid-argument', 'Landing page ID is required');
    }
    
    // Obtenir les statistiques d'inscription
    const registrationsSnapshot = await db.collection('registrations')
      .where('landingPageId', '==', landingPageId)
      .get();
    
    const stats = {
      totalRegistrations: registrationsSnapshot.size,
      emailsSent: 0,
      remindersSent: 0,
      whatsappRegistrations: 0,
      telegramRegistrations: 0,
      recentRegistrations: []
    };
    
    registrationsSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (data.emailSent) stats.emailsSent++;
      if (data.reminderSent) stats.remindersSent++;
      if (data.reminderType === 'whatsapp') stats.whatsappRegistrations++;
      if (data.reminderType === 'telegram') stats.telegramRegistrations++;
      
      // Ajouter aux inscriptions récentes
      stats.recentRegistrations.push({
        firstName: data.firstName,
        email: data.email,
        reminderType: data.reminderType,
        registeredAt: data.registeredAt,
        emailSent: data.emailSent,
        reminderSent: data.reminderSent
      });
    });
    
    // Trier par date d'inscription (plus récent en premier)
    stats.recentRegistrations.sort((a, b) => b.registeredAt - a.registeredAt);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error getting landing page stats:', error);
    throw new functions.https.HttpsError('internal', 'Error getting stats', error.message);
  }
});