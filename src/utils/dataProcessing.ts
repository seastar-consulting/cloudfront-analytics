import { LogEntry, ProcessedData, GeoData } from "../types/dashboard";

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

// Edge location coordinates mapping
const edgeLocationCoordinates: Record<string, { lat: number; lng: number }> = {
  // Europe
  AMS: { lat: 52.3105, lng: 4.7683 }, // Amsterdam
  ARN: { lat: 59.6497, lng: 17.9237 }, // Stockholm
  ATH: { lat: 37.9364, lng: 23.9445 }, // Athens
  CDG: { lat: 49.0097, lng: 2.5479 }, // Paris
  CPH: { lat: 55.618, lng: 12.6508 }, // Copenhagen
  DUB: { lat: 53.4264, lng: -6.2499 }, // Dublin
  DUS: { lat: 51.2789, lng: 6.7645 }, // Düsseldorf
  FRA: { lat: 50.0379, lng: 8.5622 }, // Frankfurt
  HAM: { lat: 53.6304, lng: 9.9882 }, // Hamburg
  HEL: { lat: 60.3172, lng: 24.9633 }, // Helsinki
  IST: { lat: 41.2609, lng: 28.7415 }, // Istanbul
  LHR: { lat: 51.47, lng: -0.4543 }, // London
  MAD: { lat: 40.4983, lng: -3.5676 }, // Madrid
  MRS: { lat: 43.436, lng: 5.2146 }, // Marseille
  MUC: { lat: 48.3537, lng: 11.786 }, // Munich
  MXP: { lat: 45.6286, lng: 8.7236 }, // Milan
  SOF: { lat: 42.6967, lng: 23.4114 }, // Sofia
  VIE: { lat: 48.1103, lng: 16.5697 }, // Vienna
  WAW: { lat: 52.1672, lng: 20.9679 }, // Warsaw
  ZRH: { lat: 47.4582, lng: 8.5555 }, // Zurich

  // Asia Pacific
  BLR: { lat: 13.1986, lng: 77.7066 }, // Bangalore
  HKG: { lat: 22.308, lng: 113.9185 }, // Hong Kong
  ICN: { lat: 37.4602, lng: 126.4407 }, // Seoul
  NRT: { lat: 35.772, lng: 140.3929 }, // Tokyo
  SIN: { lat: 1.3644, lng: 103.9915 }, // Singapore

  // Oceania
  BNE: { lat: -27.3842, lng: 153.1177 }, // Brisbane
  MEL: { lat: -37.669, lng: 144.841 }, // Melbourne

  // North America
  ATL: { lat: 33.6407, lng: -84.4277 }, // Atlanta
  CMH: { lat: 39.9999, lng: -82.8872 }, // Columbus
  DEN: { lat: 39.8561, lng: -104.6737 }, // Denver
  DFW: { lat: 32.8998, lng: -97.0403 }, // Dallas
  IAD: { lat: 38.9519, lng: -77.448 }, // Washington DC
  JFK: { lat: 40.6413, lng: -73.7781 }, // New York
  LAX: { lat: 33.9416, lng: -118.4085 }, // Los Angeles
  MIA: { lat: 25.7959, lng: -80.287 }, // Miami
  ORD: { lat: 41.9742, lng: -87.9073 }, // Chicago
  PHX: { lat: 33.4352, lng: -112.0101 }, // Phoenix
  SEA: { lat: 47.4502, lng: -122.3088 }, // Seattle
  SFO: { lat: 37.6213, lng: -122.379 }, // San Francisco
  YTO: { lat: 43.8561, lng: -79.337 }, // Toronto
  YUL: { lat: 45.4707, lng: -73.7407 }, // Montreal

  // South America
  GRU: { lat: -23.4357, lng: -46.4731 }, // São Paulo
  QRO: { lat: 20.6219, lng: -100.185 }, // Querétaro
  SCL: { lat: -33.3928, lng: -70.7857 }, // Santiago
};

export const processLogs = (logs: LogEntry[]): ProcessedData => {
  if (!logs || logs.length === 0) {
    return {
      totalRequests: null,
      uniqueVisitors: null,
      dataTransferred: null,
      timeRange: null,
      visitorsOverTime: null,
      geoDistribution: null,
      topPaths: null,
      topReferers: null,
      topUserAgents: null,
      statusCodes: null,
      browserDistribution: null,
      edgeLocations: null,
    };
  }

  const uniqueIPs = new Set<string>();
  let totalBytes = 0;
  const timeData: Record<string, number> = {};
  const timeStatusData: Record<string, Record<string, number>> = {};
  const locationData: Record<string, number> = {};
  const pathData: Record<string, number> = {};
  const refererData: Record<string, number> = {};
  const userAgentData: Record<string, number> = {};
  const edgeLocationData: Record<string, number> = {};
  const browserData: Record<string, number> = {};
  const statusData: Record<string, number> = {};

  let minTime = new Date(`${logs[0].date}T${logs[0].time}`);
  let maxTime = new Date(`${logs[0].date}T${logs[0].time}`);

  logs.forEach((log) => {
    uniqueIPs.add(log["c-ip"]);
    totalBytes += log["sc-bytes"];

    const time = new Date(`${log.date}T${log.time}`);
    minTime = time < minTime ? time : minTime;
    maxTime = time > maxTime ? time : maxTime;
    const hourKey = time.toISOString().slice(0, 13) + ":00";

    if (!timeData[hourKey]) {
      timeData[hourKey] = 0;
      timeStatusData[hourKey] = {};
    }

    timeData[hourKey]++;

    const statusGroup = `${Math.floor(log["sc-status"] / 100)}xx`;
    timeStatusData[hourKey][statusGroup] =
      (timeStatusData[hourKey][statusGroup] || 0) + 1;

    const locationCode = log["x-edge-location"].substring(0, 3);
    locationData[locationCode] = (locationData[locationCode] || 0) + 1;

    edgeLocationData[log["x-edge-location"]] =
      (edgeLocationData[log["x-edge-location"]] || 0) + 1;

    pathData[log["cs-uri-stem"]] = (pathData[log["cs-uri-stem"]] || 0) + 1;

    const referer = log["cs(Referer)"] || "(Direct)";
    refererData[referer] = (refererData[referer] || 0) + 1;

    userAgentData[log["cs(User-Agent)"]] =
      (userAgentData[log["cs(User-Agent)"]] || 0) + 1;

    let browser = "Other";
    const userAgent = log["cs(User-Agent)"];
    if (userAgent?.includes("Chrome")) browser = "Chrome";
    else if (userAgent?.includes("Firefox")) browser = "Firefox";
    else if (userAgent?.includes("Safari")) browser = "Safari";
    else if (userAgent?.includes("Edge")) browser = "Edge";
    browserData[browser] = (browserData[browser] || 0) + 1;

    const statusKey = `${statusGroup}`;
    statusData[statusKey] = (statusData[statusKey] || 0) + 1;
  });

  const timeKeys = Object.keys(timeData).sort();

  const statusGroups = ["2xx", "3xx", "4xx", "5xx"];
  const timeSeriesByStatus: Record<string, number[]> = {};
  statusGroups.forEach((group) => {
    timeSeriesByStatus[group] = timeKeys.map(
      (timeKey) => timeStatusData[timeKey][group] || 0,
    );
  });

  const sortByCount = (obj: Record<string, number>): [string[], number[]] => {
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return [entries.map((e) => e[0]), entries.map((e) => e[1])];
  };

  const [paths, pathCounts] = sortByCount(pathData);
  const [referers, refererCounts] = sortByCount(refererData);
  const [userAgents, userAgentCounts] = sortByCount(userAgentData);
  const [edgeLocations, edgeLocationCounts] = sortByCount(edgeLocationData);
  const [browsers, browserCounts] = sortByCount(browserData);
  const [codes, codeCounts] = sortByCount(statusData);

  const geoData: GeoData[] = Object.entries(locationData)
    .map(([code, count]) => {
      // Try to match the first three characters of the edge location code
      // Some edge locations might have additional numbers (e.g., ATH50-C1)
      const baseCode = code
        .replace(/[0-9-]/g, "")
        .substring(0, 3)
        .toUpperCase();
      const coords = edgeLocationCoordinates[baseCode];

      if (!coords) {
        console.warn(
          `No coordinates found for edge location: ${code} (base: ${baseCode})`,
        );
      }

      return {
        location: code,
        lat: coords?.lat || 0,
        lng: coords?.lng || 0,
        count,
      };
    })
    .filter((data) => data.lat !== 0 && data.lng !== 0); // Filter out any locations without coordinates

  return {
    totalRequests: logs.length,
    uniqueVisitors: uniqueIPs.size,
    dataTransferred: totalBytes,
    timeRange: {
      start: minTime.toISOString(),
      end: maxTime.toISOString(),
    },
    visitorsOverTime: {
      time: timeKeys,
      visitors: timeKeys.map((k) => timeData[k]),
      byStatus: timeSeriesByStatus,
    },
    geoDistribution: {
      locations: geoData,
      total: Object.values(locationData).reduce((a, b) => a + b, 0),
    },
    topPaths: {
      paths: paths.slice(0, 10),
      counts: pathCounts.slice(0, 10),
    },
    topReferers: {
      referers: referers.slice(0, 10),
      counts: refererCounts.slice(0, 10),
    },
    topUserAgents: {
      userAgents: userAgents.slice(0, 10),
      counts: userAgentCounts.slice(0, 10),
    },
    edgeLocations: {
      locations: edgeLocations.slice(0, 10),
      counts: edgeLocationCounts.slice(0, 10),
    },
    browserDistribution: {
      browsers,
      counts: browserCounts,
    },
    statusCodes: {
      codes,
      counts: codeCounts,
    },
  };
};
