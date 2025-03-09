
document.addEventListener('DOMContentLoaded', function() {
  // Fetch and display all businesses
  fetchBusinesses();
  
  // Set up the tab functionality
  const detailsTab = document.getElementById('details-tab');
  detailsTab.addEventListener('click', function() {
    if (!currentBusinessId) {
      document.getElementById('detailsContainer').style.display = 'none';
      document.getElementById('noBusinessSelected').style.display = 'block';
    } else {
      document.getElementById('detailsContainer').style.display = 'block';
      document.getElementById('noBusinessSelected').style.display = 'none';
    }
  });
});

let currentBusinessId = null;

async function fetchBusinesses() {
  try {
    const response = await fetch('/api/businesses');
    const businesses = await response.json();
    
    const businessList = document.getElementById('businessList');
    businessList.innerHTML = '';
    
    if (businesses.length === 0) {
      businessList.innerHTML = '<div class="col-12"><p>No businesses found</p></div>';
      return;
    }
    
    businesses.forEach(business => {
      const businessCard = document.createElement('div');
      businessCard.className = 'col-md-4 mb-4';
      businessCard.innerHTML = `
        <div class="card business-card h-100" data-id="${business.id}">
          <div class="card-body">
            <h5 class="card-title">${business.business_name}</h5>
            <p class="card-text">${business.city || ''}, ${business.state || ''}</p>
            <p class="card-text">
              <small class="text-muted">
                Rating: ${business.rating || 'N/A'} (${business.reviews || 0} reviews)
              </small>
            </p>
          </div>
        </div>
      `;
      
      businessCard.querySelector('.business-card').addEventListener('click', () => {
        selectBusiness(business.id);
      });
      
      businessList.appendChild(businessCard);
    });
    
  } catch (error) {
    console.error('Error fetching businesses:', error);
    document.getElementById('businessList').innerHTML = 
      '<div class="col-12"><p>Error loading businesses</p></div>';
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
      const statusList = document.createElement('ul');
      statusList.className = 'list-group list-group-flush';
      
      pipeline.forEach(entry => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        const date = new Date(entry.stage_date).toLocaleDateString();
        listItem.textContent = `${entry.stage} (${date}) - ${entry.template_id}`;
        
        if (entry.notes) {
          const notesEl = document.createElement('small');
          notesEl.className = 'd-block text-muted';
          notesEl.textContent = entry.notes;
          listItem.appendChild(notesEl);
        }
        
        statusList.appendChild(listItem);
      });
      
      pipelineContainer.appendChild(statusList);
    } else {
      pipelineContainer.textContent = 'No pipeline entries yet';
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
    document.getElementById('detailsContainer').style.display = 'block';
    document.getElementById('noBusinessSelected').style.display = 'none';
    
    // Switch to details tab
    const detailsTab = document.getElementById('details-tab');
    const tabInstance = new bootstrap.Tab(detailsTab);
    tabInstance.show();
    
  } catch (error) {
    console.error('Error fetching business details:', error);
  }
}
