/* ============================================
   FiscalGenie Multi-Step Form Engine
   ============================================ */

(function() {
  'use strict';

  // ---- Config ----
  const CONFIG = {
    webhookUrl: '/submit.php',      // Change to your webhook/CRM endpoint
    emailNotify: '',                // Set in submit.php
    formName: document.title
  };

  // ---- State ----
  let currentStep = 0;
  let formData = {};
  const steps = document.querySelectorAll('.form-step');
  const progressSteps = document.querySelectorAll('.progress-step');
  const progressFill = document.querySelector('.progress-fill');

  // ---- Init ----
  function init() {
    if (!steps.length) return;
    showStep(0);
    setupOptionButtons();
    setupNextButtons();
    setupBackButtons();
    setupSubmit();
    setupInputValidation();
  }

  // ---- Progress ----
  function updateProgress(stepIdx) {
    const total = progressSteps.length;
    progressSteps.forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i < stepIdx) s.classList.add('done');
      else if (i === stepIdx) s.classList.add('active');
    });
    if (progressFill) {
      const pct = total > 1 ? (stepIdx / (total - 1)) * 100 : 0;
      progressFill.style.width = pct + '%';
    }
  }

  // ---- Show Step ----
  function showStep(idx) {
    if (idx < 0 || idx >= steps.length) return;
    steps.forEach(s => s.classList.remove('active'));
    steps[idx].classList.add('active');
    currentStep = idx;
    const visibleIdx = Math.min(idx, progressSteps.length - 1);
    updateProgress(visibleIdx);
    // scroll form into view on mobile
    const card = document.querySelector('.form-card');
    if (card && window.innerWidth < 860) {
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }

  // ---- Option Buttons ----
  function setupOptionButtons() {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const group = this.closest('.option-group');
        const field = this.dataset.field;
        const value = this.dataset.value;

        // Deselect siblings
        if (group) {
          group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        } else {
          const step = this.closest('.form-step');
          step && step.querySelectorAll(`[data-field="${field}"]`).forEach(b => b.classList.remove('selected'));
        }

        this.classList.add('selected');
        formData[field] = value;

        // Auto-advance after short delay for smooth UX
        setTimeout(() => {
          const nextStep = currentStep + 1;
          if (nextStep < steps.length) showStep(nextStep);
        }, 280);
      });
    });
  }

  // ---- Next Buttons ----
  function setupNextButtons() {
    document.querySelectorAll('.btn-next').forEach(btn => {
      btn.addEventListener('click', function() {
        const step = this.closest('.form-step');
        if (validateStep(step)) {
          collectStepData(step);
          showStep(currentStep + 1);
        }
      });
    });
  }

  // ---- Back Buttons ----
  function setupBackButtons() {
    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', function() {
        if (currentStep > 0) showStep(currentStep - 1);
      });
    });
  }

  // ---- Submit ----
  function setupSubmit() {
    const form = document.getElementById('lead-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitStep = form.querySelector('.form-step.active');
      if (!validateStep(submitStep)) return;
      collectStepData(submitStep);

      // Collect remaining inputs
      form.querySelectorAll('input[name], select[name]').forEach(input => {
        if (input.value.trim()) formData[input.name] = input.value.trim();
      });

      // Add metadata
      formData['_source'] = window.location.href;
      formData['_page'] = CONFIG.formName;
      formData['_ts'] = new Date().toISOString();
      formData['_ua'] = navigator.userAgent.substring(0, 120);

      submitLead();
    });
  }

  function submitLead() {
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
      submitBtn.textContent = 'Connecting you to lenders...';
      submitBtn.disabled = true;
    }

    fetch(CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(() => showThankYou())
    .catch(() => {
      // Still show thank you even if submit fails (fail silently, log in console)
      console.warn('Lead submit network error - storing locally');
      try { localStorage.setItem('fg_lead_' + Date.now(), JSON.stringify(formData)); } catch(e) {}
      showThankYou();
    });
  }

  function showThankYou() {
    steps.forEach(s => s.classList.remove('active'));
    const ty = document.getElementById('thank-you-step');
    if (ty) {
      ty.classList.remove('hidden');
      ty.classList.add('active');
      // Hide progress bar
      const pb = document.querySelector('.progress-bar-wrap');
      if (pb) pb.style.display = 'none';
    }
    // Update progress to 100%
    progressSteps.forEach(s => s.classList.add('done'));
    if (progressFill) progressFill.style.width = '100%';
  }

  // ---- Collect Data ----
  function collectStepData(step) {
    if (!step) return;
    step.querySelectorAll('input[name], select[name]').forEach(input => {
      if (input.value.trim()) formData[input.name] = input.value.trim();
    });
  }

  // ---- Validation ----
  function validateStep(step) {
    if (!step) return true;
    let valid = true;

    // Required inputs
    step.querySelectorAll('[required]').forEach(input => {
      input.classList.remove('error');
      if (!input.value.trim()) {
        input.classList.add('error');
        valid = false;
      }
    });

    // Phone validation
    const phone = step.querySelector('input[name="phone"]');
    if (phone && phone.value.trim()) {
      const digits = phone.value.replace(/\D/g,'');
      if (digits.length < 10) {
        phone.classList.add('error');
        valid = false;
      }
    }

    // Email validation
    const email = step.querySelector('input[name="email"]');
    if (email && email.value.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email.value.trim())) {
        email.classList.add('error');
        valid = false;
      }
    }

    if (!valid) {
      step.querySelector('.error')?.focus();
      step.querySelector('.error')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return valid;
  }

  // ---- Input Formatting ----
  function setupInputValidation() {
    // Phone auto-format
    document.querySelectorAll('input[name="phone"]').forEach(input => {
      input.addEventListener('input', function() {
        this.classList.remove('error');
        let v = this.value.replace(/\D/g,'');
        if (v.length >= 7) {
          this.value = '(' + v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6,10);
        } else if (v.length >= 4) {
          this.value = '(' + v.slice(0,3) + ') ' + v.slice(3);
        } else if (v.length > 0) {
          this.value = '(' + v;
        }
      });
    });

    // Remove error on input change
    document.querySelectorAll('.form-input, .form-select').forEach(input => {
      input.addEventListener('input', function() { this.classList.remove('error'); });
      input.addEventListener('change', function() { this.classList.remove('error'); });
    });
  }

  // ---- FAQ Accordion ----
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', function() {
      const item = this.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // ---- Run ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
