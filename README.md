# Business Database Application

This application manages a database of electrician businesses, including their contact information, reviews, and website pipeline statuses.

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Set up your PostgreSQL database and update the `.env` file with your connection string:
   ```
   DATABASE_URL=postgres://username:password@localhost:5432/businessdb
   ```

3. Create database tables:
   ```
   npm run setup
   ```

4. Import data from CSV:
   ```
   npm run import
   ```

5. Start the application:
   ```
   npm start
   ```

6. Open your browser and visit `http://localhost:3000` to view the application.

## Website Template System

The application includes a template system for generating business websites:

1. Templates are stored in the `/templates` directory
2. Each business type has its own template (e.g., `electrician.html`, `plumber.html`)
3. Templates use placeholders like `{{businessName}}` that are replaced with actual data
4. Businesses are accessible at `/:businessType/:businessKey` (e.g., `/electricians/businessname`)

## Pipeline Tracking System

The website creation pipeline is tracked through different stages:

1. `website created` - Initial website generated
2. `website sent` - Website URL sent to business
3. `website viewed` - Business has viewed their website
4. `contact_made` - Someone contacted the business through the website

## Analytics Tracking

The application includes comprehensive analytics tracking:

1. Page views and duration are automatically recorded
2. Contact attempts (phone calls, emails, form submissions) are tracked
3. Pipeline stages automatically update based on user interactions
4. Analytics data is available through the API

## API Endpoints

### Business Data
- `GET /api/businesses` - Get all businesses (with optional filtering)
- `GET /api/businesses/:id` - Get a specific business by ID
- `GET /api/states` - Get available states for filtering

### Pipeline Management
- `GET /api/pipeline/:businessId` - Get pipeline entries for a business
- `POST /api/pipeline/:businessId` - Update pipeline stage for a business
- `POST /api/website-view/:businessId` - Record a website view

### Analytics
- `POST /api/analytics-event` - Record an analytics event (used by templates)
- `GET /api/analytics/:businessId` - Get analytics data for a business

### Business Websites
- `GET /:businessType/:businessKey` - Access the business website

## Database Schema

### Businesses Table
Stores core data about each business:
- ID, name, type, website key
- Contact info (phone, email)
- Location data (address, city, state, latitude/longitude)
- Rating and reviews
- Working hours and social links as JSONB
- Additional data as JSONB

### Website Pipeline Table
Tracks the status of website creation for each business:
- Business ID, template ID
- Stage, date, and notes

### Analytics Events Table
Records user interactions with business websites:
- Business ID, page path, event type
- Duration, visitor info, timestamp

### Analytics Summary Table
Stores daily aggregated analytics for each business website:
- Business ID, date
- Total views, unique visitors, average time, bounce rate