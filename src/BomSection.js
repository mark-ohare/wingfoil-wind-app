import React, { useState } from 'react';
import { Paper, Typography, Grid, Table, TableHead, TableRow, TableCell, TableBody, FormGroup, FormControlLabel, Checkbox, Box } from '@mui/material';

// Helper function to rate wind (copied from App.js for simplicity)
function directionToDegrees(dir) {
  // 16-point compass
  const map = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5
  };
  return map[dir];
}

function rateWind(speed, direction, min, max, preferredDirs) {
  if (speed === null || speed === undefined || speed < min || speed > max) return '';
  const degrees = directionToDegrees(direction);
  if (degrees === undefined) return '';

  const preferredDegrees = preferredDirs.map(directionToDegrees).filter(d => d !== undefined);
  if (!preferredDegrees.length) return 'good'; // If no preferred dirs, any direction in range is good

  for (let prefDegree of preferredDegrees) {
    let diff = Math.abs(degrees - prefDegree);
    if (diff > 180) diff = 360 - diff;
    if (diff <= 22.5) { // Allow +/- 22.5 degrees from preferred direction
      return 'good';
    }
  }
  return ''; // Not within preferred direction range
}

export default function BomSection({ bomData, selectedStations, onStationToggle, minWind, maxWind, preferredDirs, bomApiUrls, rawBom }) {
  const [showDebug, setShowDebug] = useState(false);

  if (!bomData || bomData.length === 0) return null;

  const getRowColor = (item) => {
    const rating = rateWind(item.wind_spd_kt, item.wind_dir, minWind, maxWind, preferredDirs);
    if (rating === 'good') return 'rgba(0, 255, 0, 0.1)'; // Light green
    return undefined; // Default background
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>BOM Wind Observations</Typography>
        
        {/* Checkboxes for Station Selection */}
        <FormGroup row sx={{ mb: 2, flexWrap: 'wrap' }}>
          {bomData.map(station => (
            <FormControlLabel
              key={station.id}
              control={
                <Checkbox
                  checked={selectedStations.includes(station.id)}
                  onChange={() => onStationToggle(station.id)}
                  size="small"
                />
              }
              label={station.name}
            />
          ))}
          <FormControlLabel
            control={
              <Checkbox
                checked={showDebug}
                onChange={() => setShowDebug(prev => !prev)}
                size="small"
              />
            }
            label="Show BOM Debug Information"
          />
        </FormGroup>

        <Grid container spacing={2}>
          {/* Filter stations based on selection before mapping */}
          {bomData
            .filter(station => selectedStations.includes(station.id))
            .map(station => (
              <Grid item xs={12} sm={6} md={6} key={station.id}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  {/* Display Station Name */}
                  <Typography variant="subtitle1" gutterBottom>{station.name}</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Dir</TableCell>
                        <TableCell>Speed (kt)</TableCell>
                        <TableCell>Gust (kt)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {station.items.map((item, idx) => (
                        <TableRow key={idx} sx={{ backgroundColor: getRowColor(item) }}>
                          <TableCell>{item.local_time}</TableCell>
                          <TableCell>{item.wind_dir}</TableCell>
                          <TableCell>{item.wind_spd_kt}</TableCell>
                          <TableCell>{item.gust_kt}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Debug Section */}
      {showDebug && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>BOM Debug Information</Typography>
          <Typography variant="subtitle1" gutterBottom>BOM API URLs:</Typography>
          {bomApiUrls.map((url, idx) => (
            <Typography key={idx} variant="body2" sx={{ mb: 1 }}>
              {url}
            </Typography>
          ))}
          <Typography variant="subtitle1" gutterBottom>Raw BOM JSON (95872):</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '400px' }}>
            {JSON.stringify(rawBom, null, 2)}
          </pre>
          <Typography variant="subtitle1" gutterBottom>BOM Debug Output:</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '400px' }}>
            {JSON.stringify(bomData, null, 2)}
          </pre>
        </Paper>
      )}
    </Box>
  );
}
