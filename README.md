
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

## API Endpoints

- `GET /api/businesses` - Get all businesses
- `GET /api/businesses/:id` - Get a specific business by ID
- `GET /api/pipeline/:businessId` - Get pipeline entries for a business

## Database Schema

### Businesses Table
Stores core data about each electrician business.

### Website Pipeline Table
Tracks the status of website creation for each business.

### Analytics Events Table
Records user interactions with business websites.

### Analytics Summary Table
Stores daily aggregated analytics for each business website.
