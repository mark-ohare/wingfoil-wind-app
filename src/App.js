import React, { useState, useEffect } from 'react';
import BomSection from './BomSection';
import { Box, TextField, Button, Typography, Slider, Checkbox, FormControlLabel, FormGroup, Paper, Grid, Select, MenuItem } from '@mui/material';

// --- Constants ---
const WIND_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW'
];
const WIND_MODELS = [
  { value: 'ecmwf_ifs025', label: 'ECMWF' },
  { value: 'gfs_seamless', label: 'NOAA US (GFS)' },
  { value: 'bom_access_global', label: 'BOM Australia' },
  { value: 'meteofrance_seamless', label: 'Meteo France' },
  { value: 'ukmo_seamless', label: 'UK Met Office'},
  { value: 'metno_seamless', label: 'MET Norway' },
  { value: 'icon_seamless', label: 'DWD Germany' }
];

// --- Wind Direction UI Columns ---
const WIND_DIRECTION_COLUMNS = [
  {
    label: 'N',
    directions: ['N', 'NNE', 'NNW', 'NE', 'NW']
  },
  {
    label: 'E',
    directions: ['E', 'ENE', 'ESE', 'NE', 'SE']
  },
  {
    label: 'S',
    directions: ['S', 'SSE', 'SSW', 'SE', 'SW']
  },
  {
    label: 'W',
    directions: ['W', 'WNW', 'WSW', 'NW', 'SW']
  }
];
// No separate diagonals row.

function directionToDegrees(dir) {
  // Convert compass direction to degrees (16-point compass)
  const map = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5
  };
  return map[dir];
}

function rateWind(speed, direction, min, max, preferredDirs) {
  if (speed < min || speed > max) return 'bad';
  const dirDeg = directionToDegrees(direction);
  if (dirDeg === undefined) return 'ok';
  // If no preferredDirs, treat all directions as preferred
  if (!preferredDirs || preferredDirs.length === 0) return 'good';
  // Allow +/- 22.5 deg (one compass point) from preferred direction
  for (let pref of preferredDirs) {
    const prefDeg = directionToDegrees(pref);
    if (prefDeg === undefined) continue;
    let diff = Math.abs(dirDeg - prefDeg);
    if (diff > 180) diff = 360 - diff;
    if (diff <= 22.5) return 'good';
  }
  return 'ok';
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
  const [minWind, setMinWind] = useState(12);
  const [maxWind, setMaxWind] = useState(35);
  const [preferredDirs, setPreferredDirs] = useState(['S', 'SSW', 'SSE', 'SW', 'SE']);
  const [bomData, setBomData] = useState([]);
  const [bomApiUrls, setBomApiUrls] = useState([]);
  const [rawBom, setRawBom] = useState(null);
  const [hideUnsuitableForecasts, setHideUnsuitableForecasts] = useState(true);
  const [showCoords, setShowCoords] = useState(false);
  const [showApiData, setShowApiData] = useState(false);
  const [selectedBomStations, setSelectedBomStations] = useState(['95872', '94870', '95864', '94853', '94871', '94847']);
  const [forecast, setForecast] = useState([]);
  const [waveData, setWaveData] = useState([]);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [locationInput, setLocationInput] = useState('Mentone');
  const [locationError, setLocationError] = useState('');
  const [resolvedLocationName, setResolvedLocationName] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [apiUrlDisplay, setApiUrlDisplay] = useState('');
  const [apiResponseDisplay, setApiResponseDisplay] = useState('');
  const [selectedModel, setSelectedModel] = useState('gfs_seamless');

  useEffect(() => {
    console.log('BOM Fetch: Starting useEffect...');
    const stationIds = ['95872', '94870', '95864', '94853', '94871', '94847'];
    // Use Netlify Function as a CORS-safe proxy
    const urls = stationIds.map(id => {
      // Pass the original URL as a query parameter to the Netlify function
      return `/.netlify/functions/weather?url=https://www.bom.gov.au/fwo/IDV60701/IDV60701.${id}.json`;
    });
    console.log('BOM Fetch: Generated URLs (using Netlify function):', urls);
    setBomApiUrls(urls); // Store the Netlify function URLs
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
      setBomData(fetchedData);
    }).catch(error => {
      console.error('BOM Fetch: Error in Promise.all chain:', error);
    });
  }, []); // Empty dependency array means this runs once on mount

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
      // Set API URL display for Show API Data tickbox
      setApiUrlDisplay(`Wind API: ${windApiUrl}\nWave API: (set after)`);

      // Fetch wave data
      const waveParams = new URLSearchParams({
        latitude: lat.toFixed(6),
        longitude: lon.toFixed(6),
        hourly: 'wave_height,wind_wave_height,wave_direction,wind_wave_direction',
        // hourly: 'wind_wave_height,wind_wave_direction',
        timezone: 'Australia/Sydney'
      });
      const waveApiUrl = `https://marine-api.open-meteo.com/v1/marine?${waveParams.toString()}`;
      // Append wave API URL to apiUrlDisplay
      setApiUrlDisplay(`Wind API: ${windApiUrl}\nWave API: ${waveApiUrl}`);

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

  // Filter out 'bad' blocks when hideUnsuitableForecasts is true (checkbox checked hides bad)
  const filteredGroups = bestHoursSummary?.groups?.filter(group => {
    // hideUnsuitableForecasts false: show all; true: hide bad
    return !hideUnsuitableForecasts || group.rating !== 'bad';
  }) || [];

  const filteredForecast = forecast.filter(block => {
    const rating = rateWind(block.windSpeed, block.windDir, minWind, maxWind, preferredDirs);
    // hideUnsuitableForecasts false: show all; true: hide bad
    return !hideUnsuitableForecasts || rating !== 'bad';
  });

  // Handler for BOM Station Checkbox Toggle
  const handleBomStationToggle = (stationId) => {
    setSelectedBomStations(prevSelected =>
      prevSelected.includes(stationId)
        ? prevSelected.filter(id => id !== stationId)
        : [...prevSelected, stationId]
    );
  };

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
                  checked={!hideUnsuitableForecasts}
                  onChange={() => setHideUnsuitableForecasts(prev => !prev)}
                  size="small"
                />
              }
              label="Show Unsuitable Wind Forecasts"
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
        </Box>

        {/* Forecast model selection row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Typography>Select your forecast model:</Typography>
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            size="small"
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
  <>
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
  </>
) }
          <Grid item xs={12}>
  <Typography variant="h6" gutterBottom>Preferred Wind Directions</Typography>
  <Grid container spacing={2}>
    {WIND_DIRECTION_COLUMNS.map((group, idx) => (
      <Grid item xs={6} md={3} key={group.label}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: 1, borderColor: 'grey.300', borderRadius: 2, p: 1, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" align="center" sx={{ fontWeight: 'bold', mb: 1 }}>{group.label}</Typography>
          {group.directions.map(dir => (
            <FormControlLabel
              key={dir}
              control={
                <Checkbox
                  checked={preferredDirs.includes(dir)}
                  onChange={() => setPreferredDirs(prev =>
                    prev.includes(dir)
                      ? prev.filter(d => d !== dir)
                      : [...prev, dir]
                  )}
                  size="small"
                />
              }
              label={dir}
              sx={{ m: 0, width: '100%' }}
            />
          ))}
        </Box>
      </Grid>
    ))}
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
        bomApiUrls={bomApiUrls}
        rawBom={rawBom}
      />

      <Typography variant="h6" sx={{ mt: 3 }}>Today's Wind Summary</Typography>
      {bestHoursSummary && filteredGroups.length > 0 ? (
        <Grid container spacing={2}>
          {filteredGroups.map((group, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Paper elevation={2} sx={{ p: 2, background: group.rating === 'good' ? '#a5d6a7' : group.rating === 'ok' ? '#fff59d' : '#ef9a9a' }}>
                <Typography variant="subtitle2">{group.startTime} - {group.endTime}</Typography>
                <Typography>
                  Wind: {group.averageWind.toFixed(1)} kt {group.direction}
                </Typography>
                <Typography>Rating: {group.rating.toUpperCase()}</Typography>
                {group.averageWaveHeight !== undefined && (
                  <Typography>Wave: {group.averageWaveHeight.toFixed(1)} m</Typography>
                )}
                {group.averageWindWaveHeight !== undefined && (
                  <Typography>Wind Wave: {group.averageWindWaveHeight.toFixed(1)} m</Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography sx={{ mt: 2, color: 'text.secondary', textAlign: 'center' }}>
          No suitable wind forecasts found.<br/>
          Try adjusting your preferred wind directions, wind speed range, or forecast model.
        </Typography>
      )}

      {/* Wind Forecast Grid */}
      <Typography variant="h6" sx={{ mt: 3 }}>Wind Forecast</Typography>
      <Grid container spacing={2}>
        {filteredForecast.map((block, index) => {
          const rating = rateWind(block.windSpeed, block.windDir, minWind, maxWind, preferredDirs);
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
                {/* Display wave data if found */}
                {waveBlock && (
                  <Box sx={{ mt: 1 }}>
                    <Typography>
                      Wind Wave: {waveBlock.windWaveHeight?.toFixed(1) ?? 'N/A'} m {waveBlock.windWaveDir ? `${Math.round(waveBlock.windWaveDir)}°` : ''}
                    </Typography>
                    <Typography>Rating: {rating.toUpperCase()}</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
      </Paper>
    </Box>
  );
}

export default App;
