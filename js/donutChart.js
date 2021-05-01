class DonutChart {

    /**
     * Class constructor with initial configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 400,
            containerHeight: _config.containerHeight || 400,
            tooltipPadding: 15,
            margin: _config.margin || {top: 200, right: 12, bottom: 30, left: 200},
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

        vis.colorScale = d3.scaleOrdinal()
            .domain(vis.data.map(d => d.typeGeneral))
            .range(['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00']);

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        // Append group element that will contain our actual chart (see margin convention)
        vis.chartContainer = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.chart = vis.chartContainer.append('g');

        vis.updateVis();
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        // Rollup data based on aggregated crime type
        vis.rollupData = d3.rollups(vis.data, v => v.length, d => d.typeGeneral);

        // Calculate total number of crimes in rollup data to use in text display later
        vis.totalCrimes = d3.sum(vis.rollupData, d => d[1]);

        // The radius of the donut chart is half the width or half the height (smallest one)
        vis.radius = Math.min(vis.width, vis.height) / 2;

        // Compute the position of each group on the pie
        vis.pie = d3.pie()
            .value(d => d[1]);
        vis.data_ready = vis.pie(vis.rollupData);
        // Now I know that group A goes from 0 degrees to x degrees and so on.

        // shape helper to build arcs:
        vis.arcGenerator = d3.arc()
            .innerRadius(vis.radius * 0.5)
            .outerRadius(vis.radius * 0.8);

        // Another arc that won't be drawn. Just for labels positioning
        vis.outerArc = d3.arc()
            .innerRadius(vis.radius * 0.9)
            .outerRadius(vis.radius * 0.9);

        vis.renderVis();
    }

    /**
     * Bind data to visual elements.
     */
    renderVis() {
        let vis = this;

        // Build the donut chart: Basically, each part of the pie is a path that we build using the arc function.
        const pieSlices = vis.chart.selectAll('.pie-slice')
                .data(vis.data_ready, d => d.data[0])
            .join('path')
                .attr('class', d => {
                    if (d.data[0] === activeCrime) {
                        return `pie-slice ${d.data[0]} active`;
                    }
                    return `pie-slice ${d.data[0]}`;
                })
                .attr('fill', d => vis.colorScale(d.data[0]))
                .attr('stroke', 'white')
                .style('stroke-width', '2px')
                .style('opacity', 0.9);

        // Now add the annotation and poly-lines to them. Use the centroid method to get the best coordinates.
        const polyLines = vis.chart.selectAll('.pie-polyline')
                .data(vis.data_ready, d => d.data[0])
            .join('polyline')
                .attr('class', 'pie-polyline');

        // Animate transitions depending on if necessary (if brushing has occurred)
        if (isBrushed) {
            pieSlices.transition().duration(700).attr('d', d => vis.arcGenerator(d));
            polyLines.transition().duration(700).attr('points', d => {
                return this.renderPolyLines(vis, d);
            });
        } else {
            pieSlices.attr('d', d => vis.arcGenerator(d));
            polyLines.attr('points', d => {
                return this.renderPolyLines(vis, d);
            });
        }

        vis.chart.selectAll('.pie-labels')
                .data(vis.data_ready, d => d.data[0])
                .enter()
            .append('text')
                .attr('class', 'pie-labels')
                .attr('transform', d => {
                    let pos = vis.outerArc.centroid(d);
                    const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                    pos[0] = vis.radius * 1.2 * (midAngle < Math.PI ? 1 : -1);
                    return 'translate(' + pos + ')';
                })
                .attr('text-anchor', 'middle')
                .call(text => text.append('tspan')
                    .attr('y', '-0.01em')
                    .attr('font-weight', 'bold')
                    .text(d => d.data[0]));

        // Render tooltip on pie area hover
        this.renderPieTooltip(pieSlices, vis);

        // Filter stacked area chart on pie slice click
        this.filterCrimeType(pieSlices);
    }

    /**
     * Render polylines connecting donut slice to its text label
     */
    renderPolyLines(vis, d) {
        // line insertion in the slice
        const posA = vis.arcGenerator.centroid(d);
        // line break: we use the other arc generator that has been built only for that
        const posB = vis.outerArc.centroid(d);
        // Label position = almost the same as posB
        let posC = vis.outerArc.centroid(d);
        // we need the angle to see if the X position will be at the extreme right or extreme left
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        // multiply by 1 or -1 to put it on the right or on the left
        posC[0] = vis.radius * 0.95 * (midAngle < Math.PI ? 1 : -1);
        return [posA, posB, posC];
    }

    /**
     * Render tooltip based on element passed to it
     */
    renderPieTooltip(renderGroup, vis) {
        renderGroup
            .on('mouseover', (event, d) => {
                d3.select('#tooltip')
                    .style('display', 'block')
                    .style('padding-bottom', '20px')
                    .html(`
                    <div>
                <div class="tooltip-title">${d.data[0].toUpperCase()}</div>
                <div class="tooltip-subtitle">${'Total ' + d.data[0] + ' count: ' + d.value}</div>
                <div class="tooltip-subtitle">${'Percentage of total crimes: ' +  
                    Math.round(d.value / vis.totalCrimes * 100) + '%'}</div>
                    </div>
              `);

                // Change color of slice on mouse over by adding class styled by css
                d3.select(event.currentTarget)
                    .classed('pie-hover', true);

                // Change cursor type to pointer on hover to indicate clickable region
                d3.select(event.currentTarget).style('cursor', 'pointer');
            })
            .on('mousemove', (event) => {
                d3.select('#tooltip')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
            })
            .on('mouseout', (event) => {
                d3.select('#tooltip').style('display', 'none');

                // Change color of slice on mouse over back to original by removing class
                d3.select(event.currentTarget)
                    .classed('pie-hover', false);
            });
    }

    /**
     * Filter functionality for crime type on pie slice click
     */
    filterCrimeType(renderGroup) {
        renderGroup
            .on('click', function(event, d) {
                if (isRelative) {
                    alert('Please set stacked area chart view to show absolute numbers in order to filter');
                    return;
                }

                // Return from method if "offence" is selected and not allow user to select this category since
                // location is not provided for this crime type in the raw data to protect privacy of those involved
                // in this type of crime
                if (d.data[0] === 'offence') {
                    alert('No location information is able to be displayed for the "offence" crime type in order to ' +
                        'protect the privacy of those that were involved. Please select a different type of crime to ' +
                        'see location information.');
                    return;
                }

                // Check if filter is already active
                const isActive = crimeTypeFilter.includes(d.data[0]);

                // Add class to style active filters with CSS
                d3.select(this).classed('active', !isActive);

                // Remove previously selected crime type filter, since only one filter is able to be active at a time
                const previousCrimeType = crimeTypeFilter.pop();

                // Show other crime type pie slice as un-selected since only one crime type can be filtered for at a time
                d3.select(`.${previousCrimeType}`).classed('active', false);

                // If new crime type is selected: add currently selected crime type to filter array
                // If same crime type is selected: keep crime type filter array empty so that pie slice is un-clicked
                if (previousCrimeType !== d.data[0]) {
                    activeCrime = d.data[0]; // set global active filter crime category to add class for styling css
                    crimeTypeFilter.push(d.data[0]); // Append filter

                    // Display bubble chart on click
                    d3.select('.bubbleChart-container')
                        .style('display', 'flex');

                } else {
                    activeCrime = ""; // remove selection css if same crime type is unselected

                    // Hide bubble chart on click of same category
                    d3.select('.bubbleChart-container')
                        .style('display', 'none');
                }

                // Call global function to update stacked area chart
                crimeTypeFilterData();
            });
    }
}