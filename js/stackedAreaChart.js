class StackedAreaChart {

    /**
     * Class constructor with initial configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1000,
            containerHeight: _config.containerHeight || 300,
            margin: _config.margin || {top: 25, right: 12, bottom: 30, left: 35},
            displayType: 'absolute',
            xDomain: _config.xDomain,
            legendWidth: 170,
            legendHeight: 8,
            legendRadius: 5,
        };
        this.data = _data;
        this.initVis();
    }

    /**
     * Create scales, axes, and append static elements
     */
    initVis() {
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Initialize scales for focus view
        // Dates binned by year on x axis, which is a number, so xScale is scaleLinear
        vis.xScale = d3.scaleLinear()
            .domain(vis.config.xDomain)
            .range([0, vis.width/1.2]);

        // yScale is continuous range of counts so scaleLinear
        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // keys for stacked data
        vis.keys = ['mischief', 'break-in', 'theft', 'offence', 'vehicle-accident'];

        // Stack data
        vis.stack = d3.stack()
            .keys(vis.keys);

        // color palette
        vis.colorScale = d3.scaleOrdinal()
            .domain(vis.data.map(d => d.typeGeneral))
            .range(['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00']);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickFormat(d3.format('d'));

        vis.yAxis = d3.axisLeft(vis.yScale);

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        // Append group element that will contain our actual chart (see margin convention)
        vis.chartContainer = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Empty group for the legend
        vis.legend = vis.chartContainer.append('g')
            .attr('transform', `translate(0,${-vis.config.margin.top + vis.config.legendHeight})`);

        // Append empty x-axis group and move it to the bottom of the chart
        vis.xAxisG = vis.chartContainer.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        // Append y-axis group
        vis.yAxisG = vis.chartContainer.append('g')
            .attr('class', 'axis y-axis');

        // Initialize clipping mask that covers the whole chart
        vis.chartContainer.append('defs')
            .append('clipPath')
            .attr('id', 'chart-mask')
            .append('rect')
            .attr('width', vis.width/1.2)
            .attr('y', -vis.config.margin.top)
            .attr('height', vis.config.containerHeight);

        // Apply clipping mask to 'vis.chartContainer' to clip
        vis.chart = vis.chartContainer.append('g')
            .attr('clip-path', 'url(#chart-mask)');

        // Add static axis labels
        vis.axisTitle = vis.chartContainer.append('text')
            .attr('class', 'axis-label')
            .attr('y', -18)
            .attr('x', -25)
            .attr('dy', '0.35em')
            .text('Crime Level');

        vis.axisTitle = vis.chartContainer.append('text')
            .attr('class', 'axis-label')
            .attr('y', vis.height + vis.config.margin.bottom)
            .attr('x', vis.width/1.2 - vis.config.margin.top)
            .text('Year');

        vis.renderLegend();
        vis.updateVis();
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        // Group the data per year (we get a nested array)
        // [[2013, [array with values]], [2014, [array with values]], ...]
        vis.groupedData = d3.groups(vis.data, d => d.YEAR);

        // Prepare the data for rendering
        if (vis.config.displayType === 'absolute') {
            vis.stack.value((d,key) => {
                // Calculate total number of each type of crime, per year
                const yearSum = d3.count(d[1].filter(row => row.typeGeneral === key), d => d.typeGeneral === key);

                // Set total number of each type of crime (as key) for each year group
                d[1][key] = yearSum;
                return d[1][key]});
        } else {
            // Calculate relative contribution (in %) of each crime category per year
            // 1. loop through years
            vis.groupedData.forEach(g => {
                // 2. Count of crimes in current year
                const yearSum = d3.rollups(g[1], v => v.length);

                // 3. Get percentage of each crime category
                // Rollup data based on aggregated crime type for that year
                const crimeRollupData = d3.rollups(g[1], v => v.length, d => d.typeGeneral);

                crimeRollupData.forEach(crime => {
                    g[1][crime[0]] = crime[0];

                    // Must create empty object first for nested objects, then set property and value
                    g[1][crime[0]] = {};
                    g[1][crime[0]]['n_relative'] = crime[1]/yearSum*100;
                })
            });

            vis.stack.value((d,key) => d[1][key]['n_relative']);
        }

        // Call stack generator on the dataset
        vis.stackedData = vis.stack(vis.groupedData);

        // Initialize area generator
        vis.area = d3.area()
            .x(d => vis.xScale(d.data[0]))
            .y0(d => vis.yScale(d[0]))
            .y1(d => vis.yScale(d[1]))
            .curve(d3.curveStepAfter);

        if (vis.config.displayType === 'absolute') {
            vis.yScale.domain([0, d3.max(vis.stackedData[vis.stackedData.length - 1], d => d[1])]);
            vis.yAxis.tickFormat(d => d/1000);
        } else {
            vis.yScale.domain([0, 100]);
            vis.yAxis.tickFormat(d => `${d}%`);
        }

        vis.renderVis();
    }

    /**
     * Bind data to visual elements.
     */
    renderVis() {
        let vis = this;

        // Add focus area path
        vis.focusAreas = vis.chart.selectAll('.area-path')
                .data(vis.stackedData)
            .join('path')
                .attr('class', d => 'area-path ' + 'layer-' + d.key)
                .attr('fill', d => vis.colorScale(d.key))
                .style('opacity', 0.9);

        // Based on if brushing or other transitions (filtering by crime type or going from absolute to relative levels)
        // Have to draw area paths with transitions or not (brushed doesn't detect transitions in this way)
        if (isBrushed) {
            vis.focusAreas.attr('d', vis.area);
        } else {
            vis.focusAreas.transition().duration(700).attr('d', vis.area);
        }

        // Update the axes/grid lines by calling axis functions
        // Second call removes axis lines and shows only grid lines
        vis.xAxisG
            .transition()
            .duration(1000)
            .call(vis.xAxis)
            .call(g => g.select('.domain').remove());

        vis.yAxisG
            .transition()
            .duration(1000)
            .call(vis.yAxis)
            .call(g => g.select('.domain').remove());
    }

    /**
     * Render interactive legend
     */
    renderLegend() {
        let vis = this;

        // 1. Add coloured points for each crime category
        vis.legend.append('circle')
            .attr('class', 'legend-element vehicle-accident')
            .attr('cx', vis.width/1.15)
            .attr('cy', vis.config.legendHeight*2 + vis.config.legendHeight*11)
            .attr('r', vis.config.legendRadius)
            .attr('fill', '#ff7f00');

        vis.legend.append('circle')
            .attr('class', 'legend-element offence')
            .attr('cx', vis.width/1.15)
            .attr('cy', vis.config.legendHeight*2 + vis.config.legendHeight*14)
            .attr('r', vis.config.legendRadius)
            .attr('fill', '#984ea3');

        vis.legend.append('circle')
            .attr('class', 'legend-element theft')
            .attr('cx', vis.width/1.15)
            .attr('cy', vis.config.legendHeight*2 + vis.config.legendHeight*17)
            .attr('r', vis.config.legendRadius)
            .attr('fill', '#e41a1c');

        vis.legend.append('circle')
            .attr('class', 'legend-element break-in')
            .attr('cx', vis.width/1.15)
            .attr('cy', vis.config.legendHeight*2 + vis.config.legendHeight*20)
            .attr('r', vis.config.legendRadius)
            .attr('fill', '#377eb8');

        vis.legend.append('circle')
            .attr('class', 'legend-element mischief')
            .attr('cx', vis.width/1.15)
            .attr('cy', vis.config.legendHeight*2 + vis.config.legendHeight*23)
            .attr('r', vis.config.legendRadius)
            .attr('fill', '#4daf4a');

        // 2. Add legend text for each crime category circle
        vis.legend.append('text')
            .attr('class', 'legend-label vehicle-accident')
            .attr('x', vis.width/1.15 + vis.config.margin.right)
            .attr('y', vis.config.legendHeight*2 + vis.config.legendHeight*11 + vis.config.legendRadius/2)
            .style('fill', '#ff7f00')
            .text('Vehicle Accident');

        vis.legend.append('text')
            .attr('class', 'legend-label offence')
            .attr('x', vis.width/1.15 + vis.config.margin.right)
            .attr('y', vis.config.legendHeight*2 + vis.config.legendHeight*14 + vis.config.legendRadius/2)
            .style('fill', '#984ea3')
            .text('Offence');

        vis.legend.append('text')
            .attr('class', 'legend-label theft')
            .attr('x', vis.width/1.15 + vis.config.margin.right)
            .attr('y', vis.config.legendHeight*2 + vis.config.legendHeight*17 + vis.config.legendRadius/2)
            .style('fill', '#e41a1c')
            .text('Theft');

        vis.legend.append('text')
            .attr('class', 'legend-label break-in')
            .attr('x', vis.width/1.15 + vis.config.margin.right)
            .attr('y', vis.config.legendHeight*2 + vis.config.legendHeight*20 + vis.config.legendRadius/2)
            .style('fill', '#377eb8')
            .text('Break In');

        vis.legend.append('text')
            .attr('class', 'legend-label mischief')
            .attr('x', vis.width/1.15 + vis.config.margin.right)
            .attr('y', vis.config.legendHeight*2 + vis.config.legendHeight*23 + vis.config.legendRadius/2)
            .style('fill', '#4daf4a')
            .text('Mischief');

        // 3. Get grouped data by category for hover highlight and order according to legend order
        const orderedKeys = ['vehicle-accident', 'offence', 'theft', 'break-in', 'mischief'];
        vis.groupedCategories = d3.groups(vis.data, d => d.typeGeneral);
        vis.groupedCategories = vis.groupedCategories.sort((a,b) => {
            return orderedKeys.indexOf(a[0]) - orderedKeys.indexOf(b[0]);
        });

        // 4. On hover, show only on hover legend crime category later in stacked bar chart
        vis.legend.selectAll('.legend-label')
            .data(vis.groupedCategories)
            .on('mouseover', (event, d) => {
                // reduce opacity of all groups
                d3.selectAll('.area-path').style('opacity', .1);
                // except the one that is hovered
                d3.select('.layer-'+d[0]).style('opacity', 1);
            })
            .on('mouseleave', () => {
                d3.selectAll('.area-path').style('opacity', 0.9);
            });

        vis.legend.selectAll('.legend-element')
            .data(vis.groupedCategories)
            .on('mouseover', (event, d) => {
                // reduce opacity of all groups
                d3.selectAll('.area-path').style('opacity', .1);
                // except the one that is hovered
                d3.select('.layer-'+d[0]).style('opacity', 1);
            })
            .on('mouseleave', () => {
                d3.selectAll('.area-path').style('opacity', 0.9);
            });
    }
}