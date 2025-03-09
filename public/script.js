document.addEventListener('DOMContentLoaded', function() {
  loadStates();
  loadBusinesses();

  // Initially hide the business details
  document.getElementById('businessDetails').style.display = 'none';
  document.getElementById('noBusinessSelected').style.display = 'block';

  // Set up event listeners for filters
  document.getElementById('applyFilters').addEventListener('click', () => {
    loadBusinesses();
  });

  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('stateFilter').value = '';
    document.getElementById('stageFilter').value = '';
    loadBusinesses();
  });

  // Add automatic website view recording
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && currentBusinessId) {
      recordWebsiteView();
    }
  });
});

let currentBusinessId = null;

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

async function loadBusinesses() {
  try {
    // Get filter values
    const state = document.getElementById('stateFilter').value;
    const stage = document.getElementById('stageFilter').value;

    // Build query string
    let url = '/api/businesses';
    const params = [];

    if (state) params.push(`state=${encodeURIComponent(state)}`);
    if (stage) params.push(`stage=${encodeURIComponent(stage)}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    const response = await fetch(url);
    const businesses = await response.json();

    const businessTable = document.getElementById('businessTable');
    businessTable.innerHTML = '';

    businesses.forEach(business => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${business.business_name}</td>
        <td>${business.city || ''}, ${business.state || ''}</td>
        <td>${business.rating || 'N/A'} (${business.reviews || '0'} reviews)</td>
        <td>${business.current_stage || 'Not started'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="selectBusiness(${business.id})">View Details</button>
        </td>
      `;
      businessTable.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading businesses:', error);
  }
}

async function selectBusiness(id) {
  currentBusinessId = id;

  try {
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

    // Show the details tab
    document.getElementById('businessDetails').style.display = 'block';
    document.getElementById('noBusinessSelected').style.display = 'none';

    // Switch to details tab (assuming Bootstrap is used)
    const detailsTab = document.getElementById('details-tab');
    if (detailsTab) { // Check if detailsTab exists
      const tabInstance = new bootstrap.Tab(detailsTab);
      tabInstance.show();
    }
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
      loadBusinesses(); // Refresh the business list
      selectBusiness(currentBusinessId); // Refresh the business details
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
    const response = await fetch(`/api/pipeline/${currentBusinessId}/view`, {
      method: 'POST'
    });
    if (!response.ok) {
      console.error('Error recording website view:', response.statusText);
    }
  } catch (error) {
    console.error('Error recording website view:', error);
  }
}