export interface LogEntry {
  date: string;
  time: string;
  "x-edge-location": string;
  "sc-bytes": number;
  "c-ip": string;
  "cs-method": string;
  "cs-uri-stem": string;
  "sc-status": number;
  "cs(Referer)": string;
  "cs(User-Agent)": string;
}

export interface TimeSeriesData {
  time: string[];
  visitors: number[];
  byStatus: {
    [key: string]: number[]; // e.g., '2xx': [count1, count2, ...]
  };
}

export interface GeoData {
  location: string;
  lat: number;
  lng: number;
  count: number;
}

export interface ProcessedData {
  totalRequests: number | null;
  uniqueVisitors: number | null;
  dataTransferred: number | null;
  timeRange: {
    start: string;
    end: string;
  } | null;
  visitorsOverTime: TimeSeriesData | null;
  geoDistribution: {
    locations: GeoData[];
    total: number;
  } | null;
  topPaths: {
    paths: string[];
    counts: number[];
  } | null;
  topReferers: {
    referers: string[];
    counts: number[];
  } | null;
  topUserAgents: {
    userAgents: string[];
    counts: number[];
  } | null;
  edgeLocations: {
    locations: string[];
    counts: number[];
  } | null;
  browserDistribution: {
    browsers: string[];
    counts: number[];
  } | null;
  statusCodes: {
    codes: string[];
    counts: number[];
  } | null;
}
