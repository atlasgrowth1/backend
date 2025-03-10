document.addEventListener('DOMContentLoaded', async function() {
  loadStates();
  await loadBusinessTypeOptions();
  loadBusinesses();

  // Set up event listeners for filters
  document.getElementById('applyFilters').addEventListener('click', () => {
    loadBusinesses();
  });

  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('stateFilter').value = '';
    document.getElementById('typeFilter').value = '';
    loadBusinesses();
  });

  // Set up event listener for updating pipeline
  const updatePipelineBtn = document.getElementById('updatePipelineBtn');
  if (updatePipelineBtn) {
    updatePipelineBtn.addEventListener('click', updatePipelineStage);
  }
});

// Global variables to store current data
let currentBusinessId = null;
let allBusinesses = [];

async function loadStates() {
  try {
    const response = await fetch('/api/states');
    const states = await response.json();

    const stateFilter = document.getElementById('stateFilter');

    states.forEach(state => {
      const option = document.createElement('option');
      option.value = state;
      option.textContent = state;
      stateFilter.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading states:', error);
  }
}

async function loadBusinessTypeOptions() {
  try {
    const response = await fetch('/api/businessTypes');
    const businessTypes = await response.json();

    const typeFilter = document.getElementById('typeFilter');
    businessTypes.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      typeFilter.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading business types:', error);
  }
}

async function loadBusinesses() {
  try {
    // Get filter values
    const stateFilter = document.getElementById('stateFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;

    let url = '/api/businesses';

    // Add filters if selected
    const params = [];
    if (stateFilter) {
      params.push(`state=${encodeURIComponent(stateFilter)}`);
    }
    if (typeFilter) {
      params.push(`type=${encodeURIComponent(typeFilter)}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    console.log('Fetching businesses from:', url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch businesses: ${response.status}`);
    }

    const businesses = await response.json();
    console.log('Loaded businesses:', businesses.length);

    // Store all businesses for reference
    allBusinesses = businesses;

    // Group businesses by pipeline stage
    const stages = {
      'website created': businesses.filter(b => !b.current_stage || b.current_stage === 'website created'),
      'website sent': businesses.filter(b => b.current_stage === 'website sent'),
      'website viewed': businesses.filter(b => b.current_stage === 'website viewed'),
      'contact_made': businesses.filter(b => b.current_stage === 'contact_made')
    };

    // Populate each stage column
    populateStageColumn('websiteCreatedBusinesses', stages['website created']);
    populateStageColumn('websiteSentBusinesses', stages['website sent']);
    populateStageColumn('websiteViewedBusinesses', stages['website viewed']);
  } catch (error) {
    console.error('Error loading businesses:', error);
  }
}

function populateStageColumn(containerId, businesses) {
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Container #${containerId} not found`);
    return;
  }

  console.log(`Populating ${containerId} with ${businesses ? businesses.length : 0} businesses`);

  // Clear existing content
  container.innerHTML = '';

  if (!businesses || businesses.length === 0) {
    container.innerHTML = '<p class="text-muted">No businesses in this stage</p>';
    return;
  }

  businesses.forEach(business => {
    const card = document.createElement('div');
    card.className = 'card business-card mb-2';
    card.setAttribute('data-business-id', business.id);
    card.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">${business.business_name || 'Unnamed Business'}</h5>
        <p class="card-text">
          <small>${business.city || ''}, ${business.state || ''}</small><br>
          <small>Phone: ${business.phone || 'N/A'}</small><br>
          <small>Rating: ${business.rating || 'N/A'} (${business.reviews || '0'} reviews)</small>
        </p>
        <button class="btn btn-sm btn-primary view-details-btn" data-id="${business.id}">View Details</button>
      </div>
    `;

    container.appendChild(card);
  });

  // Add event listeners for the View Details buttons
  container.querySelectorAll('.view-details-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent event bubbling
      const businessId = this.getAttribute('data-id');
      console.log('View Details button clicked, business ID:', businessId);
      selectBusiness(businessId);
    });
  });
}

async function selectBusiness(businessId) {
  try {
    // Store the current business ID
    currentBusinessId = businessId;

    // Fetch business details
    const response = await fetch(`/api/businesses/${businessId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch business details: ${response.status}`);
    }

    const business = await response.json();
    console.log('Loaded business details:', business);

    // Get modal element
    const modalElement = document.getElementById('businessDetailModal');
    if (!modalElement) {
      console.error('Modal element not found');
      return;
    }

    // Initialize modal
    const businessModal = new bootstrap.Modal(modalElement);

    // Populate modal with business data
    document.getElementById('modalBusinessName').textContent = business.business_name || 'Unnamed Business';
    document.getElementById('modalBusinessPhone').textContent = business.phone || 'N/A';
    document.getElementById('modalBusinessEmail').textContent = business.email || 'N/A';
    document.getElementById('modalBusinessAddress').textContent = 
      `${business.city || ''}, ${business.state || ''}`;

    // Set up website URL and website key
    const businessType = business.business_type || 'electrician';
    const websiteKey = business.website_key || '';

    // Update website key field
    const websiteKeyElement = document.getElementById('modalBusinessWebsiteKey');
    if (websiteKeyElement) {
      websiteKeyElement.textContent = websiteKey;
    }

    // Set up the website link
    const websiteLink = document.getElementById('businessWebsiteLink');
    if (websiteLink && websiteKey) {
      const url = `/${businessType}s/${websiteKey}`;
      websiteLink.href = url;
      websiteLink.textContent = `http://localhost:3000${url}`;
    } else if (websiteLink) {
      websiteLink.textContent = 'No website available';
      websiteLink.href = '#';
    }

    // Find the matching business in our global array to get current stage
    const businessFromList = allBusinesses.find(b => b.id == businessId);
    if (businessFromList) {
      document.getElementById('modalPipelineStage').textContent = businessFromList.current_stage || 'website created';
    }

    // Fetch and display activity data
    loadBusinessActivity(businessId);

    // Show the modal
    businessModal.show();
  } catch (error) {
    console.error('Error showing business details:', error);
    alert('Error loading business details. Please try again.');
  }
}

async function loadBusinessActivity(businessId) {
  try {
    // Reset activity display
    document.getElementById('totalViews').textContent = '-';
    document.getElementById('uniqueVisitors').textContent = '-';
    document.getElementById('avgTimeOnSite').textContent = '-';
    document.getElementById('lastViewed').textContent = '-';
    document.getElementById('activityCount').textContent = 'Loading...';
    document.getElementById('sessionHistoryTable').innerHTML = '<tr><td colspan="5" class="text-center">Loading session data...</td></tr>';

    // Fetch analytics data
    const response = await fetch(`/api/analytics/${businessId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch analytics data: ${response.status}`);
    }

    const analyticsData = await response.json();
    console.log('Loaded analytics data:', analyticsData);

    // Calculate totals from daily data
    let totalViews = 0;
    let totalUniqueVisitors = 0;
    let totalTimeSum = 0;
    let totalTimeSessions = 0;

    if (analyticsData.daily && analyticsData.daily.length > 0) {
      analyticsData.daily.forEach(day => {
        totalViews += parseInt(day.total_views) || 0;
        totalUniqueVisitors += parseInt(day.unique_visitors) || 0;
        if (day.avg_time_on_site > 0) {
          totalTimeSum += (parseInt(day.avg_time_on_site) * parseInt(day.total_views));
          totalTimeSessions += parseInt(day.total_views);
        }
      });
    }

    // Process view sessions
    const viewSessions = analyticsData.viewSessions || [];

    // Update summary stats
    document.getElementById('totalViews').textContent = totalViews || viewSessions.length;
    document.getElementById('uniqueVisitors').textContent = totalUniqueVisitors || countUniqueSessionIds(viewSessions);

    const avgTime = totalTimeSessions > 0 ? Math.round(totalTimeSum / totalTimeSessions) : '-';
    document.getElementById('avgTimeOnSite').textContent = avgTime;

    // Get last viewed date
    if (viewSessions.length > 0) {
      const lastSession = viewSessions[0]; // Sessions are ordered by date DESC
      const date = new Date(lastSession.date);
      document.getElementById('lastViewed').textContent = formatDate(date);
    }

    // Update activity count
    document.getElementById('activityCount').textContent = viewSessions.length;

    // Populate session history table
    populateSessionHistory(viewSessions);

  } catch (error) {
    console.error('Error loading activity data:', error);
    document.getElementById('activityCount').textContent = 'Error';
    document.getElementById('sessionHistoryTable').innerHTML = 
      '<tr><td colspan="5" class="text-center text-danger">Error loading session data</td></tr>';
  }
}

function countUniqueSessionIds(sessions) {
  const uniqueIds = new Set();

  sessions.forEach(session => {
    if (session.sessionId) {
      uniqueIds.add(session.sessionId);
    }
  });

  return uniqueIds.size;
}

function formatDate(date) {
  // For displaying "2 days ago", "today", etc.
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function populateSessionHistory(sessions) {
  const tableBody = document.getElementById('sessionHistoryTable');
  tableBody.innerHTML = '';

  if (!sessions || sessions.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No session data available</td></tr>';
    return;
  }

  sessions.forEach(session => {
    try {
      const row = document.createElement('tr');

      // Date/Time
      const dateCell = document.createElement('td');
      dateCell.textContent = formatDateTime(session.date);
      row.appendChild(dateCell);

      // Duration
      const durationCell = document.createElement('td');
      // Try to extract duration from session data
      let duration = '-';
      try {
        if (session.notes && typeof session.notes === 'string' && session.notes.startsWith('{')) {
          const sessionData = JSON.parse(session.notes);
          const startTime = sessionData.startTime;
          const timestamp = sessionData.timestamp;

          if (startTime && timestamp) {
            const start = new Date(parseInt(startTime));
            const end = new Date(timestamp);
            const durationSec = Math.round((end - start) / 1000);
            if (durationSec > 0 && durationSec < 3600) { // Sanity check (less than 1 hour)
              duration = `${durationSec} sec`;
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse session duration:', e);
      }

      durationCell.textContent = duration;
      row.appendChild(durationCell);

      // Pages viewed
      const pagesCell = document.createElement('td');
      pagesCell.textContent = '1'; // Default to 1 page
      row.appendChild(pagesCell);

      // Actions
      const actionsCell = document.createElement('td');
      actionsCell.textContent = 'Page view';
      row.appendChild(actionsCell);

      // Source/Referrer
      const sourceCell = document.createElement('td');
      try {
        if (session.notes && typeof session.notes === 'string' && session.notes.startsWith('{')) {
          const sessionData = JSON.parse(session.notes);
          sourceCell.textContent = sessionData.referrer || 'Direct';
        } else {
          sourceCell.textContent = 'Direct';
        }
      } catch (e) {
        sourceCell.textContent = 'Direct';
      }
      row.appendChild(sourceCell);

      tableBody.appendChild(row);
    } catch (e) {
      console.error('Error creating session row:', e);
    }
  });
}

async function updatePipelineStage() {
  if (!currentBusinessId) {
    alert('No business selected');
    return;
  }

  const stageSelect = document.getElementById('pipelineStageSelect');
  if (!stageSelect) {
    console.error('Pipeline stage select element not found');
    return;
  }

  const stage = stageSelect.value;
  const notesElement = document.getElementById('pipelineNotes');
  const notes = notesElement ? notesElement.value : '';

  if (!stage) {
    alert('Please select a pipeline stage');
    return;
  }

  try {
    const response = await fetch(`/api/pipeline/${currentBusinessId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stage, notes })
    });

    if (response.ok) {
      // Show success message
      alert(`Successfully moved business to "${stage}" stage`);

      // Refresh the business pipelines
      loadBusinesses();

      // Close the modal
      const modalElement = document.getElementById('businessDetailModal');
      const businessModal = bootstrap.Modal.getInstance(modalElement);
      if (businessModal) {
        businessModal.hide();
      }
    } else {
      const errorData = await response.json();
      console.error('Error updating pipeline stage:', errorData.error || response.statusText);
      alert('Failed to update pipeline stage. See console for details.');
    }
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    alert('Failed to update pipeline stage. See console for details.');
  }
}