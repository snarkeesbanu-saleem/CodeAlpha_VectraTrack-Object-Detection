// Weather-Based Pest Risk Forecast using Open-Meteo API (no API key required)
// Pest outbreak risk matrix based on temperature + humidity + rainfall

export interface DailyForecast {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  pestRisk: 'Low' | 'Moderate' | 'High' | 'Critical';
  diseaseRisk: 'Low' | 'Moderate' | 'High';
  riskColor: string;
  riskBg: string;
  riskReasons: string[];
}

function calculatePestRisk(tempMax: number, humidity: number, rainfall: number): {
  pestRisk: DailyForecast['pestRisk'];
  diseaseRisk: DailyForecast['diseaseRisk'];
  riskColor: string;
  riskBg: string;
  riskReasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  // Aphid / Caterpillar: optimal 22-30°C + humidity >65%
  if (tempMax >= 22 && tempMax <= 32) { score += 2; reasons.push('Optimal temp for aphids & caterpillars'); }
  if (humidity >= 65) { score += 2; reasons.push('High humidity favors whitefly & mite activity'); }
  if (humidity >= 85) { score += 1; reasons.push('Very high humidity — fungal disease risk'); }
  if (rainfall >= 5) { score += 1; reasons.push('Rainfall promotes leaf blight & rust'); }
  if (rainfall >= 15) { score += 2; reasons.push('Heavy rain — armyworm migration risk'); }
  if (tempMax > 35) { score -= 1; reasons.push('High heat reduces aphid activity'); }

  const diseaseRisk: DailyForecast['diseaseRisk'] =
    humidity >= 85 || rainfall >= 10 ? 'High' :
    humidity >= 70 || rainfall >= 3 ? 'Moderate' : 'Low';

  if (score <= 1) return { pestRisk: 'Low', diseaseRisk, riskColor: '#16a34a', riskBg: '#dcfce7', riskReasons: reasons.length ? reasons : ['Conditions unfavourable for pest outbreak'] };
  if (score <= 3) return { pestRisk: 'Moderate', diseaseRisk, riskColor: '#d97706', riskBg: '#fef3c7', riskReasons: reasons };
  if (score <= 5) return { pestRisk: 'High', diseaseRisk, riskColor: '#ea580c', riskBg: '#ffedd5', riskReasons: reasons };
  return { pestRisk: 'Critical', diseaseRisk, riskColor: '#dc2626', riskBg: '#fee2e2', riskReasons: reasons };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function fetchWeatherForecast(lat: number, lng: number): Promise<DailyForecast[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,relativehumidity_2m_max` +
    `&timezone=auto&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather API unavailable');
  const json = await res.json() as {
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      windspeed_10m_max: number[];
      relativehumidity_2m_max: number[];
    };
  };

  const d = json.daily;
  return d.time.map((dateStr, i) => {
    const date = new Date(dateStr);
    const tempMax = d.temperature_2m_max[i] ?? 28;
    const tempMin = d.temperature_2m_min[i] ?? 22;
    const rainfall = d.precipitation_sum[i] ?? 0;
    const windSpeed = d.windspeed_10m_max[i] ?? 10;
    const humidity = d.relativehumidity_2m_max[i] ?? 60;

    const risk = calculatePestRisk(tempMax, humidity, rainfall);
    return {
      date: dateStr,
      dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[date.getDay()] ?? dateStr,
      tempMax: Math.round(tempMax),
      tempMin: Math.round(tempMin),
      humidity: Math.round(humidity),
      rainfall: Math.round(rainfall * 10) / 10,
      windSpeed: Math.round(windSpeed),
      ...risk,
    };
  });
}

// Fallback mock data when GPS/API unavailable
export function getMockForecast(): DailyForecast[] {
  const base = new Date();
  return [
    { date: '', dayLabel: 'Today', tempMax: 31, tempMin: 24, humidity: 78, rainfall: 0, windSpeed: 12, pestRisk: 'Moderate', diseaseRisk: 'Moderate', riskColor: '#d97706', riskBg: '#fef3c7', riskReasons: ['Warm temp + moderate humidity favors aphids'] },
    { date: '', dayLabel: 'Tomorrow', tempMax: 29, tempMin: 23, humidity: 85, rainfall: 4, windSpeed: 8, pestRisk: 'High', diseaseRisk: 'High', riskColor: '#ea580c', riskBg: '#ffedd5', riskReasons: ['High humidity favors whitefly & mite activity', 'Rainfall promotes leaf blight & rust'] },
    { date: '', dayLabel: 'Wed', tempMax: 27, tempMin: 22, humidity: 90, rainfall: 12, windSpeed: 15, pestRisk: 'Critical', diseaseRisk: 'High', riskColor: '#dc2626', riskBg: '#fee2e2', riskReasons: ['Very high humidity', 'Heavy rain — armyworm migration risk'] },
    { date: '', dayLabel: 'Thu', tempMax: 30, tempMin: 24, humidity: 75, rainfall: 2, windSpeed: 10, pestRisk: 'Moderate', diseaseRisk: 'Moderate', riskColor: '#d97706', riskBg: '#fef3c7', riskReasons: ['Optimal temp for aphids & caterpillars'] },
    { date: '', dayLabel: 'Fri', tempMax: 32, tempMin: 25, humidity: 65, rainfall: 0, windSpeed: 14, pestRisk: 'Low', diseaseRisk: 'Low', riskColor: '#16a34a', riskBg: '#dcfce7', riskReasons: ['Conditions unfavourable for pest outbreak'] },
    { date: '', dayLabel: 'Sat', tempMax: 33, tempMin: 26, humidity: 60, rainfall: 0, windSpeed: 18, pestRisk: 'Low', diseaseRisk: 'Low', riskColor: '#16a34a', riskBg: '#dcfce7', riskReasons: ['Dry and warm — low pest pressure'] },
    { date: '', dayLabel: 'Sun', tempMax: 31, tempMin: 24, humidity: 70, rainfall: 1, windSpeed: 11, pestRisk: 'Moderate', diseaseRisk: 'Low', riskColor: '#d97706', riskBg: '#fef3c7', riskReasons: ['Warming trend — monitor for aphid return'] },
  ];
}
