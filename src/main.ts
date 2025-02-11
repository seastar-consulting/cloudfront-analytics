import "./style.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import * as Plotly from "plotly.js-dist-min";
import * as L from "leaflet";
import "leaflet.markercluster";
import { ProcessedData } from "./types/dashboard";
import { processLogs, formatBytes, formatNumber } from "./utils/dataProcessing";
import Fuse from "fuse.js";
import Papa from "papaparse";

let rawData: any = { logs: [] }; // Initialize with empty logs
let fuse: Fuse<any> | null = null;
let map: L.Map;
let markers: L.MarkerClusterGroup;
let maxCount: number = 0;

interface CustomCircleMarkerOptions extends L.CircleMarkerOptions {
  count: number;
}

// Initialize Plotly with configuration
Plotly.setPlotConfig({
  displaylogo: false,
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
});

async function initDashboard() {
  try {
    console.log("Initializing dashboard...");
    // Verify Plotly is loaded
    console.log("Plotly version:", Plotly.version);

    // Initialize empty map
    initMap();
    // Initialize empty search
    initSearch();
    // Initialize empty visualizations with empty data
    const emptyData = processLogs([]);
    console.log("Initializing with empty data:", emptyData);
    updateVisualizations(emptyData);
  } catch (error) {
    console.error("Error initializing dashboard:", error);
  }
}

function initMap() {
  // Initialize the map
  map = L.map("map").setView([20, 0], 2);

  // Add tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: " OpenStreetMap contributors",
  }).addTo(map);

  // Initialize marker cluster group
  markers = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true,
    iconCreateFunction: function (cluster) {
      const childMarkers = cluster.getAllChildMarkers();
      const totalRequests = childMarkers.reduce(
        (sum, marker) =>
          sum + (marker.options as CustomCircleMarkerOptions).count,
        0,
      );

      // Calculate size class based on total requests
      const size = Math.min(
        70,
        Math.max(40, Math.sqrt(totalRequests / maxCount) * 60),
      );

      return L.divIcon({
        html: `<div style="
          width: ${size}px;
          height: ${size}px;
          background-color: #3388ff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          opacity: 0.7;
        ">${formatNumber(totalRequests)}</div>`,
        className: "marker-cluster",
        iconSize: L.point(size, size),
      });
    },
  });

  // Add marker cluster group to map
  map.addLayer(markers);
}

function updateMap(data: ProcessedData) {
  // Update map with geo distribution data
  if (data.geoDistribution) {
    // Update maxCount for both individual markers and clusters
    maxCount = Math.max(
      ...data.geoDistribution.locations.map((loc) => loc.count)
    );

    // Clear existing markers
    if (markers) {
      map.removeLayer(markers);
    }

    // Create new marker cluster group with updated maxCount
    markers = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function (cluster) {
        const childMarkers = cluster.getAllChildMarkers();
        const totalRequests = childMarkers.reduce(
          (sum, marker) =>
            sum + (marker.options as CustomCircleMarkerOptions).count,
          0
        );

        // Calculate size class based on total requests
        const size = Math.min(
          70,
          Math.max(40, Math.sqrt(totalRequests / maxCount) * 60)
        );

        return L.divIcon({
          html: `<div style="
            width: ${size}px;
            height: ${size}px;
            background-color: #3388ff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            opacity: 0.7;
          ">${formatNumber(totalRequests)}</div>`,
          className: "marker-cluster",
          iconSize: L.point(size, size),
        });
      },
    });

    data.geoDistribution.locations.forEach((location) => {
      const circle = L.circleMarker([location.lat, location.lng], {
        color: "#3388ff",
        fillColor: "#3388ff",
        fillOpacity: 0.5,
        radius: Math.sqrt(location.count / maxCount) * 20,
        count: location.count,
      } as CustomCircleMarkerOptions);

      circle.bindPopup(`
        <strong>${location.location}</strong><br>
        Requests: ${formatNumber(location.count)}
      `);
      markers.addLayer(circle);
    });
    map.addLayer(markers);
  }
}

function initSearch() {
  const searchInput = document.querySelector(
    "#search-input",
  ) as HTMLInputElement;
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    if (!fuse || !rawData) return; // Don't search if no data is loaded

    const query = (e.target as HTMLInputElement).value;
    if (!query) {
      updateVisualizations(processLogs(rawData.logs));
      return;
    }

    const results = fuse.search(query);
    const filteredLogs = results.map((result) => result.item);
    updateVisualizations(processLogs(filteredLogs));
  });
}

function updateVisualizations(data: ProcessedData) {
  console.log("Updating visualizations with data:", data);

  try {
    // Update in specific order to ensure proper rendering
    createCharts(data);
    updateMap(data);
    updateStats(data);
  } catch (error) {
    console.error("Error updating visualizations:", error);
  }
}

function updateStats(data: ProcessedData) {
  const statElements: {
    [key: string]: {
      value: any;
      format: (v: any) => string;
    };
  } = {
    "total-requests": {
      value: data.totalRequests,
      format: (v: number | null) => v?.toLocaleString() || "No data",
    },
    "unique-visitors": {
      value: data.uniqueVisitors,
      format: (v: number | null) => v?.toLocaleString() || "No data",
    },
    "data-transferred": {
      value: data.dataTransferred,
      format: formatBytes,
    },
    "time-range": {
      value: data.timeRange,
      format: (v: number | { start: string; end: string } | null) => {
        if (v === null) return "No data";
        if (typeof v === "object" && "start" in v) {
          return `${new Date(v.start).toLocaleDateString()} - ${new Date(v.end).toLocaleDateString()}`;
        }
        return v.toString();
      },
    },
  };

  Object.entries(statElements).forEach(([id, { value, format }]) => {
    const element = document.querySelector(`#${id}`);
    console.log(`Updating element #${id}:`, {
      value,
      formatted: format(value),
      element: element?.outerHTML,
    });
    if (element) {
      element.textContent = format(value);
    }
  });
}

function createCharts(data: ProcessedData) {
  console.log("Creating charts with data:", data);

  // Verify chart containers exist
  const chartIds = [
    "visitorsTime",
    "topPaths",
    "topReferers",
    "topUserAgents",
    "edgeLocations",
    "browserDistribution",
    "statusCodes",
  ];

  const missingElements = chartIds.filter((id) => !document.getElementById(id));
  if (missingElements.length > 0) {
    console.error("Missing chart containers:", missingElements);
    return;
  }

  // Clear any existing charts first
  chartIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      try {
        Plotly.purge(element);
      } catch (error) {
        console.error(`Error purging chart ${id}:`, error);
      }
    }
  });

  if (!data || data.totalRequests === null) {
    console.log("No data available, showing placeholders");

    chartIds.forEach((chartId) => {
      const element = document.getElementById(chartId);
      console.log(`Creating placeholder for #${chartId}:`, element?.outerHTML);
      if (element) {
        try {
          Plotly.newPlot(
            element,
            [
              {
                type: "scatter",
                x: [0],
                y: [0],
                mode: 'text',
                text: ['No data available'],
                textposition: 'middle center',
                showlegend: false
              },
            ],
            {
              title: "No data available",
              xaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-1, 1]
              },
              yaxis: {
                showgrid: false,
                zeroline: false,
                showticklabels: false,
                range: [-1, 1]
              },
              hovermode: false,
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)'
            },
            {
              displayModeBar: false
            }
          );
        } catch (error) {
          console.error(`Error creating placeholder for ${chartId}:`, error);
        }
      }
    });
    return;
  }

  // Visitors over time with status codes
  console.log("Creating time series chart with data:", data.visitorsOverTime);
  if (data.visitorsOverTime) {
    const statusColors: Record<string, string> = {
      "2xx": "#2ecc71", // Green for success
      "3xx": "#3498db", // Blue for redirect
      "4xx": "#e74c3c", // Red for client error
      "5xx": "#9b59b6", // Purple for server error
    };

    const timeSeriesData = Object.entries(data.visitorsOverTime.byStatus).map(
      ([status, counts]) => {
        const visitorsOverTime = data.visitorsOverTime!;  // We know it's not null here
        return {
          x: visitorsOverTime.time,
          y: counts,
          name: status,
          type: "bar",
          marker: { color: statusColors[status] },
        };
      }
    );

    try {
      Plotly.newPlot("visitorsTime", timeSeriesData, {
        title: {
          text: "Request Volume Over Time",
          font: {
            size: 20,
          },
        },
        barmode: "stack",
        xaxis: {
          title: "Time",
          type: "date",
        },
        yaxis: {
          title: "Number of Requests",
        },
        showlegend: true,
        legend: {
          title: { text: "Status Codes" },
          orientation: "h",
          y: -0.2,
        },
      });
    } catch (error) {
      console.error("Error creating time series chart:", error);
    }
  }

  // Top paths chart
  if (data.topPaths) {
    try {
      Plotly.newPlot(
        "topPaths",
        [
          {
            x: data.topPaths.counts,
            y: data.topPaths.paths,
            type: "bar",
            orientation: "h",
            name: "Requests",
          },
        ],
        {
          title: {
            text: "Most Requested URLs",
            font: { size: 20 },
          },
          margin: { l: 150 },
          xaxis: { title: "Number of Requests" },
        },
      );
    } catch (error) {
      console.error("Error creating top paths chart:", error);
    }
  }

  // Top referers chart
  if (data.topReferers) {
    try {
      Plotly.newPlot(
        "topReferers",
        [
          {
            x: data.topReferers.counts,
            y: data.topReferers.referers,
            type: "bar",
            orientation: "h",
            name: "Requests",
          },
        ],
        {
          title: {
            text: "Top Referrers",
            font: { size: 20 },
          },
          margin: { l: 150 },
          xaxis: { title: "Number of Requests" },
        },
      );
    } catch (error) {
      console.error("Error creating top referers chart:", error);
    }
  }

  // Top user agents chart
  if (data.topUserAgents) {
    try {
      Plotly.newPlot(
        "topUserAgents",
        [
          {
            x: data.topUserAgents.counts,
            y: data.topUserAgents.userAgents,
            type: "bar",
            orientation: "h",
            name: "Requests",
          },
        ],
        {
          title: {
            text: "Top User Agents",
            font: { size: 20 },
          },
          margin: { l: 150 },
          xaxis: { title: "Number of Requests" },
        },
      );
    } catch (error) {
      console.error("Error creating top user agents chart:", error);
    }
  }

  // Edge locations chart
  if (data.edgeLocations) {
    try {
      Plotly.newPlot(
        "edgeLocations",
        [
          {
            x: data.edgeLocations.counts,
            y: data.edgeLocations.locations,
            type: "bar",
            orientation: "h",
            name: "Requests",
          },
        ],
        {
          title: {
            text: "Edge Location Distribution",
            font: { size: 20 },
          },
          margin: { l: 150 },
          xaxis: { title: "Number of Requests" },
        },
      );
    } catch (error) {
      console.error("Error creating edge locations chart:", error);
    }
  }

  // Browser distribution pie chart
  if (data.browserDistribution) {
    try {
      Plotly.newPlot(
        "browserDistribution",
        [
          {
            type: "pie",
            labels: data.browserDistribution.browsers,
            values: data.browserDistribution.counts,
            name: "Browsers",
          },
        ],
        {
          title: {
            text: "Browser Distribution",
            font: {
              size: 20,
            },
          },
        },
      );
    } catch (error) {
      console.error("Error creating browser distribution chart:", error);
    }
  }

  // Status codes pie chart
  if (data.statusCodes) {
    try {
      Plotly.newPlot(
        "statusCodes",
        [
          {
            type: "pie",
            labels: data.statusCodes.codes,
            values: data.statusCodes.counts,
            name: "Status Codes",
          },
        ],
        {
          title: {
            text: "HTTP Status Codes",
            font: {
              size: 20,
            },
          },
        },
      );
    } catch (error) {
      console.error("Error creating status codes chart:", error);
    }
  }
}

function parseCSV(csvText: string) {
  try {
    const result = Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      transformHeader: (header: string) => {
        // Convert escaped parentheses in field names
        return header.replace(/\\([()])/g, "$1");
      },
      skipEmptyLines: true,
    });

    if (result.errors && result.errors.length > 0) {
      console.warn("CSV parsing had some errors:", result.errors);
    }

    return {
      logs: result.data,
      metadata: {
        fetchedAt: new Date().toISOString(),
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error parsing CSV:", error);
    throw new Error("Failed to parse CSV file");
  }
}

function handleFileUpload(file: File) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      if (e.target?.result) {
        if (file.type === "application/json") {
          rawData = JSON.parse(e.target.result as string);
        } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
          rawData = parseCSV(e.target.result as string);
        }

        if (!rawData || !rawData.logs) {
          throw new Error("Invalid file format: missing logs data");
        }

        const data = processLogs(rawData.logs);
        console.log("Processed data:", data);

        // Initialize Fuse.js search with new data
        fuse = new Fuse(rawData.logs, {
          keys: [
            "cs-uri-stem",
            "cs(User-Agent)",
            "cs(Referer)",
            "x-edge-location",
          ],
          threshold: 0.4,
          ignoreLocation: true,
          minMatchCharLength: 1,
          shouldSort: true,
          includeScore: true,
        });

        // Update all visualizations at once
        updateVisualizations(data);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      alert(
        "Error processing file. Please make sure it's in the correct format.",
      );
    }
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing...");
  initDashboard();

  const initialDropZone = document.querySelector(".drop-zone.initial");
  const dragoverZone = document.querySelector(".drop-zone.dragover-zone");
  const dashboard = document.querySelector(".dashboard");
  const fileButton = document.querySelector(".drop-zone-button");
  const floatingButton = document.querySelector(".floating-upload");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,.csv";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  // Handle file selection via buttons
  fileButton?.addEventListener("click", () => {
    fileInput.click();
  });

  floatingButton?.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      handleFileUpload(target.files[0]);
      initialDropZone?.classList.remove("initial");
      dashboard?.classList.remove("blurred");
    }
  });

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Handle drag enter/leave visual feedback
  let dragCounter = 0;
  
  document.body.addEventListener("dragenter", (e) => {
    preventDefaults(e);
    dragCounter++;
    if (dragCounter === 1) {
      if (initialDropZone?.classList.contains("initial")) {
        initialDropZone?.classList.add("dragover");
      } else {
        dragoverZone?.classList.add("dragover");
      }
    }
  });

  document.body.addEventListener("dragover", (e) => {
    preventDefaults(e);
    if (dragCounter > 0) {
      if (initialDropZone?.classList.contains("initial")) {
        initialDropZone?.classList.add("dragover");
      } else {
        dragoverZone?.classList.add("dragover");
      }
    }
  });

  document.body.addEventListener("dragleave", (e) => {
    preventDefaults(e);
    dragCounter--;
    if (dragCounter === 0) {
      initialDropZone?.classList.remove("dragover");
      dragoverZone?.classList.remove("dragover");
    }
  });

  document.body.addEventListener("drop", (e) => {
    preventDefaults(e);
    dragCounter = 0;
    initialDropZone?.classList.remove("dragover");
    dragoverZone?.classList.remove("dragover");
    
    const dt = e.dataTransfer;
    if (dt?.files && dt.files[0]) {
      const file = dt.files[0];
      if (file.type === "application/json" || file.type === "text/csv" || file.name.endsWith(".csv")) {
        handleFileUpload(file);
        initialDropZone?.classList.remove("initial");
        dashboard?.classList.remove("blurred");
      } else {
        alert("Please drop a JSON or CSV file.");
      }
    }
  });

  function preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }
});
