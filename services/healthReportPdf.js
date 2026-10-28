const PDFDocument = require('pdfkit');

const generateHealthReportPdf = (patient, configs, logs) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Group logs by condition
      const groupedLogs = {};
      logs.forEach(log => {
        const cond = log.condition;
        if (!groupedLogs[cond]) {
          groupedLogs[cond] = [];
        }
        groupedLogs[cond].push(log);
      });

      const conditionLabels = {
        blood_sugar: 'Blood Sugar',
        blood_pressure: 'Blood Pressure',
        weight: 'Weight',
        temperature: 'Body Temperature',
        spo2: 'SpO2'
      };

      // Header
      doc.fillColor('#0d9488')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('✚ UltraCare Health Tracker Report', 48, 48);

      const todayStr = new Date().toLocaleString('en-US', { hour12: false });
      doc.fillColor('#64748b')
         .fontSize(9)
         .font('Helvetica')
         .text(`Generated on ${todayStr} · Personal Health Summary`, 48, 70);

      doc.moveDown(1.5);

      // Patient Demographics Box
      const startY = doc.y;
      doc.rect(48, startY, 499, 65)
         .fillColor('#f8fafc')
         .fill();

      // Border for demographics
      doc.strokeColor('#cbd5e1')
         .lineWidth(0.5)
         .rect(48, startY, 499, 65)
         .stroke();

      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10);
      doc.text('Patient Name:', 60, startY + 12);
      doc.text('Email Address:', 60, startY + 28);
      doc.text('Active Trackers:', 60, startY + 44);

      doc.font('Helvetica').fillColor('#334155');
      doc.text(patient.full_name || 'N/A', 160, startY + 12);
      doc.text(patient.email || 'N/A', 160, startY + 28);

      const activeList = configs.map(c => conditionLabels[c.condition] || c.condition.replace('_', ' ')).join(', ');
      doc.text(activeList || 'None', 160, startY + 44, { width: 370 });

      doc.y = startY + 80;

      // Section title: Logs
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('📈 Tracked Vitals & Readings Logs', 48);
      doc.moveDown(0.5);

      const conditions = Object.keys(groupedLogs);
      if (conditions.length === 0) {
        doc.fillColor('#64748b').font('Helvetica-Oblique').fontSize(9).text('No vitals or health readings have been logged yet in this report.', 48);
        doc.moveDown(1.5);
      } else {
        conditions.forEach(cond => {
          const label = conditionLabels[cond] || cond.replace('_', ' ');
          doc.fillColor('#0d9488').font('Helvetica-Bold').fontSize(10).text(`${label} Log Summary`, 48);
          doc.moveDown(0.3);

          // Table Headers Setup
          const tableTop = doc.y;
          doc.rect(48, tableTop, 499, 18).fill('#0d9488');

          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
          doc.text('Date', 58, tableTop + 5);
          doc.text('Time', 128, tableTop + 5);

          let keys = [];
          if (cond === 'blood_sugar') {
            doc.text('Fasting', 188, tableTop + 5);
            doc.text('Post-Meal', 248, tableTop + 5);
            doc.text('Random', 318, tableTop + 5);
            keys = ['fasting', 'post_meal', 'random'];
          } else if (cond === 'blood_pressure') {
            doc.text('Systolic', 188, tableTop + 5);
            doc.text('Diastolic', 248, tableTop + 5);
            doc.text('Pulse', 318, tableTop + 5);
            keys = ['systolic', 'diastolic', 'pulse'];
          } else if (cond === 'weight') {
            doc.text('Weight (kg)', 188, tableTop + 5);
            keys = ['weight'];
          } else if (cond === 'temperature') {
            doc.text('Temp (°F)', 188, tableTop + 5);
            keys = ['temp'];
          } else if (cond === 'spo2') {
            doc.text('SpO2 (%)', 188, tableTop + 5);
            keys = ['spo2'];
          }

          doc.text('Notes', 388, tableTop + 5);

          let currentY = tableTop + 18;
          doc.font('Helvetica').fontSize(8.5).fillColor('#334155');

          const condLogs = groupedLogs[cond];
          condLogs.forEach((log, idx) => {
            // Check page height space remaining
            if (currentY > 750) {
              doc.addPage();
              currentY = 48;
              // Redraw header for table on new page
              doc.rect(48, currentY, 499, 18).fill('#0d9488');
              doc.fillColor('#ffffff').font('Helvetica-Bold');
              doc.text('Date', 58, currentY + 5);
              doc.text('Time', 128, currentY + 5);
              if (cond === 'blood_sugar') {
                doc.text('Fasting', 188, currentY + 5);
                doc.text('Post-Meal', 248, currentY + 5);
                doc.text('Random', 318, currentY + 5);
              } else if (cond === 'blood_pressure') {
                doc.text('Systolic', 188, currentY + 5);
                doc.text('Diastolic', 248, currentY + 5);
                doc.text('Pulse', 318, currentY + 5);
              } else if (cond === 'weight') {
                doc.text('Weight (kg)', 188, currentY + 5);
              } else if (cond === 'temperature') {
                doc.text('Temp (°F)', 188, currentY + 5);
              } else if (cond === 'spo2') {
                doc.text('SpO2 (%)', 188, currentY + 5);
              }
              doc.text('Notes', 388, currentY + 5);
              currentY += 18;
            }

            // Alternating rows
            if (idx % 2 === 1) {
              doc.rect(48, currentY, 499, 16).fill('#f2fbf9');
              doc.fillColor('#334155');
            }

            doc.font('Helvetica').fontSize(8.5);
            doc.text(log.log_date || '—', 58, currentY + 4);
            doc.text(log.log_time || '—', 128, currentY + 4);

            const metrics = typeof log.metrics === 'string' ? JSON.parse(log.metrics || '{}') : log.metrics || {};
            if (cond === 'blood_sugar' || cond === 'blood_pressure') {
              doc.text(String(metrics[keys[0]] || '—'), 188, currentY + 4);
              doc.text(String(metrics[keys[1]] || '—'), 248, currentY + 4);
              doc.text(String(metrics[keys[2]] || '—'), 318, currentY + 4);
            } else {
              doc.text(String(metrics[keys[0]] || '—'), 188, currentY + 4);
            }

            doc.text(log.note || '—', 388, currentY + 4, { width: 150, lineBreak: false });

            // Bottom border
            doc.strokeColor('#cbd5e1').lineWidth(0.3).moveTo(48, currentY + 16).lineTo(547, currentY + 16).stroke();
            currentY += 16;
          });

          doc.y = currentY;
          doc.moveDown(1.2);
        });
      }

      // Check if page overflow for wellness tips
      if (doc.y > 550) {
        doc.addPage();
      }

      // Section 2: Healthy Living Tips
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('❤️ Personalized Wellness & Healthy Living Tips', 48);
      doc.moveDown(0.5);

      const baseTips = [
        '• Hydration: Drink at least 2.5 to 3 liters of clean water daily to support cellular recovery.',
        '• Active Movement: Target 30 minutes of aerobic exercise (like brisk walking) 5 times a week.',
        '• Quality Sleep: Prioritize 7 to 8 hours of restorative sleep to manage cortisol levels.',
        '• Diet Balance: Focus on whole, nutrient-dense foods. Limit sodium, refined sugars, and trans-fats.',
        '• Medication Adherence: Take prescribed medications at consistent times and update your Healing Plan log.'
      ];

      doc.fillColor('#334155').font('Helvetica').fontSize(9);
      baseTips.forEach(tip => {
        doc.text(tip, { lineGap: 3 });
      });

      doc.moveDown(1);

      // Condition specific advice
      doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(10).text('💡 Condition-Specific Medical Guidance');
      doc.moveDown(0.4);

      let hasConditionTips = false;
      doc.fillColor('#334155').font('Helvetica').fontSize(9);

      configs.forEach(c => {
        const cond = c.condition;
        if (cond === 'blood_sugar') {
          hasConditionTips = true;
          doc.font('Helvetica-Bold').fillColor('#0f766e').text('For Blood Sugar Management:');
          doc.font('Helvetica').fillColor('#334155');
          doc.text('• Avoid high-glycemic carbohydrates (white rice, white bread, sodas). Opt for fiber-rich grains.', { indent: 12, lineGap: 2 });
          doc.text('• Fasting blood sugar checks should be done right after waking up. Post-meal checks exactly 2 hours after meals.', { indent: 12, lineGap: 2 });
          doc.text('• Carry a quick-acting carb source (like fruit juice or glucose tablets) to counter low-sugar episodes.', { indent: 12, lineGap: 4 });
        } else if (cond === 'blood_pressure') {
          hasConditionTips = true;
          doc.font('Helvetica-Bold').fillColor('#0f766e').text('For Blood Pressure Control:');
          doc.font('Helvetica').fillColor('#334155');
          doc.text('• Limit daily sodium intake to under 2,000 mg (about 1 teaspoon of salt).', { indent: 12, lineGap: 2 });
          doc.text('• Engage in deep breathing or mindfulness meditation for 10 minutes daily.', { indent: 12, lineGap: 2 });
          doc.text('• Avoid recording BP immediately after coffee, tea, smoking, or exercising. Rest for 5 mins.', { indent: 12, lineGap: 4 });
        } else if (cond === 'weight') {
          hasConditionTips = true;
          doc.font('Helvetica-Bold').fillColor('#0f766e').text('For Healthy Weight Tracking:');
          doc.font('Helvetica').fillColor('#334155');
          doc.text('• Focus on a modest, sustainable caloric deficit rather than crash dieting.', { indent: 12, lineGap: 2 });
          doc.text('• Record weight measurements consistently at the same time (ideally morning, fasting, after empty bladder).', { indent: 12, lineGap: 2 });
          doc.text('• Combine diet control with resistance training to maintain lean muscle mass.', { indent: 12, lineGap: 4 });
        }
      });

      if (!hasConditionTips) {
        doc.fillColor('#64748b').font('Helvetica-Oblique').text('Start tracking specific vitals (like Blood Sugar or Blood Pressure) to view condition-tailored guidelines here.');
        doc.moveDown(1);
      }

      // Disclaimer Footer
      doc.moveDown(2);
      doc.fillColor('#64748b')
         .font('Helvetica-Oblique')
         .fontSize(7.5)
         .text('🛡️ Medical Disclaimer: This health record report is automatically compiled for informational and clinical tracking reference. Do not self-diagnose or modify dosage treatments without consulting your physician. Contact emergency services for acute symptoms.', { align: 'center', lineGap: 2 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateHealthReportPdf
};
