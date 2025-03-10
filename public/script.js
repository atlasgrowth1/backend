document.addEventListener('DOMContentLoaded', function() {
  loadStates();
  loadBusinessesByPipeline();

  // Set up event listeners for filters
  document.getElementById('applyFilters').addEventListener('click', () => {
    loadBusinessesByPipeline();
  });

  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('stateFilter').value = '';
    loadBusinessesByPipeline();
  });
});

let currentBusinessId = null;
let businessModal = null;

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

async function loadBusinessesByPipeline() {
  try {
    // Get filter values
    const stateFilter = document.getElementById('stateFilter');
    const state = stateFilter ? stateFilter.value : '';

    // Build query string
    let url = '/api/businesses';
    const params = [];

    if (state) params.push(`state=${encodeURIComponent(state)}`);

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

    // Group businesses by pipeline stage
    const stages = {
      'website created': businesses.filter(b => !b.current_stage || b.current_stage === 'website created'),
      'website sent': businesses.filter(b => b.current_stage === 'website sent'),
      'website viewed': businesses.filter(b => b.current_stage === 'website viewed')
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
  // Find the business by ID
  const business = allBusinesses.find(b => b.id == businessId); // Use == for type coercion
  if (!business) {
    console.error('Business not found:', businessId);
    return;
  }

  // Get modal element
  const modalElement = document.getElementById('businessDetailModal');
  if (!modalElement) {
    console.error('Modal element not found');
    return;
  }

  // Initialize modal
  try {
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const businessModal = new bootstrap.Modal(modalElement);

      // Populate modal with business data
      document.getElementById('modalBusinessName').textContent = business.business_name || 'Unnamed Business';
      document.getElementById('modalBusinessPhone').textContent = business.phone || 'N/A';
      document.getElementById('modalBusinessEmail').textContent = business.email || 'N/A';
      document.getElementById('modalBusinessAddress').textContent = 
        `${business.city || ''}, ${business.state || ''}`;

      // Show the modal
      businessModal.show();
    } else {
      console.error('Bootstrap Modal not available');
      alert('Error: Could not display business details. Please try again.');
    }
  } catch (error) {
    console.error('Error showing modal:', error);
  }
}

async function updatePipelineStage() {
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
      loadBusinessesByPipeline();

      // Close the modal
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

async function recordWebsiteView() {
  if (!currentBusinessId) return;

  try {
    const response = await fetch(`/api/website-view/${currentBusinessId}`, {
      method: 'POST'
    });
    if (!response.ok) {
      console.error('Error recording website view:', response.statusText);
    }
  } catch (error) {
    console.error('Error recording website view:', error);
  }
}