
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
    const state = document.getElementById('stateFilter').value;
    
    // Build query string
    let url = '/api/businesses';
    const params = [];

    if (state) params.push(`state=${encodeURIComponent(state)}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    const response = await fetch(url);
    const businesses = await response.json();

    // Clear all business containers
    document.getElementById('websiteCreatedBusinesses').innerHTML = '';
    document.getElementById('websiteSentBusinesses').innerHTML = '';
    document.getElementById('websiteViewedBusinesses').innerHTML = '';

    // Group businesses by pipeline stage
    const createdBusinesses = businesses.filter(b => !b.current_stage || b.current_stage === 'website created');
    const sentBusinesses = businesses.filter(b => b.current_stage === 'website sent');
    const viewedBusinesses = businesses.filter(b => b.current_stage === 'website viewed');

    // Populate each stage column
    populateStageColumn('websiteCreatedBusinesses', createdBusinesses);
    populateStageColumn('websiteSentBusinesses', sentBusinesses);
    populateStageColumn('websiteViewedBusinesses', viewedBusinesses);
  } catch (error) {
    console.error('Error loading businesses:', error);
  }
}

function populateStageColumn(containerId, businesses) {
  const container = document.getElementById(containerId);
  
  if (businesses.length === 0) {
    container.innerHTML = '<p class="text-muted">No businesses in this stage</p>';
    return;
  }

  businesses.forEach(business => {
    const card = document.createElement('div');
    card.className = 'card business-card';
    card.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">${business.business_name}</h5>
        <p class="card-text">
          <small>${business.city || ''}, ${business.state || ''}</small><br>
          <small>Phone: ${business.phone || 'N/A'}</small><br>
          <small>Rating: ${business.rating || 'N/A'} (${business.reviews || '0'} reviews)</small>
        </p>
        <button class="btn btn-sm btn-primary" onclick="selectBusiness(${business.id})">View Details</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function selectBusiness(id) {
  currentBusinessId = id;

  try {
    // Initialize modal if not already done
    if (!businessModal) {
      businessModal = new bootstrap.Modal(document.getElementById('businessModal'));
    }

    // Fetch business details
    const businessResponse = await fetch(`/api/businesses/${id}`);
    const business = await businessResponse.json();

    // Fetch pipeline data
    const pipelineResponse = await fetch(`/api/pipeline/${id}`);
    const pipeline = await pipelineResponse.json();

    // Update the UI with business details
    document.getElementById('businessName').textContent = business.business_name;
    document.getElementById('businessPhone').textContent = business.phone || 'Not available';
    document.getElementById('businessEmail').textContent = business.email || 'Not available';
    document.getElementById('businessAddress').textContent = business.full_address ||
      `${business.street || ''} ${business.city || ''}, ${business.state || ''} ${business.postal_code || ''}`;
    document.getElementById('businessRating').textContent = business.rating || 'N/A';
    document.getElementById('businessReviews').textContent = business.reviews || '0';

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
            <option value="website sent" ${latestStage === 'website sent' ? 'disabled' : ''}>Website Sent</option>
            <option value="website viewed" ${latestStage === 'website viewed' ? 'disabled' : ''}>Website Viewed</option>
          </select>
          <textarea id="pipelineNotes" class="form-control mt-2" placeholder="Notes (optional)"></textarea>
          <button onclick="updatePipelineStage()" class="btn btn-primary mt-2">Update Stage</button>
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

    // Set up view recording
    recordWebsiteView();
  } catch (error) {
    console.error('Error fetching business details:', error);
  }
}

async function updatePipelineStage() {
  const stage = document.getElementById('pipelineStageSelect').value;
  const notes = document.getElementById('pipelineNotes').value;

  if (!stage) return;

  try {
    const response = await fetch(`/api/pipeline/${currentBusinessId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stage, notes })
    });

    if (response.ok) {
      // Refresh the business pipelines
      loadBusinessesByPipeline();
      
      // Close the modal
      if (businessModal) {
        businessModal.hide();
      }
    } else {
      console.error('Error updating pipeline stage:', response.statusText);
    }
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
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
