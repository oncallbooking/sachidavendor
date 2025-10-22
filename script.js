// === Universal Chart Renderer ===
let chartInstance = null;
const chartContainer = document.getElementById("chartWrapper");

// sample fallback data
const dataExample = {
  labels: ["A", "B", "C", "D", "E"],
  values: [12, 19, 3, 5, 2],
};

// destroy existing chart
function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  const existingPlot = document.getElementById("mainChart");
  if (!existingPlot) {
    const div = document.createElement("canvas");
    div.id = "mainChart";
    chartContainer.innerHTML = "";
    chartContainer.appendChild(div);
  }
}

// update function
function updateChart() {
  const type = document.getElementById("chartTypeSelect").value;
  destroyChart();

  const ctx = document.getElementById("mainChart");
  const data = {
    labels: dataExample.labels,
    datasets: [
      {
        label: "Example Data",
        data: dataExample.values,
        backgroundColor: [
          "#36A2EB",
          "#FF6384",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
        ],
        borderWidth: 1,
      },
    ],
  };

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: `${type.toUpperCase()} Chart Example` },
    },
  };

  // === Chart.js charts ===
  switch (type) {
    case "bar":
    case "line":
    case "pie":
    case "doughnut":
    case "radar":
    case "polarArea":
      chartInstance = new Chart(ctx, { type, data, options: baseOptions });
      break;

    case "bubble":
      chartInstance = new Chart(ctx, {
        type: "bubble",
        data: {
          datasets: [
            {
              label: "Bubbles",
              data: [
                { x: 5, y: 10, r: 15 },
                { x: 8, y: 6, r: 10 },
                { x: 12, y: 4, r: 8 },
              ],
              backgroundColor: "rgba(54,162,235,0.6)",
            },
          ],
        },
        options: baseOptions,
      });
      break;

    case "scatter":
      chartInstance = new Chart(ctx, {
        type: "scatter",
        data: {
          datasets: [
            {
              label: "Scatter",
              data: [
                { x: 1, y: 3 },
                { x: 2, y: 6 },
                { x: 3, y: 4 },
              ],
              backgroundColor: "#FF6384",
            },
          ],
        },
        options: baseOptions,
      });
      break;

    case "area":
      chartInstance = new Chart(ctx, {
        type: "line",
        data,
        options: { ...baseOptions, elements: { line: { fill: true } } },
      });
      break;

    case "stackedBar":
      chartInstance = new Chart(ctx, {
        type: "bar",
        data,
        options: {
          ...baseOptions,
          scales: { x: { stacked: true }, y: { stacked: true } },
        },
      });
      break;

    case "horizontalBar":
      chartInstance = new Chart(ctx, {
        type: "bar",
        data,
        options: { ...baseOptions, indexAxis: "y" },
      });
      break;

    case "boxplot":
      chartInstance = new Chart(ctx, {
        type: "boxplot",
        data: {
          labels: ["Set 1", "Set 2"],
          datasets: [
            {
              label: "BoxPlot Example",
              data: [
                [1, 2, 3, 4, 5],
                [2, 3, 4, 5, 6],
              ],
              backgroundColor: "rgba(255,99,132,0.5)",
            },
          ],
        },
      });
      break;

    case "treemap":
      chartInstance = new Chart(ctx, {
        type: "treemap",
        data: {
          datasets: [
            {
              tree: dataExample.labels.map((l, i) => ({ x: l, v: dataExample.values[i] })),
              key: "v",
              backgroundColor: (c) =>
                c.raw.v > 10 ? "#36A2EB" : "#FF6384",
            },
          ],
        },
      });
      break;

    case "sankey":
      chartInstance = new Chart(ctx, {
        type: "sankey",
        data: {
          datasets: [
            {
              label: "Sankey",
              data: [
                { from: "A", to: "B", flow: 5 },
                { from: "B", to: "C", flow: 3 },
                { from: "A", to: "C", flow: 2 },
              ],
            },
          ],
        },
      });
      break;

    case "gauge":
      chartInstance = new Chart(ctx, {
        type: "gauge",
        data: {
          datasets: [
            {
              value: 70,
              data: [0, 100],
              backgroundColor: ["#4BC0C0"],
              borderWidth: 2,
            },
          ],
        },
      });
      break;

    // === Plotly Charts ===
    case "heatmap":
      renderPlotly("heatmap");
      break;
    case "funnel":
      renderPlotly("funnel");
      break;
    case "sunburst":
      renderPlotly("sunburst");
      break;
    case "violin":
      renderPlotly("violin");
      break;

    default:
      chartInstance = new Chart(ctx, { type: "bar", data, options: baseOptions });
  }
}

function renderPlotly(type) {
  chartContainer.innerHTML = '<div id="plotlyChart" style="width:100%;height:100%;"></div>';
  const div = document.getElementById("plotlyChart");

  switch (type) {
    case "heatmap":
      Plotly.newPlot(div, [{ z: [[1, 20, 30], [20, 1, 60], [30, 60, 1]], type: "heatmap" }]);
      break;
    case "funnel":
      Plotly.newPlot(div, [{
        type: "funnel",
        y: ["Visitors", "Signups", "Purchases"],
        x: [120, 80, 50]
      }]);
      break;
    case "sunburst":
      Plotly.newPlot(div, [{
        type: "sunburst",
        labels: ["Total", "North", "South", "East", "West"],
        parents: ["", "Total", "Total", "Total", "Total"],
        values: [100, 30, 25, 20, 25]
      }]);
      break;
    case "violin":
      Plotly.newPlot(div, [{
        type: "violin",
        y: [2, 3, 3, 4, 4, 5, 5, 6],
        box: { visible: true },
        meanline: { visible: true }
      }]);
      break;
  }
}

// Events
document.getElementById("updateChart").addEventListener("click", updateChart);
updateChart(); // initial load
