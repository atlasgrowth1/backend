
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
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">${business.business_name || 'Unnamed Business'}</h5>
        <p class="card-text">
          <small>${business.city || ''}, ${business.state || ''}</small><br>
          <small>Phone: ${business.phone || 'N/A'}</small><br>
          <small>Rating: ${business.rating || 'N/A'} (${business.reviews || '0'} reviews)</small>
        </p>
      </div>
    `;
    
    // Add click event directly to the card when creating it
    card.addEventListener('click', function() {
      console.log('Card clicked, business ID:', business.id);
      selectBusiness(business.id);
    });
    
    container.appendChild(card);
  });
}

async function selectBusiness(id) {
  currentBusinessId = id;

  try {
    console.log('Selected business ID:', id);
    
    // Make sure modal element exists
    const modalElement = document.getElementById('businessModal');
    if (!modalElement) {
      console.error('Business modal element not found');
      return;
    }

    // Initialize modal if not already done
    if (typeof bootstrap !== 'undefined') {
      businessModal = businessModal || new bootstrap.Modal(modalElement);
    } else {
      console.error('Bootstrap not loaded');
      return;
    }

    // Fetch business details
    const businessResponse = await fetch(`/api/businesses/${id}`);
    if (!businessResponse.ok) {
      throw new Error(`Failed to fetch business: ${businessResponse.status}`);
    }
    const business = await businessResponse.json();
    console.log('Business data:', business);

    // Fetch pipeline data
    const pipelineResponse = await fetch(`/api/pipeline/${id}`);
    if (!pipelineResponse.ok) {
      throw new Error(`Failed to fetch pipeline: ${pipelineResponse.status}`);
    }
    const pipeline = await pipelineResponse.json();
    console.log('Pipeline data:', pipeline);
    
    // Ensure all DOM elements exist before trying to update them
    const elements = {
      businessName: document.getElementById('businessName'),
      businessPhone: document.getElementById('businessPhone'),
      businessEmail: document.getElementById('businessEmail'),
      businessAddress: document.getElementById('businessAddress'),
      businessRating: document.getElementById('businessRating'),
      businessReviews: document.getElementById('businessReviews'),
      businessPhoneType: document.getElementById('businessPhoneType')
    };
    
    // Check if all elements exist
    let missingElements = [];
    for (const [key, element] of Object.entries(elements)) {
      if (!element) {
        missingElements.push(key);
      }
    }
    
    if (missingElements.length > 0) {
      console.error(`Missing elements: ${missingElements.join(', ')}`);
      alert('Error displaying business details. See console for more information.');
      return;
    }

    // Update the UI with business details
    elements.businessName.textContent = business.business_name;
    elements.businessPhone.textContent = business.phone || 'Not available';
    elements.businessEmail.textContent = business.email || 'Not available';
    elements.businessAddress.textContent = business.full_address ||
      `${business.street || ''} ${business.city || ''}, ${business.state || ''} ${business.postal_code || ''}`;
    elements.businessRating.textContent = business.rating || 'N/A';
    elements.businessReviews.textContent = business.reviews || '0';
    
    // Handle phone type if it exists (from scraped_data)
    const phoneTypeElement = elements.businessPhoneType;
    if (phoneTypeElement) {
      try {
        const phoneType = business.phone_type ? JSON.parse(business.phone_type) : null;
        phoneTypeElement.textContent = phoneType || 'Not specified';
      } catch (e) {
        phoneTypeElement.textContent = business.phone_type || 'Not specified';
      }
    }

    // Display business hours
    const hoursContainer = document.getElementById('businessHours');
    hoursContainer.innerHTML = '';

    if (business.working_hours && Object.keys(JSON.parse(business.working_hours)).length > 0) {
      const hours = JSON.parse(business.working_hours);
      const daysList = document.createElement('ul');
      daysList.className = 'list-group list-group-flush';

      for (const [day, time] of Object.entries(hours)) {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.textContent = `${day}: ${time}`;
        daysList.appendChild(listItem);
      }

      hoursContainer.appendChild(daysList);
    } else {
      hoursContainer.textContent = 'Hours not available';
    }

    // Display pipeline status
    const pipelineContainer = document.getElementById('pipelineStatus');
    pipelineContainer.innerHTML = '';

    if (pipeline.length > 0) {
      const latestStage = pipeline[0].stage;
      const stageDate = new Date(pipeline[0].stage_date).toLocaleDateString();

      pipelineContainer.innerHTML = `
        <p><strong>Current Stage:</strong> ${latestStage}</p>
        <p><strong>Last Updated:</strong> ${stageDate}</p>
        <div class="mt-3">
          <select id="pipelineStageSelect" class="form-select">
            <option value="">-- Select Next Stage --</option>
            <option value="website created" ${latestStage === 'website created' ? 'selected' : ''}>Website Created</option>
            <option value="website sent" ${latestStage === 'website sent' ? 'selected' : ''}>Website Sent</option>
            <option value="website viewed" ${latestStage === 'website viewed' ? 'selected' : ''}>Website Viewed</option>
          </select>
          <textarea id="pipelineNotes" class="form-control mt-2" placeholder="Notes (optional)"></textarea>
          <button id="updatePipelineBtn" class="btn btn-primary mt-2">Move to Selected Stage</button>
        </div>
        <div class="mt-3">
          <h6>Pipeline History</h6>
          <ul class="list-group">
            ${pipeline.map(entry => `
              <li class="list-group-item">
                <small>${new Date(entry.stage_date).toLocaleString()}</small>
                <strong>${entry.stage}</strong>
                ${entry.notes ? `<p class="mb-0 text-muted">${entry.notes}</p>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    } else {
      pipelineContainer.textContent = 'No pipeline data available';
    }

    // Display social links
    const socialContainer = document.getElementById('socialLinks');
    socialContainer.innerHTML = '';

    if (business.social_links && Object.keys(JSON.parse(business.social_links)).length > 0) {
      const socialLinks = JSON.parse(business.social_links);
      const linksList = document.createElement('div');
      linksList.className = 'd-flex flex-wrap gap-2';

      for (const [platform, url] of Object.entries(socialLinks)) {
        if (url) {
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.className = 'btn btn-sm btn-outline-primary';
          link.textContent = platform.charAt(0).toUpperCase() + platform.slice(1);
          linksList.appendChild(link);
        }
      }

      socialContainer.appendChild(linksList);
    } else {
      socialContainer.textContent = 'No social links available';
    }

    // Show the modal
    businessModal.show();
    
    // Add event listener for pipeline stage update button
    const updatePipelineBtn = document.getElementById('updatePipelineBtn');
    if (updatePipelineBtn) {
      updatePipelineBtn.addEventListener('click', function() {
        updatePipelineStage();
      });
    }

    // Set up view recording
    recordWebsiteView();
  } catch (error) {
    console.error('Error fetching business details:', error);
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
