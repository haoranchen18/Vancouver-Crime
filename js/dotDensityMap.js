class DotDensityMap {
    constructor(data) {
        this.crime = data;
        this.initMap();
    }

    // initialize the map
    initMap() {
        // set the width and height (in percentage) to the map region
        d3.select('#map').style('width', '65vw').style('height', '60vh');

        // get width and height from DOM element
        let width = d3.select('#map').node().offsetWidth;
        let height = d3.select('#map').node().offsetHeight;

        // set actual width and height to the map region
        d3.select('#map').attr('width', width).attr('height', height);

        // let map show Vancouver with the given lat/long
        // also set the default zoom depth
        this.map = L.map('map').setView(
            [49.2587236,-123.1036059],
            12
        );

        // import layer to the map
        // initiate a tile layer object given a URL template
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(this.map);

        //initialize svg and link it to map
        L.svg({ clickable: true }).addTo(this.map); // we have to make the svg layer clickable
        const overlay = d3.select(this.map.getPanes().overlayPane);

        // hand-like pointer event (cursor)
        const svg = overlay.select('svg').attr('pointer-events', 'auto');

        this.svg = svg;
        this.width = width;
        this.height = height;

        // Set group element for the dots that will be introduced
        this.g = svg.append('g');
        this.tip();
    }

    // initialize the dots on map according to the data
    drawCircleOnMap(brushedData) {
        let map = this.map;

        // reference: https://github.com/d3fc/d3fc/tree/master/packages/d3fc-sample
        // Create the sampler
        const {largestTriangleThreeBucket} = fc;
        const sampler = largestTriangleThreeBucket();

        // Configure the  lat / long value accessors
        sampler.x(d => +d.Latitude)
            .y(d => +d.Longitude);

        // Configure the size of the buckets used to downsample the data.
        sampler.bucketSize(40);

        // Get the sampled data and assign it to this.selectedCrime variable
        if (brushedData) {
            // Run the sampler
            const sampledData = sampler(brushedData);
            this.selectedCrime = sampledData;
        } else {
            const sampledData = sampler(this.crime);
            this.selectedCrime = sampledData;
        }

        // transfer lat/long to coordinate position on map
        this.x = (d) => map.latLngToLayerPoint([+d.Latitude, +d.Longitude]).x;
        this.y = (d) => map.latLngToLayerPoint([+d.Latitude, +d.Longitude]).y;

        // set the dots
        if (brushedData) {
            this.Dots = this.g.selectAll('.circles')
                    .data(this.selectedCrime)
                .join('circle')
                    .attr('class', 'circles')
                    .attr('pointer-events', 'visible')
                    .attr('fill', 'red')
                    .on('mouseover', this.tool_tip.show)
                    .on('mouseout', this.tool_tip.hide);

            // Based on if brushing or other transitions (filtering by crime type or going from absolute to relative levels)
            // Have to draw area paths with transitions or not (brushed doesn't detect transitions in this way)
            if (isBrushed) {
                this.Dots
                    .transition()
                    .delay(1000)
                    .duration(500)
                    .attr('cx', this.x)
                    .attr('cy', this.y)
                    .attr('r', 2);
            } else {
                this.Dots
                    .attr('cx', this.x)
                    .attr('cy', this.y)
                    .attr('r', 2);
            }
        }

        // set update function
        const update = (e) => {
            this.Dots.attr('cx', this.x)
                .attr('cy', this.y)
                .attr('r', e.target._zoom <= 12 ? 2 : 5);
        };

        // call update to refresh the dots on map after zooming
        map.on('zoomend', update);
    }

    // initialize the tooltip
    tip() {
        this.tool_tip = d3.tip()
            .attr('class', 'd3-tip')
            .offset([1, 1])
            .html(
                (e, d) => `
                    <ul>
                        <li> <b class="tooltip-bold">Month</b>: ${d.YEAR + '-' + d.MONTH} </li>
                        <li> <b class="tooltip-bold">Neighbourhood</b>: ${d.NEIGHBOURHOOD} </li>
                        <li> <b class="tooltip-bold">Type</b>: ${d.TYPE} </li>
                        <li> <b class="tooltip-bold">Time</b>: ${d.nightTime ? 'Night Time' : 'Day Time'} </li>
                    </ul>
                    `
            );

        this.svg.call(this.tool_tip);
    }
}
