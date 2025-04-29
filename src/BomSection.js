import React from 'react';
import { Paper, Typography, Grid, Table, TableHead, TableRow, TableCell, TableBody, FormGroup, FormControlLabel, Checkbox, Box } from '@mui/material';

// Helper function to rate wind (copied from App.js for simplicity)
function directionToDegrees(dir) {
  const index = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(dir);
  return index !== -1 ? index * 45 : null;
}

function rateWind(speed, direction, min, max, preferredDirs) {
  if (speed === null || speed === undefined || speed < min || speed > max) return '';
  const degrees = directionToDegrees(direction);
  if (degrees === null) return '';

  const preferredDegrees = preferredDirs.map(directionToDegrees).filter(d => d !== null);
  if (!preferredDegrees.length) return 'good'; // If no preferred dirs, any direction in range is good

  for (let prefDegree of preferredDegrees) {
    let diff = Math.abs(degrees - prefDegree);
    if (diff > 180) diff = 360 - diff; // Handle wrap-around
    if (diff <= 45) { // Allow +/- 45 degrees from preferred direction
      return 'good';
    }
  }
  return ''; // Not within preferred direction range
}

export default function BomSection({ bomData, selectedStations, onStationToggle, minWind, maxWind, preferredDirs }) {
  if (!bomData || bomData.length === 0) return null;

  const getRowColor = (item) => {
    const rating = rateWind(item.wind_spd_kt, item.wind_dir, minWind, maxWind, preferredDirs);
    if (rating === 'good') return 'rgba(0, 255, 0, 0.1)'; // Light green
    // Optional: add red for explicitly bad, or leave default
    // if (rating === 'bad') return 'rgba(255, 0, 0, 0.1)'; // Light red
    return undefined; // Default background
  };

  return (
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
  );
}
