const width = 900;
const height = 700;
const legendWidth = 230;
const legendHeight = 15;

const svg = d3.select("#chart");

// load datasets
Promise.all([
  d3.csv("data/lau_points_values.csv", (d) => ({
    geo_code: d.geo_code,
    average: +d.average,
    x: +d.x,
    y: +d.y,
  })),
  d3.json("data/lau_boundaries.geojson"),
]).then(([csvData, geoData]) => {
  // project grid coordinates to screen space
  const xExtent = d3.extent(csvData, (d) => d.x);
  const yExtent = d3.extent(csvData, (d) => d.y);

  const xScale = d3
    .scaleLinear()
    .domain(xExtent)
    .range([50, width - 50]);
  const yScale = d3
    .scaleLinear()
    .domain(yExtent)
    .range([height - 50, 50]);

  csvData.forEach((d) => {
    d.px = xScale(d.x);
    d.py = yScale(d.y);
  });

  // boundaries
  const boundariesGroup = svg
    .append("g")
    .attr("class", "boundaries")
    .attr("transform", "translate(0, 150)");

  const projection = d3.geoTransform({
    point: function (x, y) {
      this.stream.point(xScale(x), yScale(y));
    },
  });

  const path = d3.geoPath().projection(projection);

  const defs_shadows = svg.append("defs");

  const dropShadow = defs_shadows
    .append("filter")
    .attr("id", "boundary-shadow")
    .attr("filterUnits", "userSpaceOnUse");

  dropShadow
    .append("feOffset")
    .attr("dx", 1.5)
    .attr("dy", 1.5)
    .attr("in", "SourceAlpha")
    .attr("result", "offset");

  dropShadow
    .append("feGaussianBlur")
    .attr("in", "offset")
    .attr("stdDeviation", 2)
    .attr("result", "blur");

  dropShadow
    .append("feFlood")
    .attr("flood-color", "#000")
    .attr("flood-opacity", 0.6)
    .attr("result", "color");

  dropShadow
    .append("feComposite")
    .attr("in", "color")
    .attr("in2", "blur")
    .attr("operator", "in")
    .attr("result", "shadow");

  dropShadow
    .append("feMerge")
    .selectAll("feMergeNode")
    .data(["shadow", "SourceGraphic"])
    .enter()
    .append("feMergeNode")
    .attr("in", (d) => d);
    
  boundariesGroup
    .selectAll("path")
    .data(geoData.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#7c7c7cff")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#boundary-shadow)");

  // create hexbin
  const hexbin = d3
    .hexbin()
    .x((d) => d.px)
    .y((d) => d.py)
    .radius(4.5)
    .extent([
      [0, 0],
      [width, height],
    ]);

  const bins = hexbin(csvData);

  // color scale
  max_color_value = 0.225;

  const color = d3
    .scaleSequential()
    .domain([0.013, max_color_value])
    .interpolator(d3.interpolateViridis);

  // hexagons
  const hexGroup = svg
    .append("g")
    .attr("class", "hexagons")
    .attr("transform", "translate(0, 150)");

  const hexPaths = hexGroup
    .selectAll(".hex")
    .data(bins)
    .join("path")
    .attr("class", "hex")
    .attr("d", hexbin.hexagon())
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .attr("fill", (d) => {
      const mean = d3.mean(d, (p) => p.average);
      return color(mean);
    })
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .attr("opacity", 1);

  // tooltip
  hexPaths.append("title").text((d) => {
    const mean = d3.mean(d, (p) => p.average);
    return `Mean value: ${mean.toFixed(2)}`;
  });

  // legend
  const legendX = width / 2 - legendWidth / 2;
  const legendY = 150;

  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  const defs = svg.append("defs");
  const linearGradient = defs
    .append("linearGradient")
    .attr("id", "legend-gradient");

  const numStops = 10;
  for (let i = 0; i <= numStops; i++) {
    linearGradient
      .append("stop")
      .attr("offset", `${(i / numStops) * 100}%`)
      .attr(
        "stop-color",
        color(0.0 + ((max_color_value - 0.0) * i) / numStops)
      );
  }

  legend
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)")
    .style("stroke", "#f7f7f7")
    .style("stroke-width", 1);

  const legendScale = d3
    .scaleLinear()
    .domain([0.0, max_color_value])
    .range([0, legendWidth]);

  const legendAxis = d3
    .axisBottom(legendScale)
    .ticks(5)
    .tickSizeInner(-legendHeight)
    .tickSizeOuter(0)
    .tickFormat((d) => d3.format(".0f")(d * 100));

  legend
    .append("g")
    .attr("transform", `translate(0, ${legendHeight})`)
    .call(legendAxis)
    .selectAll("text")
    .attr("dy", "1.0em");

  legend
    .append("text")
    .attr("class", "legendText")
    .attr("x", 0)
    .attr("y", -8)
    .attr("text-anchor", "left")
    .text("15-29 age group as % of total population");

  // title
  svg
    .append("text")
    .attr("class", "map-title")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", 80)
    .append("tspan")
    .text("Greek youth have left Epirus")
    .style("fill", "#373737ff");

  // subtitle
  svg
    .append("text")
    .attr("class", "map-subtitle")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", 107.5)
    .text("Moving to urban, tourist or military locations")
    .style("fill", "#373737ff");

  // Add footnote
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", 0)
    .attr("y", height + 160)
    .attr("class", "referenceText")
    .selectAll("tspan")
    .data([
      {
        text: "Source: ELSTAT - Permanent population by age group and marital status. Municipal communities, 2021",
        url: "https://www.statistics.gr/el/statistics/-/publication/SAM03/-",
      },
    ])
    .enter()
    .append("a")
    .attr("xlink:href", (d) => d.url)
    // Open the link in a new tab
    .attr("target", "_blank")
    .append("tspan")
    .attr("x", (d, i) => width / 2 + i * 10)
    .attr("dy", "1.4em")
    .text((d) => d.text);
});
