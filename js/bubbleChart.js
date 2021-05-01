class BubbleChart {
    /**
     * Class constructor with initial configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 800,
            containerHeight: _config.containerHeight || 400,
            margin: _config.margin || { top: 25, right: 220, bottom: 25, left: 150 },
            tooltipPadding: _config.tooltipPadding || 15,
            dayTime: true,
            nightTime: true,
        };
        this.data = _data;
        this.initVis();
    }

    /**
     * Create scales, axes, and append static elements
     */
    initVis() {
        let vis = this;

        // Create color palette, converting hex to HSL
        vis.colorPalette = d3.scaleOrdinal()
            .domain(vis.data.map(d => d.typeGeneral))
            .range([d3.hsl('#e41a1c'), d3.hsl('#377eb8'), d3.hsl('#4daf4a'), d3.hsl('#984ea3'), d3.hsl('#ff7f00')]);
        
        // Set chart inner width and height
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Set scales
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([0, vis.height]);

        vis.rScale = d3.scaleSqrt()
            .range([2, 20]);

        vis.colorScale = d3.scaleLinear()
            .domain([0, 1, 2, 3, 4])
            .range([1, 1.2, 1.4, 1.6, 1.7]);
        
        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSize(0)
            .tickPadding(5);

        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Initialize legend
        vis.legendG = vis.svg.append('g')
            .attr('class', 'bubble-legend')
            .attr('transform', `translate(-60,-80)`);
            
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height - 20})`);

        // X-axis labels
        vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', 20)
            .attr('y', vis.config.containerHeight - 4)
            .text('Highest');

        vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', vis.config.containerWidth - 150)
            .attr('y', vis.config.containerHeight - 4)
            .text('Lowest');

        // Initialize the simulation, but don't start it
        vis.simulation = d3.forceSimulation()
            .force('charge', d3.forceManyBody())
            .on('tick', function() {
                d3.selectAll('.node')
                    .attr('transform', (d) => `translate(${d.x},${d.y})`)
            })
            .stop();

        vis.updateVis();
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        // Stop the simulation
        vis.simulation.stop();

        // Filter out null neighbourhoods
        vis.dataNoNullNeighbourhood = d3.filter(vis.data, (d) => d['NEIGHBOURHOOD'] !== "");

        // Filter data by day time or night time
        let filterTimeData = vis.dataNoNullNeighbourhood;
        if (vis.config.dayTime && !vis.config.nightTime) {
            filterTimeData = d3.filter(filterTimeData, (d) => d.nightTime === false);
        } else if (!vis.config.dayTime && vis.config.nightTime) {
            filterTimeData = d3.filter(filterTimeData, (d) => d.nightTime === true);
        }

        // Group data by neighbourhood in descending order of crime level, and only top 5
        vis.highestFiveNeighbourhoods = d3.groups(filterTimeData, (d) => d['NEIGHBOURHOOD'])
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 5);

        // Group data by neighbourhood, then hundred_block
        vis.dataNeighbourhoodBlock = d3.groups(filterTimeData, 
            (d) => d['NEIGHBOURHOOD'],
            (d) => d['HUNDRED_BLOCK']);

        // Get only the highest 5 neighbourhoods data
        vis.highestFiveNeighbourhoodsData = [];
        for (let i = 0; i < vis.highestFiveNeighbourhoods.length; i++) {
            let res = vis.dataNeighbourhoodBlock.find((a) => a[0] === vis.highestFiveNeighbourhoods[i][0]);
            vis.highestFiveNeighbourhoodsData.push(res);
        }

        // Sort blocks by descending amount of crime
        for (let i = 0; i < vis.highestFiveNeighbourhoodsData.length; i++) {
            vis.highestFiveNeighbourhoodsData[i][1].sort((a, b) => d3.descending(a[1].length, b[1].length));
        }

        // Reduce nodes by half
        vis.highestFiveNeighbourhoodsData.forEach(d => {
            d[1] = d[1].slice(0, Math.floor(d[1].length*0.4));
        });

        // Initialize some values to create the nodes data
        vis.numNeighbourhoods = vis.highestFiveNeighbourhoodsData.length;
        vis.clusters = new Array(vis.numNeighbourhoods);
        vis.nodesToDisplay = [];

        // Create nodes data
        for (let i = 0; i < vis.numNeighbourhoods; i++) {
            for (let j = 0; j < vis.highestFiveNeighbourhoodsData[i][1].length; j++) {
                vis.nodesToDisplay.push(vis.create_nodes(vis.highestFiveNeighbourhoodsData[i][1], i, j));
            }
        }
        
        // get various radius values
        let maxRadius = d3.max(vis.nodesToDisplay, d => d.radius);
        let minRadius = d3.min(vis.nodesToDisplay, d => d.radius);
        
        // Set scales domains
        vis.xScale.domain([1, 5]);
        vis.yScale.domain([vis.height, vis.height]);
        vis.rScale.domain([minRadius, maxRadius]);

        // Set x axis labels
        vis.xAxis
            .ticks(vis.numNeighbourhoods)
            .tickFormat((d, i) => vis.highestFiveNeighbourhoods[i][0]);
    
        // Set legend values to display
        vis.valuesToShow = [minRadius, Math.floor((minRadius+maxRadius)/2), maxRadius];

        // Update bubbles data
        vis.simulation.nodes(vis.nodesToDisplay)
            .force('x', d3.forceX(d => vis.xScale(d.cluster + 1)).strength(3))
            .force('y', d3.forceY(d => d.y).strength(2))
            .force('collide', d3.forceCollide(d => vis.rScale(d.radius + 0.5)));

        // only render if there is an active crime
        if (activeCrime !== "") {
            vis.renderLegend();
            vis.renderVis();
        }
    }

    /**
     * Bind data to visual elements.
     */
    renderVis() {
        let vis = this;

        // Create simulation for the directed graph
        vis.renderSimulation();

        // Call x-axis
        vis.xAxisG.call(vis.xAxis)
            .call(g => g.select('.domain').remove())
            .selectAll('text')
                .attr('transform', `rotate(-20)`)
                .attr('z-index', '9999');
    }

    /**
     * Make the simulation for all bubbles
     */
     renderSimulation() {
        let vis = this;        

        // Make bubbles nodes
        const bubble = vis.chart.selectAll('.node')
            .data(vis.nodesToDisplay, (d) => d.id);

        // Append circle to each node
        const bubbles = bubble.enter()
            .append('circle')
            .attr('class', 'node');

        bubble.exit().remove();

        // Style the bubbles
        // Add tooltip on hover to each bubble with information about crime level
        bubble.merge(bubbles)
            .attr('r', d => vis.rScale(d.radius))
            .attr('fill', d => {
                if (activeCrime !== "") {
                    return d3.hsl(
                        vis.colorPalette(activeCrime).h,
                        vis.colorPalette(activeCrime).s,
                        vis.colorPalette(activeCrime).l * vis.colorScale(d.cluster)
                    );
                } else {
                    let defaultColor = d3.hsl('#505050');
                    return d3.hsl(
                        defaultColor.h,
                        defaultColor.s,
                        defaultColor.l * vis.colorScale(d.cluster)
                    );
                }
            })
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .on('mouseover', (event, d) => {
                d3.select('#tooltip')
                    .style('display', 'block')
                    .style('left', event.pageX + vis.config.tooltipPadding + 'px')
                    .style('top', event.pageY + vis.config.tooltipPadding + 'px')
                    .html(
                        `<div>
                            <ul>
                                <li><b class="tooltip-bold">Block</b>: ${d.data.block}</li>
                                <li><b class="tooltip-bold">Crime Level</b>: ${d.data.numCrimes}</li>
                            </ul>
                        </div>`
                    );
                d3.select(`#bubble${d.index} circle`)
                    .attr('stroke', 'black')
                    .attr('stroke-width', 3);
            })
            .on('mouseleave', (event, d) => {
                d3.select('#tooltip').style('display', 'none');
                d3.select(`#bubble${d.index} circle`)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 1.5);
            });            

        // Now start the simulation, since we stopped it before
        // Need to specify alpha because it is stopping mid way through re-render
        vis.simulation
            .alpha(1)
            .restart();
        
        // Make the simulation run faster
        vis.simulation.tick(100);
    }

    /**
     * Create nodes for the bubble chart
     */
    create_nodes(data, cluster_counter, node_counter) {
        let vis = this;

        let i = cluster_counter,
            d = {
                id: cluster_counter + '-' + node_counter,
                cluster: i,
                radius: data[node_counter][1].length,
                data: {block: data[node_counter][0], numCrimes: data[node_counter][1].length},
                x:  Math.cos(2 * Math.PI) + (vis.width / 5 / 2)*(i+1) - Math.random(),
                y:  Math.sin(2 * Math.PI) + vis.height / 2 + Math.random(),
            };
        return d;
    }

    /**
     * Render dynamic legend
     */
    renderLegend() {
        let vis = this;

        // Remove previous circles and text
        vis.legendG.selectAll('circle').remove();
        vis.legendG.selectAll('text').remove();
        
        // Add legend title
        vis.legendG.append("text")
            .text("Crime level:")
            .attr("font-size", 12)
            .attr("x", 80)
            .attr("y", 105)
            .style("alignment-baseline", "middle");

        // 100 position of first dot
        // 100 distance between dots
        vis.legendG.selectAll(".circle")
                .data(vis.valuesToShow, d => d)
            .join('circle')
                .attr('class', 'legend-circle')
                .attr("cx", (d,i) => { return 180 + i*80 })
                .attr("cy", 105)
                .attr("r", (d) => vis.rScale(d))
                .attr('stroke', 'black')
                .attr('stroke-width', 1.2)
                .attr('fill', 'none');

        // 100 position of first label
        // 100 distance between labels
        vis.legendG.selectAll(".text")
                .data(vis.valuesToShow, d => d)
            .join('text')
                .attr('class', 'legend-text')
                .attr("x", (d,i) => { return 183 + i*80 + vis.rScale(d) }) 
                .attr("y", 105) 
                .text((d) => d)
                .attr("text-anchor", "left")
                .style('font-size', 12)
                .style("alignment-baseline", "middle");
    }
}
