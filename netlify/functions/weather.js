exports.handler = async function(event, context) {
  try {
    const params = event.queryStringParameters || {};
    const url = params.url;
    // Only allow URLs from the BOM domain for security
    if (!url || !url.startsWith('https://www.bom.gov.au/')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or missing URL parameter' })
      };
    }
    const response = await fetch(url);
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to fetch weather data' })
      };
    }
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
