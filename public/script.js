// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Load businesses and populate the pipeline view
  loadBusinesses();

  // Load states for filtering
  loadStates();

  // Set up event listeners for filters
  document.getElementById('applyFilters').addEventListener('click', loadBusinesses);
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
});

// Function to load businesses based on filters
function loadBusinesses() {
  // Get filter values
  const stateFilter = document.getElementById('stateFilter').value;

  // Build query parameters
  let queryParams = [];
  if (stateFilter) {
    queryParams.push(`state=${encodeURIComponent(stateFilter)}`);
  }

  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

  // Fetch businesses from API
  fetch(`/api/businesses${queryString}`)
    .then(response => response.json())
    .then(businesses => {
      // Clear existing businesses in each stage
      document.getElementById('websiteCreatedBusinesses').innerHTML = '';
      document.getElementById('websiteSentBusinesses').innerHTML = '';
      document.getElementById('websiteViewedBusinesses').innerHTML = '';

      // Group businesses by pipeline stage
      const stages = {
        'website created': [],
        'website sent': [],
        'website viewed': []
      };

      // Put businesses in proper stage or default to 'website created'
      businesses.forEach(business => {
        const stage = business.current_stage || 'website created';
        if (stages[stage]) {
          stages[stage].push(business);
        } else {
          stages['website created'].push(business);
        }
      });

      // Populate each stage column
      renderBusinessesInStage('websiteCreatedBusinesses', stages['website created']);
      renderBusinessesInStage('websiteSentBusinesses', stages['website sent']);
      renderBusinessesInStage('websiteViewedBusinesses', stages['website viewed']);
    })
    .catch(error => {
      console.error('Error fetching businesses:', error);
    });
}

// Render businesses in a specific stage
function renderBusinessesInStage(elementId, businesses) {
  const container = document.getElementById(elementId);

  businesses.forEach(business => {
    const card = document.createElement('div');
    card.className = 'card business-card';
    card.dataset.businessId = business.id;

    // Phone type display
    let phoneType = '';
    if (business.phone_type) {
      try {
        // Try to parse the phone_type if it's a string representation of JSON
        if (typeof business.phone_type === 'string') {
          const parsedType = JSON.parse(business.phone_type);
          phoneType = parsedType || 'Unknown';
        } else {
          phoneType = business.phone_type || 'Unknown';
        }
      } catch (e) {
        phoneType = business.phone_type || 'Unknown';
      }
    }

    // Format card content
    card.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">${business.business_name}</h5>
        <p class="card-text">
          <span class="badge ${business.rating >= 4 ? 'bg-success' : business.rating >= 3 ? 'bg-warning' : 'bg-danger'}">
            ${business.rating || 'No rating'} ⭐ (${business.reviews || 0} reviews)
          </span>
        </p>
        <p><strong>Phone:</strong> ${business.phone || 'N/A'} <span class="badge bg-info">${phoneType}</span></p>
        <p><strong>Location:</strong> ${business.city || ''}, ${business.state || ''}</p>
        <button class="btn btn-sm btn-primary view-details" data-id="${business.id}">View Details</button>
      </div>
    `;

    container.appendChild(card);

    // Add event listener to view details button
    card.querySelector('.view-details').addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent card click event
      const businessId = this.getAttribute('data-id');
      showBusinessDetails(businessId);
    });
  });
}

// Load and display business details
function showBusinessDetails(businessId) {
  // Create modal if it doesn't exist
  if (!document.getElementById('businessDetailsModal')) {
    const modalHTML = `
      <div class="modal fade" id="businessDetailsModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Business Details</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="businessDetailsContent">
              <div class="row">
                <div class="col-md-8" id="businessInfo">
                  <!-- Business details will be loaded here -->
                </div>
                <div class="col-md-4">
                  <div class="mb-3">
                    <label class="form-label">Move to Stage:</label>
                    <select id="stagePicker" class="form-select">
                      <option value="website created">Website Created</option>
                      <option value="website sent">Website Sent</option>
                      <option value="website viewed">Website Viewed</option>
                    </select>
                  </div>
                  <button id="updateStageBtn" class="btn btn-primary">Update Stage</button>

                  <div class="mt-3">
                    <label class="form-label">Notes:</label>
                    <textarea id="businessNotes" class="form-control" rows="4"></textarea>
                  </div>
                </div>
              </div>

              <div class="mt-4">
                <h6>Pipeline History</h6>
                <div id="pipelineHistory">
                  <!-- Pipeline history will be loaded here -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Fetch business details
  fetch(`/api/businesses/${businessId}`)
    .then(response => response.json())
    .then(business => {
      // Format business details
      let phoneType = '';
      if (business.scraped_data && business.scraped_data.phone_type) {
        phoneType = business.scraped_data.phone_type;
      }

      const infoHTML = `
        <h4>${business.business_name}</h4>
        <p><span class="badge ${business.rating >= 4 ? 'bg-success' : business.rating >= 3 ? 'bg-warning' : 'bg-danger'}">
          ${business.rating || 'No rating'} ⭐ (${business.reviews || 0} reviews)
        </span></p>

        <div class="row mb-2">
          <div class="col-md-4 info-label">Phone:</div>
          <div class="col-md-8">${business.phone || 'N/A'} <span class="badge bg-info">${phoneType}</span></div>
        </div>

        <div class="row mb-2">
          <div class="col-md-4 info-label">Email:</div>
          <div class="col-md-8">${business.email || 'N/A'}</div>
        </div>

        <div class="row mb-2">
          <div class="col-md-4 info-label">Address:</div>
          <div class="col-md-8">${business.full_address || 'N/A'}</div>
        </div>

        <div class="row mb-2">
          <div class="col-md-4 info-label">Website:</div>
          <div class="col-md-8">${business.scraped_data?.website || 'N/A'}</div>
        </div>

        <div class="row mb-2">
          <div class="col-md-4 info-label">Description:</div>
          <div class="col-md-8">${business.description || 'N/A'}</div>
        </div>
      `;

      document.getElementById('businessInfo').innerHTML = infoHTML;

      // Load pipeline history
      fetch(`/api/pipeline/${businessId}`)
        .then(response => response.json())
        .then(pipelineEntries => {
          const historyHTML = pipelineEntries.length > 0 
            ? `<ul class="list-group">
                ${pipelineEntries.map(entry => `
                  <li class="list-group-item">
                    <div class="d-flex justify-content-between">
                      <span class="badge bg-primary">${entry.stage}</span>
                      <small>${new Date(entry.stage_date).toLocaleString()}</small>
                    </div>
                    ${entry.notes ? `<p class="mb-0 mt-2">${entry.notes}</p>` : ''}
                  </li>
                `).join('')}
              </ul>`
            : '<p>No pipeline history yet.</p>';

          document.getElementById('pipelineHistory').innerHTML = historyHTML;
        });

      // Handle stage update
      document.getElementById('updateStageBtn').onclick = function() {
        const stage = document.getElementById('stagePicker').value;
        const notes = document.getElementById('businessNotes').value;

        fetch(`/api/pipeline/${businessId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ stage, notes })
        })
        .then(response => response.json())
        .then(() => {
          // Reload businesses and close modal
          loadBusinesses();

          // Using Bootstrap 5 modal API
          const modal = bootstrap.Modal.getInstance(document.getElementById('businessDetailsModal'));
          modal.hide();
        })
        .catch(error => {
          console.error('Error updating stage:', error);
          alert('Failed to update stage. Please try again.');
        });
      };

      // Show modal using Bootstrap 5 modal API
      const modal = new bootstrap.Modal(document.getElementById('businessDetailsModal'));
      modal.show();
    })
    .catch(error => {
      console.error('Error fetching business details:', error);
      alert('Failed to load business details. Please try again.');
    });
}

// Load states for filtering
function loadStates() {
  fetch('/api/states')
    .then(response => response.json())
    .then(states => {
      const stateFilter = document.getElementById('stateFilter');

      // Clear existing options except the first one (All States)
      while (stateFilter.options.length > 1) {
        stateFilter.remove(1);
      }

      // Add state options
      states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateFilter.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error loading states:', error);
    });
}

// Clear filters
function clearFilters() {
  document.getElementById('stateFilter').value = '';
  loadBusinesses();
}