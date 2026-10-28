(function () {
  const tbody = document.getElementById('medicineTableBody');
  const addBtn = document.getElementById('addMedicineRow');
  const form = document.getElementById('prescriptionForm');
  const ocrBtn = document.getElementById('runOcrBtn');
  const fileInput = document.getElementById('prescription_file');
  const uploadZone = document.getElementById('uploadZone');
  const csrf = document.querySelector('[name=csrf_token]')?.value
    || document.querySelector('meta[name=csrf-token]')?.content;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function row(data) {
    data = data || {};
    const tr = document.createElement('tr');
    tr.className = 'medicine-row';
    const isRequired = !(fileInput && fileInput.files && fileInput.files.length > 0);
    const requiredAttr = isRequired ? 'required' : '';
    const placeholderText = isRequired ? 'Medicine' : 'Medicine (Optional)';
    tr.innerHTML = `
      <td><input type="text" name="medicine_name[]" class="form-input form-input-sm" value="${esc(data.name || '')}" ${requiredAttr} placeholder="${placeholderText}"></td>
      <td><input type="text" name="medicine_dosage[]" class="form-input form-input-sm" value="${esc(data.dosage || '')}" placeholder="500mg"></td>
      <td><input type="text" name="medicine_timing[]" class="form-input form-input-sm" value="${esc(data.timing || data.frequency || '')}" placeholder="After food"></td>
      <td><input type="text" name="medicine_duration[]" class="form-input form-input-sm" value="${esc(data.duration || '')}" placeholder="7 days"></td>
      <td><button type="button" class="btn btn-ghost btn-sm remove-row" style="color:var(--danger)">&times;</button></td>`;
    tr.querySelector('.remove-row').onclick = () => {
      if (tbody.querySelectorAll('tr').length > 1) {
        tr.remove();
        updateRequiredState();
      }
    };
    return tr;
  }

  function updateRequiredState() {
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
    const diagnosisField = document.querySelector('[name=diagnosis]');
    
    if (hasFile) {
      if (diagnosisField) {
        diagnosisField.removeAttribute('required');
        diagnosisField.placeholder = "Primary diagnosis (Optional, extracted by AI if blank)…";
      }
      tbody.querySelectorAll('input[name="medicine_name[]"]').forEach(input => {
        input.removeAttribute('required');
        input.placeholder = "Medicine (Optional)";
      });
    } else {
      if (diagnosisField) {
        diagnosisField.setAttribute('required', 'required');
        diagnosisField.placeholder = "Primary diagnosis…";
      }
      tbody.querySelectorAll('input[name="medicine_name[]"]').forEach(input => {
        input.setAttribute('required', 'required');
        input.placeholder = "Medicine";
      });
    }
  }

  addBtn?.addEventListener('click', () => {
    tbody.appendChild(row());
    updateRequiredState();
  });
  
  if (tbody && !tbody.children.length) addBtn?.click();

  uploadZone?.addEventListener('click', () => fileInput.click());
  uploadZone?.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });

  fileInput?.addEventListener('change', () => {
    updateRequiredState();
    if (fileInput.files.length) {
      uploadZone.querySelector('p').textContent = `📄 Selected: ${fileInput.files[0].name}`;
    } else {
      uploadZone.querySelector('p').textContent = `📤 Drag & drop or click — PDF, JPG, PNG (max 10 MB)`;
    }
  });

  ocrBtn?.addEventListener('click', async () => {
    if (!fileInput?.files?.length) { alert('Upload an image first.'); return; }
    ocrBtn.disabled = true;
    ocrBtn.textContent = 'Reading…';
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    try {
      const res = await fetch('/api/prescription/ocr/', { method: 'POST', body: fd, headers: csrf ? { 'X-CSRFToken': csrf } : {} });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'OCR failed');
      if (data.medicines?.length) {
        tbody.innerHTML = '';
        data.medicines.forEach((m) => tbody.appendChild(row(m)));
        updateRequiredState();
      }
      if (data.raw_text) {
        const box = document.getElementById('ocrPreview');
        if (box) { box.classList.remove('d-none'); box.style.display = 'block'; box.textContent = data.raw_text; }
      }
      document.getElementById('run_ocr').value = '1';
      alert(data.medicines?.length ? 'Medicines auto-filled.' : 'OCR done — add medicines manually if needed.');
    } catch (e) {
      alert(e.message);
    } finally {
      ocrBtn.disabled = false;
      ocrBtn.textContent = '🔍 Scan with OCR';
    }
  });

  form?.addEventListener('submit', () => {
    const btn = form.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving & generating PDF…'; }
  });
  
  // Initial check on load
  updateRequiredState();
})();
