class Timeline {

    /**
     * Class constructor with initial configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1000,
            containerHeight: _config.containerHeight || 100,
            margin: _config.margin || {top: 25, right: 12, bottom: 30, left: 35},
            xDomain: _config.xDomain,
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

        // Initialize scales for both focus and context views
        // Dates binned by year on x axis, which is a number, so xScale is scaleLinear
        vis.xScale = d3.scaleLinear()
            .domain(vis.config.xDomain)
            .range([0, vis.width/1.2]);

        // yScale is continuous range of counts so scaleLinear
        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickFormat(d3.format('d'));

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        // Append group element that will contain our actual chart (see margin convention)
        vis.chartContainer = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

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

        // Apply clipping mask to 'vis.chart' to clip
        vis.chart = vis.chartContainer.append('g')
            .attr('clip-path', 'url(#chart-mask)');

        // Initialize brush
        vis.brush = d3.brushX()
            .extent([[0, 0], [vis.width/1.2, vis.height]])
            .on('end', function(event) {
                isBrushed = true;

                const selection = event.selection;
                if (!event.sourceEvent) return;

                if (selection) brushed(selection);
                if (!selection) brushed(null);
            });

        // Call updateVis in main.js and not at the end of initVis to avoid brush render async issue
        // If not, then brush will be undefined
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        // Rollup the data per year (we get a nested array)
        // [[2013, count], [2014, count], ...]
        vis.rollupData = d3.rollups(vis.data, v => v.length, d => d.YEAR);

        vis.yScale.domain([0, d3.max(vis.rollupData, d => d[1])]);

        // SVG area path generator
        vis.area = d3.area()
            .x(d => vis.xScale(d[0]))
            .y0(vis.height)
            .y1(d => vis.yScale(d[1]));

        vis.renderVis();
    }

    /**
     * Bind data to visual elements.
     */
    renderVis() {
        let vis = this;

        // Add area path
        vis.chart.append('path')
            .datum(vis.rollupData)
            .attr('fill', '#00acc1')
            .attr('d', vis.area);

        const defaultSelection = [vis.xScale.range()[0], vis.xScale.range()[1]];

        // Append brush component here
        vis.brushG = vis.chart
            .attr('class', 'brush-context')
            .call(vis.brush)
            .call(vis.brush.move, defaultSelection);

        // Update the axes/grid lines by calling axis functions
        // Second call removes axis lines and shows only grid lines
        vis.xAxisG
            .call(vis.xAxis)
            .call(g => g.select('.domain').remove());
    }
}