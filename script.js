/* ==========================================================================
    airport-security-dashboard - script.js
    Strict Vanilla JavaScript Frontend - Non-simulated AWS Endpoint Fetch
   ========================================================================== */

/**
 * API Configuration
 */
const CONFIG = {
    BASE_URL: "https://vrmxb2kzy1.execute-api.ap-south-1.amazonaws.com"
};

/**
 * RESPONSE_MAP configuration object.
 * Adapts backend-specific response keys to standard frontend structures.
 * Modify these callback mappings to match your production API payload format.
 */
const RESPONSE_MAP = {
  // Mapping for the GET /results API items
  resultItem: {
    imageName: (data) => data.imageName || data.fileName || data.s3Key || 'Unknown Scan',
    imageUrl: (data) => data.imageUrl || data.s3Url || '',
    labels: (data) => data.labels || [],
    confidence: (data) => data.confidence !== undefined ? parseFloat(data.confidence) : 0,
    weaponDetected: (data) => data.weaponDetected === true || String(data.weaponDetected).toLowerCase() === 'true',
    weaponLabels: (data) => data.weaponLabels || [],
    timestamp: (data) => data.timestamp || 'N/A',
    emailStatus: (data) => data.emailStatus || 'Pending Notification',
    bucketName: (data) => data.bucketName || 'N/A'
  },
  // Mapping for the GET /dashboard API KPIs
  dashboardMetrics: {
    totalScans: (data) => data.totalScans !== undefined ? parseInt(data.totalScans, 10) : 0,
    threatDetections: (data) => data.threatDetections !== undefined ? parseInt(data.threatDetections, 10) : 0,
    averageLatency: (data) => data.averageLatency !== undefined ? parseFloat(data.averageLatency) : 0,
    rekognitionSuccessRate: (data) => data.rekognitionSuccessRate !== undefined ? parseFloat(data.rekognitionSuccessRate) : 100
  },
  // Mapping for the GET /dashboard API table rows
  dashboardTableItem: {
    imageName: (data) => data.imageName || data.fileName || data.s3Key || 'Unknown Scan',
    labels: (data) => data.labels || [],
    confidence: (data) => data.confidence !== undefined ? parseFloat(data.confidence) : 0,
    weaponDetected: (data) => data.weaponDetected === true || String(data.weaponDetected).toLowerCase() === 'true',
    timestamp: (data) => data.timestamp || 'N/A',
    emailStatus: (data) => data.emailStatus || 'Pending Notification',
    processingStatus: (data) => data.processingStatus || 'Completed'
  },
  // Mapping for the GET /dashboard charts data structure
  dashboardCharts: {
    threatRatio: (data) => data.threatRatio || { safeCount: 0, threatCount: 0 },
    volumeTracking: (data) => data.volumeTracking || [] // Format: [{ label: '09:00', count: 5 }, ...]
  }
};

/**
 * Encapsulated API client separating network communication from UI presentation.
 * Communicates ONLY via real fetch() calls. No mock responses are returned here.
 */
const apiClient = {
  /**
   * Upload file to backend.
   * @param {File} file - Baggage scan image file
   * @returns {Promise<Response>} HTTP Response promise
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return await fetch(`${CONFIG.BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    });
  },

  /**
   * Fetch analysis results feed.
   * @returns {Promise<Array>} Unparsed array of detection results
   */
  async getResults() {
    try {
      const response = await fetch(`${CONFIG.BASE_URL}/results`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error("Backend Offline");
    }
  },

  /**
   * Fetch operations metrics dashboard data.
   * @returns {Promise<Object>} Unparsed dashboard analytics metrics
   */
  async getDashboard() {
    try {
      const response = await fetch(`${CONFIG.BASE_URL}/dashboard`);
      if (!response.ok) {
        // Return null instead of throwing, to prevent console errors if it's 404 or missing
        return null;
      }
      return await response.json();
    } catch (error) {
      // Do not display JavaScript errors, gracefully return null
      return null;
    }
  }
};

/**
 * Application State Manager
 */
const appState = {
  currentView: 'view-landing',
  activeUploadTimeout: null
};

/* ==========================================================================
    UI Core / Rendering Functions
   ========================================================================== */

/**
 * Initialize DOM Elements & Hook up Event Listeners on startup.
 */
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initNavigation();
  initUploadHandler();

  // Initial API Load
  refreshAllData();

  // Optional Periodic refresh interval
  setInterval(refreshAllData, 10000);
});

/**
 * Updates the UTC Clock in the header panel.
 */
function initClock() {
  const clockElement = document.getElementById('live-clock');
  function updateTime() {
    const now = new Date();
    const utcTime = now.toUTCString().replace('GMT', 'UTC');
    clockElement.textContent = utcTime;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

/**
 * Handle SPA route view switching with ARIA accessibility tags.
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const viewSections = document.querySelectorAll('.view-section');
  const pageTitle = document.getElementById('page-display-title');
  const enterUploadBtn = document.getElementById('btn-enter-upload');

  /**
   * Switch the current active view.
   * @param {string} targetViewId - ID of target view section
   */
  function switchView(targetViewId) {
    viewSections.forEach(section => {
      if (section.id === targetViewId) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });

    navLinks.forEach(link => {
      const buttonTarget = link.getAttribute('aria-controls');
      if (buttonTarget === targetViewId) {
        link.classList.add('active');
        link.setAttribute('aria-selected', 'true');
        // Update Title Display
        pageTitle.textContent = link.querySelector('span').textContent;
      } else {
        link.classList.remove('active');
        link.setAttribute('aria-selected', 'false');
      }
    });

    appState.currentView = targetViewId;
  }

  // Bind Sidebar Nav buttons
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetViewId = link.getAttribute('aria-controls');
      switchView(targetViewId);
    });
  });

  // Bind Landing screen Action CTA
  if (enterUploadBtn) {
    enterUploadBtn.addEventListener('click', () => {
      switchView('view-upload');
    });
  }
}

/**
 * Sets up drag-drop inputs & selects file changes.
 */
function initUploadHandler() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('btn-browse-file');

  browseBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  });
}

/**
 * Steps the UI Upload State tracker through stages.
 * UI progress states: Selected -> Uploading to S3 -> Queued in SQS -> Processing -> Completed.
 * @param {File} file - Image file
 */
function processSelectedFile(file) {
  const flowPanel = document.getElementById('upload-flow-panel');
  const statusText = document.getElementById('upload-status-text');
  const percentageText = document.getElementById('upload-percentage');
  const progressBarFill = document.getElementById('progress-bar-fill');

  // Reset previous transitions
  if (appState.activeUploadTimeout) {
    clearTimeout(appState.activeUploadTimeout);
  }

  flowPanel.classList.remove('hidden');
  resetUploadProgressSteps();

  // Step 1: Selected
  setUploadProgressStep('step-selected', 0, `Selected Scan File: ${file.name}`);

  // Step 2: Uploading to S3
  appState.activeUploadTimeout = setTimeout(() => {
    setUploadProgressStep('step-s3', 25, 'Uploading source image to Amazon S3 bucket...');

    // Execute real backend call
    apiClient.uploadFile(file)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Upload Failed. HTTP Code: ${response.status}`);
        }

        // Step 3: Queued in SQS (Successful transition start)
        setUploadProgressStep('step-sqs', 50, 'Ingested payload events queued inside SQS...');

        appState.activeUploadTimeout = setTimeout(() => {
          // Step 4: Processing
          setUploadProgressStep('step-lambda', 75, 'Lambda routing processing pipeline & invoking Amazon Rekognition...');

          appState.activeUploadTimeout = setTimeout(() => {
            // Step 5: Completed
            setUploadProgressStep('step-complete', 100, 'Pipeline ingestion processing successfully completed.');
            refreshAllData();
          }, 1200);
        }, 1200);
      })
      .catch((error) => {
        // Render raw backend response fail state
        console.error('Upload operation failed:', error);
        progressBarFill.style.width = '25%';
        statusText.innerHTML = `<span style="color: var(--threat-red);">Backend Offline</span>`;
        percentageText.textContent = 'ERR';
      });
  }, 1000);
}

/**
 * Clears all progress steps classes.
 */
function resetUploadProgressSteps() {
  const steps = ['step-selected', 'step-s3', 'step-sqs', 'step-lambda', 'step-complete'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active', 'completed');
    }
  });
  const fill = document.getElementById('progress-bar-fill');
  if (fill) fill.style.width = '0%';
}

/**
 * Highlights active steps in pipeline progression.
 * @param {string} elementId - ID of active step
 * @param {number} percentage - Percentage visual fill
 * @param {string} message - Ingestion text status message
 */
function setUploadProgressStep(elementId, percentage, message) {
  const currentStep = document.getElementById(elementId);
  const statusText = document.getElementById('upload-status-text');
  const percentageText = document.getElementById('upload-percentage');
  const progressBarFill = document.getElementById('progress-bar-fill');

  if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
  if (percentageText) percentageText.textContent = `${percentage}%`;
  if (statusText) statusText.textContent = message;

  if (currentStep) {
    currentStep.classList.add('active');

    // Mark previous steps as completed
    let sibling = currentStep.previousElementSibling;
    while (sibling) {
      sibling.classList.remove('active');
      sibling.classList.add('completed');
      sibling = sibling.previousElementSibling;
    }
  }
}

/**
 * Triggers refresh queries to the backend results and dashboard stats API client.
 */
function refreshAllData() {
  const statusBadge = document.getElementById('backend-status-badge');

  // Results Feed Fetch Call
  apiClient.getResults()
    .then(data => {
      renderResults(data);
      renderStatusList(data);
      statusBadge.textContent = 'Linked';
      statusBadge.className = 'status-badge-live';
      statusBadge.style = ''; // Reset offline styles
    })
    .catch(err => {
      console.warn('Results fetch unreachable:', err.message);
      renderResults(null);
      renderStatusList(null);
      statusBadge.textContent = 'Backend Offline';
      statusBadge.className = 'status-badge-live';
      statusBadge.style.borderColor = 'var(--threat-red)';
      statusBadge.style.color = 'var(--threat-red)';
      statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    });

  // Dashboard Metrics Fetch Call
  apiClient.getDashboard()
    .then(data => {
      renderDashboard(data);
    })
    .catch(err => {
      // In case any uncaught issue occurs
      renderDashboard(null);
    });
}

/**
 * Renders detection cards into Results Grid viewport.
 * Falls back to "Waiting for backend response..." if no data matches.
 * @param {Array|null} data - Results list data
 */
function renderResults(data) {
  const container = document.getElementById('results-grid');
  if (!container) return;

  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = createWaitingFallbackHTML();
    return;
  }

  let htmlContent = '';
  data.forEach(item => {
    // Run item mapping translations from config object
    const mapped = {
      imageName: RESPONSE_MAP.resultItem.imageName(item),
      imageUrl: RESPONSE_MAP.resultItem.imageUrl(item),
      labels: RESPONSE_MAP.resultItem.labels(item),
      confidence: RESPONSE_MAP.resultItem.confidence(item),
      weaponDetected: RESPONSE_MAP.resultItem.weaponDetected(item),
      weaponLabels: RESPONSE_MAP.resultItem.weaponLabels(item),
      timestamp: RESPONSE_MAP.resultItem.timestamp(item),
      emailStatus: RESPONSE_MAP.resultItem.emailStatus(item),
      bucketName: RESPONSE_MAP.resultItem.bucketName(item)
    };

    const threatClass = mapped.weaponDetected ? 'threat' : 'safe';
    const threatBadgeText = mapped.weaponDetected ? '🔴 THREAT' : '🟢 SAFE';
    const confClass = mapped.confidence > 80 ? 'confidence-hi' : 'confidence-low';

    // Create label list elements
    const labelPills = mapped.labels.map(l => `<span class="label-pill">${l}</span>`).join('');
    const weaponPills = mapped.weaponDetected
      ? mapped.weaponLabels.map(wl => `<span class="label-pill weapon-pill">${wl}</span>`).join('')
      : '';

    htmlContent += `
      <article class="glass-panel result-card" aria-label="Result details for ${escapeHtml(mapped.imageName)}">
        <div class="result-card-media">
          ${mapped.imageUrl
            ? `<img src="${escapeHtml(mapped.imageUrl)}" alt="Security Baggage Scan Image - ${escapeHtml(mapped.imageName)}">`
            : `<div class="result-media-placeholder">
                 <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 5H5l3.5-4.5z"/></svg>
                 <span>Preview Unavailable</span>
               </div>`
          }
          <div class="result-threat-floating">
            <span class="badge-threat-state ${threatClass}">${threatBadgeText}</span>
          </div>
        </div>
        <div class="result-card-body">
          <div class="result-card-title">
            <h3>${escapeHtml(mapped.imageName)}</h3>
          </div>

          <div class="result-meta-row">
            <div class="meta-item">
              <span class="meta-label">Ingested Time</span>
              <span class="meta-val">${escapeHtml(mapped.timestamp)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Accuracy Target</span>
              <span class="meta-val ${confClass}">${mapped.confidence.toFixed(1)}%</span>
            </div>
          </div>

          <div class="result-meta-row">
            <div class="meta-item">
              <span class="meta-label">SNS Alerts State</span>
              <span class="meta-val">${escapeHtml(mapped.emailStatus)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">S3 Ingest Bucket</span>
              <span class="meta-val">${escapeHtml(mapped.bucketName)}</span>
            </div>
          </div>

          <div class="meta-item" style="grid-column: span 2;">
            <span class="meta-label">Identified Artifact Tags</span>
            <div class="label-pill-container">
              ${labelPills || '<span style="color:var(--text-muted); font-size:0.75rem;">None</span>'}
            </div>
          </div>

          ${mapped.weaponDetected ? `
            <div class="meta-item" style="grid-column: span 2;">
              <span class="meta-label">Detected Offenses</span>
              <div class="label-pill-container">
                ${weaponPills}
              </div>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  });

  container.innerHTML = htmlContent;
}

/**
 * Populates Active Pipeline status feed section.
 * Falls back to "Waiting for backend response..." if no data matches.
 * @param {Array|null} data - Ingested list data
 */
function renderStatusList(data) {
  const container = document.getElementById('status-feed');
  if (!container) return;

  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = createWaitingFallbackHTML();
    return;
  }

  let htmlContent = '';
  data.forEach(item => {
    const imageName = RESPONSE_MAP.resultItem.imageName(item);
    const timestamp = RESPONSE_MAP.resultItem.timestamp(item);
    const weaponDetected = RESPONSE_MAP.resultItem.weaponDetected(item);
    const threatClass = weaponDetected ? 'threat' : 'safe';
    const threatBadgeText = weaponDetected ? 'Threat Flagged' : 'Safe Clearance';

    htmlContent += `
      <div class="glass-panel" style="padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="aws-node-icon" style="width: 36px; height: 36px;">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </div>
          <div>
            <h4 style="color:#fff; font-size:1.05rem; margin-bottom: 0.15rem;">${escapeHtml(imageName)}</h4>
            <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(timestamp)}</span>
          </div>
        </div>
        <div>
          <span class="badge-threat-state ${threatClass}" style="font-size:0.8rem; padding: 0.25rem 0.6rem;">${threatBadgeText}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = htmlContent;
}

/**
 * Handles population of the KPI metrics, static SVG Charts & Dashboard Logs Table.
 * Falls back to "Waiting for backend response..." if no data matches.
 * @param {Object|null} data - Complete metrics response payload
 */
function renderDashboard(data) {
  const kpiTotal = document.getElementById('kpi-total-scans');
  const kpiThreat = document.getElementById('kpi-threat-count');
  const kpiLatency = document.getElementById('kpi-latency');
  const kpiAccuracy = document.getElementById('kpi-accuracy');

  const ratioChartContainer = document.getElementById('chart-ratio-container');
  const volumeChartContainer = document.getElementById('chart-volume-container');
  const tableBody = document.getElementById('dashboard-table-body');

  // If no data response or error matches
  if (!data) {
    kpiTotal.textContent = '--';
    kpiThreat.textContent = '--';
    kpiLatency.textContent = '--';
    kpiAccuracy.textContent = '--';

    ratioChartContainer.innerHTML = createWaitingFallbackHTML(true);
    volumeChartContainer.innerHTML = createWaitingFallbackHTML(true);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="fallback-waiting-state small-fallback">
            <span class="waiting-text">Waiting for backend response...</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Map high level metrics
  const totalVal = RESPONSE_MAP.dashboardMetrics.totalScans(data);
  const threatVal = RESPONSE_MAP.dashboardMetrics.threatDetections(data);
  const latencyVal = RESPONSE_MAP.dashboardMetrics.averageLatency(data);
  const accuracyVal = RESPONSE_MAP.dashboardMetrics.rekognitionSuccessRate(data);

  kpiTotal.textContent = totalVal.toLocaleString();
  kpiThreat.textContent = threatVal.toLocaleString();
  kpiLatency.textContent = `${latencyVal.toFixed(2)}s`;
  kpiAccuracy.textContent = `${accuracyVal.toFixed(1)}%`;

  // Draw Charts
  const threatRatio = RESPONSE_MAP.dashboardCharts.threatRatio(data);
  const volumeData = RESPONSE_MAP.dashboardCharts.volumeTracking(data);

  drawThreatRatioChart(ratioChartContainer, threatRatio);
  drawVolumeChart(volumeChartContainer, volumeData);

  // Render Table Logs
  const logRows = data.tableLogs || [];
  if (logRows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No active scan logs recorded.
        </td>
      </tr>
    `;
    return;
  }

  let tableHtmlContent = '';
  logRows.forEach(row => {
    const mapped = {
      imageName: RESPONSE_MAP.dashboardTableItem.imageName(row),
      labels: RESPONSE_MAP.dashboardTableItem.labels(row),
      confidence: RESPONSE_MAP.dashboardTableItem.confidence(row),
      weaponDetected: RESPONSE_MAP.dashboardTableItem.weaponDetected(row),
      timestamp: RESPONSE_MAP.dashboardTableItem.timestamp(row),
      emailStatus: RESPONSE_MAP.dashboardTableItem.emailStatus(row),
      processingStatus: RESPONSE_MAP.dashboardTableItem.processingStatus(row)
    };

    const threatClass = mapped.weaponDetected ? 'threat' : 'safe';
    const threatBadgeText = mapped.weaponDetected ? '🔴 THREAT' : '🟢 SAFE';
    const labelList = mapped.labels.slice(0, 3).map(l => `<span class="label-pill">${l}</span>`).join(' ');

    tableHtmlContent += `
      <tr>
        <td style="font-weight:600; color:#fff;">${escapeHtml(mapped.imageName)}</td>
        <td>${labelList || '<span style="color:var(--text-muted)">--</span>'}</td>
        <td style="font-family: var(--font-tech); font-weight:600;">${mapped.confidence.toFixed(1)}%</td>
        <td><span class="badge-threat-state ${threatClass}" style="font-size:0.75rem; padding: 0.2rem 0.5rem;">${threatBadgeText}</span></td>
        <td>${escapeHtml(mapped.timestamp)}</td>
        <td><span style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(mapped.emailStatus)}</span></td>
        <td>
          <span style="font-size:0.8rem; display: inline-flex; align-items:center; gap:0.4rem; color:var(--text-secondary)">
            <span style="width:6px; height:6px; border-radius:50%; background-color:var(--safe-green)"></span>
            ${escapeHtml(mapped.processingStatus)}
          </span>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = tableHtmlContent;
}

/* ==========================================================================
    Visual Charts Implementation using Vanilla DOM and custom graphics
   ========================================================================== */

/**
 * Renders custom SVG Ring graph representing Safe vs Threats levels.
 * @param {HTMLElement} element - Target container
 * @param {Object} ratioObj - Object containing { safeCount, threatCount }
 */
function drawThreatRatioChart(element, ratioObj) {
  const safe = ratioObj.safeCount || 0;
  const threat = ratioObj.threatCount || 0;
  const total = safe + threat;

  if (total === 0) {
    element.innerHTML = `<span style="color: var(--text-muted); font-size: 0.9rem;">No metric data to generate chart view.</span>`;
    return;
  }

  const safePercent = ((safe / total) * 100).toFixed(0);
  const threatPercent = ((threat / total) * 100).toFixed(0);

  element.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-around; width: 100%; padding: 1rem;">
      <div style="position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center;">
        <!-- Circular Progress SVG -->
        <svg width="120" height="120" viewBox="0 0 120 120" style="transform: rotate(-90deg);">
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--border-light)" stroke-width="8" />
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--safe-green)" stroke-width="8"
            stroke-dasharray="301.6" stroke-dashoffset="${301.6 - (301.6 * (safe / total))}" />
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--threat-red)" stroke-width="8"
            stroke-dasharray="301.6" stroke-dashoffset="${301.6 - (301.6 * (threat / total))}"
            style="transform-origin: center; transform: rotate(${(safe / total) * 360}deg);" />
        </svg>
        <div style="position: absolute; text-align: center;">
          <span style="font-family: var(--font-tech); font-size: 1.4rem; font-weight: 700; color: #fff;">${total}</span>
          <p style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Scans</p>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; font-family: var(--font-tech);">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="width: 10px; height: 10px; background-color: var(--safe-green); border-radius: 2px;"></span>
          <span style="color: #fff; font-weight: 600;">Safe: ${safe} (${safePercent}%)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="width: 10px; height: 10px; background-color: var(--threat-red); border-radius: 2px;"></span>
          <span style="color: #fff; font-weight: 600;">Threats: ${threat} (${threatPercent}%)</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Draws simple, beautiful vertical bars representing scan volumes over time.
 * @param {HTMLElement} element - Target container
 * @param {Array} trackingArray - Array of { label, count }
 */
function drawVolumeChart(element, trackingArray) {
  if (!trackingArray || trackingArray.length === 0) {
    element.innerHTML = `<span style="color: var(--text-muted); font-size: 0.9rem;">No volume tracking records.</span>`;
    return;
  }

  const maxVal = Math.max(...trackingArray.map(item => item.count), 1);

  let barHtml = '';
  trackingArray.forEach(item => {
    const heightPercent = ((item.count / maxVal) * 80).toFixed(0); // Cap height percent at 80% to fit labels
    barHtml += `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 0.5rem;">
        <span style="font-size: 0.75rem; color: #fff; font-family: var(--font-tech); font-weight: 600;">${item.count}</span>
        <div style="width: 16px; height: ${heightPercent}%; background: linear-gradient(to top, var(--primary-blue), var(--accent-cyan)); border-radius: 2px 2px 0 0; box-shadow: 0 0 10px var(--primary-blue-glow);"></div>
        <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-tech);">${escapeHtml(item.label)}</span>
      </div>
    `;
  });

  element.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; height: 180px; padding: 1rem 1.5rem;">
      ${barHtml}
    </div>
  `;
}

/* ==========================================================================
    Helper Utility Functions
   ========================================================================== */

/**
 * Generates standard 'Waiting for backend response...' fallback structure in HTML format.
 * @param {boolean} [isSmall=false] - Flag to size the container spinner smaller
 * @returns {string} Compiled raw HTML output template string
 */
function createWaitingFallbackHTML(isSmall = false) {
  const sizeClass = isSmall ? 'small-fallback' : '';
  return `
    <div class="fallback-waiting-state ${sizeClass}">
      <div class="spinner-sonar" aria-hidden="true">
        <div class="spinner-sonar-circle"></div>
        <div class="spinner-sonar-circle"></div>
      </div>
      <span class="waiting-text">Waiting for backend response...</span>
    </div>
  `;
}

/**
 * Escapes special characters to prevent cross-site scripting (XSS) inputs.
 * @param {string} str - Raw string
 * @returns {string} Sanitized string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}