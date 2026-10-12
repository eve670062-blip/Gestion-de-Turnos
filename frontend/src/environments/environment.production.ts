// The backend URL can be provided as ?api=https://your-backend.example/api
// until the production API URL is set here.
export const environment = {
  apiUrl: new URLSearchParams(window.location.search).get('api') || '/api',
};
