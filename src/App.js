import React, { useState, useEffect } from 'react';
import BomSection from './BomSection';
import { Box, TextField, Button, Typography, Slider, Checkbox, FormControlLabel, FormGroup, Paper, Grid, Select, MenuItem } from '@mui/material';

// --- Constants ---
const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const WIND_MODELS = [
  { value: 'ecmwf_ifs025', label: 'ECMWF' },
  { value: 'gfs_seamless', label: 'NOAA US (GFS)' },
  { value: 'bom_access_global', label: 'BOM Australia' },
  { value: 'meteofrance_seamless', label: 'Meteo France' },
  { value: 'ukmo_seamless', label: 'UK Met Office'},
  { value: 'metno_seamless', label: 'MET Norway' },
  { value: 'icon_seamless', label: 'DWD Germany' }
];

function directionToDegrees(dir) {
  // Convert compass direction to degrees
  const map = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
  return map[dir];
}

function rateWind(speed, direction, min, max, preferredDirs) {
  if (speed < min || speed > max) return 'bad';
  if (!preferredDirs.includes(direction)) return 'ok';
  return 'good';
}

function ForecastBlock({ block, minWind, maxWind, preferredDirs, waveData }) {
  const rating = rateWind(block.windSpeed, block.windDir, minWind, maxWind, preferredDirs);
  let color = rating === 'good' ? '#a5d6a7' : rating === 'ok' ? '#fff59d' : '#ef9a9a';
  
  // Find matching wave data for this time
  const waveBlock = waveData.find(w => w.time.getTime() === block.time.getTime());
  
  return (
    <Paper elevation={2} sx={{ p: 2, mb: 1, background: color }}>
      <Typography variant="subtitle2">{block.displayDate}</Typography>
      <Typography variant="subtitle2">{block.displayTime}</Typography>
      <Typography>
        Wind: {block.windSpeed?.toFixed(1) ?? 'N/A'} kt {block.windDir ?? 'N/A'} ({block.windDeg?.toFixed(0) ?? 'N/A'}°)
      </Typography>
      <Typography>Rating: {rating.toUpperCase()}</Typography>
      {waveBlock && (
        <Box sx={{ mt: 1 }}>
          <Typography>
            Wave: {waveBlock.waveHeight?.toFixed(1) ?? 'N/A'} m {waveBlock.waveDir ? `${Math.round(waveBlock.waveDir)}°` : ''}
          </Typography>
          <Typography>
            Wind Wave: {waveBlock.windWaveHeight?.toFixed(1) ?? 'N/A'} m {waveBlock.windWaveDir ? `${Math.round(waveBlock.windWaveDir)}°` : ''}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function App() {
  const [minWind, setMinWind] = useState(15);
  const [maxWind, setMaxWind] = useState(25);
  const [preferredDirs, setPreferredDirs] = useState(['S', 'SW', 'SE']);
  const [bomData, setBomData] = useState([]);
  const [bomApiUrls, setBomApiUrls] = useState([]);
  const [rawBom, setRawBom] = useState(null);
  const [showBadForecasts, setShowBadForecasts] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [showApiData, setShowApiData] = useState(false);
  const [forecast, setForecast] = useState([]);
  const [waveData, setWaveData] = useState([]);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [locationInput, setLocationInput] = useState('Melbourne');
  const [locationError, setLocationError] = useState('');
  const [resolvedLocationName, setResolvedLocationName] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [apiUrlDisplay, setApiUrlDisplay] = useState('');
  const [apiResponseDisplay, setApiResponseDisplay] = useState('');
  const [selectedModel, setSelectedModel] = useState('gfs_seamless');
  // State for selected BOM stations (initialize with all IDs)
  const [selectedBomStations, setSelectedBomStations] = useState(['95872', '94870', '95864', '94853', '94871', '94847']);

  useEffect(() => {
    console.log('BOM Fetch: Starting useEffect...');
    // Fetch BOM data for all identifiers
    const stationIds = ['95872', '94870', '95864', '94853', '94871', '94847'];
    const urls = stationIds.map(id => {
      const originalUrl = `https://www.bom.gov.au/fwo/IDV60701/IDV60701.${id}.json`;
      // Correct proxy format: Append RAW URL directly to the path
      return `https://corsproxy.io/${originalUrl}`;
    });
    console.log('BOM Fetch: Generated URLs (using proxy):', urls);
    setBomApiUrls(urls); // Store the proxied URLs
    console.log('BOM Fetch: Set BomApiUrls state.');
    Promise.all(
      urls.map(async url => {
        // Correctly extract original URL from proxy URL
        const proxyBase = 'https://corsproxy.io/';
        const originalUrl = url.startsWith(proxyBase) ? url.substring(proxyBase.length) : url;
        const stationId = originalUrl.split('.').slice(-2, -1)[0];
        console.log(`BOM Fetch: Attempting fetch for ${url}`);
        try {
          const resp = await fetch(url); // Fetch via proxy
          console.log(`BOM Fetch: Received response for ${url}, status: ${resp.status}`);
          if (!resp.ok) throw new Error(`BOM API error for ${originalUrl}, status: ${resp.status}`);
          const data = await resp.json();
          console.log(`BOM Fetch: Successfully parsed JSON for ${originalUrl}`);
          // Extract station name from header
          const stationName = data?.observations?.header?.[0]?.name || `Station ${stationId}`;
          // Save first station's raw JSON for debug
          if (originalUrl.includes('95872')) {
            console.log('BOM Fetch: Setting rawBom state for 95872');
            setRawBom(data);
          }
          const items = (data?.observations?.data || []).slice(0, 4).map(item => ({
            local_time: item.local_date_time || item.aifstime_utc || '',
            wind_dir: item.wind_dir ?? '',
            wind_spd_kt: item.wind_spd_kt ?? '',
            gust_kt: item.gust_kt ?? ''
          }));
          return { id: stationId, name: stationName, items };
        } catch (e) {
          console.error(`BOM Fetch: Error fetching or parsing ${url}:`, e);
          return { id: stationId, name: `Station ${stationId}`, items: [] }; // Return empty on error
        }
      })
    ).then(fetchedData => {
      console.log('BOM Fetch: Promise.all finished. Setting bomData state:', fetchedData);
      // Initialize selected stations once data is fetched
      // setSelectedBomStations(fetchedData.map(s => s.id)); // Optional: Keep all selected initially
      setBomData(fetchedData);
    }).catch(error => {
      console.error('BOM Fetch: Error in Promise.all chain:', error);
    });
  }, []);

  useEffect(() => {
    // Fetch forecast whenever lat/lon changes
    async function fetchForecast() {
      if (lat === null || lon === null) return;

      console.log(`Fetching forecast for Lat: ${lat}, Lon: ${lon}`);

      // Fetch wind forecast
      const windParams = new URLSearchParams({
        latitude: lat.toFixed(6),
        longitude: lon.toFixed(6),
        hourly: 'windspeed_10m,winddirection_10m',
        windspeed_unit: 'kn',
        forecast_days: 7,
        timezone: 'Australia/Sydney',
        models: selectedModel
      });
      const windApiUrl = `https://api.open-meteo.com/v1/forecast?${windParams.toString()}`;

      // Fetch wave data
      const waveParams = new URLSearchParams({
        latitude: lat.toFixed(6),
        longitude: lon.toFixed(6),
        hourly: 'wave_height,wind_wave_height,wave_direction,wind_wave_direction',
        timezone: 'Australia/Sydney'
      });
      const waveApiUrl = `https://marine-api.open-meteo.com/v1/marine?${waveParams.toString()}`;

      try {
        // Fetch wind data
        const windResponse = await fetch(windApiUrl);
        if (!windResponse.ok) {
          throw new Error(`Wind API error! status: ${windResponse.status}`);
        }
        const windData = await windResponse.json();

        // Fetch wave data
        const waveResponse = await fetch(waveApiUrl);
        if (!waveResponse.ok) {
          throw new Error(`Wave API error! status: ${waveResponse.status}`);
        }
        const waveData = await waveResponse.json();

        // Store raw responses for display
        setApiResponseDisplay(JSON.stringify({ wind: windData, wave: waveData }, null, 2));

        // --- Wind Data Parsing ---
        if (windData && windData.hourly && windData.hourly.time && windData.hourly.windspeed_10m && windData.hourly.winddirection_10m) {
          const windBlocks = [];
          const times = windData.hourly.time;
          const windSpeeds = windData.hourly.windspeed_10m;
          const windDirections = windData.hourly.winddirection_10m;

          for (let i = 0; i < times.length; i++) {
            const time = new Date(times[i]);
            const displayDate = time.toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short',
              timeZone: 'Australia/Sydney'
            });
            const displayTime = time.toLocaleTimeString('en-AU', {
              hour: '2-digit', minute: '2-digit', hour12: false,
              timeZone: 'Australia/Sydney'
            });

            const windSpeed = windSpeeds[i];
            const deg = windDirections[i];
            const idx = Math.round(deg / 45) % 8;
            const windDir = WIND_DIRECTIONS[idx];

            windBlocks.push({ 
              time, 
              displayDate, 
              displayTime, 
              windSpeed, 
              windDir, 
              windDeg: deg 
            });
          }
          setForecast(windBlocks);
        }

        // --- Wave Data Parsing ---
        if (waveData && waveData.hourly && waveData.hourly.time && waveData.hourly.wave_height) {
          const waveBlocks = [];
          const times = waveData.hourly.time;
          const waveHeights = waveData.hourly.wave_height;
          const windWaveHeights = waveData.hourly.wind_wave_height;
          const waveDirections = waveData.hourly.wave_direction;
          const windWaveDirections = waveData.hourly.wind_wave_direction;

          for (let i = 0; i < times.length; i++) {
            const time = new Date(times[i]);
            const waveHeight = waveHeights[i];
            const windWaveHeight = windWaveHeights[i];
            const waveDir = waveDirections[i];
            const windWaveDir = windWaveDirections[i];

            waveBlocks.push({ 
              time, 
              waveHeight,
              windWaveHeight,
              waveDir,
              windWaveDir
            });
          }
          setWaveData(waveBlocks);
        }

      } catch (error) {
        console.error('Error fetching forecast:', error);
        setForecast([]);
        setWaveData([]);
        setApiResponseDisplay(`Error fetching forecast: ${error.message}`);
      }
    }
    fetchForecast();
  }, [lat, lon, selectedModel]);

  // Initial geocode on load for default location
  useEffect(() => {
    geocodeLocation(locationInput);
  }, []);

  function handleDirChange(dir) {
    setPreferredDirs(prev =>
      prev.includes(dir) ? prev.filter(d => d !== dir) : [...prev, dir]
    );
  }

  async function geocodeLocation(locationQuery) {
    if (!locationQuery) return;
    setResolvedLocationName('');
    setIsLoadingLocation(true);
    setLocationError('');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&countrycodes=au&limit=1`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        const location = data[0];
        console.log(`Geocoded Location - Lat: ${location.lat}, Lon: ${location.lon}`);
        setLat(parseFloat(location.lat));
        setLon(parseFloat(location.lon));
        setResolvedLocationName(location.display_name);
      } else {
        setLocationError('Location not found. Please try again.');
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setLocationError('Failed to fetch location. Check connection.');
    }
    setIsLoadingLocation(false);
  }

  function handleLocationUpdate() {
    geocodeLocation(locationInput);
  }

  // Handler for BOM Station Checkbox Toggle
  const handleBomStationToggle = (stationId) => {
    setSelectedBomStations(prevSelected =>
      prevSelected.includes(stationId)
        ? prevSelected.filter(id => id !== stationId)
        : [...prevSelected, stationId]
    );
  };

  function getBestHoursSummary(forecast, minWind, maxWind, preferredDirs, waveData) {
    if (!forecast.length) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayForecast = forecast.filter(block => {
      const blockDate = new Date(block.time);
      return blockDate >= today && blockDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    });

    if (!todayForecast.length) return null;

    const groups = [];
    for (let hour = 0; hour < 24; hour += 3) {
      const startTime = new Date(today);
      startTime.setHours(hour, 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(hour + 3, 0, 0, 0);
      
      const blockForecast = todayForecast.filter(block => {
        const blockTime = new Date(block.time);
        return blockTime >= startTime && blockTime < endTime;
      });

      if (blockForecast.length > 0) {
        const averageWind = blockForecast.reduce((sum, block) => sum + block.windSpeed, 0) / blockForecast.length;
        const averageDirection = blockForecast.reduce((sum, block) => sum + block.windDeg, 0) / blockForecast.length;
        const directionIdx = Math.round(averageDirection / 45) % 8;
        const direction = WIND_DIRECTIONS[directionIdx];

        const rating = rateWind(averageWind, direction, minWind, maxWind, preferredDirs);
        
        // Get wave data for this block, filtering out undefined/null entries
        const validWaveBlocks = blockForecast
          .map(block => waveData.find(w => w.time.getTime() === block.time.getTime()))
          .filter(Boolean); // Filter out any undefined results from find
          
        let averageWaveHeight = null;
        let averageWindWaveHeight = null;
        let averageWaveDir = null;
        let averageWindWaveDir = null;

        if (validWaveBlocks.length > 0) {
          averageWaveHeight = validWaveBlocks.reduce((sum, block) => sum + (block.waveHeight || 0), 0) / validWaveBlocks.length;
          averageWindWaveHeight = validWaveBlocks.reduce((sum, block) => sum + (block.windWaveHeight || 0), 0) / validWaveBlocks.length;
          // Optional: Average direction only if needed, handling circular mean might be complex
          // For simplicity, maybe take the direction of the first valid block or omit average direction?
          // Let's calculate a simple arithmetic mean for now, acknowledging it's not ideal for angles.
          averageWaveDir = validWaveBlocks.reduce((sum, block) => sum + (block.waveDir || 0), 0) / validWaveBlocks.length;
          averageWindWaveDir = validWaveBlocks.reduce((sum, block) => sum + (block.windWaveDir || 0), 0) / validWaveBlocks.length;
        }

        groups.push({
          startTime: startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: endTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
          averageWind,
          direction,
          rating,
          averageWaveHeight,
          averageWindWaveHeight,
          averageWaveDir,
          averageWindWaveDir
        });
      }
    }

    return {
      date: todayForecast[0].displayDate,
      groups
    };
  }

  const bestHoursSummary = getBestHoursSummary(forecast, minWind, maxWind, preferredDirs, waveData);

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>Wingfoil Wind App</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography gutterBottom>Location</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          <TextField
            label="Town Name or Postcode"
            variant="outlined"
            size="small"
            fullWidth
            value={locationInput}
            onChange={e => setLocationInput(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleLocationUpdate(); }}
            error={!!locationError}
            helperText={locationError}
            disabled={isLoadingLocation}
          />
          <Button
            variant="contained"
            onClick={handleLocationUpdate}
            disabled={isLoadingLocation || !locationInput}
            size="medium"
          >
            {isLoadingLocation ? '...' : 'Update'}
          </Button>
        </Box>
        {resolvedLocationName && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2">
              Showing forecast for: {resolvedLocationName}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
              control={
                <Checkbox
                  checked={showBadForecasts}
                  onChange={(e) => setShowBadForecasts(e.target.checked)}
                />
              }
              label="Show BAD forecasts"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showCoords}
                  onChange={(e) => setShowCoords(e.target.checked)}
                />
              }
              label="Show Coordinates"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showApiData}
                  onChange={(e) => setShowApiData(e.target.checked)}
                />
              }
              label="Show API Data"
            />
            <Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              size="small"
              sx={{ ml: 2 }}
            >
              {WIND_MODELS.map(model => (
                <MenuItem key={model.value} value={model.value}>
                  {model.label}
                </MenuItem>
              ))}
            </Select>
          </Box>
        {resolvedLocationName && lat !== null && lon !== null && showCoords && (
          <Typography variant="caption" sx={{ mb: 2, display: 'block' }}>
            (Lat: {lat.toFixed(4)}, Lon: {lon.toFixed(4)})
          </Typography>
        )}
        {apiUrlDisplay && showApiData && (
          <Typography variant="caption" sx={{ display: 'block', mb: 2, wordBreak: 'break-all', color: 'grey.600' }}>
            API Call: {apiUrlDisplay}
          </Typography>
        )}
        {apiResponseDisplay && showApiData && (
          <Typography component="pre" variant="caption" sx={{ display: 'block', mb: 2, maxHeight: '200px', overflowY: 'auto', wordBreak: 'break-all', whiteSpace: 'pre-wrap', color: 'grey.800', bgcolor: 'grey.200', p: 1, borderRadius: 1, fontFamily: 'monospace' }}>
            API Response:
            {apiResponseDisplay}
          </Typography>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Wind Speed Range</Typography>
            <Slider
              value={[minWind, maxWind]}
              onChange={(_, newValue) => {
                setMinWind(newValue[0]);
                setMaxWind(newValue[1]);
              }}
              min={0}
              max={40}
              step={1}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Preferred Directions</Typography>
            <FormGroup row>
              {WIND_DIRECTIONS.map(dir => (
                <FormControlLabel
                  key={dir}
                  control={
                    <Checkbox
                      checked={preferredDirs.includes(dir)}
                      onChange={() => handleDirChange(dir)}
                    />
                  }
                  label={dir}
                />
              ))}
            </FormGroup>
          </Grid>
        </Grid>

        {/* BOM Wind Observations Section */}
      <BomSection 
        bomData={bomData} 
        selectedStations={selectedBomStations}
        onStationToggle={handleBomStationToggle}
        minWind={minWind}
        maxWind={maxWind}
        preferredDirs={preferredDirs}
      />

      <Typography variant="h6" sx={{ mt: 3 }}>Today's Wind Summary</Typography>
        {bestHoursSummary && (
          <Grid container spacing={2}>
            {bestHoursSummary.groups.map((group, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper elevation={2} sx={{ p: 2, background: group.rating === 'good' ? '#a5d6a7' : group.rating === 'ok' ? '#fff59d' : '#ef9a9a' }}>
                  <Typography variant="subtitle2">{group.startTime} - {group.endTime}</Typography>
                  <Typography>
                    Wind: {group.averageWind.toFixed(1)} kt {group.direction}
                  </Typography>
                  <Typography>
                    Wave: {group.averageWaveHeight?.toFixed(1) ?? 'N/A'} m {group.averageWaveDir ? `(${Math.round(group.averageWaveDir)}°)` : ''}
                  </Typography>
                  <Typography>
                    Wind Wave: {group.averageWindWaveHeight?.toFixed(1) ?? 'N/A'} m {group.averageWindWaveDir ? `(${Math.round(group.averageWindWaveDir)}°)` : ''}
                  </Typography>
                  <Typography>Rating: {group.rating.toUpperCase()}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        <Typography variant="h6" sx={{ mt: 3 }}>Wind Forecast</Typography>
        <Grid container spacing={2}>
          {forecast.map((block, index) => {
            const rating = rateWind(block.windSpeed, block.windDir, minWind, maxWind, preferredDirs);
            if (rating === 'bad' && !showBadForecasts) return null; // Skip bad forecasts if toggle is off
            
            let color = rating === 'good' ? '#a5d6a7' : rating === 'ok' ? '#fff59d' : '#ef9a9a';
            
            // Find the corresponding wave data for this forecast block's time
            const waveBlock = waveData.find(w => w.time.getTime() === block.time.getTime());
            
            return (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper elevation={2} sx={{ p: 2, mb: 1, background: color }}>
                  <Typography variant="subtitle2">{block.displayDate}</Typography>
                  <Typography variant="subtitle2">{block.displayTime}</Typography>
                  <Typography>
                    Wind: {block.windSpeed?.toFixed(1) ?? 'N/A'} kt {block.windDir ?? 'N/A'} ({block.windDeg?.toFixed(0) ?? 'N/A'}°)
                  </Typography>
                  <Typography>Rating: {rating.toUpperCase()}</Typography>
                  {/* Display wave data if found */}
                  {waveBlock && (
                    <Box sx={{ mt: 1 }}>
                      <Typography>
                        Wave: {waveBlock.waveHeight?.toFixed(1) ?? 'N/A'} m {waveBlock.waveDir ? `(${Math.round(waveBlock.waveDir)}°)` : ''}
                      </Typography>
                      <Typography>
                        Wind Wave: {waveBlock.windWaveHeight?.toFixed(1) ?? 'N/A'} m {waveBlock.windWaveDir ? `(${Math.round(waveBlock.windWaveDir)}°)` : ''}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Paper>
      {/* BOM debug output */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>BOM API URLs:</Typography>
        <pre style={{ fontSize: 12, maxHeight: 100, overflow: 'auto', background: '#f6f6f6', padding: 8 }}>
          {bomApiUrls && bomApiUrls.length > 0 ? bomApiUrls.join('\n') : 'No URLs'}
        </pre>
        <Typography variant="caption" sx={{ fontWeight: 'bold', mt: 2 }}>BOM Debug Output:</Typography>
        <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto', background: '#f6f6f6', padding: 8 }}>
          {JSON.stringify(bomData, null, 2)}
        </pre>
        <Typography variant="caption" sx={{ fontWeight: 'bold', mt: 2 }}>Raw BOM JSON (95872):</Typography>
        <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto', background: '#f0f0f0', padding: 8 }}>
          {rawBom ? JSON.stringify(rawBom, null, 2) : 'No data'}
        </pre>
      </Paper>
    </Box>
  );
}

export default App;
