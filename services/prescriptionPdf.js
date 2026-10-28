const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const generatePrescriptionPdf = (rx, doctor, patient, appt, medicines, siteUrl) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const hospitalName = process.env.PRESCRIPTION_HOSPITAL_NAME || 'UltraCare Medical Center';
      
      // Header Logo & Title
      doc.fillColor('#4338ca')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text(`✚ ${hospitalName}`, 48, 48);
      
      doc.fillColor('#64748b')
         .fontSize(10)
         .font('Helvetica')
         .text('Official Prescription', 48, 70);
      
      doc.moveDown(1.5);
      
      // Metadata Details (Two column layout)
      const startY = doc.y;
      doc.fillColor('#4338ca').font('Helvetica-Bold').fontSize(10);
      doc.text('Doctor:', 48, startY);
      doc.text('Patient:', 48, startY + 18);
      doc.text('Date:', 48, startY + 36);
      doc.text('Appointment:', 48, startY + 54);
      if (rx.follow_up_date) {
        doc.text('Follow-up:', 48, startY + 72);
      }

      doc.fillColor('#1e293b').font('Helvetica').fontSize(10);
      let docNameClean = (doctor.full_name || '').trim();
      if (docNameClean.toLowerCase().startsWith('dr. dr. ')) {
        docNameClean = docNameClean.slice(8).trim();
      } else if (docNameClean.toLowerCase().startsWith('dr. ')) {
        docNameClean = docNameClean.slice(4).trim();
      } else if (docNameClean.toLowerCase().startsWith('dr ')) {
        docNameClean = docNameClean.slice(3).trim();
      }
      const doctorName = `Dr. ${docNameClean}`;
      doc.text(`${doctorName} (${doctor.specialization || 'General Medicine'})`, 140, startY);
      doc.text(patient.full_name || 'Unknown', 140, startY + 18);
      doc.text(new Date(rx.created_at || Date.now()).toISOString().split('T')[0], 140, startY + 36);
      doc.text(`${appt.appt_date || '—'} ${appt.time_slot || '—'}`, 140, startY + 54);
      if (rx.follow_up_date) {
        doc.text(rx.follow_up_date, 140, startY + 72);
      }

      doc.moveDown(rx.follow_up_date ? 6 : 5);
      
      // Divider
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(1);

      // Diagnosis Section
      const diagnosis = rx.diagnosis || rx.diagnosis_notes || '';
      if (diagnosis) {
        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('Diagnosis', 48);
        doc.moveDown(0.3);
        doc.fillColor('#475569').font('Helvetica').fontSize(10).text(diagnosis, 48);
        doc.moveDown(1.5);
      }

      // Medications Table Header
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('Medications', 48);
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.rect(48, tableTop, 499, 22).fill('#4338ca');
      
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      doc.text('#', 58, tableTop + 6);
      doc.text('Medicine', 82, tableTop + 6);
      doc.text('Dose', 190, tableTop + 6);
      doc.text('Schedule', 266, tableTop + 6);
      doc.text('Duration', 378, tableTop + 6);
      doc.text('Quantity', 455, tableTop + 6);

      let currentY = tableTop + 22;
      doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

      if (medicines && medicines.length > 0) {
        medicines.forEach((med, idx) => {
          // Draw Row background alternating
          if (idx % 2 === 1) {
            doc.rect(48, currentY, 499, 20).fill('#f8fafc');
            doc.fillColor('#1e293b');
          }
          doc.text(String(idx + 1), 58, currentY + 6);
          doc.text(med.name || '', 82, currentY + 6, { width: 102, lineBreak: false });
          doc.text([med.dosage, med.units_per_dose].filter(Boolean).join(' · ') || '—', 190, currentY + 6, { width: 70, lineBreak: false });
          doc.text(med.timing || med.frequency || '—', 266, currentY + 6, { width: 108, lineBreak: false });
          doc.text(med.duration || '—', 378, currentY + 6, { width: 72, lineBreak: false });
          doc.text(med.quantity || '—', 455, currentY + 6, { width: 82, lineBreak: false });
          
          // Draw Row bottom border
          doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(48, currentY + 20).lineTo(547, currentY + 20).stroke();
          currentY += 20;
        });
      } else {
        doc.text('None prescribed.', 90, currentY + 6);
        currentY += 20;
      }
      
      doc.y = currentY;
      doc.moveDown(1.5);

      // Notes Section
      const notes = rx.doctor_notes || rx.advice || '';
      if (notes) {
        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('Doctor Notes / Advice', 48);
        doc.moveDown(0.3);
        doc.fillColor('#475569').font('Helvetica').fontSize(10).text(notes, 48);
        doc.moveDown(1.5);
      }

      // AI Powered Explanation Section (Parsing HTML tags dynamically)
      const aiExplanation = rx.ai_explanation;
      if (aiExplanation) {
        doc.fillColor('#4338ca').font('Helvetica-Bold').fontSize(12).text('AI-Powered Explanation & Guidance', 48);
        doc.moveDown(0.5);

        // Simple HTML rendering helper for E-prescriptions
        const renderHtmlToPdf = (htmlText) => {
          // Remove overall container wrapper div if present
          let cleanText = htmlText.replace(/<div class="ai-explanation-box">/gi, '').replace(/<\/div>/gi, '');
          
          // Split by tags
          const tagsRegex = /(<h[1-6]>.*?<\/h[1-6]>|<p>.*?<\/p>|<li>.*?<\/li>|<ul>|<\/ul>|<ol>|<\/ol>)/gi;
          const tokens = cleanText.split(tagsRegex);

          tokens.forEach(token => {
            if (!token.trim()) return;

            // Header matching
            if (/<h[1-6]>(.*?)<\/h[1-6]>/i.test(token)) {
              const content = token.replace(/<h[1-6]>/i, '').replace(/<\/h[1-6]>/i, '').replace(/<[^>]*>/g, '').trim();
              doc.moveDown(0.4);
              doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10).text(content);
              doc.moveDown(0.2);
            } 
            // List item matching
            else if (/<li>(.*?)<\/li>/i.test(token)) {
              const content = token.replace(/<li>/i, '').replace(/<\/li>/i, '').replace(/<[^>]*>/g, '').trim();
              doc.fillColor('#475569').font('Helvetica').fontSize(9).text(`• ${content}`, { indent: 12 });
            } 
            // Paragraph matching
            else if (/<p>(.*?)<\/p>/i.test(token)) {
              const content = token.replace(/<p>/i, '').replace(/<\/p>/i, '').replace(/<[^>]*>/g, '').trim();
              doc.fillColor('#475569').font('Helvetica').fontSize(9).text(content);
              doc.moveDown(0.3);
            } 
            // Catch all if there are simple styles like <strong> or <b>
            else if (!token.includes('<ul') && !token.includes('</ul') && !token.includes('<ol') && !token.includes('</ol')) {
              const content = token.replace(/<[^>]*>/g, '').trim();
              doc.fillColor('#475569').font('Helvetica').fontSize(9).text(content);
              doc.moveDown(0.2);
            }
          });
        };

        try {
          renderHtmlToPdf(aiExplanation);
        } catch (parserErr) {
          console.warn('[PDF] Failed to parse AI HTML, outputting raw text: ', parserErr);
          const rawExplanation = aiExplanation.replace(/<[^>]*>/g, '');
          doc.fillColor('#475569').font('Helvetica').fontSize(9).text(rawExplanation);
        }
        
        doc.moveDown(1.5);
      }

      // QR Code scan section
      const token = rx.public_token || rx.prescription_id;
      const verifyUrl = `${siteUrl.replace(/\/$/, '')}/prescriptions/verify/${token}`;
      
      try {
        const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 80, margin: 1 });
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text('Scan to verify:', 48);
        doc.image(qrBuffer, 48, doc.y + 4, { width: 64, height: 64 });
        doc.y += 72; // Move below QR code
      } catch (qrErr) {
        console.error('[PDF] QR Generation failed: ', qrErr.message);
      }

      doc.moveDown(1);

      // Centered Get Well Soon Box
      doc.moveDown(1);
      const quoteY = doc.y;
      doc.fillColor('#4338ca')
         .font('Helvetica-Bold')
         .fontSize(11)
         .text('❤️ Get Well Soon!', 48, quoteY, { align: 'center' });
      
      doc.fillColor('#64748b')
         .font('Helvetica-Oblique')
         .fontSize(8.5)
         .text('"Your health is our priority. Wishing you a speedy recovery!"', 48, quoteY + 16, { align: 'center' });
      
      doc.moveDown(2);

      // Signature block
      const sigY = doc.y;
      doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(340, sigY).lineTo(540, sigY).stroke();
      doc.fillColor('#64748b')
         .font('Helvetica')
         .fontSize(8.5)
         .text(`Dr. ${doctor.full_name}`, 340, sigY + 6);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const savePdfBytesLocally = (pdfBytes, rxIdLabel) => {
  const filename = `rx_${rxIdLabel}.pdf`;
  const uploadDir = path.join(__dirname, '../static/uploads/prescriptions');
  fs.mkdirSync(uploadDir, { recursive: true });
  const localPath = path.join(uploadDir, filename);
  fs.writeFileSync(localPath, pdfBytes);
  return `/static/uploads/prescriptions/${filename}`;
};

module.exports = {
  generatePrescriptionPdf,
  savePdfBytesLocally
};
